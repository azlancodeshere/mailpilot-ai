import { Router } from "express"
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
} from "../controllers/auth.controller"
import { validate } from "../middleware/validate.middleware"
import { verifyJWT } from "../middleware/auth.middleware"
import { registerSchema, loginSchema } from "../validators/auth.validator"

const router = Router()

router.post("/register", validate(registerSchema), registerUser)
router.post("/login", validate(loginSchema), loginUser)
router.post("/logout", verifyJWT, logoutUser)
router.post("/refresh", refreshAccessToken)

export default router
