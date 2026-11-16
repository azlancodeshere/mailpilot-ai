import { createContext, useContext } from "react"

export type ToastType = "success" | "error" | "info"

export const ToastContext = createContext<{ push: (type: ToastType, message: string) => void }>({
  push: () => undefined,
})

export const useToast = () => useContext(ToastContext)
