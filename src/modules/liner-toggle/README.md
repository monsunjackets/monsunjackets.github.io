# Module `liner-toggle`: „Z podpinką / Bez podpinki” on a product page

Date: 2026-11-25
Status: proposed (chunk B6, branch `chunk/liner-toggle`)
Author: Miłosz Lewandowski + Claude
Related to: plan 0002 §7 B6; ADR 0001 §4 and the M5d amendment; `src/modules/README.md` (hooks); `docs/design/asset-spec.md` (photo pairs)

---

## What it does

On a jacket's product page, two radios under the gallery, „Z podpinką” (default) and „Bez podpinki”, show the
photos of the chosen state and frame the matching chest column of the size table. The page carries the hooks; the
module brings the radios and the CSS keyed on those hooks. There is no script.

| Without the module, or without `:has()` | With the module |
|---|---|
| The gallery shows both photos of each pair, the table both chest columns, nothing highlighted. Complete on its own. | One state at a time. In pair slots the chosen photo cross-fades over the other in place; in a flat gallery the other state's photos leave the layout. The chosen chest column gets a frame and a lighter ground, the other one steps back to `--ink-soft`. |

## Files

| File | Role |
|---|---|
| `index.astro` | The import surface: `Props`, the radio group, and all styles (scoped, with `:global()` for the hooks) |
| `liner-toggle.ts` | Build-time helpers: `showsLinerToggle` (render or not), `hasLinerPair`, `linerSlots` (groups a gallery into pair slots). No browser code |
| `liner-toggle.test.ts` | `node:test` tests for the helpers (`scripts/dock npm test`) |
| `demo.astro` | `/lab/liner-toggle/`: pair slots, a flat gallery, the liner product and a jacket without a pair, with sample tables. Drawn sketches, no image files |

## Placement (M6)

In `src/pages/kolekcja/[slug].astro`:

```astro
---
import LinerToggle from '../../modules/liner-toggle/index.astro';
import { linerSlots } from '../../modules/liner-toggle/liner-toggle.ts';
// product = the collection entry for this page
---
<LinerToggle liner={product.data.liner} images={product.data.images} />
```

- **Inside `[data-liner-scope]`.** The CSS starts from `[data-liner-scope]:has(<checked radio>)`, so the radios, the
  gallery and the size table must all be descendants of the same scope element (the product page container).
- **Right under the gallery, in the gallery column**, before the „Wizualizacja AI” note: the control sits next to
  what it changes. It is a block (`display: grid`, left-aligned); spacing comes from the column's `gap` or the
  `class` prop.
- **Render it unconditionally.** It renders nothing for `liner: 'liner'` (the liner has no with/without view) and for
  a product without at least one `in` and one `out` photo (today's ramoneska has `in` but no `out`, so nothing
  renders until C4 brings the pair). The page needs no `if`.
- One per page. For two on one page, give each a unique `id`.

## Markup the module expects (B4's template, hooks frozen in M5)

```astro
<article data-liner-scope>
  <div class="gallery" data-vt-product={slug}>
    {linerSlots(images).map((slot) =>
      slot.length === 2 ? (
        <div class="pair">
          <figure data-liner-view="in">…</figure>
          <figure data-liner-view="out">…</figure>
        </div>
      ) : (
        <figure data-liner-view={slot[0]?.state}>…</figure>
      ))}
  </div>
  <LinerToggle … />
  …
  <table>
    <thead><tr><th>Rozmiar</th><th data-liner-col="out">Szerokość pod pachami</th><th data-liner-col="in">Z wpiętą podpinką</th>…</tr></thead>
    <tbody><tr><td>S</td><td data-liner-col="out">52 cm</td><td data-liner-col="in">50 cm</td>…</tr></tbody>
  </table>
</article>
```

- **Pair slot (gets the cross-fade).** An element whose only two element children are the `in` figure followed by the
  `out` figure. `linerSlots(images)` builds these groups from the collection's images: the n-th `in` photo pairs with
  the n-th `out` photo, in that order, at the position of whichever comes first. While the module is active the
  slot becomes `display: grid` and both figures share its one cell (`grid-area: 1 / 1`), so the slot keeps the size
  of a single photo. Style the slot like the single photo slot it replaces (in the prototype's gallery, the first
  slot is the 4:5 one).
- **Flat gallery (instant swap).** Any other arrangement also works: figures of the other state get `display: none`.
  The pairs share one aspect ratio (asset spec), so the chosen photo takes the same place. With `loading="lazy"` the
  hidden photo is fetched only on the first switch; in a pair slot both are fetched.
- A photo without `state` gets no `data-liner-view` (Astro drops the attribute when the value is `undefined`) and is
  shown in both states.
- `data-liner-col` goes on the header cell and on every body cell of the two chest columns. A frame closes at the top
  on `thead` cells and at the bottom on the last `tbody` row.
- `data-vt-product` stays on the gallery wrapper, never on a figure: the module names nothing for view transitions,
  and in a pair slot the hidden figure is transparent, not `display: none`.

## Props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `liner` | `'included' \| 'compatible' \| 'liner'` | required | The product's `liner` field. `liner` renders nothing |
| `images` | `readonly { state?: 'in' \| 'out' }[]` | required | The product's `images`; only `state` is read. Without one `in` and one `out` it renders nothing |
| `id` | `string` | `'liner'` | Prefix for the radio ids (`liner-in`, `liner-out`), the group name and the hint id |
| `initial` | `'in' \| 'out'` | `'in'` | State checked in the HTML |
| `legend` | `string` | „Pokaż kurtkę” | Visible label of the radio group |
| `inLabel`, `outLabel` | `string` | „Z podpinką”, „Bez podpinki” | Radio labels |
| `hint` | `string` | „Wybór zmienia zdjęcia w galerii i wyróżnia pasującą kolumnę w tabeli rozmiarów.” | Visually hidden description of the group (`aria-describedby`). Change it for a product without the chest-with-liner column |
| `class` | `string` | none | Extra class on the `<fieldset>` |

## Behaviour

- **No script.** Two radios and `:has()` do all of it, so JS off changes nothing. The contract's "render `hidden`,
  reveal by script" does not apply: as in hero-temp, the control is shown only under `@supports selector(:has(*))`,
  because without `:has()` it could change nothing. Every rule that hides a photo or marks a column contains `:has()`,
  so a browser without it drops them all and shows both states.
- **Inert when not rendered.** All hook rules start from a checked module radio inside the scope. The stylesheet is
  bundled on every product page that imports the module, including the liner's, and does nothing there.
- **Cross-fade (pair slots, `prefers-reduced-motion: no-preference` only).** The chosen photo moves on top
  (`z-index: 1`) and fades in over 0.4 s (`var(--ease)`); the other stays fully opaque underneath and becomes
  `visibility: hidden` when the fade ends, so the picture never dips to the background. Opacity only. A second click
  mid-fade brings the first photo straight back, because it never faded out. With reduced motion, and in flat galleries, the swap is instant.
- **Table.** Frame (2px `--petrol` inset shadows: sides, top on the header, bottom on the last row) plus a `--raised`
  ground on the chosen column and `--ink-soft` text on the other. The frame is a shape cue, so the state does not rest
  on colour; nothing changes a width, so the table does not move. Forced-colours mode uses `Highlight` instead.
- **Keyboard and screen readers.** A real `fieldset`/`legend` radio group: Tab reaches the checked radio, arrows
  switch. The focus ring (`--focus`) sits on the visible pill. Hidden photos are `display: none` or
  `visibility: hidden`, so assistive tech reads only the visible state's alt text.
- **Form state.** The radios are not in a form. A browser that restores their state on back/forward also restores
  the matching photos and column, because CSS reads the live state.

## Shared budgets and weight

- No `backdrop-filter`, no `view-transition-name`, no `startViewTransition`.
- JS: 0 bytes (the build emits no script for it). CSS: 4.3 kB minified, 0.84 kB gzipped (the module's rules cut from
  the built stylesheet).
- No layout shift: the control has a fixed height and no state-dependent size; a pair slot is one photo tall; the
  table keeps its widths.

## Checked

Headless Chromium (Playwright build 1243) over the DevTools protocol, on `/lab/liner-toggle/`:

- light and dark: initial states (`in` for the slots, `out` for the flat gallery), clicks on both labels, the right
  photos visible and the right column framed; the liner and no-pair samples render no control and keep both photos
  and an unmarked table;
- 120 ms after a click: the incoming photo at about half opacity on top, the outgoing one still opaque below; after
  0.6 s the outgoing is `visibility: hidden`;
- a second click 100 ms into the fade: the first photo is back on top at full opacity at once, and the other is
  hidden 0.4 s later;
- `--force-prefers-reduced-motion`: the swap is complete 50 ms after the click;
- page scripts disabled: clicks still switch photos and columns;
- keyboard: ArrowRight from „Z podpinką” checks „Bez podpinki” with a visible focus ring;
- forced colours (emulated): checked pill and chosen column in `Highlight`;
- 390 px wide: no horizontal scroll;
- `MONSUN_LAB=1` build, `npm run verify`, then `npm run preview`: no console errors in either theme. A deliberately
  injected inline style did log a CSP error, so the capture was live.

Not checked: Firefox, Safari, a real screen reader, real photos (none exist yet).
