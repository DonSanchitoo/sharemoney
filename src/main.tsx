import { render } from 'preact';
import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/700.css';
import './styles.css';
import { App } from './app';
import { initStore } from './lib/store';
import { startSync } from './lib/sync';
import { toast } from './components/toast';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offer = (w: ServiceWorker) =>
        toast('Nouvelle version disponible', {
          action: { label: 'Mettre à jour', fn: () => w.postMessage('skipWaiting') },
          ms: 15000,
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    })
    .catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

initStore().then(() => {
  render(<App />, document.getElementById('app')!);
  startSync();
  registerServiceWorker();
});
