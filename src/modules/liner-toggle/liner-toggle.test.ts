import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasLinerPair, linerSlots, showsLinerToggle, type LinerImage } from './liner-toggle.ts';

const pair: LinerImage[] = [{ state: 'in' }, { state: 'out' }];

test('hasLinerPair needs at least one photo of each state', () => {
  assert.equal(hasLinerPair(pair), true);
  assert.equal(hasLinerPair([{ state: 'out' }, {}, { state: 'in' }, { state: 'in' }]), true);
  assert.equal(hasLinerPair([]), false);
  assert.equal(hasLinerPair([{ state: 'in' }, { state: 'in' }]), false);
  assert.equal(hasLinerPair([{ state: 'out' }]), false);
  assert.equal(hasLinerPair([{}, { state: undefined }]), false);
});

test('hasLinerPair matches the seeded ramoneska, which has an "in" photo but no "out" one yet', () => {
  assert.equal(hasLinerPair([{}, { state: 'in' }]), false);
});

test('showsLinerToggle renders for jackets with a pair, whether the liner is included or compatible', () => {
  assert.equal(showsLinerToggle('included', pair), true);
  assert.equal(showsLinerToggle('compatible', pair), true);
});

test('showsLinerToggle renders nothing for the liner itself, even with photos of both states', () => {
  assert.equal(showsLinerToggle('liner', pair), false);
  assert.equal(showsLinerToggle('liner', []), false);
});

test('showsLinerToggle renders nothing for a jacket without a photo pair', () => {
  assert.equal(showsLinerToggle('included', []), false);
  assert.equal(showsLinerToggle('compatible', [{ state: 'in' }]), false);
});

test('linerSlots pairs the n-th "in" photo with the n-th "out" photo, always in that order', () => {
  const [wornIn, wornOut, flatIn, flatOut] = [{ state: 'in' }, { state: 'out' }, { state: 'in' }, { state: 'out' }] as const;
  assert.deepEqual(linerSlots([wornIn, wornOut, flatIn, flatOut]), [[wornIn, wornOut], [flatIn, flatOut]]);
  assert.deepEqual(linerSlots([wornOut, flatOut, wornIn, flatIn]), [[wornIn, wornOut], [flatIn, flatOut]]);
});

test('linerSlots places a pair where its first photo appears and keeps other photos on their own', () => {
  const detail: LinerImage = {};
  const wornIn = { state: 'in' as const };
  const wornOut = { state: 'out' as const };
  assert.deepEqual(linerSlots([detail, wornOut, wornIn]), [[detail], [wornIn, wornOut]]);
});

test('linerSlots leaves a photo without a partner as a single slot', () => {
  const lone = { state: 'in' as const };
  const pairIn = { state: 'in' as const };
  const pairOut = { state: 'out' as const };
  assert.deepEqual(linerSlots([pairIn, pairOut, lone]), [[pairIn, pairOut], [lone]]);
  assert.deepEqual(linerSlots([{}, lone]), [[{}], [lone]]);
  assert.deepEqual(linerSlots([]), []);
});

test('linerSlots keeps the caller\'s objects, so the template gets its own image entries back', () => {
  const images = [{ state: 'in' as const, src: 'a.jpg' }, { state: 'out' as const, src: 'b.jpg' }];
  const slots = linerSlots(images);
  assert.equal(slots[0]?.[0], images[0]);
  assert.equal(slots[0]?.[1], images[1]);
});
