import axios from "axios"
import type {
  Account,
  Classification,
  ClassificationResult,
  Conversation,
  ConversationSummary,
  DashboardStats,
  DraftResult,
  Message,
  Paged,
  Provider,
  SegmentMeta,
  User,
} from "./types"

interface ApiEnvelope<T> {
  success: boolean
  statusCode: number
  data: T
  message: string
}

const TOKEN_KEY = "mailpilot.accessToken"

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null): void => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string | null> | null = null

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const response = await axios.post<ApiEnvelope<string>>(
      `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
      {},
      { withCredentials: true }
    )
    const token = response.data.data
    setToken(token)
    return token
  } catch {
    setToken(null)
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined

    const status = error.response?.status
    const url: string = original?.url || ""

    if (status === 401 && original && !original._retry && !url.includes("/auth/")) {
      original._retry = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })

      const token = await refreshPromise
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
        return api(original)
      }
    }

    return Promise.reject(error)
  }
)

const unwrap = async <T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => {
  const response = await promise
  return response.data.data
}

export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiEnvelope<unknown> | undefined
    if (body?.message) return body.message
    if (error.code === "ECONNABORTED") return "Request timed out — please try again"
    return error.message
  }
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export const authApi = {
  register: (body: { username: string; email: string; password: string; role?: "assistant" | "client" }) =>
    unwrap<User>(api.post("/auth/register", body)),

  login: (body: { email?: string; username?: string; password: string }) =>
    unwrap<{ user: User; accessToken: string; refreshToken: string }>(
      api.post("/auth/login", body)
    ),

  logout: () => unwrap<null>(api.post("/auth/logout")),

  me: () => unwrap<User>(api.get("/users/me")),
}

export const accountsApi = {
  list: () => unwrap<{ accounts: Account[] }>(api.get("/accounts")),

  connect: (body: { provider: Provider; email: string; displayName?: string }) =>
    unwrap<{
      account: Account
      seeded: number
      authorization: { mode: string; message: string }
    }>(api.post("/accounts/connect", body)),

  sync: (id: string) => unwrap<{ account: Account }>(api.post(`/accounts/${id}/sync`)),

  disconnect: (id: string) =>
    unwrap<{ accountId: string; removedConversations: number }>(api.delete(`/accounts/${id}`)),
}

export const dashboardApi = {
  stats: () => unwrap<DashboardStats>(api.get("/dashboard/stats")),
}

export interface ListParams {
  segment?: string
  q?: string
  accountId?: string
  status?: string
  includeArchived?: boolean
  page?: number
  limit?: number
}

export const emailsApi = {
  list: (params: ListParams = {}) =>
    unwrap<Paged<Conversation>>(
      api.get("/emails", {
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")),
      })
    ),

  segments: (accountId?: string) =>
    unwrap<{ segments: SegmentMeta[] }>(api.get("/emails/segments", { params: { accountId } })),

  clientList: (page = 1, limit = 20) =>
    unwrap<Paged<Conversation>>(api.get("/emails/client", { params: { page, limit } })),

  get: (id: string) =>
    unwrap<{ conversation: Conversation; messages: Message[] }>(api.get(`/emails/conversations/${id}`)),

  update: (
    id: string,
    patch: {
      classification?: Classification
      reason?: string
      isImportant?: boolean
      isRead?: boolean
      isArchived?: boolean
      status?: string
      clientAction?: "pending" | "handled" | "delegated"
    }
  ) => unwrap<{ conversation: Conversation }>(api.patch(`/emails/conversations/${id}`, patch)),

  reply: (id: string, body: { body: string; source: "ai" | "manual"; approved?: boolean }) =>
    unwrap<{ message: Message; conversation: Conversation }>(
      api.post(`/emails/conversations/${id}/reply`, body)
    ),

  ingest: (body: {
    accountId: string
    from: { name?: string; email: string }
    subject: string
    body: string
  }) =>
    unwrap<{ conversation: Conversation; classification: ClassificationResult }>(
      api.post("/emails/ingest", body)
    ),
}

export const aiApi = {
  summarize: (id: string) =>
    unwrap<{ summary: ConversationSummary; conversation: Conversation }>(
      api.post(`/ai/conversations/${id}/summarize`)
    ),

  classify: (id: string) =>
    unwrap<{ classification: ClassificationResult; conversation: Conversation }>(
      api.post(`/ai/conversations/${id}/classify`)
    ),

  draft: (id: string, body: { tone?: "professional" | "friendly" | "formal"; instructions?: string }) =>
    unwrap<DraftResult>(api.post(`/ai/conversations/${id}/draft`, body)),

  ask: (body: { question: string; conversationId?: string }) =>
    unwrap<{ answer: string; source: "ai" | "rules" }>(api.post("/ai/ask", body)),
}
