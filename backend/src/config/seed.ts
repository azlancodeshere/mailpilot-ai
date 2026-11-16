import User from "../models/user.model"

const DEMO_ACCOUNT = {
  username: "sarah",
  email: "sarah@example.com",
  password: "password123",
}

export const seedDemoUser = async (): Promise<void> => {
  const existing = await User.findOne({ email: DEMO_ACCOUNT.email }).select("_id")
  if (existing) return

  await User.create(DEMO_ACCOUNT)
  console.log(`Seeded demo user ${DEMO_ACCOUNT.email}`)
}
