---
"@crosskit-ui/core": minor
"@crosskit-ui/react": minor
"@crosskit-ui/styles": minor
---

Add `Watermark` to React, over a new framework-free controller in
`@crosskit-ui/core`.

A watermark is normally a compliance requirement rather than decoration, so the
thing it has to survive is not a re-render — it is someone opening the inspector
and deleting the node. That is why the overlay is not JSX in any adapter:
`createWatermarkOverlay` creates it, writes every attribute with `setAttribute`
and repairs it from a `MutationObserver`, so a deletion, a reparent, an edited
`style` or an added attribute all come straight back. Documented as resisting
accidental and casual removal, explicitly not as a security boundary — the mark
lives inside the page it is protecting.

The repair guards against itself by disconnecting the observer before every
write and re-observing after. A synchronous flag does not work here, because the
callback runs as a microtask long after the flag was cleared, and a callback that
always mutates starves the microtask queue and hangs the tab rather than merely
slowing it. Nothing is read back either, so there is no comparison that can fail
to converge — the repair rewrites everything unconditionally.

The overlay's whole geometry is one inline string, not a rule in
`watermark.css`, because a `MutationObserver` cannot see a stylesheet: a rule in
`ck.components` suppressed by an unlayered consumer sheet produces no mutation
record and would be unrepairable by construction. `display`, `visibility` and
`pointer-events` carry `!important` inline, which outranks author `!important`,
because losing any of the three is a defect rather than a cosmetic change — the
third one would make the overlay eat every click in the region it covers.

`Watermark` takes `content` (a string or one entry per line), `image`, `width`,
`height`, `rotate`, `zIndex`, `gap`, `offset` and `font`. The cell defaults to
the measured text, or 120x64 for an image, and the repeating tile is sized from
the mark's *rotated* bounding box plus the gap — a repeating background clips at
the tile edge, so a rotated mark in an unrotated tile loses its corners. At
`rotate: 0` the two are identical.

`font.fontWeight: "light"` is mapped to 300 rather than passed through, and any
unrecognised weight or style becomes `normal`. `light` is not a valid CSS
font-weight, one invalid token invalidates the entire `font` shorthand, and
canvas responds by silently keeping `10px sans-serif` — no throw, no warning, a
mark that is tiny and in the wrong face.

Options are compared by value inside core rather than by identity in the
adapter, because `gap`, `offset` and a `content` array are fresh objects on
every render in all four frameworks: a dependency list over them redraws on
every parent render, and one that omits them goes stale, which on a per-user
mark means showing the previous user's name.

New in `@crosskit-ui/styles`: `watermark.css`, two declarations on the root and
nothing at all for the overlay. `position: relative` is also written inline when
the root's computed position is still `static`, since `ck.components` is
deliberately beatable and this is the one property the observer cannot repair
after the fact — an overlay that resolved against the wrong ancestor still looks
like a watermark.
