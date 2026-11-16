import { z } from "zod"

export const registerSchema = z.object({
  username: z.string().trim().min(2, "Username must be at least 2 characters").max(50),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: z.enum(["assistant", "client"]).optional(),
})

export const loginSchema = z
  .object({
    email: z.email("Enter a valid email address").optional(),
    username: z.string().trim().min(2).optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.email || data.username), {
    message: "Email or username is required",
    path: ["email"],
  })

export const updateAccountSchema = z
  .object({
    email: z.email("Enter a valid email address").optional(),
    username: z.string().trim().min(2).max(50).optional(),
  })
  .refine((data) => data.email !== undefined || data.username !== undefined, {
    message: "At least one field is required",
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
