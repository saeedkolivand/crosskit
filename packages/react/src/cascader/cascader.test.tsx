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

const trigger = () => screen.getByRole("combobox");
const panel = () => document.querySelector('[data-scope="cascader"][data-part="content"]');
const columns = () =>
  Array.from(document.querySelectorAll('[data-scope="cascader"][data-part="column"]'));
const items = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-scope="cascader"][data-part="item"]'));
const item = (name: string) => screen.getByRole("option", { name });
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
    // And the popup stays up, because a branch is not the end of the journey.
    expect(panel()).toBeInTheDocument();
  });

  it("joins the titles on the trigger with the separator", async () => {
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "hangzhou", "xihu"]} />);
    expect(trigger()).toHaveTextContent("Zhejiang / Hangzhou / Xihu");
    expect(trigger()).not.toHaveAttribute("data-empty");
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

  it("keeps one tab stop for the whole popup", async () => {
    const user = userEvent.setup();
    render(<Cascader options={OPTIONS} defaultValue={["zhejiang", "ningbo"]} />);
    await openPanel(user);
    const stops = items().filter(node => node.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveTextContent("Ningbo");
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
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith([], []);
    // The trigger wrapper owns the click listener, so a missing
    // stopPropagation opens the panel on the way out.
    expect(panel()).not.toBeInTheDocument();
  });

  it("submits one hidden input per path segment, even when a segment repeats", () => {
    const repeated: TreeNode[] = [
      { key: "other", title: "Other", children: [{ key: "other", title: "Other again" }] },
    ];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Cascader options={repeated} name="place" defaultValue={["other", "other"]} />);
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="place"]')
    );
    expect(inputs.map(input => input.value)).toEqual(["other", "other"]);
    // Keyed by index, not by the segment: a repeated segment keyed on itself is
    // a duplicate React key, and React drops one of the two inputs.
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
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
    render(<Cascader options={OPTIONS} defaultOpen />);
    // `icon.css` keys every bit of icon presentation off `[data-scope="icon"]`
    // alone, and Icon spreads rest last — so stamping ours on it renders an
    // unsized black SVG.
    for (const svg of document.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("data-scope", "icon");
    }
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
