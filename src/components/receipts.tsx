import { useEffect, useRef, useState } from 'preact/hooks';
import { compressPhoto } from '../lib/image';
import { deleteReceipt, loadReceipt, saveReceipt } from '../lib/sync';
import { confirmDialog, toast } from './toast';
import { Icon } from './ui';

function Thumb({ id, projectId, onOpen }: { id: string; projectId: string; onOpen: (src: string) => void }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadReceipt(id, projectId).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <button type="button" class="thumb" onClick={() => src && onOpen(src)} aria-label="Voir la photo">
      {src ? <img src={src} alt="" /> : <span class="muted small">{src === null ? 'Indisponible' : '…'}</span>}
    </button>
  );
}

export function Receipts(props: { projectId: string; ids: string[]; onChange: (ids: string[]) => void; readOnly?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<{ id: string; src: string } | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of Array.from(files)) {
        const data = await compressPhoto(f);
        ids.push(await saveReceipt(props.projectId, data));
      }
      props.onChange([...props.ids, ...ids]);
    } catch {
      toast('Photo illisible', { tone: 'error' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: 'Supprimer cette photo ?', confirm: 'Supprimer', danger: true }))) return;
    await deleteReceipt(id, props.projectId);
    props.onChange(props.ids.filter((x) => x !== id));
    setView(null);
  }

  return (
    <div class="receipts">
      <div class="thumbs">
        {props.ids.map((id) => (
          <Thumb key={id} id={id} projectId={props.projectId} onOpen={(src) => setView({ id, src })} />
        ))}
        {!props.readOnly && (
          <button type="button" class="thumb add" onClick={() => input.current?.click()} disabled={busy}>
            <Icon name="camera" />
            <span class="small">{busy ? 'Envoi…' : props.label || 'Photo'}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.currentTarget.files)} />
      {view && (
        <div class="overlay viewer" onClick={() => setView(null)}>
          <img src={view.src} alt="Photo du ticket" onClick={(e) => e.stopPropagation()} />
          <div class="viewer-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" class="btn" onClick={() => setView(null)}>
              Fermer
            </button>
            {!props.readOnly && (
              <button type="button" class="btn danger" onClick={() => remove(view.id)}>
                <Icon name="trash" size={18} /> Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
