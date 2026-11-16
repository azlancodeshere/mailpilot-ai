import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react"
import { accountsApi } from "../lib/api"
import type { Account } from "../lib/types"
import { useAuth } from "../store/auth"
import { Avatar, Logo } from "./ui"

const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/ask", label: "Ask AI", icon: Sparkles },
  { to: "/app/accounts", label: "Accounts", icon: Settings },
]

function SyncPill({ accounts }: { accounts: Account[] | null }) {
  if (!accounts || accounts.length === 0) {
    return (
      <span className="sync-pill" title="No mailbox connected yet">
        <span className="sync-dot sync-none" />
        No mailbox
      </span>
    )
  }

  const syncing = accounts.some((account) => account.status === "syncing")
  const errored = accounts.some((account) => account.status === "error")
  const latest = accounts
    .map((account) => account.lastSyncedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0]

  const state = syncing ? "syncing" : errored ? "error" : "ok"
  const label = syncing
    ? "Syncing…"
    : errored
      ? "Sync issue"
      : latest
        ? `Synced ${new Date(latest).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : "Connected"

  return (
    <span className={`sync-pill sync-${state}`} title={`${accounts.length} mailbox connected`}>
      <span className={`sync-dot sync-${state}`} />
      {label}
    </span>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="nav-list">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? "is-active" : ""}`}
            onClick={onNavigate}
          >
            <Icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}

      <div className="nav-divider" />

      <NavLink to="/client" className="nav-item nav-item-muted" onClick={onNavigate}>
        <UserRound size={17} />
        <span>Client view</span>
        <span className="nav-tag">Beta</span>
      </NavLink>
    </nav>
  )
}

function UserCard({ onLogout }: { onLogout: () => void }) {
  const user = useAuth((state) => state.user)
  if (!user) return null

  return (
    <div className="user-card">
      <Avatar name={user.username} email={user.email} size={34} />
      <span className="user-meta">
        <span className="user-name">{user.username}</span>
        <span className="user-email">{user.email}</span>
      </span>
      <button type="button" className="icon-btn" aria-label="Log out" onClick={onLogout}>
        <LogOut size={15} />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const logout = useAuth((state) => state.logout)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    accountsApi
      .list()
      .then((result) => {
        if (!cancelled) setAccounts(result.accounts)
      })
      .catch(() => {
        if (!cancelled) setAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    navigate(trimmed ? `/app/inbox?q=${encodeURIComponent(trimmed)}` : "/app/inbox")
    setDrawerOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <NavLink to="/app" className="brand-link">
            <Logo size={30} />
          </NavLink>
        </div>

        <NavList />

        <div className="sidebar-foot">
          <UserCard onLogout={handleLogout} />
        </div>
      </aside>

      {drawerOpen ? (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden />
      ) : null}

      <aside className={`drawer ${drawerOpen ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <Logo size={30} />
          <button
            type="button"
            className="icon-btn"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <NavList onNavigate={() => setDrawerOpen(false)} />
        <div className="sidebar-foot">
          <UserCard onLogout={handleLogout} />
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar-menu"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} />
          </button>

          <form className="topbar-search" onSubmit={submitSearch} role="search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations, senders, topics…"
              aria-label="Search conversations"
            />
            <kbd>/</kbd>
          </form>

          <div className="topbar-actions">
            <SyncPill accounts={accounts} />
            <button
              type="button"
              className="btn btn-primary btn-sm topbar-ask"
              onClick={() => navigate("/app/ask")}
            >
              <Sparkles size={14} />
              Ask AI
            </button>
            <a
              className="icon-btn topbar-mail"
              href="mailto:hello@mailpilot.ai"
              aria-label="Contact support"
            >
              <Mail size={16} />
            </a>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
