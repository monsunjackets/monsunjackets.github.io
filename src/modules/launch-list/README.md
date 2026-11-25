# Module `launch-list`: the launch-list form

The `#lista` section (ADR 0001 §5, plan 0002 chunk B3). Visitors leave an e-mail address and a consent for one
message: when MONSUN launches or when the project ends. The browser posts the form straight to a Google Form owned
by the team account, so the address never passes through this site, its code or its repository.

## Use

```astro
---
import LaunchList from '../modules/launch-list/index.astro';
---
<LaunchList source="podpinka" />
```

- Place it **once per page**: the section is `id="lista"` (the header CTA and in-page links target it), and the
  inputs have fixed ids.
- `source` names the page and goes to the Form's `zrodlo` field. Lower-case ASCII, digits and `. _ - /`, at most
  60 characters, e.g. `home`, `podpinka`, `kolekcja/<slug>`, `blog/<slug>`. Anything else fails the build.
- Optional `class` is added to the section.

## States

Everything comes from `src/config/site.ts`; the page passes nothing else.

| `site.form` | Renders | Script |
|---|---|---|
| `null` | „Lista startowa ruszy wkrótce” and one paragraph; no inputs, no links | none |
| `mode: 'post'` | `<form method="post">` to the Form's `formResponse`: e-mail (`type=email`, required, `autocomplete=email`), the consent checkbox (required, its value and its visible label are both `consentValue`), hidden `zrodlo`; the privacy summary | ~0.9 kB |
| `mode: 'link'` | a button-link to the Form's `viewform` page with `zrodlo` pre-filled (Google's `usp=pp_url`); the privacy summary | same script |

With a form configured, `form-config.ts` checks the settings at build time and fails with every problem listed:
the action must be `https://docs.google.com/forms/…` with no query string or fragment (a whole pre-filled link
pasted there would post the owner's test answers with every sign-up); `post` needs `…/formResponse`; `link` takes
`…/viewform` or `…/formResponse` (so the fallback is the one-line change `mode: 'link'`); entries look like
`entry.123`; the consent text has no surrounding spaces; `contactEmail` is set, because the privacy summary must
name the controller's contact; `launchList.deleteBy` is a real `YYYY-MM-DD` day. A test runs the same check on the
committed config, so `npm test` catches it too.

The privacy summary (controller with the contact address, purpose, basis art. 6(1)(a) RODO with withdrawal by
e-mail, recipient Google Ireland Ltd with transfers under the EU–US Data Privacy Framework, deletion date) links to
`/prywatnosc/`. verify-dist fails on a link to a page that is not in the build, so the form cannot go live without
the privacy page.

## What the page knows after a submit: nothing, so it claims nothing

A cross-origin POST gives the page no reliable success signal: with a normal navigation the page is gone, a hidden
`iframe` target would need `frame-src` for Google and its `load` event fires for errors too, and
`fetch(…, {mode: 'no-cors'})` returns an opaque response whether the row was written or not (ADR §5 rejects it).
So the form submits normally, in the same tab, and **the only confirmation is Google's own page**, rendered by the
party that actually stored the answer. If Google rejects the answer, the visitor sees Google's error instead. The
note under the button says this before the click: „Wysłanie przeniesie Cię do Formularzy Google, które potwierdzą
zapis.” The site never shows „Zapisano” or similar. Sign-ups are counted from the Sheet (ADR decision 9).

## Script (progressive enhancement)

Without JS the form works and `zrodlo` is the page's `source`. With JS:

- **Campaign.** `utm_source` and `utm_medium` from the page URL are appended as a query:
  `podpinka?utm_source=poster&utm_medium=qr`. A value is kept only if, trimmed and lower-cased, it is 1–30
  characters of `a-z 0-9 . _ -`; anything else is dropped whole, never trimmed down, so an address pasted into a
  link (`utm_source=jan@example.com`) cannot reach the Sheet. Nothing is stored in the browser: the campaign counts
  only on the page where the visitor signs up (storing it across pages would need consent). In link mode the
  pre-filled `zrodlo` in the button's URL gets the same value.
- **`monsun:lead`.** On `submit` (which fires only after the browser's validation passed: address and consent
  given) the module dispatches `CustomEvent('monsun:lead', {detail: {source}})` on `document` and does not prevent
  the submit. `detail.source` is the page's `source` without the campaign: GA4 attributes campaigns itself, and an
  event parameter is capped at 100 characters. It means "a valid form was sent", not "a row was written". Listener
  errors do not stop the submit (DOM events report them, they do not throw into the dispatcher). Link mode
  dispatches nothing: a click on a link is not a sign-up.
- **Repeat submits.** A second submit within 5 s (a double click while Google's page loads) is prevented and
  dispatches nothing, so the Sheet does not get two rows. Returning through the back/forward cache resets it.
- No `fetch`, no storage, no request of its own; the only network traffic is the browser's form POST or the link.

## Files

| File | Role |
|---|---|
| `index.astro` | The import surface. Props `source`, `class`; reads the site config |
| `LaunchListView.astro` | Markup, styles and the processed `<script>` for explicit settings (used by the demos) |
| `form-config.ts` | `launchListState()`: which state to render and the build-time checks; `formLink()` |
| `source.ts` | `checkSource()`, `utmValue()`, `sourceWithUtm()`: the `zrodlo` value |
| `*.test.ts` | `node:test`; run with `scripts/dock npm test` |
| `lab-settings.ts`, `demo*.astro` | Lab demos with made-up settings |

## Lab

`/lab/launch-list/` (form), `/lab/launch-list/link/` (fallback), `/lab/launch-list/soon/` (no form), in dev or a
build with `MONSUN_LAB=1`. The form demo holds the submit by default and prints the fields it would post and the
`monsun:lead` detail; it links to URLs with a campaign and with an e-mail in `utm_source`. Unticked, it really
posts to a made-up Form id (Google answers 404), so type test addresses only. Until `/prywatnosc/` exists,
`MONSUN_LAB=1 npm run verify` reports it as a missing target on the two demos that show the privacy summary.

## Google Form setup this module expects (plan O6)

- E-mail as a **required short-answer question** with e-mail validation, not "Collect email addresses" (that forces
  a Google sign-in); no "Limit to 1 response" (also a sign-in).
- A **required checkbox question with one option**; its exact text goes to `consentValue` and is shown on the site
  as the checkbox label, so what the visitor ticks is what the Sheet records. Suggested text: „Zgadzam się, by
  zespół MONSUN wysłał mi jeden e-mail o starcie marki albo o zakończeniu projektu.”
- A short answer `zrodlo`, not required.
- A custom Polish confirmation message with a link back to `https://monsunjackets.github.io/`.

## Checking the real Form (before launch, then weekly)

1. Fill `site.form` from the owner's pre-filled link `…/viewform?usp=pp_url&entry.A=…&entry.B=…&entry.C=…`:
   `action` is the same URL up to `/viewform` with that part replaced by `/formResponse`, the three `entry.*` ids,
   and `consentValue` copied from the Form editor (not from the URL, where it is encoded).
2. `scripts/dock npm test`, `npm run build`, `npm run verify` (needs `/prywatnosc/` in the build).
3. `npm run preview`, open `/?utm_source=test&utm_medium=manual#lista`. In DevTools the hidden field reads
   `home?utm_source=test&utm_medium=manual`.
4. Submit a team test address with the box ticked. Expected: Google's confirmation page with the custom Polish
   message and the link back.
5. In the Sheet: a new row with the timestamp, the address, the consent text and that `zrodlo`.
6. Without the box ticked, or with an invalid address, the browser stops the submit. With JavaScript disabled, a
   submit gives a row with `zrodlo` = `home`.
7. With the consent module merged: accept analytics, submit, and `generate_lead` shows in GA4 Realtime/DebugView;
   after rejecting, the form POST is the only request to Google.
8. Delete the test rows (they hold an address).

If Google shows an error or the row lacks a column: compare `consentValue` with the option text character by
character, check the `entry.*` ids and the sign-in settings, and compare with what Google's own form posts (DevTools
→ Network on the `viewform` page). If it still fails, set `mode: 'link'` and report it.
