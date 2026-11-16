import { Router } from "express"
import { getStats, getNeedsAttention } from "../controllers/dashboard.controller"
import { verifyJWT } from "../middleware/auth.middleware"

const router = Router()

router.use(verifyJWT)

router.get("/stats", getStats)
router.get("/attention", getNeedsAttention)

export default router
