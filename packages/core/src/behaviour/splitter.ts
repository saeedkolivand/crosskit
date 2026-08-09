/**
 * Splitter arithmetic: where a boundary may go, and what a key does to it.
 *
 * Everything here is a PERCENTAGE OF THE RESIZABLE LENGTH — the sum of the
 * panels' own main-axis sizes, not the container's. The bars have real width, so
 * measuring the container and dividing by it over-allocates by the bar total and
 * every panel renders a few pixels wider than the number reported. The sum of
 * the panel rects is exact whatever the root's padding, the bar size or the
 * panel count, and it does not change as the percentages are redistributed —
 * which is what lets it be measured once, before the sizes are resolved.
 *
 * Framework-free because the clamping is a four-way bound rather than a
 * `Math.min`, and it has to be byte-identical in four adapters.
 */

import { clamp, numericKey } from "./numeric";

export interface SplitterConstraint {
  /** Percent. 0 when the panel declares no floor. */
  min: number;
  /** Percent. 100 when the panel declares no ceiling. */
  max: number;
  resizable: boolean;
  /**
   * Which edge the panel may be pushed against. `start` means the bar AFTER it
   * may squash it to zero, `end` means the bar BEFORE it may. The asymmetry is
   * the whole reason this is not a plain boolean: an end panel that may close
   * inward but must never close outward is the ordinary case.
   */
  collapsible: { start: boolean; end: boolean };
}

/** Whatever a partial constraint list leaves unsaid: unconstrained and movable. */
const FREE: SplitterConstraint = {
  min: 0,
  max: 100,
  resizable: true,
  collapsible: { start: false, end: false },
};

/**
 * The keyboard step, in percent.
 *
 * Not pixels: a px step has to be divided by a measured length, which puts a DOM
 * read on the keyboard path, produces `Infinity` when the measurement is zero,
 * and stops the whole thing being unit-testable. A percent step makes keyboard
 * resizing pure arithmetic with no geometry in it at all.
 */
const STEP = 1;

const at = (constraints: readonly SplitterConstraint[], index: number): SplitterConstraint =>
  constraints[index] ?? FREE;

/**
 * A `size`/`min`/`max` prop as a percentage of `available`.
 *
 * One grammar for all four props: a bare number is pixels, `"40%"` is percent,
 * `"200px"` is pixels, anything else says nothing and returns `undefined` so the
 * caller can fall through to the next source.
 *
 * A pixel value against an unmeasured length returns `undefined` rather than a
 * number, because `px / 0 * 100` is `Infinity` — which reaches `flex-grow` as
 * `NaN` and blanks the layout. Degrading to "auto" is the recoverable failure.
 */
export function parsePanelSize(
  value: number | string | undefined,
  available: number
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number")
    return Number.isFinite(value) && available > 0 ? (value / available) * 100 : undefined;

  const text = value.trim();
  if (text.endsWith("%")) {
    const percent = Number.parseFloat(text);
    return Number.isFinite(percent) ? percent : undefined;
  }
  if (text.endsWith("px")) {
    const pixels = Number.parseFloat(text);
    return Number.isFinite(pixels) && available > 0 ? (pixels / available) * 100 : undefined;
  }
  return undefined;
}

/**
 * The floor a panel can actually reach.
 *
 * A collapsible panel's real floor is zero whichever bar closed it — clamping a
 * collapsed panel back up to its `min` on the next render is what makes collapse
 * appear not to work at all.
 */
const floorOf = (constraint: SplitterConstraint): number =>
  constraint.collapsible.start || constraint.collapsible.end ? 0 : constraint.min;

/**
 * Starting percentages: declared entries honoured, `undefined` entries sharing
 * what is left, every entry inside its own bounds, and the whole array
 * normalised to sum 100.
 *
 * The normalise is the half that is easy to skip and impossible to see: two
 * panels declared `"30%"` render 50/50 either way, because `flex-grow`
 * renormalises by itself. Skip it and the rendered layout is right while the
 * state, the `onResize` payload and `aria-valuenow` all say 30 — a divergence no
 * rendering assertion can catch.
 *
 * Where the two cannot both hold — panels whose `min`s already exceed 100 — the
 * BOUNDS win and the sum does not. `flex-grow` renormalises whatever it is
 * given, so the sum costs nothing visible, while a value outside the window
 * `panelBounds` reports for the neighbouring bar is invalid ARIA.
 */
export function resolvePanelSizes(
  declared: ReadonlyArray<number | undefined>,
  constraints: readonly SplitterConstraint[]
): number[] {
  if (declared.length === 0) return [];

  // The one clamp every path goes through, declared or shared. It is also what
  // keeps a share non-negative: over-declared panels leave a negative pool, and
  // a negative number in `flex-grow` is invalid — flexbox drops the whole
  // declaration back to the initial `1` and the panel renders at a size nothing
  // in the state explains.
  const bound = (index: number, value: number): number =>
    clamp(value, floorOf(at(constraints, index)), at(constraints, index).max);

  /**
   * Hand `budget` out across `open`, in proportion to `weight`, with every
   * value inside its own bounds.
   *
   * Water-filled rather than divided once. A panel that declares no size still
   * declares its own `min` and `max`, and a share that ignores them lands the
   * panel outside the very window `panelBounds` reports for the bar beside it —
   * `aria-valuenow` outside `aria-valuemin`/`aria-valuemax`, which is invalid
   * ARIA a screen reader may refuse to announce rather than merely untidy.
   * Dividing once and clamping afterwards is not enough: the clamp changes the
   * total, so the deficit has to go back to the panels that can still absorb it.
   *
   * Each pass pins at least one panel at a bound and a pinned panel never
   * reopens, so this is at most one pass per panel.
   */
  const spread = (
    open: number[],
    budget: number,
    weight: (index: number) => number,
    out: (number | undefined)[]
  ): void => {
    let free = open;
    let left = budget;
    while (free.length > 0) {
      const mass = free.reduce((sum, index) => sum + weight(index), 0);
      // Multiplied before it is divided, not after. `(w / mass) * left` rounds
      // twice, and for the equal-weight case that is enough to move the answer:
      // `(1 / 3) * 100` is 33.33333333333333 while `(1 * 100) / 3` is
      // 33.333333333333336, which is what `100 / 3` gives and what an even split
      // is expected to equal.
      //
      // No mass to divide by — every remaining panel is at zero, and an even
      // split is the only defined answer.
      const share = (index: number) =>
        mass > 0 ? (weight(index) * left) / mass : left / free.length;
      const pinned = free.filter(index => bound(index, share(index)) !== share(index));
      if (pinned.length === 0) {
        for (const index of free) out[index] = share(index);
        return;
      }
      for (const index of pinned) {
        out[index] = bound(index, share(index));
        left -= out[index]!;
      }
      free = free.filter(index => !pinned.includes(index));
    }
  };

  const sizes = declared.map((value, index) =>
    value === undefined ? undefined : bound(index, value)
  );

  spread(
    sizes.flatMap((value, index) => (value === undefined ? [index] : [])),
    100 - sizes.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    () => 1,
    sizes
  );

  const filled = sizes as number[];
  const total = filled.reduce((sum, value) => sum + value, 0);
  // A total of zero has no ratio to preserve — every panel collapsed, or none
  // declared inside a zero budget. An even split is the only defined answer.
  if (!(total > 0)) return filled.map(() => 100 / filled.length);
  // Already summing to 100, so there is nothing to rescale — and every entry is
  // inside its own bounds at this point by construction, since a declared entry
  // went through `bound` and a shared one is whatever `spread` verified. Guarded
  // rather than left to the arithmetic below, because `value / total * 100` is a
  // round trip even when `total` is 100: it turns `100 / 3` into a number that
  // no longer equals `100 / 3`.
  if (Math.abs(total - 100) < 1e-9) return filled;

  // The SAME spread again, weighted by what each panel now holds, because the
  // normalise to 100 is itself a scale and a scale defeats a bound. With every
  // panel declared there is no undeclared panel to absorb the difference, so
  // `total !== 100` and a plain `value / total * 100` pushes a capped panel
  // straight back past its own ceiling: two panels asking 30% and 10% with the
  // first capped at 30% came out [75, 25], and the bar beside it reported
  // `aria-valuenow="75"` against `aria-valuemax="30"`.
  //
  // Written into a fresh array rather than in place: the weights are read
  // throughout, so scaling one panel must not change the divisor for the next.
  const scaled: (number | undefined)[] = filled.map(() => undefined);
  spread(
    filled.map((_, index) => index),
    100,
    index => filled[index]!,
    scaled
  );
  return scaled as number[];
}

/** The pair either side of the bar at `index`, and the fixed budget they share. */
const pair = (
  sizes: readonly number[],
  index: number,
  constraints: readonly SplitterConstraint[]
) => {
  const a = at(constraints, index);
  const b = at(constraints, index + 1);
  const total = (sizes[index] ?? 0) + (sizes[index + 1] ?? 0);
  // Four bounds, not two. The pair's sum is fixed, so the trailing panel's own
  // limits bound the leading one just as tightly as its own do: a trailing panel
  // with `max: 30` must stop the leading one at `total - 30`, and an
  // implementation that only clamps `a` sails straight past it while the
  // trailing panel silently exceeds a maximum it was given.
  return {
    a,
    b,
    total,
    low: Math.max(a.min, total - b.max),
    high: Math.min(a.max, total - b.min),
  };
};

/**
 * What the bar at `index` can reach — the range for `aria-valuemin`/`valuemax`
 * and for the keyboard.
 *
 * The collapse extremes are part of the range rather than an exception to it.
 * Without them a collapsed panel reports `aria-valuenow="0"` against
 * `aria-valuemin="20"`, which is invalid ARIA; with them the numbers are simply
 * true, because zero really is reachable.
 */
export function panelBounds(
  sizes: readonly number[],
  index: number,
  constraints: readonly SplitterConstraint[]
): { min: number; max: number } {
  const { a, b, total, low, high } = pair(sizes, index, constraints);
  return {
    min: a.collapsible.start ? 0 : low,
    max: b.collapsible.end ? total : high,
  };
}

/**
 * The sizes after moving the bar at `index` by `delta` percent.
 *
 * Only the pair either side moves; every other panel keeps its number, which is
 * what stops a drag at one end of a three-pane layout from nudging the far one.
 */
export function resizePanels(
  sizes: readonly number[],
  index: number,
  delta: number,
  constraints: readonly SplitterConstraint[]
): number[] {
  const next = [...sizes];
  if (index < 0 || index + 1 >= sizes.length) return next;

  const { a, b, total, low, high } = pair(sizes, index, constraints);
  // Returned unchanged rather than clamped to nothing, so the adapter needs no
  // "should this bar move" branch of its own and the two cannot disagree.
  if (!a.resizable || !b.resizable) return next;

  const wanted = (sizes[index] ?? 0) + delta;

  // Collapse is this same operation, not a second one. The midpoint is not
  // polish: without it a panel sitting at 0 with `min: 20` clamps every value
  // between 1 and 19 straight back to 0, so dragging it open does nothing at all
  // until the pointer crosses 20% and the panel reads as stuck. One expression
  // gives snap-shut on the way in and snap-open on the way out.
  let landed: number;
  if (wanted < low && a.collapsible.start) landed = wanted < low / 2 ? 0 : low;
  else if (wanted > high && b.collapsible.end) landed = wanted > (high + total) / 2 ? total : high;
  // `clamp` tolerates a reversed range, which is what covers contradictory
  // constraints — two minimums that together exceed the pair's budget.
  else landed = clamp(wanted, low, high);

  next[index] = landed;
  next[index + 1] = total - landed;
  return next;
}

/**
 * What an arrow, page or home/end key does to the bar. `undefined` for a key
 * that is not ours, so the caller can tell "handled" from "let it scroll".
 *
 * A thin remap over `numericKey` rather than its own switch, so shift-steps and
 * jump-to-end come free and already tested. The axis handling is the part that
 * is specific: a horizontal splitter's keys are the inline ones and a vertical
 * one's are the block ones, and the block axis does NOT mirror with `direction`
 * — only the inline axis does — so a vertical splitter forces `rtl: false`
 * whatever the document says.
 */
export function splitterKey(
  event: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  value: number,
  bounds: { min: number; max: number },
  options: { layout: "horizontal" | "vertical"; rtl?: boolean }
): number | undefined {
  const range = { min: bounds.min, max: bounds.max, step: STEP };

  if (options.layout === "vertical") {
    // Down grows the leading (upper) panel, up shrinks it. Left and Right are
    // dropped so they keep doing whatever the page does with them.
    //
    // PageUp and PageDown are remapped for the same reason and cannot be passed
    // through: `numericKey` grows on PageUp because that is what a slider does,
    // which on a vertical splitter would send the bar the OPPOSITE way to
    // ArrowUp and to Shift+ArrowUp — the same gesture, one key apart, moving the
    // boundary in two directions.
    const VERTICAL: Record<string, string> = {
      ArrowDown: "ArrowRight",
      ArrowUp: "ArrowLeft",
      PageDown: "PageUp",
      PageUp: "PageDown",
      ArrowLeft: "",
      ArrowRight: "",
    };
    return numericKey({ ...event, key: VERTICAL[event.key] ?? event.key }, value, range, {
      rtl: false,
    });
  }

  // Up and Down are not a horizontal splitter's keys and must keep scrolling.
  if (event.key === "ArrowUp" || event.key === "ArrowDown") return undefined;
  return numericKey(event, value, range, { rtl: options.rtl });
}
