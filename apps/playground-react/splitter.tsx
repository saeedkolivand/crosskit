import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@crosskit-ui/styles";
import { Splitter } from "@crosskit-ui/react";

/** Enough text in every panel that a drag across two of them could select some. */
const LOREM = "the quick brown fox jumps over the lazy dog ".repeat(6);

function Harness() {
  const [payload, setPayload] = useState("");

  return (
    <main style={{ padding: 24, display: "grid", gap: 32 }}>
      {/* Σ panels + Σ bars against the container's own width, at whatever
          width the spec sets on the box. */}
      <div id="tile-box" style={{ inlineSize: 900 }}>
        <Splitter id="tile" onResize={sizes => setPayload(JSON.stringify(sizes))}>
          <Splitter.Panel>{LOREM}</Splitter.Panel>
          <Splitter.Panel>{LOREM}</Splitter.Panel>
          <Splitter.Panel>{LOREM}</Splitter.Panel>
        </Splitter>
      </div>
      <pre id="payload">{payload}</pre>

      {/* The ratio has to survive a container resize with no JavaScript at all,
          which is what `flex-grow` against a zero basis buys. */}
      <div id="ratio-box" style={{ inlineSize: 1200 }}>
        <Splitter id="ratio">
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      <div id="rtl-box" dir="rtl" style={{ inlineSize: 600 }}>
        <Splitter id="rtl">
          <Splitter.Panel>{LOREM}</Splitter.Panel>
          <Splitter.Panel>{LOREM}</Splitter.Panel>
        </Splitter>
      </div>

      {/* 20% floor of its own, but the neighbour's 60% ceiling bites first at
          40% — the bound a one-sided clamp sails straight past. */}
      <div style={{ inlineSize: 600 }}>
        <Splitter id="bounds">
          <Splitter.Panel min="20%">a</Splitter.Panel>
          <Splitter.Panel max="60%">b</Splitter.Panel>
        </Splitter>
      </div>

      <div style={{ inlineSize: 600 }}>
        <Splitter id="collapse">
          <Splitter.Panel min="20%" collapsible>
            a
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* A vertical splitter in an auto-height parent: every panel is
          `flex-basis: 0`, so without a default block-size the whole thing
          renders invisibly and reports no error. */}
      <div>
        <Splitter id="vertical" layout="vertical">
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* The same vertical splitter in a parent that already has a height. The
          12rem is a fallback for the auto-height case above, not a size — and a
          component that renders 192px inside a 320px box is the ordinary way
          anyone uses it going wrong. */}
      <div id="vertical-tall-box" style={{ blockSize: 320 }}>
        <Splitter id="vertical-tall" layout="vertical">
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* A frozen bar, in both layouts. The cursor is the only thing that says
          "this one does not move" before the pointer is pressed, and the
          vertical one is where the disabled rule ties with the orientation rule
          on specificity. */}
      <div style={{ inlineSize: 600 }}>
        <Splitter id="frozen">
          <Splitter.Panel resizable={false}>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>
      <div style={{ inlineSize: 600 }}>
        <Splitter id="frozen-vertical" layout="vertical">
          <Splitter.Panel resizable={false}>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* Horizontal inside vertical. The inner panels are descendants of the
          outer root, so the measurement query and every CSS rule have to stop
          at the boundary. */}
      <div style={{ inlineSize: 600 }}>
        <Splitter id="outer" layout="vertical">
          <Splitter.Panel>
            <Splitter id="inner">
              <Splitter.Panel>a</Splitter.Panel>
              <Splitter.Panel>b</Splitter.Panel>
            </Splitter>
          </Splitter.Panel>
          <Splitter.Panel>c</Splitter.Panel>
        </Splitter>
      </div>

      {/* A flex item's automatic minimum size is its content's min-content
          size, so this table pins the whole splitter wider than its box unless
          the panel says `min-inline-size: 0`. */}
      <div id="wide-box" style={{ inlineSize: 600 }}>
        <Splitter id="wide">
          <Splitter.Panel>
            <div style={{ inlineSize: 2000, background: "#eee" }}>wide</div>
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* The same wide content with the panel's clipping turned off. `overflow:
          hidden` suppresses a flex item's automatic minimum size on its own, so
          this is the only fixture in which `min-inline-size: 0` is the thing
          doing the work. */}
      <div style={{ inlineSize: 600 }}>
        <Splitter id="wide-visible">
          <Splitter.Panel style={{ overflow: "visible" }}>
            <div style={{ inlineSize: 2000, background: "#eee" }}>wide</div>
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>

      {/* The root as a FLEX ITEM, which is the only shape that can see the
          root's own `inline-size: 100%` / `min-inline-size: 0` / `min-block-size:
          0`. A block-level root in a block parent already fills its parent and
          already shrinks, so it reports the same numbers either way — the
          representative that cannot fail. Each box below carries a rigid
          sibling, because "the splitter fits" and "the sibling keeps its size"
          are the two halves of what these declarations buy. */}

      {/* Small content: nothing here needs a minimum lifted, so this box isolates
          `inline-size: 100%`. A flex item does not grow to fill its parent, so
          without it the root sizes to "a"+bar+"b" and sits a few px wide. */}
      <div id="flex-narrow-box" style={{ display: "flex", inlineSize: 600 }}>
        <Splitter id="flex-narrow">
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
        <div id="flex-narrow-sibling" style={{ flex: "0 0 100px", background: "#eee" }}>
          sib
        </div>
      </div>

      {/* Wide content: the root's automatic minimum size is its own min-content,
          which the PANELS' `min-inline-size: 0` does not zero — so without the
          root's own min the root pins at ~916px inside this 600px row and
          pushes the sibling out. */}
      <div id="flex-wide-box" style={{ display: "flex", inlineSize: 600 }}>
        <Splitter id="flex-wide">
          <Splitter.Panel>
            <div style={{ inlineSize: 900, background: "#eee" }}>wide</div>
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
        <div id="flex-wide-sibling" style={{ flex: "0 0 100px", background: "#eee" }}>
          sib
        </div>
      </div>

      {/* The same automatic minimum, in a grid. A grid item stretches on its own,
          so `inline-size: 100%` is not what is being read here — only the min. */}
      <div
        id="grid-box"
        style={{ display: "grid", gridTemplateColumns: "1fr 100px", inlineSize: 600 }}
      >
        <Splitter id="grid-wide">
          <Splitter.Panel>
            <div style={{ inlineSize: 900, background: "#eee" }}>wide</div>
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
        <div id="grid-sibling" style={{ background: "#eee" }}>
          sib
        </div>
      </div>

      {/* The block axis of the same thing: a HORIZONTAL splitter as an item of a
          column flex parent. Its main-axis minimum is its content's min-content
          height, so a 900px-tall child makes the root 900px tall inside this
          200px box unless the root says `min-block-size: 0`. */}
      <div
        id="flex-column-box"
        // The inline size is stated even though every assertion here is on the
        // block axis: without it the box inherits the page width, which other
        // fixtures on this page already push past the viewport — so this box's
        // geometry would be decided by an unrelated fixture.
        style={{ display: "flex", flexDirection: "column", blockSize: 200, inlineSize: 600 }}
      >
        <Splitter id="flex-column">
          <Splitter.Panel>
            <div style={{ blockSize: 900, background: "#eee" }}>tall</div>
          </Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
        <div id="flex-column-sibling" style={{ flex: "0 0 40px", background: "#eee" }}>
          sib
        </div>
      </div>

      <button id="before-focus" type="button">
        focus me first
      </button>
      <div style={{ inlineSize: 600 }}>
        <Splitter id="focus">
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);
