import type { Request, Response, NextFunction } from "express"
import { ZodError } from "zod"
import { ApiError } from "../utils/ApiError"

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

interface MongoErrorLike {
  code?: number
  keyValue?: Record<string, unknown>
  errors?: Record<string, { message?: string }>
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) return next(err)

  let statusCode = 500
  let message = "Something went wrong"

  if (err instanceof ApiError) {
    statusCode = err.statusCode
    message = err.message
  } else if (err instanceof ZodError) {
    statusCode = 400
    message = err.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join(", ")
  } else if (err instanceof Error) {
    const mongoError = err as Error & MongoErrorLike

    if (mongoError.name === "ValidationError" && mongoError.errors) {
      statusCode = 400
      message = Object.values(mongoError.errors)
        .map((field) => field.message || "Invalid value")
        .join(", ")
    } else if (mongoError.code === 11000) {
      statusCode = 409
      const fields = Object.keys(mongoError.keyValue || {}).join(", ")
      message = `Duplicate value for field: ${fields || "unknown"}`
    } else if (mongoError.name === "CastError") {
      statusCode = 400
      message = "Invalid identifier supplied"
    } else {
      message = mongoError.message
    }
  }

  if (statusCode >= 500) {
    console.error("Unhandled server error:", err)
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  })
}
