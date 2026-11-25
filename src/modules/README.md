# Modules

Self-contained interactive pieces. Each lives in `src/modules/<name>/`, and the main thread places it in a page
(ADR 0001 §4). Before a module is merged, check it against this list.

## Contract

- [ ] **One import surface:** `index.astro` with a typed `Props` interface. A module never inserts itself.
- [ ] **Works without JS:** with JS off the page is complete; interactive-only controls render `hidden` and the
      module's script reveals them.
- [ ] **Scripts:** processed `<script>` only. No `is:inline` (the one exception is `theme-zip`'s head bootstrap), no
      `on…=` attributes, no `style="…"` attributes, no `eval`. Setting a custom property with `style.setProperty` from
      the script is fine.
- [ ] **No third-party origins:** no CDN libraries, fonts or fetches; no new npm dependency without owner approval.
- [ ] **Tokens only:** colours from `src/styles/tokens.css`; focus rings use `--focus`.
- [ ] **Motion:** only `transform`, `opacity`, `filter`, `clip-path` (documented exceptions below), gated by
      `prefers-reduced-motion: no-preference`; newer features behind `@supports`.
- [ ] **Budgets:** at most ~5 kB JS gzipped, no layout shift, no main-thread task over 50 ms.
- [ ] **Demo:** `demo.astro` (and `demo-<x>.astro`) render at `/lab/<name>/` in dev, or with `MONSUN_LAB=1`.

## Hooks (frozen)

| Hook | Kind | Set by | Used by |
|---|---|---|---|
| `#lista` | id of the launch-list section | launch-list | header CTA, in-page links |
| `[data-consent-open]` | attribute on the footer link | Footer | consent |
| `monsun:lead` | CustomEvent on `document`, `detail: {source}` | launch-list | consent (sends `generate_lead`) |
| `monsun-consent` | localStorage JSON `{v: 1, analytics, at}` | consent | consent |
| `monsun-theme` | localStorage, `light` or `dark` | theme-zip | theme bootstrap |
| `html[data-theme]` | `light` or `dark`; absent means "follow the system" | bootstrap, theme-zip | `tokens.css` |
| `.reading` | opaque `--canvas` surface without quilting | `global.css` | product text, post bodies, launch list |
| `[data-vt-product="<slug>"]` | one gallery wrapper per product per page | product pages | page-transitions |
| `[data-liner-scope]`, `[data-liner-view="in"/"out"]`, `[data-liner-col="in"/"out"]` | product page container, gallery figures, size-table cells | product pages | liner-toggle |

## Registry

| Budget | Owner | State |
|---|---|---|
| The single `backdrop-filter` | hero-temp | reserved, unused |
| `view-transition-name: hero-photo` | hero-temp | reserved, unused |
| `view-transition-name: product-<slug>` | page-transitions | from `data-vt-product` |
| `font-stretch`/`font-weight` animation | hero-temp readout | documented exception |

| Module | State |
|---|---|
| `hero-temp` | merged (gate H, 24 Nov); placed on the home page |
| `launch-list` | stub ("opens soon"); B3 builds the form |
| `theme-zip` | to come (Fable, F2) |
| `liner-toggle` | to come (B6) |
| `consent` | to come (B2) |
| `page-transitions` | v2 (Fable, F3) |
