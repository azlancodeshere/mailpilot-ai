import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import User, { IUser } from "../models/user.model"
import { ApiError } from "../utils/ApiError"
import env from "../config/env"

declare global {
  namespace Express {
    interface Request {
      user?: IUser
    }
  }
}

interface AccessTokenPayload {
  _id?: unknown
}

const extractToken = (req: Request): string | undefined => {
  const cookieToken = req.cookies?.accessToken
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken

  const header = req.headers.authorization
  if (typeof header === "string" && /^bearer\s+/i.test(header)) {
    return header.replace(/^bearer\s+/i, "").trim()
  }

  return undefined
}

export const verifyJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req)

    if (!token) {
      throw new ApiError(401, "Unauthorized request: access token is missing")
    }

    if (!env.ACCESS_TOKEN_SECRET) {
      throw new ApiError(500, "Access token secret is missing")
    }

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload

    if (typeof decoded === "string" || !decoded._id) {
      throw new ApiError(401, "Invalid access token")
    }

    const user = await User.findById(decoded._id).select("-password -refreshToken")

    if (!user) {
      throw new ApiError(401, "Invalid access token: user no longer exists")
    }

    req.user = user
    next()
  } catch (error) {
    if (error instanceof ApiError) return next(error)

    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Access token is invalid or expired"))
    }

    next(error)
  }
}
