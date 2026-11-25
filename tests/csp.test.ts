import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp } from '../src/lib/csp.ts';
import { expectedPolicy } from '../scripts/lib/verify/policy.ts';

const GOOGLE = /google|doubleclick/;

test('without GA4 the policy names no Google origin except the Form target', () => {
  const policy = expectedPolicy(buildCsp(false));
  for (const [name, sources] of policy) {
    const google = sources.filter((source) => GOOGLE.test(source));
    assert.deepEqual(google, name === 'form-action' ? ['https://docs.google.com'] : [], name);
  }
  assert.deepEqual(policy.get('script-src'), ["'self'"]);
  assert.deepEqual(policy.get('img-src'), ["'self'"]);
  assert.deepEqual(policy.get('connect-src'), ["'self'"]);
});

test('with GA4 the tag host is www.googletagmanager.com only, and collection goes to Google Analytics hosts', () => {
  const policy = expectedPolicy(buildCsp(true));
  assert.deepEqual(policy.get('script-src'), ["'self'", 'https://www.googletagmanager.com']);
  assert.deepEqual(policy.get('img-src'), ["'self'", 'https://*.google-analytics.com', 'https://www.googletagmanager.com']);
  assert.deepEqual(policy.get('connect-src'), [
    "'self'",
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.googletagmanager.com',
  ]);
});

test('GA4 changes only script-src, img-src and connect-src', () => {
  const off = expectedPolicy(buildCsp(false));
  const on = expectedPolicy(buildCsp(true));
  assert.deepEqual([...on.keys()], [...off.keys()]);
  const changed = [...on.keys()].filter((name) => on.get(name)!.join(' ') !== off.get(name)!.join(' '));
  assert.deepEqual(changed.sort(), ['connect-src', 'img-src', 'script-src']);
});

test('no GA4 policy allows ad or Google-signals hosts, wildcard tag hosts or frames', () => {
  const policy = expectedPolicy(buildCsp(true));
  const all = [...policy.values()].flat();
  for (const host of ['doubleclick.net', 'www.google.com', 'https://*.googletagmanager.com']) {
    assert.ok(!all.some((source) => source.includes(host)), host);
  }
  assert.equal(policy.get('frame-src'), undefined);
  assert.deepEqual(policy.get('default-src'), ["'self'"]);
});
