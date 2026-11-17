import express, { Request, Response } from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser"

import connectDB from "./config/db"
import { seedDemoUser } from "./config/seed"

import authRoutes from "./routes/auth.routes"
import userRoutes from "./routes/user.routes"
import accountRoutes from "./routes/account.routes"
import emailRoutes from "./routes/email.routes"
import aiRoutes from "./routes/ai.routes"
import dashboardRoutes from "./routes/dashboard.routes"
import { errorHandler, notFound } from "./middleware/error.middleware"

dotenv.config()

const app = express()

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`Origin ${origin} not allowed by CORS`))
    },
    credentials: true,
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "MailPilot AI Backend is running 🚀",
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/accounts", accountRoutes)
app.use("/api/emails", emailRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/dashboard", dashboardRoutes)

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

const startServer = async (): Promise<void> => {
  try {
    await connectDB()
    await seedDemoUser()

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Server startup failed:", error)
    process.exit(1)
  }
}

startServer()
