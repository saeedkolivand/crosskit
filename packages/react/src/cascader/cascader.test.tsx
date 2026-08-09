import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Cascader } from "./cascader";
import type { TreeNode } from "@crosskit-ui/core";

/**
 * zhejiang
 *   hangzhou
 *     west-lake
 *     xihu
 *   ningbo (leaf)
 * jiangsu
 *   nanjing
 *     zhonghua
 *   locked (disabled)
 */
const OPTIONS: TreeNode[] = [
  {
    key: "zhejiang",
    title: "Zhejiang",
    children: [
      {
        key: "hangzhou",
        title: "Hangzhou",
        children: [
          { key: "west-lake", title: "West Lake" },
          { key: "xihu", title: "Xihu" },
        ],
      },
      { key: "ningbo", title: "Ningbo" },
    ],
  },
  {
    key: "jiangsu",
    title: "Jiangsu",
    children: [
      { key: "nanjing", title: "Nanjing", children: [{ key: "zhonghua", title: "Zhonghua" }] },
      { key: "locked", title: "Locked", disabled: true },
    ],
  },
];

/**
 * Two branches that each hold an `other`, which is the ordinary case: a key is
 * unique among siblings, never globally.
 */
const TWINS: TreeNode[] = [
  { key: "a", title: "A", children: [{ key: "other", title: "A-other" }] },
  { key: "b", title: "B", children: [{ key: "other", title: "B-other" }] },
];

/**
 * A key repeated ACROSS levels rather than across branches, which is the only
 * fixture that can tell the roving tab stop's two halves apart: with globally
 * unique keys, `node.key === focusKey` alone already leaves exactly one stop.
 */
const NESTED_TWIN: TreeNode[] = [
  { key: "loop", title: "Loop", children: [{ key: "loop", title: "Loop again" }] },
];

const trigger = () => screen.getByRole("combobox");
const panel = () => document.querySelector('[data-scope="cascader"][data-part="content"]');
const columns = () =>
  Array.from(document.querySelectorAll('[data-scope="cascader"][data-part="column"]'));
const items = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope="cascader"][data-part="item"]'));
const item = (name: string) => screen.getByRole("option", { name });
const clear = () => screen.getByRole("button", { name: /clear/i });
const hiddenValues = (name: string) =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
  ).map(input => input.value);
const withAttr = (attribute: string) =>
  items()
    .filter(node => node.hasAttribute(attribute))
    .map(node => node.textContent);

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(trigger());
  await waitFor(() => expect(panel()).toBeInTheDocument());
};

describe("Cascader", () => {
  it("renders nothing until it is opened", () => {
    render(<Cascader options={OPTIONS} />);
    expect(panel()).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("opens with exactly one column and adds one per branch entered", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    expect(columns()).toHaveLength(1);

    await user.click(item("Zhejiang"));
    expect(columns()).toHaveLength(2);

    await user.click(item("Hangzhou"));
    expect(columns()).toHaveLength(3);
  });

  it("opens no column for a leaf, and closes on it", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    // `Ningbo` is the representative that matters. A path ending at a BRANCH
    // cannot tell "a column per resolved node" from "a column per node with
    // children" — for a branch the two agree.
    await user.click(item("Ningbo"));
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    // And focus comes back with it, rather than being dropped on <body> with
    // the column it was in. `choose` no longer restores this itself — the close
    // handler does, and this is what says so.
    expect(trigger()).toHaveFocus();
  });

  it("ignores a click on a disabled option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // `changeOnSelect` ON, because `Locked` is a leaf: with it off a leaf and a
    // branch report differently and the miss would be half-hidden.
    render(<Cascader options={OPTIONS} changeOnSelect onChange={onChange} />);
    await openPanel(user);
    await user.click(item("Jiangsu"));
    onChange.mockClear();
    await user.click(item("Locked"));
    // The stylesheet sets `opacity` and `cursor` and never `pointer-events`, so
    // the press really does arrive — the guard in `choose` is the only thing
    // between it and a committed value.
    expect(onChange).not.toHaveBeenCalled();
    expect(withAttr("data-active")).toEqual(["Jiangsu"]);
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("reports the path AND the nodes it names, resolved positionally", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={TWINS} onChange={onChange} />);
    await openPanel(user);
    await user.click(item("B"));
    await user.click(item("B-other"));

    // The node identity, not just the key: a flat key index returns a's `other`
    // for this path, because it comes first in document order.
    expect(onChange).toHaveBeenCalledWith(["b", "other"], [TWINS[1], TWINS[1]!.children![0]]);
  });

  it("does not report a branch until a leaf is reached", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={OPTIONS} onChange={onChange} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(item("Ningbo"));
    expect(onChange).toHaveBeenCalledWith(["zhejiang", "ningbo"], expect.anything());
  });

  it("reports every level under changeOnSelect", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={OPTIONS} changeOnSelect onChange={onChange} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    expect(onChange).toHaveBeenCalledWith(["zhejiang"], [OPTIONS[0]]);
    // `data-state`, not presence. Presence deliberately OUTLIVES `open` so the
    // exit animation gets a frame, so a CLOSING popup is still in the document
    // and `toBeInTheDocument` here could not fail.
    expect(panel()).toHaveAttribute("data-state", "open");
  });

  it("joins the titles on the trigger with the separator, and leads with none", () => {
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "hangzhou", "xihu"]} />);
    // ANCHORED. `toHaveTextContent` is a substring match, so a separator
    // emitted before the FIRST segment as well — the natural way to write this
    // wrong — reads as "/ Zhejiang / …" and slips straight through a bare
    // string.
    expect(trigger()).toHaveTextContent(/^Zhejiang \/ Hangzhou \/ Xihu$/);
    expect(trigger()).not.toHaveAttribute("data-empty");
  });

  it("joins with a separator the consumer chose", () => {
    render(<Cascader options={OPTIONS} separator=" > " defaultValue={["zhejiang", "ningbo"]} />);
    expect(trigger()).toHaveTextContent(/^Zhejiang > Ningbo$/);
  });

  it("shows the placeholder while empty", () => {
    render(<Cascader options={OPTIONS} placeholder="Pick a place" />);
    expect(trigger()).toHaveTextContent("Pick a place");
    expect(trigger()).toHaveAttribute("data-empty", "");
  });

  it("marks a chosen node selected only under the branch it was chosen in", async () => {
    const user = userEvent.setup();
    render(<Cascader options={TWINS} defaultValue={["a", "other"]} />);
    await openPanel(user);
    // Browsing to b puts b's own `other` beside a's committed one. Without the
    // prefix guard the same-keyed node under the wrong branch paints selected.
    await user.click(item("B"));
    expect(withAttr("data-selected")).toEqual(["A"]);
    expect(withAttr("data-active")).toEqual(["B"]);
  });

  it("marks the browsing path active, which is not the committed one", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} />);
    await openPanel(user);
    expect(withAttr("data-selected")).toEqual(["Zhejiang", "Ningbo"]);
    await user.click(item("Jiangsu"));
    // Active moved to the branch being browsed; selected did not, because
    // nothing was chosen. `Zhejiang` stays marked because column 0 IS the roots
    // and the value genuinely names one of them — what the prefix guard drops
    // is the DEEPER half, `Ningbo`, which is no longer on screen at all.
    expect(withAttr("data-active")).toEqual(["Jiangsu"]);
    expect(withAttr("data-selected")).toEqual(["Zhejiang"]);
    expect(screen.queryByRole("option", { name: "Ningbo" })).not.toBeInTheDocument();
  });

  it("re-seeds the browsing path from the value each time it opens", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} />);
    await openPanel(user);
    await user.click(item("Jiangsu"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel()).not.toBeInTheDocument());

    await openPanel(user);
    // Abandoning a branch must not leave the next opening pointing at it.
    expect(withAttr("data-active")).toEqual(["Zhejiang", "Ningbo"]);
  });

  it("seeds the browsing path from a controlled value, not only from defaultValue", () => {
    // `defaultOpen` reports nothing through `onOpenChange`, so the seed can
    // only come from the initialiser — and a controlled consumer never writes
    // `defaultValue`. Reading it there opened this with one column.
    render(<Cascader options={OPTIONS} value={["zhejiang", "hangzhou"]} defaultOpen />);
    expect(columns()).toHaveLength(3);
    expect(withAttr("data-active")).toEqual(["Zhejiang", "Hangzhou"]);
  });

  it("re-seeds when a controlled `open` is flipped rather than gestured", async () => {
    const user = userEvent.setup();
    const view = (open: boolean) => (
      <Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} open={open} />
    );
    const { rerender } = render(view(true));
    await user.click(item("Jiangsu"));
    // Closed and reopened from the PROP. `setOpen` is never called on this
    // route, so `onOpenChange` never fires and a seed hung off it never runs.
    rerender(view(false));
    rerender(view(true));
    expect(withAttr("data-active")).toEqual(["Zhejiang", "Ningbo"]);
  });

  it("does not clear the value when the same path is picked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} onChange={onChange} />
    );
    await openPanel(user);
    await user.click(item("Ningbo"));
    // Confirming your own choice is never an empty-out.
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent("Zhejiang / Ningbo");
  });

  it("moves within a column with the arrows and skips a disabled option", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.click(item("Jiangsu"));
    // Column 1 is [Nanjing, Locked(disabled)]. Wrapping past the disabled tail
    // lands back on Nanjing rather than on Locked.
    await user.click(item("Nanjing"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(item("Nanjing"));
    expect(item("Locked")).toHaveAttribute("aria-disabled", "true");
  });

  it("moves off the first option on the very first arrow, not back onto it", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    trigger().focus();
    // With nothing browsed the path is EMPTY while the tab stop already sits on
    // column 0's first enabled option. Reading the keyboard's position off the
    // path rather than off that tab stop hands `navigate` a null current, and
    // "next from nothing" is the FIRST item — so this press would land back on
    // the option it started from. Every other keyboard test starts from a
    // non-empty path, where the two readings agree and cannot be told apart.
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(item("Jiangsu"));
  });

  it("commits the first option on Enter with nothing browsed yet", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={OPTIONS} changeOnSelect onChange={onChange} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));
    // Same empty-path reading, on the other handler: looked up by the path, the
    // focused option is not found in its own column and Enter does nothing.
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(["zhejiang"], [OPTIONS[0]]);
  });

  it("steps into and out of a column with Right and Left", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    await user.keyboard("{ArrowRight}");
    // Right steps onto the first enabled option of the column it opened.
    expect(document.activeElement).toBe(item("Hangzhou"));
    expect(withAttr("data-active")).toEqual(["Zhejiang", "Hangzhou"]);

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(item("Zhejiang"));
    expect(withAttr("data-active")).toEqual(["Zhejiang"]);
    // Going shallower must not leave focus on <body> with the column removed.
    expect(document.activeElement).not.toBe(document.body);
  });

  it("steps deeper with Right before anything has been browsed", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));
    // The empty-path reading again, on the third handler. The columns are
    // DERIVED from the path, so with nothing browsed there is no column beside
    // column 0 — asking `columns[focusCol + 1]` rather than asking the focused
    // node made this key do nothing at all. Every other Right test clicks a row
    // first, where the path is non-empty and the two readings agree.
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(document.activeElement).toBe(item("Hangzhou")));
    // Three: the roots, Zhejiang's children, and Hangzhou's — the step lands on
    // a branch, so the column it opens comes with it. Broken, this stays at one.
    expect(columns()).toHaveLength(3);
    expect(withAttr("data-active")).toEqual(["Zhejiang", "Hangzhou"]);
  });

  it("closes when Tab takes focus out of the popup", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Cascader options={OPTIONS} onOpenChange={onOpenChange} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));

    await user.keyboard("{Tab}");
    // The layer's `focus: true` does not cover this: Tab off the last stop of a
    // popup portalled to the END of the document lands on nothing at all, fires
    // no `focusin`, and left the popup open with focus on <body>.
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    // Once for the press, not twice — the reason Escape is left to the layer.
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith({ open: false });
  });

  it("reports each open and each close exactly once", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Cascader options={OPTIONS} onOpenChange={onOpenChange} />);
    await openPanel(user);
    expect(onOpenChange).toHaveBeenCalledWith({ open: true });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(onOpenChange).toHaveBeenLastCalledWith({ open: false });
    // Escape is answered by the dismissable layer alone. Answering it here as
    // well is what fires this twice for one press.
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("takes focus back from the column the popup closed under", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    // Unmounting the column focus is in leaves <body> focused and the next Tab
    // restarting at the top of the page.
    expect(trigger()).toHaveFocus();
  });

  it("leaves focus on the trigger when the popup opens", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    // `takeFocus: false`. The combobox keeps announcing itself, and ArrowDown
    // is what hands the columns the keyboard.
    expect(trigger()).toHaveFocus();
  });

  it("does not step out of the first column", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    await user.keyboard("{ArrowLeft}");
    expect(withAttr("data-active")).toEqual(["Zhejiang"]);
    expect(columns()).toHaveLength(2);
  });

  it("commits on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={OPTIONS} onChange={onChange} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    // Right steps onto Hangzhou, Down moves to Ningbo WITHIN that column, Enter
    // commits it. Ningbo is a leaf, so the path is two deep, not three — which
    // is also the assertion that Down moved inside the column rather than into
    // the one Hangzhou opened.
    await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(
      ["zhejiang", "ningbo"],
      [OPTIONS[0], OPTIONS[0]!.children![1]]
    );
  });

  it("keeps one tab stop for the whole popup, even when a key repeats down it", async () => {
    const user = userEvent.setup();
    // The repeated key is the point. Against a fixture whose keys are globally
    // unique, `node.key === focusKey` alone already leaves one stop and the
    // `depth === focusCol` half of the condition cannot be told apart from a
    // missing one. Here both rows answer to `loop`.
    render(<Cascader options={NESTED_TWIN} defaultValue={["loop", "loop"]} />);
    await openPanel(user);
    expect(items()).toHaveLength(2);
    const stops = items().filter(node => node.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveTextContent("Loop again");
  });

  it("hands the columns the keyboard on ArrowDown at the trigger", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(panel()).toBeInTheDocument());
    // The first enabled option of column 0, which is the roving tab stop.
    await waitFor(() => expect(document.activeElement).toBe(item("Zhejiang")));
  });

  it("expands on hover only when asked, and never commits from one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // changeOnSelect ON is the combination where a leaked commit would otherwise
    // be invisible: with it off, a branch reports nothing anyway.
    render(<Cascader options={OPTIONS} expandTrigger="hover" changeOnSelect onChange={onChange} />);
    await openPanel(user);
    await user.pointer({ target: item("Zhejiang"), coords: { clientX: 1, clientY: 1 } });
    await user.pointer({ target: item("Zhejiang"), coords: { clientX: 2, clientY: 2 } });
    expect(columns()).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not expand on hover under the default trigger", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.pointer({ target: item("Zhejiang"), coords: { clientX: 1, clientY: 1 } });
    await user.pointer({ target: item("Zhejiang"), coords: { clientX: 2, clientY: 2 } });
    expect(columns()).toHaveLength(1);
  });

  it("clears without reopening the popup", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} onChange={onChange} />
    );
    await user.click(clear());
    expect(onChange).toHaveBeenCalledWith([], []);
    // The trigger wrapper owns the click listener, so a missing
    // stopPropagation opens the panel on the way out.
    expect(panel()).not.toBeInTheDocument();
  });

  it("collapses the open columns when the value is cleared", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} />);
    await openPanel(user);
    expect(columns()).toHaveLength(2);
    // The clear sits inside the trigger wrapper, which the layer excludes, so
    // the popup is still up afterwards — and the browsing path has to come back
    // with the value, or it goes on showing columns for a path nothing holds.
    await user.click(clear());
    expect(panel()).toHaveAttribute("data-state", "open");
    expect(columns()).toHaveLength(1);
    expect(withAttr("data-active")).toEqual([]);
  });

  it("gives a chevron only to a row that opens another column", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    // The icon MEANS "this opens another column". The reserved width is what
    // lines the titles up, and it is the empty span that does that — putting a
    // chevron in every one of them lies about the tree.
    expect(item("Hangzhou").querySelector("svg")).not.toBeNull();
    expect(item("Ningbo").querySelector("svg")).toBeNull();
    expect(item("Ningbo").querySelector('[data-part="item-indicator"]')).not.toBeNull();
  });

  it("submits one hidden input per path segment, even when a segment repeats", () => {
    const repeated: TreeNode[] = [
      { key: "other", title: "Other", children: [{ key: "other", title: "Other again" }] },
    ];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Cascader options={repeated} name="place" defaultValue={["other", "other"]} />);
    expect(hiddenValues("place")).toEqual(["other", "other"]);
    // Keyed by index, not by the segment: a repeated segment keyed on itself is
    // a duplicate React key, and React drops one of the two inputs.
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("submits the committed value, never the path being browsed", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} name="place" defaultValue={["zhejiang", "ningbo"]} />);
    await openPanel(user);
    // Browsing a BRANCH under the default `changeOnSelect` commits nothing, so
    // the two paths are genuinely different here. Every reading taken with the
    // popup shut has them identical and cannot tell the fields apart.
    await user.click(item("Jiangsu"));
    expect(withAttr("data-active")).toEqual(["Jiangsu"]);
    expect(hiddenValues("place")).toEqual(["zhejiang", "ningbo"]);
  });

  it("keeps a value that no option resolves clearable, while showing the placeholder", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // The async-load case: the value arrived before its options.
    render(<Cascader options={[]} value={["zhejiang", "ningbo"]} onChange={onChange} />);
    expect(trigger()).toHaveAttribute("data-empty", "");
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith([], []);
  });

  it("leaves a tab stop when the value does not resolve", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} value={["nowhere", "at-all"]} />);
    await openPanel(user);
    // The clamp is what stops the popup having no tab stop and a dead keyboard.
    expect(columns()).toHaveLength(1);
    expect(items().filter(node => node.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("treats a null value as a controlled clear, not as uncontrolled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={OPTIONS} value={null} onChange={onChange} />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    await user.click(item("Ningbo"));
    expect(onChange).toHaveBeenCalledWith(["zhejiang", "ningbo"], expect.anything());
    // The consumer did not write the value back, so nothing shows.
    expect(trigger()).toHaveAttribute("data-empty", "");
  });

  it("names each column after the option it descends from", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} aria-label="Place" />);
    await openPanel(user);
    await user.click(item("Zhejiang"));
    const [first, second] = screen.getAllByRole("listbox");
    expect(first).toHaveAttribute("aria-label", "Place");
    expect(second).toHaveAttribute("aria-labelledby", item("Zhejiang").id);
    // The content itself claims no role: a container announcing `listbox` with
    // zero options in it, while the real listboxes sit inside, is two claims
    // about one popup that disagree.
    expect(panel()).not.toHaveAttribute("role");
    // Which is exactly why `aria-controls` cannot point at it. It names the
    // first column, which is a real listbox and is the control's own list.
    const controls = trigger().getAttribute("aria-controls");
    expect(document.getElementById(controls!)).toBe(first);
  });

  it("passes the smaller field props through to the control", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <Cascader
        options={OPTIONS}
        id="place"
        aria-describedby="hint"
        aria-invalid
        allowClear={false}
        defaultValue={["zhejiang", "ningbo"]}
        onBlur={onBlur}
      />
    );
    expect(trigger()).toHaveAttribute("id", "place");
    expect(trigger()).toHaveAttribute("aria-describedby", "hint");
    // `aria-invalid` on its own, with no `status`. A `status="error"` fixture
    // reaches only the other half of that `||` and the two coincide there.
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    // A held value AND `allowClear={false}` — with an empty one the button is
    // absent either way.
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    trigger().focus();
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it("writes booleans as presence attributes and enums raw", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} size="large" status="error" />);
    expect(trigger()).toHaveAttribute("data-size", "large");
    expect(trigger()).toHaveAttribute("data-status", "error");
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    await openPanel(user);
    await user.click(item("Jiangsu"));
    // `""`, never `"false"` — `[data-x="false"]` matches `[data-x]` in CSS.
    expect(item("Jiangsu").getAttribute("data-active")).toBe("");
    expect(item("Nanjing").hasAttribute("data-active")).toBe(false);
    expect(item("Locked").getAttribute("data-disabled")).toBe("");
    expect(item("Nanjing").hasAttribute("data-disabled")).toBe(false);
    // The tri-state exceptions, deliberately literal strings.
    expect(item("Nanjing")).toHaveAttribute("aria-selected", "false");
  });

  it("puts no class in the markup and lands the consumer's on the control", () => {
    render(<Cascader options={OPTIONS} className="mine" defaultOpen />);
    const control = document.querySelector('[data-scope="cascader"][data-part="control"]');
    expect(control).toHaveClass("mine");
    for (const node of document.querySelectorAll('[data-scope="cascader"]')) {
      if (node === control) continue;
      expect(node.className).toBe("");
    }
  });

  it("leaves the icons their own scope", () => {
    // A value, so the clear's icon renders too and all three call sites are on
    // screen at once.
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang"]} defaultOpen />);
    const svgs = Array.from(document.querySelectorAll("svg"));
    // Counted, because `for (const svg of [])` passes vacuously and this loop
    // is the whole guard: the trigger's chevron, the clear's cross, and one
    // chevron per branch — Zhejiang and Jiangsu in column 0, Hangzhou in
    // column 1. Ningbo is a leaf and contributes none.
    expect(svgs).toHaveLength(5);
    // `icon.css` keys every bit of icon presentation off `[data-scope="icon"]`
    // alone, and Icon spreads rest last — so stamping ours on it renders an
    // unsized black SVG.
    for (const svg of svgs) expect(svg).toHaveAttribute("data-scope", "icon");
  });

  it("does not open while disabled", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} disabled />);
    expect(trigger()).toHaveAttribute("data-disabled", "");
    await user.click(trigger());
    expect(panel()).not.toBeInTheDocument();
  });

  it("gives every item a unique id across two cascaders on one page", () => {
    render(
      <>
        <Cascader options={OPTIONS} defaultOpen aria-label="one" />
        <Cascader options={OPTIONS} defaultOpen aria-label="two" />
      </>
    );
    const ids = items().map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
