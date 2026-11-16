import { Router } from "express"
import { getCurrentUser, updateAccount } from "../controllers/user.controller"
import { verifyJWT } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { updateAccountSchema } from "../validators/auth.validator"

const router = Router()

router.use(verifyJWT)

router.get("/me", getCurrentUser)
router.patch("/me", validate(updateAccountSchema), updateAccount)

export default router
