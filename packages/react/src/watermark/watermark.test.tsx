import { createRef, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Watermark } from "./watermark";

/**
 * The adapter's whole job is the root and the effect wiring — the raster, the
 * tile arithmetic and the restore loop are core's, and are tested there once.
 *
 * jsdom has no canvas, no layout and no `pointer-events`, so what the overlay
 * LOOKS like cannot be asserted here at all. What can: that the overlay exists
 * and is core's rather than JSX, that it is created once and removed on unmount
 * under StrictMode's double invocation, and that a re-render with fresh array
 * props does not redraw. Coverage, clicks and stacking are in
 * apps/e2e/specs/watermark.spec.ts.
 */
const root = () =>
  document.querySelector<HTMLElement>('[data-scope="watermark"][data-part="root"]');
const overlay = () =>
  document.querySelectorAll<HTMLElement>('[data-scope="watermark"][data-part="overlay"]');

describe("Watermark", () => {
  it("renders a root carrying the scope and part", () => {
    render(<Watermark content="Confidential" />);
    expect(root()).toBeInTheDocument();
  });

  it("renders its children inside the root", () => {
    render(
      <Watermark content="Confidential">
        <p>protected</p>
      </Watermark>
    );
    expect(root()!.contains(screen.getByText("protected"))).toBe(true);
  });

  it("keeps a consumer's class on the root untouched", () => {
    render(<Watermark content="x" className="card" />);
    expect(root()).toHaveClass("card");
  });

  it("spreads consumer attributes last, so one of ours can be overridden", () => {
    // `id` and `style` alone cannot fail: the component never sets either, so
    // they land on the root whichever side of `{...rest}` the spread is on. The
    // only representative where "last" and "first" DIFFER is an attribute the
    // component writes itself — a composing component stamping its own
    // `data-part` on this root is exactly the case the rule exists for.
    render(<Watermark content="x" id="wm" data-part="host" style={{ inlineSize: 300 }} />);
    const node = document.querySelector<HTMLElement>('[data-scope="watermark"][data-part="host"]');
    expect(node).not.toBeNull();
    expect(node).toHaveAttribute("id", "wm");
    expect(node!.style.inlineSize).toBe("300px");
  });

  it("forwards the root to a consumer's ref, in both shapes", () => {
    const object = createRef<HTMLDivElement>();
    const view = render(<Watermark content="x" ref={object} />);
    expect(object.current).toBe(root());
    view.unmount();

    const calls: (HTMLDivElement | null)[] = [];
    render(
      <Watermark
        content="x"
        ref={node => {
          calls.push(node);
        }}
      />
    );
    // Both branches, because the root also has to reach the controller: the
    // component keeps its own `rootRef` alongside whatever the consumer passed,
    // and a forwarding that replaced rather than duplicated it would leave
    // `createWatermarkOverlay` with null.
    expect(calls[0]).toBe(root());
    expect(overlay()).toHaveLength(1);
  });

  it("carries no state or boolean attributes at all", () => {
    // Worth asserting rather than leaving as an absence: the review reflex here
    // is to look for `dataAttr`, and this is the one component with nothing
    // tri-state or transient on it. A raw boolean would render `="false"`,
    // which matches `[data-…]` in CSS.
    render(<Watermark content="x" />);
    expect(
      root()!
        .getAttributeNames()
        .filter(n => n.startsWith("data-"))
    ).toEqual(["data-scope", "data-part"]);
    expect(root()!.outerHTML).not.toContain('="false"');
  });

  it("adds an overlay React did not render", () => {
    render(<Watermark content="x" />);
    expect(overlay()).toHaveLength(1);
    expect(overlay()[0]).toHaveAttribute("aria-hidden", "true");
    // Appended after the children, because the reconciler must never find a
    // node in its own child list that it did not put there.
    expect(root()!.lastElementChild).toBe(overlay()[0]);
  });

  it("leaves exactly one overlay under StrictMode's double invocation", () => {
    // StrictMode runs create/destroy/create, and the playgrounds all run under
    // it. A destroy that is not idempotent leaves two overlays stacked, which
    // doubles the ink and looks like a CSS bug.
    render(
      <StrictMode>
        <Watermark content="x" />
      </StrictMode>
    );
    expect(overlay()).toHaveLength(1);
  });

  it("tears the controller down on unmount, not just the subtree React owns", async () => {
    const view = render(<Watermark content="x" />);
    const node = root()!;
    expect(overlay()).toHaveLength(1);

    view.unmount();

    // Asserted against the DETACHED root rather than against `document`:
    // React takes the whole subtree out either way, so a document-wide count
    // is zero even on a build whose cleanup never calls `destroy()`. What the
    // root it left behind still contains is the only thing that separates them.
    expect(node.querySelector('[data-part="overlay"]')).toBeNull();

    // And the observer is genuinely released. A MutationObserver keeps firing
    // on a node that has left the document, so a controller that was never
    // destroyed answers this attribute change by writing the overlay straight
    // back in — leaking the observer, and with it the root and its raster.
    node.setAttribute("data-probe", "");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(node.querySelector('[data-part="overlay"]')).toBeNull();
  });

  it("does not redraw when a re-render only changes array identity", () => {
    // Every render hands `gap` and `content` fresh objects. A dependency array
    // over them would redraw the canvas on every parent render; omitting them
    // would go stale, which on a per-user mark means the previous user's name.
    // The guard is core's value comparison, and this is the adapter half of it:
    // the update effect runs on every commit, so the no-op has to be real.
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const view = render(<Watermark content={["a", "b"]} gap={[10, 10]} />);
    const drawn = getContext.mock.calls.length;
    expect(drawn).toBeGreaterThan(0);

    view.rerender(<Watermark content={["a", "b"]} gap={[10, 10]} />);
    expect(getContext.mock.calls.length).toBe(drawn);

    view.rerender(<Watermark content={["a", "c"]} gap={[10, 10]} />);
    expect(getContext.mock.calls.length).toBeGreaterThan(drawn);
    getContext.mockRestore();
  });
});
