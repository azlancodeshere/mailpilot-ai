import { Router } from "express"
import { summarize, reclassify, draft, ask } from "../controllers/ai.controller"
import { verifyJWT } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import { askSchema, draftReplySchema } from "../validators/email.validator"

const router = Router()

router.use(verifyJWT)

router.post("/conversations/:id/summarize", summarize)
router.post("/conversations/:id/classify", reclassify)
router.post("/conversations/:id/draft", validate(draftReplySchema), draft)
router.post("/ask", validate(askSchema), ask)

export default router
