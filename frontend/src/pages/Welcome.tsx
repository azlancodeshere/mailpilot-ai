import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  Check,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react"
import { Button, Logo } from "../components/ui"
import { ClassificationBadge } from "../components/ClassificationBadge"
import { useAuth } from "../store/auth"

const CURRENT_YEAR = new Date().getFullYear()

const FEATURES = [
  {
    icon: Bot,
    title: "Who replies? Decided by AI",
    body: "Every conversation is classified the moment it arrives — assistant to reply, client to reply, no reply needed, or flagged for review.",
    accent: "var(--color-assistant)",
  },
  {
    icon: Zap,
    title: "An inbox that organises itself",
    body: "Action required, waiting for response, meetings, important — segments are built automatically and stay correct as new mail lands.",
    accent: "var(--primary)",
  },
  {
    icon: UserRound,
    title: "A calm, minimal view for clients",
    body: "Your client sees only what truly needs them: a short summary, why their answer matters, and two buttons — handle it, or hand it back.",
    accent: "var(--color-client)",
  },
  {
    icon: Sparkles,
    title: "AI that drafts, never sends",
    body: "Summaries, key dates, answers to “what am I waiting on?”, and reply drafts you review and approve before anything leaves the outbox.",
    accent: "var(--secondary)",
  },
]

const STEPS = [
  {
    title: "Connect the mailbox",
    body: "Gmail or Outlook — a one-click simulated OAuth flow with live sync status.",
  },
  {
    title: "AI reads and sorts",
    body: "Content + conversation history decide who must respond, and why.",
  },
  {
    title: "You stay in control",
    body: "Correct any classification, approve every draft, and hand work between assistant and client.",
  },
]

const DEMO_ROWS = [
  { sender: "Marcus Feld", subject: "Vendor agreement — approval required", label: "client" as const },
  { sender: "Priya Nair", subject: "Q4 board review — scheduling next week", label: "assistant" as const },
  { sender: "Tech Weekly", subject: "Your Monday briefing: 10 stories", label: "noreply" as const },
]

export default function Welcome() {
  const navigate = useNavigate()
  const user = useAuth((state) => state.user)

  const primaryAction = user ? "/app" : "/signup"
  const primaryLabel = user ? "Open dashboard" : "Get started free"

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo size={30} />
        <nav className="landing-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link to="/login">Sign in</Link>
          <Link to={primaryAction} className="btn btn-primary btn-sm">
            {primaryLabel}
          </Link>
        </nav>
      </header>

      <section className="hero">
        <span className="hero-eyebrow animate-fade-in">
          <Sparkles size={13} />
          AI-powered email management for personal assistants
        </span>

        <h1 className="animate-fade-in">
          Stop reading every email
          <br />
          to know <span className="gradient-text">who should reply</span>.
        </h1>

        <p className="hero-sub animate-fade-in">
          MailPilot AI connects your client's inbox, classifies every conversation by reply
          responsibility, and gives your client one minimal screen for the messages that truly
          need them.
        </p>

        <div className="hero-cta animate-fade-in">
          <Link to={primaryAction} className="btn btn-primary btn-lg">
            {primaryLabel}
            <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Sign in to the demo
          </Link>
        </div>

        <div className="hero-meta animate-fade-in">
          <span>
            <Check size={14} /> Gmail &amp; Outlook connection flow
          </span>
          <span>
            <Check size={14} /> Automatic reply-responsibility AI
          </span>
          <span>
            <Check size={14} /> Client portal included
          </span>
        </div>

        <div className="hero-preview animate-fade-in">
          <div className="preview-chrome">
            <span /> <span /> <span />
            <em>assistant · inbox</em>
          </div>
          <div className="preview-body">
            {DEMO_ROWS.map((row, index) => (
              <div className="preview-row" key={row.subject} style={{ animationDelay: `${index * 90}ms` }}>
                <span className="preview-dot" />
                <span className="preview-text">
                  <strong>{row.sender}</strong>
                  <small>{row.subject}</small>
                </span>
                {row.label === "client" ? (
                  <ClassificationBadge classification="client_reply" size="sm" />
                ) : row.label === "assistant" ? (
                  <ClassificationBadge classification="assistant_reply" size="sm" />
                ) : (
                  <ClassificationBadge classification="no_reply" size="sm" />
                )}
              </div>
            ))}
            <div className="preview-summary">
              <Sparkles size={13} />
              <span>
                <strong>AI summary</strong> — Sign-off needed before Friday; only Daniel can approve
                this agreement.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="section-head">
          <span className="section-kicker">Why MailPilot</span>
          <h2>Built for the assistant ↔ client relationship</h2>
          <p>
            Assistants manage volume. Clients decide what deserves them. MailPilot keeps both
            sides in sync without either drowning in email.
          </p>
        </div>

        <div className="feature-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article className="feature-card card" key={feature.title}>
                <span className="feature-icon" style={{ color: feature.accent }}>
                  <Icon size={18} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="landing-section" id="how">
        <div className="section-head">
          <span className="section-kicker">How it works</span>
          <h2>From crowded inbox to clear ownership in three steps</h2>
        </div>

        <div className="steps">
          {STEPS.map((step, index) => (
            <div className="step" key={step.title}>
              <span className="step-number">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="section-cta">
          <Button variant="primary" size="lg" onClick={() => navigate(primaryAction)}>
            {primaryLabel}
            <ArrowRight size={16} />
          </Button>
          <span className="section-note">
            Try the demo account — everything you see runs on realistic sample data.
          </span>
        </div>
      </section>

      <footer className="landing-foot">
        <Logo size={26} />
        <p>
          Prototype build · Gmail/Outlook connections and incoming mail are simulated · AI
          classification falls back to deterministic rules when the LLM is unavailable.
        </p>
        <span>© {CURRENT_YEAR} MailPilot AI</span>
      </footer>
    </div>
  )
}
