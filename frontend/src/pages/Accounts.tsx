import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Unplug,
} from "lucide-react"
import { accountsApi, errorMessage } from "../lib/api"
import type { Account } from "../lib/types"
import { relativeTime } from "../lib/format"
import { Button, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui"
import { useToast } from "../components/useToast"

function ProviderMark({ provider, size = 40 }: { provider: "gmail" | "outlook"; size?: number }) {
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

function StatusChip({ account }: { account: Account }) {
  if (account.status === "syncing") {
    return (
      <span className="status-pill status-waiting">
        <RefreshCw size={11} className="animate-spin" />
        Syncing
      </span>
    )
  }
  if (account.status === "error") {
    return (
      <span className="status-pill status-review">
        <AlertTriangle size={11} />
        Sync error
      </span>
    )
  }
  return (
    <span className="status-pill status-open">
      <CheckCircle2 size={11} />
      Connected
    </span>
  )
}

export default function Accounts() {
  const { push } = useToast()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [pendingDisconnect, setPendingDisconnect] = useState<Account | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const run = async () => {
      try {
        const result = await accountsApi.list()
        setAccounts(result.accounts)
        setError(null)
      } catch (caught) {
        setError(errorMessage(caught))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [refreshKey])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }, [])

  const sync = async (account: Account) => {
    setSyncingId(account._id)
    try {
      await accountsApi.sync(account._id)
      push("success", `${account.email} synced — classifications refreshed`)
      load()
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setSyncingId(null)
    }
  }

  const disconnect = async () => {
    if (!pendingDisconnect) return
    setDisconnecting(true)
    try {
      const result = await accountsApi.disconnect(pendingDisconnect._id)
      push("success", `Disconnected · ${result.removedConversations} conversation(s) removed`)
      setPendingDisconnect(null)
      load()
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading && accounts.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Accounts" subtitle="Connected mailboxes and sync status" />
        <div className="account-grid">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="account-skeleton" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Accounts"
        subtitle="Connected mailboxes, sync health and authorizations"
        actions={
          <Link to="/onboarding" className="btn btn-primary">
            <Plus size={14} />
            Connect mailbox
          </Link>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Mail size={22} />}
          title="No mailboxes connected"
          description="Connect a Gmail or Outlook account to start receiving classified conversations."
          action={
            <Link to="/onboarding" className="btn btn-primary">
              <Plus size={14} />
              Connect your first mailbox
            </Link>
          }
        />
      ) : (
        <div className="account-grid">
          {accounts.map((account) => (
            <article key={account._id} className="account-card card animate-fade-in">
              <div className="account-top">
                <ProviderMark provider={account.provider} />
                <div className="account-identity">
                  <strong>{account.displayName || account.email}</strong>
                  <span>{account.email}</span>
                </div>
                <StatusChip account={account} />
              </div>

              <dl className="account-facts">
                <div>
                  <dt>Provider</dt>
                  <dd>{account.provider === "gmail" ? "Google Gmail" : "Outlook / Microsoft"}</dd>
                </div>
                <div>
                  <dt>Authorization</dt>
                  <dd>
                    {account.connectionMode === "simulated" ? "Simulated OAuth" : "Live OAuth"}
                  </dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>
                    {account.lastSyncedAt ? relativeTime(account.lastSyncedAt) : "never"}
                    {account.lastSyncMessage ? ` · ${account.lastSyncMessage}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Connected</dt>
                  <dd>{account.connectedAt ? relativeTime(account.connectedAt) : "—"}</dd>
                </div>
              </dl>

              <div className="account-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={syncingId === account._id}
                  onClick={() => void sync(account)}
                >
                  <RefreshCw size={13} />
                  Sync now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDisconnect(account)}
                >
                  <Trash2 size={13} />
                  Disconnect
                </Button>
              </div>
            </article>
          ))}

          <button
            type="button"
            className="account-card account-add card animate-fade-in"
            onClick={() => navigate("/onboarding")}
          >
            <span className="account-add-icon">
              <Plus size={20} />
            </span>
            <strong>Connect another mailbox</strong>
            <span>Gmail or Outlook</span>
          </button>
        </div>
      )}

      <section className="panel card sync-panel">
        <div className="panel-head">
          <h2>
            <Activity size={15} className="panel-title-icon" />
            Synchronization
          </h2>
          <Link to="/app" className="link-btn">
            Back to dashboard
          </Link>
        </div>
        <ul className="sync-facts">
          <li>
            <Settings size={14} />
            <span>
              New incoming mail is classified automatically on arrival and re-classified when a
              conversation continues.
            </span>
          </li>
          <li>
            <Unplug size={14} />
            <span>
              Connections are simulated for this prototype — the full OAuth scope list is shown
              during onboarding so the flow reads like production.
            </span>
          </li>
        </ul>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDisconnect)}
        title="Disconnect mailbox?"
        message={
          pendingDisconnect
            ? `${pendingDisconnect.email} and all of its conversations will be removed from this workspace. This cannot be undone.`
            : ""
        }
        confirmLabel="Disconnect"
        danger
        loading={disconnecting}
        onConfirm={() => void disconnect()}
        onCancel={() => setPendingDisconnect(null)}
      />
    </div>
  )
}
