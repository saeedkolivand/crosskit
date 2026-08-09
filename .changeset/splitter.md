---
"@crosskit-ui/core": minor
"@crosskit-ui/styles": minor
"@crosskit-ui/react": minor
---

Add Splitter — resizable panes with a draggable bar between them.

`<Splitter>` takes `layout` (`"horizontal"` by default, or `"vertical"`),
`onResize` on every move and `onResizeEnd` once a gesture is over. Each
`<Splitter.Panel>` takes `size`/`defaultSize`, `min`, `max`, `collapsible` and
`resizable`; all four size props read the same grammar, where a bare number is
pixels, `"40%"` is a percentage of the resizable length and `"200px"` is pixels.
`collapsible` is `true` or `{ start, end }`, naming which edge the panel may be
pushed against.

Observable behaviour worth knowing:

- The bar is a focusable `role="separator"` with `aria-valuenow`,
  `aria-valuemin` and `aria-valuemax` as percentages. Arrow keys along the
  splitter's own axis move it 1% at a time, Shift and Page take 10%, Home and
  End jump to the reachable extremes, and Enter toggles a collapsible panel
  shut and back to the size it had. Double-clicking the bar does the same.
  Arrow keys across the other axis are left alone so the page still scrolls.
- `aria-orientation` is the perpendicular of `layout`: panels side by side are
  divided by a vertical separator.
- A boundary is bounded by both neighbours at once, so a trailing panel's `max`
  stops the leading one just as a leading panel's `min` does. A panel that
  declares no `size` still starts inside its own `min` and `max`: what it will
  not take is re-shared among the panels that can.
- A vertical splitter fills a parent that has a height of its own, and falls
  back to 12rem only in an auto-height parent.
- A drag that leaves the bar keeps tracking, and a horizontal drag inverts under
  `direction: rtl`.
- Panel sizes are percentages held in `flex-grow`, so a container resize
  redistributes them with no JavaScript. Pixel-valued `size`, `min` and `max`
  are resolved against the length measured at mount.
- Sizes reported to `onResize` and `onResizeEnd` are in pixels, one per panel.

`packages/core` gains `parsePanelSize`, `resolvePanelSizes`, `panelBounds`,
`resizePanels` and `splitterKey`, along with the `SplitterConstraint` type.
