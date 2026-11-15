import { useEffect, useRef, useState } from 'react';
import {
  Bot, UserRound, CheckCircle2, AlertTriangle, Inbox, Mail, Zap, Clock,
  Calendar, Star, Layers, Archive, X, Sparkles, ChevronDown,
} from 'lucide-react';
import { initials, avatarColor } from '../lib/format.js';

export const RESP = {
  assistant: { label: 'Assistant to reply', short: 'Assistant', icon: Bot, cls: 'assistant' },
  client: { label: 'Client to reply', short: 'Client', icon: UserRound, cls: 'client' },
  none: { label: 'No reply needed', short: 'No reply', icon: CheckCircle2, cls: 'none' },
  review: { label: 'Needs review', short: 'Review', icon: AlertTriangle, cls: 'review' },
};

export const SEGMENT_ICONS = {
  inbox: Inbox, unread: Mail, assistant: Bot, client: UserRound, none: CheckCircle2,
  review: AlertTriangle, action: Zap, waiting: Clock, meetings: Calendar,
  important: Star, general: Layers, completed: CheckCircle2, archived: Archive,
};

export const SEGMENT_LABELS = {
  inbox: 'All conversations', unread: 'Unread', assistant: 'Assistant to reply',
  client: 'Client to reply', none: 'No reply needed', review: 'Needs review',
  action: 'Action required', waiting: 'Waiting for response',
  meetings: 'Meetings & appointments', important: 'Important', general: 'General',
  completed: 'Completed', archived: 'Archived',
};

export function Avatar({ name = '', size = 'md', color, ring = false }) {
  const cls = `avatar avatar--${size}${ring ? ' avatar--ring' : ''}`;
  return (
    <span className={cls} style={{ background: color || avatarColor(name) }} aria-hidden>
      {initials(name) || '?'}
    </span>
  );
}

export function RespBadge({ value, size = 'md', showLabel = true, title }) {
  const meta = RESP[value] || RESP.review;
  const Icon = meta.icon;
  return (
    <span className={`badge badge--${meta.cls}`} title={title || meta.label}>
      <Icon size={size === 'sm' ? 11 : 12.5} strokeWidth={2.4} />
      {showLabel && (size === 'sm' ? meta.short : meta.label)}
    </span>
  );
}

export function Confidence({ value = 0 }) {
  const tone = value >= 80 ? 'high' : value >= 60 ? 'mid' : 'low';
  return (
    <div className="confidence" title={`AI confidence ${value}%`}>
      <div className="confidence__track">
        <div className={`confidence__fill confidence__fill--${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="confidence__value">{value}%</span>
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = '', onClick, accent = false }) {
  return (
    <button className={`stat ${tone ? `stat--${tone}` : ''} ${accent ? 'stat--accent' : ''}`} onClick={onClick}>
      <div className="stat__top">
        <span className="stat__icon">{Icon && <Icon size={15} strokeWidth={2.2} />}</span>
      </div>
      <div className="stat__value tnum">{value}</div>
      <div>
        <div className="stat__label">{label}</div>
        {hint && <div className="stat__hint">{hint}</div>}
      </div>
    </button>
  );
}

export function Empty({ icon: Icon = Inbox, title, text, action, brand = false }) {
  return (
    <div className="empty">
      <div className={`empty__icon ${brand ? 'empty__icon--brand' : ''}`}>
        <Icon size={24} strokeWidth={1.8} />
      </div>
      <div className="empty__title">{title}</div>
      {text && <div className="empty__text">{text}</div>}
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: '42%', height: 11, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '78%', height: 11, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: '60%', height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 120 }) {
  return <div className="skeleton" style={{ height, borderRadius: 14 }} aria-hidden />;
}

export function Modal({ open, onClose, title, desc, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal__head">
          <div>
            <div className="modal__title">{title}</div>
            {desc && <p className="modal__desc">{desc}</p>}
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Menu({ trigger, children, align = 'right', label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      <span onClick={() => setOpen((v) => !v)} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>
      {open && (
        <div className={`menu ${align === 'left' ? 'menu--left' : ''}`} onClick={() => setOpen(false)}>
          {label && <div className="menu__label">{label}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, active, danger }) {
  return (
    <button className={`menu__item ${active ? 'menu__item--active' : ''}`} onClick={onClick} style={danger ? { color: 'var(--danger)' } : undefined}>
      {Icon && <Icon size={14.5} strokeWidth={2.1} />}
      {children}
    </button>
  );
}

export function Spinner({ big = false }) {
  return <span className={`spinner ${big ? 'spinner--lg' : ''}`} aria-label="Loading" />;
}

export function AiSpark({ size = 13 }) {
  return <Sparkles size={size} strokeWidth={2.2} />;
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="row gap-6" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          className={`chip ${value === o.value ? 'chip--active' : ''}`}
          onClick={() => onChange(o.value)}
          role="tab"
          aria-selected={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Caret() {
  return <ChevronDown size={14} strokeWidth={2.2} />;
}
