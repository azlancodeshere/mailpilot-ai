import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  Inbox,
  Mail,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Star,
  UserRound,
  Zap,
} from "lucide-react"
import { dashboardApi, errorMessage } from "../lib/api"
import type { DashboardStats } from "../lib/types"
import { displayName, fullTime, relativeTime } from "../lib/format"
import { Avatar, Button, ErrorState, PageHeader, Skeleton } from "../components/ui"
import { ConversationRow } from "../components/ConversationRow"
import { ClassificationBadge } from "../components/ClassificationBadge"
import { useAuth } from "../store/auth"

const PIE_COLORS: Record<string, string> = {
  assistant_reply: "#0f766e",
  client_reply: "#c2410c",
  no_reply: "#0369a1",
  needs_review: "#be123c",
}

const NOW = new Date()

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  onClick,
}: {
  label: string
  value: number | string
  icon: typeof Mail
  accent: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button type="button" className="stat-card card animate-fade-in" onClick={onClick}>
      <span className="stat-icon" style={{ color: accent, background: `${accent}1f` }}>
        <Icon size={17} />
      </span>
      <span className="stat-body">
        <strong>{value}</strong>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </button>
  )
}

function ListSkeleton() {
  return (
    <div className="stack">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="conversation-row skeleton-row" key={index}>
          <Skeleton className="skeleton-avatar" />
          <div className="skeleton-lines">
            <Skeleton className="skeleton-line w-1/3" />
            <Skeleton className="skeleton-line w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const currentUser = useAuth((state) => state.user)
  const displayNameUser = currentUser?.username || currentUser?.email || "there"

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const run = async () => {
      try {
        const result = await dashboardApi.stats()
        setStats(result)
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

  const hour = NOW.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  const openSegment = (segment: string) => navigate(`/app/inbox?segment=${segment}`)

  if (loading && !stats) {
    return (
      <div className="page">
        <PageHeader title="Loading dashboard…" />
        <div className="stat-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="stat-skeleton" />
          ))}
        </div>
        <div className="dash-grid">
          <Skeleton className="panel-skeleton" />
          <Skeleton className="panel-skeleton" />
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

  if (stats && stats.accounts.length === 0) {
    return (
      <div className="page">
        <PageHeader
          title={`${greeting}, ${displayNameUser}`}
          subtitle="Let's connect your first mailbox."
        />
        <div className="empty-connection card animate-fade-in">
          <span className="state-icon">
            <Mail size={22} />
          </span>
          <h2>No mailbox connected yet</h2>
          <p>
            Connect a Gmail or Outlook inbox to see classified conversations, action items and
            AI summaries here.
          </p>
          <div className="state-actions">
            <Button variant="primary" size="lg" onClick={() => navigate("/onboarding")}>
              Connect a mailbox
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const totals = stats?.totals
  const donutData = (stats?.byClassification || []).filter((item) => item.count > 0)
  const donutTotal = donutData.reduce((sum, item) => sum + item.count, 0)
  const attention = (stats?.recentConversations || []).filter(
    (conversation) =>
      conversation.status === "open" &&
      (conversation.classification === "assistant_reply" ||
        conversation.classification === "needs_review")
  )

  return (
    <div className="page">
      <PageHeader
        title={`${greeting}, ${displayNameUser}`}
        subtitle={NOW.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <>
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => navigate("/app/inbox")}>
              <Inbox size={14} />
              Open inbox
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Total emails"
          value={totals?.emails ?? 0}
          icon={Mail}
          accent="#1a6b48"
          onClick={() => openSegment("all")}
        />
        <StatCard
          label="Unread"
          value={totals?.unreadEmails ?? 0}
          icon={Inbox}
          accent="#0369a1"
          onClick={() => openSegment("unread")}
        />
        <StatCard
          label="Important"
          value={totals?.important ?? 0}
          icon={Star}
          accent="#b45309"
          onClick={() => openSegment("important")}
        />
        <StatCard
          label="Action required"
          value={totals?.actionRequired ?? 0}
          icon={Zap}
          accent="#be123c"
          hint="Needs your push"
          onClick={() => openSegment("action_required")}
        />
        <StatCard
          label="Waiting for response"
          value={totals?.waitingResponse ?? 0}
          icon={RefreshCw}
          accent="#8a5a2a"
          onClick={() => openSegment("waiting")}
        />
        <StatCard
          label="Client to reply"
          value={totals?.clientToReply ?? 0}
          icon={UserRound}
          accent="#0f766e"
          hint="Needs Daniel personally"
          onClick={() => openSegment("client")}
        />
      </div>

      <div className="dash-grid">
        <section className="panel card">
          <div className="panel-head">
            <h2>
              <Zap size={15} className="panel-title-icon" />
              Needs your attention
            </h2>
            <Link to="/app/inbox?segment=action_required" className="link-btn">
              View all
              <ArrowUpRight size={13} />
            </Link>
          </div>
          {loading ? (
            <ListSkeleton />
          ) : (
            <div className="stack">
              {attention.length > 0 ? (
                attention
                  .slice(0, 4)
                  .map((conversation) => (
                    <ConversationRow key={conversation._id} conversation={conversation} />
                  ))
              ) : (
                <p className="panel-empty">Nothing needs action right now — the inbox is clear.</p>
              )}
            </div>
          )}
        </section>

        <section className="panel card">
          <div className="panel-head">
            <h2>
              <Sparkles size={15} className="panel-title-icon" />
              AI classification
            </h2>
          </div>

          <div className="donut-wrap">
            {donutTotal > 0 ? (
              <ResponsiveContainer width="100%" height={168}>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={46}
                    outerRadius={70}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.key} fill={PIE_COLORS[entry.key] || "#1a6b48"} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#fffcf7",
                      border: "1px solid #e4ddd0",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#1c1915",
                      boxShadow: "0 8px 24px rgba(48, 36, 18, 0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="donut-empty">No conversations yet</div>
            )}

            <div className="donut-center">
              <strong>{donutTotal}</strong>
              <span>analysed</span>
            </div>
          </div>

          <ul className="legend">
            {donutData.map((entry) => (
              <li key={entry.key}>
                <span className="legend-dot" style={{ background: PIE_COLORS[entry.key] }} />
                <span className="legend-label">{entry.label}</span>
                <strong>{entry.count}</strong>
              </li>
            ))}
          </ul>

          {(stats?.totals.needsReview ?? 0) > 0 ? (
            <button
              type="button"
              className="review-callout"
              onClick={() => openSegment("review")}
            >
              <MessageSquareText size={14} />
              <span>
                <strong>{stats?.totals.needsReview} conversation(s)</strong> need a human decision
              </span>
              <ArrowUpRight size={14} />
            </button>
          ) : null}
        </section>
      </div>

      <div className="dash-grid dash-grid-bottom">
        <section className="panel card">
          <div className="panel-head">
            <h2>
              <Mail size={15} className="panel-title-icon" />
              Recent conversations
            </h2>
            <Link to="/app/inbox" className="link-btn">
              Open inbox
              <ArrowUpRight size={13} />
            </Link>
          </div>
          {loading ? (
            <ListSkeleton />
          ) : (stats?.recentConversations?.length ?? 0) > 0 ? (
            <div className="stack">
              {stats?.recentConversations.slice(0, 6).map((conversation) => (
                <ConversationRow key={conversation._id} conversation={conversation} />
              ))}
            </div>
          ) : (
            <p className="panel-empty">No conversations yet — connect a mailbox to begin.</p>
          )}
        </section>

        <section className="panel card">
          <div className="panel-head">
            <h2>
              <CalendarClock size={15} className="panel-title-icon" />
              Meetings &amp; appointments
            </h2>
          </div>

          {loading ? (
            <ListSkeleton />
          ) : (stats?.upcomingMeetings?.length ?? 0) > 0 ? (
            <ul className="meeting-list">
              {stats?.upcomingMeetings.map((conversation) => {
                const date = conversation.importantDates.find((item) => item.date)?.date
                const sender = conversation.participants[0]
                return (
                  <li key={conversation._id}>
                    <button
                      type="button"
                      className="meeting-item"
                      onClick={() => navigate(`/app/conversations/${conversation._id}`)}
                    >
                      <span className="meeting-date">
                        {date ? (
                          <>
                            <strong>{new Date(date).getDate()}</strong>
                            <small>
                              {new Date(date).toLocaleDateString("en-GB", { month: "short" })}
                            </small>
                          </>
                        ) : (
                          <>
                            <Bot size={16} />
                          </>
                        )}
                      </span>
                      <span className="meeting-body">
                        <strong>{conversation.subject}</strong>
                        <small>
                          {displayName(sender?.name, sender?.email)} ·{" "}
                          {date ? fullTime(date) : `updated ${relativeTime(conversation.lastMessageAt)}`}
                        </small>
                      </span>
                      <ClassificationBadge classification={conversation.classification} size="sm" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="panel-empty">No meetings detected in the inbox yet.</p>
          )}

          <div className="ask-cta">
            <Avatar name="AI" email="ai@mailpilot.ai" size={30} />
            <div>
              <strong>Ask anything about the inbox</strong>
              <span>“What am I waiting for a response on?”</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate("/app/ask")}>
              Ask AI
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
