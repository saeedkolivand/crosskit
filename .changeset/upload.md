---
"@crosskit-ui/core": minor
"@crosskit-ui/react": minor
"@crosskit-ui/styles": minor
---

Add the upload queue to `@crosskit-ui/core`, and `Upload` + `Upload.Dragger` to React.

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
