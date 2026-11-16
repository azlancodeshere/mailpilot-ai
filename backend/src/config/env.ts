import dotenv from "dotenv"

dotenv.config()

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  MONGODB_URI: process.env.MONGODB_URI || "",
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "",
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "1d",
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "10d",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
}

export default env
