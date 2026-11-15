import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Inbox, Sparkles, Settings2, Menu, X, Search, Send,
  ChevronRight, RefreshCw, ArrowLeftRight,
  CheckCircle2, UserRound,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { Avatar, Menu as Dropdown, MenuItem, SEGMENT_ICONS, SEGMENT_LABELS, Spinner, RespBadge, Caret } from './common.jsx';
import { greeting, relativeTime } from '../lib/format.js';

export function bump() {
  window.dispatchEvent(new Event('mailpilot:refresh'));
}

export function useCounts() {
  const { clientId, isAssistant } = useAuth();
  const [counts, setCounts] = useState({});
  const location = useLocation();

  const load = () => {
    if (!isAssistant) return;
    api
      .get(`/conversations?segment=inbox${clientId ? `&clientId=${clientId}` : ''}`)
      .then((d) => setCounts(d.counts || {}))
      .catch(() => {});
  };

  useEffect(load, [location.pathname, clientId, isAssistant]);
  useEffect(() => {
    window.addEventListener('mailpilot:refresh', load);
    return () => window.removeEventListener('mailpilot:refresh', load);
  }, [clientId, isAssistant]);

  return counts;
}

function Sidebar({ open, onClose, counts, clients, activeClient, onSelectClient, onSimulate, simulating }) {
  const { user, logout, isAssistant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const workspace = [
    { to: '/app', end: true, icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/app/inbox', icon: Inbox, label: 'Inbox', count: counts.inbox },
    { to: '/app/ask', icon: Sparkles, label: 'Ask MailPilot' },
    { to: '/app/accounts', icon: Settings2, label: 'Accounts' },
  ];

  const segGroups = [
    {
      label: 'Reply responsibility',
      items: [
        { id: 'client', icon: UserRound, alert: true },
        { id: 'assistant' },
        { id: 'review', alert: true },
        { id: 'none' },
      ],
    },
    {
      label: 'Workflow',
      items: [
        { id: 'action', hot: true },
        { id: 'waiting' },
        { id: 'meetings' },
        { id: 'important' },
      ],
    },
    {
      label: 'Mailbox',
      items: [{ id: 'unread' }, { id: 'completed' }, { id: 'archived' }],
    },
  ];

  const segPath = (id) => `/app/inbox/${id}`;

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <span className="brand__mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </span>
          <div>
            <div className="brand__name">
              MailPilot <span>AI</span>
            </div>
            <div className="brand__tag">Assistant workspace</div>
          </div>
          <button className="btn btn--ghost btn--icon hidden-desktop" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close menu">
            <X size={17} />
          </button>
        </div>

        {isAssistant && clients.length > 1 && (
          <Dropdown
            align="left"
            label="Switch client"
            trigger={
              <button className="client-switch">
                <Avatar name={activeClient?.name || 'Client'} size="sm" color={activeClient?.color} />
                <span className="client-switch__meta">
                  <span className="client-switch__label">Managing</span>
                  <span className="client-switch__name truncate">{activeClient?.name || 'Select client'}</span>
                </span>
                <Caret />
              </button>
            }
          >
            {clients.map((c) => (
              <MenuItem
                key={c.id}
                icon={c.id === activeClient?.id ? CheckCircle2 : UserRound}
                active={c.id === activeClient?.id}
                onClick={() => {
                  onSelectClient(c.id);
                  navigate('/app');
                }}
              >
                <span style={{ flex: 1 }}>
                  {c.name}
                  {c.needsYou > 0 && (
                    <span className="nav__count nav__count--alert" style={{ marginLeft: 7 }}>
                      {c.needsYou} for client
                    </span>
                  )}
                </span>
              </MenuItem>
            ))}
          </Dropdown>
        )}

        <nav className="nav">
          <div className="nav__group" style={{ marginTop: 4 }}>
            {workspace.map((w) => (
              <NavLink
                key={w.to}
                to={w.to}
                end={w.end}
                onClick={onClose}
                className={({ isActive }) => `nav__item ${isActive || (w.to === '/app/inbox' && location.pathname.startsWith('/app/inbox')) ? 'nav__item--active' : ''}`}
              >
                <w.icon size={16} strokeWidth={2.1} />
                <span className="nav__text">{w.label}</span>
                {w.count != null && <span className="nav__count tnum">{w.count}</span>}
              </NavLink>
            ))}
          </div>

          {isAssistant && segGroups.map((g) => (
            <div className="nav__group" key={g.label}>
              <div className="nav__label">{g.label}</div>
              {g.items.map((item) => {
                const Icon = SEGMENT_ICONS[item.id];
                const n = counts[item.id] || 0;
                return (
                  <NavLink
                    key={item.id}
                    to={segPath(item.id)}
                    onClick={onClose}
                    className={({ isActive }) => `nav__item ${isActive ? 'nav__item--active' : ''}`}
                  >
                    <Icon size={15.5} strokeWidth={2.1} />
                    <span className="nav__text">{SEGMENT_LABELS[item.id]}</span>
                    {n > 0 && (
                      <span className={`nav__count tnum ${item.alert && n > 0 ? 'nav__count--alert' : item.hot && n > 0 ? 'nav__count--hot' : ''}`}>{n}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {isAssistant && (
            <div className="nav__group">
              <button className="nav__item" onClick={() => { onSimulate(); onClose(); }} disabled={simulating}>
                {simulating ? <Spinner /> : <Send size={15.5} strokeWidth={2.1} />}
                <span className="nav__text">{simulating ? 'Receiving email…' : 'Simulate incoming email'}</span>
              </button>
            </div>
          )}
        </nav>

        <div className="sidebar__foot">
          <div className="sync-pill">
            <span className={`dot ${counts.review > 0 ? 'dot--warn' : ''}`} />
            {counts.review > 0 ? `${counts.review} conversation${counts.review > 1 ? 's' : ''} need review` : 'All accounts synced'}
          </div>
          <Dropdown
            align="left"
            trigger={
              <button className="user-chip">
                <Avatar name={user?.name} size="sm" />
                <span className="user-chip__meta">
                  <span className="user-chip__name truncate">{user?.name}</span>
                  <span className="user-chip__role">{isAssistant ? 'Personal assistant' : 'Client view'}</span>
                </span>
                <Caret />
              </button>
            }
          >
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', marginBottom: 5 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650 }}>{user?.email}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{isAssistant ? 'Assistant workspace' : 'Client workspace'}</div>
            </div>
            {isAssistant ? (
              <MenuItem icon={ArrowLeftRight} onClick={() => { logout(); window.location.href = '/'; }}>
                Sign out
              </MenuItem>
            ) : (
              <MenuItem icon={ArrowLeftRight} onClick={() => { logout(); window.location.href = '/'; }}>
                Sign out
              </MenuItem>
            )}
            <MenuItem
              icon={RefreshCw}
              onClick={async () => {
                try {
                  await api.post('/dev/reset');
                  window.location.href = '/app';
                } catch {
                  window.location.href = '/app';
                }
              }}
            >
              Reset demo data
            </MenuItem>
          </Dropdown>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu, onSearch, onSimulate, simulating }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAssistant } = useAuth();

  const titles = [
    { match: '/app/inbox', title: 'Inbox', sub: 'Segmented by AI reply responsibility' },
    { match: '/app/ask', title: 'Ask MailPilot', sub: 'Natural-language questions over the inbox' },
    { match: '/app/accounts', title: 'Connected accounts', sub: 'Gmail & Microsoft 365 sync status' },
    { match: '/app', title: `${greeting()}`, sub: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) },
  ];
  const current = titles.find((t) => (t.match === '/app' ? location.pathname === '/app' : location.pathname.startsWith(t.match))) || titles[3];

  return (
    <header className="topbar">
      <button className="btn btn--ghost btn--icon menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <div style={{ minWidth: 0 }}>
        <div className="topbar__title truncate">{current.title}</div>
      </div>
      <div className="topbar__spacer" />
      <button className="search-trigger" onClick={onSearch}>
        <Search size={15} />
        <span>Search conversations…</span>
        <kbd>⌘K</kbd>
      </button>
      {isAssistant && (
        <button className="btn btn--secondary btn--sm" onClick={onSimulate} disabled={simulating} title="Inject a sample inbound email to watch AI classification live">
          {simulating ? <Spinner /> : <Send size={14} />}
          <span className="hide-mobile">Simulate email</span>
        </button>
      )}
      {!isAssistant && (
        <button className="btn btn--secondary btn--sm" onClick={() => navigate('/')}>
          <ArrowLeftRight size={14} /> Assistant view
        </button>
      )}
    </header>
  );
}

function SearchModal({ open, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { clientId } = useAuth();

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      if (!q.trim()) return setResults([]);
      setLoading(true);
      try {
        const d = await api.get(`/conversations?segment=inbox&q=${encodeURIComponent(q)}${clientId ? `&clientId=${clientId}` : ''}`);
        setResults(d.items.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, clientId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, alignSelf: 'flex-start', marginTop: '10vh' }}>
        <div className="modal__body" style={{ paddingBottom: 8 }}>
          <div className="input-wrap">
            <Search size={16} />
            <input
              autoFocus
              className="input"
              placeholder="Search subjects, senders, message text…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ height: 44, borderRadius: 12, fontSize: 15 }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            {loading && (
              <div className="row gap-8 muted" style={{ padding: '10px 4px', fontSize: 13 }}>
                <Spinner /> Searching…
              </div>
            )}
            {!loading && q && results.length === 0 && (
              <div className="muted" style={{ padding: '14px 4px', fontSize: 13 }}>
                No conversations match “{q}”.
              </div>
            )}
            {!q && (
              <div style={{ padding: '6px 4px 10px' }}>
                <div className="menu__label" style={{ padding: '4px 0' }}>Quick filters</div>
                <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                  {['client', 'action', 'waiting', 'review'].map((s) => (
                    <button key={s} className="chip" onClick={() => { onClose(); navigate(`/app/inbox/${s}`); }}>
                      {SEGMENT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!loading &&
              results.map((c) => (
                <button
                  key={c.id}
                  className="ask__result"
                  onClick={() => {
                    onClose();
                    navigate(`/app/inbox/${c.segments[1] || 'inbox'}/${c.id}`);
                  }}
                >
                  <RespBadge value={c.classification.responsibility} size="sm" showLabel={false} />
                  <span className="ask__result-main">
                    <span className="ask__result-subject truncate" style={{ display: 'block' }}>{c.subject}</span>
                    <span className="ask__result-reason" style={{ display: 'block' }}>{c.sender?.name} · {relativeTime(c.lastActivityAt)}</span>
                  </span>
                  <ChevronRight size={15} className="muted" />
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [clients, setClients] = useState([]);
  const { clientId, switchClient, isAssistant } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const counts = useCounts();

  useEffect(() => {
    if (!isAssistant) return;
    api.get('/clients').then((d) => setClients(d.items || [])).catch(() => {});
  }, [isAssistant, clientId]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const activeClient = useMemo(() => clients.find((c) => c.id === clientId) || clients[0], [clients, clientId]);

  const simulate = async () => {
    setSimulating(true);
    try {
      const d = await api.post('/simulate/incoming', { clientId }, 400);
      if (d.reclassified) {
        toast.success(`AI re-classified “${d.conversation.subject}” → ${labelOf(d.conversation.classification.responsibility)}`);
      } else {
        toast.success(`New email classified as ${labelOf(d.conversation.classification.responsibility)}: “${d.conversation.subject}”`);
      }
      bump();
      navigate(`/app/inbox/inbox/${d.conversation.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        counts={counts}
        clients={clients}
        activeClient={activeClient}
        onSelectClient={switchClient}
        onSimulate={simulate}
        simulating={simulating}
      />
      <div className="main">
        <Topbar onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} onSimulate={simulate} simulating={simulating} />
        <Outlet />
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function labelOf(r) {
  return { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed', review: 'Needs review' }[r] || r;
}

export { Sidebar, Topbar };
