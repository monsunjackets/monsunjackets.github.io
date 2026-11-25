import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FormConfig } from '../../config/site.ts';
import { site } from '../../config/site.ts';
import { formLink, launchListState, type LaunchListInput } from './form-config.ts';

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSexample';
const post: FormConfig = {
  mode: 'post',
  action: `${FORM}/formResponse`,
  entries: { email: 'entry.111', consent: 'entry.222', source: 'entry.333' },
  consentValue: 'Zgadzam się na jeden e-mail o starcie MONSUN.',
};
const input = (form: FormConfig | null, extra: Partial<LaunchListInput> = {}): LaunchListInput =>
  ({ form, contactEmail: 'wearmonsun@gmail.com', deleteBy: '2027-02-28', ...extra });

/** The bullet lines of the build error, so each test can name the problem it expects. */
function problems(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, /^launch-list: the form settings in src\/config\/site\.ts are not usable:\n/);
    return error.message.split('\n').slice(1).map((line) => line.replace(/^- /, ''));
  }
  assert.fail('expected the settings to be refused');
}

test('no form means the "soon" state, whatever the contact and date', () => {
  assert.deepEqual(launchListState(input(null)), { kind: 'soon' });
  assert.deepEqual(launchListState(input(null, { contactEmail: null, deleteBy: 'kiedyś' })), { kind: 'soon' });
});

test('the committed site config is usable, so a bad value fails npm test as well as the build', () => {
  assert.doesNotThrow(() =>
    launchListState({ form: site.form, contactEmail: site.contactEmail, deleteBy: site.launchList.deleteBy }));
});

test('mode "post" posts to the formResponse URL with the entries, consent text, contact and Polish date', () => {
  assert.deepEqual(launchListState(input(post)), {
    kind: 'post',
    action: `${FORM}/formResponse`,
    consentValue: post.consentValue,
    entries: post.entries,
    contactEmail: 'wearmonsun@gmail.com',
    deleteBy: { iso: '2027-02-28', text: '28 lutego 2027' },
  });
});

test('mode "link" takes the viewform URL, or turns formResponse into viewform for the one-line fallback', () => {
  for (const action of [`${FORM}/viewform`, `${FORM}/formResponse`]) {
    const state = launchListState(input({ ...post, mode: 'link', action }));
    assert.equal(state.kind, 'link');
    assert.equal(state.kind === 'link' && state.viewUrl, `${FORM}/viewform`);
  }
});

test('refuses an action that is not Google Forms over https', () => {
  for (const action of ['', 'docs.google.com/forms/x/formResponse', 'http://docs.google.com/forms/d/e/x/formResponse',
    'https://forms.gle/abc', 'https://docs.google.com/document/d/x/formResponse',
    'https://user@docs.google.com/forms/d/e/x/formResponse', 'https://docs.google.com.evil.example/forms/x/formResponse']) {
    const found = problems(() => launchListState(input({ ...post, action })));
    assert.equal(found.length, 1, action);
    assert.match(found[0]!, /is not a URL|is not a Google Forms URL/, action);
  }
});

test('refuses a whole pre-filled link pasted as the action, which would post test answers with every sign-up', () => {
  const pasted = `${FORM}/viewform?usp=pp_url&entry.111=test@example.com&entry.333=test`;
  for (const mode of ['post', 'link'] as const) {
    assert.deepEqual(problems(() => launchListState(input({ ...post, mode, action: pasted }))),
      ['form.action must end at /formResponse or /viewform, without "?…" or "#…"']);
  }
  assert.deepEqual(problems(() => launchListState(input({ ...post, action: `${FORM}/formResponse#x` }))),
    ['form.action must end at /formResponse or /viewform, without "?…" or "#…"']);
});

test('mode "post" refuses the viewform URL and says which part to swap', () => {
  assert.deepEqual(problems(() => launchListState(input({ ...post, action: `${FORM}/viewform` }))),
    ['form.action for mode "post" must end in /formResponse (a pre-filled link ends in /viewform: swap that part)']);
  assert.deepEqual(problems(() => launchListState(input({ ...post, mode: 'link', action: `${FORM}/edit` }))),
    ['form.action for mode "link" must end in /viewform or /formResponse']);
});

test('refuses an unknown mode', () => {
  const form = { ...post, mode: 'iframe' } as unknown as FormConfig;
  assert.deepEqual(problems(() => launchListState(input(form))), ['form.mode must be "post" or "link", got "iframe"']);
});

test('refuses entries that are not entry ids, and the same entry used twice', () => {
  const found = problems(() => launchListState(input({
    ...post, entries: { email: 'email', consent: 'entry.222', source: 'entry.12a' },
  })));
  assert.deepEqual(found, [
    'form.entries.email "email" does not look like "entry.123456789"',
    'form.entries.source "entry.12a" does not look like "entry.123456789"',
  ]);
  assert.deepEqual(problems(() => launchListState(input({
    ...post, entries: { email: 'entry.111', consent: 'entry.111', source: 'entry.333' },
  }))), ['form.entries must name three different fields']);
});

test('refuses a consent value that is empty or has surrounding spaces, since Google matches the option text', () => {
  for (const consentValue of ['', '   ', ' Zgadzam się', 'Zgadzam się\n']) {
    assert.deepEqual(problems(() => launchListState(input({ ...post, consentValue }))),
      ['form.consentValue must be the consent option\'s exact text, not empty and without surrounding spaces']);
  }
});

test('refuses a form without a contact address, because the privacy summary must name the controller', () => {
  assert.deepEqual(problems(() => launchListState(input(post, { contactEmail: null }))),
    ['contactEmail is null: the privacy summary next to the form must name the controller\'s contact']);
  assert.deepEqual(problems(() => launchListState(input(post, { contactEmail: 'wearmonsun' }))),
    ['contactEmail "wearmonsun" is not an e-mail address']);
});

test('refuses a deletion date that is not a real YYYY-MM-DD day', () => {
  assert.deepEqual(problems(() => launchListState(input(post, { deleteBy: '28.02.2027' }))),
    ['launchList.deleteBy "28.02.2027" is not a YYYY-MM-DD date']);
  const [found] = problems(() => launchListState(input(post, { deleteBy: '2027-02-30' })));
  assert.match(found!, /^launchList\.deleteBy: Not a date: "2027-02-30"/);
});

test('reports every problem at once', () => {
  const found = problems(() => launchListState({
    form: { mode: 'post', action: 'https://example.com/', entries: { email: 'x', consent: 'x', source: 'x' }, consentValue: '' },
    contactEmail: null,
    deleteBy: '',
  }));
  assert.equal(found.length, 8);
});

test('formLink pre-fills the source field on the Form page, encoding the value', () => {
  assert.equal(formLink(`${FORM}/viewform`, 'entry.333', 'podpinka'), `${FORM}/viewform?usp=pp_url&entry.333=podpinka`);
  assert.equal(
    formLink(`${FORM}/viewform`, 'entry.333', 'podpinka?utm_source=poster&utm_medium=qr'),
    `${FORM}/viewform?usp=pp_url&entry.333=podpinka%3Futm_source%3Dposter%26utm_medium%3Dqr`,
  );
});

test('formLink replaces an earlier source value instead of adding a second one', () => {
  const once = formLink(`${FORM}/viewform`, 'entry.333', 'home');
  const url = new URL(formLink(once, 'entry.333', 'home?utm_source=poster'));
  assert.deepEqual(url.searchParams.getAll('entry.333'), ['home?utm_source=poster']);
});
