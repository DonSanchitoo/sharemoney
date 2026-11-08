import { useRef } from 'preact/hooks';
import { squareLogo } from '../lib/image';
import { CURRENCIES, currencyName } from '../lib/money';
import { LOGO_COLORS, LOGO_EMOJIS } from '../lib/presets';
import { toast } from './toast';
import { Icon, Logo } from './ui';

export function LogoPicker(props: {
  emoji: string;
  color: string;
  image?: string;
  onChange: (v: { emoji?: string; color?: string; image?: string | undefined }) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div class="stack">
      <div class="row gap">
        <Logo emoji={props.emoji} color={props.color} image={props.image} size={64} />
        <div class="stack tight grow">
          <button type="button" class="btn small" onClick={() => input.current?.click()}>
            <Icon name="camera" size={16} /> Photo comme logo
          </button>
          {props.image && (
            <button type="button" class="btn small ghost" onClick={() => props.onChange({ image: undefined })}>
              Revenir à l’emoji
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            try {
              props.onChange({ image: await squareLogo(f) });
            } catch {
              toast('Image illisible', { tone: 'error' });
            }
            e.currentTarget.value = '';
          }}
        />
      </div>
      {!props.image && (
        <>
          <div class="emoji-grid" role="radiogroup" aria-label="Emoji du logo">
            {LOGO_EMOJIS.map((e) => (
              <button type="button" key={e} role="radio" aria-checked={props.emoji === e} class={props.emoji === e ? 'on' : ''} onClick={() => props.onChange({ emoji: e })}>
                {e}
              </button>
            ))}
          </div>
          <div class="color-row" role="radiogroup" aria-label="Couleur du logo">
            {LOGO_COLORS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={props.color === c} aria-label={c} class={props.color === c ? 'on' : ''} style={{ background: c }} onClick={() => props.onChange({ color: c })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CurrencySelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      {CURRENCY_OPTIONS().map((o) => (
        <option value={o.code} key={o.code}>
          {o.code} · {o.name}
        </option>
      ))}
    </select>
  );
}

let cache: { code: string; name: string }[] | null = null;
function CURRENCY_OPTIONS() {
  cache ??= CURRENCIES.map((code) => ({ code, name: currencyName(code) }));
  return cache;
}
