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
 * what is left, and the whole array normalised to sum 100.
 *
 * The normalise is the half that is easy to skip and impossible to see: two
 * panels declared `"30%"` render 50/50 either way, because `flex-grow`
 * renormalises by itself. Skip it and the rendered layout is right while the
 * state, the `onResize` payload and `aria-valuenow` all say 30 — a divergence no
 * rendering assertion can catch.
 */
export function resolvePanelSizes(
  declared: ReadonlyArray<number | undefined>,
  constraints: readonly SplitterConstraint[]
): number[] {
  if (declared.length === 0) return [];

  const sizes = declared.map((value, index) =>
    value === undefined
      ? undefined
      : clamp(value, floorOf(at(constraints, index)), at(constraints, index).max)
  );

  const taken = sizes.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const free = sizes.filter(value => value === undefined).length;
  // Never negative: over-declared panels leave nothing to share rather than
  // handing the undeclared ones a negative grow factor, which flexbox reads as
  // invalid and drops back to the fallback.
  const share = free > 0 ? Math.max(0, 100 - taken) / free : 0;

  const filled = sizes.map(value => value ?? share);
  const total = filled.reduce((sum, value) => sum + value, 0);
  // A total of zero has no ratio to preserve — every panel collapsed, or none
  // declared inside a zero budget. An even split is the only defined answer.
  if (!(total > 0)) return filled.map(() => 100 / filled.length);
  return filled.map(value => (value / total) * 100);
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
    const key =
      event.key === "ArrowDown"
        ? "ArrowRight"
        : event.key === "ArrowUp"
          ? "ArrowLeft"
          : event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? ""
            : event.key;
    return numericKey({ ...event, key }, value, range, { rtl: false });
  }

  // Up and Down are not a horizontal splitter's keys and must keep scrolling.
  if (event.key === "ArrowUp" || event.key === "ArrowDown") return undefined;
  return numericKey(event, value, range, { rtl: options.rtl });
}
