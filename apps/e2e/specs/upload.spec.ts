import { test, expect, type Page } from "@playwright/test";

/**
 * Upload, in the browser.
 *
 * The unit suites carry the queue arithmetic and the adapter's wiring. What
 * neither can see is anything with a box in it: jsdom reports every rect as
 * 0×0, has no `:hover` and no cascade worth reading.
 *
 * What this file cannot see either — and the drop test says so at the point it
 * matters — is whether cancelling `dragover` is what lets `drop` happen.
 * `dispatchEvent` hands the event straight to the listeners, exactly as jsdom
 * does, so both harnesses agree and both are wrong about it.
 */

const box = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    })
  );

const open = async (page: Page, dir: "ltr" | "rtl" = "ltr") => {
  await page.goto("/upload.html");
  // After navigation, not through `addInitScript`: an init script runs before
  // the parser has created `<html>`, so the assignment throws silently.
  await page.evaluate(d => {
    document.documentElement.dir = d;
  }, dir);
  await expect(page.locator("html")).toHaveAttribute("dir", dir);
  await page.waitForFunction(() =>
    document.getAnimations().every(a => a.playState === "finished" || a.playState === "idle")
  );
};

test("sizes the progress fill from the custom property", async ({ page }) => {
  await open(page);
  const tracks = await box(page, '#progress [data-part="item-progress"]');
  const bars = await box(page, '#progress [data-part="item-progress-bar"]');
  expect(bars).toHaveLength(2);

  // Two values, because one point cannot distinguish
  // `calc(var(--ck-upload-progress) * 1%)` from a hard-coded width — and 0 is
  // the value a `[data-progress]` attribute selector would wrongly MATCH on.
  expect(bars[0]!.width).toBeLessThan(1);
  expect(Math.abs(bars[1]!.width - tracks[1]!.width * 0.4)).toBeLessThan(2);
});

for (const dir of ["ltr", "rtl"] as const) {
  test(`grows the fill from the inline start, ${dir}`, async ({ page }) => {
    await open(page, dir);
    const [, track] = await box(page, '#progress [data-part="item-progress"]');
    const [, bar] = await box(page, '#progress [data-part="item-progress-bar"]');

    // A `transform: translateX` or a `left: 0` fill passes LTR and grows from
    // the wrong edge in RTL — `translate` is physical whatever the offset
    // property beside it is, which is the trap the slider thumb documents.
    if (dir === "ltr") {
      expect(Math.abs(bar!.left - track!.left)).toBeLessThan(1);
      expect(bar!.right).toBeLessThan(track!.right - 1);
    } else {
      expect(Math.abs(bar!.right - track!.right)).toBeLessThan(1);
      expect(bar!.left).toBeGreaterThan(track!.left + 1);
    }
  });

  test(`puts the actions at the inline end, ${dir}`, async ({ page }) => {
    await open(page, dir);
    const [actions] = await box(page, '#states [data-part="item-actions"]');
    // The ROW's inline content edge, not the name's opposite edge. The actions
    // follow the name in source order, so `actions.left > name.right` holds
    // however narrow the name is — an assertion that cannot fail, and the one
    // that was here. What actually carries the actions to the end is `flex: 1`
    // on `item-name` eating every pixel of free space; with `flex: none` there
    // instead they sit a couple of hundred pixels short of this edge, in both
    // directions. (An auto inline margin on the actions has nothing left to push
    // against beside that growth, which is why there is not one.)
    const edge = await page
      .locator('#states [data-part="item"]')
      .first()
      .evaluate((el, d) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return d === "ltr"
          ? rect.right - parseFloat(style.paddingRight)
          : rect.left + parseFloat(style.paddingLeft);
      }, dir);

    if (dir === "ltr") expect(Math.abs(actions!.right - edge)).toBeLessThan(1.5);
    else expect(Math.abs(actions!.left - edge)).toBeLessThan(1.5);
  });
}

test("takes a drop carrying a real DataTransfer of real Files", async ({ page }) => {
  await open(page);
  const dropzone = page.locator('#dragger [data-part="dropzone"]');
  await expect(page.locator('#dragger [data-part="item"]')).toHaveCount(0);

  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(["hello"], "dropped.png", { type: "image/png" }));
    return dt;
  });
  await dropzone.dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(dropzone).toHaveAttribute("data-drag-over", "");
  await dropzone.dispatchEvent("dragover", { dataTransfer: transfer });
  await dropzone.dispatchEvent("drop", { dataTransfer: transfer });

  // NOT a proof that `preventDefault()` on `dragover` is what makes `drop`
  // fire. `dispatchEvent` synthesises the event and hands it straight to the
  // listeners, bypassing the browser's own drag machinery — measured: deleting
  // that `preventDefault()` leaves this test green. Nothing in either harness
  // can reproduce the real behaviour, because neither can start an OS file
  // drag; what defends it is the `defaultPrevented` assertion in
  // `upload.test.tsx`, which is a claim about the mechanism rather than about
  // its effect.
  //
  // What this DOES prove, and jsdom cannot: that a genuine `DataTransfer`
  // carrying genuine `File` objects reaches `addFiles` and produces a row.
  await expect(page.locator('#dragger [data-part="item"]')).toHaveCount(1);
  await expect(page.locator('#dragger [data-part="item-name"]')).toHaveText("dropped.png");
  // Reset, not decremented: no `dragleave` follows a drop.
  await expect(dropzone).not.toHaveAttribute("data-drag-over", "");
});

test("paints the dropzone differently while something is over it", async ({ page }) => {
  await open(page);
  const dropzone = page.locator('#dragger [data-part="dropzone"]');
  const paint = () =>
    dropzone.evaluate(el => {
      const style = getComputedStyle(el);
      return `${style.backgroundColor}|${style.borderTopColor}`;
    });

  const before = await paint();
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await dropzone.dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(dropzone).toHaveAttribute("data-drag-over", "");
  // jsdom has no computed cascade worth reading, so "the attribute is there" is
  // as far as a unit test gets — whether it changes anything is this.
  expect(await paint()).not.toBe(before);
});

test("lets the drop highlight outrank the pointer's own hover", async ({ page }) => {
  await open(page);
  const dropzone = page.locator('#dragover-guard [data-part="dropzone"]');
  const border = () => dropzone.evaluate(el => getComputedStyle(el).borderTopColor);

  await dropzone.hover();
  // The fixture moves `--ck-accent-border` off `--ck-accent-solid`, which the
  // light theme happens to point at the same colour — with the two equal, no
  // assertion here could tell the hover rule from the drag-over rule. The dark
  // theme already gives them different values.
  expect(await border()).toBe("rgb(0, 128, 0)");

  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await dropzone.dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(dropzone).toHaveAttribute("data-drag-over", "");
  // The pointer never left, and `dispatchEvent` is not a real drag — so nothing
  // suppresses `:hover` here, which is exactly the state the `:not()` guard
  // exists for. Unguarded, the hover rule is (0,4,0) against the drag-over
  // rule's (0,3,0) and the drop highlight never appears at all. Engines
  // suppressing `:hover` mid-drag is what masks this in production, and it is
  // not a rule anything guarantees.
  expect(await border()).not.toBe("rgb(0, 128, 0)");
});

test("leaves a failed row alone under the pointer, and repaints a finished one", async ({
  page,
}) => {
  await open(page);
  const ok = page.locator('#states [data-part="item"][data-state="done"]');
  const bad = page.locator('#states [data-part="item"][data-state="error"]');
  const paint = (l: typeof ok) => l.evaluate(el => getComputedStyle(el).backgroundColor);

  const badBefore = await paint(bad);
  await bad.hover();
  // `[a][b]:hover` and `[a][b][data-state]` are both (0,3,0), so without the
  // `:not()` guard the hover wins on source order and repaints a failed row on
  // the way to its own retry button.
  expect(await paint(bad)).toBe(badBefore);

  const okBefore = await paint(ok);
  await ok.hover();
  // And the guard must not have disabled hover altogether — an assertion that
  // only checked the error row would pass against a stylesheet with no hover
  // rule at all.
  expect(await paint(ok)).not.toBe(okBefore);
});

test("truncates a long name instead of overflowing the row", async ({ page }) => {
  await open(page);
  const name = page.locator('#truncate [data-part="item-name"]');
  const overflow = await name.evaluate(el => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
    ellipsis: getComputedStyle(el).textOverflow,
  }));
  // `overflow: hidden` as well as the ellipsis triple, and it is doing both
  // jobs: a flex child's automatic minimum size only applies while `overflow`
  // is `visible`, so that one declaration is also what lets the name shrink
  // below its content. Without it the row grows past its container with no
  // ellipsis anywhere. (`min-inline-size: 0` is the usual incantation for the
  // second job and was measured to change nothing here, so it is not shipped.)
  expect(overflow.scroll).toBeGreaterThan(overflow.client);
  expect(overflow.ellipsis).toBe("ellipsis");

  const [item] = await box(page, '#truncate [data-part="item"]');
  const [container] = await box(page, "#truncate");
  expect(item!.width).toBeLessThanOrEqual(container!.width + 1);
});

test("crops the thumbnail square rather than squashing it", async ({ page }) => {
  await open(page);
  const [thumb] = await box(page, '#picture [data-part="thumbnail"]');
  // The source is 2:1. Without `aspect-ratio: 1` and `object-fit: cover` it
  // renders as a squashed strip — neither of which jsdom has any notion of.
  expect(Math.abs(thumb!.width - thumb!.height)).toBeLessThan(1);
  expect(
    await page
      .locator('#picture [data-part="thumbnail"]')
      .evaluate(el => getComputedStyle(el).objectFit)
  ).toBe("cover");
});

test("gives a picture row the block padding its thumbnail needs", async ({ page }) => {
  await open(page);
  const [item] = await box(page, '#picture [data-part="item"]');
  const [thumb] = await box(page, '#picture [data-part="thumbnail"]');
  // 0.375rem above and below the 2.5rem thumbnail, and 12px is the whole
  // claim: the text row's 0.25rem is what a picture row falls back to when the
  // `[data-list-type="picture"]` override goes, so a thumbnail crushed against
  // the row's edges is 8px here and this fails. Asserting only that the row is
  // taller than the thumbnail would pass at either padding.
  expect(Math.abs(item!.height - thumb!.height - 12)).toBeLessThan(1);
});

test("hides the file input without taking away its ability to open the dialog", async ({
  page,
}) => {
  await open(page);
  const [field] = await box(page, '#layered [data-part="input"]');
  // Nothing in the markup hides this: `aria-hidden` and `tabindex="-1"` keep it
  // out of the a11y tree and the tab order and leave it fully painted. Without
  // the stylesheet's visually-hidden rule a native ~250px "Choose file" control
  // renders inside every Upload in the library.
  expect(field!.width).toBeLessThan(3);
  expect(field!.height).toBeLessThan(3);
  // And NOT `display: none`, which would take away the one guaranteed way to
  // open the file dialog.
  const display = await page
    .locator('#layered [data-part="input"]')
    .evaluate(el => getComputedStyle(el).display);
  expect(display).not.toBe("none");
});

test("paints a disabled Upload as disabled, cursors and all", async ({ page }) => {
  await open(page);
  const opacity = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate(el => getComputedStyle(el).opacity);
  const cursor = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate(el => getComputedStyle(el).cursor);

  // Both sides, because "the disabled root is dimmed" is also true of a
  // stylesheet that dims every root.
  expect(await opacity('#disabled [data-part="root"]')).toBe("0.6");
  expect(await opacity('#states [data-part="root"]')).toBe("1");
  expect(await cursor('#disabled [data-part="trigger"]')).toBe("not-allowed");
  expect(await cursor('#disabled [data-part="dropzone"]')).toBe("not-allowed");
  expect(await cursor('#dragger [data-part="dropzone"]')).toBe("pointer");
});

test("holds a disabled row's controls still under the pointer", async ({ page }) => {
  await open(page);
  const off = page.locator('#disabled [data-part="remove"]');
  const on = page.locator('#states [data-part="remove"]').first();
  const colour = (target: typeof off) => target.evaluate(el => getComputedStyle(el).color);

  const offBefore = await colour(off);
  await off.hover();
  // `:not([data-disabled])` on the hover rule, guarding an attribute the markup
  // has to actually set on the button — a guard against an attribute nothing
  // writes is a guard against nothing.
  expect(await colour(off)).toBe(offBefore);

  const onBefore = await colour(on);
  await on.hover();
  // And the guard has not simply switched hover off: an assertion that only
  // looked at the disabled control would pass against a stylesheet carrying no
  // hover rule at all.
  expect(await colour(on)).not.toBe(onBefore);
});

test("states its own display on the root", async ({ page }) => {
  await open(page);
  // Measured on an UNKNOWN element carrying the root part, not on the React
  // component. A `<div>` computes `display: block` whatever the stylesheet
  // says, so asserting it there is an assertion that cannot fail — in jsdom or
  // here. A custom element defaults to `inline`, which is the case the rule
  // exists for: an Angular adapter's root is one.
  const display = await page
    .locator('#custom-element-root [data-scope="upload"][data-part="root"]')
    .evaluate(el => getComputedStyle(el).display);
  expect(display).toBe("block");
});

test("lets an unlayered consumer rule beat our own", async ({ page }) => {
  await open(page);
  const color = await page
    .locator('#layered [data-scope="upload"][data-part="root"]')
    .evaluate(el => getComputedStyle(el).color);
  // `color`, because that is a property `upload.css` also sets on the root — a
  // property only one side declares leaves the cascade nothing to decide, and
  // the assertion then passes whether or not anything is layered.
  //
  // `.consumer-override` is (0,1,0) against our (0,3,0). It wins only because
  // everything we ship is inside `@layer ck.components` and unlayered CSS beats
  // layered CSS regardless of specificity.
  expect(color).toBe("rgb(255, 0, 0)");
});
