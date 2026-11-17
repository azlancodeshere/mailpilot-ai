import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Archive,
  Inbox as InboxIcon,
  MailPlus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { accountsApi, emailsApi, errorMessage } from "../lib/api"
import type { Account, Conversation, SegmentMeta } from "../lib/types"
import { CLASSIFICATION_META } from "../lib/format"
import {
  Button,
  ConversationSkeletonList,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  TextArea,
} from "../components/ui"
import { useToast } from "../components/useToast"
import { ConversationRow } from "../components/ConversationRow"

const PAGE_SIZE = 20

export default function Inbox() {
  const { push } = useToast()
  const [params, setParams] = useSearchParams()

  const segment = params.get("segment") || "all"
  const query = params.get("q") || ""
  const showArchived = params.get("archived") === "1"

  const [segments, setSegments] = useState<SegmentMeta[]>([])
  const [items, setItems] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchDraft, setSearchDraft] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const debounceRef = useRef<number | undefined>(undefined)

  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setSearchDraft(query)
  }

  const [simulateOpen, setSimulateOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sending, setSending] = useState(false)
  const [simForm, setSimForm] = useState({
    name: "",
    email: "",
    subject: "",
    body: "",
  })

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") next.delete(key)
        else next.set(key, value)
      })
      setParams(next, { replace: false })
    },
    [params, setParams]
  )

  const [refreshKey, setRefreshKey] = useState(0)

  const listParams = useMemo(
    () => ({
      segment,
      q: query || undefined,
      includeArchived: showArchived || undefined,
      limit: PAGE_SIZE,
    }),
    [segment, query, showArchived]
  )

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [list, segmentResult] = await Promise.all([
          emailsApi.list({ ...listParams, page: 1 }),
          emailsApi.segments(),
        ])
        setItems(list.items)
        setTotal(list.total)
        setPage(1)
        setSegments(segmentResult.segments)
        setError(null)
      } catch (caught) {
        setError(errorMessage(caught))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [listParams, refreshKey])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }, [])

  const loadMore = async () => {
    const targetPage = page + 1
    setLoadingMore(true)
    try {
      const list = await emailsApi.list({ ...listParams, page: targetPage })
      setItems((current) => [...current, ...list.items])
      setTotal(list.total)
      setPage(targetPage)
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoadingMore(false)
    }
  }

  const onSearchChange = (value: string) => {
    setSearchDraft(value)
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      patchParams({ q: value.trim() || null })
    }, 350)
  }

  useEffect(() => {
    if (!simulateOpen) return
    const run = async () => {
      try {
        const result = await accountsApi.list()
        setAccounts(result.accounts)
      } catch {
        setAccounts([])
      }
    }
    void run()
  }, [simulateOpen])

  const submitSimulation = async () => {
    const accountId = accounts[0]?._id
    if (!accountId) {
      push("error", "Connect a mailbox first to simulate incoming mail")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(simForm.email.trim())) {
      push("error", "Enter a valid sender email")
      return
    }
    if (!simForm.subject.trim() || !simForm.body.trim()) {
      push("error", "Subject and message body are required")
      return
    }

    setSending(true)
    try {
      const result = await emailsApi.ingest({
        accountId,
        from: { name: simForm.name.trim() || undefined, email: simForm.email.trim() },
        subject: simForm.subject.trim(),
        body: simForm.body.trim(),
      })
      const meta = CLASSIFICATION_META[result.conversation.classification]
      push("success", `New email classified as “${meta.label}”`)
      setSimulateOpen(false)
      setSimForm({ name: "", email: "", subject: "", body: "" })
      refresh()
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  const activeSegment = segments.find((item) => item.key === segment)

  return (
    <div className="page page-inbox">
      <PageHeader
        title="Inbox"
        subtitle={
          activeSegment
            ? `${activeSegment.count} conversation(s) · ${activeSegment.description}`
            : "Every conversation across connected mailboxes"
        }
        actions={
          <>
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setSimulateOpen(true)}>
              <MailPlus size={14} />
              Simulate incoming email
            </Button>
          </>
        }
      />

      <div className="inbox-layout">
        <aside className="segment-rail card" aria-label="Segments">
          <span className="segment-title">Segments</span>
          <nav className="segment-list">
            {segments.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`segment-item ${segment === item.key ? "is-active" : ""}`}
                onClick={() => patchParams({ segment: item.key === "all" ? null : item.key })}
              >
                <span className="segment-label">{item.label}</span>
                <span className="segment-count">{item.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="segment-scroller" aria-label="Segments">
          {segments.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`segment-pill ${segment === item.key ? "is-active" : ""}`}
              onClick={() => patchParams({ segment: item.key === "all" ? null : item.key })}
            >
              {item.label}
              <span className="segment-count">{item.count}</span>
            </button>
          ))}
        </div>

        <section className="inbox-main card">
          <div className="inbox-toolbar">
            <div className="inbox-search">
              <Search size={15} />
              <input
                value={searchDraft}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search within conversations…"
                aria-label="Search conversations"
              />
              {searchDraft ? (
                <button
                  type="button"
                  className="inbox-search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchDraft("")
                    patchParams({ q: null })
                  }}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className={`filter-toggle ${showArchived ? "is-active" : ""}`}
              onClick={() => patchParams({ archived: showArchived ? null : "1" })}
            >
              <Archive size={14} />
              Archived
            </button>
          </div>

          <div className="inbox-list">
            {loading ? (
              <ConversationSkeletonList rows={7} />
            ) : error ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={query ? <Search size={22} /> : <InboxIcon size={22} />}
                title={
                  query
                    ? `No results for “${query}”`
                    : segment === "all"
                      ? "Your inbox is empty"
                      : `Nothing in “${activeSegment?.label || segment}”`
                }
                description={
                  query
                    ? "Try a different keyword, or clear the search to browse everything."
                    : segment === "all"
                      ? "Connect a mailbox or simulate an incoming email to see AI classification in action."
                      : activeSegment?.description
                }
                action={
                  query ? (
                    <Button variant="secondary" onClick={() => patchParams({ q: null })}>
                      Clear search
                    </Button>
                  ) : segment === "all" ? (
                    <Button variant="primary" onClick={() => setSimulateOpen(true)}>
                      <MailPlus size={14} />
                      Simulate incoming email
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => patchParams({ segment: null })}>
                      View all conversations
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="stack">
                  {items.map((conversation) => (
                    <ConversationRow key={conversation._id} conversation={conversation} />
                  ))}
                </div>

                {items.length < total ? (
                  <div className="load-more">
                    <Button
                      variant="secondary"
                      loading={loadingMore}
                      onClick={() => void loadMore()}
                    >
                      Load more ({items.length} of {total})
                    </Button>
                  </div>
                ) : (
                  <p className="list-foot">
                    {total} conversation{total === 1 ? "" : "s"} · end of list
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
        title="Simulate an incoming email"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSimulateOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" loading={sending} onClick={submitSimulation}>
              <Send size={14} />
              Receive &amp; classify
            </Button>
          </>
        }
      >
        <p className="modal-lead">
          Sends a realistic message into the connected mailbox. AI classifies it automatically —
          try wording that asks for an approval, a booking, or plain FYI.
        </p>

        <div className="sim-grid">
          <Field
            label="From name"
            placeholder="Priya Nair"
            value={simForm.name}
            onChange={(event) => setSimForm({ ...simForm, name: event.target.value })}
          />
          <Field
            label="From email"
            type="email"
            placeholder="priya@company.com"
            value={simForm.email}
            onChange={(event) => setSimForm({ ...simForm, email: event.target.value })}
          />
        </div>

        <Field
          label="Subject"
          placeholder="Re: Q4 board review — scheduling"
          value={simForm.subject}
          onChange={(event) => setSimForm({ ...simForm, subject: event.target.value })}
        />
        <TextArea
          label="Message"
          rows={5}
          placeholder="Hi, could we move the meeting to Thursday? Please confirm a time that works…"
          value={simForm.body}
          onChange={(event) => setSimForm({ ...simForm, body: event.target.value })}
        />

        <div className="sim-hint">
          <Sparkles size={13} />
          Existing conversations with the same subject (ignoring “Re:”) are updated and
          re-classified.
        </div>
      </Modal>
    </div>
  )
}
