---
"@crosskit-ui/core": minor
"@crosskit-ui/react": minor
"@crosskit-ui/styles": minor
---

Add `Cascader` to React — a column-per-level picker over the same `TreeNode`
shape `Tree` takes.

The value is a **path**, not a key. Everything else follows from that. A key
only has to be unique among siblings, so two branches each holding an `other`
is the ordinary case rather than a malformed input — and resolving a path by
key against a flattened tree returns whichever node came first in document
order. `onChange(path, nodes)` therefore hands back both, because a consumer
re-resolving the path themselves would hit exactly that.

`value` accepts `null` as well as an array. `undefined` is the only thing that
means uncontrolled, so `value={null}` is a controlled clear rather than a silent
handover to internal state.

Two paths are held, not one. The committed value decides what the trigger reads
and what is painted chosen; a separate **browsing** path decides which columns
exist and where the keyboard is. They move independently — hovering or arrowing
opens a column without choosing anything — and the browsing one is re-seeded
from the value each time the popup opens, so abandoning a branch does not leave
the next opening pointing at it. It is clamped on read rather than on write, so
options that arrive after the value still leave the popup a tab stop instead of
a dead keyboard.

The two item states are different facts and both ship. `data-active` is "the
column beside me holds my children, and the keyboard is here"; `data-selected`
is "this is on the committed path", and it carries a common-prefix guard that
`data-active` deliberately does not need — while browsing one branch, a
same-keyed node under another would otherwise paint itself chosen.

Up and Down move within a column, Left and Right between columns, mirrored under
`dir="rtl"` — read off the DOM, since `dir` is inherited and the browser has
already resolved it. Enter and Space commit. Escape and Tab are deliberately not
handled here: the dismissable layer already owns both, and answering them twice
fires `onOpenChange` twice for one press. Focus is real DOM focus on a roving tab
stop rather than `aria-activedescendant`, because the only element that could
hold focus across every column is the popup container, which is not a composite
widget and should not claim to be one. Moving focus scrolls the column it is in
and never the document.

Each column is its own `listbox`, named by the option it descends from; the
container around them claims no role at all. `expandTrigger="hover"` opens
columns and never commits — only a click or Enter does. `name` emits one hidden
input per segment, keyed by position, because a path may legitimately repeat a
segment.

New in `@crosskit-ui/core`: `hasChildren`, `pathNodes` and `pathColumns` beside
the existing tree helpers, so four adapters derive the same columns rather than
four times over. `hasChildren` also replaces the two inlined copies of the same
`isLeaf`-wins expression in `flattenTree` and `expandableKeys`.

New in `@crosskit-ui/styles`: `cascader.css`. The columns are a plain flex row
with no direction override, so `direction: rtl` reverses their order for free.
The popup is deliberately **not** clamped to the trigger's width — a cascader is
wider than its control by definition.
