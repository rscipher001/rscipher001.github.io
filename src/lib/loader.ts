/**
 * A content loader for folders that mix Markdown, MDX and Org files.
 *
 * Markdown and MDX go through Astro's own `glob()` loader. Org files are
 * rendered by src/lib/org.ts and stored with their HTML and headings, so
 * `render(entry)` works the same for every format.
 */
import type { Loader, LoaderContext } from 'astro/loaders';
import { glob } from 'astro/loaders';
import { slug } from 'github-slugger';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOrg } from './org';

/** Same ids as glob(): slugged path segments, no extension, no trailing /index. */
const toId = (path: string) =>
  path
    .replace(/\.org$/, '')
    .split(sep)
    .map((segment) => slug(segment))
    .join('/')
    .replace(/\/index$/, '');

function orgFiles(base: string): Loader['load'] {
  return async ({ config, store, parseData, generateDigest, logger, watcher }: LoaderContext) => {
    const root = fileURLToPath(config.root);
    const dir = join(root, base);

    const sync = async (file: string) => {
      const id = toId(relative(dir, file));
      const filePath = relative(root, file);
      const existing = store.get(id);
      if (existing && existing.filePath !== filePath) {
        logger.warn(`${filePath} has the same address as ${existing.filePath}; skipping it.`);
        return;
      }
      const source = await readFile(file, 'utf8');
      const digest = generateDigest(source);
      if (existing?.digest === digest) return;

      const { data, html, headings } = await renderOrg(source);
      store.set({
        id,
        data: await parseData({ id, data, filePath }),
        body: source,
        filePath,
        digest,
        rendered: { html, metadata: { headings } },
      });
    };

    // Skips Emacs lock (.#post.org) and autosave (#post.org#) files.
    const isOrg = (file: string) => file.startsWith(dir) && file.endsWith('.org') && !/^[.#]/.test(basename(file));

    const entries = await readdir(dir, { recursive: true }).catch(() => [] as string[]);
    await Promise.all(entries.map((name) => join(dir, name)).filter(isOrg).map(sync));

    if (!watcher) return;
    const resync = async (file: string) => {
      if (!isOrg(file)) return;
      try {
        await sync(file);
      } catch (error) {
        logger.error(`Couldn't render ${relative(root, file)}: ${(error as Error).message}`);
      }
    };
    watcher.add(dir);
    watcher.on('change', resync);
    watcher.on('add', resync);
    watcher.on('unlink', (file) => {
      if (!isOrg(file)) return;
      const id = toId(relative(dir, file));
      if (store.get(id)?.filePath === relative(root, file)) store.delete(id);
    });
  };
}

/** Load every .md, .mdx and .org file under `base` (relative to the project root). */
export function content(base: string): Loader {
  const markdown = glob({ pattern: '**/*.{md,mdx}', base });
  const org = orgFiles(base);
  return {
    name: 'markdown-and-org',
    // glob() removes entries it didn't load, so Org files are added after it.
    load: async (context) => {
      await markdown.load(context);
      await org(context);
    },
  };
}
