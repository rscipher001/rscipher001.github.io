---
title: How posts are written here
description: A reference for everything a Markdown post can do on this site, from code block titles to footnotes.
date: 2026-10-12
tags: [meta, markdown]
draft: true
---

Posts live in `src/content/posts/`. A post is a Markdown (`.md`), MDX (`.mdx`) or Org (`.org`) file, and its file name becomes its address: this file is `writing-guide.md`, so it lives at `/posts/writing-guide/`.

This post is a draft. Drafts show up while you run `pnpm dev` and are left out of the built site. Remove `draft: true` from the front matter to publish.

## Front matter

Every Markdown post starts with a small block of YAML:

```yaml title="src/content/posts/my-post.md"
---
title: My post
description: One sentence for lists, feeds and search results.
date: 2026-10-12
updated: 2026-10-20   # optional
tags: [astro, notes]  # optional
draft: true           # optional; drafts are only visible in dev
---
```

## Code blocks

Fenced code blocks are highlighted at build time. Add a `title` to label the block, and `mark` to highlight lines:

```js title="garden.js" mark={3-4}
export function rake(gravel) {
  // Long, even strokes.
  for (const row of gravel.rows) {
    row.smooth();
  }
  return gravel;
}
```

A block without a title is just the code:

```sh
pnpm dev
```

Inline code like `const stillness = true` sits in the sentence.

## Text

Paragraphs, *emphasis*, **strong text**, ~~struck text~~ and [links](https://astro.build) behave as you'd expect. Keyboard keys use HTML: <kbd>Ctrl</kbd> + <kbd>C</kbd>.

> A quotation is set in italics with a mossy rule beside it.

Lists:

- Raked gravel stands for water.
- Stones stand for islands or mountains.
  - Moss grows where it likes.

1. Write the post.
2. Run `pnpm build`.
3. Push.

| Format | Extension | Custom components |
| ------ | --------- | ----------------- |
| Markdown | `.md` | No |
| MDX | `.mdx` | Yes |
| Org | `.org` | No |

A footnote looks like this.[^1]

---

A horizontal rule (`---`) turns into three small stones, as above.

[^1]: Footnotes collect at the end of the post.
