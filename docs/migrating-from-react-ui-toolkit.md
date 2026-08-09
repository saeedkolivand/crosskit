# Migrating from `@saeedkolivand/react-ui-toolkit`

<!-- GENERATED FILE — edit apps/docs/src/data/*.ts and run `pnpm --filter @crosskit-ui/docs gen:migration`. -->

CrossKit is a clean break, not a rename with a compatibility shim. The
component set is the same 27 you had; what changed is that behaviour is now
written once and shared across four frameworks, and styling comes from one
precompiled stylesheet keyed to data attributes.

## The four things that affect every file

1. **Scope rename.** `@saeedkolivand/react-ui-toolkit` becomes `@crosskit-ui/react`
   (or `/vue`, `/svelte`, `/angular`).
2. **One stylesheet.** `import "@crosskit-ui/styles"` replaces importing
   `dist/styles.css`. `withStyles`, `withStylesSSR`, `StylesProvider` and
   `StylesProviderSSR` are deleted, not renamed — styling is that one import.
3. **Dark mode.** The `dark` class becomes `[data-theme="dark"]` on `<html>`.
   `Notification.module.css` already had nine `[data-theme]` rules that nothing
   ever set, so its dark mode had never worked; this revives that dead path.
4. **No class names in markup.** Components emit `data-scope` / `data-part` /
   `data-state`. Your own `class` still lands on the root, untouched, and
   because everything shipped sits in a CSS cascade layer your unlayered rules
   win regardless of specificity.

## Bugs this fixes

These were real defects in v0, not stylistic changes. If you worked around any
of them, remove the workaround:

- **Select ignored `<Option>` children.** They were destructured into `_children`
  and never rendered, which is why `Table`'s `showSizeChanger` produced an empty
  dropdown.
- **Switch fired two different event shapes**, and which one you got depended on
  where you clicked.
- **Four components threw under SSR** — Modal, Select, Drawer and Dropdown all
  called `createPortal` during render.
- **Two ARIA references pointed at nothing**: Modal's `aria-labelledby` and
  Tabs' `aria-labelledby={`tab-${index}`}`.
- **`Col.offset` and every `*Offset` prop did nothing.** They emitted
  `ml-${n}/12`, which is not valid Tailwind. They work now.
- **Table's sortable header was not keyboard-operable** — a bare click handler,
  no tabindex, no role, no Enter handler.
- **Table rendered one button per page** — fifty of them for 500 rows.

## Component-by-component

### Primitives

#### Button

| v0 | v1 | Notes |
| --- | --- | --- |
| `no default type` | `type="button"` | A Button inside a form used to submit it. Pass type="submit" if you want the old behaviour. |

### Layout

#### Row

| v0 | v1 | Notes |
| --- | --- | --- |
| `gap-${spacing} class` | `--ck-row-spacing custom property` | The old dynamic class name only ever worked inside this repo's own Tailwind build. |

#### Col

| v0 | v1 | Notes |
| --- | --- | --- |
| `offset / smOffset / mdOffset / lgOffset` | `offset, and { offset } inside each breakpoint object` | These are newly functional — they never did anything in v0. |

### Forms

#### Input

| v0 | v1 | Notes |
| --- | --- | --- |
| `error` | `invalid` |  |

#### Textarea

| v0 | v1 | Notes |
| --- | --- | --- |
| `error` | `invalid` |  |
| `variant="outlined"` | `variant="outline"` | Now matches Input. |

#### Switch

| v0 | v1 | Notes |
| --- | --- | --- |
| `two competing change events` | `one native change event` | Handlers that ran twice, or not at all, now run exactly once. |

#### Select

| v0 | v1 | Notes |
| --- | --- | --- |
| `options` | `items` |  |
| `onChange(e) with e.target.value` | `onValueChange({ value, item })` |  |
| `error` | `invalid` |  |
| `<Option> children ignored` | `<Option> children build the collection` | v0 destructured them into `_children` and never rendered them, which is why Table's page-size dropdown was always empty. |
| `<Option> children` | `options` | React only. One way to declare the options rather than two, and the one that survives being generated. |
| `items` | `options (React)` |  |
| `onValueChange({ value, item })` | `onChange(value, option) (React)` |  |

### Overlays

#### Modal

| v0 | v1 | Notes |
| --- | --- | --- |
| `isOpen` | `open` |  |
| `onClose: () => void` | `onOpenChange: (d) => void` |  |
| `closeOnEsc` | `closeOnEscape` |  |
| `closeOnBackdropClick` | `closeOnInteractOutside` |  |
| `aria-labelledby="modal-title"` | `a generated id that resolves` | v0's pointed at an element that did not exist. |

#### Tooltip

| v0 | v1 | Notes |
| --- | --- | --- |
| `visible` | `open` |  |
| `showDelay / hideDelay` | `openDelay / closeDelay` |  |
| `overlayClassName` | `contentClassName` |  |
| `contentClassName` | `overlayClassName` | React only, and back to the name v0 had: the prop names the popup, and `content` is what goes in it. |
| `content` | `title` | React only. Frees `content` for Popover, where a title and a body are different things. |
| `cloneElement onto your trigger` | `a wrapper element with display: inline-flex` | The trigger handlers are pointerenter/pointerleave and focus/blur — none of which bubble — so a box-less wrapper would have worked in React and silently failed everywhere else. |

#### Menu / Dropdown

| v0 | v1 | Notes |
| --- | --- | --- |
| `Dropdown + Menu + MenuItem` | `one Menu with items` |  |
| `Menu with a generated trigger` | `Dropdown wrapping your own trigger` | React only. The generated button solved nested buttons by removing the choice; taking the element back and never wrapping it solves the same thing without it. |
| `MenuItem.value` | `item.key (React Dropdown)` |  |
| `{ separator: true }` | `{ type: 'divider' } (React Dropdown)` |  |
| `onSelect(d => d.value)` | `menu.onClick(i => i.key) (React Dropdown)` |  |
| `MenuItem.key` | `MenuItem.value` |  |
| `overlay` | `items` |  |
| `children as the trigger element` | `trigger as content` | <Dropdown><Button/></Dropdown> produced invalid nested buttons. |

#### Toast

| v0 | v1 | Notes |
| --- | --- | --- |
| `<NotificationProvider>` | `<Toaster :toaster> at the root` |  |
| `const { notify } = useNotification()` | `import { toaster } — no hook` |  |
| `notify({ type, message, description })` | `toaster.success({ title, description })` |  |

### Disclosure

#### Tabs

| v0 | v1 | Notes |
| --- | --- | --- |
| `defaultActiveTab: number` | `value / defaultValue (a tab id)` |  |
| `onTabChange(index)` | `onValueChange({ value })` |  |
| `TabItem.id?` | `TabItem.id — required` |  |

#### Accordion / Collapse

| v0 | v1 | Notes |
| --- | --- | --- |
| `multiple` | `allowMultiple` |  |

### Data display

#### Progress

| v0 | v1 | Notes |
| --- | --- | --- |
| `indeterminate` | `value={null}` |  |

#### Table

| v0 | v1 | Notes |
| --- | --- | --- |
| `dataSource` | `data` |  |
| `columns[].title / .dataIndex / .key` | `.header / .accessor / .id` |  |
| `columns[].render` | `a per-framework cell slot` |  |
| `columns[].sorter` | `sortable + optional sortFn` |  |
| `rowKey: keyof T` | `getRowId: (row, i) => string` |  |
| `size` | `density` |  |
| `scroll.x / scroll.y` | `--ck-table-min-width / --ck-table-max-height` |  |
| `pagination: { current, pageSize, total, onChange }` | `pagination: boolean + pageSize / paginationState / onPaginationChange` |  |

## Unchanged APIs

These components kept their v0 prop names, so only the import path changes:

`Icon`, `Spinner`, `Divider`, `Badge`, `Tag`, `Card`, `Alert`, `Container`, `Checkbox`, `Radio & RadioGroup`, `Drawer`, `Avatar`.

## New, with no v0 equivalent

Nothing to migrate — these did not exist before:

`Upload`, `Popover`, `Watermark`.

## Deleted, not renamed

| Removed | Replacement |
| --- | --- |
| `withStyles`, `withStylesSSR` | `import "@crosskit-ui/styles"` |
| `StylesProvider`, `StylesProviderSSR` | same |
| `useIsHydrated` | nothing — the theme controller's server snapshot covers it |
| `NotificationProvider`, `useNotification` | `createToaster()` + `<Toaster>` |
| `utils/position.ts` | the shared behaviour core |
