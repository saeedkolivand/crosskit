import { StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "@crosskit-ui/styles";
import { Button, Upload, type UploadFile } from "@crosskit-ui/react";

/** A 2×1 red PNG, so the thumbnail has a real, non-square image to crop. */
const WIDE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

const entry = (over: Partial<UploadFile> & { uid: string }): UploadFile => ({
  name: `${over.uid}.png`,
  size: 1024,
  type: "image/png",
  status: "done",
  percent: 100,
  ...over,
});

function Harness() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 32, justifyItems: "start" }}>
      {/* Two percentages in one render. One point cannot tell
          `calc(var(--ck-upload-progress) * 1%)` from a hard-coded width. */}
      <div id="progress" style={{ inlineSize: 340 }}>
        <Upload
          fileList={[
            entry({ uid: "empty", status: "uploading", percent: 0 }),
            entry({ uid: "part", status: "uploading", percent: 40 }),
          ]}
        >
          <Button>Select</Button>
        </Upload>
      </div>

      {/* A failed row beside a finished one: both hover rules are (0,3,0), so
          only the `:not([data-state="error"])` guard separates them. */}
      <div id="states" style={{ inlineSize: 340 }}>
        <Upload
          fileList={[
            entry({ uid: "ok", status: "done" }),
            entry({ uid: "bad", status: "error", percent: 55 }),
          ]}
        >
          <Button>Select</Button>
        </Upload>
      </div>

      {/* Truncation needs the ellipsis triple AND `overflow: hidden` — which is
          also what lets a flex child shrink below its own content, since the
          automatic minimum size only applies while `overflow` is `visible`.
          Without it the row grows past this 260px container instead. */}
      <div id="truncate" style={{ inlineSize: 260 }}>
        <Upload
          fileList={[
            entry({
              uid: "long",
              name: "a-quite-unreasonably-long-file-name-that-has-to-be-truncated-somewhere.png",
            }),
          ]}
        >
          <Button>Select</Button>
        </Upload>
      </div>

      {/* `aspect-ratio: 1` + `object-fit: cover` on a 2:1 source. */}
      <div id="picture" style={{ inlineSize: 340 }}>
        <Upload listType="picture" fileList={[entry({ uid: "shot", thumbUrl: WIDE_PNG })]}>
          <Button>Select</Button>
        </Upload>
      </div>

      {/* Uncontrolled, because the drop has to actually add a row. */}
      <div id="dragger" style={{ inlineSize: 340 }}>
        <Upload.Dragger>
          <p>Drop a file here</p>
        </Upload.Dragger>
      </div>

      {/* The drop highlight against the pointer's own hover. `--ck-accent-border`
          is overridden here because the LIGHT theme points it at the same colour
          as `--ck-accent-solid`, and two rules painting the same colour cannot
          be told apart — the dark theme already gives them different values, so
          this is a real configuration rather than a contrivance. */}
      <div
        id="dragover-guard"
        style={{ inlineSize: 340, "--ck-accent-border": "rgb(0, 128, 0)" } as CSSProperties}
      >
        <Upload.Dragger>
          <p>Drop a file here</p>
        </Upload.Dragger>
      </div>

      {/* The whole `[data-disabled]` paint surface, which nothing else here
          renders: the dimmed root, the refusing cursors, and the per-row
          controls whose hover rules are written `:not([data-disabled])`. */}
      <div id="disabled" style={{ inlineSize: 340 }}>
        <Upload disabled fileList={[entry({ uid: "bad", status: "error", percent: 55 })]}>
          <Button>Select</Button>
        </Upload>
        <Upload.Dragger disabled>
          <p>Drop a file here</p>
        </Upload.Dragger>
      </div>

      <div id="layered" style={{ inlineSize: 340 }}>
        <Upload className="consumer-override">
          <Button>Select</Button>
        </Upload>
      </div>

      {/* The root part on an UNKNOWN element, which is the shape an Angular
          adapter's root takes. A `<div>` computes `display: block` whatever the
          stylesheet says, so asserting it on the real component is an assertion
          that cannot fail; a custom element defaults to `inline`, so here the
          stated `display: block` is the only thing that can produce it. */}
      <div id="custom-element-root">
        {/* @ts-expect-error — an unknown element, on purpose. */}
        <ck-upload-shim data-scope="upload" data-part="root">
          shim
          {/* @ts-expect-error — closing the same unknown element. */}
        </ck-upload-shim>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);
