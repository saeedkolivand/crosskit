"use client";

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import {
  ariaAttr,
  dataAttr,
  panelBounds,
  parsePanelSize,
  resizePanels,
  resolvePanelSizes,
  splitterKey,
  type SplitterConstraint,
} from "@crosskit-ui/core";

export type SplitterLayout = "horizontal" | "vertical";

/**
 * `onResize` is omitted from the DOM attributes rather than merely shadowed:
 * `HTMLAttributes` already declares one as a `ReactEventHandler`, and two
 * declarations of the same name resolve to the DOM one — so a consumer's
 * handler is typed to receive a `UIEvent` and every call site compiles while
 * meaning nothing. Slider omits `onChange` for the same reason.
 */
export interface SplitterProps extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
  layout?: SplitterLayout;
  /** Fires on every move, including during a drag. Sizes in px. */
  onResize?: (sizes: number[]) => void;
  /** Fires once, when the drag ends — the one to hang a network call on. */
  onResizeEnd?: (sizes: number[]) => void;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export interface SplitterPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Controlled. A number is px; a string is `"40%"` or `"200px"`. */
  size?: number | string;
  /** Uncontrolled starting size, same grammar. */
  defaultSize?: number | string;
  min?: number | string;
  max?: number | string;
  /** May be squashed to zero. `true` means from either side. */
  collapsible?: boolean | { start?: boolean; end?: boolean };
  /** `false` freezes both bars touching this panel. */
  resizable?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * What the parent worked out for one panel.
 *
 * A context rather than cloned props, so a consumer wrapping their panel in a
 * memo or a styled shell still gets the size — and so `SplitterPanel` renders
 * something sensible when it is used on its own.
 */
const PanelContext = createContext<{ percent: number; collapsed: boolean } | null>(null);

const collapseSides = (value: SplitterPanelProps["collapsible"]) =>
  value === true
    ? { start: true, end: true }
    : value && typeof value === "object"
      ? { start: value.start === true, end: value.end === true }
      : { start: false, end: false };

/**
 * The length the percentages divide: the panels' own main-axis sizes summed.
 *
 * `:scope >` and not a bare descendant query, because a nested Splitter's panels
 * are descendants of this root too — and counting them makes the reference
 * length roughly double, which no assertion on the outer layout would notice.
 */
const measure = (root: HTMLElement | null, layout: SplitterLayout): number => {
  if (!root) return 0;
  let total = 0;
  for (const panel of root.querySelectorAll<HTMLElement>(':scope > [data-part="panel"]')) {
    const box = panel.getBoundingClientRect();
    total += layout === "horizontal" ? box.width : box.height;
  }
  return total;
};

export function Splitter({
  layout = "horizontal",
  onResize,
  onResizeEnd,
  children,
  className,
  ref,
  ...rest
}: SplitterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<number[] | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const drag = useRef<{
    index: number;
    startSizes: number[];
    startCoord: number;
    rtl: boolean;
    length: number;
  } | null>(null);
  /** The size a panel had before Enter or a double-click closed it. */
  const remembered = useRef<number[]>([]);

  // Measured once, after mount. Nothing observes the container after that on
  // purpose: the percentages live in `flex-grow`, so flexbox re-divides a resize
  // by itself with no JavaScript at all. What this length is for is turning a
  // px-valued `size`/`min`/`max` prop into a percentage, and that is the one
  // thing a resize would invalidate — a documented limit rather than a reason to
  // put a ResizeObserver on every Splitter on the page.
  const [available, setAvailable] = useState(0);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<
    SplitterPanelProps,
    typeof SplitterPanel
  >[];

  useEffect(() => {
    setAvailable(measure(rootRef.current, layout));
  }, [layout, items.length]);

  // Read off the children's props in the same render that lays the bars out. A
  // registration effect would leave the first paint with no constraints at all,
  // so a panel with a `min` would render below it and then jump.
  const constraints: SplitterConstraint[] = items.map(item => ({
    min: parsePanelSize(item.props.min, available) ?? 0,
    max: parsePanelSize(item.props.max, available) ?? 100,
    resizable: item.props.resizable !== false,
    collapsible: collapseSides(item.props.collapsible),
  }));

  // Resolved on read, never synced by effect. A panel with `size` set is driven
  // by the prop on every render, one without falls back to what was dragged and
  // then to `defaultSize` — so there is no render in which state and props
  // disagree, and no effect to fire in the wrong order.
  const declared = items.map(
    (item, index) =>
      parsePanelSize(item.props.size, available) ??
      dragged?.[index] ??
      parsePanelSize(item.props.defaultSize, available)
  );
  const sizes = resolvePanelSizes(declared, constraints);

  const attach = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const pixels = (percents: number[]) => {
    const length = measure(rootRef.current, layout);
    return percents.map(percent => (percent / 100) * length);
  };

  const commit = (next: number[], end: boolean) => {
    // Element-wise, because dragging into a hard stop otherwise fires ~120
    // identical calls a second and a consumer writing localStorage in the
    // handler feels every one of them.
    const moved = next.some((value, index) => value !== sizes[index]);
    if (moved) {
      setDragged(next);
      onResize?.(pixels(next));
    }
    if (end) onResizeEnd?.(pixels(moved ? next : sizes));
  };

  const movable = (index: number) =>
    constraints[index]?.resizable !== false && constraints[index + 1]?.resizable !== false;

  const coordOf = (event: PointerEvent<HTMLElement>) =>
    layout === "horizontal" ? event.clientX : event.clientY;

  const onPointerDown = (index: number) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !movable(index)) return;
    const root = rootRef.current;
    const length = measure(root, layout);
    // A `display: none` splitter measures zero, and `delta / 0 * 100` is
    // Infinity — which reaches `flex-grow` as NaN and blanks the layout.
    if (!root || length <= 0) return;

    // Capture on the bar, so a drag that leaves it keeps tracking. The bar is
    // about 8px wide, so the pointer leaves it on the first move rather than
    // eventually; without this the drag dies immediately every time.
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      index,
      startSizes: sizes,
      startCoord: coordOf(event),
      // Read off the DOM rather than from a prop or a context: `dir` is
      // inherited from an arbitrary ancestor and the browser has already
      // resolved it, so a context value can disagree with the element that is
      // actually mirrored.
      rtl: getComputedStyle(root).direction === "rtl",
      length,
    };
    setActive(index);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    // Measured from the origin, never accumulated per move. Once a panel hits
    // its min an accumulated delta discards the surplus, so dragging back moves
    // the bar immediately instead of only after the pointer returns past the
    // boundary — the bar detaches from the pointer and never re-attaches.
    const travelled =
      layout === "horizontal" && state.rtl
        ? state.startCoord - coordOf(event)
        : coordOf(event) - state.startCoord;
    const delta = (travelled / state.length) * 100;
    commit(resizePanels(state.startSizes, state.index, delta, constraints), false);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setActive(null);
    // `pointercancel` as well as `pointerup`: the browser taking the gesture
    // over otherwise leaves the drag running forever.
    event.currentTarget.releasePointerCapture(event.pointerId);
    onResizeEnd?.(pixels(sizes));
  };

  /**
   * Enter and double-click, the two routes to collapse.
   *
   * Not a chevron inside the bar: `role="separator"` is in ARIA's
   * presentational-children list, so a button in there is dropped from the
   * accessibility tree entirely — visible to a mouse and invisible to everything
   * else, which is worse than not shipping it.
   */
  const toggleCollapse = (index: number) => {
    if (!movable(index)) return;
    const leading = sizes[index] ?? 0;
    const total = leading + (sizes[index + 1] ?? 0);
    const wanted = leading === 0 ? (remembered.current[index] ?? total / 2) : 0;
    if (leading !== 0) remembered.current[index] = leading;
    // Back through `resizePanels`, so a panel that may not collapse simply
    // stops at its floor rather than needing a second clamping path here.
    commit(resizePanels(sizes, index, wanted - leading, constraints), true);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (!movable(index)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      toggleCollapse(index);
      return;
    }
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const value = sizes[index] ?? 0;
    const next = splitterKey(event, value, panelBounds(sizes, index, constraints), { layout, rtl });
    if (next === undefined) return;
    // Only after the key turned out to be ours: Up and Down on a horizontal bar
    // must keep scrolling the page.
    event.preventDefault();
    // Fed back as a delta so collapse-snapping applies to the keyboard too, and
    // there is one clamping path rather than two that can drift apart.
    commit(resizePanels(sizes, index, next - value, constraints), true);
  };

  return (
    <div
      ref={attach}
      data-scope="splitter"
      data-part="root"
      data-orientation={layout}
      data-dragging={dataAttr(active !== null)}
      className={className}
      {...rest}
    >
      {items.map((item, index) => {
        const percent = sizes[index] ?? 0;
        const bar = index - 1;
        const bounds = index > 0 ? panelBounds(sizes, bar, constraints) : null;
        return (
          <Fragment key={item.key ?? index}>
            {bounds && (
              <div
                data-scope="splitter"
                data-part="bar"
                // The layout, not the separator's own orientation — every CSS
                // rule keys on this, and it deliberately says the opposite of
                // the `aria-orientation` beside it.
                data-orientation={layout}
                data-active={dataAttr(active === bar)}
                data-disabled={dataAttr(!movable(bar))}
                role="separator"
                // Still a tab stop when frozen would be a dead one; removed from
                // the tree entirely would lose the visual seam it also is.
                tabIndex={movable(bar) ? 0 : -1}
                // The PERPENDICULAR of the layout: a horizontal splitter — panels
                // side by side — has a vertical separator. `separator` defaults
                // to `horizontal`, so getting this backwards is silently wrong
                // rather than absent, which is why it is derived here once and
                // asserted in both layouts.
                aria-orientation={layout === "horizontal" ? "vertical" : "horizontal"}
                aria-valuenow={Math.round(sizes[bar] ?? 0)}
                aria-valuemin={Math.round(bounds.min)}
                aria-valuemax={Math.round(bounds.max)}
                aria-disabled={ariaAttr(!movable(bar))}
                onPointerDown={onPointerDown(bar)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => toggleCollapse(bar)}
                onKeyDown={onKeyDown(bar)}
              />
            )}
            <PanelContext.Provider value={{ percent, collapsed: percent === 0 }}>
              {item}
            </PanelContext.Provider>
          </Fragment>
        );
      })}
    </div>
  );
}

export function SplitterPanel({
  size: _size,
  defaultSize: _defaultSize,
  min: _min,
  max: _max,
  collapsible: _collapsible,
  resizable: _resizable,
  children,
  className,
  style,
  ref,
  ...rest
}: SplitterPanelProps) {
  const laid = useContext(PanelContext);
  return (
    <div
      ref={ref}
      // The scope goes on every part, not only the root: the reset's one rule is
      // `[data-scope][data-part]`, so a part carrying only `data-part` inherits
      // `content-box` and its border sits outside the size everything else was
      // computed from.
      data-scope="splitter"
      data-part="panel"
      data-collapsed={dataAttr(laid?.collapsed)}
      className={className}
      style={
        laid ? ({ ...style, "--ck-splitter-size": String(laid.percent) } as CSSProperties) : style
      }
      {...rest}
    >
      {children}
    </div>
  );
}

Splitter.Panel = SplitterPanel;
