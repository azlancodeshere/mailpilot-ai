import type { Request, Response, NextFunction } from "express"
import type { ZodType } from "zod"

type Source = "body" | "query" | "params"

/**
 * Validates the chosen request source against a zod schema.
 * Parsed body data is written back to the request; query/params are only
 * validated (Express 5 exposes `req.query` as a read-only getter).
 */
export const validate =
  (schema: ZodType, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source])

    if (!result.success) return next(result.error)

    // `req.query` is a read-only getter in Express 5, so shadow it with an own property.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })

    next()
  }
