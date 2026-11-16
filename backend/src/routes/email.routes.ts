import { Router } from "express"
import {
  listConversationsHandler,
  listClientInbox,
  listSegments,
  getConversation,
  updateConversationHandler,
  sendReply,
  ingestEmailHandler,
} from "../controllers/email.controller"
import { verifyJWT } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import {
  listConversationsSchema,
  updateConversationSchema,
  sendMessageSchema,
  ingestEmailSchema,
} from "../validators/email.validator"

const router = Router()

router.use(verifyJWT)

router.get("/", validate(listConversationsSchema, "query"), listConversationsHandler)
router.get("/segments", listSegments)
router.get("/client", listClientInbox)
router.post("/ingest", validate(ingestEmailSchema), ingestEmailHandler)
router.get("/conversations/:id", getConversation)
router.patch("/conversations/:id", validate(updateConversationSchema), updateConversationHandler)
router.post("/conversations/:id/reply", validate(sendMessageSchema), sendReply)

export default router
