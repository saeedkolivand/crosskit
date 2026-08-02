"use client";

/**
 * A column-per-level picker over the same `TreeNode` shape `Tree` takes.
 *
 * The value is a PATH, not a key, and everything awkward here follows from
 * that: a key is unique among siblings rather than globally, so the same key
 * under two branches is the ordinary case and every "is this the node I mean"
 * question has to be asked positionally. `pathNodes` and `pathColumns` in core
 * answer it for the data; `agree` below answers it for the paint.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  contains,
  createCollection,
  createTypeahead,
  dataAttr,
  hasChildren,
  navigate,
  pathColumns,
  pathNodes,
  type Placement,
  type PlacementAlias,
  type TreeNode,
} from "@crosskit-ui/core";
import { AnchoredView } from "../anchored/anchored";
import { useAnchored } from "../anchored/use-anchored";
import { useConfig } from "../config/config-provider";
import { Icon } from "../icon/icon";

export type CascaderSize = "small" | "middle" | "large";

export interface CascaderProps {
  options: TreeNode[];
  /** The PATH of keys from the root, nearest last — not a single key. */
  value?: string[] | null;
  defaultValue?: string[] | null;
  /** The path, and the nodes it names. Both `[]` when cleared. */
  onChange?: (path: string[], nodes: TreeNode[]) => void;
  placeholder?: string;
  /** What opens the next column. `hover` still commits only on click or Enter. */
  expandTrigger?: "click" | "hover";
  /** Report every level as it is chosen, not only a leaf. */
  changeOnSelect?: boolean;
  /** Joins the titles on the trigger. */
  separator?: string;
  allowClear?: boolean;
  disabled?: boolean;
  size?: CascaderSize;
  status?: "error" | "warning";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (details: { open: boolean }) => void;
  placement?: PlacementAlias | Placement;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** How far two paths agree from the root. Three lines, one caller, and a paint concern rather than tree arithmetic. */
function commonPrefixLength(a: readonly string[], b: readonly string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

const samePath = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((key, i) => key === b[i]);

const titleOf = (node: TreeNode): ReactNode => (node.title as ReactNode) ?? node.key;

export function Cascader({
  options,
  value: controlled,
  defaultValue,
  onChange,
  placeholder,
  expandTrigger = "click",
  changeOnSelect = false,
  separator = " / ",
  allowClear = true,
  disabled = false,
  size = "middle",
  status,
  open,
  defaultOpen,
  onOpenChange,
  placement = "bottomLeft",
  className,
  id,
  name,
  onBlur,
  ref,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: CascaderProps) {
  const { locale } = useConfig();

  // `undefined` is the ONLY thing that means uncontrolled, so `value={null}` is
  // a controlled clear rather than a silent handover to internal state.
  const [uncontrolled, setUncontrolled] = useState<string[]>(() => defaultValue ?? []);
  const value = controlled === undefined ? uncontrolled : (controlled ?? []);

  /**
   * The BROWSING path, which is a different fact from the committed one.
   *
   * It decides which columns exist and where the keyboard is, and it moves
   * while hovering or arrowing without anything being chosen. Seeded from
   * `value` at mount AND again when the popup opens — both routes, because
   * `onOpenChange` never fires for `defaultOpen` and the mount initialiser
   * never fires for a re-open.
   */
  const [active, setActive] = useState<string[]>(() => defaultValue ?? []);

  // Clamped on READ, never on write. `options` arriving after `value` — an
  // async load, or a controlled consumer — would otherwise leave the popup with
  // no tab stop at all and a dead keyboard. Tree's `focused` clamp, one shape up.
  const trail = pathNodes(options, active);
  const path = active.slice(0, trail.length);
  const columns = pathColumns(options, path);

  const agree = commonPrefixLength(path, value);
  const focusCol = path.length > 0 ? path.length - 1 : 0;
  const focusKey = path.at(-1) ?? columns[0]?.find(node => !node.disabled)?.key ?? null;

  // Never a module constant: two cascaders on one page would then share every
  // item id, and `Tree` shipped exactly that.
  const baseId = useId();
  const itemId = (depth: number, key: string) => `${baseId}-${depth}-${key}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const setTrigger = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  /** Raised when a move asked for focus that the target column has not rendered yet. */
  const handOverRef = useRef(false);
  const [typeahead] = useState(createTypeahead);

  const anchored = useAnchored({
    open,
    defaultOpen,
    placement,
    // Fixed, and unrelated to `expandTrigger` — that one opens COLUMNS, not the
    // popup.
    trigger: "click",
    disabled,
    arrow: false,
    scope: "cascader",
    // Drives the trigger's `aria-haspopup`; the role the hook writes on the
    // content is stripped below, because the columns are the widgets.
    role: "listbox",
    // Focus stays on the trigger so the combobox keeps announcing itself.
    // ArrowDown is what hands the columns the keyboard.
    takeFocus: false,
    onOpenChange: details => {
      onOpenChange?.(details);
      if (details.open) {
        // Re-seeded here as well as at mount: browsing away and closing without
        // choosing must not leave the next opening pointing at the abandoned
        // branch rather than at the committed one.
        setActive(value);
        return;
      }
      // Escape and a press outside both close through the dismissable layer,
      // and if a column held focus it is about to be unmounted with focus on it
      // — which leaves <body> focused and the next Tab restarting at the top of
      // the page. Read through a ref because this callback is constructed
      // before `anchored` exists.
      const content = anchoredRef.current?.contentNode;
      if (content && contains(content, document.activeElement)) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    },
  });

  const anchoredRef = useRef(anchored);
  useEffect(() => {
    anchoredRef.current = anchored;
  });

  /**
   * Puts focus on an item and scrolls only the column it is in.
   *
   * `focus()` without `preventScroll`, and `scrollIntoView` at all, walk every
   * scrollable ancestor and reach the document — and the popup is portalled to
   * <body> and is only `position: fixed` once `attachPosition` writes its
   * coordinates a frame later, so the document is exactly what they find.
   * `getBoundingClientRect` rather than `offsetTop`, so this does not silently
   * depend on the column being the item's `offsetParent`.
   */
  const focusItem = (item: HTMLElement) => {
    item.focus({ preventScroll: true });
    const column = item.closest<HTMLElement>('[data-part="column"]');
    if (!column) return;
    const above = item.getBoundingClientRect().top - column.getBoundingClientRect().top;
    if (above < 0) column.scrollTop += above;
    const below = item.getBoundingClientRect().bottom - column.getBoundingClientRect().bottom;
    if (below > 0) column.scrollTop += below;
  };

  // No dependency array on purpose. What this waits for is a COLUMN mounting,
  // which `movePath` triggers through `setActive` — and neither `open` nor the
  // content node changes on that render, so any dependency list that named them
  // would skip the run that has the new column in it. The ref guard makes every
  // other run two comparisons.
  useEffect(() => {
    if (!anchored.open || !handOverRef.current) return;
    const item = focusKey === null ? null : document.getElementById(itemId(focusCol, focusKey));
    // Lowered only once there IS somewhere to put focus. `open` flips a render
    // before the content ref attaches, so this runs once with nothing mounted —
    // and clearing the flag on that pass throws the request away.
    if (!item) return;
    handOverRef.current = false;
    focusItem(item);
  });

  const commit = (next: string[]) => {
    if (controlled === undefined) setUncontrolled(next);
    onChange?.(next, pathNodes(options, next));
  };

  /**
   * Moves the browsing path, focusing the destination BEFORE the state changes.
   *
   * The target is always already mounted, and that is a property of the shape
   * rather than a coincidence: every caller moves within `columns[focusCol]`,
   * one level shallower, or into `columns[focusCol + 1]` — and that column
   * exists exactly when the focused node has children, which is the only case
   * the move is offered in. So the lookup cannot miss.
   *
   * Focusing first is what keeps focus off <body>. Going shallower drops a
   * column, and React removing the node focus is on leaves the document body
   * focused — `pushDismissable` listens on `focusin`, so the layer does not
   * dismiss, but the next Tab restarts at the top of the page. Doing it from an
   * effect instead would still land in the right place, one frame later and
   * with that gap in between.
   */
  const movePath = (next: string[]) => {
    const key = next.at(-1);
    const target = key === undefined ? null : document.getElementById(itemId(next.length - 1, key));
    if (target) focusItem(target);
    setActive(next);
  };

  /** A click or an Enter on an item: descend, and commit if this level counts. */
  const choose = (depth: number, node: TreeNode) => {
    if (node.disabled) return;
    const next = [...path.slice(0, depth), node.key];
    const branch = hasChildren(node);
    movePath(next);
    if (branch && !changeOnSelect) return;
    // Re-picking the path already held must not empty it. `Tree` reads a second
    // click as a deselect, and a control that clears when you confirm your own
    // choice is a trap — so this commits only on a change, and closes either way.
    if (!samePath(next, value)) commit(next);
    if (branch) return;
    anchored.setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onContentKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Escape and Tab are deliberately absent. `pushDismissable` answers Escape
    // in the capture phase and has already called back; `role: "listbox"` gives
    // the layer `focus: true`, so focus leaving it closes it. Handling either
    // here fires `onOpenChange` twice for one press.
    const column = columns[focusCol];
    if (!column) return;
    // `focusKey`, not `path[focusCol]`. With nothing browsed yet the path is
    // empty while the tab stop sits on column 0's first enabled option — so
    // reading the path would hand `navigate` a null current, and ArrowDown
    // would return that same first item instead of the second.
    const current = focusKey;

    // Read off the DOM, never from a prop: `dir` is inherited from an ancestor
    // and the browser has already resolved it.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const deeper = rtl ? "ArrowLeft" : "ArrowRight";
    const shallower = rtl ? "ArrowRight" : "ArrowLeft";

    if (event.key === deeper) {
      // The next column exists if and only if the focused node has children, so
      // there is no separate check to keep in step with `hasChildren`.
      const child = columns[focusCol + 1]?.find(node => !node.disabled);
      if (!child) return;
      event.preventDefault();
      movePath([...path, child.key]);
      return;
    }
    if (event.key === shallower) {
      if (path.length <= 1) return;
      event.preventDefault();
      movePath(path.slice(0, -1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const node = column.find(candidate => candidate.key === current);
      if (!node) return;
      event.preventDefault();
      choose(focusCol, node);
      return;
    }

    // Built inside the handler so nothing allocates per render. Skipping
    // disabled items, wrapping and typeahead are all core's, and tested there.
    const result = navigate(
      event,
      createCollection(
        column.map(node => ({
          value: node.key,
          label: typeof node.title === "string" ? node.title : node.key,
          disabled: node.disabled,
        }))
      ),
      current,
      { orientation: "vertical", typeahead: true },
      typeahead
    );
    if (!result.handled) return;
    event.preventDefault();
    if (result.value !== undefined) movePath([...path.slice(0, focusCol), result.value]);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // ArrowDown only. A <button> already synthesises a click for Enter and
    // Space, which reaches AnchoredView's wrapper onClick and toggles — adding
    // them here would toggle twice.
    if (disabled || event.key !== "ArrowDown") return;
    event.preventDefault();
    handOverRef.current = true;
    if (!anchored.open) anchored.setOpen(true);
    else {
      const item = focusKey === null ? null : document.getElementById(itemId(focusCol, focusKey));
      if (item) {
        focusItem(item);
        handOverRef.current = false;
      }
    }
  };

  // Three questions, three predicates, and none of them is the same fact.
  //
  // The label resolves the VALUE, never `active` — `active` moves while merely
  // browsing, and reading it here would relabel the trigger under a hover.
  // EMPTY is "the value names nothing this options array holds", so a value
  // that arrived before its options shows the placeholder rather than a blank
  // box. CLEARABLE is "the consumer is holding something", which is still true
  // of that unresolvable value — otherwise it could never be got rid of.
  const label = pathNodes(options, value).map(titleOf);
  const empty = label.length === 0;
  const showClear = allowClear && !disabled && value.length > 0;

  return (
    <AnchoredView
      anchored={anchored}
      arrow={false}
      className={className}
      triggerPart="control"
      // No role on the wrapper. A container announcing `listbox` with zero
      // options in it, while the real listboxes sit inside it, is two claims
      // about one popup that disagree. The columns are the widgets, and this
      // element is also the flex row they lay out in.
      contentProps={{ role: undefined, onKeyDown: onContentKeyDown }}
      body={columns.map((column, depth) => (
        <div
          key={depth}
          data-scope="cascader"
          data-part="column"
          data-depth={String(depth)}
          role="listbox"
          // Column 0 is the control's own list; every deeper one is named by the
          // option it descends from — "Zhejiang" names the column of Zhejiang's
          // children, which is exact and needs no new locale key.
          aria-label={depth === 0 ? ariaLabel : undefined}
          aria-labelledby={depth === 0 ? undefined : itemId(depth - 1, path[depth - 1]!)}
        >
          {column.map(node => {
            // Two different facts. `data-active` is "the column beside me holds
            // my children, and the keyboard is here" and needs no ancestry
            // guard: column `depth` is BY CONSTRUCTION the children of
            // `path[depth-1]`, so its prefix always matches.
            const isActive = path[depth] === node.key;
            // `data-selected` does need one, and asymmetrically. While browsing
            // branch `b`, column 1 holds b's children — and a committed value of
            // ["a", "other"] would paint b's own "other" as chosen without it.
            const isSelected = agree >= depth && value[depth] === node.key;
            return (
              <div
                // Safe to key on the key alone HERE, because a column is one
                // level and a key is unique among siblings. The place that is
                // not safe is the hidden inputs below, which walk a path.
                key={node.key}
                id={itemId(depth, node.key)}
                data-scope="cascader"
                data-part="item"
                data-active={dataAttr(isActive)}
                data-selected={dataAttr(isSelected)}
                data-disabled={dataAttr(node.disabled)}
                role="option"
                // A tri-state the `option` role requires, so a literal string on
                // both branches: `false` means "selectable, not selected", which
                // is a different statement from absent. Deliberately NOT dataAttr.
                aria-selected={isSelected ? "true" : "false"}
                aria-disabled={node.disabled ? "true" : undefined}
                // Roving, so the whole popup is one tab stop. Real focus rather
                // than `aria-activedescendant`: that is only interpreted on the
                // focused element, and the only element that could hold focus
                // across every column is the roleless content div — putting it
                // there would be a composite-widget claim on a container that is
                // not one.
                tabIndex={depth === focusCol && node.key === focusKey ? 0 : -1}
                onClick={() => choose(depth, node)}
                // `onPointerMove`, not enter: enter fires when the element under
                // a STATIONARY cursor changes, which is what a keyboard move
                // re-rendering the columns does — so arrowing would yank the
                // path back to whatever the mouse happens to sit over. Attached
                // only under hover-expand, so the default cannot expand on hover
                // at all.
                onPointerMove={
                  expandTrigger === "hover" && !node.disabled
                    ? () => {
                        // Moves `active` and nothing else. `commit` is reachable
                        // only from `choose`, which runs on click and on Enter.
                        if (path[depth] !== node.key)
                          setActive([...path.slice(0, depth), node.key]);
                      }
                    : undefined
                }
              >
                <span data-scope="cascader" data-part="item-text">
                  {titleOf(node)}
                </span>
                {/* Rendered even for a leaf, so titles line up across a column —
                    the same width `tree.css` reserves for the expander. No scope
                    or part reaches the Icon: `icon.css` keys every bit of icon
                    presentation off `[data-scope="icon"]` alone, and Icon
                    spreads rest last, so overriding it renders an unsized black
                    SVG. */}
                <span data-scope="cascader" data-part="item-indicator">
                  {hasChildren(node) && <Icon name="chevronRight" size="sm" />}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    >
      <button
        ref={setTrigger}
        type="button"
        data-scope="cascader"
        data-part="trigger"
        // Enums, not booleans: they go out raw so `undefined` omits the
        // attribute. Through `dataAttr` they would collapse to "".
        data-size={size}
        data-status={status}
        data-disabled={dataAttr(disabled)}
        data-empty={dataAttr(empty)}
        id={id}
        disabled={disabled}
        // The button carries its own ARIA rather than relying on AnchoredView's
        // clone: `withAria` only clones when `isValidElement(children)`, and the
        // trigger here is a button PLUS a clear button PLUS hidden inputs, so
        // children is an array and the clone is a no-op. Identical values, so if
        // someone later reduces this to one child it degrades safely.
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={anchored.open ? "true" : "false"}
        aria-controls={anchored.open ? anchored.contentId : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={status === "error" || ariaInvalid ? true : undefined}
        onKeyDown={onTriggerKeyDown}
        onBlur={onBlur}
      >
        {empty ? (
          <span data-scope="cascader" data-part="placeholder">
            {placeholder ?? locale.Select.placeholder}
          </span>
        ) : (
          // One span, so `text-overflow: ellipsis` has a single box to work on.
          <span data-scope="cascader" data-part="value-text">
            {label.map((title, i) => (
              <span key={i}>
                {i > 0 && separator}
                {title}
              </span>
            ))}
          </span>
        )}
        <span
          data-scope="cascader"
          data-part="indicator"
          data-state={anchored.open ? "open" : "closed"}
        >
          <Icon name="chevronDown" size="sm" />
        </span>
      </button>
      {/* `name` on a `type="button"` is never submitted. One hidden input per
          segment, so the field arrives as a list rather than as something the
          server has to split — and keyed by INDEX, because a path may repeat a
          segment and React would drop the duplicate. */}
      {name !== undefined &&
        value.map((key, i) => <input key={i} type="hidden" name={name} value={key} />)}
      {showClear && (
        <button
          type="button"
          data-scope="cascader"
          data-part="clear"
          aria-label={locale.DatePicker.clear}
          onClick={event => {
            // The trigger wrapper owns the click listener, so without this the
            // clear opens the popup on its way out.
            event.stopPropagation();
            commit([]);
            setActive([]);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </AnchoredView>
  );
}
