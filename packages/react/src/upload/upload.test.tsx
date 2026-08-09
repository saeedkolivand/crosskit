import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Upload } from "./upload";
import type { UploadFile, UploadRequestArgs } from "./upload";

const makeFile = (name = "a.png", type = "image/png"): File =>
  new File([new Uint8Array(3)], name, { type });

const root = () => document.querySelector('[data-scope="upload"][data-part="root"]')!;
const part = (name: string) => document.querySelector(`[data-scope="upload"][data-part="${name}"]`);
const parts = (name: string) => [
  ...document.querySelectorAll(`[data-scope="upload"][data-part="${name}"]`),
];
const input = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const items = () => parts("item");

/** A seeded entry, as `defaultFileList` would carry it back from a server. */
const seeded = (over: Partial<UploadFile> = {}): UploadFile => ({
  uid: "seed-1",
  name: "seed.png",
  size: 3,
  type: "image/png",
  status: "done",
  percent: 100,
  ...over,
});

/**
 * A `customRequest` whose callbacks the test drives by hand.
 *
 * The real transport is `xhrUpload`, tested in core against a fake XHR. What is
 * being exercised here is the adapter's wiring: which state a callback moves the
 * row to, and what it reports.
 */
function manualRequest() {
  const calls: UploadRequestArgs[] = [];
  const aborts = vi.fn();
  const customRequest = (args: UploadRequestArgs) => {
    calls.push(args);
    return { abort: aborts };
  };
  return { calls, aborts, customRequest };
}

describe("Upload", () => {
  it("renders its parts, with the consumer's class on the root untouched", () => {
    render(
      <Upload className="mine">
        <button>Select</button>
      </Upload>
    );
    expect(root()).toHaveClass("mine");
    expect(root()).toHaveAttribute("data-list-type", "text");
    expect(part("trigger")).toBeInTheDocument();
    expect(part("status")).toHaveAttribute("role", "status");
  });

  it("spreads the consumer's attributes AFTER its own, so they win", () => {
    render(
      <Upload listType="text" data-list-type="picture">
        x
      </Upload>
    );
    // Deliberately an attribute the component itself writes, and with a value it
    // would never write for these props. A `data-testid` collides with nothing
    // we emit, so it lands on the root whether `{...rest}` spreads first or
    // last — an assertion that cannot fail. This one can: spread first and the
    // component's own `data-list-type="text"` overwrites it.
    expect(root()).toHaveAttribute("data-list-type", "picture");
  });

  it("emits `disabled` as a presence attribute, never as the string false", () => {
    const { rerender } = render(<Upload>x</Upload>);
    // `"false"` MATCHES `[data-disabled]` in CSS, so a raw boolean would apply
    // the disabled styles to every enabled Upload in the library.
    expect(root()).not.toHaveAttribute("data-disabled");
    rerender(<Upload disabled>x</Upload>);
    expect(root().getAttribute("data-disabled")).toBe("");
  });

  it("leaves the trigger inert, because the child is the control", () => {
    render(
      <Upload>
        <button>Select</button>
      </Upload>
    );
    // A wrapper with role=button around a button is two tab stops for one
    // action, and an interactive element nested inside something announcing
    // itself as a button.
    expect(part("trigger")).not.toHaveAttribute("role");
    expect(part("trigger")).not.toHaveAttribute("tabindex");
  });

  it("keeps the file input out of the tab order but reachable to click", () => {
    render(
      <Upload accept=".png" multiple>
        x
      </Upload>
    );
    expect(input()).toHaveAttribute("aria-hidden", "true");
    expect(input().tabIndex).toBe(-1);
    // `accept` on the input is for the OS dialog only; `addFiles` re-checks it,
    // because a drop bypasses the attribute entirely.
    expect(input()).toHaveAttribute("accept", ".png");
    expect(input().multiple).toBe(true);
  });

  it("disables the input itself, not only the paths that reach it", () => {
    render(<Upload disabled>x</Upload>);
    // The browser-level statement, and the one enforcement point neither the
    // trigger guard nor `admit`'s guard covers: an input left enabled still
    // opens a dialog for anything that activates it directly.
    expect(input().disabled).toBe(true);
  });

  it("drops `multiple` from the input under maxCount 1", () => {
    render(
      <Upload multiple maxCount={1}>
        x
      </Upload>
    );
    // A dialog inviting a multi-select whose surplus is then silently discarded
    // is worse than one that never offered it.
    expect(input().multiple).toBe(false);
  });

  it("sets webkitdirectory, and implies multiple, under `directory`", () => {
    render(<Upload directory>x</Upload>);
    // Lowercase and spread, because React knows no such attribute — anything
    // else and it never reaches the DOM.
    expect(input()).toHaveAttribute("webkitdirectory", "");
    expect(input().multiple).toBe(true);
  });

  it("opens the picker from the trigger, and not when disabled", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    const { rerender } = render(
      <Upload>
        <button>Select</button>
      </Upload>
    );
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(click).toHaveBeenCalledTimes(1);

    rerender(
      <Upload disabled>
        <button>Select</button>
      </Upload>
    );
    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("lists a picked file and reports it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Upload onChange={onChange}>x</Upload>);
    await user.upload(input(), makeFile("holiday.png"));

    expect(items()).toHaveLength(1);
    expect(screen.getByText("holiday.png")).toBeInTheDocument();
    expect(items()[0]).toHaveAttribute("data-state", "selected");
    expect(onChange.mock.calls[0]![0].fileList).toHaveLength(1);
    expect(onChange.mock.calls[0]![0].file.name).toBe("holiday.png");
  });

  it("resets the input's value so the same file can be picked twice", async () => {
    const values: string[] = [];
    render(<Upload>x</Upload>);

    // Spying on the SETTER, not reading the value back. jsdom reports `""` from
    // a file input's getter whether or not anything reset it — the
    // `C:\fakepath\…` form only ever comes from a real dialog — so
    // `expect(input.value).toBe("")` is an assertion that cannot fail, and
    // deleting the reset line would leave it green. The own property shadows
    // the prototype accessor, for this one element.
    //
    // Driven with `fireEvent` rather than `user.upload` for the same reason the
    // spy is needed at all: user-event installs its own `value` interceptor on
    // the element and would replace this one.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    const element = input();
    Object.defineProperty(element, "value", {
      configurable: true,
      get: () => descriptor.get!.call(element) as string,
      set: (next: string) => {
        values.push(next);
        descriptor.set!.call(element, next);
      },
    });

    fireEvent.change(element, { target: { files: [makeFile("a.png")] } });
    await waitFor(() => expect(items()).toHaveLength(1));

    // Without the reset, the browser fires no `change` at all for a second pick
    // of the same file — the event only fires when the value CHANGES. Neither
    // jsdom nor Playwright reproduces that suppression, because both assign
    // files programmatically, so the mechanism is all that can be asserted.
    expect(values).toEqual([""]);
  });

  it("refuses a file `accept` does not admit, and lists the ones it does", async () => {
    const user = userEvent.setup();
    render(<Upload accept="image/*">x</Upload>);
    await user.upload(input(), [makeFile("a.png"), makeFile("b.pdf", "application/pdf")]);
    expect(items()).toHaveLength(1);
    expect(screen.getByText("a.png")).toBeInTheDocument();
    expect(screen.queryByText("b.pdf")).not.toBeInTheDocument();
  });

  it("replaces rather than truncates under maxCount 1", async () => {
    const user = userEvent.setup();
    render(<Upload maxCount={1}>x</Upload>);
    await user.upload(input(), makeFile("first.png"));
    await user.upload(input(), makeFile("second.png"));
    // Implemented as a truncate, the old file stays and the new pick is
    // silently discarded — which reads as "the picker is broken".
    expect(items()).toHaveLength(1);
    expect(screen.getByText("second.png")).toBeInTheDocument();
  });

  it("treats the row a maxCount 1 pick displaces as a removal, not as a disappearance", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:fake/${created.length}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => void revoked.push(url));
    const { calls, aborts, customRequest } = manualRequest();
    const onChange = vi.fn();
    render(
      <Upload maxCount={1} listType="picture" customRequest={customRequest} onChange={onChange}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("first.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.upload(input(), makeFile("second.png"));
    await waitFor(() => expect(screen.getByText("second.png")).toBeInTheDocument());

    // The row is off the screen either way, which is exactly what makes this
    // easy to miss: writing the next list straight to state LOOKS right. What is
    // dropped with it is the request still sending bytes for a file nobody can
    // see, the object URL we minted for it, and any word to the consumer that it
    // went. A replacement is a removal plus an addition.
    expect(aborts).toHaveBeenCalledOnce();
    expect(revoked).toEqual([created[0]]);
    expect(
      onChange.mock.calls.some(
        ([info]) =>
          info.file.name === "first.png" &&
          !info.fileList.some((f: UploadFile) => f.name === "first.png")
      )
    ).toBe(true);
    vi.restoreAllMocks();
  });

  it("truncates the batch to the room left under any other maxCount", async () => {
    const user = userEvent.setup();
    render(
      <Upload multiple maxCount={2}>
        x
      </Upload>
    );
    await user.upload(input(), [makeFile("a.png"), makeFile("b.png"), makeFile("c.png")]);
    expect(items()).toHaveLength(2);
    expect(screen.queryByText("c.png")).not.toBeInTheDocument();
  });

  it("gates the whole list element on there being something in it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Upload>x</Upload>);
    // An empty `<ul>` is not nothing: it is still announced as a list and it
    // still takes its own flex gap.
    expect(part("list")).toBeNull();
    await user.upload(input(), makeFile());
    expect(part("list")).toBeInTheDocument();

    rerender(<Upload showUploadList={false}>x</Upload>);
    expect(part("list")).toBeNull();
  });

  it("names the list explicitly, because `list-style: none` costs the role", () => {
    render(<Upload defaultFileList={[seeded()]}>x</Upload>);
    // Safari drops the implicit `list` role from a list styled that way, and
    // the "list, 3 items" announcement goes with it, silently.
    expect(part("list")).toHaveAttribute("role", "list");
  });

  it("uploads through customRequest, moving the row and the bar with it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { calls, customRequest } = manualRequest();
    render(
      <Upload customRequest={customRequest} onChange={onChange}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "uploading"));

    calls[0]!.onProgress({ percent: 40 });
    const bar = await waitFor(() => {
      const found = part("item-progress-bar");
      expect(found).not.toBeNull();
      return found!;
    });
    await waitFor(() =>
      // A custom property, not `data-progress="40"` — CSS cannot do arithmetic
      // on an attribute value, and `[data-progress]` matches at "0".
      expect(bar.getAttribute("style")).toContain("--ck-upload-progress: 40")
    );
    expect(part("item-progress")).toHaveAttribute("aria-valuenow", "40");
    // Every tick is reported, which is what moves the bar in a CONTROLLED
    // Upload — uncontrolled needs no wiring at all.
    expect(onChange.mock.calls.some(([info]) => info.file.percent === 40)).toBe(true);

    calls[0]!.onSuccess({ id: 7 });
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "done"));
    expect(part("item-progress")).toBeNull();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.file).toMatchObject({ status: "done", percent: 100, response: { id: 7 } });
  });

  it("hands customRequest the field name, method and data it was configured with", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(
      <Upload
        customRequest={customRequest}
        action="/api/up"
        method="PUT"
        name="avatar"
        headers={{ "X-Csrf": "t" }}
        data={file => ({ original: file.name })}
        withCredentials
      >
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      action: "/api/up",
      method: "PUT",
      // `filename` here, `name` on the prop — the multipart FIELD name, not a
      // form field name.
      filename: "avatar",
      headers: { "X-Csrf": "t" },
      data: { original: "a.png" },
      withCredentials: true,
    });
  });

  it("awaits a function `action` while already showing the row as uploading", async () => {
    const user = userEvent.setup();
    let release!: (url: string) => void;
    const { calls, customRequest } = manualRequest();
    render(
      <Upload
        customRequest={customRequest}
        action={() =>
          new Promise<string>(resolve => {
            release = resolve;
          })
        }
      >
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    // The signed-URL round trip happens AFTER `startUpload`, so the row shows
    // progress rather than sitting inert while the URL is fetched.
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "uploading"));
    expect(calls).toHaveLength(0);

    release("https://signed.example/put");
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.action).toBe("https://signed.example/put");
  });

  it("does not issue a request for a file removed while its URL was being signed", async () => {
    const user = userEvent.setup();
    let release!: (url: string) => void;
    const { calls, customRequest } = manualRequest();
    render(
      <Upload
        customRequest={customRequest}
        action={() =>
          new Promise<string>(resolve => {
            release = resolve;
          })
        }
      >
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(items()).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(items()).toHaveLength(0));

    release("https://signed.example/put");
    await Promise.resolve();
    // Core would refuse to RECORD the result of this request, but the bytes
    // would still go out — uploading a file the user has already dismissed.
    expect(calls).toHaveLength(0);
  });

  it("marks a failed row, offers a retry, and the retry starts it over", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    calls[0]!.onProgress({ percent: 61 });
    calls[0]!.onError(new Error("500"));
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "error"));
    expect(part("item-error")).toHaveTextContent("Upload failed");

    await user.click(screen.getByRole("button", { name: /Retry/ }));
    // `error` is not terminal, which is what makes retry the same transition as
    // a first attempt rather than a second one with its own copy of the rules.
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "uploading"));
    expect(part("item-progress")).toHaveAttribute("aria-valuenow", "0");
    expect(part("item-error")).toBeNull();
  });

  it("disables the per-row controls, so a disabled Upload neither removes nor retries", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    // Picked while ENABLED, and failed, so the row carries a real `File` and a
    // real retry button. Seeding the list instead would give an entry with no
    // `file`, which `request` refuses on its own — a fixture where the guarded
    // and the unguarded component behave identically.
    const { rerender } = render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.onError(new Error("500"));
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "error"));

    rerender(
      <Upload disabled customRequest={customRequest}>
        x
      </Upload>
    );
    const retry = screen.getByRole("button", { name: /Retry/ });
    const remove = screen.getByRole("button", { name: /Remove/ });
    // The attribute as well as the property: the stylesheet's hover rules are
    // written `:not([data-disabled])`, and a guard against an attribute nothing
    // ever sets is a guard against nothing.
    expect(retry.getAttribute("data-disabled")).toBe("");
    expect(remove.getAttribute("data-disabled")).toBe("");

    await user.click(retry);
    await user.click(remove);
    await Promise.resolve();
    // A disabled Upload that still fires a network request and still drops rows
    // is disabled in appearance only.
    expect(calls).toHaveLength(1);
    expect(items()).toHaveLength(1);
  });

  it("names the file in every per-row control, and in the progressbar", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("holiday.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    // Five identical "Remove" buttons are indistinguishable in a screen
    // reader's button list, and "progress bar, 40%" says nothing about which of
    // four files it belongs to.
    expect(screen.getByRole("button", { name: "Remove holiday.png" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /holiday\.png/ })).toBeInTheDocument();
    calls[0]!.onError(new Error("boom"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry holiday.png" })).toBeInTheDocument()
    );
  });

  it("announces the settle, and only the settle", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    calls[0]!.onProgress({ percent: 40 });
    // A live region written on every percent tick makes the component unusable
    // with a screen reader.
    await waitFor(() => expect(part("item-progress")).toHaveAttribute("aria-valuenow", "40"));
    expect(part("status")).toHaveTextContent("");

    calls[0]!.onSuccess("ok");
    await waitFor(() => expect(part("status")).toHaveTextContent("a.png uploaded"));
  });

  it("announces a second settle whose words are identical to the first", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    calls[0]!.onError(new Error("500"));
    await waitFor(() => expect(part("status")).toHaveTextContent("a.png Upload failed"));
    const first = part("status")!.textContent;

    await user.click(screen.getByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(calls).toHaveLength(2));
    calls[1]!.onError(new Error("500"));

    // Deliberately the SAME file failing the SAME way — the one case where a
    // plain `setAnnouncement` is silent. A screen reader announces a live region
    // when its content mutates, not when something writes to it, so an identical
    // string that React bails on never reaches the DOM at all. Asserting the
    // words would pass against that; asserting that the text CHANGED will not.
    await waitFor(() => expect(part("status")!.textContent).not.toBe(first));
    expect(part("status")).toHaveTextContent("a.png Upload failed");
  });

  it("admits a file at `selected` and never uploads it when beforeUpload says no", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(
      <Upload customRequest={customRequest} beforeUpload={() => false}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(items()).toHaveLength(1));
    // Which is precisely why `selected` exists: the file is listed and visible,
    // it just never goes out.
    expect(items()[0]).toHaveAttribute("data-state", "selected");
    expect(calls).toHaveLength(0);
  });

  it("reports nothing for a transition that changed nothing", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    const onChange = vi.fn();
    render(
      <Upload customRequest={customRequest} onChange={onChange}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.onSuccess("ok");
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "done"));

    const reports = onChange.mock.calls.length;
    // A tick after the settle. Core answers it with the SAME array reference,
    // and reference equality is the whole signal the adapter has that nothing
    // happened — without it a controlled consumer re-renders, and a Vue or
    // Svelte watcher fed by `onChange` loops on a no-op.
    //
    // Deliberately a file that still EXISTS: the removed-file case below is
    // also suppressed by "we could not find the changed entry", so it cannot
    // tell the reference check from that second guard.
    calls[0]!.onProgress({ percent: 90 });
    await Promise.resolve();
    expect(onChange.mock.calls).toHaveLength(reports);
    expect(items()[0]).toHaveAttribute("data-state", "done");
  });

  it("treats a rejected beforeUpload as a veto rather than losing the selection", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(
      <Upload customRequest={customRequest} beforeUpload={() => Promise.reject(new Error("nope"))}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    // The file stays listed. An unhandled rejection would take out the whole
    // selection instead of the one file the hook was asked about.
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()[0]).toHaveAttribute("data-state", "selected");
    expect(calls).toHaveLength(0);
  });

  it("uploads nothing at all with neither action nor customRequest", async () => {
    const user = userEvent.setup();
    render(<Upload>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(items()).toHaveLength(1));
    // The "collect now, submit with the form" mode — the same terminal state
    // `beforeUpload: false` produces. One state, two ways in.
    expect(items()[0]).toHaveAttribute("data-state", "selected");
    expect(part("item-progress")).toBeNull();
  });

  it("aborts an in-flight request when its row is removed", async () => {
    const user = userEvent.setup();
    const { calls, aborts, customRequest } = manualRequest();
    const onChange = vi.fn();
    render(
      <Upload customRequest={customRequest} onChange={onChange}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(items()).toHaveLength(0));
    expect(aborts).toHaveBeenCalledOnce();
    expect(onChange.mock.calls.at(-1)![0].fileList).toHaveLength(0);
  });

  it("never aborts a request that already finished", async () => {
    const user = userEvent.setup();
    const aborts = vi.fn();
    // Success BEFORE the handle comes back, which is what a `customRequest`
    // backed by a cache, a data URL or an already-resolved promise does. The
    // settle deletes the uid from the abort map, and then the handle is stored
    // on top of it — so removing the finished row calls the consumer's
    // `abort()` on a request that is over.
    const customRequest = (args: UploadRequestArgs) => {
      args.onSuccess({ id: 1 });
      return { abort: aborts };
    };
    render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "done"));

    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(items()).toHaveLength(0));
    expect(aborts).not.toHaveBeenCalled();
  });

  it("lets a late response resolve into nothing once its row is gone", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    const onChange = vi.fn();
    render(
      <Upload customRequest={customRequest} onChange={onChange}>
        x
      </Upload>
    );
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(items()).toHaveLength(0));

    const reports = onChange.mock.calls.length;
    calls[0]!.onSuccess("ok");
    calls[0]!.onProgress({ percent: 90 });
    // No upsert path anywhere, so the row cannot come back — and a no-op
    // transition returns the same array reference, so nothing is reported.
    await Promise.resolve();
    expect(items()).toHaveLength(0);
    expect(onChange.mock.calls).toHaveLength(reports);
  });

  it("keeps two concurrent uploads out of each other's state", async () => {
    const user = userEvent.setup();
    const { calls, customRequest } = manualRequest();
    render(
      <Upload multiple customRequest={customRequest}>
        x
      </Upload>
    );
    await user.upload(input(), [makeFile("a.png"), makeFile("b.png")]);
    await waitFor(() => expect(calls).toHaveLength(2));

    calls[0]!.onProgress({ percent: 30 });
    calls[1]!.onProgress({ percent: 70 });
    // Callbacks closing over their own render's `fileList` would each derive the
    // next list from the same snapshot, and the second write would erase the
    // first — leaving one row stuck at 0.
    await waitFor(() => {
      const bars = parts("item-progress");
      expect(bars[0]).toHaveAttribute("aria-valuenow", "30");
      expect(bars[1]).toHaveAttribute("aria-valuenow", "70");
    });

    calls[0]!.onSuccess("ok");
    await waitFor(() => expect(items()[0]).toHaveAttribute("data-state", "done"));
    expect(items()[1]).toHaveAttribute("data-state", "uploading");
  });

  it("vetoes a removal when onRemove says no", async () => {
    const user = userEvent.setup();
    render(
      <Upload defaultFileList={[seeded()]} onRemove={() => false}>
        x
      </Upload>
    );
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await Promise.resolve();
    expect(items()).toHaveLength(1);
  });

  it("drives a controlled fileList only through onChange", async () => {
    const user = userEvent.setup();
    function Frozen() {
      // Deliberately no `onChange`: a controlled consumer that drops it gets a
      // frozen list, which is the ordinary controlled-component bargain.
      return <Upload fileList={[]}>x</Upload>;
    }
    const { unmount } = render(<Frozen />);
    await user.upload(input(), makeFile("a.png"));
    expect(items()).toHaveLength(0);
    unmount();

    function Wired() {
      const [files, setFiles] = useState<UploadFile[]>([]);
      return (
        <Upload fileList={files} onChange={info => setFiles(info.fileList)}>
          x
        </Upload>
      );
    }
    render(<Wired />);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(items()).toHaveLength(1));
  });

  it("renders a preview button, a link, or plain text — in that order", async () => {
    const user = userEvent.setup();
    const remote = seeded({ url: "https://cdn.example/a.png" });
    // Separate mounts rather than a rerender: `defaultFileList` is read once, in
    // the state initialiser, so a rerender with a different one changes nothing.
    const onPreview = vi.fn();
    const preview = render(<Upload defaultFileList={[remote]} onPreview={onPreview} />);
    expect(part("item-name")!.tagName).toBe("BUTTON");
    // And it is wired. A button that renders and calls nothing satisfies
    // `tagName === "BUTTON"` exactly as well as a working one does, so the tag
    // check alone leaves the whole prop unexercised.
    await user.click(part("item-name")!);
    expect(onPreview).toHaveBeenCalledWith(remote);
    preview.unmount();

    const linked = render(<Upload defaultFileList={[remote]} />);
    const link = part("item-name")!;
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://cdn.example/a.png");
    // `noreferrer` because `target="_blank"` otherwise hands the opened page a
    // live `window.opener` back into ours.
    expect(link).toHaveAttribute("rel", "noreferrer");
    linked.unmount();

    render(<Upload defaultFileList={[seeded()]} />);
    expect(part("item-name")!.tagName).toBe("SPAN");
  });

  it("shows a thumbnail under listType picture, and an icon under text", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      const url = `blob:fake/${created.length}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => void revoked.push(url));

    const { unmount } = render(<Upload listType="picture">x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(part("thumbnail")).toBeInTheDocument());
    expect(part("thumbnail")).toHaveAttribute("src", created[0]);
    // `alt=""` because the adjacent name already carries the label; a duplicate
    // is noise.
    expect(part("thumbnail")).toHaveAttribute("alt", "");
    expect(part("item-icon")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Remove/ }));
    // Object URLs live for the life of the document unless revoked.
    await waitFor(() => expect(revoked).toEqual([created[0]]));
    unmount();
    vi.restoreAllMocks();
  });

  it("never revokes an object URL it did not mint", async () => {
    const user = userEvent.setup();
    const revoked: string[] = [];
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => void revoked.push(url));
    render(
      <Upload listType="picture" defaultFileList={[seeded({ thumbUrl: "blob:theirs" })]}>
        x
      </Upload>
    );
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(items()).toHaveLength(0));
    // An entry that arrived with its own thumbnail from a server-side list is
    // not ours to revoke — doing so breaks it everywhere else on the page.
    expect(revoked).toEqual([]);
    vi.restoreAllMocks();
  });

  it("aborts everything still in flight on unmount", async () => {
    const user = userEvent.setup();
    const { calls, aborts, customRequest } = manualRequest();
    const { unmount } = render(<Upload customRequest={customRequest}>x</Upload>);
    await user.upload(input(), makeFile("a.png"));
    await waitFor(() => expect(calls).toHaveLength(1));
    unmount();
    expect(aborts).toHaveBeenCalled();
  });
});

describe("Upload.Dragger", () => {
  const dropzone = () =>
    document.querySelector<HTMLDivElement>('[data-scope="upload"][data-part="dropzone"]')!;

  /** Through `fireEvent`, so React's state update lands inside `act`. */
  const fire = (type: keyof typeof fireEvent, files: File[] = [], target?: Element) => {
    const event = createEvent[type as "dragEnter"](target ?? dropzone(), {
      // jsdom has no DataTransfer, so the shape the handlers read is supplied
      // by hand. `dropEffect` starts at `"link"`, which is a value the component
      // writes under no condition: seeded with the realistic `"none"`, the
      // disabled case's assertion would pass against a component that sets
      // nothing at all.
      dataTransfer: { files, items: [], dropEffect: "link", types: ["Files"] },
    } as never);
    fireEvent(target ?? dropzone(), event);
    return event as DragEvent;
  };

  it("is a div with the role spelled out, not a button", () => {
    render(<Upload.Dragger>drop here</Upload.Dragger>);
    // A `<button>`'s content model is phrasing-only, and a dragger's children
    // are block content.
    expect(dropzone().tagName).toBe("DIV");
    expect(dropzone()).toHaveAttribute("role", "button");
    expect(dropzone().tabIndex).toBe(0);
  });

  it("marks itself disabled the way a div can", () => {
    render(<Upload.Dragger disabled>drop here</Upload.Dragger>);
    // A div has no `disabled`, so: `aria-disabled` plus a removed tab stop.
    expect(dropzone()).toHaveAttribute("aria-disabled", "true");
    expect(dropzone().tabIndex).toBe(-1);
    expect(dropzone().getAttribute("data-disabled")).toBe("");
  });

  it("opens the picker from Enter and Space", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<Upload.Dragger>drop here</Upload.Dragger>);
    dropzone().focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    // A div has none of a button's built-in activation to fall back on.
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it("holds the drop highlight while the pointer crosses a child", () => {
    render(
      <Upload.Dragger>
        <p>drop here</p>
      </Upload.Dragger>
    );
    fire("dragEnter");
    expect(dropzone().getAttribute("data-drag-over")).toBe("");

    // Moving onto a child fires `dragenter` on the child and `dragleave` on the
    // parent, both of which bubble here. A boolean flag flickers off on every
    // internal boundary; a depth counter does not.
    fire("dragEnter", [], screen.getByText("drop here"));
    fire("dragLeave");
    expect(dropzone().getAttribute("data-drag-over")).toBe("");

    fire("dragLeave");
    expect(dropzone()).not.toHaveAttribute("data-drag-over");
  });

  it("resets the counter on drop rather than decrementing it", () => {
    render(<Upload.Dragger>drop here</Upload.Dragger>);
    fire("dragEnter");
    fire("dragEnter");
    // No `dragleave` follows a drop, so a decrement would leave the count at 1
    // and the highlight stuck on forever.
    fire("drop");
    expect(dropzone()).not.toHaveAttribute("data-drag-over");
  });

  it("cancels dragenter and dragover, which is the only reason drop fires at all", () => {
    render(<Upload.Dragger>drop here</Upload.Dragger>);
    // Without this the browser navigates away to the dropped file and `drop`
    // never fires. Nothing asserts that consequence anywhere: jsdom dispatches
    // a synthetic `drop` regardless, and so does Playwright's `dispatchEvent`
    // — measured, by deleting the call and watching `upload.spec.ts` stay
    // green. Neither harness can start an OS file drag, so this assertion on
    // the mechanism is the whole defence, and it is deliberately the narrowest
    // possible one.
    expect(fire("dragOver").defaultPrevented).toBe(true);
    // `dragenter` too, and for the same reason: a zone that cancels only
    // `dragover` is not registered as a drop target until the pointer moves,
    // and the first frame of the drag is the browser's own refusal cursor.
    expect(fire("dragEnter").defaultPrevented).toBe(true);
  });

  it("promises a copy for a drop it will take, and none for one it will refuse", () => {
    const enabled = render(<Upload.Dragger>drop here</Upload.Dragger>);
    // The cursor the OS paints mid-drag is the only answer a dragger gives
    // before the drop lands. `"copy"` over a zone that will then refuse the file
    // is a promise broken after the fact.
    expect(fire("dragOver").dataTransfer!.dropEffect).toBe("copy");
    enabled.unmount();

    render(<Upload.Dragger disabled>drop here</Upload.Dragger>);
    expect(fire("dragOver").dataTransfer!.dropEffect).toBe("none");
  });

  it("admits a dropped file", async () => {
    render(<Upload.Dragger>drop here</Upload.Dragger>);
    fire("drop", [makeFile("dropped.png")]);
    await waitFor(() => expect(screen.getByText("dropped.png")).toBeInTheDocument());
  });

  it("filters a drop by `accept`, which the input attribute cannot do", async () => {
    render(<Upload.Dragger accept="image/*">drop here</Upload.Dragger>);
    fire("drop", [makeFile("a.png"), makeFile("b.pdf", "application/pdf")]);
    // `accept` on the input filters the OS dialog and nothing else — a drop
    // bypasses it completely, which is why the check lives in core.
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(screen.queryByText("b.pdf")).not.toBeInTheDocument();
  });

  it("takes no drop at all while disabled", async () => {
    render(<Upload.Dragger disabled>drop here</Upload.Dragger>);
    fire("dragEnter");
    // BEFORE the drop, which resets the depth to 0 unconditionally: after it the
    // attribute is absent whether or not the highlight ever appeared, so the
    // assertion in that position cannot see a disabled dragger lighting up.
    expect(dropzone()).not.toHaveAttribute("data-drag-over");

    fire("drop", [makeFile("a.png")]);
    // A dropzone that still accepts drops while looking disabled is the failure
    // that reaches production.
    await Promise.resolve();
    expect(items()).toHaveLength(0);
  });

  it("shares every behaviour path with the plain Upload", () => {
    render(
      <Upload.Dragger defaultFileList={[seeded()]} listType="picture">
        drop here
      </Upload.Dragger>
    );
    // Identical props, one implementation — so there is nothing to keep in step.
    expect(root()).toHaveAttribute("data-list-type", "picture");
    expect(items()).toHaveLength(1);
    expect(part("trigger")).toBeNull();
  });
});
