import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Bot, Lock, Mail, Sparkles, User, UserRound } from "lucide-react"
import { Button, Field, Logo } from "../components/ui"
import { useToast } from "../components/useToast"
import { errorMessage } from "../lib/api"
import { useAuth } from "../store/auth"

type Role = "assistant" | "client"

export default function Signup() {
  const navigate = useNavigate()
  const register = useAuth((state) => state.register)
  const { push } = useToast()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("assistant")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (username.trim().length < 2) {
      setError("Please enter your name (at least 2 characters).")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    setLoading(true)
    try {
      await register(username.trim(), email.trim(), password, role)
      push("success", role === "client" ? "Account created — welcome!" : "Workspace created — welcome!")
      navigate(role === "client" ? "/client" : "/onboarding")
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Link to="/">
          <Logo size={32} />
        </Link>
        <div className="auth-aside-body">
          <h2>
            Your client's inbox, <span className="gradient-text">finally organised.</span>
          </h2>
          <p>
            Create a workspace, connect a mailbox in under a minute, and let AI decide who needs
            to respond — while you keep the final say.
          </p>
          <ul className="auth-points">
            <li>
              <Sparkles size={15} /> One-click mailbox connection
            </li>
            <li>
              <Sparkles size={15} /> Automatic classification with manual overrides
            </li>
            <li>
              <Sparkles size={15} /> Approve-before-send AI drafts
            </li>
          </ul>
        </div>
        <span className="auth-aside-foot">Prototype · simulated Gmail &amp; Outlook connections</span>
      </aside>

      <main className="auth-panel">
        <div className="auth-card animate-fade-in">
          <div className="auth-head">
            <h1>Create your account</h1>
            <p>Start managing your client's communication in minutes.</p>
          </div>

          {error ? (
            <div className="alert alert-error animate-fade-in" role="alert">
              {error}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={submit} noValidate>
            <div className="role-toggle" role="radiogroup" aria-label="I am a…">
              <button
                type="button"
                role="radio"
                aria-checked={role === "assistant"}
                className={`role-option ${role === "assistant" ? "is-active" : ""}`}
                onClick={() => setRole("assistant")}
              >
                <Bot size={16} />
                <span>
                  <strong>I'm an assistant</strong>
                  <small>Manage inboxes on behalf of clients</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={role === "client"}
                className={`role-option ${role === "client" ? "is-active" : ""}`}
                onClick={() => setRole("client")}
              >
                <UserRound size={16} />
                <span>
                  <strong>I'm the client</strong>
                  <small>See only what needs my attention</small>
                </span>
              </button>
            </div>

            <Field
              label="Full name"
              type="text"
              autoComplete="name"
              placeholder="Sarah Connor"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              leftIcon={<User size={15} />}
            />
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<Mail size={15} />}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leftIcon={<Lock size={15} />}
              hint="Used to sign in to your workspace."
            />

            <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
              {role === "client" ? "Create client account" : "Create assistant workspace"}
              <ArrowRight size={15} />
            </Button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
