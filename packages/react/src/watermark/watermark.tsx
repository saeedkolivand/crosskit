"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode, type Ref } from "react";
import {
  createWatermarkOverlay,
  type WatermarkFont,
  type WatermarkOptions,
  type WatermarkOverlay,
} from "@crosskit-ui/core";

export interface WatermarkProps
  // `HTMLAttributes` already declares the global `content` attribute as
  // `string`, and without the omit our `string | string[]` intersects with it
  // down to `string` — so `content={["a", "b"]}` stops compiling, with an error
  // that points at the call site rather than at this line.
  extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  // Spelled out rather than extending core's `WatermarkOptions`, because every
  // adapter declares its own props in its own idiom and the docs registry is
  // validated against these declarations. What keeps the two in step is that
  // the whole set is handed to `update`, which takes `WatermarkOptions` — a
  // name or a type that drifts fails to compile there.
  /** The mark, one entry per line. */
  content?: string | string[];
  /** URL or data URI. Wins over `content`, which stays the fallback if it fails to load. */
  image?: string;
  /** One mark's cell in px. Measured when omitted for text; 120 for an image. */
  width?: number;
  /** Lines x line-height when omitted for text; 64 for an image. */
  height?: number;
  /** Degrees, clockwise. Default -22. */
  rotate?: number;
  /** Default 9. A child with a higher `z-index` paints above the mark. */
  zIndex?: number;
  /** `[x, y]` px between marks. Default `[100, 100]`. */
  gap?: [number, number];
  /** `[x, y]` px shift of the whole pattern. Defaults to half the gap. */
  offset?: [number, number];
  font?: WatermarkFont;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A repeating mark drawn over its children, which resists being removed.
 *
 * React renders the root and nothing else. The overlay is created, written and
 * repaired by `createWatermarkOverlay` in `@crosskit-ui/core`, and is never
 * JSX: it has to survive deletions React knows nothing about, and a node React
 * believes it owns is one the reconciler will fight the observer over — an
 * `insertBefore` against a child list that moved under it throws
 * `NotFoundError`. So React owns the root and the children, core owns the
 * overlay, and paint order comes from `z-index` rather than from DOM order.
 *
 * Nothing here touches `document` during render, so SSR and hydration see the
 * same root the server sent and the overlay simply appears in an effect.
 */
export function Watermark({
  content,
  image,
  width,
  height,
  rotate,
  zIndex,
  gap,
  offset,
  font,
  children,
  className,
  ref,
  ...rest
}: WatermarkProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<WatermarkOverlay | null>(null);

  const setRoot = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  // Created once, and torn down idempotently because StrictMode runs
  // create/destroy/create. Recreating it per prop change would restart the
  // image load and leave a gap in a mark whose whole purpose is to have none.
  useEffect(() => {
    const overlay = createWatermarkOverlay(rootRef.current!);
    overlayRef.current = overlay;
    return () => {
      overlay.destroy();
      overlayRef.current = null;
    };
  }, []);

  // No dependency array, deliberately. `gap`, `offset` and a `content` array are
  // fresh objects on every render, so a list over them redraws on every parent
  // render and a list without them goes stale — which on a per-user watermark
  // means showing the previous user's name. `update` compares option VALUES in
  // core and returns early when nothing moved, so this costs one comparison per
  // commit and every adapter gets the same guard.
  useEffect(() => {
    // Annotated, not inferred: this is the line that fails to compile if a prop
    // above drifts from the option core actually reads.
    const options: WatermarkOptions = {
      content,
      image,
      width,
      height,
      rotate,
      zIndex,
      gap,
      offset,
      font,
    };
    overlayRef.current?.update(options);
  });

  return (
    <div ref={setRoot} data-scope="watermark" data-part="root" className={className} {...rest}>
      {children}
    </div>
  );
}
