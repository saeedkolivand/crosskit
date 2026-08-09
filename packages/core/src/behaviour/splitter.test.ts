import { describe, expect, it } from "vitest";
import {
  panelBounds,
  parsePanelSize,
  resizePanels,
  resolvePanelSizes,
  splitterKey,
  type SplitterConstraint,
} from "./splitter";

/** A constraint with everything open, overridden field by field. */
const C = (over: Partial<SplitterConstraint> = {}): SplitterConstraint => ({
  min: 0,
  max: 100,
  resizable: true,
  collapsible: { start: false, end: false },
  ...over,
});

const free = (count: number) => Array.from({ length: count }, () => C());

describe("parsePanelSize", () => {
  it("reads a percent string as a percent, whatever the length is", () => {
    expect(parsePanelSize("40%", 800)).toBe(40);
    expect(parsePanelSize("40%", 0)).toBe(40);
  });

  it("divides a bare number by the available length", () => {
    expect(parsePanelSize(200, 800)).toBe(25);
  });

  it("reads a px string the same way as a bare number", () => {
    expect(parsePanelSize("200px", 800)).toBe(25);
  });

  it("says nothing for a pixel value against an unmeasured length", () => {
    // Not Infinity. `px / 0 * 100` reaches `flex-grow` as NaN and blanks the
    // whole layout; `undefined` degrades to an even share, which is recoverable.
    expect(parsePanelSize(200, 0)).toBeUndefined();
    expect(parsePanelSize("200px", 0)).toBeUndefined();
  });

  it("says nothing for a value it does not understand", () => {
    expect(parsePanelSize(undefined, 800)).toBeUndefined();
    expect(parsePanelSize("auto", 800)).toBeUndefined();
    expect(parsePanelSize("3rem", 800)).toBeUndefined();
  });
});

describe("resolvePanelSizes", () => {
  it("splits an undeclared row evenly", () => {
    expect(resolvePanelSizes([undefined, undefined, undefined], free(3))).toEqual([
      100 / 3,
      100 / 3,
      100 / 3,
    ]);
  });

  it("gives the undeclared panels what the declared ones left", () => {
    expect(resolvePanelSizes([50, undefined, undefined], free(3))).toEqual([50, 25, 25]);
  });

  it("normalises a row that does not add up to 100", () => {
    // The one nobody sees without this assertion: `flex-grow` renormalises by
    // itself, so 30/30 renders 50/50 on screen whether we normalise or not.
    // What stays wrong is the state, the onResize payload and aria-valuenow.
    expect(resolvePanelSizes([30, 30], free(2))).toEqual([50, 50]);
    expect(resolvePanelSizes([80, 80], free(2))).toEqual([50, 50]);
  });

  it("clamps a declared size to the panel's own bounds before sharing", () => {
    // 90 asked, 50 allowed — and the second panel gets the rest, not 10.
    expect(resolvePanelSizes([90, undefined], [C({ max: 50 }), C()])).toEqual([50, 50]);
  });

  it("lets a collapsible panel sit at zero instead of clamping it back to min", () => {
    // A collapsed panel is re-resolved on every render. Clamping it up to its
    // own `min` here is what makes collapse look like it does not work at all.
    expect(
      resolvePanelSizes([0, 100], [C({ min: 20, collapsible: { start: true, end: false } }), C()])
    ).toEqual([0, 100]);
  });

  it("still refuses to leave a non-collapsible panel at zero", () => {
    // The control for the assertion above: same input, collapsibility removed.
    // Only the floor differs, so a `floorOf` that ignored `collapsible` would
    // make both of these read the same and neither could catch it.
    expect(resolvePanelSizes([0, 100], [C({ min: 20 }), C()])[0]).toBeGreaterThan(0);
  });

  it("keeps a capped panel inside its cap when EVERY panel is declared", () => {
    // The all-declared sibling of the undeclared case below, and the one the
    // normalise used to defeat: there is no undeclared panel to absorb the
    // difference, so the row does not sum to 100 and a plain
    // `value / total * 100` scales the capped panel straight back out. 30 and 10
    // against a 30 ceiling came out [75, 25] — the bar beside it then reported
    // `aria-valuenow="75"` against `aria-valuemax="30"`.
    //
    // The representative matters: two panels declaring the SAME size scale to
    // 50/50 and stay inside a 40 cap by luck, so a row where the two differ is
    // the only one that can tell the two implementations apart.
    const constraints = [C({ max: 30 }), C()];
    expect(resolvePanelSizes([30, 10], constraints)).toEqual([30, 70]);
    expect(panelBounds(resolvePanelSizes([30, 10], constraints), 0, constraints)).toEqual({
      min: 0,
      max: 30,
    });

    // And the shape a pixel row lands in: two panels each asking 300px of a
    // 1000px container, the first capped at 400px.
    expect(resolvePanelSizes([30, 30], [C({ max: 40 }), C()])).toEqual([40, 60]);
  });

  it("keeps a floored panel above its floor through the same normalise", () => {
    // The other direction. 0 clamps up to 20, which takes the row to 120, and
    // scaling that back to 100 put the panel at 16.67 — under the `min` the bar
    // beside it advertises.
    expect(resolvePanelSizes([0, 100], [C({ min: 20 }), C()])).toEqual([20, 80]);
  });

  it("keeps the bounds rather than the sum when the two cannot both hold", () => {
    // Two panels each demanding 70 leaves no answer that is both inside every
    // bound and summing to 100. The bound wins, because it is the half a screen
    // reader reads: at [50, 50] `aria-valuenow` sits under an `aria-valuemin` of
    // 70, which is invalid ARIA rather than merely a wrong pixel. The rendered
    // layout is unaffected either way — `flex-grow` renormalises whatever it is
    // given, so 70/70 and 50/50 paint the same.
    expect(resolvePanelSizes([10, 10], [C({ min: 70 }), C({ min: 70 })])).toEqual([70, 70]);
  });

  it("clamps an UNDECLARED panel's even share to its own max", () => {
    // The half that is easy to miss: a panel with no `size` still has a `max`,
    // and 50/50 puts the second panel 20 points over a ceiling it was given.
    // Clamping only the declared entries leaves this at [50, 50] — and then
    // `panelBounds` reports min 70 for the bar while `aria-valuenow` says 50,
    // which is invalid ARIA rather than merely a wrong pixel.
    expect(resolvePanelSizes([undefined, undefined], [C(), C({ max: 30 })])).toEqual([70, 30]);
  });

  it("clamps an UNDECLARED panel's even share up to its own min", () => {
    // Both directions, because a clamp written as a single `Math.min` passes
    // the max case above and this one still comes out 33/33/33.
    expect(
      resolvePanelSizes([undefined, undefined, undefined], [C({ min: 60 }), C(), C()])
    ).toEqual([60, 20, 20]);
  });

  it("re-shares what a pinned panel would not take, rather than dividing once", () => {
    // Three panels, one capped at 10. Dividing once and clamping gives
    // [33.3, 33.3, 10] — a total of 76.7 that the normalise then scales back to
    // [43.5, 43.5, 13], putting the capped panel over its ceiling again. The
    // 45 here is the 90 left over after the cap, halved.
    expect(
      resolvePanelSizes([undefined, undefined, undefined], [C(), C(), C({ max: 10 })])
    ).toEqual([45, 45, 10]);
  });

  it("leaves nothing to share rather than a negative share", () => {
    // 140 declared against a budget of 100, so the leftover is −40. A negative
    // number in `flex-grow` is invalid: flexbox drops the whole declaration back
    // to the initial `1` and the panel renders at a size nothing in the state
    // explains. The shared entries go through the same clamp the declared ones
    // do, so the floor is a consequence of the bound rather than a special case.
    const sizes = resolvePanelSizes([80, 60, undefined], free(3));
    expect(sizes[2]).toBe(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(0);
  });

  it("falls back to an even split when nothing sums to anything", () => {
    expect(resolvePanelSizes([0, 0], free(2))).toEqual([50, 50]);
  });

  it("treats a missing constraint as unconstrained rather than throwing", () => {
    // Svelte cannot introspect its children, so its Panel will register its
    // constraints a render late and this array arrives short.
    expect(resolvePanelSizes([undefined, undefined], [])).toEqual([50, 50]);
  });

  it("has nothing to resolve for no panels", () => {
    expect(resolvePanelSizes([], [])).toEqual([]);
  });
});

describe("resizePanels", () => {
  it("moves only the pair either side of the bar", () => {
    expect(resizePanels([40, 30, 30], 0, 10, free(3))).toEqual([50, 20, 30]);
    expect(resizePanels([40, 30, 30], 1, 10, free(3))).toEqual([40, 40, 20]);
  });

  it("stops the leading panel at its own min", () => {
    expect(resizePanels([50, 50], 0, -40, [C({ min: 20 }), C()])).toEqual([20, 80]);
  });

  it("stops the leading panel at the TRAILING panel's min", () => {
    expect(resizePanels([50, 50], 0, 40, [C(), C({ min: 20 })])).toEqual([80, 20]);
  });

  it("stops the leading panel at the trailing panel's MAX", () => {
    // The bound a `Math.max(a.min, …)`-only implementation sails past. Dragging
    // left here shrinks the leading panel, which grows the trailing one — and
    // the trailing panel's own ceiling is what has to stop it. Without this
    // term the trailing panel silently exceeds a maximum it was given.
    expect(resizePanels([50, 50], 0, -40, [C(), C({ max: 70 })])).toEqual([30, 70]);
  });

  it("stops the leading panel at its own max", () => {
    expect(resizePanels([50, 50], 0, 40, [C({ max: 70 }), C()])).toEqual([70, 30]);
  });

  it("freezes the bar when either neighbour is not resizable", () => {
    expect(resizePanels([50, 50], 0, 20, [C({ resizable: false }), C()])).toEqual([50, 50]);
    expect(resizePanels([50, 50], 0, 20, [C(), C({ resizable: false })])).toEqual([50, 50]);
  });

  it("snaps a collapsible panel shut past the midpoint of its floor", () => {
    const constraints = [C({ min: 20, collapsible: { start: true, end: false } }), C()];
    // Floor 20, so the midpoint is 10.
    expect(resizePanels([50, 50], 0, -45, constraints)).toEqual([0, 100]);
  });

  it("holds a collapsible panel at its floor before the midpoint", () => {
    const constraints = [C({ min: 20, collapsible: { start: true, end: false } }), C()];
    expect(resizePanels([50, 50], 0, -35, constraints)).toEqual([20, 80]);
  });

  it("snaps a collapsed panel back open rather than leaving it stuck", () => {
    // From 0, every value between 1 and 19 clamps to 0 without the midpoint
    // rule, so dragging out does nothing until the pointer crosses 20% and the
    // panel reads as broken. 12 is past the midpoint, so it jumps to the floor.
    const constraints = [C({ min: 20, collapsible: { start: true, end: false } }), C()];
    expect(resizePanels([0, 100], 0, 12, constraints)).toEqual([20, 80]);
    expect(resizePanels([0, 100], 0, 8, constraints)).toEqual([0, 100]);
  });

  it("collapses the TRAILING panel when that is the one that may close", () => {
    // The asymmetry: `end` on the trailing panel, and the leading panel takes
    // the whole budget. `start` on the same panel would not do this.
    const constraints = [C(), C({ min: 20, collapsible: { start: false, end: true } })];
    expect(resizePanels([50, 50], 0, 45, constraints)).toEqual([100, 0]);
    expect(resizePanels([50, 50], 0, 35, constraints)).toEqual([80, 20]);
  });

  it("does not collapse a panel that is only collapsible from the other side", () => {
    const constraints = [C({ min: 20, collapsible: { start: false, end: true } }), C()];
    expect(resizePanels([50, 50], 0, -45, constraints)).toEqual([20, 80]);
  });

  it("keeps the pair's total fixed however hard it is pushed", () => {
    for (const delta of [-500, -37, 0, 37, 500]) {
      const [a, b] = resizePanels([40, 60], 0, delta, [C({ min: 10 }), C({ min: 15, max: 70 })]);
      expect(a! + b!).toBeCloseTo(100, 10);
    }
  });

  it("survives constraints that contradict each other", () => {
    // Two minimums that together exceed the pair's budget make `low > high`.
    // `clamp` tolerates a reversed range, so this lands somewhere in the pair
    // rather than returning NaN and blanking the layout.
    const [a, b] = resizePanels([50, 50], 0, 20, [C({ min: 70 }), C({ min: 70 })]);
    expect(Number.isFinite(a)).toBe(true);
    expect(a! + b!).toBeCloseTo(100, 10);
  });

  it("leaves a bar index with no pair alone", () => {
    expect(resizePanels([100], 0, 20, free(1))).toEqual([100]);
    expect(resizePanels([50, 50], -1, 20, free(2))).toEqual([50, 50]);
  });
});

describe("panelBounds", () => {
  it("reports the four-way window, not each panel's own limits", () => {
    expect(panelBounds([50, 50], 0, [C({ min: 10, max: 90 }), C({ min: 20, max: 60 })])).toEqual({
      min: 40,
      max: 80,
    });
  });

  it("reports zero as reachable when the leading panel may collapse", () => {
    // Not a fudge to keep valuenow inside the range: zero really is reachable,
    // and a collapsed panel reporting valuenow=0 against valuemin=20 is invalid
    // ARIA that a screen reader may simply refuse to announce.
    expect(
      panelBounds([0, 100], 0, [C({ min: 20, collapsible: { start: true, end: false } }), C()]).min
    ).toBe(0);
  });

  it("reports the whole budget as reachable when the trailing panel may collapse", () => {
    expect(
      panelBounds([50, 50], 0, [C(), C({ min: 20, collapsible: { start: false, end: true } })]).max
    ).toBe(100);
  });

  it("keeps the min at the floor when the leading panel may not collapse", () => {
    expect(panelBounds([50, 50], 0, [C({ min: 20 }), C()]).min).toBe(20);
  });
});

const KEY = (key: string, over: Record<string, boolean> = {}) => ({ key, ...over });
const BOUNDS = { min: 0, max: 100 };

describe("splitterKey", () => {
  it("moves a horizontal bar with the inline arrows", () => {
    expect(splitterKey(KEY("ArrowRight"), 50, BOUNDS, { layout: "horizontal" })).toBe(51);
    expect(splitterKey(KEY("ArrowLeft"), 50, BOUNDS, { layout: "horizontal" })).toBe(49);
  });

  it("mirrors the inline arrows in RTL", () => {
    expect(splitterKey(KEY("ArrowRight"), 50, BOUNDS, { layout: "horizontal", rtl: true })).toBe(
      49
    );
    expect(splitterKey(KEY("ArrowLeft"), 50, BOUNDS, { layout: "horizontal", rtl: true })).toBe(51);
  });

  it("leaves the block arrows to the page on a horizontal bar", () => {
    // Not "returns the same value" — `undefined` is what tells the adapter not
    // to call preventDefault, and a bar that swallows Up and Down stops the
    // page scrolling while it has focus.
    expect(splitterKey(KEY("ArrowUp"), 50, BOUNDS, { layout: "horizontal" })).toBeUndefined();
    expect(splitterKey(KEY("ArrowDown"), 50, BOUNDS, { layout: "horizontal" })).toBeUndefined();
  });

  it("moves a vertical bar with the block arrows, down growing the upper panel", () => {
    expect(splitterKey(KEY("ArrowDown"), 50, BOUNDS, { layout: "vertical" })).toBe(51);
    expect(splitterKey(KEY("ArrowUp"), 50, BOUNDS, { layout: "vertical" })).toBe(49);
  });

  it("leaves the inline arrows to the page on a vertical bar", () => {
    expect(splitterKey(KEY("ArrowLeft"), 50, BOUNDS, { layout: "vertical" })).toBeUndefined();
    expect(splitterKey(KEY("ArrowRight"), 50, BOUNDS, { layout: "vertical" })).toBeUndefined();
  });

  it("does not mirror a vertical bar in RTL", () => {
    // `direction` mirrors the inline axis only. A vertical splitter's keys are
    // block-axis keys, and flipping them in RTL would make Down shrink the top
    // panel in Arabic and grow it in English for the same gesture.
    expect(splitterKey(KEY("ArrowDown"), 50, BOUNDS, { layout: "vertical", rtl: true })).toBe(51);
    expect(splitterKey(KEY("ArrowUp"), 50, BOUNDS, { layout: "vertical", rtl: true })).toBe(49);
  });

  it("takes a bigger bite with shift and with page keys", () => {
    expect(
      splitterKey(KEY("ArrowRight", { shiftKey: true }), 50, BOUNDS, { layout: "horizontal" })
    ).toBe(60);
    expect(splitterKey(KEY("PageUp"), 50, BOUNDS, { layout: "horizontal" })).toBe(60);
  });

  it("sends a vertical bar's page keys the same way as its arrows", () => {
    // The bug this replaces: the vertical branch remapped the four arrows and
    // handed the page keys straight through, so PageDown ran `numericKey`'s
    // slider meaning — bigger — while ArrowDown and Shift+ArrowDown ran the
    // splitter's, which is that Down grows the UPPER panel. The same gesture one
    // key apart moved the boundary in two directions.
    //
    // Asserted against the arrow rather than against a literal, because a
    // literal is exactly what encoded the bug last time: whichever way the pair
    // points, the three keys have to agree.
    const down = splitterKey(KEY("ArrowDown"), 50, BOUNDS, { layout: "vertical" })!;
    const bigDown = splitterKey(KEY("ArrowDown", { shiftKey: true }), 50, BOUNDS, {
      layout: "vertical",
    })!;
    const pageDown = splitterKey(KEY("PageDown"), 50, BOUNDS, { layout: "vertical" })!;
    const pageUp = splitterKey(KEY("PageUp"), 50, BOUNDS, { layout: "vertical" })!;

    expect(Math.sign(down - 50)).toBe(1);
    expect(Math.sign(bigDown - 50)).toBe(Math.sign(down - 50));
    expect(Math.sign(pageDown - 50)).toBe(Math.sign(down - 50));
    expect(Math.sign(pageUp - 50)).toBe(-Math.sign(down - 50));
    // And a page key is still the bigger bite, or "agrees with the arrow" would
    // be satisfied by mapping both to the same 1% step.
    expect(Math.abs(pageDown - 50)).toBeGreaterThan(Math.abs(down - 50));
    expect(pageDown).toBe(60);
    expect(pageUp).toBe(40);
  });

  it("jumps to the reachable extremes with Home and End, in both layouts", () => {
    const bounds = { min: 20, max: 80 };
    expect(splitterKey(KEY("Home"), 50, bounds, { layout: "horizontal" })).toBe(20);
    expect(splitterKey(KEY("End"), 50, bounds, { layout: "vertical" })).toBe(80);
  });

  it("stays inside the bounds it was given", () => {
    const bounds = { min: 20, max: 80 };
    expect(splitterKey(KEY("ArrowLeft"), 20, bounds, { layout: "horizontal" })).toBe(20);
    expect(splitterKey(KEY("ArrowRight"), 80, bounds, { layout: "horizontal" })).toBe(80);
  });

  it("keeps out of the way of a browser shortcut", () => {
    expect(
      splitterKey(KEY("ArrowRight", { ctrlKey: true }), 50, BOUNDS, { layout: "horizontal" })
    ).toBeUndefined();
    expect(
      splitterKey(KEY("ArrowDown", { metaKey: true }), 50, BOUNDS, { layout: "vertical" })
    ).toBeUndefined();
  });

  it("says nothing about a key that is nobody's", () => {
    expect(splitterKey(KEY("a"), 50, BOUNDS, { layout: "horizontal" })).toBeUndefined();
    expect(splitterKey(KEY("Enter"), 50, BOUNDS, { layout: "vertical" })).toBeUndefined();
  });
});
