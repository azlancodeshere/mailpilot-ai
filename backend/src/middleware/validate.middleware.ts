import type { Request, Response, NextFunction } from "express"
import type { ZodType } from "zod"

type Source = "body" | "query" | "params"

export const validate =
  (schema: ZodType, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source])

    if (!result.success) return next(result.error)

    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })

    next()
  }
