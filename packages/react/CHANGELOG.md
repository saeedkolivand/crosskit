# @crosskit-ui/react

## 2.0.0

### Major Changes

- [#67](https://github.com/saeedkolivand/crosskit/pull/67) [`a267c58`](https://github.com/saeedkolivand/crosskit/commit/a267c5886bf55e77f5e3891d1282f6a0bb02e74a) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Rebuild Tooltip on the core primitives, add Popover, and replace Menu with Dropdown.

  `@zag-js/tooltip`, `@zag-js/menu` and `@zag-js/presence` are gone from
  `@crosskit-ui/react`, and `use-presence.ts` with them. What remains of the
  third-party graph there is Accordion, Select, Tabs and Toast.

  **Breaking, React only.** The other three adapters keep the v1 API until they
  move too.

  Marked `major` rather than `minor`, because `Menu`, `MenuProps`, `MenuItem`,
  `MenuEntry` and `MenuSeparator` leave the public API and four `Tooltip` props are
  renamed. There is no shape of this change that is compatible with `^1.0.0`, and
  the accumulated changesets are meant to land as 2.0.0 anyway — recording it as a
  minor would have published removed exports as 1.1.0.

  - `Tooltip`'s `content` is now `title`, `contentClassName` is `overlayClassName`,
    and `openDelay`/`closeDelay` are `mouseEnterDelay`/`mouseLeaveDelay` **in
    seconds**. An empty `title` never opens, so `title={row.note}` needs no
    conditional around it. New: `trigger`, `color`.
  - `Menu` is now `Dropdown`, and takes the trigger _element_ rather than trigger
    content — no generated button, so your own `<Button>` stays exactly one
    button. Items move to `menu={{ items, onClick }}`, `value` to `key`, and
    `{ separator: true }` to `{ type: "divider" }`.
  - `Popover` is new: a title, a body, and real controls inside it. `role="dialog"`
    rather than `tooltip`, so a screen reader can reach what is in it. Its default
    `trigger` is `["hover", "click"]` — `click` is what lets a keyboard open it at
    all, since Enter or Space on the trigger dispatches one, and unlike the other
    two there is no second way in.

  All three share one hook, so they cannot drift apart in the parts a user can
  observe, and all three portal to `document.body` — a transformed ancestor would
  otherwise capture the `position: fixed` popup and place it somewhere else.

  Dropdown and Popover move focus into the popup when they open and hand it back
  when they close, which is what makes a portalled popup reachable at all: tab
  order follows the DOM, and the popup is a body sibling at the end of the
  document rather than a neighbour of its trigger. Neither does it on a hover-open
  — a pointer crossing a trigger is not a request for focus.

  `Dropdown` gets arrow keys, Home/End, typeahead, and `aria-activedescendant`
  from the primitives already in core. It opens on Enter, Space and the arrows
  whatever `trigger` says, because a menu button answering Enter belongs to the
  role rather than to the pointer configuration.

  `core`'s `computePosition` now also reports how much room the chosen side has,
  and `applyPosition` writes it as `--ck-available-width` / `--ck-available-height`.
  A popup that scrolls has to cap itself against that or it runs off the screen
  with its last items unreachable, and neither flip nor shift can help once the
  content is taller than both sides.

  Styles: a `popover` scope, an arrow driven by the positioner's own
  `data-placement` and `--ck-arrow-x/y`, and a real `z-index` on the anchored
  positioners alongside the `--z-index` the v1 adapters still read.

- [#64](https://github.com/saeedkolivand/crosskit/pull/64) [`00cb4b5`](https://github.com/saeedkolivand/crosskit/commit/00cb4b52687f09ac4a45dc9a13886f354677d55f) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Begin the React v2 API. `Button` now takes `type`, `size` (small/middle/large), `shape`, `danger`,
  `ghost`, `block`, a `ReactNode` icon, and `htmlType` for the native attribute; an `href` renders an
  anchor. `ConfigProvider` carries a compiled theme, locale and direction.

  This is a breaking change to `@crosskit-ui/react`. The other adapters are unchanged until they
  follow.

- [#70](https://github.com/saeedkolivand/crosskit/pull/70) [`b096aae`](https://github.com/saeedkolivand/crosskit/commit/b096aaece88c47c40260c806b593c80ea4272383) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Rebuild Select on the core primitives.

  `@zag-js/select` is gone from `@crosskit-ui/react`. Toast is the only component
  there still on a machine.

  **Breaking, React only.** The other three adapters keep the v1 API until they
  move too.

  - `items` becomes `options`, and `SelectItem` becomes `SelectOption`.
  - `onValueChange({ value, item })` becomes `onChange(value, option)` — the
    option as well as the value, because a consumer almost always wants the label
    too and would otherwise have to look it up again.
  - `size` takes `small` / `middle` / `large` and emits `data-size` in that
    vocabulary, so v2 carries its own rules alongside the `sm`/`md`/`lg` block the
    other adapters still match.
  - `invalid` becomes `status="error"`, which colours the control and marks the
    trigger `aria-invalid`. `status="warning"` is presentation only, since there is
    no ARIA state for it. `errorMessage` sets `aria-invalid` too and describes the
    trigger, and is what a screen reader actually reads out.
  - `variant` is gone — it was a field-level prop the select never used
    distinctly.
  - **`<Option>` children are gone.** One way to declare options rather than two,
    and the one that survives being generated. It also cannot be wrapped in
    another component, which the v1 doc comment named as its own ceiling.
  - New: `placement`, from the same twelve names the overlays take.

  The listbox is built on `useAnchored`, so it inherits what the anchored
  overlays already had: portalling out of transformed ancestors, collision-aware
  placement, dismissal, focus moving in on open and back on close, and a highlight
  scrolled into view. Keyboard comes from `navigation.ts`, `collection.ts` and
  `createTypeahead` — arrows, Home/End, typeahead, and stepping over disabled
  options.

  `applyPosition` also publishes `--ck-anchor-width`, so a popup that belongs to
  its trigger can match it rather than sizing to its own content — a listbox
  sized to its content jumps about as the options change.

  Opening lands on the current selection rather than the top of the list, on every
  route in rather than only the keyboard one.

- [#69](https://github.com/saeedkolivand/crosskit/pull/69) [`a29798d`](https://github.com/saeedkolivand/crosskit/commit/a29798ddb9468157391af5da615292f715b5df13) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Rebuild Tabs on the core primitives, and replace Accordion with Collapse.

  `@zag-js/accordion` and `@zag-js/tabs` are gone from `@crosskit-ui/react`. What
  remains of that graph there is Select and Toast.

  **Breaking, React only.** The other three adapters keep the v1 API until they
  move too.

  - `Tabs`: items are keyed by `key` and carry `children` rather than `id` and
    `content`; `value`/`defaultValue`/`onValueChange` become
    `activeKey`/`defaultActiveKey`/`onChange`, which passes the key itself rather
    than a detail object; `variant` becomes `type` with `line` and `card`; and
    `orientation` becomes `tabPosition`, which derives it — the arrow keys follow
    the axis the list is actually laid out on, so the two cannot disagree.
  - `Accordion` is now `Collapse`. Items are keyed the same way, and
    `value`/`defaultValue`/`onValueChange` become
    `activeKey`/`defaultActiveKey`/`onChange`.
  - **`Collapse` allows several panels open by default**, where `Accordion`
    allowed one. `accordion` is the prop that opts back into one-at-a-time — the
    inverse of `allowMultiple`, and the default the name change implies.
  - `collapsible` is gone. A collapse with nothing open is a legitimate state
    rather than one to be prevented, in both modes.

  `activationMode` survives, and is deliberately not part of the API this mirrors:
  both are valid in the ARIA pattern, and `manual` is what a panel that loads
  something wants — automatic selection would fetch every panel the user arrows
  past.

  A `Tabs` whose first item is disabled is now keyboard-operable. The selection
  fell back to `items[0]` regardless, so the roving `tabIndex={0}` sat on a button
  that cannot take focus while every other tab held `-1` — Tab skipped the whole
  list and landed on the panel. It picks the first ENABLED item now, and the one
  entry in the tab order is always a tab that can be focused, even when a consumer
  names a disabled one in `activeKey`. Inherited from v1, which had the same
  fallback, and fixable for the first time now the selection is ours.

  Keyboard navigation now comes from `navigation.ts` and `collection.ts`, which
  also makes it testable: the previous suite could not assert arrow keys at all,
  because the machine filtered focus candidates by visibility and jsdom reports
  every element as zero-sized.

  Styles: v2 tab rules keyed on `data-type`, in logical properties, alongside the
  `data-ck-variant` block the v1 adapters still match.

- [#71](https://github.com/saeedkolivand/crosskit/pull/71) [`bd9f7a3`](https://github.com/saeedkolivand/crosskit/commit/bd9f7a32d156e738912e69c0e29582b75da6f052) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Rebuild React's Toaster on a framework-free queue in `core`.

  `createToastQueue()` is new in `@crosskit-ui/core`: a plain store with the queue,
  per-toast countdowns, pause and resume, overflow and placement in it, and no
  framework anywhere. `<Toaster>` in React reads it through `useSyncExternalStore`.

  **Breaking, React only.** `<Toaster toaster>` now takes a `ToastQueue` from
  `createToastQueue()` rather than the store from `createToaster()`:

  ```diff
  -import { createToaster } from "@crosskit-ui/core";
  -export const toaster = createToaster();
  +import { createToastQueue } from "@crosskit-ui/core";
  +export const toaster = createToastQueue();
  ```

  Everything you call on it is unchanged — `create`, `success`, `error`,
  `warning`, `info`, `loading`, `update`, `dismiss`. Vue, Svelte and Angular keep
  `createToaster()` and are untouched.

  The group emits what it did before. **Each toast root emits less.** The flow
  layout has no per-toast geometry, so `data-first`, `data-stack`, `data-ghost`,
  `data-overlap`, `data-sibling`, `data-mounted` and `data-paused` are gone along
  with the `--x`/`--y`/`--z-index`/`--offset` custom properties that drove the
  old stacking, and `data-placement`, `data-side` and `data-align` now live on the
  group only. `data-state`, `data-type` and the part attributes are unchanged. If
  you style a toast off any of the removed ones, move the selector to the group or
  key it on `data-state`.

  `dir` is also gone, deliberately. Every rule is written in logical properties,
  so the group inherits direction from its ancestors — and an explicit `dir="ltr"`
  inside an RTL document would have forced the wrong one.

  Two option names differ on the factory: `removeDelay` replaces the machine's
  `gap`/`offsets`, which were part of an absolute-positioning scheme the flow
  layout does not have. Placement, `max` and `duration` are the same.

  `@crosskit-ui/react` now declares **no third-party runtime dependencies at all**
  — only its sibling `@crosskit-ui/*` packages.

  Also fixed: the exit transition ran for 300ms while a dismissed toast was
  removed after 200ms, so the last third of every exit was cut off mid-flight.
  The two are now a documented pair, in both files.

  Toasts enter with an animation again. A node inserted straight at its resting
  style has nothing to transition from, so this is keyframes rather than a
  transition on `data-state` — which only ever drove the exit.

### Minor Changes

- [#57](https://github.com/saeedkolivand/crosskit/pull/57) [`e3dce7f`](https://github.com/saeedkolivand/crosskit/commit/e3dce7f4ebf010aa6b933d0f30eed6ce1cfa7565) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add the dependency-free behaviour primitives to `@crosskit-ui/core`.

  Focus trapping with wrap and restore, a shared dismissable layer stack so nested overlays close in
  the right order, presence tracking that keeps a node mounted through its exit animation,
  reference-counted scroll locking, and a pure collection plus keyboard navigation with typeahead.

  Nothing consumes them yet.

- [#73](https://github.com/saeedkolivand/crosskit/pull/73) [`9825949`](https://github.com/saeedkolivand/crosskit/commit/98259491e17583c66f4450a0ac73692bf05a1c88) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Breadcrumb`, `Steps` and `Segmented` to React.

  **`Breadcrumb`** takes `items` (`title`, `href`, `onClick`) and a `separator`.
  It renders a `<nav aria-label="Breadcrumb">` around an ordered list, the
  separator sits in its own list item and is `aria-hidden` — read aloud inside the
  label it turns "Settings" into "Settings slash" — and the last crumb is text
  with `aria-current="page"` rather than a link, because it is where you already
  are. An item with `onClick` and no `href` renders a `<button>`, not an anchor:
  an `<a>` with no `href` takes neither focus nor Enter, so the handler would be
  mouse-only.

  **`Steps`** takes `items` (`title`, `subTitle`, `description`, `icon`, `status`,
  `disabled`) plus `current`, `direction`, `labelPlacement`, `size`, `status`,
  `progressDot` and `initial`. Each step's status comes from its position —
  before `current` is `finish`, after is `wait` — and `current` itself carries the
  group `status`, which is how one `status="error"` marks the step that failed
  rather than the whole list. An item's own `status` overrides that.

  Passing `onChange` turns the steps into buttons; without it they are inert
  markup rather than N extra tab stops.

  **`Segmented`** takes `options` (a bare string is both label and value, or
  `{ label, value, disabled, icon }`), `value`/`defaultValue`/`onChange`, `size`,
  `disabled`, `block` and `vertical`. It is a `role="radiogroup"` of
  `role="radio"` buttons with a roving tabindex: one tab stop for the whole
  control, arrows move **and** select on both axes, and the list loops. That is
  the radio-group pattern rather than the tablist one, which is why there is no
  `activationMode` — a segmented control has no panel to load, so deferring
  selection would only cost a keypress.

  If the selected option is disabled the tab stop moves to the first enabled one,
  since a tab stop that cannot take focus is no tab stop.

  New in `@crosskit-ui/styles`: `navigation.css`, keyed on `data-scope`
  `breadcrumb`, `steps` and `segmented`.

- [#91](https://github.com/saeedkolivand/crosskit/pull/91) [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Cascader` to React — a column-per-level picker over the same `TreeNode`
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

  Two paths are held, not one. The committed value decides what the trigger reads,
  what is painted chosen and what `name` submits; a separate **browsing** path
  decides which columns exist and where the keyboard is. They move independently —
  hovering or arrowing opens a column without choosing anything — and the browsing
  one is re-seeded from the value on every opening, whichever route opened it:
  `defaultOpen`, a gesture, or a controlled consumer flipping `open` themselves.
  So abandoning a branch does not leave the next opening pointing at it. It is
  clamped on read rather than on write, so options that arrive after the value
  still leave the popup a tab stop instead of a dead keyboard.

  The two item states are different facts and both ship. `data-active` is "the
  column beside me holds my children, and the keyboard is here"; `data-selected`
  is "this is on the committed path", and it carries a common-prefix guard that
  `data-active` deliberately does not need — while browsing one branch, a
  same-keyed node under another would otherwise paint itself chosen.

  Up and Down move within a column, Left and Right between columns, mirrored under
  `dir="rtl"` — read off the DOM, since `dir` is inherited and the browser has
  already resolved it. Enter and Space commit; Tab closes and hands focus back to
  the trigger, so the browser's own Tab carries on from the control rather than
  from a popup portalled to the end of the document. Escape is deliberately not
  handled here: the dismissable layer already owns it, and answering it twice
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
  wider than its control by definition. The trigger carries `data-clearable` while
  a clear button is on screen: that button is out of flow, so nothing else can
  reserve the room it needs, and without the room it lands on the indicator and
  eats the press meant for it.

- [#62](https://github.com/saeedkolivand/crosskit/pull/62) [`667ac59`](https://github.com/saeedkolivand/crosskit/commit/667ac596584cfb4a627ecf24f60e04ef456a3b05) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free date engine to `@crosskit-ui/core`.

  Calendar arithmetic on `[year, month, day]` rather than timestamps, so daylight saving cannot skew
  it; month grids padded to whole weeks with a configurable week start; and month names, weekday
  names, formatting and locale-aware parsing entirely from `Intl` — no locale packs.

  This completes Phase 3. Nothing consumes any of it yet.

- [#80](https://github.com/saeedkolivand/crosskit/pull/80) [`8d0d5d8`](https://github.com/saeedkolivand/crosskit/commit/8d0d5d8d90637bb8538ecea29adcb4dc3077870c) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Calendar` and `DatePicker` to React, over the date engine in
  `@crosskit-ui/core`.

  All the arithmetic is already in core — grid generation, month and year
  stepping, the daylight-saving-safe day difference, and the rule that a calendar
  day is `[year, month, day]` rather than a timestamp. All the naming comes from
  `Intl`, so there is no locale pack behind any of this and nothing in the adapter
  has a month-length table in it.

  The public value is a `Date`, because that is what a consumer has. The
  `CalendarDate` triple stays internal: it is what makes the arithmetic exact and
  the wrong thing to hand someone who wants to put a date in a request.

  **`Calendar`** takes `value`/`defaultValue`/`onChange`, `onPanelChange`,
  `disabledDate`, `cellRender` and `fullscreen`. It renders a real `<table
role="grid">` — the pattern a screen reader announces as a date grid, row and
  column position included, which no amount of `aria-*` on nested divs expresses.

  One tab stop for the whole grid, and the cursor is separate from the selection:
  arrows move without selecting, because a picker that commits on every arrow
  press fires `onChange` six times crossing a week. Arrows move by day and week,
  `PageUp`/`PageDown` by month, `Home`/`End` to the ends of the month, and the
  page follows the cursor out of the month rather than leaving focus on a cell
  nobody can see.

  Disabled days use `aria-disabled`, not the `disabled` attribute. A disabled
  button cannot take focus, so the roving tab stop could never land on one — and
  the arrow that moved the cursor there would leave focus on the previous cell,
  where the next Enter selects the wrong day. Skipping disabled days instead makes
  everything past a long block unreachable. So the cell stays focusable and
  refuses to activate, by either route.

  **`DatePicker`** takes the same value props plus `format`, `placeholder`,
  `size`, `status`, `showToday`, `allowClear`, `inputReadOnly` and the anchoring
  props. Typing is read back through the locale's own part order — `01/02/2026` is
  January in the US and February nearly everywhere else, so reaching for
  `Date.parse` would silently pick one. An unparseable or disabled entry reverts
  rather than clearing: someone who mistyped wants to see what they had.

  Focus does **not** move into the panel when it opens, because the field is typed
  into. `ArrowDown`, `PageUp` and `PageDown` hand the grid the keyboard — they do
  nothing in a single-line field, so they are free to take, while left and right
  stay with the caret. Selecting, Escape and a press outside all return focus to
  the field.

  New in `@crosskit-ui/styles`: `date.css`, keyed on `data-scope` `calendar` and
  `date-picker`. The header's paging arrows are mirrored once with a transform
  rather than each button choosing a different icon.

  `Locale.DatePicker` gains `clear`, for the clear button's accessible name.

  The direction that reverses the horizontal arrows is read off the DOM rather
  than from `ConfigProvider`, matching the five other components that reverse
  keys: the column order comes from the document's own `dir`, so taking it from
  context gave a mirrored grid whose ArrowLeft moved to the previous day whenever
  the two disagreed.

- [#61](https://github.com/saeedkolivand/crosskit/pull/61) [`722ff04`](https://github.com/saeedkolivand/crosskit/commit/722ff04f80e3651b8af79245b6aa5492724dc8a2) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free form engine to `@crosskit-ui/core`.

  Nested field paths, declarative validation rules with templated messages, per-field and per-form
  validate triggers, cross-field dependencies, async validators, list fields with error re-indexing,
  and submission state.

  The CSS compiler's `Rule` type is renamed `CssRule`, since the validation rule has the stronger
  claim on the bare name.

- [#78](https://github.com/saeedkolivand/crosskit/pull/78) [`5b33a33`](https://github.com/saeedkolivand/crosskit/commit/5b33a33d6a31d2cb866a47eef0164101002a4689) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Form`, `Form.Item` and `Form.List` to React, over the form engine in
  `@crosskit-ui/core`.

  Everything that decides behaviour already lives in core — values, errors,
  touched state, rule evaluation, dependency re-validation and list re-indexing —
  so what is new here is subscription, context and markup. That is deliberate:
  "when does this field validate" and "which fields re-validate when this one
  changes" are where four hand-written adapters would diverge from each other.

  **`Form`** takes `form` (from `Form.useForm()`, optional — omit it and the form
  owns its own instance), `initialValues`, `onFinish`, `onFinishFailed`, `layout`,
  `validateTrigger`, `disabled` and `requiredMark`. It renders a `<form
noValidate>`: the browser's own validation bubbles fire before any rule here
  runs and say something different in a different language, so the rules are the
  contract and the browser's are not.

  **`Form.Item`** takes `name`, `label`, `rules`, `dependencies`, `valuePropName`,
  `trigger`, `getValueFromEvent`, `validateTrigger`, `help`, `extra`, `required`
  and `noStyle`. It clones its child to bind the value — and **composes** the
  child's own `onChange` and `onBlur` rather than replacing them, which is the
  failure mode that makes cloning dangerous and the one thing it has to get right.

  The default unwrapper reads `target[valuePropName]` from an event-like first
  argument and passes anything else through, so one default covers a text input
  (`target.value`), a checkbox (`valuePropName="checked"` → `target.checked`) and
  our own controls, which report `onChange(next)` directly.

  Validation defaults to blur, not change: telling someone their address is
  invalid while they are typing the first character of it is worse than saying
  nothing. A visible error still clears the moment the value becomes valid.

  **`Form.List`** takes `name` and a render function `(fields, { add, remove,
move })`. A row's `name` is its index, so `name={[field.name, "email"]}` inside
  `<Form.List name="guests">` resolves to `guests[0].email` — the prefix arrives
  through context, since the rows are rendered by the caller and there is nothing
  for the list to wrap. Row keys are handed out per row rather than being the
  index: removing row 1 of three shifts row 2 into index 1, and an index key makes
  React reuse the removed row's DOM for it, taking the caret, any scroll position
  and any uncontrolled state to the wrong row.

  Three layouts. `horizontal` shares one label column across every row through
  `subgrid`, so the column is as wide as the widest label with nothing measured
  and no width to configure; a row with no label still occupies the control
  column. `vertical` is the default and `inline` wraps.

  New in `@crosskit-ui/styles`: `form.css`, keyed on `data-scope="form"`. The
  required marker is generated content on `[data-required]`, so it cannot be
  mistaken for text by a screen reader — it is decoration. `aria-required`,
  `aria-invalid` and the message's `aria-describedby` are what carry the state,
  and all three keep whatever the child already declared rather than writing over
  it: `cloneElement` sets an explicit `undefined`, so replacing them would erase a
  consumer's own `aria-describedby` on every field with no error.

  Known gap, unchanged by this: `Select` feeds its `...rest` to the anchoring hook
  rather than to the DOM, so the `id` and `aria-*` a `Form.Item` injects do not
  reach it. Value and change binding work, because those are declared props.

- [#51](https://github.com/saeedkolivand/crosskit/pull/51) [`9efaa3f`](https://github.com/saeedkolivand/crosskit/commit/9efaa3fbe798ee7803cf211bdedf7beb11aa7104) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free anchor positioner to `@crosskit-ui/core`.

  `computePosition()` is pure geometry — rects in, coordinates out — with flip, shift, arrow
  placement and RTL mirroring, and it accepts both canonical placements (`top-start`) and their
  camelCase aliases (`topLeft`). `attachPosition()` is the DOM half, keeping a floating element on
  its anchor across scroll, resize and either element changing size.

  This is the first piece of the v2 behaviour core. Nothing consumes it yet.

- [#59](https://github.com/saeedkolivand/crosskit/pull/59) [`7bf2fd2`](https://github.com/saeedkolivand/crosskit/commit/7bf2fd29834afab90ba9d767dc676a6d9b4f8805) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Complete the motion engine in `@crosskit-ui/core`.

  `flipLayout()` animates layout changes the browser cannot tween — toast stacks resettling, table
  rows moving on sort — by inverting the change and animating the inversion away. `createDrag()`
  recognises pointer drags with trailing-window velocity, for drag-to-dismiss. `stagger()` produces
  delays for a sequence.

  Nothing consumes them yet.

- [#58](https://github.com/saeedkolivand/crosskit/pull/58) [`b706129`](https://github.com/saeedkolivand/crosskit/commit/b7061296f17d5a7f09dd03b03d69f1484325026f) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add spring physics and a Web Animations wrapper to `@crosskit-ui/core`.

  `createSpring()` solves the damped harmonic oscillator analytically, and `toLinearEasing()` samples
  it into a CSS `linear()` easing — so an uninterrupted spring runs on the compositor with no
  JavaScript at all. `animate()` and `retarget()` cover what CSS cannot: interruption from the
  current value, and keyframes only known at runtime.

  Nothing consumes them yet.

- [#76](https://github.com/saeedkolivand/crosskit/pull/76) [`978b924`](https://github.com/saeedkolivand/crosskit/commit/978b9246acf67a305859f1dd1d4beec0154a7e32) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Slider`, `InputNumber` and `Rate`, on a new numeric primitive in core.

  `@crosskit-ui/core` gains `clamp`, `decimals`, `snap`, `stepBy`, `ratio`,
  `fromRatio` and `numericKey` — the arithmetic all three share. Written once
  because floating-point step maths is not something to get right four times, and
  Phase 5 needs it framework-free anyway. `snap` rounds back to the precision its
  inputs are written with, so a 0.1 step reports `0.3` rather than
  `0.30000000000000004`.

  **`Slider`** takes `min`, `max`, `step`, `value`/`defaultValue`, `onChange`,
  `onChangeComplete`, `vertical`, `disabled`, `marks` and `tooltip`. Dragging uses
  pointer capture, so a drag that leaves the track keeps tracking — without it the
  thumb stops exactly when a user is reaching for the end. `onChangeComplete` is
  separate from `onChange` so a caller has somewhere to hang a network request
  that is not every frame of a drag.

  **`InputNumber`** takes `min`, `max`, `step`, `value`/`defaultValue`,
  `onChange`, `size`, `disabled`, `status`, `prefix`, `suffix`, `controls` and
  `precision`. It keeps the typed text apart from the value: `"1."` and `"-"` are
  states a number cannot represent, and clamping on each keystroke turns `5` into
  the max the moment someone starts typing `50`. The clamp happens on blur. An
  empty field is `null`, which is a different answer from `0`.

  Home and End are left to the caret — in a text field they belong to it, and
  stealing them makes a long number impossible to edit from the front.

  **`Rate`** takes `count`, `value`/`defaultValue`, `onChange`, `onHoverChange`,
  `allowHalf`, `allowClear`, `disabled`, `character` and `tooltips`. Clicking the
  current value clears it, which is the only route back to zero with a pointer.
  `tooltips` becomes `aria-valuetext`, so it reads "Fair" rather than "3".

  `Locale` gains an `InputNumber` entry for the two spinner labels.

  New in `@crosskit-ui/styles`: `numeric.css`, keyed on `data-scope` `slider`,
  `input-number` and `rate`.

- [#77](https://github.com/saeedkolivand/crosskit/pull/77) [`334be50`](https://github.com/saeedkolivand/crosskit/commit/334be500b51568ede5f562e72f6a2cb15e6267e4) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Popconfirm` and `Notification` to React.

  **`Popconfirm`** takes `title`, `description`, `onConfirm`, `onCancel`,
  `okText`, `cancelText`, `okType`, `okDanger`, `okLoading`, `showCancel`, `icon`,
  plus the anchoring props `placement`, `trigger`, `open`/`defaultOpen`/
  `onOpenChange` and `disabled`. It is a Popover with a question in it, so
  positioning, dismissal, the portal and the exit animation are the same code.

  Two deliberate differences from Popover. The default trigger is `click` alone,
  not hover-and-click: a confirm asks about something destructive and a pointer
  crossing the trigger is not the user asking it. And an `onConfirm` that returns
  a promise holds OK busy until it settles — a rejection leaves the question up,
  because dismissing it would tell the user the action succeeded.

  The question and its detail share one column beside the symbol rather than the
  detail being indented to a constant. There is no arithmetic to keep in step with
  the symbol's width, and nothing left stranded when `icon={false}` removes the
  symbol. Both sit in the popover's `title` part, so the dialog's accessible name
  is the whole question rather than half of it.

  **`Notification`** is a second surface over the same queue `Toaster` renders:
  `createToastQueue()` drives either. It emits `data-scope="notification"` so a
  page can hold both and style them apart, and it is closable by default — a
  message speaks and goes, a notification stays until it is read. `closable: false`
  on an item still removes the button.

  Both surfaces share every rule in `toast.css` through `:is()` rather than the
  notification getting a copy, so there is no second place for one of them to
  drift.

  Fixed alongside: alt+T now cycles through the non-empty toast regions on the
  page instead of each surface grabbing focus for itself, which left whichever
  mounted last holding it and the other unreachable — with the label on both still
  advertising the shortcut. And the toast grid rule that hands the symbol its row
  is now a child combinator, so something a consumer puts in a toast's own title or
  description that happens to call itself `icon` no longer takes a row in a grid it
  is not a child of.

- [#81](https://github.com/saeedkolivand/crosskit/pull/81) [`9067c09`](https://github.com/saeedkolivand/crosskit/commit/9067c09155c25091683ca5b03810bb5ffb2abe9d) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `RangePicker` to React, over the same date panel `DatePicker` uses.

  Two fields and two months side by side, so a range crossing a month boundary is
  picked without paging. The right panel is always the one after the left, which
  is what stops the two drifting apart or showing the same month twice.

  `value` is `[Date | null, Date | null]`. The first click is reported as a
  half-range rather than held back — `null` for the other end is what makes "one
  chosen, one not" expressible at all, and a controlled consumer needs to see the
  first click. A range picked backwards comes back sorted, because picking
  backwards is an ordinary gesture and ends arriving swapped would be nobody's
  idea of the answer.

  The span under the pointer previews before the second click, normalised the same
  way, since `compareDates` on an unsorted pair highlights nothing. `in-range` is
  strictly between the ends: the ends paint as selected, and a day claiming both
  would take whichever rule came last in the file.

  `disabledDate` gets the day **and** which end is being picked, plus the anchor —
  without that a minimum stay is not expressible.

  Reopening the panel always starts a fresh range. Resuming mid-pick would write
  an end for a start the user has forgotten choosing and commit a range they never
  saw, and the path that reaches it is ordinary: the first click moves focus to
  the end field, so that is the field they come back through.

  `DatePanel` regains a `range` prop and an `onDayHover`, which is where the
  `[data-in-range]` rule removed in the last batch belongs — it now has a caller
  that exercises it.

  `Locale.DatePicker` gains `start` and `end`, for the two field placeholders.

- [#65](https://github.com/saeedkolivand/crosskit/pull/65) [`ce1b99c`](https://github.com/saeedkolivand/crosskit/commit/ce1b99c0bac8c921088126232e965c58628537d8) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - React Modal and Drawer are rebuilt on the framework-free primitives in `core` —
  focus trap, dismissable layer stack, presence, scroll lock, inert background —
  and no longer pull a state-machine dependency. The DOM contract is unchanged, so
  no markup-keyed rule moved; `dialog.css` changes only in that the size rules now
  read `--ck-modal-width` as their fallback.

  New in `ModalProps`: `onOk` / `onCancel` / `okText` / `cancelText` / `okType` /
  `okDanger` / `confirmLoading` / `width`, and a default footer built from the
  active locale. `footer={null}` removes it. `Drawer` gains `onClose`.

  `Portal` is now exported.

  Two fixes in `core` that this turned up:

  - `createPresence` called `getAnimations` unguarded. Where it does not exist the
    call threw inside a `requestAnimationFrame` callback, where nothing catches
    it, and the node stayed mounted forever.
  - `DismissableOptions` gains `focus`, so a focus-trapped layer can opt out of
    dismissing on outside focus. Without it, closing a stacked layer restored
    focus to its trigger at the moment the layer below became topmost and
    dismissed that one too — two nested dialogs closing on one Escape.

  `Modal.width` is written as `--ck-modal-width`, which the size rules now read as
  their `max-width` fallback — previously an inline `inline-size` was clamped by
  the size rule and had no effect. An async `onOk` now holds the confirm button
  busy until it settles.

  `@zag-js/dialog` is dropped from `@crosskit-ui/react`'s dependencies — nothing
  imports it now that Modal and Drawer are rebuilt.

  `createFocusTrap` gains a layer stack, matching `pushDismissable` and
  `lockScroll`. Without it, nested overlays left two traps active: the outer one
  ran first, found its container empty because an inner overlay had marked it
  inert, and cancelled every Tab — so Tab from the middle of a nested dialog did
  nothing at all. `focusTrapDepth()` is exported for tests.

  The focus trap is now activated before the background is made inert, so the
  return-focus target is read while the trigger is unambiguously still focused
  rather than relying on the focus fixup rule being deferred.

  `inertBackground` moves into `core` with a shared registry, in which exactly
  one overlay — the topmost — is foreground. Each overlay used to
  sweep the background alone and treat every `document.body` child that did not
  contain _its_ content as background — including another overlay's layers. Two
  overlays opening in the same commit each inerted the other, leaving both visible
  and untouchable; and closing the lower of two released the page while the upper
  was still open. `inertDepth()` is exported for tests.

  A non-modal `Modal` no longer closes when focus leaves it. It has no focus trap,
  so focus starts on the trigger — outside the layer — and the first Tab onto
  anything after it dismissed the dialog, which is the opposite of what a non-modal
  dialog is for.

- [#72](https://github.com/saeedkolivand/crosskit/pull/72) [`3218fcc`](https://github.com/saeedkolivand/crosskit/commit/3218fcc3e75b1798401fb747e34b65ccbeece298) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Space`, `Flex`, `Skeleton`, `Empty` and `Result` to React.

  Five components with no behaviour between them — no timers, no focus, no
  listeners — so all five are pure markup over the existing tokens, and only
  `Empty` is a client component (it reads the locale from context).

  **`Flex`** is a flexbox wrapper: `vertical`, `justify`, `align`, `flex`, `gap`,
  `wrap`, and `component` to render as something other than a `div`. `justify`,
  `align` and `flex` take the whole CSS value space, so they land inline rather
  than as `data-*` — the documented boundary for props with no finite set of
  values. `gap` accepts `"small" | "middle" | "large"`, which resolve to the new
  `--ck-space-sm/md/lg` tokens, or any number (pixels) or CSS length.

  **`Space`** puts a gap between its children and, unlike a bare `gap`, can put
  something _between_ them:

  ```tsx
  <Space split={<Divider orientation="vertical" />}>
    <Button>Edit</Button>
    <Button>Delete</Button>
  </Space>
  ```

  Each child is wrapped in an `item` part. `size` takes one value or
  `[horizontal, vertical]`. A horizontal Space centres its items by default, since
  controls of unequal height otherwise sit on different lines.

  **`Skeleton`** draws a loading placeholder: `avatar`, `title`, `paragraph`
  (rows and per-row widths), `active` for the shimmer, `round`. Omitting `loading`
  shows the placeholder, so `<Skeleton />` on its own works and
  `<Skeleton loading={busy}>…</Skeleton>` is a switch. `Skeleton.Avatar`,
  `.Button`, `.Input`, `.Image` and `.Node` are standalone blocks. With
  `loading={false}` the children are returned bare — no wrapper, so no
  `className`, `id` or `ref` either; put those on something present in both
  states. The container
  carries `aria-busy` rather than a live region — there is no text to announce.

  **`Empty`** is the no-data state: `description` (from the locale unless given —
  `null` or `false` removes it), `image` as a node or a URL string, and children
  as a footer. `image` reads the same way: absent takes the default illustration,
  `null` or `false` removes it. Two built-in illustrations ship as `Empty.PRESENTED_IMAGE_DEFAULT`
  and `Empty.PRESENTED_IMAGE_SIMPLE`.

  **`Result`** is the after-the-fact state: `status` (`success`, `error`, `info`,
  `warning`, `404`, `403`, `500`), `title`, `subTitle`, `icon`, `extra`, and
  children. `icon` follows the same rule as `Empty`'s `image` — absent takes the
  built-in one, `null` or `false` removes it. The actions render last, after any
  children.

  `Locale` gains an `Empty` entry, so a custom locale object needs one more field.
  The shipped `enUS` has it already.

  New in `@crosskit-ui/core`: `hasContent(slot)`, the check every optional slot
  now goes through before emitting its wrapper part. `{condition && <Divider/>}`
  evaluates to `false`, not `undefined`, and `{items.map(…)}` on an empty list
  evaluates to `[]` — every framework renders both as nothing, so a `!= null`
  check passes them through and emits an empty wrapper, which still takes its gap
  as a flex item. Arrays recurse; a slot wrapped in a fragment is opaque to core
  and cannot be detected framework-free.

  New in `@crosskit-ui/styles`: `--ck-space-sm`, `--ck-space-md` and
  `--ck-space-lg` tokens, and `--ck-skeleton-fill` / `--ck-skeleton-sheen` for
  retinting every placeholder block at once.

- [#91](https://github.com/saeedkolivand/crosskit/pull/91) [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Splitter — resizable panes with a draggable bar between them.

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

- [#74](https://github.com/saeedkolivand/crosskit/pull/74) [`6ceda66`](https://github.com/saeedkolivand/crosskit/commit/6ceda66c78bc65d7043dd10d42232afbe358ca6c) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Statistic`, `Descriptions`, `Pagination` and `List` to React.

  **`Statistic`** takes `title`, `value`, `precision`, `prefix`, `suffix`,
  `formatter` and `loading`. Numbers go through `Intl.NumberFormat` with the
  locale from `ConfigProvider`, so grouping and the decimal mark follow the
  reader — 1,234.5 or 1.234,5 from the same call. That is why there is no
  `groupSeparator`/`decimalSeparator` pair: two props can only approximate one
  locale at a time. `formatter` is the way out. A string `value` is left alone,
  since reformatting it would mean parsing it back out first.

  **`Descriptions`** takes `items` (`label`, `children`, `span`), `title`,
  `extra`, `bordered`, `column`, `layout`, `size` and `colon`. It renders a real
  `<dl>` with `<dt>`/`<dd>` — the pairing a screen reader already understands —
  and the columns are CSS grid over the top, so `bordered` and `column` are
  presentation rather than a second DOM shape. `colon` applies only to horizontal
  unbordered layouts, where a trailing colon is the only place it reads as a
  label rather than a typo, and it is a pseudo-element so it is not read aloud.

  **`Pagination`** takes `total` (items, not pages), `current`/`defaultCurrent`,
  `pageSize`/`defaultPageSize`, `onChange`, `showSizeChanger`, `pageSizeOptions`,
  `showQuickJumper`, `showTotal`, `siblings`, `size`, `disabled` and
  `hideOnSinglePage`. The page window comes from `getPageWindow` in
  `@crosskit-ui/core` — the same function `Table` already uses, rather than a
  second copy of the ellipsis logic. The current page carries `aria-current`, and
  the ellipsis is `aria-hidden`: it is a gap in a sequence, not a control.

  The current page is clamped on read, not only on write, because `total` and
  `pageSize` are props — shrinking either can strand a page past the end with
  nothing to notice it.

  **`List`** takes `dataSource`, `renderItem`, `rowKey`, `header`, `footer`,
  `bordered`, `size`, `split`, `loading`, `itemLayout`, `pagination` and
  `emptyText`, plus `List.Item` and `List.Item.Meta`. It slices to the page
  itself rather than making every caller redo the index maths, and pages against
  the whole source. An empty list renders `Empty` unless `emptyText` is given —
  including `emptyText={null}`, which is how you ask for nothing at all.

  `Statistic` and `Pagination` read `ConfigProvider`; `Descriptions` is
  server-safe.

  New in `@crosskit-ui/styles`: `data.css`, keyed on `data-scope` `statistic`,
  `descriptions`, `pagination` and `list`.

- [#56](https://github.com/saeedkolivand/crosskit/pull/56) [`bd38d9a`](https://github.com/saeedkolivand/crosskit/commit/bd38d9a9c2f703a358464ef15e93abddf0b5405e) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Compile `styleOverrides` into static CSS.

  `createTheme({ components: { Button: { token, styleOverrides } } })` now accepts arbitrary CSS per
  part, written as `({ theme, ownerState }) => ({ … })`. The function is evaluated once per variant
  combination at theme-creation time and emitted as plain selectors, so the authoring API costs
  nothing at runtime.

- [#60](https://github.com/saeedkolivand/crosskit/pull/60) [`75a8295`](https://github.com/saeedkolivand/crosskit/commit/75a82957953c6f83e1581498194e2fdf9329e236) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free table store to `@crosskit-ui/core`.

  Multi-column sorting, per-column and global filtering, pagination, row selection keyed by row id,
  column visibility and expansion — framework-free, over plain data. Exported as
  `createTableStoreV2` alongside the existing store, which the adapters still use until they are
  rewritten.

- [#55](https://github.com/saeedkolivand/crosskit/pull/55) [`5d5405d`](https://github.com/saeedkolivand/crosskit/commit/5d5405d850705734cdb3ac476fe5d6a273217345) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `createTheme()` to `@crosskit-ui/core`.

  A theme configuration goes in and a plain CSS string comes out — colour ramps derived from one
  brand colour in OKLCH, plus radius and duration scales, wrapped in `@layer ck.overrides`. Nothing
  runs at render time: no style engine, no class hashing, no per-framework SSR collector.

  `themeScript()` returns an inline script that applies a stored theme preference before first
  paint. Nothing consumes either yet.

- [#82](https://github.com/saeedkolivand/crosskit/pull/82) [`0627c42`](https://github.com/saeedkolivand/crosskit/commit/0627c426ac198c58e64c405677d96101e752c0d6) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a time engine to `@crosskit-ui/core`, and `TimePicker` to React.

  **`core/date/time.ts`** is deliberately separate from `calendar.ts`. That module
  exists to keep `Date` honest about days across daylight saving; this one never
  touches a day. `CalendarTime` is `[hour, minute, second]` in 24-hour form
  always — the twelve-hour split is a _presentation_ of it, produced at the edge,
  which is what stops "is 12 AM midnight or noon" leaking into the arithmetic.

  `stepValues`, `to12Hour`/`from12Hour`, `compareTimes`, `clampTime`, `timeToDate`,
  `formatTime`, `parseTime`, `prefers12Hour` and `getDayPeriods`. Everything
  locale-shaped comes from `Intl`:

  - **Whether a locale is twelve-hour is asked, not guessed** — it varies inside
    one language, en-US against en-GB.
  - **The day-period words come from the locale**, so a Greek or Japanese user's
    own keyboard output parses. Matching on "am"/"pm" would put English into every
    field.
  - **Typed digits go through the same ASCII mapping the date parser uses**, since
    `\d` is `[0-9]` and finds nothing in the numbering systems fa-IR or ar-EG
    actually type in.

  `toAsciiDigits` is now exported from `date/format` so both parsers share it.

  **`TimePicker`** takes `value`/`defaultValue`/`onChange`, `format`, `use12Hours`,
  `hourStep`/`minuteStep`/`secondStep`, `showSecond`, `minTime`/`maxTime` and the
  usual field and anchoring props.

  A committed time is composed onto the day the current value sits on, so a picker
  driving one half of a date-and-time pair does not move the other half.

  Each column is a `role="listbox"` with **one tab stop**, not one per option —
  an hour-minute-second panel is 144 entries, and a keyboard user reaching the OK
  button would otherwise walk all of them. Arrows move the stop inside a column
  without committing, and clamp at the ends rather than wrapping: arriving at
  23:00 by pressing Up past midnight is nobody's intent.

  `minTime`/`maxTime` block the entries outside them _and_ clamp a typed value, so
  both ways in land on the same answer.

  New in `@crosskit-ui/styles`: the `time-picker` block in `date.css`. Columns are
  a bounded height with their own scroller — a 60-entry minute column is taller
  than most viewports, and a panel that grows to fit one is a panel nobody can
  reach the footer of.

- [#84](https://github.com/saeedkolivand/crosskit/pull/84) [`db89242`](https://github.com/saeedkolivand/crosskit/commit/db89242a76571fa082f06065a21ea5162bad0cda) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `TreeSelect` to React — the `Tree` from the last release inside an anchored
  control.

  Takes `treeData`, `value`/`defaultValue`/`onChange`, `multiple`, `treeCheckable`,
  `treeDefaultExpandAll`, `treeExpandedKeys`/`onTreeExpand`, `placeholder`,
  `maxTagCount`, `size`, `status`, `disabled`, `allowClear` and the usual
  anchoring props.

  The value takes the shape the mode implies: a key when single, an array when
  `multiple` or `treeCheckable`. `treeCheckable` is inherently many-valued — a
  parent tick is a statement about several nodes, and a single-valued checkable
  tree could not report it — so it implies `multiple` rather than conflicting with
  it. Checked values are the leaves, the same contract `Tree`'s own `onCheck`
  keeps.

  A single-valued select closes on the first pick; a multi-valued one stays open,
  because closing would make every extra choice a fresh round trip through the
  trigger.

  Its own `data-scope`, deliberately not `select`'s. Borrowing that one would mean
  every `[data-scope="select"]` rule applying to a control this file also styles,
  with source order deciding which wins — the container-leak shape dressed up as
  reuse.

  The trigger is a `combobox` with `aria-haspopup="tree"`, so a screen reader can
  say what shape of popup is about to open. Focus stays on it while the panel is
  up — ArrowDown hands the tree the keyboard, and closing gives focus back.

  New in `@crosskit-ui/styles`: the `tree-select` block in `tree.css`. The popup
  takes its width from the anchor's own, published by the positioner — a popup
  narrower than the control that opened it reads as a different control.

  Not in scope: `showSearch`. Filtering a tree while preserving ancestor chains
  belongs in core alongside `flattenTree`, and is additive when wanted.

- [#83](https://github.com/saeedkolivand/crosskit/pull/83) [`6c2537f`](https://github.com/saeedkolivand/crosskit/commit/6c2537fdb02b1bc7ec96bd917aecafb0448078c9) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add tree arithmetic to `@crosskit-ui/core`, and `Tree` to React.

  **`core/tree.ts`** answers the two questions a tree implementation gets wrong.

  _What is visible._ A tree is nested and a keyboard is not — every arrow key,
  every roving tab stop and every "next node" question is asked of a **flat** list.
  `flattenTree` omits a collapsed node's descendants entirely rather than marking
  them hidden, so "the next node" is the next entry and no caller reimplements the
  skip. `isLeaf` wins over the children a node happens to carry, which is what a
  lazy-loading caller needs before the load.

  _What a check means._ "Checked" in a tree is three states, and the third — a
  parent some of whose descendants are checked — is **derived on every read, never
  stored**. An incremental version has to be told about every structural change,
  and a tree that loaded a subtree lazily would keep a parent ticked over children
  it has never seen. Only leaves are stored; `checkedLeaves` is what a form wants
  back, since a parent key in the payload is a restatement the server then has to
  decide whether to trust.

  `toggleCheck` leaves a disabled node exactly as it found it, in both directions:
  a parent tick must not reach through something the user was told they cannot
  change. `checkable: false` excludes a node _and_ its subtree, so a heading inside
  a tree of options is not a thing to tick.

  **`Tree`** takes `treeData`, `expandedKeys`/`defaultExpandedKeys`/`onExpand`/
  `defaultExpandAll`, `selectedKeys`/`onSelect`/`multiple`, `checkable`/
  `checkedKeys`/`onCheck`, `titleRender`, `showLine` and `disabled`.

  It renders `role="tree"` over a **flat list of rows** with the indent as a
  custom property — nesting the rows would make the DOM disagree with the flat
  list the keyboard walks, and every `aria-level` would then need keeping in step
  with a depth the markup already implies.

  One tab stop for the whole tree, clamped to a row that is actually rendered: a
  consumer collapsing a branch while focus sits inside it would otherwise leave
  the tree with no stop at all, and Tab would walk straight past it. Arrows move
  between visible rows and clamp at the ends; Right opens then steps in, Left
  closes then steps **out** to the parent — without that second half, Left on a
  leaf does nothing and the only way back up a deep tree is Up, one sibling at a
  time.

  The row carries `aria-checked`, including `"mixed"`, and the checkbox inside it
  is hidden from assistive tech — otherwise the state is announced once per
  element.

  New in `@crosskit-ui/styles`: `tree.css`. The expander's chevron is rotated
  rather than swapped for a second icon, so the two states are one shape with
  something to animate between, and it mirrors with the document — a chevron
  pointing into a branch points the other way when the branch is on the other
  side.

- [#91](https://github.com/saeedkolivand/crosskit/pull/91) [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add the upload queue to `@crosskit-ui/core`, and `Upload` + `Upload.Dragger` to React.

  **`core/upload.ts`** is the file queue as pure transitions over a value, not a
  store. `fileList` / `defaultFileList` / `onChange` is a controlled-or-uncontrolled
  API in all four adapters, and a store owning the list would be a second source of
  truth fighting the controlled prop. So core owns the arithmetic and the adapter
  owns the state.

  Every transition returns the **identical array reference** when it changed
  nothing, and there is no upsert path anywhere in the module. Together those two
  facts are why a request that resolves after its file was removed cannot put the
  row back: `setProgress`, `settleFile` and `startUpload` all map over entries that
  already exist, so a late callback falls through to a no-op the adapter then does
  not report.

  `startUpload` is also retry — `error` is not terminal, which makes trying again
  the same transition as a first attempt rather than a second one carrying its own
  copy of the rules. `settleFile` pins a `done` file to 100% so the bar and the
  label cannot disagree, and leaves an `error` file at the percent it died at.
  `setProgress` acts only while `uploading`, so a tick arriving after the transport
  fired `load` cannot drag a finished file back to 97%.

  `acceptsFile` implements the `<input accept>` grammar — extensions, exact MIME,
  `type/*`, `*`, case-insensitive — and it is in core rather than in the adapters
  because **a drop bypasses the attribute entirely**: `accept` filters the OS
  dialog and nothing else. `addFiles` runs it on every path.

  `maxCount: 1` **replaces** the list; any other `maxCount` truncates the incoming
  batch to the room that is left. Implemented as a truncate, the `1` case leaves
  the old file in place and silently discards the new pick.

  A replacement is a **removal plus an addition**, and the adapter reports it as
  both: the displaced row's request is aborted, the object URL the component minted
  for it is revoked, and `onChange` fires for it with the settled list. Writing the
  next list straight to state looks right — the row does leave the screen — and
  leaves a request sending bytes for a file nobody can see.

  uids are minted from a monotonic counter, never derived from the file. A uid
  hashed from name and size makes a late resolve settle the wrong entry: remove
  `a.png` mid-flight, re-add `a.png`, and the first request marks the second row
  done.

  `xhrUpload` is the default transport, and it is `XMLHttpRequest` because no
  shipping browser streams a request body — `fetch` cannot report how much of an
  upload has gone out, so there is no way to show a percentage with it at all. No
  retry, no timeout, no dependency; it returns its own abort.

  **`Upload`** takes `fileList`/`defaultFileList`/`onChange`, `action` (a string or
  a function returning a promise, for signed URLs), `method`, `headers`, `data`,
  `name`, `withCredentials`, `customRequest`, `beforeUpload`, `multiple`, `accept`,
  `maxCount`, `disabled`, `listType`, `showUploadList`, `onRemove`, `onPreview` and
  `directory`. `Upload.Dragger` takes exactly the same props and differs only in
  what it renders.

  `name` is the multipart **field** name, which collides with what `name` means on
  every other control here. It is kept that way deliberately, for drop-in
  compatibility.

  With neither `action` nor `customRequest`, files are collected and never sent —
  the same terminal `selected` state `beforeUpload: false` produces. Inside a Form,
  bind it as
  `<Form.Item name="files" valuePropName="fileList" getValueFromEvent={info => info.fileList}>`:
  the default `getValueFromEvent` returns the first argument whole, and ours is the
  change info rather than a value.

  Three things in the adapter exist for failure modes that are invisible until they
  ship. The hidden `<input>` is **reset on every pick**, because the `change` event
  only fires when the value changes — without it, picking a file, removing it and
  picking the same file again does nothing at all. The dragger's highlight is held
  by a **depth counter**, because moving from the zone onto a child inside it fires
  `dragleave` on the zone and a boolean flag flickers off on every internal
  boundary. And `dragover` is cancelled, without which the browser navigates away
  to the dropped file and `drop` never fires — a consequence neither jsdom nor
  Playwright can reproduce, since both dispatch a synthetic `drop` regardless, so
  what is asserted is the `preventDefault()` call itself.

  `disabled` reaches the per-row controls as well as the trigger and the input: a
  disabled Upload that still removes rows and still fires a request from Retry is
  disabled in appearance only. `beforeUpload`'s second argument is the files that
  were **admitted** alongside this one — what `accept` and `maxCount` let through,
  not the raw batch the user picked.

  The live region alternates a zero-width space, because a screen reader announces
  a live region when its content mutates rather than when something writes to it.
  Retrying a file that fails the same way twice produces the identical string,
  React bails on the identical state, and the second failure is silent.

  Progress is an inline custom property, `--ck-upload-progress`, not a data
  attribute: CSS cannot do arithmetic on an attribute value, and `[data-progress]`
  matches when the value is `"0"`.

  New in `@crosskit-ui/styles`: `upload.css`. The fill is sized with
  `calc(var(--ck-upload-progress) * 1%)` on a flex track rather than translated,
  so it grows from the inline start in both directions. Every hover rule is
  guarded — `:not([data-state="error"])` on a row, `:not([data-drag-over])` on the
  dropzone, `:not([data-disabled])` on the per-row controls — because a hover that
  also names the part matches at (0,3,0) or better and would otherwise settle
  against the state rule on source order alone: a failed row repainted on the way
  to its own retry button, or a drop highlight that never appears.

  `Locale["Upload"]` gains a `done` string, which the hidden live region announces
  on a successful settle.

- [#91](https://github.com/saeedkolivand/crosskit/pull/91) [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add `Watermark` to React, over a new framework-free controller in
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

  The `visibility` value is `inherit`, not `visible`. `visibility` inherits, and
  any declaration on an element beats an inherited value, so `visible` would also
  escape an _ancestor's_ `visibility: hidden` and paint the mark across a region
  whose content is correctly hidden — a tab panel kept in the layout, a slide
  measured before it is shown. `inherit` keeps the `!important`, so a consumer
  rule aimed at the overlay still loses, while the overlay resolves to whatever
  the root resolved to.

  `Watermark` takes `content` (a string or one entry per line), `image`, `width`,
  `height`, `rotate`, `zIndex`, `gap`, `offset` and `font`. The cell defaults to
  the measured text, or 120x64 for an image, and the repeating tile is sized from
  the mark's _rotated_ bounding box plus the gap — a repeating background clips at
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
  nothing at all for the overlay. `position: relative` is also written inline
  whenever the root's computed position is still `static`, since `ck.components`
  is deliberately beatable and an overlay that resolved against the wrong ancestor
  still looks like a watermark. That check runs on every repair rather than only
  at attach, because the rule is keyed on the root's own
  `data-scope`/`data-part` — which belong to the framework and to the consumer,
  spread last on purpose, and are deliberately _not_ rewritten here. Stripping
  them is allowed; losing the positioning context is not, so the root is watched
  for attribute changes too and the inline value goes in when the stylesheet's
  stops applying. The consequence to know about: `position` on the root is the one
  property the component takes over — setting the root to `position: static` after
  attach no longer sticks, it is repaired back to `relative`. Every other inline
  property you set afterwards is left alone.

### Patch Changes

- [#50](https://github.com/saeedkolivand/crosskit/pull/50) [`3c85176`](https://github.com/saeedkolivand/crosskit/commit/3c8517672ef5c3e1de79db2cfd0e10d74338f573) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a README to every package — 1.0.0 shipped with none, so each npm page showed only "no README available". Also drops an unused `@zag-js/presence` dependency from `@crosskit-ui/angular`.

- [#63](https://github.com/saeedkolivand/crosskit/pull/63) [`109d5c6`](https://github.com/saeedkolivand/crosskit/commit/109d5c6b7964cfee768fd1375a9628606bb591a1) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - `applyPosition` now sets `position: fixed` itself rather than relying on a stylesheet rule that
  never existed. The coordinates it writes are viewport-relative, so anything else measures them
  from the wrong containing block — silently, since the element still renders.
- Updated dependencies [[`a267c58`](https://github.com/saeedkolivand/crosskit/commit/a267c5886bf55e77f5e3891d1282f6a0bb02e74a), [`e3dce7f`](https://github.com/saeedkolivand/crosskit/commit/e3dce7f4ebf010aa6b933d0f30eed6ce1cfa7565), [`9825949`](https://github.com/saeedkolivand/crosskit/commit/98259491e17583c66f4450a0ac73692bf05a1c88), [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61), [`667ac59`](https://github.com/saeedkolivand/crosskit/commit/667ac596584cfb4a627ecf24f60e04ef456a3b05), [`8d0d5d8`](https://github.com/saeedkolivand/crosskit/commit/8d0d5d8d90637bb8538ecea29adcb4dc3077870c), [`722ff04`](https://github.com/saeedkolivand/crosskit/commit/722ff04f80e3651b8af79245b6aa5492724dc8a2), [`5b33a33`](https://github.com/saeedkolivand/crosskit/commit/5b33a33d6a31d2cb866a47eef0164101002a4689), [`9efaa3f`](https://github.com/saeedkolivand/crosskit/commit/9efaa3fbe798ee7803cf211bdedf7beb11aa7104), [`7bf2fd2`](https://github.com/saeedkolivand/crosskit/commit/7bf2fd29834afab90ba9d767dc676a6d9b4f8805), [`b706129`](https://github.com/saeedkolivand/crosskit/commit/b7061296f17d5a7f09dd03b03d69f1484325026f), [`978b924`](https://github.com/saeedkolivand/crosskit/commit/978b9246acf67a305859f1dd1d4beec0154a7e32), [`3c85176`](https://github.com/saeedkolivand/crosskit/commit/3c8517672ef5c3e1de79db2cfd0e10d74338f573), [`334be50`](https://github.com/saeedkolivand/crosskit/commit/334be500b51568ede5f562e72f6a2cb15e6267e4), [`109d5c6`](https://github.com/saeedkolivand/crosskit/commit/109d5c6b7964cfee768fd1375a9628606bb591a1), [`9067c09`](https://github.com/saeedkolivand/crosskit/commit/9067c09155c25091683ca5b03810bb5ffb2abe9d), [`00cb4b5`](https://github.com/saeedkolivand/crosskit/commit/00cb4b52687f09ac4a45dc9a13886f354677d55f), [`ce1b99c`](https://github.com/saeedkolivand/crosskit/commit/ce1b99c0bac8c921088126232e965c58628537d8), [`d61d1a0`](https://github.com/saeedkolivand/crosskit/commit/d61d1a07a538c15189ff0d6fd63736e91d347015), [`b096aae`](https://github.com/saeedkolivand/crosskit/commit/b096aaece88c47c40260c806b593c80ea4272383), [`3218fcc`](https://github.com/saeedkolivand/crosskit/commit/3218fcc3e75b1798401fb747e34b65ccbeece298), [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61), [`6ceda66`](https://github.com/saeedkolivand/crosskit/commit/6ceda66c78bc65d7043dd10d42232afbe358ca6c), [`42ab980`](https://github.com/saeedkolivand/crosskit/commit/42ab98073bd56434b7826f09e404f68a5b80a9b1), [`bd38d9a`](https://github.com/saeedkolivand/crosskit/commit/bd38d9a9c2f703a358464ef15e93abddf0b5405e), [`75a8295`](https://github.com/saeedkolivand/crosskit/commit/75a82957953c6f83e1581498194e2fdf9329e236), [`a29798d`](https://github.com/saeedkolivand/crosskit/commit/a29798ddb9468157391af5da615292f715b5df13), [`5d5405d`](https://github.com/saeedkolivand/crosskit/commit/5d5405d850705734cdb3ac476fe5d6a273217345), [`45b4733`](https://github.com/saeedkolivand/crosskit/commit/45b4733e7c1767131f5fb6f5ba31f9f9e0331a1b), [`0627c42`](https://github.com/saeedkolivand/crosskit/commit/0627c426ac198c58e64c405677d96101e752c0d6), [`bd9f7a3`](https://github.com/saeedkolivand/crosskit/commit/bd9f7a32d156e738912e69c0e29582b75da6f052), [`db89242`](https://github.com/saeedkolivand/crosskit/commit/db89242a76571fa082f06065a21ea5162bad0cda), [`6c2537f`](https://github.com/saeedkolivand/crosskit/commit/6c2537fdb02b1bc7ec96bd917aecafb0448078c9), [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61), [`ee2dc18`](https://github.com/saeedkolivand/crosskit/commit/ee2dc18ff339812031fca674aff1276184906f61)]:
  - @crosskit-ui/core@2.0.0
  - @crosskit-ui/styles@2.0.0

## 1.0.0

### Major Changes

- [#42](https://github.com/saeedkolivand/crosskit/pull/42) [`0fa9b31`](https://github.com/saeedkolivand/crosskit/commit/0fa9b3174d4cf5cfcc72ee616ef1cd994f1666ca) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - CrossKit 1.0.0 — the first release under this name.

  `@saeedkolivand/react-ui-toolkit` was a React-only component library that composed Tailwind utility classes at runtime. CrossKit is the same 27 components with the same API in **React, Vue, Svelte and Angular**: behaviour from Zag.js state machines shared across all four, styling from one precompiled stylesheet keyed to `data-scope` / `data-part` / `data-state`.

  Consumers need no Tailwind of their own — it is an authoring tool here, not a runtime dependency. `tailwind-merge`, `classnames` and `framer-motion` are gone with nothing replacing them.

  This is a clean break, not a rename. See `docs/migrating-from-react-ui-toolkit.md`, which lists every API change and the seven v0 bugs whose workarounds can now be deleted.

### Minor Changes

- [#28](https://github.com/saeedkolivand/crosskit/pull/28) [`fd141dd`](https://github.com/saeedkolivand/crosskit/commit/fd141dd215a6696ed55a3ee3df9b83ea7af5b176) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Select and Option across all four adapters, driven by `@zag-js/select`. Fixes the Vue dialog close button, which carried the wrong data attribute and no click handler.

- [#31](https://github.com/saeedkolivand/crosskit/pull/31) [`1b9981d`](https://github.com/saeedkolivand/crosskit/commit/1b9981db8ca5c1bc04cba63e18d22687b1470492) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Table across all four adapters, plus `createTableStore`, `toColumnDefs`, `fromLegacyColumns` and `getPageWindow` in core. `@tanstack/table-core` is bound once in core rather than through the four official framework adapters.

- [#27](https://github.com/saeedkolivand/crosskit/pull/27) [`c419f38`](https://github.com/saeedkolivand/crosskit/commit/c419f389d97d57efc0b2a6612b9a3927ad9d516d) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Tabs and Accordion (Wave 5) across all four adapters, driven by `@zag-js/tabs` and `@zag-js/accordion`.

- [#30](https://github.com/saeedkolivand/crosskit/pull/30) [`d7fd5ba`](https://github.com/saeedkolivand/crosskit/commit/d7fd5ba4793a1f5b8d2453b93f11d9459732e29f) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Toast across all four adapters: `createToaster()` in core plus a `<Toaster>` per framework, driven by `@zag-js/toast`. Replaces v0's `NotificationProvider` + `useNotification()`.

- [#29](https://github.com/saeedkolivand/crosskit/pull/29) [`f66d3b7`](https://github.com/saeedkolivand/crosskit/commit/f66d3b7036d1b66b6dd9f197c167604e47827bbb) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add Tooltip and Menu across all four adapters, driven by `@zag-js/tooltip` and `@zag-js/menu`, plus `resolvePlacement` in core for v0's Ant placement names.

### Patch Changes

- [#36](https://github.com/saeedkolivand/crosskit/pull/36) [`93f13d2`](https://github.com/saeedkolivand/crosskit/commit/93f13d22c4a38add30d5028806e37954fbca87aa) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Fix Angular ignoring every `default*` machine prop: `bindable` now seeds its initial value on first use rather than at construction, so `defaultValue` reaches zag after Angular has applied inputs. Removes `RadioGroup.name`, which silently did nothing in every adapter.

- [#33](https://github.com/saeedkolivand/crosskit/pull/33) [`6a8c183`](https://github.com/saeedkolivand/crosskit/commit/6a8c18308c47c93ab69fbe9f2a49082ff494c9a6) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Move `aria-invalid` off individual radios and onto the radio group, where ARIA actually supports it. `RadioGroup` gains an `invalid` prop; `data-invalid` on the radio is unchanged.

- Updated dependencies [[`e01f4fa`](https://github.com/saeedkolivand/crosskit/commit/e01f4fa10f42702cdbb2f00b6744d57c11825c85), [`0fa9b31`](https://github.com/saeedkolivand/crosskit/commit/0fa9b3174d4cf5cfcc72ee616ef1cd994f1666ca), [`fd141dd`](https://github.com/saeedkolivand/crosskit/commit/fd141dd215a6696ed55a3ee3df9b83ea7af5b176), [`1b9981d`](https://github.com/saeedkolivand/crosskit/commit/1b9981db8ca5c1bc04cba63e18d22687b1470492), [`c419f38`](https://github.com/saeedkolivand/crosskit/commit/c419f389d97d57efc0b2a6612b9a3927ad9d516d), [`d7fd5ba`](https://github.com/saeedkolivand/crosskit/commit/d7fd5ba4793a1f5b8d2453b93f11d9459732e29f), [`f66d3b7`](https://github.com/saeedkolivand/crosskit/commit/f66d3b7036d1b66b6dd9f197c167604e47827bbb)]:
  - @crosskit-ui/styles@1.0.0
  - @crosskit-ui/core@1.0.0
