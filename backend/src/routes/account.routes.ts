import { Router } from "express"
import {
  listAccounts,
  connectAccount,
  getAccount,
  syncAccount,
  disconnectAccount,
} from "../controllers/account.controller"
import { verifyJWT } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { connectAccountSchema } from "../validators/email.validator"

const router = Router()

router.use(verifyJWT)

router.get("/", listAccounts)
router.post("/connect", validate(connectAccountSchema), connectAccount)
router.get("/:id", getAccount)
router.post("/:id/sync", syncAccount)
router.delete("/:id", disconnectAccount)

export default router
