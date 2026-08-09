import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@crosskit-ui/styles";
import { Watermark } from "@crosskit-ui/react";

/** A 2x2 opaque PNG, inline so the image path is exercised with no network in it. */
const RED_DOT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4AWP8z8DwnwEJMDEgAdwcAEfmAgFrqp2xAAAAAElFTkSuQmCC";

const box = { inlineSize: 400, blockSize: 200, background: "#eef" } as const;

/**
 * The watermark harness.
 *
 * Every section exists for one assertion that only a real browser can make, and
 * they are kept apart because several of them tamper: a suite that deleted the
 * overlay from the same node it later measures would be asserting against the
 * repair rather than against the component.
 */
function Harness() {
  const [clicked, setClicked] = useState(false);

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      {/* Coverage, and the click that has to reach through it. */}
      <Watermark id="covers" content="Confidential" style={box}>
        <button id="target" type="button" onClick={() => setClicked(true)}>
          {clicked ? "clicked" : "click me"}
        </button>
      </Watermark>

      {/* Tampered with, and nothing else measures it. */}
      <Watermark id="tamper" content="Confidential" style={box} />

      {/* A consumer sheet trying to hide it, scoped in watermark.html. */}
      <div id="hidden">
        <Watermark id="hidden-mark" content="Confidential" style={box} />
      </div>

      {/* A positioned ancestor, offset from the root, plus an unlayered rule
          putting the root back to `static`. If the inline `position: relative`
          is not written, the overlay covers the ancestor instead — and still
          looks like a watermark. */}
      <div id="static-outer" style={{ position: "relative", padding: 40, background: "#fee" }}>
        <div id="static-root">
          <Watermark id="static-mark" content="Confidential" style={box} />
        </div>
      </div>

      {/* Same string, opposite directions. Only a real text shaper reorders a
          mixed-script run, so this is the one place `ctx.direction` is visible. */}
      <Watermark id="ltr" dir="ltr" content="ABC عربى" style={box} />
      <Watermark id="rtl" dir="rtl" content="ABC عربى" style={box} />

      {/* Three weights at one size. `normal` is the control: it is the one
          shorthand that cannot be rejected, so the tile it measures is what a
          32px font is worth — and a mapped `light` has to measure the same. */}
      <Watermark
        id="normal-weight"
        content="Weight"
        font={{ fontWeight: "normal", fontSize: 32 }}
        style={box}
      />
      <Watermark
        id="light"
        content="Weight"
        font={{ fontWeight: "light", fontSize: 32 }}
        style={box}
      />
      <Watermark
        id="bold"
        content="Weight"
        font={{ fontWeight: "bold", fontSize: 32 }}
        style={box}
      />

      {/* A rotated mark with an opaque colour and a small gap, so "is anything
          clipped at the tile edge" is answerable by reading the alpha channel
          rather than by re-deriving the bounding-box formula the code already
          has. */}
      <Watermark
        id="rotated"
        content="Confidential"
        rotate={30}
        gap={[8, 8]}
        font={{ color: "rgba(0,0,0,1)", fontSize: 24 }}
        style={box}
      />

      {/* The image path end to end: load, draw, rasterise — and beside it the
          control, which is the same 120x64 cell drawn from the same text at the
          same angle. That is exactly the raster `#image` carries until its load
          resolves, so "the image drew" is `#image` no longer matching it. The
          tile SIZE cannot answer that question: it is 120x64 either way,
          because the cell is keyed on an image having been asked for rather
          than on one having arrived. */}
      <Watermark id="image" image={RED_DOT} content="fallback" style={box} />
      <Watermark id="image-fallback" content="fallback" width={120} height={64} style={box} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);
