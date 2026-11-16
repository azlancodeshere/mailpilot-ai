import { Request, Response, CookieOptions } from "express"
import { Types } from "mongoose"
import jwt from "jsonwebtoken"
import User from "../models/user.model"
import { ApiError } from "../utils/ApiError"
import { ApiResponse } from "../utils/ApiResponse"

const TOKEN_COOKIES: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
}

const generateAccessAndRefreshTokens = async (
  userId: Types.ObjectId
): Promise<{ accessToken: string; refreshToken: string }> => {
  const user = await User.findById(userId)

  if (!user) {
    throw new ApiError(404, "User not found")
  }

  const accessToken = user.generateAccessToken()
  const refreshToken = user.generateRefreshToken()

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  return { accessToken, refreshToken }
}

const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const incomingRefreshToken: string | undefined =
      req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is required")
    }

    const secret = process.env.REFRESH_TOKEN_SECRET

    if (!secret) {
      throw new ApiError(500, "Refresh token secret is missing")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, secret)

    if (
      typeof decodedToken === "string" ||
      typeof decodedToken._id !== "string" ||
      !Types.ObjectId.isValid(decodedToken._id)
    ) {
      throw new ApiError(401, "Invalid refresh token")
    }

    const user = await User.findById(decodedToken._id).select("+refreshToken")

    if (!user || incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or invalid")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    res
      .status(200)
      .cookie("accessToken", accessToken, TOKEN_COOKIES)
      .cookie("refreshToken", refreshToken, TOKEN_COOKIES)
      .json(new ApiResponse(200, accessToken, "Access token refreshed successfully"))
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message,
        success: false,
      })
      return
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        statusCode: 401,
        message: "Invalid or expired refresh token",
        success: false,
      })
      return
    }

    res.status(500).json({
      statusCode: 500,
      message: "Something went wrong while refreshing token",
      success: false,
    })
  }
}

const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username, role } = req.body

    if (
      [email, password, username].some(
        (field) => typeof field !== "string" || field.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required")
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    })

    if (existingUser) {
      throw new ApiError(409, "User with this email or username already exists")
    }

    const user = await User.create({
      email,
      password,
      username,

      ...(role === "client" || role === "assistant" ? { role } : {}),
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    res
      .status(201)
      .cookie("accessToken", accessToken, TOKEN_COOKIES)
      .cookie("refreshToken", refreshToken, TOKEN_COOKIES)
      .json(new ApiResponse(201, createdUser, "User registered successfully"))
  } catch (error: unknown) {
    const apiError =
      error instanceof ApiError
        ? error
        : (error as { code?: number })?.code === 11000
          ? new ApiError(409, "User with this email or username already exists")
          : new ApiError(500, "Something went wrong while registering the user")

    res.status(apiError.statusCode).json({
      statusCode: apiError.statusCode,
      message: apiError.message,
      success: false,
    })
  }
}

const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body

    if ((!email && !username) || !password) {
      throw new ApiError(400, "Email/username and password are required")
    }

    const conditions: Record<string, string>[] = []

    if (email) conditions.push({ email })
    if (username) conditions.push({ username })

    const user = await User.findOne({ $or: conditions })

    if (!user) {
      throw new ApiError(401, "Invalid email/username or password")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email/username or password")
    }

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    if (!loggedInUser) {
      throw new ApiError(500, "Something went wrong while logging in")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    res
      .status(200)
      .cookie("accessToken", accessToken, TOKEN_COOKIES)
      .cookie("refreshToken", refreshToken, TOKEN_COOKIES)
      .json(
        new ApiResponse(
          200,
          { user: loggedInUser, accessToken, refreshToken },
          "User logged in successfully"
        )
      )
  } catch (error: unknown) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "Something went wrong while logging in")

    res.status(apiError.statusCode).json({
      statusCode: apiError.statusCode,
      message: apiError.message,
      success: false,
    })
  }
}

const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized request")
    }

    await User.findByIdAndUpdate(req.user._id, {
      $unset: { refreshToken: 1 },
    })

    res
      .status(200)
      .clearCookie("accessToken", TOKEN_COOKIES)
      .clearCookie("refreshToken", TOKEN_COOKIES)
      .json(new ApiResponse(200, null, "User logged out successfully"))
  } catch (error: unknown) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "Something went wrong while logging out")

    res.status(apiError.statusCode).json({
      statusCode: apiError.statusCode,
      message: apiError.message,
      success: false,
    })
  }
}

const updateAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized request")
    }

    const { email, username } = req.body

    if (email === undefined && username === undefined) {
      throw new ApiError(400, "At least one field is required")
    }

    const updates: { email?: string; username?: string } = {}

    if (email !== undefined) updates.email = email
    if (username !== undefined) updates.username = username

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password -refreshToken")

    if (!user) {
      throw new ApiError(404, "Account details not found")
    }

    res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
  } catch (error: unknown) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "Something went wrong while updating account")

    res.status(apiError.statusCode).json({
      statusCode: apiError.statusCode,
      message: apiError.message,
      success: false,
    })
  }
}

const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  const user = req.user

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Unauthorized request",
    })
    return
  }

  res.set("Cache-Control", "no-store")

  res.status(200).json(new ApiResponse(200, user, "Account details fetched successfully"))
}

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  updateAccount,
  getCurrentUser,
}
