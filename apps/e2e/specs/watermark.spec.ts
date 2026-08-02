import { test, expect, type Page } from "@playwright/test";

/**
 * Watermark, in the only place its claims mean anything.
 *
 * jsdom reports every rect as 0x0, implements no `pointer-events`, resolves no
 * stylesheet and returns null from `getContext("2d")` — so in the unit suite a
 * collapsed overlay and a correct one measure the same, a click cannot tell a
 * transparent overlay from one that swallows it, the cascade question does not
 * exist, and everything downstream of `toDataURL` is a stub. All of that is
 * here.
 */

const overlayOf = (page: Page, id: string) =>
  page.locator(`#${id} > [data-scope="watermark"][data-part="overlay"]`);

/** Read a locator's border box, as four edges rather than as a size. */
const rect = (page: Page, selector: string) =>
  page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, w: r.width, h: r.height };
  });

const backgroundOf = (page: Page, id: string) =>
  overlayOf(page, id).evaluate(el => {
    const style = getComputedStyle(el);
    return {
      image: style.backgroundImage,
      size: style.backgroundSize,
      repeat: style.backgroundRepeat,
    };
  });

test("covers its region edge for edge", async ({ page }) => {
  await page.goto("/watermark.html");
  const overlay = await rect(page, '#covers > [data-part="overlay"]');
  const root = await rect(page, "#covers");

  // Edge by edge rather than by size: `width > 0` passes for a one-pixel sliver
  // in the corner, which is exactly what a broken `inset` produces.
  expect(Math.abs(overlay.top - root.top)).toBeLessThan(1);
  expect(Math.abs(overlay.right - root.right)).toBeLessThan(1);
  expect(Math.abs(overlay.bottom - root.bottom)).toBeLessThan(1);
  expect(Math.abs(overlay.left - root.left)).toBeLessThan(1);
  expect(overlay.w * overlay.h).toBeGreaterThan(1000);
});

test("lets a click through to the control underneath", async ({ page }) => {
  await page.goto("/watermark.html");
  const overlay = await rect(page, '#covers > [data-part="overlay"]');
  const button = await rect(page, "#target");
  const cx = (button.left + button.right) / 2;
  const cy = (button.top + button.bottom) / 2;

  // Asserted BEFORE the click, because "the click landed" proves nothing about
  // `pointer-events` unless the overlay actually covers the point clicked — on
  // a build where the overlay collapsed, the click passes for the wrong reason.
  expect(cx).toBeGreaterThan(overlay.left);
  expect(cx).toBeLessThan(overlay.right);
  expect(cy).toBeGreaterThan(overlay.top);
  expect(cy).toBeLessThan(overlay.bottom);

  await page.locator("#target").click({ timeout: 2000 });
  await expect(page.locator("#target")).toHaveText("clicked");
});

test("comes back after it is deleted", async ({ page }) => {
  await page.goto("/watermark.html");
  await expect(overlayOf(page, "tamper")).toHaveCount(1);

  // The removal is witnessed synchronously inside the same evaluate. "It is
  // there afterwards" is invariant on its own: it passes identically if the
  // tamper never took effect.
  const gone = await page.evaluate(() => {
    const root = document.querySelector("#tamper")!;
    root.querySelector('[data-part="overlay"]')!.remove();
    return root.querySelector('[data-part="overlay"]') === null;
  });
  expect(gone).toBe(true);

  await expect(overlayOf(page, "tamper")).toHaveCount(1);
});

test("restores an overlay whose style was rewritten", async ({ page }) => {
  await page.goto("/watermark.html");
  const before = await overlayOf(page, "tamper").getAttribute("style");

  const wiped = await page.evaluate(() => {
    const node = document.querySelector('#tamper [data-part="overlay"]')!;
    node.setAttribute("style", "display:none");
    return node.getAttribute("style");
  });
  expect(wiped).toBe("display:none");

  await expect(overlayOf(page, "tamper")).toHaveAttribute("style", before!);
});

test("repairs without starving the event loop", async ({ page }) => {
  await page.goto("/watermark.html");

  // Two assertions that fail differently. A repair that re-enters itself runs
  // as a microtask and never yields, so a frame never arrives and (a) hangs;
  // a repair that yields between iterations still passes (a) and is caught by
  // the record count in (b).
  const records = await page.evaluate(async () => {
    const root = document.querySelector("#tamper")!;
    let count = 0;
    const spy = new MutationObserver(list => {
      count += list.length;
    });
    spy.observe(root, { childList: true, attributes: true, subtree: true });

    root.querySelector('[data-part="overlay"]')!.remove();
    await new Promise(resolve => requestAnimationFrame(() => resolve(true)));
    await new Promise(resolve => setTimeout(resolve, 200));
    spy.disconnect();
    return count;
  });

  expect(records).toBeLessThan(20);
  await expect(overlayOf(page, "tamper")).toHaveCount(1);
});

test("outranks a consumer stylesheet that tries to hide it", async ({ page }) => {
  await page.goto("/watermark.html");
  // watermark.html ships `display: none !important` at (1,2,0) from an
  // unlayered sheet, which beats everything in `ck.components` regardless of
  // specificity. Only inline `!important` outranks it — which is the reason the
  // overlay's geometry is a style attribute rather than a rule.
  const resolved = await overlayOf(page, "hidden-mark").evaluate(el => {
    const style = getComputedStyle(el);
    return { display: style.display, visibility: style.visibility, events: style.pointerEvents };
  });
  expect(resolved).toEqual({ display: "block", visibility: "visible", events: "none" });
});

test("positions its root from the stylesheet, keeping the inline repair unused", async ({
  page,
}) => {
  await page.goto("/watermark.html");
  const state = await page.locator("#covers").evaluate(el => ({
    inline: (el as HTMLElement).style.position,
    computed: getComputedStyle(el).position,
  }));

  // Both halves matter. `computed` alone cannot fail — core writes
  // `position: relative` inline whenever the computed value is still `static`,
  // so deleting the rule from watermark.css would leave the page looking
  // identical and the assertion green. The empty inline value is what proves
  // the stylesheet, not the fallback, did it.
  expect(state.computed).toBe("relative");
  expect(state.inline).toBe("");
});

test("stays inside a root a stylesheet put back to static", async ({ page }) => {
  await page.goto("/watermark.html");
  const overlay = await rect(page, '#static-mark > [data-part="overlay"]');
  const root = await rect(page, "#static-mark");
  const outer = await rect(page, "#static-outer");

  // The ancestor is deliberately a different box: without the inline
  // `position: relative`, the overlay resolves against IT and covers a region
  // that is not the protected one, while still looking like a watermark.
  expect(outer.w).toBeGreaterThan(root.w + 40);
  expect(Math.abs(overlay.w - root.w)).toBeLessThan(1);
  expect(Math.abs(overlay.left - root.left)).toBeLessThan(1);
});

test("rasterises a real tiling image", async ({ page }) => {
  await page.goto("/watermark.html");
  const background = await backgroundOf(page, "covers");
  const root = await rect(page, "#covers");

  expect(background.image).toContain("data:image/png;base64,");
  expect(background.image.length).toBeGreaterThan(500);
  expect(background.repeat).toBe("repeat");

  // A tile smaller than the region is what makes it repeat at all; one tile
  // stretched over the box is a different component.
  const [tileWidth] = background.size.split(" ").map(parseFloat);
  expect(tileWidth).toBeGreaterThan(0);
  expect(tileWidth).toBeLessThan(root.w);
});

test("draws an image watermark, not its text fallback", async ({ page }) => {
  await page.goto("/watermark.html");
  const background = await backgroundOf(page, "image");
  expect(background.image).toContain("data:image/png;base64,");
  // The image cell is 120x64 before rotation, which no measured text run of
  // "fallback" at 16px produces — so this distinguishes the image path from the
  // fallback that would replace it if the load never resolved.
  const [tileWidth, tileHeight] = background.size.split(" ").map(parseFloat);
  expect(tileWidth).toBeGreaterThan(200);
  expect(tileHeight).toBeGreaterThan(140);
});

test("does not clip a rotated mark at the tile edge", async ({ page }) => {
  await page.goto("/watermark.html");
  const url = await overlayOf(page, "rotated").evaluate(
    el => getComputedStyle(el).backgroundImage.slice(5, -2) // url("…")
  );

  // The strong form, on the pixels: asserting that `background-size` matches the
  // bounding-box formula only re-checks the arithmetic the code already did. If
  // the tile were sized from the UNROTATED box, the mark's corners would be cut
  // off and ink would reach the boundary.
  const edges = await page.evaluate(async (src: string) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3]!;

    let max = 0;
    for (let x = 0; x < width; x++) max = Math.max(max, alpha(x, 0), alpha(x, height - 1));
    for (let y = 0; y < height; y++) max = Math.max(max, alpha(0, y), alpha(width - 1, y));
    return { max, width, height };
  }, url);

  expect(edges.width).toBeGreaterThan(0);
  expect(edges.max).toBe(0);
});

test("hands the font shorthand to the rasteriser intact", async ({ page }) => {
  await page.goto("/watermark.html");
  const light = await backgroundOf(page, "light");
  const bold = await backgroundOf(page, "bold");
  const normal = await backgroundOf(page, "normal-weight");
  const tileWidth = (background: { size: string }) => parseFloat(background.size.split(" ")[0]!);

  // Two assertions, because the first one alone cannot fail for the reason it
  // claims. Passing `light` through raw invalidates ONLY the light shorthand —
  // the bold one still parses — so the rasters still differ and a
  // "they are not identical" test stays green on the broken build. Verified by
  // mutation: dropping the keyword table left this file passing until the
  // second assertion was added.
  //
  // What the rejection actually does is leave canvas measuring with its default
  // 10px sans-serif, which collapses the measured cell and therefore the tile.
  // `normal` is the control: the one shorthand that cannot be rejected.
  expect(light.image).not.toBe(bold.image);
  expect(Math.abs(tileWidth(light) - tileWidth(normal)) / tileWidth(normal)).toBeLessThan(0.15);
});

test("reorders a mixed-script mark with the root's direction", async ({ page }) => {
  await page.goto("/watermark.html");
  const ltr = await backgroundOf(page, "ltr");
  const rtl = await backgroundOf(page, "rtl");
  // Only a real text shaper reorders "ABC عربى". Dropping `ctx.direction` makes
  // these two identical.
  expect(ltr.image).not.toBe(rtl.image);
});

test.describe("on a high-density display", () => {
  // At the default scale factor the backing store and the CSS tile are the same
  // number whether or not the DPR scaling exists at all — the representative
  // value where correct and broken coincide.
  test.use({ deviceScaleFactor: 2 });

  test("draws a backing store larger than the CSS tile", async ({ page }) => {
    await page.goto("/watermark.html");
    const background = await backgroundOf(page, "covers");
    const [cssWidth] = background.size.split(" ").map(parseFloat);

    const natural = await page.evaluate(
      async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return img.naturalWidth;
      },
      background.image.slice(5, -2)
    );

    expect(natural).toBeGreaterThan(cssWidth! * 1.9);
    expect(natural).toBeLessThan(cssWidth! * 2.1);
  });
});
