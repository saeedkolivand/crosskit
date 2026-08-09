import { test, expect, type Page } from "@playwright/test";

/**
 * Splitter's browser-only half.
 *
 * jsdom reports every rect as 0x0 and has no generated content, no `:hover`, no
 * cursor and no pointer capture — so the tiling arithmetic, the 1px seam inside
 * an 8px hit area, the RTL mirror and a drag that leaves the bar all have to be
 * asserted here or not at all.
 */

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rects = (page: Page, selector: string): Promise<Rect[]> =>
  page.locator(selector).evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
  );

const rect = async (page: Page, selector: string): Promise<Rect> =>
  (await rects(page, selector))[0]!;

/** Press the middle of a bar, move, release. `dy` moves off the bar entirely. */
async function drag(page: Page, bar: string, dx: number, dy = 0) {
  // Scrolled into view first, and the box read afterwards: `boundingBox` is
  // viewport-relative, and `page.mouse` on a coordinate below the fold presses
  // nothing at all — silently, with the layout unchanged and no error.
  await page.locator(bar).first().scrollIntoViewIfNeeded();
  const box = (await page.locator(bar).first().boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

const token = (page: Page, name: string) =>
  page.locator("#tile").evaluate((el, prop) => {
    const value = getComputedStyle(el).getPropertyValue(prop).trim();
    // Resolved through a throwaway element, because a custom property's
    // computed value is the token name and not the colour it stands for.
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, name);

test.beforeEach(async ({ page }) => {
  await page.goto("/splitter.html");
  await expect(page.locator('#tile [data-part="bar"]')).toHaveCount(2);
});

test("tiles the container exactly at every width", async ({ page }) => {
  for (const width of [400, 900, 1600]) {
    await page.locator("#tile-box").evaluate((el, w) => {
      (el as HTMLElement).style.inlineSize = `${w}px`;
    }, width);

    const root = await rect(page, "#tile");
    const parts = [
      ...(await rects(page, '#tile > [data-part="panel"]')),
      ...(await rects(page, '#tile > [data-part="bar"]')),
    ];
    const total = parts.reduce((sum, part) => sum + part.w, 0);

    // The whole reason the percentages are of the panels' own length rather
    // than the container's: a bar-sized over-allocation would show up here as
    // a few pixels of overflow, and nowhere else.
    expect(Math.abs(total - root.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(root.w - width)).toBeLessThanOrEqual(1);
    const overflow = await page.locator("#tile").evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("keeps the ratio through a container resize, with no JavaScript", async ({ page }) => {
  // 1200 wide, one 8px bar, so the panels divide 1192 and 30% is 357.6.
  await drag(page, '#ratio [data-part="bar"]', Math.round(0.3 * 1192 - 596));
  const before = await rects(page, '#ratio > [data-part="panel"]');
  expect(before[0]!.w / (before[0]!.w + before[1]!.w)).toBeCloseTo(0.3, 2);

  await page.locator("#ratio-box").evaluate(el => {
    (el as HTMLElement).style.inlineSize = "700px";
  });
  const after = await rects(page, '#ratio > [data-part="panel"]');
  // Nothing observes the container — the percentage lives in `flex-grow`
  // against a zero basis, so flexbox re-divides the ratio by itself. A
  // `flex-basis: calc(30% - Npx)` implementation drifts here instead.
  expect(after[0]!.w + after[1]!.w).toBeCloseTo(692, 0);
  expect(after[0]!.w / (after[0]!.w + after[1]!.w)).toBeCloseTo(0.3, 2);
});

test("gives the bar a real hit area around a hairline seam", async ({ page }) => {
  const bar = await rect(page, '#tile [data-part="bar"]');
  expect(bar.w).toBeGreaterThanOrEqual(8);

  const seam = await page
    .locator('#tile [data-part="bar"]')
    .first()
    .evaluate(el => getComputedStyle(el, "::before").width);
  // One node, not two: the seam is generated content, which is invisible to
  // jsdom either way — and pointing a 1px element at the user would make the
  // splitter almost undraggable.
  expect(seam).toBe("1px");
});

/** The `::before` seam's own box, in the bar's coordinates. */
const seamBox = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate(el => {
      const style = getComputedStyle(el, "::before");
      const px = (value: string) => Number.parseFloat(value) || 0;
      return {
        // Chrome resolves both physical insets to used values for a positioned
        // pseudo-element, so the offset has to be read from one edge and the
        // margin on that same edge — `right: auto` is never what comes back.
        x: px(style.left) + px(style.marginLeft),
        y: px(style.top) + px(style.marginTop),
        w: px(style.width),
        h: px(style.height),
      };
    });

/** The `::before` seam's two physical inline margins, as the browser resolves them. */
const seamMargins = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate(el => {
      const style = getComputedStyle(el, "::before");
      return { start: style.marginLeft, end: style.marginRight };
    });

for (const [id, direction] of [
  ["tile", "ltr"],
  ["rtl", "rtl"],
] as const) {
  test(`centres the seam across the bar, ${direction}`, async ({ page }) => {
    const bar = await rect(page, `#${id} [data-part="bar"]`);
    const seam = await seamBox(page, `#${id} [data-part="bar"]`);

    // Centred, and spanning the bar on the other axis. This half is deliberately
    // invariant — a centred 1px line in an 8px bar is centred in either
    // direction — so it catches a future `inset-inline-start: 0` or a stray
    // `translate` and nothing about RTL.
    expect(seam.x + seam.w / 2).toBeCloseTo(bar.w / 2, 1);
    expect(seam.h).toBeCloseTo(bar.h, 1);

    // This half is what the RTL run earns. `margin-inline-start` has to land on
    // the RIGHT margin under `dir="rtl"`; a physical `margin-left: -0.5px`
    // centres the seam identically in both directions and passes every
    // assertion above, and only ever shows up as the offset sitting on the
    // wrong side of the box.
    const margins = await seamMargins(page, `#${id} [data-part="bar"]`);
    const [inlineStart, inlineEnd] =
      direction === "rtl" ? [margins.end, margins.start] : [margins.start, margins.end];
    expect(inlineStart).toBe("-0.5px");
    expect(inlineEnd).toBe("0px");
  });
}

test("turns the seam through 90 degrees for a vertical splitter", async ({ page }) => {
  const bar = await rect(page, '#vertical [data-part="bar"]');
  const seam = await seamBox(page, '#vertical [data-part="bar"]');

  // The axes swap: a 1px line down the middle becomes a 1px line across it.
  // Without the `margin-inline-start: 0` reset the inherited horizontal margin
  // pulls this one half a pixel out of the bar on the wrong axis.
  expect(seam.h).toBeCloseTo(1, 1);
  expect(seam.w).toBeCloseTo(bar.w, 1);
  expect(seam.y + seam.h / 2).toBeCloseTo(bar.h / 2, 1);
  expect(seam.x).toBeCloseTo(0, 1);
});

test("keeps tracking a drag that has left the bar", async ({ page }) => {
  const before = await rects(page, '#tile > [data-part="panel"]');
  // 200px away on the cross axis first, so the pointer is nowhere near the 8px
  // bar for the rest of the gesture. Without pointer capture the drag dies on
  // the very first move.
  const box = (await page.locator('#tile [data-part="bar"]').first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + 200, { steps: 8 });
  await page.mouse.up();

  const after = await rects(page, '#tile > [data-part="panel"]');
  expect(after[0]!.w - before[0]!.w).toBeCloseTo(150, 0);
});

test("moves the boundary under the pointer in RTL, not away from it", async ({ page }) => {
  const before = await rects(page, '#rtl > [data-part="panel"]');
  await drag(page, '#rtl [data-part="bar"]', 100);
  const after = await rects(page, '#rtl > [data-part="panel"]');

  // The leading panel is the rightmost one, so moving the pointer right shrinks
  // it. An un-mirrored delta grows it instead and the bar runs away from the
  // pointer at twice the speed.
  expect(before[0]!.w - after[0]!.w).toBeCloseTo(100, 0);
  expect(after[0]!.x).toBeGreaterThan(before[0]!.x);
});

test("stops at the bound the NEIGHBOUR imposes, not only its own", async ({ page }) => {
  // 600 wide, 8px bar, so the panels divide 592. The leading panel's own floor
  // is 20% (118.4px), but the trailing panel's 60% ceiling stops it at 40%
  // (236.8px) first — the term a one-sided clamp drops, and the only one of the
  // two that can tell a correct implementation from a half one.
  await drag(page, '#bounds [data-part="bar"]', -400);
  const panels = await rects(page, '#bounds > [data-part="panel"]');
  expect(panels[0]!.w).toBeCloseTo(0.4 * 592, 0);
  expect(panels[1]!.w).toBeCloseTo(0.6 * 592, 0);
});

test("snaps a collapsible panel shut, and back out to its floor", async ({ page }) => {
  const bar = '#collapse [data-part="bar"]';
  // Floor 20% of 592 = 118.4, so the midpoint is 59.2 and a 260px pull is well
  // past it.
  await drag(page, bar, -260);
  let panels = await rects(page, '#collapse > [data-part="panel"]');
  expect(panels[0]!.w).toBe(0);
  await expect(page.locator('#collapse > [data-part="panel"]').first()).toHaveAttribute(
    "data-collapsed",
    ""
  );

  // Back out past the midpoint: it jumps straight to the floor rather than
  // crawling. Without the midpoint rule every value from 1 to 118 clamps back
  // to zero and the panel reads as stuck.
  await drag(page, bar, 80);
  panels = await rects(page, '#collapse > [data-part="panel"]');
  expect(panels[0]!.w).toBeCloseTo(0.2 * 592, 0);
});

test("suppresses text selection for the length of a drag, and only that", async ({ page }) => {
  const selectable = () =>
    page.locator("#tile").evaluate(el => getComputedStyle(el).userSelect !== "none");

  // Asserted on both sides of the drag, not just during it. Chrome happens not
  // to start a selection from a captured pointer on this fixture, so "nothing
  // was selected" holds with or without the rule and cannot fail — and a rule
  // applied unconditionally would break ordinary selection while passing every
  // during-the-drag assertion.
  expect(await selectable()).toBe(true);

  await page.locator('#tile [data-part="bar"]').first().scrollIntoViewIfNeeded();
  const box = (await page.locator('#tile [data-part="bar"]').first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
  expect(await selectable()).toBe(false);

  await page.mouse.up();
  expect(await selectable()).toBe(true);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
});

test("gives each bar the cursor for its own axis, nesting included", async ({ page }) => {
  const cursor = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate(el => getComputedStyle(el).cursor);

  expect(await cursor('#tile [data-part="bar"]')).toBe("col-resize");
  expect(await cursor('#vertical [data-part="bar"]')).toBe("row-resize");
  // The nested pair is the point: `data-orientation` is stamped on every bar as
  // well as the root, so no rule needs a combinator reaching down from the root
  // and the outer orientation cannot claim the inner bar's cursor.
  expect(await cursor('#inner [data-part="bar"]')).toBe("col-resize");
  expect(await cursor('#outer > [data-part="bar"]')).toBe("row-resize");
});

test("says a frozen bar does not move, in either layout", async ({ page }) => {
  const cursor = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate(el => getComputedStyle(el).cursor);

  expect(await cursor('#frozen [data-part="bar"]')).toBe("default");
  // The vertical one is the half that reads the guard rather than the rule.
  // `[data-orientation="vertical"]` and `[data-disabled]` are both (0,3,0) on
  // this element, and the disabled rule is deliberately written FIRST in the
  // stylesheet — so if `:not([data-disabled])` were dropped, the row-resize
  // rule would win on source order and a frozen bar would advertise a drag that
  // cannot happen. Deleting the guard alone turns this line red; that is the
  // whole point of the ordering.
  expect(await cursor('#frozen-vertical [data-part="bar"]')).toBe("default");
});

test("keeps a bar being dragged in its active colour while hovered", async ({ page }) => {
  const seamColour = () =>
    page
      .locator('#tile [data-part="bar"]')
      .first()
      .evaluate(el => getComputedStyle(el, "::before").backgroundColor);

  const box = (await page.locator('#tile [data-part="bar"]').first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const hovered = await seamColour();
  expect(hovered).toBe(await token(page, "--ck-border-hover"));

  await page.mouse.down();
  // Still under the pointer, so an unguarded `:hover` would match too — and it
  // and the `[data-active]` rule are both (0,3,1), an exact tie that only
  // source order breaks. The guard is what settles it instead.
  const dragging = await seamColour();
  await page.mouse.up();
  expect(dragging).toBe(await token(page, "--ck-accent-solid"));
});

test("reports pixel sizes that match the panels on screen", async ({ page }) => {
  await drag(page, '#tile [data-part="bar"]', 120);
  const reported: number[] = JSON.parse(await page.locator("#payload").innerText());
  const measured = (await rects(page, '#tile > [data-part="panel"]')).map(part => part.w);

  expect(reported).toHaveLength(measured.length);
  for (const [index, value] of reported.entries()) expect(value).toBeCloseTo(measured[index]!, 0);
});

test("shrinks a panel below its own content rather than overflowing", async ({ page }) => {
  const panels = await rects(page, '#wide > [data-part="panel"]');
  const root = await rect(page, "#wide");
  // A flex item's automatic minimum size is its content's min-content size, so
  // a 2000px child otherwise pins the whole splitter and no amount of correct
  // percentage arithmetic helps.
  expect(panels[0]!.w).toBeLessThan(400);
  expect(Math.abs(root.w - 600)).toBeLessThanOrEqual(1);
  const overflow = await page.locator("#wide").evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("shrinks it even when the panel is not clipping its own content", async ({ page }) => {
  // The fixture above cannot see `min-inline-size: 0` at all: `overflow: hidden`
  // suppresses the automatic minimum size on its own, so removing the min leaves
  // that test green. This one turns the clipping off, which is what a consumer
  // does the moment they want something to escape a panel — and it is the only
  // place the min is the declaration doing the work.
  const panels = await rects(page, '#wide-visible > [data-part="panel"]');
  expect(panels[0]!.w).toBeLessThan(400);
});

/**
 * The root's own `inline-size: 100%`, `min-inline-size: 0` and
 * `min-block-size: 0` — all three invisible to every fixture above, because a
 * block-level root in a BLOCK parent already fills its parent's inline size and
 * already has no automatic minimum to lift. Only a flex or grid ITEM can tell a
 * present declaration from a deleted one, so each of the four below is a
 * separate box with a rigid sibling, and each isolates one declaration.
 */

test("fills the space a flex parent leaves it, not just its own content", async ({ page }) => {
  const root = await rect(page, "#flex-narrow");
  const sibling = await rect(page, "#flex-narrow-sibling");

  // A flex item does not grow to fill its parent. Content here is "a", an 8px
  // bar and "b", so without the root's own `inline-size: 100%` this is a ~20px
  // sliver in a 600px row — and no minimum can produce the 500 instead, which
  // is what makes this box the one that reads that declaration alone.
  expect(root.w).toBeCloseTo(500, 0);
  expect(sibling.w).toBeCloseTo(100, 0);
});

test("shrinks below its own content as a flex item, without displacing a sibling", async ({
  page,
}) => {
  const root = await rect(page, "#flex-wide");
  const sibling = await rect(page, "#flex-wide-sibling");

  // The panels already say `min-inline-size: 0`, and it is not enough: that
  // sets each panel's floor, it does not zero the panel's min-content
  // CONTRIBUTION to the root's intrinsic size. The root's automatic minimum
  // size is therefore still ~916px here, which overflows the 600px row and
  // pushes the 100px sibling out of it.
  expect(root.w).toBeCloseTo(500, 0);
  expect(sibling.w).toBeCloseTo(100, 0);
});

test("shrinks below its own content as a grid item too", async ({ page }) => {
  const root = await rect(page, "#grid-wide");
  const sibling = await rect(page, "#grid-sibling");

  // A grid item stretches to its area on its own, so `inline-size: 100%` is not
  // what is being read here — this box isolates the minimum. A `1fr` track's
  // floor is `auto`, i.e. the item's min-content contribution, so the same
  // ~916px pins the track open and the second column loses its 100px.
  expect(root.w).toBeCloseTo(500, 0);
  expect(sibling.w).toBeCloseTo(100, 0);
});

test("shrinks on the block axis as a column-flex item", async ({ page }) => {
  const root = await rect(page, "#flex-column");
  const sibling = await rect(page, "#flex-column-sibling");

  // The same automatic minimum, on the other axis, which needs its own fixture
  // because `min-inline-size: 0` cannot cover it: a 900px-tall child makes a
  // horizontal splitter 900px tall inside this 200px column parent.
  expect(root.h).toBeCloseTo(160, 0);
  expect(sibling.h).toBeCloseTo(40, 0);
});

test("gives a vertical splitter a height in an auto-height parent", async ({ page }) => {
  const root = await rect(page, "#vertical");
  const panels = await rects(page, '#vertical > [data-part="panel"]');
  // Panels are `flex-basis: 0`, so without the 12rem default every one of them
  // resolves to zero and the component is invisible with no error anywhere.
  expect(root.h).toBeCloseTo(192, 0);
  for (const panel of panels) expect(panel.h).toBeGreaterThan(50);
});

test("fills a parent that has its own height instead of keeping the default", async ({ page }) => {
  const root = await rect(page, "#vertical-tall");
  const panels = await rects(page, '#vertical-tall > [data-part="panel"]');
  // The other half of the test above, and the ordinary way anyone uses this:
  // 12rem has to be a FALLBACK. As a definite `block-size` it passes the
  // auto-height assertion and renders 192px inside this 320px box, ignoring the
  // parent entirely — which is why the two fixtures differ only in the parent.
  expect(root.h).toBeCloseTo(320, 0);
  expect(panels[0]!.h).toBeCloseTo(panels[1]!.h, 0);
  expect(panels[0]!.h + panels[1]!.h).toBeCloseTo(312, 0);
});

test("leaves the outer boundary alone when the inner bar moves", async ({ page }) => {
  const before = await rects(page, '#outer > [data-part="panel"]');
  await drag(page, '#inner [data-part="bar"]', 80);
  const after = await rects(page, '#outer > [data-part="panel"]');
  const inner = await rects(page, '#inner > [data-part="panel"]');

  expect(inner[0]!.w - inner[1]!.w).toBeGreaterThan(100);
  expect(after[0]!.h).toBeCloseTo(before[0]!.h, 0);
});

test("measures the outer splitter without counting the inner splitter's panels", async ({
  page,
}) => {
  const before = await rects(page, '#outer > [data-part="panel"]');
  await drag(page, '#outer > [data-part="bar"]', 0, 40);
  const after = await rects(page, '#outer > [data-part="panel"]');

  // The boundary has to follow the pointer exactly. `:scope >` is what makes it
  // do so: the inner splitter's panels are descendants of the outer root too, so
  // a bare `[data-part="panel"]` query roughly doubles the reference length and
  // the bar then moves at half the speed of the pointer — which looks like
  // sluggishness rather than a bug, and no ratio assertion would catch it.
  expect(after[0]!.h - before[0]!.h).toBeCloseTo(40, 0);
});

/** Our own ring is `2px solid`; the browser's own is `auto`, at its own width. */
const outline = (page: Page) =>
  page
    .locator('#focus [data-part="bar"]')
    .evaluate(el =>
      [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle].join(" ")
    );

test("shows our focus ring when the bar is reached by keyboard", async ({ page }) => {
  await page.locator("#before-focus").click();
  await page.keyboard.press("Tab");
  const bar = page.locator('#focus [data-part="bar"]');
  await expect(bar).toBeFocused();
  expect(await outline(page)).toBe("2px solid");

  // The offset is the half that decides whether the ring is visible at all: an
  // outline paints outside the border box, the bar is 8px wide, and the
  // `overflow: hidden` panel on each side clips whatever lands on it. At the
  // default offset of 0 the width and style above are both still "2px solid"
  // and the user sees two clipped slivers.
  expect(await bar.evaluate(el => getComputedStyle(el).outlineOffset)).toBe("-2px");
});

test("does not show it for a mouse press on the bar", async ({ page }) => {
  // Its own test, from a fresh page: Chrome keeps `:focus-visible` on an element
  // that is ALREADY focused when the mouse clicks it, so running this second in
  // the same page would assert the heuristic rather than the rule.
  await page.locator('#focus [data-part="bar"]').click();
  await expect(page.locator('#focus [data-part="bar"]')).toBeFocused();
  // Focused either way — `:focus-visible` is the whole difference, and a bare
  // `:focus` rule would ring the bar for the length of every drag. Matched on
  // the style rather than the width, because what is left here is the browser's
  // own `auto` ring and its width is not ours to pin.
  expect(await outline(page)).not.toContain("solid");
});

test("does not let the browser claim a touch drag as a scroll", async ({ page }) => {
  const touch = await page
    .locator('#tile [data-part="bar"]')
    .first()
    .evaluate(el => getComputedStyle(el).touchAction);
  expect(touch).toBe("none");
});
