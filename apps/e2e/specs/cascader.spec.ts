import { test, expect, type Page } from "@playwright/test";

/**
 * Cascader, in the browser.
 *
 * The unit suite covers the path arithmetic, the two item states and the
 * keyboard. What it cannot see is anything the columns' LAYOUT decides: their
 * order along the inline axis, which is the whole RTL claim; the divider's
 * edge; the popup's width, which must NOT be clamped to the trigger's; and the
 * per-column scrolling. jsdom reports every rect as 0x0, has no generated or
 * reserved space, and has no `:hover` — so the stylesheet's specificity guard
 * is unassertable there too.
 */

const box = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, width: r.width, height: r.height };
    })
  );

/**
 * Waits until nothing is still animating.
 *
 * The popup runs an entry animation and the trigger's chevron TRANSITIONS
 * between its two rotations, and the stylesheet arrives after first paint — so
 * a read taken immediately catches either partway. Reading a transitioning
 * property without waiting is the same instrument mistake as measuring a popup
 * mid-scale.
 */
const settle = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every(a => a.playState === "finished" || a.playState === "idle")
  );

const load = async (page: Page, dir: "ltr" | "rtl") => {
  await page.goto("/cascader.html");
  // After navigation, not through `addInitScript`: an init script runs before
  // the parser has created <html>, so the assignment throws silently.
  await page.evaluate(d => {
    document.documentElement.dir = d;
  }, dir);
  await expect(page.locator("html")).toHaveAttribute("dir", dir);
  await settle(page);
};

const COLUMN = '[data-scope="cascader"][data-part="column"]';
const ITEM = '[data-scope="cascader"][data-part="item"]';

for (const dir of ["ltr", "rtl"] as const) {
  test(`lays the columns out along the inline axis, ${dir}`, async ({ page }) => {
    await load(page, dir);
    const columns = await box(page, COLUMN);
    expect(columns).toHaveLength(2);

    // The columns are a plain flex ROW with no direction override, so
    // `direction: rtl` reverses them for free. A `row-reverse` "fix" would pass
    // in RTL and break LTR, so both halves have to be asserted.
    if (dir === "rtl") expect(columns[0]!.right).toBeGreaterThan(columns[1]!.right);
    else expect(columns[0]!.left).toBeLessThan(columns[1]!.left);
  });

  test(`puts the divider between columns on the leading edge, ${dir}`, async ({ page }) => {
    await load(page, dir);
    const widths = await page
      .locator(`${COLUMN} + ${COLUMN}`)
      .first()
      .evaluate(el => {
        const s = getComputedStyle(el);
        return { left: s.borderLeftWidth, right: s.borderRightWidth };
      });
    // `border-inline-start`, so it resolves to a different physical edge in
    // each direction. A physical `border-left` passes in LTR and fails here.
    if (dir === "rtl") {
      expect(parseFloat(widths.right)).toBeGreaterThan(0);
      expect(parseFloat(widths.left)).toBe(0);
    } else {
      expect(parseFloat(widths.left)).toBeGreaterThan(0);
      expect(parseFloat(widths.right)).toBe(0);
    }
  });

  test(`mirrors the item chevron with the document, ${dir}`, async ({ page }) => {
    await load(page, dir);
    // There is no DOM difference between the two — transform only.
    const scale = await page
      .locator(`[data-scope="cascader"][data-part="item-indicator"] svg`)
      .first()
      .evaluate(el => getComputedStyle(el).scale);
    expect(scale).toBe(dir === "rtl" ? "-1 1" : "none");
  });
}

test("does not clamp the popup to the trigger's width", async ({ page }) => {
  await load(page, "ltr");
  const [content] = await box(page, '[data-scope="cascader"][data-part="content"]');
  const [control] = await box(page, '#open [data-scope="cascader"][data-part="control"]');
  // Copying `inline-size: var(--ck-anchor-width)` across from a sibling's
  // stylesheet is the obvious thing to do, and it would crush every column past
  // the first. jsdom has no widths at all, so its absence is invisible there.
  expect(content!.width).toBeGreaterThan(control!.width + 20);
});

test("reserves the indicator's width whether or not an item has children", async ({ page }) => {
  await load(page, "ltr");
  // Column 1 is [Hangzhou (branch), Ningbo (leaf)]. The indicator span renders
  // for both, empty for the leaf, and the reserved `inline-size` is what keeps
  // the two rows the same shape.
  //
  // WIDTH, not the leading edge. The indicator sits AFTER the text, so the
  // text's left edge cannot move whatever the indicator does — an assertion on
  // it passes with the reservation deleted, which is how it was written first
  // and what the mutation caught. What collapses without the reservation is the
  // leaf's indicator, to zero, and its text takes the slack.
  const texts = await box(
    page,
    `${COLUMN}:nth-of-type(2) [data-scope="cascader"][data-part="item-text"]`
  );
  expect(texts).toHaveLength(2);
  expect(Math.abs(texts[0]!.width - texts[1]!.width)).toBeLessThanOrEqual(1);

  const indicators = await box(
    page,
    `${COLUMN}:nth-of-type(2) [data-scope="cascader"][data-part="item-indicator"]`
  );
  expect(indicators[0]!.width).toBeGreaterThan(0);
  expect(Math.abs(indicators[0]!.width - indicators[1]!.width)).toBeLessThanOrEqual(1);
});

test("does not repaint the chosen item under the pointer", async ({ page }) => {
  await load(page, "ltr");
  // Left at the DEFAULT expandTrigger. Under hover-expand, hovering makes the
  // row active, so correct and broken behaviour coincide and this assertion
  // could not fail.
  const chosen = page.locator(`${ITEM}[data-selected]`).first();
  const before = await chosen.evaluate(el => getComputedStyle(el).backgroundColor);
  await chosen.hover();
  await settle(page);
  const after = await chosen.evaluate(el => getComputedStyle(el).backgroundColor);
  // A bare [data-selected] is (0,3,0); a :hover that also names the part is
  // (0,4,0) and would win without the :not() guards.
  expect(after).toBe(before);

  // And the same for the browsing highlight, which is the other state the hover
  // rule has to stand down for. Browsing to the OTHER branch is what separates
  // the two: while the value sits under Zhejiang, every active row is also
  // selected and the two rules cannot be told apart.
  await page.locator(ITEM, { hasText: "Jiangsu" }).first().click();
  await settle(page);
  const active = page.locator(`${ITEM}[data-active]:not([data-selected])`).first();
  const activeBefore = await active.evaluate(el => getComputedStyle(el).backgroundColor);
  await active.hover();
  await settle(page);
  expect(await active.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(activeBefore);

  // And the browsing highlight is a fill at all, rather than the rule being
  // absent. Without this the assertion above holds trivially — "nothing changed"
  // is also true of a row that was never painted. It is the only part of the
  // active rule a browser can currently distinguish, because the active fill and
  // the hover fill are the same colour.
  const plain = page.locator(`${ITEM}:not([data-active]):not([data-selected])`).first();
  const plainFill = await plain.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(activeBefore).not.toBe(plainFill);
});

test("turns the trigger indicator while the popup is open", async ({ page }) => {
  await load(page, "ltr");
  const rotation = (id: string) =>
    page
      .locator(`${id} [data-scope="cascader"][data-part="indicator"]`)
      .evaluate(el => getComputedStyle(el).rotate);
  expect(await rotation("#open")).toBe("180deg");
  expect(await rotation("#shut")).toBe("none");
});

test("scrolls each column on its own, never the document", async ({ page }) => {
  await load(page, "ltr");
  await page.locator('#long [data-scope="cascader"][data-part="trigger"]').click();
  // ArrowDown is what hands the columns the keyboard — the click leaves focus on
  // the trigger, so without this `End` goes to the document and the assertion
  // below measures nothing.
  await page.keyboard.press("ArrowDown");
  await settle(page);
  // The harness is deliberately taller than the viewport, so a document scroll
  // is possible and this baseline is a real one.
  expect(await page.evaluate(() => document.body.scrollHeight)).toBeGreaterThan(800);
  const before = await page.evaluate(() => window.scrollY);
  // End walks to the last option of a column taller than its own box. The
  // regression this guards is `scrollIntoView` — or a `focus()` without
  // `preventScroll` — walking every scrollable ancestor out to the document,
  // which is exactly what a popup portalled to <body> finds.
  await page.keyboard.press("End");
  await settle(page);

  const columns = page.locator(COLUMN);
  expect(await columns.first().evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // The content is the flex row and must not scroll itself, or a long first
  // level would take every other column out of view with it.
  const content = page.locator('[data-scope="cascader"][data-part="content"]');
  const overflow = await content.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("portals the popup to the body, not to the harness container", async ({ page }) => {
  await load(page, "ltr");
  // The one rule no unit test can express: the positioner is `position: fixed`
  // with viewport coordinates, and any ancestor with a transform, filter or
  // contain:paint would capture it as the containing block.
  const parentIsBody = await page
    .locator('[data-scope="cascader"][data-part="positioner"]')
    .evaluate(el => el.parentElement === document.body);
  expect(parentIsBody).toBe(true);
});

test("mirrors Left and Right with the document direction", async ({ page }) => {
  await load(page, "rtl");
  // `getComputedStyle(el).direction` is not reliably resolved in jsdom, so the
  // unit suite can only assert the LTR keymap. Under RTL, ArrowLEFT is the one
  // that steps deeper.
  await page.locator('#shut [data-scope="cascader"][data-part="trigger"]').click();
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await expect(page.locator(`${ITEM}[tabindex="0"]`)).toHaveText(/Zhejiang/);

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  await expect(page.locator(COLUMN)).toHaveCount(3);
  await expect(page.locator(`${ITEM}[tabindex="0"]`)).toHaveText(/Hangzhou/);

  await page.keyboard.press("ArrowRight");
  await settle(page);
  await expect(page.locator(`${ITEM}[tabindex="0"]`)).toHaveText(/Zhejiang/);
});
