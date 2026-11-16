import { Router } from "express"
import { getStats } from "../controllers/dashboard.controller"
import { verifyJWT } from "../middleware/auth.middleware"

const router = Router()

router.use(verifyJWT)

router.get("/stats", getStats)

export default router
