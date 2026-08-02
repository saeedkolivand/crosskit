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
