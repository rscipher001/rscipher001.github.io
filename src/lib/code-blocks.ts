/**
 * Code blocks for every content format (Markdown, MDX and Org).
 *
 * A rehype plugin that finds `<pre><code class="language-x">`, highlights it
 * with Shiki and wraps it in a <figure>. Options come from the fence meta:
 *
 *   ```js title="garden.js" mark={2,4-5}
 *
 * Org source blocks use header arguments instead (see org-loader.ts):
 *
 *   #+begin_src js :title garden.js :mark 2,4-5
 *
 * Colours are CSS variables (--code-*), defined in src/styles/global.css.
 */
import type { Element, ElementContent, Root, RootContent } from 'hast';
import {
  bundledLanguages,
  bundledLanguagesAlias,
  createCssVariablesTheme,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from 'shiki';

const theme = createCssVariablesTheme({ name: 'garden', variablePrefix: '--code-', fontStyle: true });

let highlighter: Promise<Highlighter> | undefined;
function getHighlighter() {
  highlighter ??= createHighlighter({ themes: [theme], langs: [] });
  return highlighter;
}

const known = (lang: string): lang is BundledLanguage => lang in bundledLanguages || lang in bundledLanguagesAlias;

/** Parse `title="a b" mark={1,3-4} wrap` into a small options object. */
export function parseMeta(meta = ''): { title?: string; mark: Set<number> } {
  const options: { title?: string; mark: Set<number> } = { mark: new Set() };
  const pattern = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|(\S+)))?/g;
  for (const [, key, dq, sq, braces, bare] of meta.matchAll(pattern)) {
    const value = dq ?? sq ?? braces ?? bare;
    if (key === 'title' && value) options.title = value;
    if (key === 'mark' && value) {
      for (const part of value.split(',')) {
        const [from, to = from] = part.split('-').map((n) => Number.parseInt(n, 10));
        for (let n = from; n <= to; n++) if (Number.isFinite(n)) options.mark.add(n);
      }
    }
  }
  return options;
}

const text = (node: ElementContent | RootContent): string =>
  node.type === 'text' ? node.value : 'children' in node ? node.children.map(text).join('') : '';

const h = (tagName: string, properties: Element['properties'], children: ElementContent[]): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});

async function render(code: Element): Promise<Element> {
  const classes = ([] as unknown[]).concat(code.properties.className ?? []).map(String);
  const lang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length) ?? 'text';
  // Markdown keeps the fence meta in `data.meta`; MDX moves it to `properties.metastring`.
  const meta = (code.data as { meta?: string } | undefined)?.meta ?? String(code.properties.metastring ?? '');
  const { title, mark } = parseMeta(meta);
  const source = text(code).replace(/\n$/, '');

  const shiki = await getHighlighter();
  if (known(lang) && !shiki.getLoadedLanguages().includes(lang)) await shiki.loadLanguage(lang);

  const root = shiki.codeToHast(source, {
    lang: known(lang) ? lang : 'text',
    theme: 'garden',
    transformers: [
      {
        pre(node) {
          // Our own figure carries the colours; drop Shiki's inline ones and its `class`
          // (kept alongside `className`, it would print a second class attribute).
          delete node.properties.style;
          delete node.properties.class;
          node.properties.className = ['code-block__pre'];
          node.properties.dataLang = lang;
        },
        line(node, line) {
          if (mark.has(line)) this.addClassToHast(node, 'is-marked');
        },
      },
    ],
  });

  const pre = root.children[0] as Element;
  const children: ElementContent[] = [];
  if (title) children.push(h('figcaption', { className: ['code-block__title'] }, [{ type: 'text', value: title }]));
  children.push(pre);
  return h('figure', { className: ['code-block'], dataLang: lang }, children);
}

/** rehype plugin: highlight and frame every fenced code block. */
export function rehypeCodeBlocks() {
  return async (tree: Root) => {
    const jobs: Promise<void>[] = [];
    // Walks any node with children, so blocks nested in MDX components are found too.
    const walk = (parent: { children: unknown[] }) => {
      parent.children.forEach((child, index) => {
        const node = child as RootContent;
        if (node.type === 'element' && node.tagName === 'pre') {
          const code = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
          if (code) return void jobs.push(render(code).then((figure) => void (parent.children[index] = figure)));
        }
        if ('children' in node && Array.isArray(node.children)) walk(node);
      });
    };
    walk(tree);
    await Promise.all(jobs);
  };
}
