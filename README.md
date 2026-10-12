# rscipher001.github.io

Personal site: writing, projects and pages. Built with [Astro](https://astro.build), published to GitHub Pages, readable offline after the first visit.

## Run

- Needs Node.js 22.12+ and pnpm (version pinned in `package.json`). On NixOS without pnpm, prefix commands with `nix shell nixpkgs#pnpm -c`.
- `pnpm install`: install dependencies.
- `pnpm dev`: http://localhost:4321, drafts included.
- `pnpm build`: type-check and build to `dist/`.
- `pnpm preview`: serve `dist/` (the offline service worker only runs in a build).
- Pushing to `main` deploys through `.github/workflows/deploy.yml` (Settings → Pages → Source: GitHub Actions).

## Write

- `src/content/posts/` → `/posts/<name>/`: newest first, in the RSS feed.
- `src/content/projects/` → `/projects/<name>/`: portfolio; the Projects menu link appears once one is published.
- `src/content/pages/` → `/<name>/`: stand-alone pages.
- Formats: Markdown (`.md`), MDX (`.mdx`, with components) and Org (`.org`).
- Front matter: `title`, `description`, `date`; optionally `updated`, `tags` and `draft: true` (shown by `pnpm dev`, left out of builds). Projects also take `link` and `repo`. Org uses `#+title:`-style keywords (see `src/lib/org.ts`).
- Code blocks: `` ```js title="garden.js" mark={2,4-5} ``; in Org, `#+begin_src js :title garden.js :mark 2,4-5`.
- MDX components live in `src/components/mdx/` (start from `Note.astro`).
- The draft posts in `src/content/posts/` show every feature.

## Where things are

- `src/site.config.ts`: name, description, intro and footer links (menu links in `src/layouts/Base.astro`).
- `src/styles/global.css`: colours (tokens at the top), type and layout.
- `src/styles/fonts.css`: Fira Sans and Iosevka, served from the site; Iosevka is trimmed to Latin in `src/fonts/iosevka/`.
- `src/lib/garden.ts`: the raked-gravel gardens, generated from each page's address.
- `src/lib/code-blocks.ts`: highlighting, titles and marked lines.
- `src/lib/loader.ts`, `src/lib/org.ts`: one folder mixing Markdown, MDX and Org.
- `src/offline/sw.js`, `src/integrations/offline.ts`: the service worker and the list of files it saves.
- `src/scripts/pause/`: the pause and delayed pages (`main.ts`, `scenes.ts`, `birds.ts`, `breathe.ts`, `rain.ts`, `leechblock.ts`).

## Pause and delayed pages

### What they are

- `/pause/`: a quiet page to land on instead of a blocked site.
- `/delayed/lb-custom/`: the same page for sites you only want to slow down.
- Each visit: a new scene (mountains, pond or raked garden) coloured for the time of day, with one quote or reminder, never the same twice in a row.
- A one-minute breathing guide (4 s in, 6 s out) and the sound of rain.
- No menu and no links onward, on purpose.
- After one visit online, they open instantly from the device, with or without a connection.

### Motion

- The scene breathes in the guide's rhythm, a little deeper while the guide runs.
- Now and then a few birds cross the sky as dark silhouettes, often in front of the sun or moon.
- Mist drifts through the mountain valleys; the sun or moon shimmers on the pond.
- After three minutes in view, one line appears: "Three minutes have passed. Notice where the urge is now: rising, steady or easing."
- With reduced motion turned on in the system, the scene stays still.

### Light and dark

- Starts dark at night or when the system is dark, light otherwise.
- The half-filled circle in the corner switches; the choice is remembered.
- Light follows the time of day; dark is always night.

### LeechBlock NG setup

In each block set, under "How to Block", enter the page to show:

- Blocked sites: `https://rscipher001.github.io/pause/#$U`
  - The address after `#` never leaves the browser, and the page clears it from the address bar.
- Delayed sites (LeechBlock 1.7+): `https://rscipher001.github.io/delayed/lb-custom/?$S&$U`
  - Keep the block set's delay settings; all of them work (seconds, automatic loading, cancel on leaving the tab, allow for N minutes).
  - `lb-custom` makes LeechBlock run its own countdown in the page, and it reads the set and address after the `?`, so the address reaches GitHub on the very first visit.
  - Once LeechBlock has read the address, the address bar shows `/delayed/`; reloading restarts the countdown.
- Firefox: in `about:addons` → LeechBlock NG → Permissions, turn on "Access your data for all websites". Without it there's no countdown, and the page says so.
- Broad block patterns: add `+rscipher001.github.io` so these pages aren't blocked too.
- The earlier address, `/delayed/?wait=15#$S&$U`, forwards to the new one.

### On the delayed page

- "Don't open it" stops the countdown ("amazon.in can wait.").
- "Breathe for a minute" stops it too, since LeechBlock's countdown can't be paused.
- Without automatic loading, an "Open amazon.in" link appears at zero.

### Content and previews

- Quotes, reminders (optionally limited to a time of day) and photos: `src/content/pause.yaml`. Photos go in `public/pause/` and are always saved for offline use, so keep them small. Your own words help most.
- Preview with `/pause/?scene=pond&at=night&look=light&moment=urge-wave`:
  - `scene`: `mountains`, `pond` or `garden`
  - `at`: `morning`, `day`, `evening` or `night`
  - `look`: `light` or `dark`
  - `moment`: an entry's `id`
  - `later=5`: show the three-minute line after 5 seconds

## Offline

- Each build writes `dist/sw.js`: the site's pages, styles, fonts and small images, plus a hash of their contents.
- The first visit saves them all; any change to the site updates them on the next visit.
- Pages come from the network when it answers within a few seconds, otherwise from the saved copy.
- Larger images are saved as they're viewed (on the pause page, up front).
- The pause and delayed pages open from the saved copy at once and refresh in the background.
