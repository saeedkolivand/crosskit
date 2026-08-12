# @crosskit-ui/vue

## 2.0.0

### Minor Changes

- [#57](https://github.com/saeedkolivand/crosskit/pull/57) [`e3dce7f`](https://github.com/saeedkolivand/crosskit/commit/e3dce7f4ebf010aa6b933d0f30eed6ce1cfa7565) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add the dependency-free behaviour primitives to `@crosskit-ui/core`.

  Focus trapping with wrap and restore, a shared dismissable layer stack so nested overlays close in
  the right order, presence tracking that keeps a node mounted through its exit animation,
  reference-counted scroll locking, and a pure collection plus keyboard navigation with typeahead.

  Nothing consumes them yet.

- [#62](https://github.com/saeedkolivand/crosskit/pull/62) [`667ac59`](https://github.com/saeedkolivand/crosskit/commit/667ac596584cfb4a627ecf24f60e04ef456a3b05) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free date engine to `@crosskit-ui/core`.

  Calendar arithmetic on `[year, month, day]` rather than timestamps, so daylight saving cannot skew
  it; month grids padded to whole weeks with a configurable week start; and month names, weekday
  names, formatting and locale-aware parsing entirely from `Intl` — no locale packs.

  This completes Phase 3. Nothing consumes any of it yet.

- [#61](https://github.com/saeedkolivand/crosskit/pull/61) [`722ff04`](https://github.com/saeedkolivand/crosskit/commit/722ff04f80e3651b8af79245b6aa5492724dc8a2) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Add a dependency-free form engine to `@crosskit-ui/core`.

  Nested field paths, declarative validation rules with templated messages, per-field and per-form
  validate triggers, cross-field dependencies, async validators, list fields with error re-indexing,
  and submission state.

  The CSS compiler's `Rule` type is renamed `CssRule`, since the validation rule has the stronger
  claim on the bare name.

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

- [#64](https://github.com/saeedkolivand/crosskit/pull/64) [`00cb4b5`](https://github.com/saeedkolivand/crosskit/commit/00cb4b52687f09ac4a45dc9a13886f354677d55f) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Begin the React v2 API. `Button` now takes `type`, `size` (small/middle/large), `shape`, `danger`,
  `ghost`, `block`, a `ReactNode` icon, and `htmlType` for the native attribute; an `href` renders an
  anchor. `ConfigProvider` carries a compiled theme, locale and direction.

  This is a breaking change to `@crosskit-ui/react`. The other adapters are unchanged until they
  follow.

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

- [#35](https://github.com/saeedkolivand/crosskit/pull/35) [`a84f12d`](https://github.com/saeedkolivand/crosskit/commit/a84f12d91460f805daea7ba426769e7b39bd45c1) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Fix three divergences the cross-framework parity matrix found: Vue's Input and Textarea sent every native attribute to the wrapper instead of the control; Angular's Tabs, Accordion and Menu crashed with NG0950 by reading a required input during construction; Angular's Input and Textarea had no way to set placeholder, type, name, required or readonly.

- Updated dependencies [[`e01f4fa`](https://github.com/saeedkolivand/crosskit/commit/e01f4fa10f42702cdbb2f00b6744d57c11825c85), [`0fa9b31`](https://github.com/saeedkolivand/crosskit/commit/0fa9b3174d4cf5cfcc72ee616ef1cd994f1666ca), [`fd141dd`](https://github.com/saeedkolivand/crosskit/commit/fd141dd215a6696ed55a3ee3df9b83ea7af5b176), [`1b9981d`](https://github.com/saeedkolivand/crosskit/commit/1b9981db8ca5c1bc04cba63e18d22687b1470492), [`c419f38`](https://github.com/saeedkolivand/crosskit/commit/c419f389d97d57efc0b2a6612b9a3927ad9d516d), [`d7fd5ba`](https://github.com/saeedkolivand/crosskit/commit/d7fd5ba4793a1f5b8d2453b93f11d9459732e29f), [`f66d3b7`](https://github.com/saeedkolivand/crosskit/commit/f66d3b7036d1b66b6dd9f197c167604e47827bbb)]:
  - @crosskit-ui/styles@1.0.0
  - @crosskit-ui/core@1.0.0
