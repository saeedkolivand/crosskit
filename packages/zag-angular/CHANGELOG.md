# @crosskit-ui/zag-angular

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

## 1.0.0

### Major Changes

- [#42](https://github.com/saeedkolivand/crosskit/pull/42) [`0fa9b31`](https://github.com/saeedkolivand/crosskit/commit/0fa9b3174d4cf5cfcc72ee616ef1cd994f1666ca) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - CrossKit 1.0.0 — the first release under this name.

  `@saeedkolivand/react-ui-toolkit` was a React-only component library that composed Tailwind utility classes at runtime. CrossKit is the same 27 components with the same API in **React, Vue, Svelte and Angular**: behaviour from Zag.js state machines shared across all four, styling from one precompiled stylesheet keyed to `data-scope` / `data-part` / `data-state`.

  Consumers need no Tailwind of their own — it is an authoring tool here, not a runtime dependency. `tailwind-merge`, `classnames` and `framer-motion` are gone with nothing replacing them.

  This is a clean break, not a rename. See `docs/migrating-from-react-ui-toolkit.md`, which lists every API change and the seven v0 bugs whose workarounds can now be deleted.

### Patch Changes

- [#32](https://github.com/saeedkolivand/crosskit/pull/32) [`488486b`](https://github.com/saeedkolivand/crosskit/commit/488486b9f985a2ee653b7e41397d806d42c0c41a) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Fix intermittent loss of machine entry effects under controlled props: `track` now defers its callback out of change detection, so `bindable`'s flush is no longer a recursive `ApplicationRef.tick()` that silently does nothing. Presence also reports `present` from the raw input on entry, removing a two-tick mount delay.

- [#36](https://github.com/saeedkolivand/crosskit/pull/36) [`93f13d2`](https://github.com/saeedkolivand/crosskit/commit/93f13d22c4a38add30d5028806e37954fbca87aa) Thanks [@saeedkolivand](https://github.com/saeedkolivand)! - Fix Angular ignoring every `default*` machine prop: `bindable` now seeds its initial value on first use rather than at construction, so `defaultValue` reaches zag after Angular has applied inputs. Removes `RadioGroup.name`, which silently did nothing in every adapter.
