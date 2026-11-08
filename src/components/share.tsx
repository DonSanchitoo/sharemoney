import { useEffect, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { appUrl } from '../lib/router';
import { copyText, shareLink } from '../lib/share';
import { Icon, Sheet } from './ui';

export function QR({ text, size = 220 }: { text: string; size?: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  return <div class="qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function InviteSheet(props: { open: boolean; onClose: () => void; token: string; name: string; what?: string }) {
  const url = appUrl('join/' + props.token);
  const [showQR, setShowQR] = useState(false);
  useEffect(() => setShowQR(false), [props.open]);
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Inviter">
      <p class="muted">
        Envoie ce lien aux personnes de {props.what || 'ce projet'}. Elles l’ouvrent, choisissent leur prénom et voient tout
        en temps réel. Toute personne qui a le lien peut consulter et modifier.
      </p>
      <div class="linkbox">
        <Icon name="link" size={18} />
        <span>{url}</span>
      </div>
      <div class="row gap">
        <button type="button" class="btn primary grow" onClick={() => shareLink(props.name, `Rejoins « ${props.name} » sur ShareMoney`, url)}>
          <Icon name="share" size={18} /> Partager
        </button>
        <button type="button" class="btn grow" onClick={() => copyText(url, 'Lien copié')}>
          <Icon name="copy" size={18} /> Copier
        </button>
        <button type="button" class="btn icon-only" aria-label="QR code" onClick={() => setShowQR(!showQR)}>
          <Icon name="qr" size={18} />
        </button>
      </div>
      {showQR && (
        <div class="qr-wrap">
          <QR text={url} />
          <p class="hint">À scanner avec l’appareil photo de l’autre téléphone.</p>
        </div>
      )}
    </Sheet>
  );
}
