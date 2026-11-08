import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { amountToInput, currencySymbol, parseAmount } from '../lib/money';
import { colorFor } from '../lib/presets';

/* ---------- Icônes (traits 24 px) ---------- */

const ICONS: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M19 8v6M16 11h6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.8-5.6-4.5-6.6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
  cloudOff: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M3 3l18 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
};

export function Icon({ name, size = 22, class: cls }: { name: keyof typeof ICONS | string; size?: number; class?: string }) {
  return (
    <svg
      class={'icon ' + (cls || '')}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }}
    />
  );
}

/* ---------- Barre du haut ---------- */

export function TopBar(props: {
  title?: ComponentChildren;
  onBack?: () => void;
  backLabel?: string;
  actions?: ComponentChildren;
  left?: ComponentChildren;
}) {
  return (
    <header class="topbar">
      <div class="topbar-side">
        {props.left}
        {props.onBack && (
          <button type="button" class="back-btn" onClick={props.onBack} aria-label={props.backLabel || 'Retour'}>
            <Icon name="left" />
            <span>{props.backLabel || 'Retour'}</span>
          </button>
        )}
      </div>
      <div class="topbar-title">{props.title}</div>
      <div class="topbar-side end">{props.actions}</div>
    </header>
  );
}

/* ---------- Champs ---------- */

export function Field(props: { label?: ComponentChildren; hint?: ComponentChildren; children: ComponentChildren; for?: string; class?: string }) {
  return (
    <div class={'field ' + (props.class || '')}>
      {props.label && <label for={props.for}>{props.label}</label>}
      {props.children}
      {props.hint && <p class="hint">{props.hint}</p>}
    </div>
  );
}

type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>;

export function AmountInput(
  props: InputProps & { value: number; onValue: (cents: number) => void; currency?: string; big?: boolean; allowZero?: boolean }
) {
  const { value, onValue, currency = 'EUR', big, allowZero: _a, class: cls, ...rest } = props;
  const [text, setText] = useState(amountToInput(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current && parseAmount(text) !== value) setText(amountToInput(value));
  }, [value]);
  return (
    <div class={'amt ' + (big ? 'amt-big ' : '') + (cls || '')}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        {...rest}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(amountToInput(parseAmount(text)));
        }}
        onInput={(e) => {
          const t = e.currentTarget.value.replace(/[^\d.,\s]/g, '');
          setText(t);
          onValue(parseAmount(t));
        }}
      />
      <span class="amt-cur">{currencySymbol(currency)}</span>
    </div>
  );
}

export function NumberInput(props: InputProps & { value: number | undefined; onValue: (n: number) => void; suffix?: string }) {
  const { value, onValue, suffix, class: cls, ...rest } = props;
  const show = (n: number | undefined) => (n == null || isNaN(n) ? '' : String(n).replace('.', ','));
  const [text, setText] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(show(value));
  }, [value]);
  return (
    <div class={'amt ' + (cls || '')}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        {...rest}
        style={{ ...((rest.style as Record<string, unknown>) || {}), ...(suffix && suffix.length > 1 ? { paddingRight: 16 + suffix.length * 9 } : {}) }}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(show(value));
        }}
        onInput={(e) => {
          const t = e.currentTarget.value.replace(/[^\d.,]/g, '');
          setText(t);
          const n = parseFloat(t.replace(',', '.'));
          onValue(isFinite(n) ? n : 0);
        }}
      />
      {suffix && <span class="amt-cur">{suffix}</span>}
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: ComponentChildren; hint?: ComponentChildren; disabled?: boolean }) {
  return (
    <label class={'switch-row' + (props.disabled ? ' disabled' : '')}>
      <span class="switch-text">
        <span>{props.label}</span>
        {props.hint && <small class="hint">{props.hint}</small>}
      </span>
      <span class="switch">
        <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.currentTarget.checked)} />
        <span class="switch-track" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>(props: { value: T; options: { value: T; label: ComponentChildren }[]; onChange: (v: T) => void; small?: boolean; label?: string }) {
  return (
    <div class={'segmented' + (props.small ? ' small' : '')} role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          class={props.value === o.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Avatars et logos ---------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ name, color, size = 32, id }: { name: string; color?: string; size?: number; id?: string }) {
  return (
    <span class="avatar" style={{ width: size, height: size, background: color || colorFor(id || name), fontSize: size * 0.4 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Logo({ emoji, color, image, size = 44 }: { emoji?: string; color?: string; image?: string; size?: number }) {
  return (
    <span class="logo" style={{ width: size, height: size, background: image ? 'transparent' : color || '#0f6b5c', fontSize: size * 0.52 }} aria-hidden="true">
      {image ? <img src={image} alt="" /> : emoji || '💼'}
    </span>
  );
}

/* ---------- Sélection de personnes ---------- */

export interface Person {
  id: string;
  name: string;
  color?: string;
}

export function PersonChips(props: {
  people: Person[];
  value: string | string[];
  onChange: (v: any) => void;
  multi?: boolean;
  me?: string;
}) {
  const selected = Array.isArray(props.value) ? props.value : [props.value];
  return (
    <div class="chips">
      {props.people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            type="button"
            class={'chip person' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => {
              if (!props.multi) props.onChange(p.id);
              else props.onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id]);
            }}
          >
            <Avatar name={p.name} color={p.color} id={p.id} size={22} />
            <span>{p.name + (p.id === props.me ? ' (moi)' : '')}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Feuille modale (bas d'écran) ---------- */

export function Sheet(props: {
  open: boolean;
  title: ComponentChildren;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: ComponentChildren;
}) {
  useEffect(() => {
    if (!props.open) return;
    document.documentElement.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-head">
          <button type="button" class="link-btn" onClick={props.onClose}>
            Annuler
          </button>
          <h2>{props.title}</h2>
          {props.onSave ? (
            <button type="button" class="link-btn strong" disabled={props.saveDisabled} onClick={props.onSave}>
              {props.saveLabel || 'OK'}
            </button>
          ) : (
            <span />
          )}
        </div>
        <div class="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

export function Empty(props: { icon?: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      {props.icon && <div class="empty-icon">{props.icon}</div>}
      <p class="empty-title">{props.title}</p>
      {props.children && <div class="empty-body">{props.children}</div>}
    </div>
  );
}

export function Section(props: { title?: ComponentChildren; action?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={'panel ' + (props.class || '')}>
      {(props.title || props.action) && (
        <div class="panel-head">
          {props.title && <h2>{props.title}</h2>}
          {props.action}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Gauge({ value, max, tone }: { value: number; max: number; tone?: 'ok' | 'warn' | 'over' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const t = tone || (max > 0 && value > max ? 'over' : max > 0 && value >= max * 0.8 ? 'warn' : 'ok');
  return (
    <div class={'gauge ' + t} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: pct + '%' }} />
    </div>
  );
}
