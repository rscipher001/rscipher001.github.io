import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { content } from './lib/loader';

// Front matter in Markdown/MDX, or #+keywords in Org (see src/lib/org.ts).
const writing = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  /** Drafts are visible in `pnpm dev` and left out of the built site. */
  draft: z.boolean().default(false),
});

const posts = defineCollection({
  loader: content('src/content/posts'),
  schema: writing,
});

const projects = defineCollection({
  loader: content('src/content/projects'),
  schema: writing.extend({
    /** Where the project lives. */
    link: z.url().optional(),
    /** Its source code. */
    repo: z.url().optional(),
  }),
});

// Stand-alone pages, served at /<file name>/.
const pages = defineCollection({
  loader: content('src/content/pages'),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// What the /pause/ page shows, one at a time (see src/content/pause.yaml).
const time = z.enum(['morning', 'day', 'evening', 'night']).optional();
const pause = defineCollection({
  loader: file('src/content/pause.yaml'),
  schema: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('quote'), text: z.string(), by: z.string(), time }),
    z.object({ kind: z.literal('reminder'), text: z.string(), time }),
    z.object({
      kind: z.literal('image'),
      src: z.string().startsWith('/pause/'),
      alt: z.string(),
      caption: z.string().optional(),
      time,
    }),
  ]),
});

export const collections = { posts, projects, pages, pause };
