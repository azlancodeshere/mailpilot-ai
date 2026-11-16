import { useEffect, type ReactNode } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "./components/AppShell"
import { Logo } from "./components/ui"
import { ToastProvider } from "./components/toast"
import { useAuth } from "./store/auth"
import "./App.css"
import Welcome from "./pages/Welcome"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Onboarding from "./pages/Onboarding"
import Dashboard from "./pages/Dashboard"
import Inbox from "./pages/Inbox"
import Conversation from "./pages/Conversation"
import AskAI from "./pages/AskAI"
import Accounts from "./pages/Accounts"
import ClientPortal from "./pages/ClientPortal"
import NotFound from "./pages/NotFound"

function FullPageLoader({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="fullpage-loader">
      <Logo size={40} />
      <span className="loader-text">{label}</span>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user)
  const status = useAuth((state) => state.status)

  if (status === "idle") return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user)
  const status = useAuth((state) => state.status)

  if (status === "idle") return <FullPageLoader />
  if (user) return <Navigate to={user.role === "client" ? "/client" : "/app"} replace />
  return <>{children}</>
}

const shell = (element: ReactNode) => (
  <RequireAuth>
    <AppShell>{element}</AppShell>
  </RequireAuth>
)

export default function App() {
  const bootstrap = useAuth((state) => state.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <Signup />
            </RedirectIfAuthed>
          }
        />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route path="/app" element={shell(<Dashboard />)} />
        <Route path="/app/inbox" element={shell(<Inbox />)} />
        <Route path="/app/conversations/:id" element={shell(<Conversation />)} />
        <Route path="/app/ask" element={shell(<AskAI />)} />
        <Route path="/app/accounts" element={shell(<Accounts />)} />
        <Route path="/client" element={<RequireAuth><ClientPortal /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  )
}
