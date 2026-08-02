import "@testing-library/jest-dom/vitest";

// jsdom ships no ResizeObserver, and Floating UI's autoUpdate constructs one the
// moment any popper-positioned part (Select, Menu, Tooltip) opens.
// ponytail: a no-op stub is enough — jsdom reports zero dimensions anyway, so
// there is nothing real to observe. Positioning itself is Playwright's job.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Same story for scrolling: jsdom implements neither, and zag calls both to keep
// the highlighted option in view. Left unstubbed they throw mid-interaction and
// take the whole event down with them.
Element.prototype.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// And for pointer capture, which jsdom 30 does not implement either — verified
// undefined rather than merely a no-op. Splitter's bar calls it on pointerdown
// so a drag that leaves the ~8px bar keeps tracking; unstubbed it throws a
// TypeError and takes the whole handler down before the drag ever starts. The
// stub belongs here rather than an optional chain in shipped code: the platform
// API is not optional in a browser, and guarding it there would hide a real
// failure behind a silent no-op.
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
