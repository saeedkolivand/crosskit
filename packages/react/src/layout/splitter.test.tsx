import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Splitter } from "./splitter";

const root = () =>
  document.querySelector<HTMLElement>('[data-scope="splitter"][data-part="root"]')!;
const bars = () => [...document.querySelectorAll<HTMLElement>('[data-part="bar"]')];
const panels = () => [...document.querySelectorAll<HTMLElement>('[data-part="panel"]')];
const grow = (panel: HTMLElement) => Number(panel.style.getPropertyValue("--ck-splitter-size"));
/** Every panel's grow factor, past the last bit of floating-point noise. */
const shares = () => panels().map(panel => Math.round(grow(panel) * 1e6) / 1e6);

/** Two equal panels, the shape most assertions here only need one of. */
const Pair = (props: Record<string, unknown> = {}) => (
  <Splitter {...props}>
    <Splitter.Panel>one</Splitter.Panel>
    <Splitter.Panel>two</Splitter.Panel>
  </Splitter>
);

// jsdom reports every rect as 0x0, and everything that turns a length into a
// percentage — the px grammar, the drag delta, the callback payload — divides by
// the measured length. Without a stub those paths take their "unmeasured" branch
// and are unreachable from here. Module scope, because three describes need it.
const realRect = Element.prototype.getBoundingClientRect;
/** Give every panel a `size`×`size` box and every bar none. Call before render. */
const layOut = (size: number) => {
  Element.prototype.getBoundingClientRect = function () {
    return this.getAttribute("data-part") === "panel"
      ? ({ width: size, height: size } as DOMRect)
      : ({ width: 0, height: 0 } as DOMRect);
  };
};
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

describe("Splitter structure", () => {
  it("interleaves one bar fewer than it has panels", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    expect(panels()).toHaveLength(3);
    expect(bars()).toHaveLength(2);
    // Interleaved, not appended: the bars have to sit between the panels in
    // document order or flexbox lays them all out at one end.
    expect([...root().children].map(child => child.getAttribute("data-part"))).toEqual([
      "panel",
      "bar",
      "panel",
      "bar",
      "panel",
    ]);
  });

  it("puts the scope on every part, not only the root", () => {
    // The reset's one rule is `[data-scope][data-part]`, so a part carrying only
    // `data-part` lands on `content-box` and is a border wider than the number
    // that positioned it.
    render(<Pair />);
    for (const part of [...panels(), ...bars()])
      expect(part).toHaveAttribute("data-scope", "splitter");
  });

  it("splits an undeclared row evenly", () => {
    render(<Pair />);
    expect(shares()).toEqual([50, 50]);
  });

  it("honours a declared percent and gives the rest away", () => {
    render(
      <Splitter>
        <Splitter.Panel defaultSize="20%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    expect(shares()).toEqual([20, 40, 40]);
  });

  it("reads a bare number as pixels against the measured length", () => {
    // The whole px half of the grammar hangs off the mount-time measurement, and
    // with the length unmeasured `parsePanelSize` deliberately says nothing and
    // this falls back to an even split. 25/75 is what tells the two apart —
    // a symmetric fixture reads the same whether the measurement happened or not.
    layOut(100); // two panels, so 200px of resizable length
    render(
      <Splitter>
        <Splitter.Panel size={50}>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    expect(shares()).toEqual([25, 75]);
  });

  it("reads a px string on min against the same length", () => {
    layOut(100);
    render(
      <Splitter>
        <Splitter.Panel min="150px">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    // 150 of 200 is 75%, so the floor pushes the panel off the even split and
    // the bar reports it. Unmeasured, the min parses to nothing: 50/50 and a
    // valuemin of 0.
    expect(shares()).toEqual([75, 25]);
    expect(bars()[0]).toHaveAttribute("aria-valuemin", "75");
  });

  it("keeps the panel's own props off the DOM", () => {
    render(
      <Splitter>
        <Splitter.Panel defaultSize="20%" min="10%" collapsible resizable={false}>
          a
        </Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    for (const name of ["size", "defaultsize", "min", "max", "collapsible", "resizable"])
      expect(panels()[0]!.hasAttribute(name)).toBe(false);
  });

  it("lands a consumer's class and attributes on the root untouched", () => {
    render(<Pair className="mine" data-testid="outer" aria-label="panes" />);
    expect(root()).toHaveClass("mine");
    expect(root()).toHaveAttribute("data-testid", "outer");
    expect(root()).toHaveAttribute("aria-label", "panes");
  });

  it("still renders a panel used on its own", () => {
    render(<Splitter.Panel>lonely</Splitter.Panel>);
    expect(screen.getByText("lonely")).toHaveAttribute("data-part", "panel");
    // No context, so no inline size — the CSS fallback of 1 is what should
    // apply, and writing 0 here would render the panel invisible instead.
    expect(panels()[0]!.style.getPropertyValue("--ck-splitter-size")).toBe("");
  });
});

describe("Splitter orientation", () => {
  it("marks the layout on the root and on every bar", () => {
    // Duplicated on purpose: it lets every CSS rule be flat, so a horizontal
    // splitter nested in a vertical one cannot have its bars claimed by the
    // outer orientation through a descendant combinator.
    render(<Pair layout="vertical" />);
    expect(root()).toHaveAttribute("data-orientation", "vertical");
    expect(bars()[0]).toHaveAttribute("data-orientation", "vertical");
  });

  it("gives a horizontal splitter a VERTICAL separator", () => {
    render(<Pair layout="horizontal" />);
    expect(bars()[0]).toHaveAttribute("aria-orientation", "vertical");
  });

  it("gives a vertical splitter a HORIZONTAL separator", () => {
    // Both layouts, because one alone cannot tell "the perpendicular" from a
    // constant — and `separator` defaults to `horizontal`, so an inverted
    // mapping is silently wrong rather than missing.
    render(<Pair layout="vertical" />);
    expect(bars()[0]).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("has the bar's two orientation attributes disagree, which is the design", () => {
    render(<Pair layout="horizontal" />);
    const bar = bars()[0]!;
    expect(bar.getAttribute("data-orientation")).not.toBe(bar.getAttribute("aria-orientation"));
  });
});

describe("Splitter presence attributes", () => {
  it("omits every boolean state rather than writing it false", () => {
    render(<Pair />);
    // `"false"` matches `[data-collapsed]` in CSS, so a panel that is not
    // collapsed would pick up the collapsed rules and nothing would say why.
    expect(root().hasAttribute("data-dragging")).toBe(false);
    expect(panels()[0]!.hasAttribute("data-collapsed")).toBe(false);
    expect(bars()[0]!.hasAttribute("data-active")).toBe(false);
    expect(bars()[0]!.hasAttribute("data-disabled")).toBe(false);
    expect(bars()[0]!.hasAttribute("aria-disabled")).toBe(false);
  });

  it("writes them empty when they are on", () => {
    render(
      <Splitter>
        <Splitter.Panel resizable={false}>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    expect(bars()[0]!.getAttribute("data-disabled")).toBe("");
    expect(bars()[0]).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Splitter bar ARIA", () => {
  it("reports the four-way window, not the leading panel's own limits", () => {
    render(
      <Splitter>
        <Splitter.Panel min="10%">a</Splitter.Panel>
        <Splitter.Panel min="20%">b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    // Panels at 33.33 each, so the first bar's pair shares 66.67. Its own floor
    // is 10 and its ceiling is what the second panel's floor leaves: 46.67.
    // An implementation reading `a.min`/`a.max` straight off the props would say
    // 10 and 100, so the max is the half that distinguishes them.
    expect(bars()[0]).toHaveAttribute("aria-valuemin", "10");
    expect(bars()[0]).toHaveAttribute("aria-valuemax", "47");
    expect(bars()[0]).toHaveAttribute("aria-valuenow", "33");
  });

  it("is a tab stop, and not a dead one when frozen", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel resizable={false}>b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    // The second panel freezes both bars touching it, and the second bar is the
    // one between it and a resizable neighbour — so a check on the first alone
    // would pass for an implementation that only looked at the leading panel.
    expect(bars()[0]).toHaveAttribute("tabindex", "-1");
    expect(bars()[1]).toHaveAttribute("tabindex", "-1");
  });

  it("keeps a bar between two resizable panels focusable", () => {
    render(<Pair />);
    expect(bars()[0]).toHaveAttribute("tabindex", "0");
    expect(bars()[0]).toHaveAttribute("role", "separator");
  });
});

describe("Splitter keyboard", () => {
  it("moves the boundary one percent per arrow", () => {
    render(<Pair />);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    expect(shares()).toEqual([51, 49]);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowLeft" });
    expect(shares()).toEqual([50, 50]);
  });

  it("moves a vertical splitter with the block arrows", () => {
    render(<Pair layout="vertical" />);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowDown" });
    expect(shares()).toEqual([51, 49]);
  });

  it("leaves the other axis' arrows to the page", () => {
    render(<Pair />);
    const scrolled = fireEvent.keyDown(bars()[0]!, { key: "ArrowDown" });
    // `fireEvent` returns false when something called preventDefault. A bar that
    // swallows Down stops the page scrolling while it has focus, and the sizes
    // staying put cannot tell that apart from handling it and clamping.
    expect(scrolled).toBe(true);
    expect(shares()).toEqual([50, 50]);
  });

  it("claims the keys that are its own", () => {
    render(<Pair />);
    expect(fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" })).toBe(false);
  });

  it("stops at the pair's four-way bound rather than the panel's own", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel max="30%">b</Splitter.Panel>
      </Splitter>
    );
    for (let i = 0; i < 40; i++) fireEvent.keyDown(bars()[0]!, { key: "ArrowLeft" });
    // Dragging left grows the trailing panel, and its own ceiling is what has to
    // stop it — the leading panel has no minimum of its own to hit.
    expect(shares()).toEqual([70, 30]);
  });

  it("does not even claim the key through a frozen bar", () => {
    render(
      <Splitter>
        <Splitter.Panel resizable={false}>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    const scrolled = fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // The sizes are the assertion that cannot fail: `resizePanels` freezes the
    // pair by itself, so they stay 50/50 with the adapter's guard deleted and
    // pin nothing. What the guard is for is visible one level up — a frozen bar
    // that still calls preventDefault swallows the keystroke, and the key does
    // nothing anywhere on the page rather than doing nothing here.
    expect(scrolled).toBe(true);
    expect(shares()).toEqual([50, 50]);
  });

  it("jumps to the reachable end with End", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel min="25%">b</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "End" });
    expect(shares()).toEqual([75, 25]);
  });
});

describe("Splitter collapse", () => {
  const Collapsible = () => (
    <Splitter>
      <Splitter.Panel min="20%" collapsible>
        a
      </Splitter.Panel>
      <Splitter.Panel>b</Splitter.Panel>
    </Splitter>
  );

  it("closes the leading panel on Enter and marks it collapsed", () => {
    render(<Collapsible />);
    fireEvent.keyDown(bars()[0]!, { key: "Enter" });
    expect(shares()).toEqual([0, 100]);
    expect(panels()[0]!.getAttribute("data-collapsed")).toBe("");
  });

  it("restores the size it had rather than a default", () => {
    render(<Collapsible />);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    fireEvent.keyDown(bars()[0]!, { key: "Enter" });
    fireEvent.keyDown(bars()[0]!, { key: "Enter" });
    // 52, not 50: restoring to half would look right from a 50/50 start and be
    // wrong everywhere else, which is the case a symmetric fixture cannot see.
    expect(shares()).toEqual([52, 48]);
  });

  it("does the same on a double-click", () => {
    render(<Collapsible />);
    fireEvent.doubleClick(bars()[0]!);
    expect(shares()).toEqual([0, 100]);
  });

  it("puts no interactive content inside the separator", () => {
    // `role="separator"` is in ARIA's presentational-children list, so a
    // collapse button in there is dropped from the accessibility tree entirely.
    render(<Collapsible />);
    expect(bars()[0]!.children).toHaveLength(0);
  });

  it("refuses to close a panel that was not told it may", () => {
    render(
      <Splitter>
        <Splitter.Panel min="20%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "Enter" });
    expect(shares()).toEqual([20, 80]);
  });

  it("closes the TRAILING panel too, which is the other half of collapsible", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel min="20%" collapsible>
          b
        </Splitter.Panel>
      </Splitter>
    );
    // `true` means from either side, and every other collapse assertion here is
    // about the leading panel — so a `collapsible` that only ever set `start`
    // would pass all of them. End walks to the far bound, which is the whole
    // budget only when the trailing panel may be squashed out of existence.
    fireEvent.keyDown(bars()[0]!, { key: "End" });
    expect(shares()).toEqual([100, 0]);
    expect(panels()[1]!.getAttribute("data-collapsed")).toBe("");
  });

  it("takes the object form, one named side at a time", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel min="20%" collapsible={{ end: true }}>
          b
        </Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "End" });
    expect(shares()).toEqual([100, 0]);
  });

  it("leaves the side the object form did not name shut", () => {
    render(
      <Splitter>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel min="20%" collapsible={{ start: true }}>
          b
        </Splitter.Panel>
      </Splitter>
    );
    // The control for the test above, and the reason the object form is not a
    // boolean: `start` on the trailing panel names the bar AFTER it, of which
    // there is none. An implementation that read any object as "both sides"
    // passes the previous test and collapses this one to zero.
    fireEvent.keyDown(bars()[0]!, { key: "End" });
    expect(shares()).toEqual([80, 20]);
  });

  it("reports zero as a reachable value once the panel may collapse", () => {
    render(<Collapsible />);
    fireEvent.keyDown(bars()[0]!, { key: "Enter" });
    // Otherwise this is `valuenow="0"` against `valuemin="20"`, which is invalid
    // ARIA rather than merely untidy.
    expect(bars()[0]).toHaveAttribute("aria-valuenow", "0");
    expect(bars()[0]).toHaveAttribute("aria-valuemin", "0");
  });
});

describe("Splitter callbacks", () => {
  it("fires onResizeEnd once per keyboard step", () => {
    const onResizeEnd = vi.fn();
    render(<Pair onResizeEnd={onResizeEnd} />);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it("hands onResizeEnd pixels, not the percentages it works in", () => {
    layOut(100); // 200px of resizable length
    const onResizeEnd = vi.fn();
    render(<Pair onResizeEnd={onResizeEnd} />);
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // The prop is documented as px and everything inside is percent, so the one
    // conversion between them is the whole contract. A call-count assertion
    // cannot tell 102 from 51 from 0.51, and the unstubbed measurement makes all
    // three of them zero — which is why this fixture has a length at all.
    const payload = onResizeEnd.mock.calls[0]![0] as number[];
    expect(payload[0]).toBeCloseTo(102, 6);
    expect(payload[1]).toBeCloseTo(98, 6);
  });

  it("stays quiet on a key that moved nothing", () => {
    const onResize = vi.fn();
    render(
      <Splitter onResize={onResize}>
        <Splitter.Panel max="50%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // Already at its ceiling. Without the element-wise comparison this is one
    // identical call per event, which is ~120 a second against a hard stop
    // during a drag.
    expect(onResize).not.toHaveBeenCalled();
  });

  it("reports one number per panel", () => {
    const onResize = vi.fn();
    render(
      <Splitter onResize={onResize}>
        <Splitter.Panel>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // The px values are all zero here — jsdom has no layout — so the payload's
    // shape is all this layer can honestly check. The numbers themselves are
    // asserted against measured widths in the Playwright spec.
    expect(onResize.mock.calls[0]![0]).toHaveLength(3);
  });
});

describe("Splitter controlled sizes", () => {
  it("lets the prop win over anything the keyboard did", () => {
    render(
      <Splitter>
        <Splitter.Panel size="30%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    for (let i = 0; i < 10; i++) fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // Resolved on read rather than synced by an effect, so there is no render in
    // which the state and the prop disagree — not even the one right after the
    // event. Ten presses rather than one: a prop that merely seeded the state
    // would sit at 40 by now, and a resolution that drifted a little per press
    // would be indistinguishable from a correct one after a single press.
    expect(shares()[0]).toBeCloseTo(30, 0);
  });

  it("still reports what the consumer would have to set", () => {
    const onResize = vi.fn();
    render(
      <Splitter onResize={onResize}>
        <Splitter.Panel size="30%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it("lets what was dragged win over defaultSize", () => {
    render(
      <Splitter>
        <Splitter.Panel defaultSize="20%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[0]!, { key: "ArrowRight" });
    // The second hop of `size ?? dragged ?? defaultSize`. Only the first hop was
    // pinned: `defaultSize` ahead of the dragged state still honours the prop on
    // the first render, so the existing defaultSize assertion — which presses
    // nothing — passes either way. With the order swapped the panel snaps back
    // to 20 on the very next render and the bar cannot be moved at all.
    expect(shares()).toEqual([21, 79]);
  });

  it("drives an uncontrolled sibling from state while the controlled one holds", () => {
    render(
      <Splitter>
        <Splitter.Panel size="30%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
        <Splitter.Panel>c</Splitter.Panel>
      </Splitter>
    );
    fireEvent.keyDown(bars()[1]!, { key: "ArrowRight" });
    expect(shares()).toEqual([30, 36, 34]);
  });
});

describe("Splitter pointer drag", () => {
  const press = (bar: HTMLElement, coord: number) =>
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: coord, clientY: coord });
  const move = (bar: HTMLElement, coord: number) =>
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: coord, clientY: coord });

  it("takes pointer capture, so a drag that leaves the 8px bar keeps tracking", () => {
    layOut(100);
    const capture = vi.spyOn(Element.prototype, "setPointerCapture");
    render(<Pair />);
    press(bars()[0]!, 100);
    expect(capture).toHaveBeenCalledWith(1);
    capture.mockRestore();
  });

  it("marks the root and the bar for the duration of the drag", () => {
    layOut(100);
    render(<Pair />);
    press(bars()[0]!, 100);
    // `data-active` rather than `:hover`: pointer capture makes `:hover` follow
    // the capture target in some engines and not others.
    expect(root().getAttribute("data-dragging")).toBe("");
    expect(bars()[0]!.getAttribute("data-active")).toBe("");
    fireEvent.pointerUp(bars()[0]!, { pointerId: 1 });
    expect(root().hasAttribute("data-dragging")).toBe(false);
  });

  it("measures every move from the origin rather than accumulating", () => {
    layOut(100);
    render(<Pair />);
    // 200px of panel, so 20px is 10%.
    press(bars()[0]!, 100);
    move(bars()[0]!, 120);
    expect(shares()).toEqual([60, 40]);
    move(bars()[0]!, 140);
    // 40 from the origin, not 20 more than the last move. Accumulating gives 70
    // here, which is only visibly wrong once a bound has swallowed some of it.
    expect(shares()).toEqual([70, 30]);
  });

  it("re-attaches to the pointer after it has pushed past a bound", () => {
    layOut(100);
    render(
      <Splitter>
        <Splitter.Panel min="30%">a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    press(bars()[0]!, 100);
    move(bars()[0]!, 20); // −40%, well past the 30% floor
    expect(shares()).toEqual([30, 70]);
    move(bars()[0]!, 90); // −5% from the origin, which is inside the floor again
    // An accumulated delta discards the 10% the floor swallowed, so the bar
    // would jump to 25 here and never line up with the pointer again.
    expect(shares()).toEqual([45, 55]);
  });

  it("ends the drag when the browser takes the gesture away", () => {
    layOut(100);
    const onResizeEnd = vi.fn();
    render(<Pair onResizeEnd={onResizeEnd} />);
    press(bars()[0]!, 100);
    fireEvent.pointerCancel(bars()[0]!, { pointerId: 1 });
    // Without a pointercancel handler the drag runs forever and every later
    // pointermove anywhere keeps resizing.
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    move(bars()[0]!, 180);
    expect(shares()).toEqual([50, 50]);
  });

  it("refuses to start when there is nothing to measure", () => {
    // A `display: none` splitter measures zero, and `delta / 0 * 100` is
    // Infinity — which reaches `flex-grow` as NaN and blanks the layout.
    layOut(0);
    render(<Pair />);
    press(bars()[0]!, 100);
    move(bars()[0]!, 180);
    expect(shares()).toEqual([50, 50]);
    expect(root().hasAttribute("data-dragging")).toBe(false);
  });

  it("ignores a secondary button", () => {
    layOut(100);
    render(<Pair />);
    fireEvent.pointerDown(bars()[0]!, { button: 2, pointerId: 1, clientX: 100 });
    expect(root().hasAttribute("data-dragging")).toBe(false);
  });

  it("never starts a gesture on a frozen bar", () => {
    layOut(100);
    const capture = vi.spyOn(Element.prototype, "setPointerCapture");
    render(
      <Splitter>
        <Splitter.Panel resizable={false}>a</Splitter.Panel>
        <Splitter.Panel>b</Splitter.Panel>
      </Splitter>
    );
    press(bars()[0]!, 100);
    move(bars()[0]!, 180);
    // Again the sizes hold whatever the adapter does, so the capture is the
    // assertion with something to say: a bar that captures the pointer and then
    // moves nothing swallows every pointer event on the page until it is
    // released, and paints the whole root as dragging while it does.
    expect(capture).not.toHaveBeenCalled();
    expect(root().hasAttribute("data-dragging")).toBe(false);
    expect(shares()).toEqual([50, 50]);
    capture.mockRestore();
  });
});
