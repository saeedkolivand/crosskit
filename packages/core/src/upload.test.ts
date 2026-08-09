import { describe, expect, it, vi } from "vitest";
import {
  acceptsFile,
  addFiles,
  removeFile,
  resolveVeto,
  setProgress,
  settleFile,
  startUpload,
  toUploadFile,
  xhrUpload,
  type UploadFile,
} from "./upload";

const makeFile = (name: string, type = "image/png", bytes = 3): File =>
  new File([new Uint8Array(bytes)], name, { type });

/** A queue entry in a chosen state, without going through the transitions to reach it. */
const entry = (uid: string, over: Partial<UploadFile> = {}): UploadFile => ({
  uid,
  name: `${uid}.png`,
  size: 3,
  type: "image/png",
  status: "selected",
  percent: 0,
  ...over,
});

describe("toUploadFile", () => {
  it("mints a uid that a second pick of the same bytes cannot collide with", () => {
    const file = makeFile("a.png");
    // Derived-from-the-file uids (name+size) look tidy and settle the WRONG
    // entry: remove a.png mid-flight, re-add a.png, and the first request's
    // success marks the second row done.
    expect(toUploadFile(file).uid).not.toBe(toUploadFile(file).uid);
  });

  it("prefers the directory path so two index.html files are two rows", () => {
    const file = makeFile("index.html", "text/html");
    Object.defineProperty(file, "webkitRelativePath", { value: "guide/index.html" });
    expect(toUploadFile(file).name).toBe("guide/index.html");
    // `""` for an ordinary pick, which is why the fallthrough has to be `||`
    // and not `??`.
    expect(toUploadFile(makeFile("plain.png")).name).toBe("plain.png");
  });

  it("starts at selected and 0, which is the collect-only terminal state too", () => {
    expect(toUploadFile(makeFile("a.png"))).toMatchObject({ status: "selected", percent: 0 });
  });
});

describe("acceptsFile", () => {
  it("admits everything when there is no rule", () => {
    expect(acceptsFile(makeFile("a.exe", "application/x-msdownload"), undefined)).toBe(true);
    expect(acceptsFile(makeFile("a.exe", "application/x-msdownload"), "")).toBe(true);
  });

  it("matches an extension on a file the OS gave no type", () => {
    // Windows reports `""` for an extension it does not recognise. A rule set
    // made only of `image/png` fixtures never sees this.
    expect(acceptsFile(makeFile("notes.md", ""), ".md")).toBe(true);
    expect(acceptsFile(makeFile("notes.md", ""), ".txt")).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    expect(acceptsFile(makeFile("PHOTO.PNG"), ".png")).toBe(true);
    expect(acceptsFile(makeFile("photo.png", "IMAGE/PNG"), "image/png")).toBe(true);
    // The RULE side too. `accept=".PNG"` and `accept="IMAGE/*"` are both legal
    // attribute values, and lowercasing only the file leaves the rule-side
    // `toLowerCase()` unguarded — every rule in a fixture written in lower case
    // agrees with a broken implementation.
    expect(acceptsFile(makeFile("photo.png"), ".PNG")).toBe(true);
    expect(acceptsFile(makeFile("photo.png", "image/png"), "IMAGE/*")).toBe(true);
    expect(acceptsFile(makeFile("photo.png", "image/png"), "IMAGE/PNG")).toBe(true);
  });

  it("matches a wildcard MIME rule by prefix, and refuses a typeless file", () => {
    expect(acceptsFile(makeFile("a.png", "image/png"), "image/*")).toBe(true);
    expect(acceptsFile(makeFile("a.pdf", "application/pdf"), "image/*")).toBe(false);
    // We know nothing about a typeless file, so a MIME rule cannot admit it.
    expect(acceptsFile(makeFile("a", ""), "image/*")).toBe(false);
  });

  it("takes any of a comma list, with the spaces a real attribute carries", () => {
    expect(acceptsFile(makeFile("a.pdf", "application/pdf"), ".doc, .pdf")).toBe(true);
    expect(acceptsFile(makeFile("a.gif", "image/gif"), ".doc, .pdf")).toBe(false);
  });

  it("honours the total wildcards", () => {
    expect(acceptsFile(makeFile("a.zip", "application/zip"), "*")).toBe(true);
    expect(acceptsFile(makeFile("a.zip", "application/zip"), "*/*")).toBe(true);
  });
});

describe("addFiles", () => {
  it("keeps a refused file out of the list entirely", () => {
    const result = addFiles([], [makeFile("a.png"), makeFile("b.pdf", "application/pdf")], {
      accept: "image/*",
    });
    expect(result.list.map(f => f.name)).toEqual(["a.png"]);
    expect(result.rejected.map(f => f.name)).toEqual(["b.pdf"]);
  });

  it("returns the same array reference when nothing was admitted", () => {
    const list = [entry("one")];
    const result = addFiles(list, [makeFile("b.pdf", "application/pdf")], { accept: "image/*" });
    // Same reference is what lets the adapter skip `onChange` — and what stops a
    // Vue/Svelte watcher looping on a no-op.
    expect(result.list).toBe(list);
    expect(result.added).toEqual([]);
  });

  it("REPLACES under maxCount 1, rather than truncating", () => {
    // Deliberately a non-empty starting list: from empty, replace and truncate
    // agree, so that fixture cannot tell a correct implementation from the
    // usual wrong one.
    const list = [entry("old")];
    const result = addFiles(list, [makeFile("new.png")], { maxCount: 1 });
    expect(result.list.map(f => f.name)).toEqual(["new.png"]);
    expect(result.added).toHaveLength(1);
  });

  it("drops the surplus of a multi-pick under maxCount 1", () => {
    const result = addFiles([], [makeFile("a.png"), makeFile("b.png")], { maxCount: 1 });
    expect(result.list.map(f => f.name)).toEqual(["a.png"]);
    expect(result.rejected.map(f => f.name)).toEqual(["b.png"]);
  });

  it("truncates the batch to the room left under any other maxCount", () => {
    // One present, three offered, room for two: `list`, `added` and `rejected`
    // all say something different, so none of them can pass by coincidence.
    const list = [entry("old")];
    const result = addFiles(list, [makeFile("a.png"), makeFile("b.png"), makeFile("c.png")], {
      maxCount: 3,
    });
    expect(result.list.map(f => f.name)).toEqual(["old.png", "a.png", "b.png"]);
    expect(result.added.map(f => f.name)).toEqual(["a.png", "b.png"]);
    expect(result.rejected.map(f => f.name)).toEqual(["c.png"]);
  });

  it("admits nothing once a maxCount list is already full", () => {
    const list = [entry("one"), entry("two")];
    const result = addFiles(list, [makeFile("a.png")], { maxCount: 2 });
    expect(result.list).toBe(list);
    expect(result.rejected).toHaveLength(1);
  });

  it("admits nothing when a controlled list is already OVER its maxCount", () => {
    // Three in, room for two: `maxCount - list.length` is -1, and `slice(0, -1)`
    // counts from the END — so without the `Math.max(0, …)` floor this admits
    // the batch minus its last file, pushing the list further over the cap. A
    // controlled `fileList` set from outside can be any length at all.
    //
    // Two offered files, not one: `slice(0, -1)` of a single-file batch is
    // empty, which is the same answer the floor gives, and that fixture cannot
    // tell the two implementations apart.
    const list = [entry("one"), entry("two"), entry("three")];
    const result = addFiles(list, [makeFile("a.png"), makeFile("b.png")], { maxCount: 2 });
    expect(result.list).toBe(list);
    expect(result.added).toEqual([]);
    expect(result.rejected.map(f => f.name)).toEqual(["a.png", "b.png"]);
  });

  it("appends to the end, so the list reads in pick order", () => {
    const result = addFiles([entry("old")], [makeFile("a.png")]);
    expect(result.list.map(f => f.name)).toEqual(["old.png", "a.png"]);
  });
});

describe("the status machine", () => {
  it("moves selected to uploading at 0", () => {
    const next = startUpload([entry("a", { percent: 42 })], "a");
    expect(next[0]).toMatchObject({ status: "uploading", percent: 0 });
  });

  it("retries a failed file by the same call, and clears what it failed with", () => {
    const failed = [entry("a", { status: "error", percent: 61, error: new Error("nope") })];
    const next = startUpload(failed, "a");
    expect(next[0]).toMatchObject({ status: "uploading", percent: 0 });
    // Not merely undefined: a stale outcome left on the entry is something a
    // consumer rendering `file.error` would still show mid-retry.
    expect("error" in next[0]!).toBe(false);
  });

  it("refuses to restart something already uploading or already done", () => {
    const busy = [entry("a", { status: "uploading", percent: 30 })];
    expect(startUpload(busy, "a")).toBe(busy);
    const finished = [entry("a", { status: "done", percent: 100 })];
    expect(startUpload(finished, "a")).toBe(finished);
  });

  it("clamps progress into 0-100", () => {
    const busy = [entry("a", { status: "uploading" })];
    expect(setProgress(busy, "a", 140)[0]!.percent).toBe(100);
    expect(setProgress(busy, "a", -8)[0]!.percent).toBe(0);
  });

  it("ignores a progress tick that arrives after the file settled", () => {
    // A transport that fires `progress` after `load` would otherwise drag a
    // finished file back to 97%.
    const done = [entry("a", { status: "done", percent: 100 })];
    expect(setProgress(done, "a", 97)).toBe(done);
    const selected = [entry("a")];
    expect(setProgress(selected, "a", 50)).toBe(selected);
  });

  it("pins done to 100 and leaves error where it died", () => {
    const busy = [entry("a", { status: "uploading", percent: 63 })];
    // The bar and the label cannot be allowed to disagree.
    expect(settleFile(busy, "a", { status: "done" })[0]).toMatchObject({
      status: "done",
      percent: 100,
    });
    // And a failure shows how far it got, rather than snapping anywhere.
    expect(settleFile(busy, "a", { status: "error" })[0]).toMatchObject({
      status: "error",
      percent: 63,
    });
  });

  it("carries the response and the error through", () => {
    const busy = [entry("a", { status: "uploading", percent: 10 })];
    expect(settleFile(busy, "a", { status: "done", response: { id: 7 } })[0]!.response).toEqual({
      id: 7,
    });
    const boom = new Error("500");
    expect(settleFile(busy, "a", { status: "error", error: boom })[0]!.error).toBe(boom);
  });

  it("clears the other outcome when it settles", () => {
    const retried = [entry("a", { status: "uploading", percent: 10, error: new Error("old") })];
    const next = settleFile(retried, "a", { status: "done", response: "ok" })[0]!;
    // A row that succeeded on its second try must not still be carrying the
    // first try's error for the item-error part to render.
    expect("error" in next).toBe(false);
  });

  it("settles once, however many events the transport fires", () => {
    const busy = [entry("a", { status: "uploading", percent: 20 })];
    const done = settleFile(busy, "a", { status: "done" });
    // `load` then `loadend` is one request, not two.
    expect(settleFile(done, "a", { status: "error", error: "late" })).toBe(done);
  });

  it("removes an entry, and says so by reference when there was none", () => {
    const list = [entry("a"), entry("b")];
    expect(removeFile(list, "a").map(f => f.uid)).toEqual(["b"]);
    expect(removeFile(list, "ghost")).toBe(list);
  });
});

describe("a request that resolves after its file was removed", () => {
  const gone = [entry("survivor", { status: "uploading", percent: 5 })];

  it("cannot resurrect the row through progress, settle or retry", () => {
    // The whole defence is that there is no upsert path in this module: every
    // transition maps over entries that exist. A `findIndex`-else-push or a
    // Map-merge implementation would put the removed row back, holding a File
    // the user has already dismissed.
    expect(setProgress(gone, "removed", 50)).toBe(gone);
    expect(settleFile(gone, "removed", { status: "done", response: "ok" })).toBe(gone);
    expect(settleFile(gone, "removed", { status: "error", error: "boom" })).toBe(gone);
    expect(startUpload(gone, "removed")).toBe(gone);
    expect(gone).toHaveLength(1);
  });

  it("leaves the files that are still in flight untouched", () => {
    // Two concurrent uploads: the late callback for one must not disturb the
    // other's percent.
    const list = [
      entry("a", { status: "uploading", percent: 20 }),
      entry("b", { status: "uploading", percent: 70 }),
    ];
    const next = setProgress(list, "a", 40);
    expect(next.map(f => f.percent)).toEqual([40, 70]);
    // And the untouched entry keeps its identity, so a memoised row does not
    // re-render for its neighbour's tick.
    expect(next[1]).toBe(list[1]);
  });

  it("never mutates the list it was handed", () => {
    const list = [entry("a", { status: "uploading", percent: 20 })];
    const snapshot = { ...list[0]! };
    setProgress(list, "a", 90);
    settleFile(list, "a", { status: "done" });
    expect(list[0]).toEqual(snapshot);
  });
});

describe("resolveVeto", () => {
  it("reads absent as yes", async () => {
    await expect(resolveVeto(undefined)).resolves.toBe(true);
  });

  it("passes a plain boolean through", async () => {
    await expect(resolveVeto(false)).resolves.toBe(false);
    await expect(resolveVeto(true)).resolves.toBe(true);
  });

  it("reads a rejection as a veto rather than letting it escape", async () => {
    // An unhandled rejection out of `beforeUpload` would take out the whole
    // selection instead of the one file it was asked about.
    await expect(resolveVeto(Promise.reject(new Error("nope")))).resolves.toBe(false);
  });
});

/**
 * `xhrUpload`, against a fake XMLHttpRequest.
 *
 * What this proves: the wiring — which events map to which callback, that the
 * body is multipart under the configured field name, that headers go on after
 * `open`, and that one request produces exactly one outcome. What it does NOT
 * prove is that a real browser fires `xhr.upload.progress` at all, or with what
 * cadence; jsdom fires none, and nothing short of a server that trickles a
 * response would exercise that. The percentages themselves are `setProgress`'s
 * job and are tested above.
 */
describe("xhrUpload", () => {
  class FakeXhr {
    static last: FakeXhr;
    status = 200;
    responseText = "";
    withCredentials = false;
    opened: [string, string] | null = null;
    headers: Record<string, string> = {};
    sent: FormData | null = null;
    aborted = false;
    uploadListeners: Record<string, (event: unknown) => void> = {};
    upload = {
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        this.uploadListeners[type] = fn;
      },
    };
    listeners: Record<string, () => void> = {};

    constructor() {
      FakeXhr.last = this;
    }
    open(method: string, url: string) {
      this.opened = [method, url];
    }
    setRequestHeader(key: string, value: string) {
      if (!this.opened) throw new Error("setRequestHeader before open");
      this.headers[key] = value;
    }
    addEventListener(type: string, fn: () => void) {
      this.listeners[type] = fn;
    }
    send(body: FormData) {
      this.sent = body;
    }
    abort() {
      this.aborted = true;
      this.listeners.abort?.();
    }
  }

  const withFakeXhr = <T>(run: () => T): T => {
    const original = globalThis.XMLHttpRequest;
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
    try {
      return run();
    } finally {
      globalThis.XMLHttpRequest = original;
    }
  };

  const options = (over: Partial<Parameters<typeof xhrUpload>[0]> = {}) => ({
    file: makeFile("a.png"),
    action: "/api/upload",
    onProgress: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    ...over,
  });

  it("sends multipart under the configured field name, with the extra data", () => {
    withFakeXhr(() => {
      const opts = options({ name: "avatar", data: { album: "trip" }, headers: { "X-Csrf": "t" } });
      xhrUpload(opts);
      const xhr = FakeXhr.last;
      expect(xhr.opened).toEqual(["POST", "/api/upload"]);
      // Headers only make it if they were set after `open` — before it, the
      // browser throws InvalidStateError.
      expect(xhr.headers).toEqual({ "X-Csrf": "t" });
      expect(xhr.sent!.get("avatar")).toBeInstanceOf(File);
      expect(xhr.sent!.get("album")).toBe("trip");
    });
  });

  it("opens with the configured method, and defaults to POST", () => {
    withFakeXhr(() => {
      xhrUpload(options({ method: "PUT" }));
      // A configured PUT silently sent as a POST is a request the server answers
      // with 405 and nothing here explains why. `method` is advertised on the
      // prop surface, so the plumbing is a contract, not an internal.
      expect(FakeXhr.last.opened![0]).toBe("PUT");
      xhrUpload(options());
      expect(FakeXhr.last.opened![0]).toBe("POST");
    });
  });

  it("turns credentials on only when asked, and defaults them off", () => {
    withFakeXhr(() => {
      xhrUpload(options({ withCredentials: true }));
      // Dropped, the cross-origin request goes out with no cookie and the server
      // answers 401 — the exact failure that reads as "the upload endpoint is
      // broken" rather than as a missing flag.
      expect(FakeXhr.last.withCredentials).toBe(true);
      xhrUpload(options());
      expect(FakeXhr.last.withCredentials).toBe(false);
    });
  });

  it("reports a 2xx as success, parsing JSON when it is JSON", () => {
    withFakeXhr(() => {
      const opts = options();
      xhrUpload(opts);
      FakeXhr.last.responseText = '{"id":7}';
      FakeXhr.last.listeners.load!();
      expect(opts.onSuccess).toHaveBeenCalledWith({ id: 7 });
      expect(opts.onError).not.toHaveBeenCalled();
    });
  });

  it("hands back the raw text when the body is not JSON", () => {
    withFakeXhr(() => {
      const opts = options();
      xhrUpload(opts);
      FakeXhr.last.responseText = "ok";
      FakeXhr.last.listeners.load!();
      expect(opts.onSuccess).toHaveBeenCalledWith("ok");
    });
  });

  it("reports a non-2xx as an error, not a success", () => {
    withFakeXhr(() => {
      const opts = options();
      xhrUpload(opts);
      FakeXhr.last.status = 500;
      FakeXhr.last.listeners.load!();
      expect(opts.onSuccess).not.toHaveBeenCalled();
      expect(opts.onError).toHaveBeenCalledOnce();
    });
  });

  it("turns a computable progress event into a percentage", () => {
    withFakeXhr(() => {
      const opts = options();
      xhrUpload(opts);
      FakeXhr.last.uploadListeners.progress!({ lengthComputable: true, loaded: 25, total: 50 });
      expect(opts.onProgress).toHaveBeenCalledWith(50);
      // `loaded / 0` is NaN, and a NaN percent renders `calc(NaN * 1%)` — a bar
      // of no width that never moves again.
      FakeXhr.last.uploadListeners.progress!({ lengthComputable: false, loaded: 25, total: 0 });
      expect(opts.onProgress).toHaveBeenCalledTimes(1);
    });
  });

  it("settles once, whatever else the transport fires afterwards", () => {
    withFakeXhr(() => {
      const opts = options();
      xhrUpload(opts);
      FakeXhr.last.listeners.load!();
      FakeXhr.last.listeners.load!();
      FakeXhr.last.listeners.error!();
      expect(opts.onSuccess).toHaveBeenCalledOnce();
      expect(opts.onError).not.toHaveBeenCalled();
    });
  });

  it("aborts silently, because the abort was the caller's own doing", () => {
    withFakeXhr(() => {
      const opts = options();
      const abort = xhrUpload(opts);
      abort();
      expect(FakeXhr.last.aborted).toBe(true);
      expect(opts.onError).not.toHaveBeenCalled();
      // And a response arriving after the abort reports nothing either.
      FakeXhr.last.listeners.load!();
      expect(opts.onSuccess).not.toHaveBeenCalled();
    });
  });

  it("does not abort a request that has already finished", () => {
    withFakeXhr(() => {
      const opts = options();
      const abort = xhrUpload(opts);
      FakeXhr.last.listeners.load!();
      abort();
      expect(FakeXhr.last.aborted).toBe(false);
    });
  });
});
