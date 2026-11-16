import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, KeyRound, Lock, Mail, Sparkles } from "lucide-react"
import { Button, Field, Logo } from "../components/ui"
import { useToast } from "../components/useToast"
import { errorMessage } from "../lib/api"
import { useAuth } from "../store/auth"

export default function Login() {
  const navigate = useNavigate()
  const login = useAuth((state) => state.login)
  const { push } = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.")
      return
    }

    setLoading(true)
    try {
      const user = await login(email.trim(), password)
      push("success", `Welcome back, ${user.username}`)
      navigate(user.role === "client" ? "/client" : "/app")
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  const useDemo = () => {
    setEmail("sarah@example.com")
    setPassword("password123")
    setError(null)
  }

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Link to="/">
          <Logo size={32} />
        </Link>
        <div className="auth-aside-body">
          <h2>
            Know who replies <span className="gradient-text">before you open the email.</span>
          </h2>
          <p>
            AI classifies every conversation — assistant, client, or no reply needed — so your
            day starts with decisions, not triage.
          </p>
          <ul className="auth-points">
            <li>
              <Sparkles size={15} /> Automatic reply-responsibility classification
            </li>
            <li>
              <Sparkles size={15} /> Segments, summaries and drafted replies
            </li>
            <li>
              <Sparkles size={15} /> A minimal client portal that stays in sync
            </li>
          </ul>
        </div>
        <span className="auth-aside-foot">Prototype · simulated Gmail &amp; Outlook connections</span>
      </aside>

      <main className="auth-panel">
        <div className="auth-card animate-fade-in">
          <div className="auth-head">
            <h1>Welcome back</h1>
            <p>Sign in to your assistant workspace.</p>
          </div>

          {error ? (
            <div className="alert alert-error animate-fade-in" role="alert">
              {error}
            </div>
          ) : null}

          <form className="auth-form" onSubmit={submit} noValidate>
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
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              leftIcon={<Lock size={15} />}
            />

            <div className="auth-row">
              <button type="button" className="link-btn" onClick={useDemo}>
                <KeyRound size={13} />
                Fill demo credentials
              </button>
              <span className="auth-hint">sarah@example.com · password123</span>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
              Sign in
              <ArrowRight size={15} />
            </Button>
          </form>

          <p className="auth-switch">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
