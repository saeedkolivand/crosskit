"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  addFiles,
  ariaAttr,
  dataAttr,
  removeFile,
  resolveVeto,
  setProgress,
  settleFile,
  startUpload,
  xhrUpload,
  type UploadFile,
} from "@crosskit-ui/core";
import { useConfig } from "../config/config-provider";
import { Icon } from "../icon/icon";

export type { UploadFile };

export type UploadListType = "text" | "picture";

export interface UploadChangeInfo {
  /** The single entry that just changed. */
  file: UploadFile;
  /** The whole next list. */
  fileList: UploadFile[];
}

export interface UploadRequestArgs {
  file: File;
  action: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  data: Record<string, string>;
  /** The multipart field name. */
  filename: string;
  withCredentials: boolean;
  /** An object rather than a bare number, which is the shape this API mirrors. */
  onProgress: (event: { percent: number }) => void;
  onSuccess: (response: unknown) => void;
  onError: (error: unknown) => void;
}

export interface UploadProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "children" | "onDrop"
> {
  fileList?: UploadFile[];
  defaultFileList?: UploadFile[];
  /** Fires on add, on every progress tick, on settle and on remove. */
  onChange?: (info: UploadChangeInfo) => void;

  /** A URL, or something that produces one — a function is awaited, for signed-URL flows. */
  action?: string | ((file: File) => string | Promise<string>);
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  data?: Record<string, string> | ((file: File) => Record<string, string>);
  /**
   * The multipart FIELD name — NOT the form field name `name` means on Input,
   * Select and DatePicker. It is spelled this way because the API this mirrors
   * spells it this way, and renaming it would break a drop-in migration.
   */
  name?: string;
  withCredentials?: boolean;
  /** Full control of the request. Return `{ abort() }` and remove/unmount will call it. */
  customRequest?: (args: UploadRequestArgs) => { abort: () => void } | void;

  /**
   * `false` — or a promise resolving to `false`, or a rejected one — admits the
   * file at `selected` and never uploads it.
   *
   * The second argument is the files that were ADMITTED alongside this one —
   * what `accept` and `maxCount` let through, not the raw batch the user picked.
   * A hook that vetoes on "more than three at once" is therefore counting what
   * is actually in the list.
   */
  beforeUpload?: (file: File, files: File[]) => boolean | Promise<boolean>;

  multiple?: boolean;
  accept?: string;
  maxCount?: number;
  disabled?: boolean;
  listType?: UploadListType;
  showUploadList?: boolean;
  /** `false`, or a promise resolving to `false`, vetoes the removal. */
  onRemove?: (file: UploadFile) => boolean | Promise<boolean>;
  onPreview?: (file: UploadFile) => void;
  /** Pick a whole folder. Implies `multiple`. */
  directory?: boolean;
  /** The trigger. Must itself be an interactive control — see the trigger part below. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Set by `Upload` and `Upload.Dragger`; never part of the public prop surface. */
interface InternalProps extends UploadProps {
  dragger?: boolean;
}

/** A zero-width space. See `announce`. Neither rendered nor spoken. */
const NUDGE = "\u200B";

function UploadBase({
  fileList: controlled,
  defaultFileList,
  onChange,
  action,
  method = "POST",
  headers,
  data,
  name = "file",
  withCredentials = false,
  customRequest,
  beforeUpload,
  multiple = false,
  accept,
  maxCount,
  disabled = false,
  listType = "text",
  showUploadList = true,
  onRemove,
  onPreview,
  directory = false,
  dragger = false,
  children,
  className,
  ref,
  ...rest
}: InternalProps) {
  const { locale } = useConfig();
  const [uncontrolled, setUncontrolled] = useState<UploadFile[]>(defaultFileList ?? []);
  const list = controlled ?? uncontrolled;

  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * The list as of the last write, readable from a request callback.
   *
   * Two concurrent uploads whose callbacks each closed over their own render's
   * `fileList` would derive their next list from the same snapshot, and the
   * second write would erase the first. Every transition is applied against
   * this instead, which `apply` writes synchronously and the effect below
   * re-syncs from the resolved list after each render. A controlled consumer
   * that drops `onChange` therefore gets a frozen list — the ordinary
   * controlled-component bargain.
   */
  const listRef = useRef(list);
  const changeRef = useRef(onChange);
  useEffect(() => {
    listRef.current = list;
    changeRef.current = onChange;
  });

  /** uid → abort, for the requests still in flight. */
  const abortsRef = useRef(new Map<string, () => void>());
  /** Only the object URLs WE minted, so a caller's own `thumbUrl` is never revoked. */
  const ownedUrlsRef = useRef(new Set<string>());

  /** Written only on settle. A tick-by-tick live region is unusable with a screen reader. */
  const [announcement, setAnnouncement] = useState("");

  /**
   * Writes the live region, and guarantees the text actually CHANGED.
   *
   * A screen reader announces a live region when its content mutates, not when
   * something writes to it. Retrying a file that fails the same way twice
   * produces the identical string, React bails on the identical state, no DOM
   * mutation reaches the region and the second failure is silent. The
   * alternating zero-width space is a real text change that is neither rendered
   * nor spoken.
   */
  const announce = (message: string) =>
    setAnnouncement(current => (current.endsWith(NUDGE) ? message : `${message}${NUDGE}`));

  useEffect(
    () => () => {
      const aborts = abortsRef.current;
      const owned = ownedUrlsRef.current;
      for (const abort of aborts.values()) abort();
      aborts.clear();
      // Object URLs live for the life of the document unless revoked, so a page
      // that mounts and unmounts a picture Upload a few times leaks every file
      // it was ever shown.
      for (const url of owned) URL.revokeObjectURL(url);
      owned.clear();
    },
    []
  );

  /**
   * Runs one transition and reports it.
   *
   * Reference equality is the signal: core returns the array it was handed when
   * it changed nothing, so a late callback for a removed file lands here and
   * stops, without a state write and without an `onChange`.
   */
  const apply = (uid: string, transition: (current: readonly UploadFile[]) => UploadFile[]) => {
    const current = listRef.current;
    const next = transition(current);
    if (next === current) return;
    listRef.current = next;
    if (controlled === undefined) setUncontrolled(next);
    const changed = next.find(f => f.uid === uid) ?? current.find(f => f.uid === uid);
    if (changed) changeRef.current?.({ file: changed, fileList: next });
  };

  const request = async (uid: string) => {
    const target = listRef.current.find(f => f.uid === uid);
    const file = target?.file;
    // No transport at all is the "collect now, submit with the form" mode: the
    // entry stays at `selected` forever, which is the same terminal state
    // `beforeUpload: false` produces. Checked BEFORE `startUpload`, or the row
    // would sit at `uploading` with nothing on its way to move it.
    if (!file || (!customRequest && action === undefined)) return;

    apply(uid, current => startUpload(current, uid));

    const onProgress = (percent: number) =>
      apply(uid, current => setProgress(current, uid, percent));
    /**
     * Whether this request is already over, readable BEFORE the transport has
     * returned its handle. A `customRequest` that calls `onSuccess`
     * synchronously runs `finish` — and its `delete` — while the caller below
     * has nothing to delete yet, so storing the handle afterwards would leave a
     * completed request in the map and `remove` would call the consumer's
     * `abort()` on it.
     */
    let settled = false;
    const finish = (outcome: Parameters<typeof settleFile>[2], announced: string) => {
      settled = true;
      abortsRef.current.delete(uid);
      const entry = listRef.current.find(f => f.uid === uid);
      apply(uid, current => settleFile(current, uid, outcome));
      if (entry) announce(`${entry.name} ${announced}`);
    };
    const onSuccess = (response: unknown) =>
      finish({ status: "done", response }, locale.Upload.done);
    const onError = (error: unknown) => finish({ status: "error", error }, locale.Upload.error);

    let url: string;
    try {
      // Awaited AFTER `startUpload`, so a signed-URL round trip shows as
      // `uploading` rather than leaving the row inert while it is fetched.
      url = typeof action === "function" ? await action(file) : (action ?? "");
    } catch (error) {
      onError(error);
      return;
    }
    // The user can have removed the row while that promise was outstanding, and
    // uploading a file they have already dismissed is the worst version of this
    // bug — core would refuse to record the result, but the bytes would still go.
    if (!listRef.current.some(f => f.uid === uid)) return;

    const body = typeof data === "function" ? data(file) : (data ?? {});
    if (customRequest) {
      const handle = customRequest({
        file,
        action: url,
        method,
        headers: headers ?? {},
        data: body,
        filename: name,
        withCredentials,
        onProgress: event => onProgress(event.percent),
        onSuccess,
        onError,
      });
      if (handle && !settled) abortsRef.current.set(uid, handle.abort);
      return;
    }

    abortsRef.current.set(
      uid,
      xhrUpload({
        file,
        action: url,
        method,
        headers,
        data: body,
        name,
        withCredentials,
        onProgress,
        onSuccess,
        onError,
      })
    );
  };

  /**
   * Everything a row owns, released. No state write: the two callers already
   * have their own next list.
   *
   * Aborting first is what stops a request from keeping a `File` alive and from
   * sending bytes for a row that is on its way out. The revoke is guarded on the
   * URL being one of OURS — an entry that arrived with its own `url`/`thumbUrl`
   * from a server-side list is not something we created and not ours to revoke.
   */
  const discard = (entry: UploadFile) => {
    abortsRef.current.get(entry.uid)?.();
    abortsRef.current.delete(entry.uid);
    if (entry.thumbUrl && ownedUrlsRef.current.delete(entry.thumbUrl)) {
      URL.revokeObjectURL(entry.thumbUrl);
    }
  };

  const admit = (picked: File[]) => {
    if (disabled || picked.length === 0) return;

    const result = addFiles(listRef.current, picked, { accept, maxCount });
    if (result.added.length === 0) return;

    // One owner for the object URL, minted here at admission rather than during
    // a render — a render-time `createObjectURL` runs twice under StrictMode
    // and leaks the first one with no handle left to revoke it.
    const thumbs = new Map<string, string>();
    if (listType === "picture") {
      for (const entry of result.added) {
        if (!entry.file) continue;
        const url = URL.createObjectURL(entry.file);
        ownedUrlsRef.current.add(url);
        thumbs.set(entry.uid, url);
      }
    }
    const withThumbs = (entry: UploadFile): UploadFile =>
      thumbs.has(entry.uid) ? { ...entry, thumbUrl: thumbs.get(entry.uid) } : entry;

    const next = result.list.map(withThumbs);
    const added = result.added.map(withThumbs);

    // `maxCount: 1` REPLACES the list, so a pick can evict a row that is still
    // uploading. Writing `result.list` straight to state drops that row on the
    // floor: its request goes on running against a file nobody can see any more,
    // the object URL we minted for it is never revoked, and the consumer is
    // never told it went. A replacement is a removal plus an addition, and both
    // halves have to be reported.
    const kept = new Set(next.map(entry => entry.uid));
    const displaced = listRef.current.filter(entry => !kept.has(entry.uid));

    listRef.current = next;
    if (controlled === undefined) setUncontrolled(next);
    for (const entry of displaced) discard(entry);
    // One report per changed file, all carrying the same settled list: `file`
    // is singular, and a batch of five that reported once would leave four of
    // them unnamed.
    for (const entry of [...displaced, ...added]) {
      changeRef.current?.({ file: entry, fileList: next });
    }

    const files = added.map(entry => entry.file).filter((file): file is File => file !== undefined);
    for (const entry of added) {
      if (!entry.file) continue;
      const file = entry.file;
      void resolveVeto(beforeUpload?.(file, files)).then(ok => {
        // A veto leaves the row at `selected`, which is exactly why that state
        // exists — the file is in the list and visible, it just never goes out.
        //
        // No "is it still listed" check here: `request` looks the uid up and
        // returns when it finds nothing, so a second one in front of it is a
        // guard no mutation could distinguish from its own absence.
        if (!ok) return;
        void request(entry.uid);
      });
    }
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const picked = Array.from(input.files ?? []);
    // All three steps synchronous and in this order. `currentTarget` is null
    // after any await; reading `files` after the reset gets an empty list; and
    // WITHOUT the reset the `change` event never fires again for the same file,
    // so picking a.png, removing it and picking a.png does nothing at all.
    input.value = "";
    admit(picked);
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const remove = (entry: UploadFile) => {
    void resolveVeto(onRemove?.(entry)).then(ok => {
      if (!ok) return;
      discard(entry);
      apply(entry.uid, current => removeFile(current, entry.uid));
    });
  };

  /**
   * How many drag sources are currently over the zone or something inside it.
   *
   * A boolean flickers: moving from the zone onto a child fires `dragenter` on
   * the child and `dragleave` on the parent, both of which bubble here, so the
   * highlight clears while the pointer is still inside. Counted, and RESET —
   * not decremented — on drop, because no matching `dragleave` follows one.
   * State rather than a ref, because the attribute has to re-render.
   */
  const [dragDepth, setDragDepth] = useState(0);

  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragDepth(depth => depth + 1);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      // The one line without which the browser navigates away to the dropped
      // file and `drop` never fires at all.
      //
      // Nothing can test the EFFECT of this. jsdom dispatches a synthetic
      // `drop` whether or not anything was prevented, and so does Playwright's
      // `dispatchEvent` — both hand the event straight to the listeners and
      // skip the drag machinery that would have cancelled it. Neither can start
      // an OS file drag. So what guards it is an assertion on
      // `event.defaultPrevented`, which is a claim about this call and not
      // about what the browser then does with it.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragDepth(depth => Math.max(0, depth - 1));
    },
    onDragEnd: () => setDragDepth(0),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragDepth(0);
      // No `disabled` check here on purpose. `admit` refuses while disabled and
      // that is the ONE enforcement point — a second one in front of it is
      // redundant code that no test can tell apart from its own absence, so a
      // mutation removing either guard would pass. One guard, one assertion.
      admit(Array.from(event.dataTransfer?.files ?? []));
    },
  };

  const onDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    // Space scrolls the page otherwise, and a div has none of a button's
    // built-in activation behaviour to fall back on.
    event.preventDefault();
    openPicker();
  };

  return (
    <div
      ref={ref}
      data-scope="upload"
      data-part="root"
      data-list-type={listType}
      data-disabled={dataAttr(disabled)}
      className={className}
      {...rest}
    >
      <input
        ref={inputRef}
        type="file"
        data-scope="upload"
        data-part="input"
        accept={accept}
        // A dialog inviting a multi-select whose surplus is then silently
        // discarded is worse than one that never offered it.
        multiple={(multiple || directory) && maxCount !== 1}
        disabled={disabled}
        // Plumbing, not a control: reachable, it is a second differently-named
        // tab stop for the same action. Visually hidden rather than
        // `display: none`, which would take away the only guaranteed way to
        // open the file dialog.
        tabIndex={-1}
        aria-hidden="true"
        // Spread, because TypeScript has no type for this one and there is no
        // JSX attribute to declare. (React itself is forgiving about the
        // casing — `setAttribute` lowercases in an HTML document either way —
        // but writing it as it appears in the DOM is what makes the attribute
        // greppable from the markup it produces.)
        {...{ webkitdirectory: directory ? "" : undefined }}
        onChange={pick}
      />

      {dragger ? (
        <div
          data-scope="upload"
          data-part="dropzone"
          // A `<button>` cannot hold the block content a dragger's children
          // are, so: a div with the role spelled out, its own tab stop, and its
          // own Enter/Space — plus `aria-disabled`, since a div has no
          // `disabled`.
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={ariaAttr(disabled)}
          data-drag-over={dataAttr(dragDepth > 0 && !disabled)}
          data-disabled={dataAttr(disabled)}
          onClick={openPicker}
          onKeyDown={onDropzoneKeyDown}
          {...dropHandlers}
        >
          {children}
        </div>
      ) : (
        // No role and no tabindex. `children` IS the control — the documented
        // usage is `<Upload><Button>Select</Button></Upload>` — and a wrapper
        // announcing itself as a button around a button is two tab stops for
        // one action.
        <span data-scope="upload" data-part="trigger" onClick={openPicker}>
          {children}
        </span>
      )}

      {showUploadList && list.length > 0 && (
        // `role="list"` spelled out because the stylesheet sets
        // `list-style: none`, and Safari drops the implicit role from a list
        // styled that way — losing the "list, 3 items" announcement silently.
        <ul data-scope="upload" data-part="list" role="list">
          {list.map(entry => {
            const thumb = entry.thumbUrl ?? entry.url;
            return (
              <li
                key={entry.uid}
                data-scope="upload"
                data-part="item"
                // `data-state`, not `data-status`: these four are literally the
                // machine's states, and `data-status` already means validation
                // status elsewhere in the library.
                data-state={entry.status}
                data-list-type={listType}
              >
                {listType === "picture" ? (
                  thumb && <img data-scope="upload" data-part="thumbnail" src={thumb} alt="" />
                ) : (
                  <span data-scope="upload" data-part="item-icon">
                    <Icon name="file" size="sm" />
                  </span>
                )}

                {onPreview ? (
                  <button
                    type="button"
                    data-scope="upload"
                    data-part="item-name"
                    onClick={() => onPreview(entry)}
                  >
                    {entry.name}
                  </button>
                ) : entry.url ? (
                  <a
                    data-scope="upload"
                    data-part="item-name"
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {entry.name}
                  </a>
                ) : (
                  <span data-scope="upload" data-part="item-name">
                    {entry.name}
                  </span>
                )}

                {entry.status === "uploading" && (
                  <div
                    data-scope="upload"
                    data-part="item-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={entry.percent}
                    // Named, because "progress bar, 40%" with four of them on
                    // screen says nothing about which file it belongs to.
                    aria-label={`${locale.Upload.uploading} ${entry.name}`}
                  >
                    <div
                      data-scope="upload"
                      data-part="item-progress-bar"
                      // A custom property, not `data-progress="37"`: CSS cannot
                      // do arithmetic on an attribute value, and
                      // `[data-progress]` MATCHES at "0" — the presence-attribute
                      // trap one spelling sideways.
                      style={{ "--ck-upload-progress": String(entry.percent) } as CSSProperties}
                    />
                  </div>
                )}

                {entry.status === "error" && (
                  <span data-scope="upload" data-part="item-error">
                    {locale.Upload.error}
                  </span>
                )}

                {/* `disabled` on both controls, because a disabled Upload that
                    still removes files and still fires a request from Retry is
                    disabled in appearance only — and the stylesheet's
                    `:not([data-disabled])` hover guards need the attribute to
                    guard against. */}
                <span data-scope="upload" data-part="item-actions">
                  {entry.status === "error" && (
                    <button
                      type="button"
                      data-scope="upload"
                      data-part="retry"
                      // The file name is in the label because five identical
                      // "Retry" buttons are indistinguishable in a screen
                      // reader's button list.
                      aria-label={`${locale.Upload.retry} ${entry.name}`}
                      disabled={disabled}
                      data-disabled={dataAttr(disabled)}
                      onClick={() => void request(entry.uid)}
                    >
                      <Icon name="refresh" size="sm" />
                    </button>
                  )}
                  <button
                    type="button"
                    data-scope="upload"
                    data-part="remove"
                    aria-label={`${locale.Upload.remove} ${entry.name}`}
                    disabled={disabled}
                    data-disabled={dataAttr(disabled)}
                    onClick={() => remove(entry)}
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Rendered unconditionally: a live region that does not exist before its
          first content is never registered, and the first announcement is lost. */}
      <span data-scope="upload" data-part="status" role="status">
        {announcement}
      </span>
    </div>
  );
}

export function Upload(props: UploadProps) {
  return <UploadBase {...props} />;
}

/** The drop target. Identical props; it differs only in what it renders. */
export function UploadDragger(props: UploadProps) {
  return <UploadBase {...props} dragger />;
}

Upload.Dragger = UploadDragger;
