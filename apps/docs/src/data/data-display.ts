import type { ComponentDoc } from "./types";

export const dataDisplay: ComponentDoc[] = [
  {
    slug: "avatar",
    name: "Avatar",
    group: "Data display",
    scope: "avatar",
    summary:
      "An image with an initials fallback. The load state is a `data-state` attribute, so the initials no longer flash before a cached image paints.",
    props: [
      { name: "src", type: "string", description: "Image URL." },
      { name: "alt", type: "string", description: "Alternative text." },
      {
        name: "size",
        type: '"sm" | "md" | "lg" | "xl"',
        default: '"md"',
        description: "Avatar size.",
      },
      {
        name: "initials",
        type: "string",
        description: "Fallback text. Derived from `alt` when omitted.",
      },
      {
        name: "status",
        type: '"online" | "offline" | "busy" | "away"',
        description: "Presence dot.",
      },
      { name: "squared", type: "boolean", default: "false", description: "Rounded square." },
      { name: "bordered", type: "boolean", default: "false", description: "Ring around it." },
      { name: "fallback", type: "ReactNode", description: "Custom fallback content." },
    ],
    samples: {
      react: `<Avatar src="/ada.jpg" alt="Ada Lovelace" size="lg" status="online" />`,
      vue: `<Avatar src="/ada.jpg" alt="Ada Lovelace" size="lg" status="online" />`,
      svelte: `<Avatar src="/ada.jpg" alt="Ada Lovelace" size="lg" status="online" />`,
      angular: `<ck-avatar src="/ada.jpg" alt="Ada Lovelace" size="lg" status="online" />`,
    },
  },
  {
    slug: "progress",
    name: "Progress",
    group: "Data display",
    scope: "progress",
    summary:
      "A determinate or indeterminate bar. Indeterminate is `value={null}` rather than a separate flag, which matches the ARIA model.",
    props: [
      { name: "value", type: "number | null", description: "null means indeterminate." },
      { name: "max", type: "number", default: "100", description: "Upper bound." },
      {
        name: "variant",
        type: '"primary" | "success" | "error" | "warning" | "info"',
        default: '"primary"',
        description: "Bar colour.",
      },
      { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Bar thickness." },
      { name: "label", type: "ReactNode", description: "Label above the bar." },
      {
        name: "showValue",
        type: "boolean",
        default: "false",
        description: "Print the percentage.",
      },
      { name: "striped", type: "boolean", default: "false", description: "Striped fill." },
      { name: "animated", type: "boolean", default: "false", description: "Animate the stripes." },
    ],
    changes: [{ from: "indeterminate", to: "value={null}" }],
    samples: {
      react: `<Progress value={62} label="Uploading" showValue />`,
      vue: `<Progress :value="62" label="Uploading" show-value />`,
      svelte: `<Progress value={62} label="Uploading" showValue />`,
      angular: `<ck-progress [value]="62" label="Uploading" showValue />`,
    },
  },
  {
    slug: "table",
    name: "Table",
    group: "Data display",
    scope: "table",
    machine: "@tanstack/table-core",
    gains: [
      "Keyboard-operable sorting — v0's <th> had a bare click handler with no tabindex, role or Enter handler",
      "aria-sort on the header cell",
      "Windowed page buttons — v0 rendered one per page, 50 of them for 500 rows",
      "A page-size changer that works; v0's dropdown was always empty",
      "Sorting that does not mutate the array you passed",
    ],
    summary:
      "Columns are plain serialisable data — no render functions — so a column definition is identical in all four frameworks. Custom cell content is a per-framework slot keyed by column id, which is the one place a shared API genuinely cannot work: a `cell` returning React JSX cannot render in Vue.",
    props: [
      { name: "data", type: "T[]", description: "Rows. v0 called this dataSource." },
      { name: "columns", type: "TableColumn<T>[]", description: "id, header, accessor, sortable." },
      {
        name: "getRowId",
        type: "(row, i) => string",
        description: "v0 took a `rowKey` field name.",
      },
      {
        name: "density",
        type: '"small" | "middle" | "large"',
        default: '"middle"',
        description: "Row padding. v0 called this `size`.",
      },
      {
        name: "bordered / striped / hoverable / stickyHeader",
        type: "boolean",
        description: "Styling flags.",
      },
      {
        name: "loading",
        type: "boolean",
        default: "false",
        description: "Overlays a spinner without dropping rows.",
      },
      {
        name: "sorting / onSortingChange",
        type: "SortingState",
        description: "Controlled sorting.",
      },
      {
        name: "pagination",
        type: "boolean",
        default: "true",
        description: "Pass false to render every row.",
      },
      { name: "pageSize", type: "number", default: "10", description: "Rows per page." },
      {
        name: "manualPagination / rowCount",
        type: "boolean / number",
        description: "Server-side paging.",
      },
      {
        name: "showSizeChanger",
        type: "boolean",
        default: "false",
        description: "Rows-per-page Select.",
      },
    ],
    changes: [
      { from: "dataSource", to: "data" },
      { from: "columns[].title / .dataIndex / .key", to: ".header / .accessor / .id" },
      { from: "columns[].render", to: "a per-framework cell slot" },
      { from: "columns[].sorter", to: "sortable + optional sortFn" },
      { from: "rowKey: keyof T", to: "getRowId: (row, i) => string" },
      { from: "size", to: "density" },
      { from: "scroll.x / scroll.y", to: "--ck-table-min-width / --ck-table-max-height" },
      {
        from: "pagination: { current, pageSize, total, onChange }",
        to: "pagination: boolean + pageSize / paginationState / onPaginationChange",
      },
    ],
    samples: {
      react: `<Table
  data={people}
  columns={[
    { id: "name", header: "Name", accessor: "name", sortable: true },
    { id: "age", header: "Age", accessor: "age", align: "end" },
  ]}
  renderCell={{ name: row => <strong>{row.name}</strong> }}
  showSizeChanger
/>`,
      vue: `<Table :data="people" :columns="columns" show-size-changer>
  <template #cell:name="{ row }"><strong>{{ row.name }}</strong></template>
</Table>`,
      svelte: `<Table data={people} {columns} showSizeChanger cells={{ name: nameCell }} />

{#snippet nameCell(row)}<strong>{row.name}</strong>{/snippet}`,
      angular: `<ck-table [data]="people" [columns]="columns" showSizeChanger>
  <ng-template ckTableCell="name" let-row>
    <strong>{{ row.name }}</strong>
  </ng-template>
</ck-table>`,
    },
  },
  {
    slug: "watermark",
    name: "Watermark",
    group: "Data display",
    scope: "watermark",
    isNew: true,
    summary:
      "A repeating mark drawn over its children, on a canvas raster tiled across the region. The overlay is created and repaired by `@crosskit-ui/core` rather than rendered by the framework, so deleting it in the inspector, hiding it from a stylesheet or stripping its attributes all bring it straight back. That resists accidental and casual removal — it is explicitly not a security boundary, since the mark lives in the page it is protecting. New in v2, React first.",
    props: [
      {
        name: "content",
        reactFirst: true,
        type: "string | string[]",
        description: "Text mark; one entry per line.",
      },
      {
        name: "image",
        reactFirst: true,
        type: "string",
        description:
          "URL or data URI. Wins over `content`, which stays the fallback if it fails to load. Drawn into the cell, so it does not keep its aspect ratio.",
      },
      {
        name: "width",
        reactFirst: true,
        type: "number",
        description: "One mark's cell in px. Measured when omitted for text; 120 for an image.",
      },
      {
        name: "height",
        reactFirst: true,
        type: "number",
        description: "Lines x line-height when omitted for text; 64 for an image.",
      },
      {
        name: "rotate",
        reactFirst: true,
        type: "number",
        default: "-22",
        description: "Degrees, clockwise.",
      },
      {
        name: "zIndex",
        reactFirst: true,
        type: "number",
        default: "9",
        description:
          "Stacking order inside the region. A child with a higher `z-index` paints above the mark.",
      },
      {
        name: "gap",
        reactFirst: true,
        type: "[number, number]",
        default: "[100, 100]",
        description: "`[x, y]` px between marks.",
      },
      {
        name: "offset",
        reactFirst: true,
        type: "[number, number]",
        default: "half the gap",
        description:
          "`[x, y]` px shift of the whole pattern. Physical, so it does not mirror in RTL.",
      },
      {
        name: "font",
        reactFirst: true,
        type: "{ color, fontSize, fontWeight, fontFamily, fontStyle }",
        description:
          '`fontWeight: "light"` is mapped to 300 rather than passed through — one invalid token makes canvas drop the entire font and draw 10px sans-serif without a word.',
      },
    ],
    parts: [
      { part: "root", description: "The wrapper. Positioned, so the overlay resolves against it." },
      {
        part: "overlay",
        description:
          "The mark itself, `aria-hidden` and `pointer-events: none`. Written imperatively — style it through the props, not with CSS, because anything a stylesheet changes here is restored.",
      },
    ],
    samples: {
      react: `<Watermark content={["CrossKit", "confidential"]}>
  <article>…</article>
</Watermark>`,
      vue: `<Watermark :content="['CrossKit', 'confidential']">
  <article>…</article>
</Watermark>`,
      svelte: `<Watermark content={["CrossKit", "confidential"]}>
  <article>…</article>
</Watermark>`,
      angular: `<ck-watermark [content]="['CrossKit', 'confidential']">
  <article>…</article>
</ck-watermark>`,
    },
  },
];
