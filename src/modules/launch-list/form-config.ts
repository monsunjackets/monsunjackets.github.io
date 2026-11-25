// Which launch-list section a page gets, decided from the site config at build time (ADR 0001 §5, plan 0002 B3).
//
// Contract:
// - No form configured: "soon", the section without inputs. Contact and deletion date are not read.
// - A form configured: its settings are checked and every problem is reported in one error, so a mistake in
//   src/config/site.ts fails the build instead of shipping a form that silently loses sign-ups:
//   - action is an https://docs.google.com/forms/… URL with no query string or fragment (a whole pre-filled link
//     pasted here would post the owner's test answers with every sign-up);
//   - mode "post" needs the …/formResponse URL; mode "link" takes …/viewform, or …/formResponse and links to the
//     matching …/viewform, so falling back from "post" to "link" is the one-line change ADR §5 promises;
//   - the three entries look like "entry.123" and differ; the consent value is the option's exact text;
//   - contactEmail is set, because the privacy summary next to the form must name the controller's contact;
//   - deleteBy is a YYYY-MM-DD date.
// - formLink() builds the link-mode URL, pre-filling the source field (Google's usp=pp_url parameters).
// No astro:* imports: Node runs the tests directly.
import type { FormConfig } from '../../config/site.ts';
import { polishDate } from '../../lib/dates.ts';

export interface LaunchListInput {
  form: FormConfig | null;
  contactEmail: string | null;
  deleteBy: string;
}

interface Ready {
  entries: FormConfig['entries'];
  contactEmail: string;
  /** `iso` for the datetime attribute, `text` for people: "28 lutego 2027". */
  deleteBy: { iso: string; text: string };
}

export type LaunchListState =
  | { kind: 'soon' }
  | (Ready & { kind: 'post'; action: string; consentValue: string })
  | (Ready & { kind: 'link'; viewUrl: string });

const ENTRY = /^entry\.\d+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function formUrl(action: string, problems: string[]): URL | null {
  let url: URL;
  try {
    url = new URL(action);
  } catch {
    problems.push(`form.action ${JSON.stringify(action)} is not a URL`);
    return null;
  }
  if (url.protocol !== 'https:' || url.host !== 'docs.google.com' || url.username !== '' || url.password !== ''
    || !url.pathname.startsWith('/forms/')) {
    problems.push(`form.action ${JSON.stringify(action)} is not a Google Forms URL on https://docs.google.com/forms/`);
    return null;
  }
  if (url.search !== '' || url.hash !== '') {
    problems.push('form.action must end at /formResponse or /viewform, without "?…" or "#…"');
    return null;
  }
  return url;
}

export function launchListState({ form, contactEmail, deleteBy }: LaunchListInput): LaunchListState {
  if (form === null) return { kind: 'soon' };
  const problems: string[] = [];

  const url = formUrl(form.action, problems);
  let target = '';
  if (url && form.mode === 'post') {
    if (url.pathname.endsWith('/formResponse')) target = url.href;
    else problems.push('form.action for mode "post" must end in /formResponse (a pre-filled link ends in /viewform: swap that part)');
  } else if (url && form.mode === 'link') {
    if (url.pathname.endsWith('/viewform')) target = url.href;
    else if (url.pathname.endsWith('/formResponse')) target = url.href.replace(/\/formResponse$/, '/viewform');
    else problems.push('form.action for mode "link" must end in /viewform or /formResponse');
  } else if (url) {
    problems.push(`form.mode must be "post" or "link", got ${JSON.stringify(form.mode)}`);
  }

  for (const key of ['email', 'consent', 'source'] as const) {
    if (!ENTRY.test(form.entries[key])) {
      problems.push(`form.entries.${key} ${JSON.stringify(form.entries[key])} does not look like "entry.123456789"`);
    }
  }
  if (new Set(Object.values(form.entries)).size !== 3) problems.push('form.entries must name three different fields');

  if (form.consentValue.trim() === '' || form.consentValue !== form.consentValue.trim()) {
    problems.push('form.consentValue must be the consent option\'s exact text, not empty and without surrounding spaces');
  }

  if (contactEmail === null) {
    problems.push('contactEmail is null: the privacy summary next to the form must name the controller\'s contact');
  } else if (!EMAIL.test(contactEmail)) {
    problems.push(`contactEmail ${JSON.stringify(contactEmail)} is not an e-mail address`);
  }

  let deleteByText = '';
  if (!DATE_ONLY.test(deleteBy)) problems.push(`launchList.deleteBy ${JSON.stringify(deleteBy)} is not a YYYY-MM-DD date`);
  else {
    try {
      deleteByText = polishDate(deleteBy);
    } catch (error) {
      problems.push(`launchList.deleteBy: ${(error as Error).message}`);
    }
  }

  if (problems.length > 0) {
    throw new TypeError(`launch-list: the form settings in src/config/site.ts are not usable:\n- ${problems.join('\n- ')}`);
  }
  const ready: Ready = {
    entries: form.entries,
    contactEmail: contactEmail!,
    deleteBy: { iso: deleteBy, text: deleteByText },
  };
  return form.mode === 'post'
    ? { ...ready, kind: 'post', action: target, consentValue: form.consentValue }
    : { ...ready, kind: 'link', viewUrl: target };
}

/** The Form's own page with the source field filled in, e.g. "…/viewform?usp=pp_url&entry.3=podpinka". */
export function formLink(viewUrl: string, sourceEntry: string, source: string): string {
  const url = new URL(viewUrl);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(sourceEntry, source);
  return url.href;
}
