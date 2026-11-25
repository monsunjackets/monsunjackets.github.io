// consent: GA4 behind a consent bar, in Consent Mode basic (ADR 0001 §6). Nothing from Google loads before the
// visitor accepts: this module injects gtag.js after „Akceptuj”, and the page has no inline gtag snippet.
// The helpers at the top are pure and tested with node:test (consent.test.ts); initConsent wires them to the page.

/** localStorage key of the stored choice (frozen hook, src/modules/README.md). */
export const STORAGE_KEY = 'monsun-consent';
export const CONSENT_VERSION = 1;

/** The stored choice: `{v: 1, analytics, at}`. */
export interface ConsentRecord {
  v: typeof CONSENT_VERSION;
  analytics: boolean;
  /** When the choice was made, ISO 8601. */
  at: string;
}

const MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

/** A GA4 measurement id as GA4 shows it: "G-" followed by capital letters and digits. */
export function isMeasurementId(value: string): boolean {
  return MEASUREMENT_ID.test(value);
}

/**
 * The stored choice, or null when there is none to honour: missing, not JSON, another version or malformed.
 * Null makes the bar ask again, so a value this code does not understand never counts as consent.
 */
export function parseConsent(raw: string | null): ConsentRecord | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { v, analytics, at } = value as Record<string, unknown>;
  if (v !== CONSENT_VERSION || typeof analytics !== 'boolean') return null;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  return { v: CONSENT_VERSION, analytics, at };
}

export function serializeConsent(analytics: boolean, now: Date): string {
  const record: ConsentRecord = { v: CONSENT_VERSION, analytics, at: now.toISOString() };
  return JSON.stringify(record);
}

/** Whether the bar opens by itself when a page loads: only while there is no valid stored choice. */
export function showBarOnLoad(stored: ConsentRecord | null): boolean {
  return stored === null;
}

/** The cookies GA4 sets for this measurement id: `_ga` and `_ga_<id without "G-">`. */
export function gaCookieNames(ga4Id: string): string[] {
  return ['_ga', `_ga_${ga4Id.replace(/^G-/, '')}`];
}

/**
 * `document.cookie` assignments that delete the GA4 cookies. Each name is expired twice: host-only, and on the
 * host's domain, where GA4's automatic cookie domain puts them (`.monsunjackets.github.io` on the live site).
 */
export function expiredCookies(ga4Id: string, hostname: string): string[] {
  return gaCookieNames(ga4Id).flatMap((name) => [
    `${name}=; Max-Age=0; Path=/`,
    `${name}=; Max-Age=0; Path=/; Domain=.${hostname}`,
  ]);
}

export function tagUrl(ga4Id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
}

/**
 * Wires the bar (`[data-consent]`, rendered `hidden`) to the page: shows it while no choice is stored, loads GA4
 * after „Akceptuj”, reopens it from any `[data-consent-open]`, handles withdrawal and sends `generate_lead`.
 */
export function initConsent(bar: HTMLElement): void {
  const id = bar.dataset.ga4Id;
  const accept = bar.querySelector<HTMLButtonElement>('[data-consent-choice="accept"]');
  const reject = bar.querySelector<HTMLButtonElement>('[data-consent-choice="reject"]');
  if (!id || !isMeasurementId(id) || !accept || !reject) return;

  const page = window as Window & { dataLayer?: unknown[] };
  // gtag.js reads each queued command as the Arguments object of this call; a pushed array would be ignored.
  const gtag = function (..._command: unknown[]): void {
    (page.dataLayer ??= []).push(arguments);
  };

  /** True once GA4 runs in this page view, which happens only after consent; withdrawal reloads the page. */
  let granted = false;
  let opener: HTMLElement | null = null;

  const loadTag = (): void => {
    if (granted) return;
    granted = true;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('js', new Date());
    gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = tagUrl(id);
    document.head.append(script);
  };

  const show = (focus: boolean): void => {
    bar.hidden = false;
    if (focus) bar.focus({ preventScroll: true });
  };
  const hide = (): void => {
    const hadFocus = bar.contains(document.activeElement);
    bar.hidden = true;
    if (hadFocus) opener?.focus();
    opener = null;
  };

  const choose = (analytics: boolean): void => {
    const withdrawing = !analytics && granted;
    store(serializeConsent(analytics, new Date()));
    hide();
    if (analytics) {
      loadTag();
      return;
    }
    if (withdrawing) {
      // Stop the running tag first, so nothing it sends while the page unloads writes the cookies again.
      Object.assign(page, { [`ga-disable-${id}`]: true }); // GA's documented opt-out switch
      gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    for (const cookie of expiredCookies(id, location.hostname)) document.cookie = cookie;
    if (withdrawing) location.reload();
  };

  accept.addEventListener('click', () => choose(true));
  reject.addEventListener('click', () => choose(false));

  for (const trigger of document.querySelectorAll<HTMLElement>('[data-consent-open][hidden]')) trigger.hidden = false;
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-consent-open]') : null;
    if (!trigger) return;
    event.preventDefault();
    opener = trigger;
    show(true);
  });

  // The launch-list form submits on its own; this listener only queues the event and never cancels anything.
  document.addEventListener('monsun:lead', () => {
    if (granted) gtag('event', 'generate_lead', { transport_type: 'beacon' });
  });

  const stored = load();
  if (stored?.analytics) loadTag();
  if (showBarOnLoad(stored)) show(false);
}

function load(): ConsentRecord | null {
  try {
    return parseConsent(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked: no stored choice, so the bar asks on every page
  }
}

function store(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // A failed write must not leave an older „Akceptuj” in place.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked: the choice holds for this page view only
    }
  }
}
