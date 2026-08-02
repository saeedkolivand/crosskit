/**
 * Watermark: the raster, the geometry, and the node that refuses to leave.
 *
 * A watermark is normally a compliance requirement rather than decoration, so
 * the thing it has to survive is not a re-render — it is someone opening the
 * inspector and deleting the node. That guarantee cannot live in an adapter:
 * a framework only knows about the nodes it rendered, and the whole point is
 * that this one comes back whether or not the framework was told. So the
 * overlay is created, written and repaired here, imperatively, and every
 * adapter renders nothing but the root.
 *
 * The other half is arithmetic — tile size, the canvas `font` shorthand, the
 * inline style string — which is pure and is where the failures that ship
 * silently live: an invalid font token that canvas ignores without a word, a
 * rotated mark clipped at the tile edge, a data URI that truncates the style
 * attribute at the semicolon in its own MIME type.
 */

export interface WatermarkFont {
  /** Any canvas `fillStyle`. Default `rgba(0,0,0,0.15)`. */
  color?: string;
  /** CSS px. Default 16, and the basis of the line box. */
  fontSize?: number;
  /** Default `"normal"`. Mapped, never passed through — see `watermarkFontSpec`. */
  fontWeight?: "normal" | "light" | "bold" | number;
  /** Default `"sans-serif"`. */
  fontFamily?: string;
  /** Default `"normal"`. Mapped the same way as the weight. */
  fontStyle?: "normal" | "italic" | "oblique";
}

export interface WatermarkOptions {
  content?: string | string[];
  /** URL or data URI. Wins over `content`, which stays the fallback if it fails to load. */
  image?: string;
  /** One mark's cell in CSS px. Measured when omitted for text; 120 for an image. */
  width?: number;
  /** Lines x line-height when omitted for text; 64 for an image. */
  height?: number;
  /** Degrees, clockwise. Default -22. */
  rotate?: number;
  /** Default 9. */
  zIndex?: number;
  /** `[x, y]` CSS px between marks. Default `[100, 100]`. */
  gap?: [number, number];
  /** `[x, y]` CSS px shift of the whole pattern. Defaults to half the gap. */
  offset?: [number, number];
  font?: WatermarkFont;
}

/** Every option with its default applied. The cell is still unknown for text. */
export interface ResolvedWatermarkOptions {
  content: string[];
  image?: string;
  width?: number;
  height?: number;
  rotate: number;
  zIndex: number;
  gap: [number, number];
  offset: [number, number];
  font: Required<WatermarkFont>;
}

/** Resolved options once the mark's cell is known, measured or given. */
export interface MeasuredWatermark extends ResolvedWatermarkOptions {
  width: number;
  height: number;
}

export interface WatermarkRaster {
  /** Absent when there is no 2D context at all, or the canvas was tainted. */
  dataUrl?: string;
  /** The mark's own cell, after measurement. */
  mark: { width: number; height: number };
  /** The repeating cell: the mark's rotated bounding box plus the gap. */
  tile: { width: number; height: number };
}

export interface WatermarkOverlay {
  /** Value-compared against the last call; redraws nothing when nothing moved. */
  update(options: WatermarkOptions): void;
  /** Idempotent, because StrictMode runs create/destroy/create. */
  destroy(): void;
}

/**
 * The line box, as a multiple of the font size.
 *
 * Canvas has no line-height of its own — `fillText` places one baseline and
 * nothing else — so multi-line content needs a number here or every line lands
 * on top of the last.
 */
const LINE_HEIGHT_RATIO = 1.2;

/** What an image's cell falls back to when it is not given one. */
const IMAGE_CELL = { width: 120, height: 64 };

/**
 * CSS `font-weight` takes `normal | bold | bolder | lighter | 100–900`, and
 * "light" is not among them. One invalid token invalidates the WHOLE `font`
 * shorthand, and canvas responds by silently keeping `10px sans-serif` — no
 * throw, no warning, just a mark that is tiny and in the wrong face. So every
 * keyword goes through a table and anything unrecognised becomes `normal`.
 */
const WEIGHTS: Record<string, string> = { normal: "normal", light: "300", bold: "bold" };
const STYLES: Record<string, string> = { normal: "normal", italic: "italic", oblique: "oblique" };

export function resolveWatermark(options: WatermarkOptions): ResolvedWatermarkOptions {
  const gap: [number, number] = options.gap ?? [100, 100];
  return {
    content:
      options.content == null
        ? []
        : Array.isArray(options.content)
          ? options.content
          : [options.content],
    image: options.image,
    width: options.width,
    height: options.height,
    rotate: options.rotate ?? -22,
    zIndex: options.zIndex ?? 9,
    gap,
    // Half the gap, so the default pattern is not flush against the corner of
    // the region — a mark that starts exactly at 0,0 reads as misaligned.
    offset: options.offset ?? [gap[0] / 2, gap[1] / 2],
    font: {
      color: options.font?.color ?? "rgba(0,0,0,0.15)",
      fontSize: options.font?.fontSize ?? 16,
      fontWeight: options.font?.fontWeight ?? "normal",
      fontFamily: options.font?.fontFamily ?? "sans-serif",
      fontStyle: options.font?.fontStyle ?? "normal",
    },
  };
}

/**
 * The canvas `font` shorthand, in the one order CSS accepts:
 * `style variant weight size family`. Any other order is an invalid shorthand,
 * which canvas ignores as silently as it ignores an invalid token.
 */
export function watermarkFontSpec(font: WatermarkFont | undefined): string {
  const f = resolveWatermark({ font }).font;
  const weight = typeof f.fontWeight === "number" ? String(f.fontWeight) : WEIGHTS[f.fontWeight];
  const style = STYLES[f.fontStyle];
  return `${style ?? "normal"} normal ${weight ?? "normal"} ${f.fontSize}px ${f.fontFamily}`;
}

/**
 * The repeating cell: the mark's ROTATED bounding box, plus the gap.
 *
 * A repeating background clips at the tile edge, and rotating a mark about the
 * tile centre pushes its corners outside an unrotated tile — so a rotated
 * watermark with a small gap loses its corners. Sizing from the bounding box
 * removes that whole class of bug for two lines of trigonometry; it only ever
 * grows the tile, and at `rotate: 0` it is arithmetically identical.
 */
export function watermarkTile(o: MeasuredWatermark): { width: number; height: number } {
  const a = Math.abs((o.rotate * Math.PI) / 180);
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  return {
    width: Math.ceil(o.width * cos + o.height * sin + o.gap[0]),
    height: Math.ceil(o.width * sin + o.height * cos + o.gap[1]),
  };
}

/**
 * Rasterise one tile and hand back its data URL and its geometry.
 *
 * The order below is the fragile part and is not rearrangeable: **setting
 * `canvas.width` resets the entire 2D context** — font, fillStyle, textAlign,
 * textBaseline, direction and the transform all revert to their defaults. A
 * canvas configured before it is sized draws a black `10px sans-serif` mark and
 * reports nothing at all. So: set the font, measure with it, size the canvas,
 * then set every context property again, then transform, then draw.
 *
 * `direction` comes from the root's computed `direction` rather than from a
 * prop, because bidi reordering of a mixed-script string is a property of where
 * the mark is rendered, not of the mark.
 */
export function drawWatermark(
  o: ResolvedWatermarkOptions,
  image?: HTMLImageElement,
  direction?: CanvasDirection
): WatermarkRaster {
  const lineHeight = o.font.fontSize * LINE_HEIGHT_RATIO;
  const spec = watermarkFontSpec(o.font);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // No context at all: jsdom without the canvas package, or an extension that
  // blocks canvas. The overlay still attaches and still holds its geometry —
  // it simply has no background — so the DOM contract and the restore
  // guarantee survive a failure of the raster.
  if (!ctx) {
    const mark = measureless(o, lineHeight);
    return { mark, tile: watermarkTile({ ...o, ...mark }) };
  }

  ctx.font = spec;
  // Keyed on whether an `image` was ASKED for, not on whether it has arrived:
  // sizing from the loaded element would make the tile jump the moment a slow
  // image lands, moving every mark on the page.
  const mark = {
    width: o.width ?? (o.image ? IMAGE_CELL.width : textWidth(ctx, o.content)),
    height: o.height ?? (o.image ? IMAGE_CELL.height : o.content.length * lineHeight),
  };
  const tile = watermarkTile({ ...o, ...mark });

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(tile.width * dpr);
  canvas.height = Math.round(tile.height * dpr);

  ctx.font = spec;
  ctx.fillStyle = o.font.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = direction ?? "inherit";

  // Scaled by backing/tile per axis rather than by `devicePixelRatio`, because
  // DPR is routinely fractional (1.25, 1.5, 2.75) and the rounded backing store
  // then no longer maps exactly onto the CSS tile — the grid drifts and seams
  // appear between tiles.
  ctx.setTransform(canvas.width / tile.width, 0, 0, canvas.height / tile.height, 0, 0);
  ctx.translate(tile.width / 2, tile.height / 2);
  ctx.rotate((o.rotate * Math.PI) / 180);

  if (image) {
    ctx.drawImage(image, -mark.width / 2, -mark.height / 2, mark.width, mark.height);
  } else {
    const n = o.content.length;
    o.content.forEach((line, i) => ctx.fillText(line, 0, (i - (n - 1) / 2) * lineHeight));
  }

  try {
    return { dataUrl: canvas.toDataURL("image/png"), mark, tile };
  } catch {
    // A cross-origin image taints the canvas and `toDataURL` throws
    // SecurityError. Losing the background is better than losing the overlay.
    return { mark, tile };
  }
}

/** Widest line, with the real font already set on the context. */
function textWidth(ctx: CanvasRenderingContext2D, content: string[]): number {
  return content.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
}

/** The cell when nothing can be measured, so the geometry is still sane. */
function measureless(
  o: ResolvedWatermarkOptions,
  lineHeight: number
): { width: number; height: number } {
  const longest = o.content.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    width: o.width ?? (o.image ? IMAGE_CELL.width : longest * o.font.fontSize * 0.6),
    height: o.height ?? (o.image ? IMAGE_CELL.height : o.content.length * lineHeight),
  };
}

/**
 * The overlay's entire style, as one deterministic string.
 *
 * Built from an ordered list and written with `setAttribute` so that what is
 * read back is byte-identical to what was written — see `createWatermarkOverlay`
 * for why that matters, and why `overlay.style` is never touched.
 *
 * The three `!important`s are the three properties whose loss is a defect
 * rather than a cosmetic change: without `display`/`visibility` there is no
 * watermark, and without `pointer-events` the overlay eats every click in the
 * region it covers. Inline `!important` outranks author `!important` from a
 * stylesheet, so this survives `[data-part="overlay"] { display: none !important }`.
 */
export function watermarkStyle(o: ResolvedWatermarkOptions, raster: WatermarkRaster): string {
  const declarations = [
    "position:absolute",
    // Logical, per the repo rule, even though the four edges resolve the same.
    "inset-inline:0",
    "inset-block:0",
    `z-index:${o.zIndex}`,
    "display:block!important",
    "visibility:visible!important",
    "pointer-events:none!important",
    "background-repeat:repeat",
    `background-size:${raster.tile.width}px ${raster.tile.height}px`,
    `background-position:${o.offset[0]}px ${o.offset[1]}px`,
  ];
  // The quotes are load-bearing: a data URI contains `data:image/png;base64,`
  // and an unquoted `url(...)` inside a style ATTRIBUTE ends at that semicolon,
  // dropping the declaration and garbling whatever follows it.
  if (raster.dataUrl) declarations.push(`background-image:url("${raster.dataUrl}")`);
  return declarations.join(";");
}

/** Exactly the attributes the overlay ever carries. Anything else is a tamper. */
const OVERLAY_ATTRS = ["data-scope", "data-part", "aria-hidden", "style"] as const;

/**
 * Attach an overlay to `root` and keep it there.
 *
 * The loop everyone writes first: the observer watches attributes and
 * childList, the repair writes attributes and re-appends the node, both are
 * watched, so the callback re-enters itself. MutationObserver callbacks are
 * microtasks, so a callback that always mutates starves the microtask queue and
 * hangs the tab outright — not a slow page, a dead one.
 *
 * Two fixes that do NOT work, both of which look right in review:
 *   - A synchronous `restoring = true` flag. The callback runs as a microtask,
 *     long after the flag was cleared, so the guard is a no-op.
 *   - Comparing what is there against what should be there and repairing only
 *     the difference. If the write goes through `style.setProperty` and the
 *     check reads `getAttribute("style")`, the CSSOM re-serialises the
 *     declaration and the two never compare equal, so every repair schedules
 *     another one forever.
 *
 * What is used instead: `disconnect()` before every write and a fresh
 * `observe()` after. Per spec `disconnect` empties the record queue, so nothing
 * done while detached is ever recorded and the callback cannot re-enter.
 * Nothing is read back at all — the repair is total, every attribute rewritten
 * and the node reattached — so there is no comparison left to fail to converge.
 */
export function createWatermarkOverlay(root: HTMLElement): WatermarkOverlay {
  const doc = root.ownerDocument;
  const overlay = doc.createElement("div");
  const attrs = new Map<string, string>([
    ["data-scope", "watermark"],
    ["data-part", "overlay"],
    // A literal string, not a boolean binding and not `dataAttr`: the overlay is
    // a raster with no text, so there is nothing for assistive tech to announce
    // and it should never appear in the tree — including if a consumer's CSS
    // gives it generated content.
    ["aria-hidden", "true"],
  ]);

  let options = resolveWatermark({});
  let serialised = "";
  let img: HTMLImageElement | undefined;
  /** Monotonic, so a slow load for the PREVIOUS image cannot repaint over the current one. */
  let token = 0;
  let destroyed = false;
  let media: MediaQueryList | undefined;

  const observer = new MutationObserver(() => write());

  const write = () => {
    if (destroyed) return;
    observer.disconnect();

    for (const attr of overlay.getAttributeNames()) {
      if (!OVERLAY_ATTRS.includes(attr as (typeof OVERLAY_ATTRS)[number])) {
        overlay.removeAttribute(attr);
      }
    }
    for (const [name, value] of attrs) overlay.setAttribute(name, value);
    if (overlay.parentNode !== root) root.appendChild(overlay);

    observer.observe(root, { childList: true });
    observer.observe(overlay, { attributes: true, childList: true });
  };

  const paint = (loaded?: HTMLImageElement) => {
    const raster = drawWatermark(options, loaded, readDirection(root));
    attrs.set("style", watermarkStyle(options, raster));
    write();
  };

  const load = (src: string, mine: number) => {
    const next = new Image();
    // Turns a missing CORS header into a clean load failure instead of a
    // tainted canvas, which is the difference between falling back to text and
    // losing the raster to a SecurityError.
    next.crossOrigin = "anonymous";
    next.onload = () => {
      if (mine === token && !destroyed) paint(next);
    };
    next.onerror = () => {
      // The mark stays: text is the documented fallback for an image that
      // cannot be fetched, and a blank compliance overlay is the worst outcome.
      if (mine === token && !destroyed) paint();
    };
    next.src = src;
    img = next;
  };

  const repaint = () => {
    const mine = ++token;
    paint();
    if (options.image) load(options.image, mine);
  };

  // A one-shot query per DPR value, re-armed on every change: moving the window
  // to another display or zooming the page changes `devicePixelRatio`, and a
  // raster drawn for the old one is visibly blurry.
  const armDpr = () => {
    if (typeof window.matchMedia !== "function") return;
    media?.removeEventListener("change", onDpr);
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    media.addEventListener("change", onDpr);
  };
  const onDpr = () => {
    if (destroyed) return;
    armDpr();
    repaint();
  };

  // `position: relative` is also in the stylesheet, but `ck.components` is
  // deliberately beatable by unlayered consumer CSS — and this is the one
  // property the observer cannot repair after the fact, because a `static` root
  // makes the overlay resolve against some ancestor and cover a region that is
  // not the protected one. Something is still drawn, which is what makes it a
  // silent compliance failure.
  if (getComputedStyle(root).position === "static") root.style.position = "relative";
  armDpr();

  return {
    update(next) {
      if (destroyed) return;
      const resolved = resolveWatermark(next);
      // Value comparison, not identity: `gap`, `offset` and a `content` array
      // are fresh objects on every render in every one of the four frameworks,
      // so identity would redraw on every commit. The shape is a flat literal
      // built by `resolveWatermark`, so the key order is fixed and the
      // serialisation is a valid equality test.
      const key = JSON.stringify(resolved);
      if (key === serialised) return;
      serialised = key;
      options = resolved;
      repaint();
    },
    destroy() {
      // Idempotent throughout: StrictMode runs create/destroy/create, and a
      // destroy that ran once leaves either two stacked overlays or a live
      // observer holding a detached node.
      destroyed = true;
      observer.disconnect();
      media?.removeEventListener("change", onDpr);
      media = undefined;
      if (img) {
        img.onload = null;
        img.onerror = null;
        img = undefined;
      }
      overlay.remove();
    },
  };
}

/** The root's resolved writing direction, for bidi reordering inside the mark. */
function readDirection(root: HTMLElement): CanvasDirection {
  return getComputedStyle(root).direction === "rtl" ? "rtl" : "ltr";
}
