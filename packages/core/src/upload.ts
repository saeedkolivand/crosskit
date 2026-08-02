/**
 * The upload queue's arithmetic: what a pick admits, and what a request does to
 * an entry once it is in.
 *
 * Pure transitions over a value rather than a store, because `fileList` /
 * `defaultFileList` / `onChange` is a controlled-or-uncontrolled API in all four
 * adapters. A store owning the list would be a second source of truth fighting
 * the controlled prop; `createToastQueue` gets away with subscriptions only
 * because a toaster deliberately has no controlled form. So core owns the
 * arithmetic and the adapter owns the state.
 *
 * Every transition below returns the IDENTICAL array reference when it changed
 * nothing. That is load-bearing twice over: the adapters skip firing `onChange`
 * on a no-op, and — because there is no upsert path anywhere in this file — a
 * request that resolves after its file was removed is structurally incapable of
 * putting the row back.
 */

import { clamp } from "./behaviour/numeric";

export type UploadStatus = "selected" | "uploading" | "done" | "error";

export interface UploadFile {
  /**
   * Stable for the entry's whole life; what remove, retry, progress and settle
   * name. Spelled `uid` rather than `id` because `fileList` entries are
   * consumer-visible values and that is the spelling the API this mirrors uses.
   */
  uid: string;
  /** `webkitRelativePath || file.name` — see `toUploadFile`. */
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  /** 0–100, clamped. Only moves while `uploading`; pinned to 100 on `done`. */
  percent: number;
  /** Absent for an entry seeded from a server-side list. */
  file?: File;
  /** Only ever set on `error`, and cleared by `startUpload`. */
  error?: unknown;
  /** Whatever the request resolved with. Cleared by `startUpload`. */
  response?: unknown;
  /** A remote URL for an already-uploaded entry. */
  url?: string;
  /** A `blob:` URL the adapter owns, or a caller-supplied thumbnail. */
  thumbUrl?: string;
}

/**
 * Monotonic, never reused, never derived from the file.
 *
 * Deriving a uid from name and size looks tidy and is a correctness bug: remove
 * `a.png` mid-flight, re-add `a.png`, and the first request's `onSuccess` finds
 * a matching uid and marks the SECOND entry done. A counter cannot collide with
 * a later pick of the same bytes. It is only ever reached from a user file pick,
 * so there is no SSR render to hydrate a mismatched id against.
 */
let seq = 0;

/**
 * A picked `File` as a queue entry.
 *
 * `webkitRelativePath` wins over `name` because a directory pick of two
 * `index.html` files under different folders is two distinguishable rows, not
 * one apparent duplicate. It is `""` for an ordinary pick, so `||` — not `??` —
 * is the operator that falls through.
 */
export function toUploadFile(file: File): UploadFile {
  return {
    uid: `ck-upload-${++seq}`,
    name: file.webkitRelativePath || file.name,
    size: file.size,
    type: file.type,
    status: "selected",
    percent: 0,
    file,
  };
}

/**
 * Whether `accept` admits a file, in the grammar `<input accept>` uses.
 *
 * This lives in core rather than in the adapters because **a drop bypasses the
 * attribute entirely** — `accept` filters the OS dialog and nothing else. Left
 * to four adapters, four of them would each decide independently whether to
 * filter a drop, which is the divergence class only the parity suite catches.
 *
 * Two sub-rules that a fixture made only of `image/png` files never exercises:
 * an extension rule has to match a file whose `type` is `""` (Windows reports
 * an empty type for an extension it does not know), and the comparison is
 * case-insensitive on both sides (`PHOTO.PNG` against `.png`).
 */
export function acceptsFile(file: File, accept?: string): boolean {
  const rules = (accept ?? "")
    .split(",")
    .map(rule => rule.trim().toLowerCase())
    .filter(rule => rule !== "");
  if (rules.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return rules.some(rule => {
    if (rule === "*" || rule === "*/*") return true;
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) {
      // `"".startsWith("image/")` is false, so a typeless file is refused by a
      // wildcard MIME rule — which is right: we know nothing about it.
      return type.startsWith(rule.slice(0, -1));
    }
    return type === rule;
  });
}

export interface AddFilesOptions {
  /** The same string `<input accept>` takes. Re-checked here because a drop bypasses the input. */
  accept?: string;
  maxCount?: number;
}

export interface AddFilesResult {
  /** The whole next list, ready for `onChange`. Identical to `list` if nothing was admitted. */
  list: UploadFile[];
  /** Only what was admitted, in batch order — what the caller then uploads. */
  added: UploadFile[];
  /** Refused by `accept`, or dropped by `maxCount`. Never listed, never uploaded. */
  rejected: File[];
}

/**
 * The list after a pick or a drop.
 *
 * `maxCount === 1` **replaces** the list; every other `maxCount` truncates the
 * incoming batch to the room that is left. That asymmetry is the contract and
 * is the single most mis-implemented rule here — implementing the `1` case as a
 * truncate leaves the old file in place and silently discards the new pick,
 * which looks like "the picker is broken" rather than like a bug in here.
 */
export function addFiles(
  list: readonly UploadFile[],
  files: readonly File[],
  options: AddFilesOptions = {}
): AddFilesResult {
  const { accept, maxCount } = options;

  const allowed: File[] = [];
  const rejected: File[] = [];
  for (const file of files) (acceptsFile(file, accept) ? allowed : rejected).push(file);

  let taken = allowed;
  if (maxCount === 1) taken = allowed.slice(0, 1);
  else if (maxCount !== undefined) taken = allowed.slice(0, Math.max(0, maxCount - list.length));
  rejected.push(...allowed.slice(taken.length));

  if (taken.length === 0) return { list: list as UploadFile[], added: [], rejected };

  const added = taken.map(toUploadFile);
  return { list: maxCount === 1 ? added : [...list, ...added], added, rejected };
}

/** Drops an entry. Same reference when the uid is not in the list. */
export function removeFile(list: readonly UploadFile[], uid: string): UploadFile[] {
  const next = list.filter(entry => entry.uid !== uid);
  return next.length === list.length ? (list as UploadFile[]) : next;
}

/**
 * `selected | error → uploading`, at 0%, with any previous outcome cleared.
 *
 * This is also retry: `error` is not terminal, which is precisely what makes a
 * retry the same call as a first attempt rather than a second function with its
 * own copy of the rules.
 */
export function startUpload(list: readonly UploadFile[], uid: string): UploadFile[] {
  return transition(list, uid, entry => {
    if (entry.status !== "selected" && entry.status !== "error") return entry;
    // Destructured off rather than set to `undefined`, so a settled outcome
    // does not survive as a key on an entry that is trying again.
    const { error: _error, response: _response, ...rest } = entry;
    return { ...rest, status: "uploading", percent: 0 };
  });
}

/**
 * A progress tick.
 *
 * Guarded on `uploading` because a tick that arrives after the transport has
 * already fired `load` would otherwise drag a finished file back to 97%.
 */
export function setProgress(
  list: readonly UploadFile[],
  uid: string,
  percent: number
): UploadFile[] {
  return transition(list, uid, entry => {
    if (entry.status !== "uploading") return entry;
    const next = clamp(percent, 0, 100);
    return next === entry.percent ? entry : { ...entry, percent: next };
  });
}

/**
 * The end of a request.
 *
 * Only from `uploading`, which covers a transport firing both `load` and
 * `loadend`: the second call finds a settled entry and changes nothing.
 * `done` pins the percent to 100 so the bar and the label cannot disagree;
 * `error` keeps the percent it died at, so the bar shows where it stopped.
 */
export function settleFile(
  list: readonly UploadFile[],
  uid: string,
  outcome: { status: "done"; response?: unknown } | { status: "error"; error?: unknown }
): UploadFile[] {
  return transition(list, uid, entry => {
    if (entry.status !== "uploading") return entry;
    const { error: _error, response: _response, ...rest } = entry;
    return outcome.status === "done"
      ? { ...rest, status: "done", percent: 100, response: outcome.response }
      : { ...rest, status: "error", error: outcome.error };
  });
}

/**
 * Maps one entry, and returns the original array when the map changed nothing.
 *
 * A `findIndex`-else-push or Map-merge shape would give a late callback a way
 * to resurrect a removed row. There is deliberately no such path: an absent uid
 * simply falls through to the same reference.
 */
function transition(
  list: readonly UploadFile[],
  uid: string,
  map: (entry: UploadFile) => UploadFile
): UploadFile[] {
  let changed = false;
  const next = list.map(entry => {
    if (entry.uid !== uid) return entry;
    const mapped = map(entry);
    if (mapped !== entry) changed = true;
    return mapped;
  });
  return changed ? next : (list as UploadFile[]);
}

/**
 * Normalises a veto hook's answer, and swallows a rejection as `false`.
 *
 * `beforeUpload` and `onRemove` both answer `boolean | Promise<boolean>`, and an
 * unhandled rejection from either would otherwise take out the whole selection
 * rather than the one file it was asked about. Absent means "yes".
 */
export const resolveVeto = (answer: boolean | Promise<boolean> | undefined): Promise<boolean> =>
  Promise.resolve<boolean>(answer ?? true).catch(() => false);

export interface UploadRequestOptions {
  file: File;
  action: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  data?: Record<string, string>;
  /** The multipart FIELD name. Default `"file"`. */
  name?: string;
  withCredentials?: boolean;
  onProgress: (percent: number) => void;
  onSuccess: (response: unknown) => void;
  onError: (error: unknown) => void;
}

/**
 * The default transport, and the reason it is not `fetch`.
 *
 * No shipping browser streams a request body, so `fetch` cannot report how much
 * of an upload has gone out — `XMLHttpRequest` plus `xhr.upload.onprogress` is
 * the only way to get a percentage at all. Here rather than in the adapters so
 * four of them do not write it four times, with no retry, no timeout and no
 * dependency.
 *
 * Returns its own abort, which the adapter calls on remove and on unmount.
 */
export function xhrUpload(options: UploadRequestOptions): () => void {
  const {
    file,
    action,
    method = "POST",
    headers,
    data,
    name = "file",
    withCredentials = false,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const xhr = new XMLHttpRequest();
  const body = new FormData();
  for (const [key, value] of Object.entries(data ?? {})) body.append(key, value);
  body.append(name, file, file.name);

  xhr.open(method, action, true);
  xhr.withCredentials = withCredentials;
  // After `open`, which is the only point a header can be set — and no
  // Content-Type: the browser has to write its own multipart boundary.
  for (const [key, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(key, value);

  /** One outcome per request, whatever the transport fires. */
  let settled = false;
  const finish = (report: () => void) => {
    if (settled) return;
    settled = true;
    report();
  };

  xhr.upload.addEventListener("progress", event => {
    // Absent for a body of unknown length, and `loaded / 0` is NaN — which
    // would reach `setProgress` and render a bar of width `calc(NaN * 1%)`.
    if (event.lengthComputable) onProgress(clamp((event.loaded / event.total) * 100, 0, 100));
  });

  xhr.addEventListener("load", () =>
    finish(() => {
      if (xhr.status >= 200 && xhr.status < 300) onSuccess(parseResponse(xhr.responseText));
      else onError(new Error(`Upload failed with status ${xhr.status}`));
    })
  );
  xhr.addEventListener("error", () => finish(() => onError(new Error("Upload failed"))));
  // Deliberately NO `abort` listener. The returned function is the only thing
  // holding this `xhr`, so it is the only thing that can abort it — and it
  // closes the request itself, on the near side of `xhr.abort()`. A listener as
  // well would be unreachable code that no test could distinguish from its own
  // absence.

  xhr.send(body);

  // An abort is the caller's own doing, so it reports nothing. Closing the
  // request first is what stops a response already in flight from arriving as a
  // success for a file the caller has stopped caring about.
  return () => {
    if (settled) return;
    settled = true;
    xhr.abort();
  };
}

/** JSON when it is JSON, and the raw text when it is not. */
function parseResponse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
