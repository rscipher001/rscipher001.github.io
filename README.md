# rscipher001.github.io

Personal site: writing, projects and pages. Built with [Astro](https://astro.build), published to GitHub Pages, and readable offline after the first visit.

## Running it

Needs Node.js 22.12 or newer and pnpm (the version is pinned in `package.json`). On NixOS without pnpm installed, prefix commands with `nix shell nixpkgs#pnpm -c`.

```sh
pnpm install
pnpm dev        # http://localhost:4321, drafts included
pnpm build      # type-check, then build to dist/
pnpm preview    # serve dist/ (the offline service worker only runs in a build)
```

Pushing to `main` deploys through `.github/workflows/deploy.yml`. In the repository's Settings → Pages, the source must be **GitHub Actions**.

## Writing

| Folder | Becomes | Address |
| --- | --- | --- |
| `src/content/posts/` | Posts, listed newest first and in the RSS feed | `/posts/<file-name>/` |
| `src/content/projects/` | Portfolio entries; the Projects menu link appears once one is published | `/projects/<file-name>/` |
| `src/content/pages/` | Stand-alone pages | `/<file-name>/` |

Each folder takes Markdown (`.md`), MDX (`.mdx`, Markdown plus components) and Org (`.org`) files. The draft posts in `src/content/posts/` show every feature and double as a reference.

**Front matter** (Org uses `#+title:`-style keywords instead; see `src/lib/org.ts`):

```yaml
title: My post
description: One sentence for lists and the feed.
date: 2026-10-12
updated: 2026-10-20   # optional
tags: [astro, notes]  # optional
draft: true           # optional: shown by `pnpm dev`, left out of builds
```

Projects can also have `link` and `repo` URLs.

**Code blocks** take a title and highlighted lines:

````md
```js title="garden.js" mark={2,4-5}
````

In Org, use `#+begin_src js :title garden.js :mark 2,4-5`.

**Components** for MDX live in `src/components/mdx/` (start from `Note.astro`).

## Where things are

- `src/site.config.ts`: name, description, intro and footer links. Menu links are in `src/layouts/Base.astro`.
- `src/styles/global.css`: colours (light and dark), type and layout. Colour tokens are at the top.
- `src/styles/fonts.css`: Fira Sans for text and Iosevka for code, both served from the site itself. Iosevka is trimmed to Latin in `src/fonts/iosevka/` (the command is in the file).
- `src/lib/garden.ts`: the raked-gravel gardens. Each page's garden is generated from its address, so it never changes unless the address does.
- `src/lib/code-blocks.ts`: highlighting, titles and marked lines for every format.
- `src/lib/loader.ts` and `src/lib/org.ts`: let one folder mix Markdown, MDX and Org.
- `src/offline/sw.js` and `src/integrations/offline.ts`: the service worker and the build step that lists the files it saves.

## The pause and delayed pages

`/pause/` is a quiet page to land on instead of a blocked site, and `/delayed/lb-custom/` is its twin for sites you only want to slow down. Each visit draws a new scene (misty mountains, rain on a pond or a raked garden), coloured for the time of day, with one quote, reminder or photo. It never shows the same one twice in a row, and it offers a one-minute breathing guide and the sound of rain. It has no menu and no links onward on purpose.

The scene breathes: the ridges, the treeline or the raked rings rise and settle in the guide's rhythm (four seconds in, six out), a little deeper while the guide runs. Now and then a few birds cross the sky as dark silhouettes, often in front of the sun or moon. With reduced motion turned on in your system settings, the scene stays still. The motion lives in `src/scripts/pause/scenes.ts` and `birds.ts`.

**LeechBlock NG setup.** In LeechBlock's options, for each block set, enter this as the page to show for blocked sites (the first field under "How to Block"):

```
https://rscipher001.github.io/pause/#$U
```

LeechBlock replaces `$U` with the address you tried to open, and the page shows its domain ("You were about to open youtube.com."). Because it comes after the `#`, the address never leaves your browser, and the page clears it from the address bar once read. LeechBlock's own default shape, `https://rscipher001.github.io/pause?$S&$U`, works too, but the address is then sent to GitHub on the first visit, before the page is saved on your device. If a block set covers broad patterns that would also match this site, add `+rscipher001.github.io` to its list so the pause page isn't blocked too.

Open the page once while online; after that it opens instantly from your device, with or without a connection.

**Light and dark.** The page starts dark at night or when your system is set to dark, and light otherwise. The half-filled circle in the top corner switches between the two, and the page remembers your choice. The light version follows the time of day (morning, day or evening colours); the dark version is always the night garden.

**The delayed page.** `/delayed/lb-custom/` is the same page for sites you only want to slow down. LeechBlock (version 1.7 or newer) runs its own delaying countdown inside any page whose address contains `lb-custom`, and the page shows it in its own way ("amazon.in opens in 12 seconds", with a hairline filling as the time passes). LeechBlock then lets the site through exactly as its built-in delaying page would, so all of its delay settings keep working: the number of seconds, loading the site automatically, cancelling the countdown if you leave the tab, and allowing the site for only N minutes afterwards.

For the block set whose sites should be delayed, keep the delay settings as they are and enter this as the page for blocked sites:

```
https://rscipher001.github.io/delayed/lb-custom/?$S&$U
```

LeechBlock needs this exact shape: it only runs its countdown in pages whose address contains `lb-custom`, and it reads the block set number and the address from the part after the `?`. Because of that, the address you were heading to is sent to GitHub the very first time, before the page is saved on your device; after that the page opens from your device. Once LeechBlock has read it, the page tidies the address bar to `rscipher001.github.io/delayed/`; reloading still starts the countdown again.

LeechBlock also needs permission to run on websites, which Firefox leaves off until you turn it on: in `about:addons`, choose LeechBlock NG, then under Permissions turn on "Access your data for all websites" (or allow it on this site alone from the Extensions button on the page). Without it, LeechBlock still sends you to the page, but it can't run its countdown there, and the page says so.

"Don't open it" stops the countdown and leaves you on the page ("amazon.in can wait."). LeechBlock's countdown can't be paused from the page, so "Breathe for a minute" also stops it before the breathing guide starts. Without "Automatically load blocked page", an "Open amazon.in" link appears when the countdown ends.

The earlier address, `/delayed/?wait=15#$S&$U`, forwards to this page, so an old setting keeps working, but switch to the new one. If you set up referrer rules for the earlier version (`>rscipher001.github.io`, `>amazon.in` and "Treat referrers as allow-conditions"), remove them; they're no longer needed.

**Changing what it shows.** Everything is in `src/content/pause.yaml`: quotes, reminders (some only at night, in the morning or in the evening) and photos. Put photos in `public/pause/`; they're always saved for offline use, so keep them reasonably small. Your own words help most, so add them there.

**Previewing.** `/pause/?scene=pond&at=night&look=light&moment=urge-wave` shows a particular scene (`mountains`, `pond`, `garden`), time of day (`morning`, `day`, `evening`, `night`), version (`light`, `dark`) and entry (its `id`).

## Offline reading

Every build writes `dist/sw.js` with a list of the site's pages, styles, fonts and small images, plus a version hash of their contents. On a reader's first visit the service worker saves all of them. After that:

- Pages come from the network when it answers within a few seconds, and from the saved copy otherwise.
- Any change to the site changes the version, so readers get the new copy on their next visit.
- Larger images are saved as they're viewed, except on the pause page, where everything is saved up front.
- The pause page opens from the saved copy straight away and refreshes it in the background.
