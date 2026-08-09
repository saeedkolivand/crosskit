import type { ComponentDoc } from "./types";

const FIELD_PROPS = [
  {
    name: "variant",
    type: '"default" | "filled" | "outline"',
    default: '"default"',
    description: "Field style. v0 had Input take `outline` and Textarea `outlined`.",
  },
  { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Control size." },
  { name: "label", type: "ReactNode", description: "Label, associated by id." },
  { name: "helperText", type: "ReactNode", description: "Hint below the field." },
  {
    name: "invalid",
    type: "boolean",
    default: "false",
    description: "Marks the field invalid. v0 called this `error`.",
  },
  {
    name: "errorMessage",
    type: "ReactNode",
    description: "Replaces helperText and wins aria-describedby.",
  },
  { name: "fullWidth", type: "boolean", default: "true", description: "Stretch to 100%." },
];

export const forms: ComponentDoc[] = [
  {
    slug: "input",
    name: "Input",
    group: "Forms",
    scope: "input",
    summary: "A text field with label, helper text, error state and optional prefix/suffix slots.",
    props: [
      ...FIELD_PROPS,
      { name: "prefix", type: "ReactNode", description: "Content before the input." },
      { name: "suffix", type: "ReactNode", description: "Content after the input." },
    ],
    changes: [{ from: "error", to: "invalid" }],
    samples: {
      react: `import { Input } from "@crosskit-ui/react";

<Input label="Email" type="email" helperText="We never share it." />`,
      vue: `<Input label="Email" type="email" helper-text="We never share it." />`,
      svelte: `<Input label="Email" type="email" helperText="We never share it." />`,
      angular: `<input ckInput label="Email" type="email" helperText="We never share it." />`,
    },
  },
  {
    slug: "textarea",
    name: "Textarea",
    group: "Forms",
    scope: "textarea",
    summary:
      "A multi-line field. Auto-resize is CSS (`field-sizing: content`, with a replica fallback) rather than a keystroke handler — so it also grows on paste, on a programmatic set, and for an initial value, none of which v0 handled.",
    props: [
      ...FIELD_PROPS,
      {
        name: "autoResize",
        type: "boolean",
        default: "false",
        description: "Grow with the content.",
      },
    ],
    changes: [
      { from: "error", to: "invalid" },
      { from: 'variant="outlined"', to: 'variant="outline"', note: "Now matches Input." },
    ],
    samples: {
      react: `<Textarea label="Notes" autoResize rows={3} />`,
      vue: `<Textarea label="Notes" auto-resize :rows="3" />`,
      svelte: `<Textarea label="Notes" autoResize rows={3} />`,
      angular: `<textarea ckTextarea label="Notes" autoResize [rows]="3"></textarea>`,
    },
  },
  {
    slug: "checkbox",
    name: "Checkbox",
    group: "Forms",
    scope: "checkbox",
    summary:
      "A native checkbox with a styled control. `indeterminate` is a DOM property with no HTML attribute, which is why it needs an effect rather than a prop on the element.",
    props: [
      { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Control size." },
      { name: "label", type: "ReactNode", description: "Label text." },
      { name: "invalid", type: "boolean", default: "false", description: "Invalid state." },
      { name: "indeterminate", type: "boolean", default: "false", description: "Mixed state." },
    ],
    samples: {
      react: `<Checkbox label="Accept terms" onChange={e => set(e.target.checked)} />`,
      vue: `<Checkbox v-model="accepted" label="Accept terms" />`,
      svelte: `<Checkbox bind:checked={accepted} label="Accept terms" />`,
      angular: `<ck-checkbox label="Accept terms" [(checked)]="accepted" />`,
    },
  },
  {
    slug: "radio",
    name: "Radio & RadioGroup",
    group: "Forms",
    scope: "radio",
    summary:
      "Native radios sharing a `name` already handle selection and arrow keys. RadioGroup adds the group semantics screen readers need, which v0 never provided.",
    props: [
      { name: "value", type: "string", description: "This radio's value." },
      { name: "label", type: "ReactNode", description: "Label text." },
      { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Control size." },
      {
        name: "RadioGroup.invalid",
        type: "boolean",
        default: "false",
        description:
          'Marks the group invalid. aria-invalid is not supported on role="radio", so it lives here, not on the individual radio.',
      },
      {
        name: "RadioGroup.orientation",
        type: '"horizontal" | "vertical"',
        default: '"horizontal"',
        description: "Layout axis.",
      },
    ],
    samples: {
      react: `<RadioGroup name="size" label="Size">
  <Radio value="s" label="Small" />
  <Radio value="m" label="Medium" />
</RadioGroup>`,
      vue: `<RadioGroup name="size" label="Size">
  <Radio value="s" label="Small" />
  <Radio value="m" label="Medium" />
</RadioGroup>`,
      svelte: `<RadioGroup name="size" label="Size">
  <Radio value="s" label="Small" bind:group={size} />
  <Radio value="m" label="Medium" bind:group={size} />
</RadioGroup>`,
      angular: `<ck-radio-group label="Size">
  <ck-radio name="size" value="s" label="Small" [(selected)]="size" />
  <ck-radio name="size" value="m" label="Medium" [(selected)]="size" />
</ck-radio-group>`,
    },
  },
  {
    slug: "switch",
    name: "Switch",
    group: "Forms",
    scope: "switch",
    summary:
      'A single `<input role="switch">`. v0 fired two different event shapes — a synthesised `{target:{checked}}` from a wrapper div\'s onClick, and the real onChange from the inner input — and which one you got depended on where you clicked.',
    props: [
      { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Control size." },
      { name: "label", type: "ReactNode", description: "Label text." },
    ],
    changes: [
      {
        from: "two competing change events",
        to: "one native change event",
        note: "Handlers that ran twice, or not at all, now run exactly once.",
      },
    ],
    samples: {
      react: `<Switch label="Notifications" onChange={e => set(e.target.checked)} />`,
      vue: `<Switch v-model="on" label="Notifications" />`,
      svelte: `<Switch bind:checked={on} label="Notifications" />`,
      angular: `<ck-switch label="Notifications" [(checked)]="on" />`,
    },
  },
  {
    slug: "select",
    name: "Select",
    group: "Forms",
    scope: "select",
    gains: [
      "Arrow-key navigation and Home/End",
      "Typeahead",
      "A managed highlight that keyboard and mouse cannot disagree about",
      "A real hidden <select>, so plain form submission works",
    ],
    summary:
      'The trigger is a real `<button role="combobox">`. v0 used `<input readOnly role="combobox">`, which is the ARIA pattern for a typeahead combobox and wrong for a plain select.',
    props: [
      {
        name: "options",
        reactFirst: true,
        type: "SelectOption[]",
        description: "The options, as data. Replaces `items`.",
      },
      {
        name: "onChange",
        reactFirst: true,
        type: "(value: string, option: SelectOption) => void",
        description:
          "The value AND the option it came from — the second is what a consumer usually wants and would otherwise have to look up again.",
      },
      {
        name: "size",
        reactFirst: true,
        type: '"small" | "middle" | "large"',
        default: '"middle"',
        description: "Emits `data-size` in that vocabulary, so v2 carries its own rules.",
      },
      {
        name: "status",
        reactFirst: true,
        type: '"error" | "warning"',
        description:
          "Colours the control, and `error` also marks the trigger `aria-invalid`. `warning` is presentation only — there is no ARIA state for it. Use `errorMessage` for something that should be read out.",
      },
      {
        name: "placement",
        reactFirst: true,
        type: "Placement | PlacementAlias",
        default: '"bottomLeft"',
        description: "Where the listbox opens, from the same twelve names the overlays take.",
      },
      { name: "items", reactRemoved: true, type: "SelectItem[]", description: "Options as data." },
      { name: "value", type: "string", description: "Controlled value. Single-select in v1." },
      { name: "defaultValue", type: "string", description: "Uncontrolled initial value." },
      {
        name: "onValueChange",
        reactRemoved: true,
        type: "(d: { value, item }) => void",
        description: "Replaces v0's synthesised change event.",
      },
      {
        name: "placeholder",
        type: "string",
        default: '"Select an option"',
        description: "Shown while empty.",
      },
      { name: "name", type: "string", description: "Submitted through the hidden <select>." },
      // `variant` is dropped outright — the select never used it distinctly.
      // `size` and `invalid` are still real for the three v1 adapters and gone
      // from React, so they are marked rather than removed: an unmarked row
      // claims the prop in all four, and the table was showing two `size` rows
      // with contradicting vocabularies. `check:props` cannot catch this — it
      // flattens every React source into one Set, and Input declares both.
      ...FIELD_PROPS.filter(p => p.name !== "variant").map(p =>
        p.name === "size" || p.name === "invalid" ? { ...p, reactRemoved: true } : p
      ),
    ],
    changes: [
      { from: "options", to: "items" },
      { from: "onChange(e) with e.target.value", to: "onValueChange({ value, item })" },
      { from: "error", to: "invalid" },
      {
        from: "<Option> children ignored",
        to: "<Option> children build the collection",
        note: "v0 destructured them into `_children` and never rendered them, which is why Table's page-size dropdown was always empty.",
      },
      {
        from: "<Option> children",
        to: "options",
        note: "React only. One way to declare the options rather than two, and the one that survives being generated.",
      },
      { from: "items", to: "options (React)" },
      { from: "onValueChange({ value, item })", to: "onChange(value, option) (React)" },
    ],
    samples: {
      react: `<Select
  label="Country"
  options={[{ value: "ng", label: "Nigeria" }]}
  onChange={(value, option) => setCountry(option.label)}
/>`,
      vue: `<Select label="Country" :items="items" @update:value="v => (country = v)" />

<!-- or declaratively -->
<Select label="Country">
  <Option value="ng">Nigeria</Option>
</Select>`,
      svelte: `<Select label="Country" {items} bind:value={country} />

<!-- Svelte snippets cannot be read as text, so Option takes a label prop -->
<Select label="Country">
  <Option value="ng" label="Nigeria" />
</Select>`,
      angular: `<ck-select label="Country" [items]="items" [(value)]="country" />

<!-- or declaratively -->
<ck-select label="Country">
  <ck-option value="ng" label="Nigeria" />
</ck-select>`,
    },
  },
  {
    slug: "upload",
    name: "Upload",
    group: "Forms",
    scope: "upload",
    isNew: true,
    summary:
      "A file queue with a trigger, a list, per-file progress and retry — plus `Upload.Dragger`, the drop-target form. The queue arithmetic is framework-free and lives in `@crosskit-ui/core`, so the `accept` filter applies to a drop as well as to the file dialog; the attribute alone only filters the OS dialog.",
    gains: [
      "Upload.Dragger, with a drag counter that does not flicker over child elements",
      "Progress as an inline custom property, so the bar grows from the inline start in RTL too",
      "Retry on a failed file, which is the same transition as a first attempt",
      "A request that resolves after its file was removed cannot put the row back",
      "customRequest, for a transport that is not a plain multipart POST",
    ],
    props: [
      {
        name: "fileList, defaultFileList",
        type: "UploadFile[]",
        description: "The queue, controlled or not. Entries carry uid, name, status and percent.",
      },
      {
        name: "onChange",
        type: "(info: { file: UploadFile; fileList: UploadFile[] }) => void",
        description:
          "Fires on add, on every progress tick, on settle and on remove. A controlled Upload needs it to move at all.",
      },
      {
        name: "action",
        type: "string | ((file: File) => string | Promise<string>)",
        description:
          "Where to POST. A function is awaited after the row is already showing as uploading, which is what signed-URL flows need.",
      },
      { name: "method", type: '"POST" | "PUT"', default: '"POST"', description: "Request method." },
      { name: "headers", type: "Record<string, string>", description: "Extra request headers." },
      {
        name: "data",
        type: "Record<string, string> | ((file: File) => Record<string, string>)",
        description: "Extra multipart fields sent alongside the file.",
      },
      {
        name: "name",
        type: "string",
        default: '"file"',
        description:
          "The multipart FIELD name — not the form field name `name` means on Input, Select and DatePicker. Kept for drop-in compatibility; it is a genuine collision.",
      },
      {
        name: "withCredentials",
        type: "boolean",
        default: "false",
        description: "Send cookies cross-origin.",
      },
      {
        name: "customRequest",
        type: "(args: UploadRequestArgs) => { abort: () => void } | void",
        description:
          "Replaces the built-in transport entirely. Wins over `action`. Return an abort and remove/unmount will call it.",
      },
      {
        name: "beforeUpload",
        type: "(file: File, files: File[]) => boolean | Promise<boolean>",
        description:
          "`false` — or a rejected promise — lists the file at status `selected` and never uploads it. The second argument is the files that were ADMITTED, not the raw batch: what `accept` and `maxCount` let through.",
      },
      { name: "multiple", type: "boolean", default: "false", description: "Allow a multi-pick." },
      {
        name: "accept",
        type: "string",
        description:
          "The `<input accept>` grammar. Re-checked on drop as well, which the attribute cannot do.",
      },
      {
        name: "maxCount",
        type: "number",
        description:
          "`1` REPLACES the list and drops `multiple` from the dialog; any other value truncates the incoming batch to the room left. The replaced row is aborted, revoked and reported through `onChange` — a replacement is a removal plus an addition.",
      },
      {
        name: "disabled",
        type: "boolean",
        default: "false",
        description: "Refuse picks and drops, and disable each row's own Retry and Remove.",
      },
      {
        name: "listType",
        type: '"text" | "picture"',
        default: '"text"',
        description: "`picture` shows a thumbnail, minted and revoked by the component.",
      },
      {
        name: "showUploadList",
        type: "boolean",
        default: "true",
        description:
          "Render the list at all. Nothing is emitted when it is off or the list is empty.",
      },
      {
        name: "onRemove",
        type: "(file: UploadFile) => boolean | Promise<boolean>",
        description: "`false` vetoes the removal. Removing aborts an in-flight request first.",
      },
      {
        name: "onPreview",
        type: "(file: UploadFile) => void",
        description: "Makes the file name a button rather than a link.",
      },
      {
        name: "directory",
        type: "boolean",
        default: "false",
        description:
          "Pick a whole folder. Implies `multiple`, and names rows by their folder path.",
      },
    ],
    parts: [
      { part: "root", description: "The wrapper. Carries data-list-type and data-disabled." },
      {
        part: "trigger",
        description: "Wraps your children on the plain Upload. Inert — the child is the control.",
      },
      {
        part: "dropzone",
        description: "Upload.Dragger's target. role=button, with Enter and Space.",
      },
      { part: "input", description: "The hidden file input. Visually hidden, never display:none." },
      { part: "list", description: "The <ul>. Absent when there is nothing in it." },
      { part: "item", description: "One row. data-state is selected | uploading | done | error." },
      {
        part: "item-name",
        description: "A button with onPreview, a link with a url, plain text otherwise.",
      },
      {
        part: "item-progress",
        description: "role=progressbar; the fill reads --ck-upload-progress.",
      },
      { part: "item-actions", description: "Retry and remove, at the inline end." },
      { part: "status", description: "A visually hidden live region, written only on settle." },
    ],
    samples: {
      react: `import { Upload, Button } from "@crosskit-ui/react";

<Upload action="/api/upload" multiple accept="image/*" maxCount={5}>
  <Button>Select files</Button>
</Upload>

<Upload.Dragger action="/api/upload" listType="picture">
  <p>Drop files here</p>
</Upload.Dragger>

{/* Inside a Form. Form.Item's default getValueFromEvent returns the first
    argument whole, and ours is the change info rather than a value — so the
    binding has to say which half of it is the value. */}
<Form.Item name="files" valuePropName="fileList" getValueFromEvent={info => info.fileList}>
  <Upload action="/api/upload">
    <Button>Select files</Button>
  </Upload>
</Form.Item>`,
      vue: `<Upload action="/api/upload" multiple accept="image/*" :max-count="5">
  <Button>Select files</Button>
</Upload>`,
      svelte: `<Upload action="/api/upload" multiple accept="image/*" maxCount={5}>
  <Button>Select files</Button>
</Upload>`,
      angular: `<ck-upload action="/api/upload" multiple accept="image/*" [maxCount]="5">
  <button ckButton>Select files</button>
</ck-upload>`,
    },
  },
];
