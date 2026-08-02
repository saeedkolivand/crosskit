import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Watermark } from "@crosskit-ui/react";

const meta = {
  title: "Components/Watermark",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const page = {
  inlineSize: 460,
  blockSize: 240,
  padding: 16,
  border: "1px solid var(--ck-border)",
  borderRadius: 8,
} as const;

export const Basic: Story = {
  render: () => (
    <Watermark content="CrossKit" style={page}>
      <h3>Quarterly report</h3>
      <p>The mark tiles across the whole region, behind nothing and above everything in it.</p>
      {/* Here to be clicked: the overlay covers this button and must not take
          the click, which is the failure that makes a watermark unusable. */}
      <Button onClick={() => alert("the click got through")}>Try me</Button>
    </Watermark>
  ),
};

export const MultipleLines: Story = {
  render: () => (
    <Watermark content={["Ada Lovelace", "ada@example.com"]} style={page}>
      <p>An array is one line per entry, stacked about the centre of the mark.</p>
    </Watermark>
  ),
};

export const Styled: Story = {
  render: () => (
    <Watermark
      content="CONFIDENTIAL"
      rotate={-30}
      gap={[60, 60]}
      font={{ color: "rgba(220,38,38,0.25)", fontSize: 20, fontWeight: "bold" }}
      style={page}
    >
      <p>
        {/* "light" is not a CSS font-weight; core maps it to 300 rather than
            passing it through, because one invalid token makes canvas drop the
            entire font and silently draw 10px sans-serif. */}
        Colour, size, weight and angle are all props — the overlay itself is not styleable from CSS,
        because anything a stylesheet changes on it is restored.
      </p>
    </Watermark>
  ),
};

export const Tamperproof: Story = {
  render: () => (
    <Watermark content="Try deleting me" style={page}>
      <p>
        Open the inspector and delete the <code>[data-part=&quot;overlay&quot;]</code> node, or edit
        its style. It comes back. Resists accidental and casual removal — not a security boundary.
      </p>
    </Watermark>
  ),
};
