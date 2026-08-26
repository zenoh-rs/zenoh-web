# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Official website for the [Eclipse Zenoh](https://github.com/eclipse-zenoh) protocol, published at [zenoh.io](https://zenoh.io). Targets developers who use Zenoh — contains technical documentation and blog posts. Built with [Hugo](https://gohugo.io) (last tested: v0.165.0) and [Tailwind CSS v3](https://tailwindcss.com). Content is Markdown; templates are Hugo HTML.

## Commands

**Install dependencies (first time or after `package.json` changes):**
```sh
npm install
```

**Run dev server (local Hugo install):**
```sh
hugo server
# Visit http://localhost:1313
# Note: search (Pagefind) is NOT available in dev mode — see Production Build below
```

**Production build with search index:**
```sh
npm run build
# Equivalent to: hugo --cleanDestinationDir && npx pagefind --site public
# Generates public/pagefind/ for full-text search
```

**Serve built site locally (to test search):**
```sh
cd public && python3 -m http.server 8080
# Visit http://localhost:8080
```

**Run spell check:**
```sh
codespell --config codespell.cfg
```

**Docker dev server (no local Hugo/Node needed):**
```sh
docker build -f docker/Dockerfile --build-arg user=$(id -un) --build-arg uid=$(id -u) -t zenoh_web .
docker run --rm -v $(pwd):/src -p 1313:1313 zenoh_web
```

## Architecture

```
assets/css/
  main.css          # Tailwind directives + custom CSS (Hugo pipe processes this)
content/          # Markdown source files
  blog/           # Blog posts
  docs/
    overview/     # What is Zenoh, etc.
    getting-started/
    manual/       # Reference manual
    APIs/         # Per-language API docs (Rust, Python, C, C++, Kotlin, REST, Pico)
    migration_0.5_to_0.6/
    migration_1.0/
layouts/          # Hugo Go templates
  index.html      # Homepage
  _default/       # single.html, list.html, taxonomy.html, terms.html
  blog/           # Blog layout
  docs/           # Docs layout
  partials/       # header.html, footer.html, search.html, discord-widget.html
  shortcodes/     # callout, div, figure-inline, rawhtml, table
static/           # Fonts, images, syntax.css (served as-is)
config.yaml       # Hugo site config; defines docs menu sections and weights
package.json      # Node deps: tailwindcss, @tailwindcss/typography, pagefind
tailwind.config.js # Tailwind config: Zenoh brand colors, typography plugin, dark mode
public/           # Generated output — do not edit
```

**Docs menu sections** are defined in `config.yaml` and referenced in content front matter via `menu.docs.parent`. Adding a new section requires both a menu entry in `config.yaml` and matching `parent` values in the content files.

**Custom shortcodes** in `layouts/shortcodes/` can be used in Markdown as `{{< callout >}}`, `{{< rawhtml >}}`, etc.

**Tailwind exec permission:** `layouts/partials/header.html` pipes CSS through `css.TailwindCSS`,
which shells out to `node_modules/.bin/tailwindcss`. Hugo dropped `tailwindcss` from the default
`security.exec.allow` list in v0.158.0+, so `config.yaml` sets an explicit allowlist. Specifying
`security.exec.allow` **replaces** Hugo's defaults rather than appending, so that list must also
re-state `sass`/`go`/`git`/`node`/`postcss`. Without it every build fails with
`access denied: "tailwindcss" is not whitelisted in policy "security.exec.allow"`.

**Tailwind brand colors** (defined in `tailwind.config.js`):
- `zenoh-navy` = `#0A143C` (navbar, dark backgrounds)
- `zenoh-blue` = `#1450ff` (primary accent, links)
- `zenoh-accent` = `#336699`
- `zenoh-light` = `#E8F0FE` (active sidebar backgrounds)

**Dark mode:** Class-based (`darkMode: 'class'`). The `<html>` element gets class `dark` based on `localStorage.theme` or system preference. Toggle button in navbar.

## Pagefind Search

Search is powered by [Pagefind](https://pagefind.app) (post-build static index).

- **Dev mode:** Search input renders but returns no results (index not built).
- **Production:** Run `npm run build` to build both Hugo output and Pagefind index.
- Search index lives in `public/pagefind/` (not committed, regenerated on each build).
- Two search bars: sidebar search (`#search`) in docs layout, global search (`#global-search`) in navbar.

## Discord WidgetBot

WidgetBot provides an embedded Discord chat widget.

**Setup required (Discord server admin action):**
1. Add WidgetBot to the server at https://widgetbot.io
2. Enable a channel for embedding (e.g. `#general` or `#help`)
3. Set `params.widgetbot.server` and `params.widgetbot.channel` in `config.yaml`

**Current state:** Those params are unset, so `layouts/partials/discord-widget.html` renders nothing. The partial is guarded on both params being present — no placeholder IDs reach the output.

- **Floating crate** (all pages): included in `layouts/partials/footer.html`
- **Full embed**: gated on `discord_embed: true` in front matter, but the block lives in
  `layouts/_default/single.html`. `content/community.md` sets `layout: "community"`, so it renders
  `layouts/_default/community.html` and never reaches that block — the full embed is currently
  unreachable from any page.
- **Canonical Discord invite:** `https://discord.gg/2GJ958VuHs`

## Spell Check

Codespell runs on every PR (`.github/workflows/codespell.yml`). To suppress false positives:
- Add technical terms to `codespell_whitelist.txt` (one word per line, case-sensitive)
- Add custom corrections to `codespell_dictionary.txt` (format: `typo->correction`)

`public/`, `resources/`, and `static/` are excluded from spell check.
