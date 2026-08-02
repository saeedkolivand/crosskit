import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWatermarkOverlay,
  drawWatermark,
  resolveWatermark,
  watermarkFontSpec,
  watermarkStyle,
  watermarkTile,
  type MeasuredWatermark,
  type WatermarkOptions,
} from "./watermark";

/**
 * jsdom has no canvas at all — `getContext("2d")` returns null — so every claim
 * about what is drawn has to be made against a recording fake. That is enough
 * for the two failures that ship silently and cost hours: the context being
 * configured before the canvas is sized (which resets all of it), and the
 * canvas being scaled by `devicePixelRatio` rather than by the rounded backing
 * store. Both are questions about ORDER and ARITHMETIC, which a fake answers
 * exactly. Whether a real rasteriser accepts the font shorthand, and whether the
 * tile actually tiles, are browser claims and live in the Playwright spec.
 */
const round = (v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);

function recordingCanvas(options: { measure?: number; dataUrl?: string | Error } = {}) {
  const trace: string[] = [];
  const call =
    (name: string) =>
    (...args: unknown[]) => {
      trace.push(`${name}(${args.map(round).join(",")})`);
    };

  const ctx = {
    measureText: (text: string) => {
      trace.push(`measureText(${text})`);
      return { width: (options.measure ?? 40) * text.length };
    },
    setTransform: call("setTransform"),
    translate: call("translate"),
    rotate: call("rotate"),
    fillText: call("fillText"),
    drawImage: (_img: unknown, ...rest: unknown[]) => {
      trace.push(`drawImage(${rest.map(round).join(",")})`);
    },
  } as unknown as CanvasRenderingContext2D;

  for (const prop of ["font", "fillStyle", "textAlign", "textBaseline", "direction"]) {
    let value: unknown;
    Object.defineProperty(ctx, prop, {
      get: () => value,
      set: next => {
        value = next;
        trace.push(`${prop}=${String(next)}`);
      },
    });
  }

  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      // Redefined per instance so the moment the backing store is sized shows
      // up in the same trace as the context calls — the whole point being that
      // sizing after configuring wipes everything set before it.
      for (const axis of ["width", "height"]) {
        let v = 0;
        Object.defineProperty(this, axis, {
          configurable: true,
          get: () => v,
          set: next => {
            v = next;
            trace.push(`${axis}=${next}`);
          },
        });
      }
      return ctx;
    });

  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
    if (options.dataUrl instanceof Error) throw options.dataUrl;
    return options.dataUrl ?? "data:image/png;base64,AAAA";
  });

  return { trace, getContext };
}

const measured = (options: WatermarkOptions, width: number, height: number): MeasuredWatermark => ({
  ...resolveWatermark(options),
  width,
  height,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("watermarkFontSpec", () => {
  it("emits the tokens in the only order CSS accepts", () => {
    // style, variant, weight, size, family. Any other order is an invalid
    // shorthand, and canvas ignores an invalid shorthand without a word.
    expect(watermarkFontSpec(undefined)).toBe("normal normal normal 16px sans-serif");
    expect(watermarkFontSpec({ fontStyle: "italic", fontWeight: "bold", fontSize: 24 })).toBe(
      "italic normal bold 24px sans-serif"
    );
  });

  it('maps "light", which is not a CSS font-weight, to a number that is', () => {
    // `light` in the shorthand invalidates the WHOLE declaration, and canvas
    // then silently keeps 10px sans-serif — a tiny mark in the wrong face, with
    // nothing logged anywhere.
    expect(watermarkFontSpec({ fontWeight: "light" })).toBe("normal normal 300 16px sans-serif");
  });

  it("falls back to normal for a value no browser would take", () => {
    const font = { fontWeight: "weight", fontStyle: "none" } as never;
    expect(watermarkFontSpec(font)).toBe("normal normal normal 16px sans-serif");
  });

  it("passes a numeric weight straight through", () => {
    expect(watermarkFontSpec({ fontWeight: 700 })).toBe("normal normal 700 16px sans-serif");
  });
});

describe("watermarkTile", () => {
  it("sizes from the rotated bounding box, per axis", () => {
    // Non-square mark at a non-45-degree angle, deliberately: at 45 degrees
    // |cos| === |sin|, and with a square mark w === h, so a swapped sin/cos or
    // a swapped width/height still produces the right answer and the test
    // cannot fail.
    const tile = watermarkTile(measured({ rotate: 30, gap: [10, 20] }, 200, 50));
    expect(tile.width).toBe(209); // ceil(200·cos30 + 50·sin30 + 10)
    expect(tile.height).toBe(164); // ceil(200·sin30 + 50·cos30 + 20)
  });

  it("is the plain mark plus the gap when nothing is rotated", () => {
    expect(watermarkTile(measured({ rotate: 0, gap: [10, 20] }, 200, 50))).toEqual({
      width: 210,
      height: 70,
    });
  });

  it("only ever grows the tile, whichever way the mark leans", () => {
    // A repeating background clips at the tile edge; a tile that did not grow
    // with the rotation loses the mark's corners.
    const flat = watermarkTile(measured({ rotate: 0, gap: [0, 0] }, 200, 50));
    const left = watermarkTile(measured({ rotate: -22, gap: [0, 0] }, 200, 50));
    const right = watermarkTile(measured({ rotate: 22, gap: [0, 0] }, 200, 50));
    expect(left).toEqual(right);
    expect(left.width).toBeGreaterThan(flat.width);
    expect(left.height).toBeGreaterThan(flat.height);
  });
});

describe("drawWatermark", () => {
  it("sizes the canvas before it configures the context, and only then draws", () => {
    const { trace } = recordingCanvas();
    drawWatermark(resolveWatermark({ content: "a" }), undefined, "ltr");

    // The exact ordered trace, because every one of these steps is invalidated
    // by the one that follows it if they swap: setting `canvas.width` resets
    // font, fillStyle, alignment, direction AND the transform, so a context
    // configured before the sizing draws black 10px sans-serif and reports
    // nothing at all.
    expect(trace).toEqual([
      "font=normal normal normal 16px sans-serif",
      "measureText(a)",
      "width=145",
      "height=133",
      "font=normal normal normal 16px sans-serif",
      "fillStyle=rgba(0,0,0,0.15)",
      "textAlign=center",
      "textBaseline=middle",
      "direction=ltr",
      "setTransform(1,0,0,1,0,0)",
      "translate(72.5,66.5)",
      "rotate(-0.384)",
      "fillText(a,0,0)",
    ]);
  });

  it("stacks multiple lines about the centre", () => {
    const { trace } = recordingCanvas();
    drawWatermark(resolveWatermark({ content: ["one", "two"] }));
    // 16px x 1.2 line box, so the pair straddles the centre by half a line each.
    expect(trace).toContain("fillText(one,0,-9.6)");
    expect(trace).toContain("fillText(two,0,9.6)");
  });

  it("scales the backing store by the rounded store, not by the ratio", () => {
    // 1.5 is a real, common devicePixelRatio and is exactly where the two
    // differ: 145 x 1.5 is 217.5, the store rounds to 218, and a transform of
    // 1.5 then no longer maps the drawing onto the CSS tile — the grid drifts
    // and seams open between tiles.
    vi.stubGlobal("devicePixelRatio", 1.5);
    const { trace } = recordingCanvas();
    drawWatermark(resolveWatermark({ content: "a" }));

    expect(trace).toContain("width=218");
    expect(trace).toContain(`setTransform(${round(218 / 145)},0,0,${round(200 / 133)},0,0)`);
    expect(trace).not.toContain("setTransform(1.5,0,0,1.5,0,0)");
    vi.unstubAllGlobals();
  });

  it("draws an image into the cell instead of the text", () => {
    const { trace } = recordingCanvas();
    const image = new Image();
    drawWatermark(resolveWatermark({ image: "x.png", content: "fallback" }), image);
    expect(trace).toContain("drawImage(-60,-32,120,64)");
    expect(trace.some(entry => entry.startsWith("fillText"))).toBe(false);
  });

  it("keeps the geometry when there is no 2D context to draw with", () => {
    // jsdom, or a canvas-blocking extension. The overlay still attaches and
    // still holds its box; it simply has no background.
    const raster = drawWatermark(resolveWatermark({ content: "a", width: 200, height: 50 }));
    expect(raster.dataUrl).toBeUndefined();
    expect(raster.tile.width).toBeGreaterThan(200);
  });

  it("survives a tainted canvas rather than taking the whole draw down", () => {
    // A cross-origin image makes `toDataURL` throw SecurityError.
    recordingCanvas({ dataUrl: new Error("SecurityError") });
    const raster = drawWatermark(resolveWatermark({ content: "a" }));
    expect(raster.dataUrl).toBeUndefined();
    expect(raster.tile).toEqual({ width: 145, height: 133 });
  });
});

describe("watermarkStyle", () => {
  const mark = { width: 100, height: 40 };
  const raster = { dataUrl: "data:image/png;base64,AAAA", mark, tile: { width: 240, height: 164 } };

  it("builds one deterministic declaration string", () => {
    expect(watermarkStyle(resolveWatermark({}), raster)).toBe(
      "position:absolute;inset-inline:0;inset-block:0;z-index:9;" +
        "display:block!important;visibility:visible!important;pointer-events:none!important;" +
        "background-repeat:repeat;background-size:240px 164px;background-position:50px 50px;" +
        'background-image:url("data:image/png;base64,AAAA")'
    );
  });

  it("quotes the data URI", () => {
    // Unquoted, `url(data:image/png;base64,…)` inside a style ATTRIBUTE ends at
    // the semicolon in its own MIME type: the background is dropped silently.
    const css = watermarkStyle(resolveWatermark({}), raster);
    expect(css).toContain('url("data:image/png;base64,AAAA")');
  });

  it("omits the background entirely when there is no raster", () => {
    const css = watermarkStyle(resolveWatermark({}), { mark, tile: { width: 1, height: 1 } });
    expect(css).not.toContain("background-image");
    expect(css).toContain("pointer-events:none!important");
  });

  it("takes the stacking order and the phase from the options", () => {
    const css = watermarkStyle(resolveWatermark({ zIndex: 42, offset: [7, 9] }), raster);
    expect(css).toContain("z-index:42");
    expect(css).toContain("background-position:7px 9px");
  });
});

describe("createWatermarkOverlay", () => {
  const mount = () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    return root;
  };
  const overlayIn = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-part="overlay"]');
  /** One macrotask, which is strictly later than the microtask an observer runs in. */
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  it("attaches exactly the four attributes it declares", () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });

    const node = overlayIn(root)!;
    expect(node.getAttributeNames().sort()).toEqual([
      "aria-hidden",
      "data-part",
      "data-scope",
      "style",
    ]);
    expect(node.getAttribute("data-scope")).toBe("watermark");
    expect(node.getAttribute("aria-hidden")).toBe("true");
    overlay.destroy();
  });

  it("forces a positioned root, because an absolute child of a static root escapes it", () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    expect(root.style.position).toBe("relative");
    overlay.destroy();
  });

  it("leaves a root that is already positioned alone", () => {
    const root = mount();
    root.style.position = "absolute";
    const overlay = createWatermarkOverlay(root);
    expect(root.style.position).toBe("absolute");
    overlay.destroy();
  });

  it("brings the overlay back after it is deleted", async () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });

    overlayIn(root)!.remove();
    // Witnessed synchronously: "it is there afterwards" passes identically on a
    // build where the deletion never took effect, which is an assertion that
    // cannot fail.
    expect(overlayIn(root)).toBeNull();

    await settle();
    expect(overlayIn(root)).not.toBeNull();
    expect(root.querySelectorAll('[data-part="overlay"]')).toHaveLength(1);
    overlay.destroy();
  });

  it("rewrites a style someone edited on the element", async () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });
    const before = overlayIn(root)!.getAttribute("style");

    overlayIn(root)!.setAttribute("style", "display:none");
    expect(overlayIn(root)!.getAttribute("style")).toBe("display:none");

    await settle();
    expect(overlayIn(root)!.getAttribute("style")).toBe(before);
    overlay.destroy();
  });

  it("strips an attribute that was added to it", async () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });

    overlayIn(root)!.setAttribute("hidden", "");
    await settle();
    expect(overlayIn(root)!.hasAttribute("hidden")).toBe(false);
    overlay.destroy();
  });

  it("repairs without re-entering itself", async () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });

    // The repair writes attributes and re-appends the node, both of which the
    // observer watches — so an unguarded restore calls itself forever, as a
    // microtask, which starves the queue and hangs the tab rather than merely
    // slowing it. Counting from OUTSIDE is what distinguishes "repaired once"
    // from "repairing forever".
    const seen: MutationRecord[] = [];
    const spy = new MutationObserver(records => seen.push(...records));
    spy.observe(root, { childList: true, attributes: true, subtree: true });

    overlayIn(root)!.remove();
    await new Promise(resolve => setTimeout(resolve, 100));
    spy.disconnect();

    expect(seen.length).toBeLessThan(10);
    expect(overlayIn(root)).not.toBeNull();
    overlay.destroy();
  });

  it("redraws nothing when the values did not move, whatever the array identities", () => {
    const root = mount();
    const { getContext } = recordingCanvas();
    const overlay = createWatermarkOverlay(root);

    overlay.update({ content: ["a", "b"], gap: [10, 10], offset: [5, 5] });
    const drawn = getContext.mock.calls.length;

    // Fresh arrays with identical values — which is what every framework hands
    // this on every commit. Identity comparison would redraw the canvas on each
    // one; omitting them from a dependency list would go stale instead, and on
    // a per-user watermark stale means the previous user's name.
    overlay.update({ content: ["a", "b"], gap: [10, 10], offset: [5, 5] });
    expect(getContext.mock.calls.length).toBe(drawn);

    overlay.update({ content: ["a", "c"], gap: [10, 10], offset: [5, 5] });
    expect(getContext.mock.calls.length).toBeGreaterThan(drawn);
    overlay.destroy();
  });

  it("is safe to destroy twice, which is what StrictMode does", async () => {
    const root = mount();
    const overlay = createWatermarkOverlay(root);
    overlay.update({ content: "x" });

    overlay.destroy();
    overlay.destroy();
    expect(overlayIn(root)).toBeNull();

    // And the observer is genuinely gone: a destroyed overlay that still
    // repairs itself is two stacked overlays after the next mount.
    await settle();
    expect(overlayIn(root)).toBeNull();
  });
});
