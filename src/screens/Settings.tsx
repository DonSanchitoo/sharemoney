import { useState } from 'preact/hooks';
import { isIOS, isStandalone } from '../components/chrome';
import { QR } from '../components/share';
import { confirmDialog, toast } from '../components/toast';
import { Field, Icon, Segmented } from '../components/ui';
import { fmtAgo } from '../lib/date';
import { appUrl, go, parseShareLink } from '../lib/router';
import { copyText, shareLink } from '../lib/share';
import { db, dropKeyring, keyringProject, myProjects, pendingCount, reconcileKeyring, resetDevice, setPrefs, switchKeyring } from '../lib/store';
import { syncEnabled, syncNow, syncState } from '../lib/sync';
import { APP_VERSION } from '../lib/version';

export function SettingsScreen({ importKey }: { importKey?: string }) {
  const prefs = db.value.prefs;
  const [link, setLink] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const keyUrl = db.value.keyring ? appUrl('k/' + db.value.keyring) : '';
  const s = syncState.value;
  const count = myProjects.value.filter((p) => p.kind !== 'keyring').length;

  async function useKey(tok: string) {
    if (tok === db.value.keyring) {
      toast('C’est déjà la clé de cet appareil');
      go('settings', true);
      return;
    }
    setBusy(true);
    const old = switchKeyring(tok);
    await syncNow();
    if (!keyringProject()) {
      if (old) switchKeyring(old);
      dropKeyring(tok);
      toast('Clé introuvable (ou hors ligne)', { tone: 'error' });
    } else {
      if (old) dropKeyring(old);
      reconcileKeyring();
      await syncNow();
      toast('Appareils reliés : tes projets sont synchronisés');
    }
    setBusy(false);
    go('settings', true);
  }

  function pasted() {
    const parsed = parseShareLink(link);
    if (!parsed) return toast('Lien ou clé non reconnu', { tone: 'warn' });
    setLink('');
    if (parsed.kind === 'keyring') void useKey(parsed.token);
    else go('join/' + parsed.token);
  }

  return (
    <div class="page">
      <div class="page-head">
        <h1>Réglages</h1>
      </div>

      {importKey && (
        <section class="panel accent">
          <h2>Relier cet appareil</h2>
          <p>Tu as ouvert la clé personnelle d’un autre appareil. Les projets des deux appareils seront fusionnés et resteront synchronisés.</p>
          <div class="row gap">
            <button type="button" class="btn primary grow" disabled={busy} onClick={() => useKey(importKey)}>
              {busy ? 'Connexion…' : 'Relier'}
            </button>
            <button type="button" class="btn" onClick={() => go('settings', true)}>
              Annuler
            </button>
          </div>
        </section>
      )}

      <section class="panel">
        <Field label="Ton prénom" for="st-name" hint="Proposé quand tu rejoins un projet.">
          <input id="st-name" type="text" value={prefs.name} onInput={(e) => setPrefs({ name: e.currentTarget.value })} />
        </Field>
        <div class="field">
          <span class="label">Apparence</span>
          <Segmented
            value={prefs.theme}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
            onChange={(theme) => setPrefs({ theme })}
          />
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Synchronisation</h2>
          {syncEnabled && (
            <button type="button" class="btn small" disabled={s.status === 'syncing'} onClick={() => void syncNow()}>
              <Icon name="refresh" size={16} /> Synchroniser
            </button>
          )}
        </div>
        {syncEnabled ? (
          <p class="muted small">
            {s.status === 'offline' ? 'Hors ligne : tes modifications partiront dès le retour du réseau.' : s.status === 'error' ? `Erreur : ${s.error}` : `Dernière synchro ${fmtAgo(db.value.lastSync)}.`}
            {pendingCount.value ? ` ${pendingCount.value} modification(s) en attente.` : ''} {count} projet(s) sur cet appareil.
          </p>
        ) : (
          <p class="muted small">Pas de serveur configuré : les données restent sur cet appareil.</p>
        )}
      </section>

      {syncEnabled && (
        <section class="panel">
          <h2>Mes appareils</h2>
          <p class="muted small">
            Ta clé personnelle retrouve tous tes projets sur un autre appareil (ou dans l’app installée sur l’écran d’accueil, qui ne partage pas les
            données de Safari). Garde-la pour toi.
          </p>
          <div class="row gap">
            <button type="button" class="btn grow" onClick={() => copyText(keyUrl, 'Clé copiée')}>
              <Icon name="key" size={18} /> Copier ma clé
            </button>
            <button type="button" class="btn icon-only" aria-label="Partager ma clé" onClick={() => shareLink('Ma clé ShareMoney', 'Ma clé personnelle ShareMoney', keyUrl)}>
              <Icon name="share" size={18} />
            </button>
            <button type="button" class="btn icon-only" aria-label="QR code de ma clé" onClick={() => setShowKey(!showKey)}>
              <Icon name="qr" size={18} />
            </button>
          </div>
          {showKey && (
            <div class="qr-wrap">
              <QR text={keyUrl} />
            </div>
          )}
        </section>
      )}

      <section class="panel">
        <h2>Coller un lien</h2>
        <p class="muted small">Lien d’invitation à un projet ou clé d’un autre appareil.</p>
        <div class="row gap">
          <input type="url" placeholder="https://…" value={link} onInput={(e) => setLink(e.currentTarget.value)} />
          <button type="button" class="btn" disabled={busy} onClick={pasted}>
            Ouvrir
          </button>
        </div>
      </section>

      {!isStandalone() && (
        <section class="panel">
          <h2>Installer sur l’iPhone</h2>
          <ol class="muted small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{isIOS() ? 'Dans Safari, touche' : 'Ouvre ce site dans Safari sur iPhone, touche'} le bouton Partager.</li>
            <li>Choisis « Sur l’écran d’accueil », puis « Ajouter ».</li>
            <li>Avant d’ouvrir l’app, copie ta clé ci-dessus, puis colle-la dans Réglages → Coller un lien depuis l’app.</li>
          </ol>
        </section>
      )}

      <section class="panel danger-zone">
        <button
          type="button"
          class="btn danger block"
          onClick={async () => {
            if (!(await confirmDialog({ title: 'Effacer cet appareil ?', message: 'Les données locales sont supprimées. Les projets restent en ligne : garde ta clé pour les retrouver.', confirm: 'Effacer', danger: true }))) return;
            await resetDevice();
            location.hash = '';
            location.reload();
          }}
        >
          Effacer les données de cet appareil
        </button>
      </section>
      <p class="version">
        ShareMoney {APP_VERSION} ·{' '}
        <a href="https://github.com/DonSanchitoo/sharemoney" target="_blank" rel="noopener">
          code source
        </a>
      </p>
    </div>
  );
}
