// @ts-check
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { offline } from './src/integrations/offline.ts';
import { rehypeCodeBlocks } from './src/lib/code-blocks.ts';

export default defineConfig({
  site: 'https://rscipher001.github.io',
  // Keep a space between inline elements written on separate lines.
  compressHTML: true,
  markdown: {
    // Code blocks are highlighted by our own plugin, shared with Org files.
    syntaxHighlight: false,
    processor: unified({ rehypePlugins: [rehypeCodeBlocks] }),
  },
  integrations: [mdx(), sitemap({ filter: (page) => !/\/(offline|pause|delayed|lb-custom)\/$/.test(page) }), offline()],
});
