import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react"
import { avatarHue, initials } from "../lib/format"

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={16} aria-hidden />
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  loading?: boolean
  size?: "sm" | "md" | "lg"
  fullWidth?: boolean
}

export function Button({
  variant = "secondary",
  loading = false,
  size = "md",
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : ""
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${sizeClass} ${fullWidth ? "btn-block" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
}

export function Field({ label, hint, error, leftIcon, className = "", ...rest }: FieldProps) {
  const input = (
    <input
      className={`input ${leftIcon ? "has-icon" : ""} ${className}`}
      aria-invalid={Boolean(error)}
      {...rest}
    />
  )

  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      {leftIcon ? (
        <span className="input-wrap">
          <span className="input-icon">{leftIcon}</span>
          {input}
        </span>
      ) : (
        input
      )}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function SelectField({ label, className = "", children, ...rest }: SelectFieldProps) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <select className={`input select ${className}`} {...rest}>
        {children}
      </select>
    </label>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function TextArea({ label, className = "", ...rest }: TextAreaProps) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <textarea className={`input textarea ${className}`} {...rest} />
    </label>
  )
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function ConversationSkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="conversation-row skeleton-row">
          <Skeleton className="skeleton-avatar" />
          <div className="skeleton-lines">
            <Skeleton className="skeleton-line w-1/3" />
            <Skeleton className="skeleton-line w-2/3" />
            <Skeleton className="skeleton-line w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="state-block animate-fade-in">
      {icon ? <div className="state-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="state-actions">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="state-block state-error animate-fade-in">
      <div className="state-icon">
        <AlertTriangle size={22} />
      </div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry ? (
        <div className="state-actions">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function Logo({ size = 32, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="brand" style={{ ["--logo-size" as string]: `${size}px` }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        className="brand-mark"
      >
        <rect width="32" height="32" rx="9" fill="url(#mp-grad)" />
        <path
          d="M8.5 11.5h15v9.2a1.3 1.3 0 0 1-1.3 1.3H9.8a1.3 1.3 0 0 1-1.3-1.3v-9.2Z"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m8.5 12 7.5 5.4L23.5 12" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        <path
          d="M20.4 7.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7.7-1.7Z"
          fill="#fff"
        />
        <defs>
          <linearGradient id="mp-grad" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#145c3e" />
            <stop offset="1" stopColor="#1f8a5b" />
          </linearGradient>
        </defs>
      </svg>
      {withWordmark ? (
        <span className="brand-word">
          MailPilot<span className="gradient-text"> AI</span>
        </span>
      ) : null}
    </span>
  )
}

export function Avatar({
  name,
  email,
  size = 36,
  className = "",
}: {
  name?: string
  email?: string
  size?: number
  className?: string
}) {
  const hue = avatarHue(email || name)
  const label = initials(name || email)
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `hsl(${hue} 42% 92%)`,
        color: `hsl(${hue} 38% 28%)`,
        borderColor: `hsl(${hue} 28% 78%)`,
      }}
      aria-hidden
    >
      {label}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm">{message}</p>
    </Modal>
  )
}

export function AiPill({ source, className = "" }: { source?: "ai" | "rules" | "manual"; className?: string }) {
  const label =
    source === "ai" ? "Gemini AI" : source === "manual" ? "Manual" : "Rule-based AI"
  return (
    <span className={`ai-pill ${className}`} title={`Classification source: ${label}`}>
      <Sparkles size={11} />
      {label}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header animate-fade-in">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}
