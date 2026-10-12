/**
 * Writes dist/sw.js after every build: src/offline/sw.js plus the list of
 * files to save for offline reading and a version hash of their contents.
 */
import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pages, styles, scripts and fonts are always saved; images only when small. */
const ALWAYS = /\.(html|css|js|woff2|webmanifest)$/;
const IF_SMALL = /\.(svg|ico|png|jpe?g|webp|avif|gif)$/;
const SMALL_BYTES = 300 * 1024;
/** Font subsets this site doesn't use; the browser fetches them if a page ever needs one. */
const SKIP = /(^sw\.js$|^sitemap.*\.xml$|-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-[^/]*\.woff2$)/;

const toUrl = (file: string) => {
  const path = '/' + file.split(sep).join('/');
  return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
};

export function offline(): AstroIntegration {
  let root: URL;
  return {
    name: 'offline',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files = (await readdir(out, { recursive: true })).sort();

        const version = createHash('sha256');
        const precache: string[] = [];
        let bytes = 0;
        for (const file of files) {
          if (SKIP.test(file)) continue;
          const path = join(out, file);
          const info = await stat(path);
          if (!info.isFile()) continue;
          // Everything the quiet pages use (public/pause/) is saved, whatever its size: they have to work offline.
          const forPause = file.startsWith(`pause${sep}`);
          if (!forPause && !ALWAYS.test(file) && !(IF_SMALL.test(file) && info.size <= SMALL_BYTES)) continue;
          const url = toUrl(file);
          precache.push(url);
          bytes += info.size;
          version.update(url).update(await readFile(path));
        }

        const hash = version.digest('hex').slice(0, 12);
        const worker = await readFile(new URL('src/offline/sw.js', root), 'utf8');
        const header = `const VERSION = ${JSON.stringify(hash)};\nconst PRECACHE = ${JSON.stringify(precache, null, 2)};\n\n`;
        await writeFile(join(out, 'sw.js'), header + worker);

        logger.info(`sw.js saves ${precache.length} files (${Math.round(bytes / 1024)} KB) for offline reading, version ${hash}`);
      },
    },
  };
}
