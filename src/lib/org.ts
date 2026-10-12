/**
 * Org-mode to HTML, with the same code blocks and heading ids as Markdown.
 *
 *   #+title: My post        ->  data.title
 *   #+description: ...      ->  data.description
 *   #+date: <2026-10-10>    ->  data.date
 *   #+updated: <...>        ->  data.updated
 *   #+filetags: :a:b:       ->  data.tags   (#+tags: a b also works)
 *   #+draft: t              ->  data.draft
 *   any other #+key: value  ->  data.key    (e.g. #+link, #+repo for projects)
 *
 * Top-level headings (*) become <h2>, matching Markdown's ##.
 */
import GithubSlugger from 'github-slugger';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import { toString } from 'hast-util-to-string';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import type { Keyword, OrgData, SrcBlock } from 'uniorg';
import uniorgParse from 'uniorg-parse';
import uniorgRehype from 'uniorg-rehype';
import { rehypeCodeBlocks } from './code-blocks';

export interface OrgHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderedOrg {
  data: Record<string, unknown>;
  html: string;
  headings: OrgHeading[];
}

const orgDate = (value: string) => value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? value;
const orgBool = (value: string) => /^(t|true|yes|1)$/i.test(value.trim());
const orgList = (value: string) => value.split(/[\s,:]+/).filter(Boolean);

function keywordsToData(tree: OrgData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const visit = (node: { type: string; children?: unknown[] }) => {
    if (node.type === 'keyword') {
      const { key, value } = node as Keyword;
      const name = key.toLowerCase();
      if (name in data) return;
      if (name === 'date' || name === 'updated') data[name] = orgDate(value);
      else if (name === 'draft') data.draft = orgBool(value);
      else if (name === 'filetags' || name === 'tags') data.tags = orgList(value);
      else data[name] = value.trim();
    }
    // Keywords only matter before the first headline's content; stop at headlines.
    if (node.type !== 'headline') node.children?.forEach((child) => visit(child as typeof node));
  };
  visit(tree);
  return data;
}

/** `:title init.el :mark 2,4-5` -> `title="init.el" mark={2,4-5}` */
function headerArgsToMeta(parameters: string | null | undefined): string {
  if (!parameters) return '';
  const meta: string[] = [];
  for (const [, key, value] of parameters.matchAll(/:(\w+)\s+((?:(?!\s:\w).)+)/g)) {
    const clean = value.trim().replace(/^"(.*)"$/, '$1');
    if (key === 'title') meta.push(`title="${clean}"`);
    if (key === 'mark') meta.push(`mark={${clean.replace(/\s+/g, '')}}`);
  }
  return meta.join(' ');
}

const srcBlock = (org: SrcBlock): Element => ({
  type: 'element',
  tagName: 'pre',
  properties: {},
  children: [
    {
      type: 'element',
      tagName: 'code',
      properties: { className: [`language-${org.language ?? 'text'}`] },
      data: { meta: headerArgsToMeta((org as SrcBlock & { parameters?: string | null }).parameters) } as Element['data'],
      children: [{ type: 'text', value: org.value }],
    },
  ],
});

/** Shift headings down one level and give them ids, collecting a table of contents. */
function rehypeHeadings(headings: OrgHeading[]) {
  return () => (tree: Root) => {
    const slugger = new GithubSlugger();
    const walk = (node: Root | Element) => {
      node.children.forEach((child: RootContent | ElementContent) => {
        if (child.type !== 'element') return;
        const level = /^h([1-6])$/.exec(child.tagName);
        if (level) {
          const depth = Math.min(Number(level[1]) + 1, 6);
          const text = toString(child);
          const slug = slugger.slug(text);
          child.tagName = `h${depth}`;
          child.properties.id = slug;
          headings.push({ depth, slug, text });
        } else {
          walk(child);
        }
      });
    };
    walk(tree);
  };
}

export async function renderOrg(source: string): Promise<RenderedOrg> {
  const tree = unified().use(uniorgParse).parse(source) as OrgData;
  const data = keywordsToData(tree);
  const headings: OrgHeading[] = [];

  const processor = unified()
    .use(uniorgParse)
    .use(uniorgRehype, {
      handlers: { 'src-block': srcBlock },
      footnotesSection: (footnotes) => [
        {
          type: 'element',
          tagName: 'section',
          properties: { className: ['footnotes'] },
          children: footnotes as ElementContent[],
        },
      ],
    })
    .use(rehypeHeadings(headings))
    .use(rehypeCodeBlocks)
    .use(rehypeStringify);

  const html = String(await processor.process(source));
  return { data, html, headings };
}
