import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@crosskit-ui/styles";
import { Cascader } from "@crosskit-ui/react";
import type { TreeNode } from "@crosskit-ui/core";

const OPTIONS: TreeNode[] = [
  {
    key: "zhejiang",
    title: "Zhejiang",
    children: [
      {
        key: "hangzhou",
        title: "Hangzhou",
        children: [
          { key: "west-lake", title: "West Lake" },
          { key: "xihu", title: "Xihu" },
        ],
      },
      { key: "ningbo", title: "Ningbo" },
    ],
  },
  {
    key: "jiangsu",
    title: "Jiangsu",
    children: [
      { key: "nanjing", title: "Nanjing", children: [{ key: "zhonghua", title: "Zhonghua" }] },
      { key: "suzhou", title: "Suzhou" },
    ],
  },
];

/**
 * A first level taller than the column's `max-block-size`, so the scroll claims
 * have something to scroll. The last entry is what arrowing to `End` has to
 * reach without taking the document with it.
 */
const LONG: TreeNode[] = [
  ...Array.from({ length: 30 }, (_, i) => ({ key: `n${i}`, title: `Item ${i}` })),
  { key: "branch", title: "Branch", children: [{ key: "leaf", title: "Leaf" }] },
];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* A ROW, not a column. The popup opens below its own trigger, so stacking
        the three vertically put `#open`'s popup on top of the other two
        triggers and every click on them was intercepted. */}
    <main style={{ padding: 24, display: "flex", gap: 24, alignItems: "start" }}>
      {/* Two columns already open, and a value committed inside the second, so
          the order, the divider, the width and the selected fill are all
          measurable in one render. `expandTrigger` is left at its DEFAULT —
          under hover-expand, hovering a row makes it active, so the hover
          specificity assertion could not fail. */}
      <div id="open" style={{ inlineSize: 220 }}>
        <Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} defaultOpen />
      </div>

      {/* Closed, for the indicator's rotation in its other state. */}
      <div id="shut" style={{ inlineSize: 220 }}>
        <Cascader options={OPTIONS} />
      </div>

      <div id="long" style={{ inlineSize: 220 }}>
        <Cascader options={LONG} />
      </div>
    </main>
    {/* The document has to be SCROLLABLE, or "arrowing did not scroll the
        document" is an assertion that cannot fail — the regression it guards is
        precisely a `scrollIntoView` walking out to a document that can move. */}
    <div id="tall" style={{ blockSize: "200vh" }} />
  </StrictMode>
);
