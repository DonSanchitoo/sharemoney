import { signal } from '@preact/signals';

interface Toast {
  id: number;
  msg: string;
  tone?: 'info' | 'warn' | 'error';
  action?: { label: string; fn: () => void };
}

const toasts = signal<Toast[]>([]);
let seq = 0;

export function toast(msg: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}) {
  const t: Toast = { id: ++seq, msg, tone: opts.tone, action: opts.action };
  toasts.value = [...toasts.value.slice(-2), t];
  setTimeout(() => dismiss(t.id), opts.ms ?? (opts.action ? 8000 : 2600));
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function ToastHost() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={'toast ' + (t.tone || 'info')}>
          <span>{t.msg}</span>
          {t.action && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                t.action!.fn();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Boîte de confirmation ---------- */

interface Dialog {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

const dialog = signal<Dialog | null>(null);

export function confirmDialog(opts: Omit<Dialog, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.value = { ...opts, resolve };
  });
}

export function DialogHost() {
  const d = dialog.value;
  if (!d) return null;
  const close = (v: boolean) => {
    dialog.value = null;
    d.resolve(v);
  };
  return (
    <div class="overlay center" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">{d.title}</h2>
        {d.message && <p class="muted">{d.message}</p>}
        <div class="dialog-actions">
          <button type="button" class="btn" onClick={() => close(false)}>
            {d.cancel || 'Annuler'}
          </button>
          <button type="button" class={'btn ' + (d.danger ? 'danger' : 'primary')} onClick={() => close(true)}>
            {d.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
