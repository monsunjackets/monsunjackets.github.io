# Module `consent`: the cookie bar and GA4

Date: 2026-11-25
Status: proposed (chunk B2)
Author: Miłosz Lewandowski + Claude
Related to: ADR 0001 §6 (consent and GA4), §9 (CSP) and the G1 amendment; `src/lib/csp.ts`; research
`site-benchmark.md` §4 item 3 (Consent Mode basic, art. 399–400 PKE)

---

## What it does

GA4 in Consent Mode **basic**: nothing from Google loads until the visitor presses „Akceptuj”. The module renders a
bar at the bottom of the page with „Akceptuj” and „Odrzuć” (the same button, in two equal columns), stores the
choice, loads gtag.js only after consent, reopens from the footer, and withdraws consent by deleting the GA4 cookies
and reloading. There is no inline gtag snippet: the bootstrap is in `consent.ts`, a processed module script.

While `site.ga4Id` is `null` the module renders **nothing**: no bar, no script tag, no Google origin in the CSP.

## Files

| File | Role |
|---|---|
| `index.astro` | The import surface: the bar markup (rendered `hidden`), `Props`, the scoped styles and the processed `<script>` |
| `consent.ts` | Pure helpers (parse and serialise `monsun-consent`, the show-the-bar decision, GA4 cookie names, the tag URL) and `initConsent(bar)`, which wires them to the page |
| `consent.test.ts` | `node:test` tests of the pure helpers |
| `demo.astro` | `/lab/consent/`: the module with the test id `G-TEST000000` and a panel showing storage, cookies, the gtag queue, cross-origin fetches and CSP violations |

`tests/csp.test.ts` covers the GA4 part of `src/lib/csp.ts`.

## Props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `ga4Id` | `string \| null` | required | `site.ga4Id`. `null`: render nothing. A value that is not `G-` plus capitals or digits fails the build |
| `privacyHref` | `string` | `'/prywatnosc/'` | The privacy page linked from the bar. The demo passes `/` because `/prywatnosc/` is built by B5 |

## Placement (M6)

Once, as the last child of `<body>` in `src/layouts/Base.astro`, after `<Footer />`. The bar is `position: sticky;
bottom: 0`, so it rides on the bottom edge while the page scrolls and settles below the footer at the end, never
covering the last of the content. One module per page: the script wires the first `[data-consent]` only.

```astro
<Footer />
<Consent ga4Id={site.ga4Id} />
```

## Behaviour

| Situation | What happens |
|---|---|
| `ga4Id` is `null` | Nothing is rendered |
| JS off | The bar stays `hidden`; GA4 never loads |
| First visit (no valid `monsun-consent`) | The bar shows without taking focus; no request to Google |
| „Akceptuj” | Stores `{v: 1, analytics: true, at}`; queues `consent default` (`analytics_storage: granted`, `ad_storage`, `ad_user_data`, `ad_personalization`: `denied`), `js`, `config` with `allow_google_signals: false` and `allow_ad_personalization_signals: false`; then injects `https://www.googletagmanager.com/gtag/js?id=…` |
| „Odrzuć” | Stores `{v: 1, analytics: false, at}` and expires any GA4 cookies; the tag is never loaded |
| Return visit | Accepted: the tag loads, no bar. Rejected: nothing loads, no bar |
| `[data-consent-open]` clicked | Opens the bar and moves focus to it; after a choice focus returns to the opener. Any `[data-consent-open][hidden]` is revealed by the script |
| Withdrawal („Odrzuć” after „Akceptuj”) | Stores the refusal, sets `window['ga-disable-<id>']` and `consent update analytics_storage: denied` (so nothing the running tag sends while unloading rewrites a cookie), expires `_ga` and `_ga_<id without "G-">` host-only and on `.<hostname>` (`.monsunjackets.github.io` live), then reloads |
| `monsun:lead` on `document` | With consent in this page view: queues `event generate_lead` with `transport_type: 'beacon'`. Otherwise nothing. The listener never cancels or delays the form submission |
| Stored value corrupt, of another version, or malformed | Treated as no choice: the bar asks again. Such a value never counts as consent |
| `localStorage` blocked | No stored choice, so the bar asks on every page; a failed write removes any older value, so an old „Akceptuj” cannot outlive a refusal |

Not used, on purpose (ADR §6): advanced Consent Mode, Google signals, enhanced conversions, user-ID, ads tags.

## Hooks

| Hook | Use here |
|---|---|
| `[data-consent-open]` | Footer control that reopens the bar |
| `monsun:lead` | Sent by the launch-list form; triggers `generate_lead` |
| `monsun-consent` | `localStorage` JSON `{v: 1, analytics, at}` |

## CSP (`src/lib/csp.ts`)

The GA4 origins are in the site policy exactly when `site.ga4Id` is set, so verify-dist and the build always agree:

| Directive | Added with GA4 |
|---|---|
| `script-src` | `https://www.googletagmanager.com` |
| `img-src` | `https://*.google-analytics.com https://www.googletagmanager.com` |
| `connect-src` | `https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com` |

`https://www.googletagmanager.com` alone replaces the `*.googletagmanager.com` wildcard of Google's CSP guide. Tested
on 25 Nov 2026 in headless Edge against a `MONSUN_LAB=1` build of `/lab/consent/` with the GA4 origins switched on:
after „Akceptuj” the page fetched `www.googletagmanager.com/gtag/js` and `region1.google-analytics.com/g/collect`
and reported no CSP violation, on the first and on a return visit. gtag.js itself names no other
googletagmanager.com host. `doubleclick.net` and `www.google.com` stay out because Google signals are off.

**Checking the test id under CSP before the real id exists.** Lab builds use the site policy, which has no Google
origin while `ga4Id` is null, so on `/lab/consent/` „Akceptuj” is blocked with a `script-src-elem` violation for
gtag.js and no cookie is set (checked in the same headless run; correct for the shipped policy). Chrome still lists
the blocked load in Resource Timing, so read the panel's „Inne domeny” row together with its CSP row. To try the GA4 path, change the last line of `src/lib/csp.ts` to
`buildCsp(true)` **locally**, then `MONSUN_LAB=1 scripts/dock npm run build`, `MONSUN_LAB=1 scripts/dock npm run
verify` and `PORT=… MONSUN_LAB=1 scripts/dock npm run preview`; revert before committing. In `astro dev` (no CSP)
the demo works as is.

For headless runs the demo takes `?lab=` with steps run in order after load: `open` (clicks the footer's
`[data-consent-open]`, else the demo's), `accept`, `reject`, `lead` (sends `monsun:lead` 1.5 s later), e.g.
`?lab=accept,lead` or `?lab=open,reject`. It drops the parameter first, so a withdrawal's reload does not repeat the
steps; the panel shows the result, which `msedge --headless --dump-dom` (or Chrome) can read.

## Browser checks (build plus preview, CSP on)

Run on a real page once the module is placed and `ga4Id` is set, in a fresh browser profile, with DevTools open
(Network filtered on `google`, Application → Cookies and Local Storage, Console).

1. **Before consent:** load any page. The bar is visible; Network shows no request to any Google host; no `_ga`
   cookie; Console shows no CSP error.
2. **Accept:** „Akceptuj”. The bar hides; Network shows `www.googletagmanager.com/gtag/js?id=G-…` and a
   `…google-analytics.com/g/collect` hit with `en=page_view`; cookies `_ga` and `_ga_<id>` appear; `monsun-consent`
   is `{"v":1,"analytics":true,…}`; no CSP error; no request to `doubleclick.net` or `www.google.com`.
3. **Return visit:** open another page. No bar; the tag loads again.
4. **Lead:** submit the launch-list form (or dispatch `monsun:lead`). A `g/collect` hit with `en=generate_lead`
   goes out (Preserve log on, since the form navigates away); the form still submits.
5. **Withdraw:** footer „Zmień zgodę na cookies” → „Odrzuć”. The page reloads; `_ga` and `_ga_<id>` are gone;
   `monsun-consent` is `analytics:false`; after the reload, no Google request.
6. **Reject on a fresh profile:** „Odrzuć” on the first visit, browse two pages and submit the form. No Google
   request at any point, no `_ga` cookie.
7. **JS off:** no bar, no Google request.
8. **Keyboard:** Tab reaches both buttons; the footer control moves focus to the bar and focus returns after a
   choice; both themes and a 390 px width keep both buttons the same size.
9. **GA4 Realtime** (owner): after step 2 the visit shows up in Realtime for the property.

Already run in headless Edge against the lab demo with the test id (bar state, storage, cookies, gtag queue,
cross-origin loads, CSP violations): steps 1, 2, 3 and 5; step 6 on one page followed by a `monsun:lead`; step 4 up
to the queued `generate_lead` command (the hit itself was not inspected). A second round ran with the proposed
Footer and Base changes applied locally and the test id in `site.ts`: one bar per page after the footer, the
footer's „Zmień zgodę na cookies” revealed by the module, `?lab=open` showing the bar and `?lab=open,reject`
withdrawing (cookies gone, page reloaded, no Google request afterwards). JS off could not be run that way
(`--dump-dom` returns nothing with scripting disabled); the served HTML has the bar `hidden` and no Google URL.
Steps 4 (the hit), 7, 8 and 9 need a person.
