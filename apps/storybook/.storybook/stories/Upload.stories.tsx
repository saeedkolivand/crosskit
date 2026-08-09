import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Upload, type UploadFile } from "@crosskit-ui/react";

const meta = { title: "Components/Upload", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj;

const column = { display: "grid", gap: 32, maxInlineSize: 420 } as const;

const seeded = (over: Partial<UploadFile> & { uid: string }): UploadFile => ({
  name: `${over.uid}.png`,
  size: 24_576,
  type: "image/png",
  status: "done",
  percent: 100,
  ...over,
});

/**
 * With neither `action` nor `customRequest` the files are collected and never
 * sent — the "submit them with the form" mode, and the same terminal state
 * `beforeUpload: false` produces.
 */
export const Basics: Story = {
  render: () => (
    <div style={column}>
      <Upload multiple>
        <Button>Select files</Button>
      </Upload>
    </div>
  ),
};

/** Every state the row machine has, in one render. */
export const States: Story = {
  render: () => (
    <div style={column}>
      <Upload
        fileList={[
          seeded({ uid: "waiting", status: "selected", percent: 0 }),
          seeded({ uid: "sending", status: "uploading", percent: 40 }),
          seeded({ uid: "finished", url: "https://example.com/finished.png" }),
          seeded({ uid: "failed", status: "error", percent: 62 }),
        ]}
      >
        <Button>Select files</Button>
      </Upload>
    </div>
  ),
};

/**
 * The drop target. The highlight is held by a depth counter rather than a
 * boolean, because moving over the `<p>` inside fires a `dragleave` on the zone
 * that would otherwise clear it.
 */
export const Dragger: Story = {
  render: () => (
    <div style={column}>
      <Upload.Dragger multiple>
        <p style={{ margin: 0 }}>Drag files here, or click to browse</p>
      </Upload.Dragger>
    </div>
  ),
};

/** `listType="picture"` mints an object URL per file, and revokes it on remove. */
export const Picture: Story = {
  render: () => (
    <div style={column}>
      <Upload listType="picture" multiple accept="image/*">
        <Button>Select images</Button>
      </Upload>
    </div>
  ),
};

/**
 * A fake transport, so the bar actually moves without a server.
 *
 * Also the shape a controlled `fileList` takes: `onChange` fires on every tick,
 * and a controlled Upload that drops it never moves.
 */
export const Progress: Story = {
  render: function Render() {
    const [files, setFiles] = useState<UploadFile[]>([]);
    return (
      <div style={column}>
        <Upload
          fileList={files}
          onChange={info => setFiles(info.fileList)}
          multiple
          customRequest={({ onProgress, onSuccess, onError, file }) => {
            let percent = 0;
            const timer = setInterval(() => {
              percent += 20;
              if (percent < 100) return onProgress({ percent });
              clearInterval(timer);
              // Every third file fails, so the retry button is reachable.
              if (file.name.length % 3 === 0) onError(new Error("500"));
              else onSuccess({ ok: true });
            }, 300);
            return { abort: () => clearInterval(timer) };
          }}
        >
          <Button>Select files</Button>
        </Upload>
      </div>
    );
  },
};

/** `maxCount: 1` replaces rather than truncating, and drops `multiple` from the dialog. */
export const SingleFile: Story = {
  render: () => (
    <div style={column}>
      <Upload maxCount={1} accept=".png,.jpg">
        <Button>Replace avatar</Button>
      </Upload>
    </div>
  ),
};
