import { create } from "zustand"
import { authApi, getToken, setToken } from "../lib/api"
import type { User } from "../lib/types"

interface AuthState {
  user: User | null
  status: "idle" | "loading" | "ready"
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  register: (
    username: string,
    email: string,
    password: string,
    role?: "assistant" | "client"
  ) => Promise<User>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  bootstrap: async () => {
    if (!getToken()) {
      set({ user: null, status: "ready" })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, status: "ready" })
    } catch {
      setToken(null)
      set({ user: null, status: "ready" })
    }
  },

  login: async (email, password) => {
    const result = await authApi.login({ email, password })
    setToken(result.accessToken)
    set({ user: result.user, status: "ready" })
    return result.user
  },

  register: async (username, email, password, role) => {
    await authApi.register({ username, email, password, role })

    const result = await authApi.login({ email, password })
    setToken(result.accessToken)
    set({ user: result.user, status: "ready" })
    return result.user
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {

    }
    setToken(null)
    set({ user: null, status: "ready" })
  },
}))
