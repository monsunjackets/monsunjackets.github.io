// hero-temp: progressive enhancement only. The switch itself is two radios and CSS :has().
// This script adds (1) a polite announcement of the new state and (2) the zip pull as a
// pointer control: click it to toggle, drag it to zip the liner in or out by hand.

/** Share of the stage height the pull travels; must match the translate in hero-temp.css. */
const TRAVEL = 0.72;
/** Pointer movement in px below which a press counts as a click. */
const SLOP = 4;

export function initHeroTemp(root: HTMLElement): void {
  // Without :has() the drawing cannot change state, and the stylesheet hides the switch.
  if (!CSS.supports('selector(:has(*))')) return;
  const cold = root.querySelector<HTMLInputElement>('[data-ht-radio="cold"]');
  const warm = root.querySelector<HTMLInputElement>('[data-ht-radio="warm"]');
  if (!cold || !warm) return;

  const live = root.querySelector<HTMLElement>('[data-ht-live]');
  const announce = (): void => {
    const state = cold.checked ? 'cold' : 'warm';
    const caption = root.querySelector<HTMLElement>(`[data-ht-caption="${state}"]`);
    if (live && caption) live.textContent = caption.textContent;
  };
  cold.addEventListener('change', announce);
  warm.addEventListener('change', announce);

  const stage = root.querySelector<HTMLElement>('[data-ht-stage]');
  const pull = root.querySelector<SVGSVGElement>('[data-ht-pull]');
  const grip = root.querySelector<SVGGElement>('[data-ht-grip]');
  if (!stage || !pull || !grip) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const select = (zipIn: boolean): void => {
    const target = zipIn ? cold : warm;
    if (target.checked) return;
    target.checked = true;
    target.dispatchEvent(new Event('change', { bubbles: true }));
  };

  let press: { id: number; y: number; from: number; span: number; p: number; dy: number; moved: boolean } | null = null;

  grip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    const span = stage.getBoundingClientRect().height * TRAVEL;
    // Start from where the pull is drawn, not from the radio: it may be grabbed mid-travel.
    const drawn = span > 0 ? -new DOMMatrixReadOnly(getComputedStyle(pull).transform).f / span : 0;
    const from = Math.min(1, Math.max(0, drawn));
    press = {
      id: event.pointerId,
      y: event.clientY,
      from,
      span,
      p: from,
      dy: 0,
      moved: false,
    };
  });

  grip.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.id) return;
    press.dy = press.y - event.clientY; // up is positive: zipping in
    if (!press.moved && Math.abs(press.dy) < SLOP) return;
    press.moved = true;
    if (reduced.matches || press.span <= 0) return; // no scrubbing; the release still switches
    press.p = Math.min(1, Math.max(0, press.from + press.dy / press.span));
    root.classList.add('is-dragging');
    // CSSOM write, not a style attribute in markup, so the hash-based CSP allows it.
    root.style.setProperty('--ht-p', press.p.toFixed(3));
  });

  const release = (event: PointerEvent): void => {
    if (!press || event.pointerId !== press.id) return;
    const { moved, p, dy } = press;
    press = null;
    if (event.type === 'pointerup') {
      if (!moved) select(!cold.checked);
      else select(reduced.matches ? dy > 0 : p > 0.5);
    }
    // Back to CSS: the transition carries the pull from where it was let go to the end stop.
    root.classList.remove('is-dragging');
    root.style.removeProperty('--ht-p');
  };
  grip.addEventListener('pointerup', release);
  grip.addEventListener('pointercancel', release);
  // touch-action on an SVG <g> is not honoured everywhere; this keeps a drag on the pull from scrolling the page.
  grip.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });

  root.classList.add('is-enhanced');
}
