import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const version = process.env.APP_VERSION || 'dev';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Génère sw.js avec la liste des fichiers à mettre en cache pour le hors-ligne. */
function serviceWorker(): Plugin {
  return {
    name: 'sharemoney-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      // L'export PDF (jsPDF et ses dépendances) est chargé à la demande : pas de pré-cache.
      const lazy = /(\.map|\.woff)$|jspdf|html2canvas|purify|index\.es-|export-/;
      const built = Object.keys(bundle).filter((f) => !lazy.test(f));
      const pub = listFiles('public').map((f) => relative('public', f).split('\\').join('/'));
      const precache = Array.from(new Set(['./', ...built, ...pub]));
      const source = readFileSync('src/sw-template.js', 'utf8')
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__VERSION__', JSON.stringify(version + '-' + Date.now().toString(36)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'safari15',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as any);
