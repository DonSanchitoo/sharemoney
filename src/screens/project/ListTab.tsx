import { useState } from 'preact/hooks';
import { Avatar, Empty, Icon, PersonChips, Sheet } from '../../components/ui';
import { deleteItem, itemsOf, patchItem, putItem } from '../../lib/store';
import type { Item, ListItemData } from '../../lib/types';
import { memberName, type Group } from './common';

export function ListTab({ g }: { g: Group }) {
  const [text, setText] = useState('');
  const [assign, setAssign] = useState<Item<ListItemData> | null>(null);
  const items = itemsOf<ListItemData>(g.p.id, 'list')
    .slice()
    .sort((a, b) => Number(!!a.data.done) - Number(!!b.data.done) || (a.data.order ?? 0) - (b.data.order ?? 0));
  const todo = items.filter((i) => !i.data.done);
  const done = items.filter((i) => i.data.done);
  const title = g.p.data.listTitle || 'Liste';

  function add() {
    const t = text.trim();
    if (!t) return;
    putItem<ListItemData>(g.p.id, 'list', { text: t, order: Date.now() });
    setText('');
  }

  const row = (it: Item<ListItemData>) => (
    <div class={'list-item' + (it.data.done ? ' done' : '')} key={it.id} style={{ borderTop: '1px solid var(--line)' }}>
      <button
        type="button"
        class={'check' + (it.data.done ? ' on' : '')}
        aria-pressed={!!it.data.done}
        aria-label={it.data.done ? 'Décocher' : 'Cocher'}
        disabled={g.readOnly}
        onClick={() => patchItem<ListItemData>(it.id, { done: !it.data.done })}
      >
        <Icon name="check" size={16} />
      </button>
      <span class="li-main li-title" style={{ whiteSpace: 'normal' }}>
        {it.data.text}
      </span>
      <button type="button" class={'assignee' + (it.data.assignee ? '' : ' empty')} disabled={g.readOnly} onClick={() => setAssign(it)}>
        {it.data.assignee ? (
          <>
            <Avatar name={g.names[it.data.assignee] || '?'} id={it.data.assignee} size={24} />
            {memberName(g.names, it.data.assignee, g.me)}
          </>
        ) : (
          'Qui ?'
        )}
      </button>
      {!g.readOnly && (
        <button type="button" class="icon-btn" aria-label={'Supprimer ' + it.data.text} onClick={() => deleteItem(it.id)}>
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );

  return (
    <>
      {!g.readOnly && (
        <div class="row gap">
          <input type="text" placeholder="Ajouter un élément" value={text} onInput={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={'Ajouter à ' + title} />
          <button type="button" class="btn primary icon-only" aria-label="Ajouter" onClick={add}>
            <Icon name="plus" size={20} />
          </button>
        </div>
      )}
      {!items.length ? (
        <section class="panel">
          <Empty icon="✅" title={title + ' vide'}>
            <p>Ajoute des éléments et attribue-les à quelqu’un : tout le monde voit ce qui est fait.</p>
          </Empty>
        </section>
      ) : (
        <section class="panel flush">
          <div class="day-head">
            {title} · {todo.length} à faire
          </div>
          {todo.map(row)}
          {done.length > 0 && <div class="day-head">Fait · {done.length}</div>}
          {done.map(row)}
        </section>
      )}
      {done.length > 0 && !g.readOnly && (
        <button type="button" class="btn ghost small" onClick={() => done.forEach((d) => deleteItem(d.id))}>
          Effacer les éléments faits
        </button>
      )}
      {assign && (
        <Sheet open title="Qui s’en occupe ?" onClose={() => setAssign(null)}>
          <PersonChips
            people={g.people}
            value={assign.data.assignee || ''}
            me={g.me}
            onChange={(id: string) => {
              patchItem<ListItemData>(assign.id, { assignee: id === assign.data.assignee ? undefined : id });
              setAssign(null);
            }}
          />
          {assign.data.assignee && (
            <button
              type="button"
              class="btn"
              onClick={() => {
                patchItem<ListItemData>(assign.id, { assignee: undefined });
                setAssign(null);
              }}
            >
              Personne
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
