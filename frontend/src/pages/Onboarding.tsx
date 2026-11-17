import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react"
import { accountsApi, errorMessage } from "../lib/api"
import type { Account, Provider } from "../lib/types"
import { Button, Field, Logo } from "../components/ui"
import { useToast } from "../components/useToast"
import { useAuth } from "../store/auth"

type Step = "form" | "consent" | "progress" | "success"

function ProviderMark({ provider, size = 40 }: { provider: Provider; size?: number }) {
  const isGmail = provider === "gmail"
  return (
    <span
      className="provider-mark"
      style={{
        background: isGmail ? "#ffffff" : "#0f6cbd",
        color: isGmail ? "#ea4335" : "#ffffff",
        width: size,
        height: size,
        fontSize: size * 0.46,
      }}
      aria-hidden
    >
      {isGmail ? "M" : "O"}
    </span>
  )
}

const CONSENT_SCOPES = [
  { icon: Eye, label: "Read emails and conversation history" },
  { icon: Tags, label: "Organise conversations with labels and flags" },
  { icon: Sparkles, label: "Run AI classification, summaries and drafts" },
  { icon: ShieldCheck, label: "Revoke access at any time from Accounts" },
]

const PROGRESS_STEPS = [
  "Authorizing with the provider…",
  "Fetching messages and building conversations…",
  "Running AI reply-responsibility classification…",
]

export default function Onboarding() {
  const navigate = useNavigate()
  const user = useAuth((state) => state.user)
  const { push } = useToast()

  const [step, setStep] = useState<Step>("form")
  const [provider, setProvider] = useState<Provider>("gmail")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [progressIndex, setProgressIndex] = useState(0)
  const [result, setResult] = useState<{ account: Account; seeded: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startConsent = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the mailbox address you want to connect.")
      return
    }
    setStep("consent")
  }

  const allow = async () => {
    setStep("progress")
    setProgressIndex(0)
    setError(null)

    const advance = window.setTimeout(() => setProgressIndex(1), 800)

    try {
      const connected = await accountsApi.connect({
        provider,
        email: email.trim(),
        displayName: displayName.trim() || undefined,
      })
      window.clearTimeout(advance)
      setProgressIndex(2)
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      setResult(connected)
      setStep("success")
      push("success", `Mailbox connected — ${connected.seeded} conversations analysed`)
    } catch (caught) {
      window.clearTimeout(advance)
      setError(errorMessage(caught))
      setStep("form")
    }
  }

  return (
    <div className="onboarding">
      <header className="onboarding-nav">
        <Link to="/app">
          <Logo size={30} />
        </Link>
        <div className="onboarding-nav-actions">
          <span className="step-label">
            {step === "form" && "Step 1 of 3 · Choose mailbox"}
            {step === "consent" && "Step 2 of 3 · Authorize"}
            {step === "progress" && "Step 3 of 3 · Sync & classify"}
            {step === "success" && "All set"}
          </span>
          <Link to="/app" className="btn btn-ghost btn-sm">
            Skip for now
          </Link>
        </div>
      </header>

      <div className="onboarding-body">
        <div className="onboarding-intro animate-fade-in">
          <span className="section-kicker">Connect an inbox</span>
          <h1>Bring your client's email into one place</h1>
          <p>
            MailPilot reads the mailbox, groups messages into conversations, and lets AI decide
            who needs to respond — so nothing important is buried.
          </p>
          <div className="onboarding-note">
            <ShieldCheck size={15} />
            <span>
              <strong>Simulated connection for this prototype.</strong> No real OAuth is performed
              — a realistic sample inbox is seeded so you can explore every flow immediately.
            </span>
          </div>
        </div>

        <div className="onboarding-card card animate-fade-in">
          {step === "form" ? (
            <form onSubmit={startConsent} className="onboarding-form">
              <h2>Which mailbox do you want to manage?</h2>

              <div className="provider-grid" role="radiogroup" aria-label="Email provider">
                {(["gmail", "outlook"] as Provider[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={provider === option}
                    className={`provider-card ${provider === option ? "is-active" : ""}`}
                    onClick={() => setProvider(option)}
                  >
                    <ProviderMark provider={option} />
                    <span>
                      <strong>{option === "gmail" ? "Google Gmail" : "Outlook / Microsoft"}</strong>
                      <small>{option === "gmail" ? "you@gmail.com" : "you@outlook.com"}</small>
                    </span>
                    {provider === option ? <CheckCircle2 size={17} className="provider-check" /> : null}
                  </button>
                ))}
              </div>

              <Field
                label="Mailbox address"
                type="email"
                placeholder={provider === "gmail" ? "client@gmail.com" : "client@outlook.com"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                leftIcon={<Mail size={15} />}
                hint="The client mailbox this workspace will manage."
              />
              <Field
                label="Client name (optional)"
                type="text"
                placeholder="Daniel Whitmore"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                leftIcon={<UserRound size={15} />}
                hint="Shown in the client portal and AI prompts."
              />

              {error ? (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              ) : null}

              <Button type="submit" variant="primary" size="lg" fullWidth>
                Continue
                <ArrowRight size={15} />
              </Button>
            </form>
          ) : null}

          {step === "consent" ? (
            <div className="consent animate-fade-in">
              <div className="consent-head">
                <ProviderMark provider={provider} size={44} />
                <div>
                  <h2>Sign in with {provider === "gmail" ? "Google" : "Microsoft"}</h2>
                  <p>{email}</p>
                </div>
              </div>

              <div className="consent-app">
                <Logo size={26} />
                <span>
                  <strong>MailPilot AI</strong> wants to access your mailbox
                </span>
              </div>

              <ul className="consent-scopes">
                {CONSENT_SCOPES.map((scope) => {
                  const Icon = scope.icon
                  return (
                    <li key={scope.label}>
                      <Icon size={15} />
                      {scope.label}
                    </li>
                  )
                })}
              </ul>

              <div className="consent-actions">
                <Button variant="ghost" onClick={() => setStep("form")} size="lg">
                  Cancel
                </Button>
                <Button variant="primary" size="lg" onClick={allow}>
                  Allow access
                  <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          ) : null}

          {step === "progress" ? (
            <div className="progress animate-fade-in">
              <div className="progress-mark">
                <Loader2 size={26} className="animate-spin" />
              </div>
              <h2>Connecting your mailbox</h2>
              <ol className="progress-steps">
                {PROGRESS_STEPS.map((label, index) => (
                  <li
                    key={label}
                    className={
                      index < progressIndex ? "is-done" : index === progressIndex ? "is-active" : ""
                    }
                  >
                    <span className="progress-icon">
                      {index < progressIndex ? (
                        <Check size={13} />
                      ) : index === progressIndex ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <span className="progress-tick" />
                      )}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              <p className="progress-note">
                Classifying conversations can take a few seconds on first connect.
              </p>
            </div>
          ) : null}

          {step === "success" && result ? (
            <div className="success animate-fade-in">
              <span className="success-mark">
                <Check size={26} />
              </span>
              <h2>Mailbox connected</h2>
              <p className="success-sub">
                {result.account.email} is synced and ready.
              </p>

              <div className="success-stats">
                <div>
                  <strong>{result.seeded}</strong>
                  <span>conversations analysed</span>
                </div>
                <div>
                  <strong>AI</strong>
                  <span>classification complete</span>
                </div>
                <div>
                  <strong>Simulated</strong>
                  <span>sync status enabled</span>
                </div>
              </div>

              <div className="success-actions">
                <Button variant="primary" size="lg" onClick={() => navigate("/app")}>
                  Open dashboard
                  <ArrowRight size={15} />
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setStep("form")
                    setEmail("")
                    setDisplayName("")
                    setResult(null)
                  }}
                >
                  Connect another mailbox
                </Button>
              </div>

              <p className="success-foot">
                Signed in as {user?.email} · connection mode: simulated
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
