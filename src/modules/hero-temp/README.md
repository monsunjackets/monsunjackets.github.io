# Module `hero-temp`: the liner zipping in

Date: 2026-11-24
Status: accepted (gate H, 24 Nov 2026)
Author: Miłosz Lewandowski + Claude
Related to: `BRIEF.md` (this folder); ADR 0001 §4 (module contract)

---

## The idea

The hero shows a drawn jacket, open, so the visitor looks at its inside and at the zip that runs along the front
edge. Pressing −10°C sends a saffron zip pull from the hem up to the collar, and the quilted petrol liner fills the
jacket behind it; +15°C runs the pull back down and the jacket is empty again. The drawing uses the logo's
language (flat shapes, quilt pattern, dashed zip), so it needs no photo and follows both themes through the tokens.

This replaces the prototype's two photos and the frosted pane. The winter and spring photos are no longer used in
the hero and are free for other pages.

## Files

| File | Role |
|---|---|
| `index.astro` | The import surface: markup, `Props`, and the processed `<script>` |
| `hero-temp.css` | All styles. Global on purpose (every class is prefixed `ht-`), imported by `index.astro` and linked by `demo.html` |
| `hero-temp.ts` | `initHeroTemp(root)`: announcement and the pointer control on the zip pull |
| `demo.html` | Standalone demo, opens from disk with no build |
| `demo.build.mjs` | Rewrites the module markup and script inside `demo.html` from `index.astro` and `hero-temp.ts`. Run `node demo.build.mjs` after changing either (Node built-ins only, no npm) |
| `shots/` | Both states in both themes, a part-way frame, the `ink` tone, and a 390 px phone view |

Integration: copy `index.astro`, `hero-temp.css` and `hero-temp.ts` to `site/src/modules/hero-temp/`.

```astro
---
import HeroTemp from '../modules/hero-temp/index.astro';
---
<HeroTemp />
```

The module contains its own switch, readout and caption. The page places it as one block (in the prototype's hero,
the right-hand column) and should drop the prototype's separate `<fieldset class="temp">` from the copy column.

## Props

All optional. Defaults are the Polish copy from the prototype.

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `id` | `string` | `'temp'` | Prefix for the radio ids (`temp-cold`, `temp-warm`), the group name and the SVG pattern ids. Must be unique on the page |
| `initial` | `'cold' \| 'warm'` | `'cold'` | State rendered before any interaction |
| `tone` | `'cognac' \| 'ink'` | `'cognac'` | Colour of the drawn jacket. `ink` is a dark jacket in the light theme and a pale one in the dark theme |
| `legend` | `string` | „Ta sama kurtka w dwóch porach roku” | Visible label of the radio group |
| `coldLabel`, `warmLabel` | `string` | „−10°C”, „+15°C” | Radio labels and the readout |
| `captionCold`, `captionWarm` | `string` | „Styczeń. Podpinka wpięta.”, „Kwiecień. Ta sama kurtka, podpinka wypięta.” | Caption under the drawing; also the announced text |
| `altCold`, `altWarm` | `string` | see `index.astro` | Text alternative of the drawing in each state |
| `aiLabel` | `string` | „Ilustracja przygotowana z AI” | Disclosure next to the caption |
| `class` | `string` | none | Extra class on the root `<figure>` |

## Behaviour without JS

Everything works, including the animation. The switch is two radios, and
`.hero-temp:has(.ht-radio--warm:checked)` sets one custom property, `--ht-p` (1 = liner in, 0 = liner out). The
liner's `clip-path`, the pull's `transform`, the readout and the caption all follow from it in CSS. Both captions,
both text alternatives and both readouts are in the DOM; the inactive ones are `display: none` or transparent.

The script adds two things:

1. **Announcement.** On `change` it copies the visible caption into a visually hidden `aria-live="polite"`
   paragraph, which is empty until the first change.
2. **The zip pull as a pointer control.** A click on the pull toggles the state. Dragging it moves the liner with
   the pointer, and on release the nearer state wins: the script checks that radio and CSS finishes the motion. The
   pull is part of the drawing and is always visible; the script only makes it react (`is-enhanced`), so no control
   is rendered `hidden`. Keyboard and screen-reader users have the radios, and the pull is `aria-hidden` with the
   rest of the drawing.

During a drag the script writes `--ht-p` with `element.style.setProperty`. That is a CSSOM write, which a
hash-based `style-src` does not block (the directive covers `style="…"` in markup and `<style>` elements). Worth one
look in the console when CSP is checked with `astro preview`.

Browsers without `:has()` (Firefox before 121, Safari before 15.4) keep the cold state: the cold rules are written
without `:has()`, the switch is hidden (`@supports not selector(:has(*))`) and the script does nothing.

## Motion timeline

One transition, 950 ms, `var(--ease)`, the same in both directions. It starts from wherever the pull is, so a
released drag, a quick second press or a pull grabbed in mid-travel does not jump.

| Element | Property | −10°C | +15°C |
|---|---|---|---|
| Zip pull (`.ht-pull`) | `transform` | at the collar | at the hem, tab hanging below it |
| Liner (`.ht-liner`) | `clip-path` (polygon) | fully uncovered | covered; the uncovering edge leans so the zip side leads by about a fifth of the jacket's height |
| Readout (`.ht-readout`) | `font-stretch`, `font-weight` | 75%, 800 | 118%, 300 |
| Readout texts | `opacity`, 400 ms | „−10°C” visible | „+15°C” visible |

- `font-stretch`/`font-weight` on the readout is the documented exception from ADR 0001 §4.6. It changes the width
  of the readout chip, which is absolutely positioned over the stage, so nothing else moves.
- All transitions sit inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion the switch is
  instant, and dragging the pull does not scrub: a drag up selects −10°C, a drag down +15°C.
- There is no entrance animation and nothing moves until the visitor acts.

## Shared budgets

- **`backdrop-filter`: given up.** The module does not use it, so the site currently has none.
- **`view-transition-name: hero-photo`: not declared.** The motion is a CSS transition on the module's own
  elements, and wrapping it in `document.startViewTransition` would cross-fade over the zip. The name stays
  reserved for this module; `page-transitions` can note it as unused.
- This differs from the `hero-temp` row in ADR 0001 §4 (two `<picture>`s, the pane, `startViewTransition`). The
  row should be updated if this direction is accepted.

## Weight

Measured on the files in this folder (gzip, level 6):

| Part | Raw | Gzipped |
|---|---|---|
| Script (`hero-temp.ts` with types stripped, unminified) | 4.0 kB | 1.6 kB |
| Styles (`hero-temp.css`) | 6.5 kB | 2.2 kB |
| Markup with the four inline SVG layers | 4.3 kB | 1.5 kB |
| Images | 0 | 0 |

- The hero loads no image, so there is nothing to lazy-load or make responsive, and the drawing is in the first
  HTML response.
- No layout shift: the stage reserves `aspect-ratio: 4 / 5`, and the two captions and the two readouts each share
  one grid cell, so the longer text reserves the space in both states.
- No long task was recorded in headless Chromium during a click and a drag (the script does a few DOM reads on
  `pointerdown` and one property write per `pointermove`).

## Checked

In headless Chromium (Playwright's build 1243), through the DevTools protocol and screenshots:

- both states in both themes, at 1280 px and 390 px;
- with every script removed and the warm radio pre-checked: the warm state renders complete;
- with `--force-prefers-reduced-motion`: the switch still changes state;
- a click on the pull toggles the state, a drag to 60% scrubs the liner and settles on −10°C, and the live region
  receives the caption each time.

Not checked: Firefox and Safari, a real touch screen and a screen reader. Since the port into `site/` (24 Nov) the
component compiles with `astro check`/`tsc` and builds; the original note follows. The component
was written against Astro conventions but never compiled, because `npm` must not run on this machine. The lead
session should run `astro check` and a build in the container.

## Assets

None are needed. If the team later wants a photographic version of the same interaction, it takes two images in
exact registration, and the same CSS drives them (liner image in `.ht-liner`, shell image below it):

- **Shell.** Flat lay, camera straight above, a leather jacket lying open with both front edges folded back so the
  inside back and the zip along the front edge are visible, plain lining, no liner. 1600 × 2000 px (4:5), the jacket
  filling about 85% of the width, even soft light, plain background in mist `#D9E2DF`, WebP at quality 80 plus an
  AVIF, under 150 kB each.
- **Liner in.** The same image edited, not generated again, so nothing shifts: "Edit this photo. Keep the jacket,
  the framing, the light and the background exactly as they are. Add a quilted petrol-blue (#1F5562) zip-in liner
  with a diamond pattern and a ribbed collar, covering the whole inside of the jacket and attached by the zip along
  both front edges. Change nothing else."
- Both would need the „Ilustracja przygotowana z AI” caption and a row in the AI-use log.

## Known limits

- **Global stylesheet.** ADR 0001 §4 says component styles become scoped Astro styles. This module imports a global
  stylesheet with `ht-` prefixed classes, so that `demo.html` can link the same file. The ADR owner should accept
  that or ask for it to be moved into a scoped `<style>`.
- **Page gutter.** The readout hangs `1rem` to the left of the stage, as in the prototype, so the host container
  needs at least a `1rem` side gutter or phones will scroll sideways. The module also caps itself at 420 px below
  860 px, copying the prototype's hero breakpoint; if the page's grid changes, move that cap to the page.
- **Focus ring contrast.** Fixed after review G2: the ring uses the `--focus` token (ink in the light theme, 12.4:1;
  saffron in the dark theme, 7.4:1). The saffron ring was 1.8:1 on the light canvas.

- **Jacket colour.** The default drawing is cognac, while the AI photos elsewhere show a black jacket. Cognac was
  chosen because it stays a leather colour in both themes; `tone="ink"` gives a dark jacket in the light theme but a
  pale one in the dark theme (see `shots/light-minus10-atrament.png`). No token is dark in both themes, and the
  contract forbids new colours.
- **The drawing is a schematic.** One pull, a straight zip, a symmetrical jacket. It shows the mechanism, not a
  specific model.
- **„Ilustracja przygotowana z AI”.** The drawing was made with Claude, so the caption stays and the module needs a row in the
  AI-use log (report section 8).
- **Saffron.** The pull is the second saffron element on the screen next to the sign-up button, against the
  prototype's "saffron once per screen" principle. It matches the theme zip, whose pull is also saffron when the
  liner is in.
- **Pattern ids.** The quilt patterns use `${id}-quilt` and `${id}-rib`, so two instances on one page need different
  `id` props.
- **Geometry is coupled in three places.** The zip's start and end in the SVG, the percentages in `.ht-pull` and
  `.ht-liner`, and `TRAVEL` in `hero-temp.ts` must change together.
