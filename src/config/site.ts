// Site-wide settings (plan 0002, M5a). Keep this file free of imports: src/lib/csp.ts imports it, and the CI
// verify job runs that with plain Node and no node_modules. Values that are not set yet are null, and every component that reads
// them renders a safe "not yet" state: no consent bar and no GA4 without ga4Id, no form without form.

export interface FormConfig {
  /** 'post' submits the on-site form to Google Forms; 'link' only links to the Form. */
  mode: 'post' | 'link';
  /** formResponse URL (mode 'post') or the public Form URL (mode 'link'). */
  action: string;
  /** Google Form field ids, e.g. 'entry.123456'. */
  entries: { email: string; consent: string; source: string };
  /** The exact text of the single consent checkbox option. */
  consentValue: string;
}

export interface SiteConfig {
  url: string;
  ga4Id: string | null;
  form: FormConfig | null;
  contactEmail: string | null;
  /** Search Console HTML-tag verification token (the meta tag's content value). */
  gscVerification: string | null;
  /** Public profile URLs of the brand accounts, in display order. */
  social: { name: string; url: string }[];
  launchList: { deleteBy: string };
}

export const site: SiteConfig = {
  url: 'https://monsunjackets.github.io',
  ga4Id: null,
  form: null,
  contactEmail: 'wearmonsun@gmail.com',
  gscVerification: null,
  social: [],
  launchList: { deleteBy: '2027-02-28' },
};
