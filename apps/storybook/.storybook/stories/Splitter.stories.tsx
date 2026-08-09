import type { Meta, StoryObj } from "@storybook/react-vite";
import { Splitter } from "@crosskit-ui/react";

const meta = {
  title: "Components/Splitter",
  component: Splitter,
  parameters: { layout: "padded" },
  argTypes: { layout: { control: "inline-radio", options: ["horizontal", "vertical"] } },
} satisfies Meta<typeof Splitter>;

export default meta;
type Story = StoryObj<typeof meta>;

const Pane = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 12, blockSize: "100%" }}>{children}</div>
);

/** A box with a height of its own, which is what a vertical splitter fills. */
const Box = ({ children, tall = false }: { children: React.ReactNode; tall?: boolean }) => (
  <div style={{ inlineSize: 520, blockSize: tall ? 260 : undefined }}>{children}</div>
);

export const Playground: Story = {
  args: { layout: "horizontal" },
  render: args => (
    <Box tall={args.layout === "vertical"}>
      <Splitter {...args}>
        <Splitter.Panel defaultSize="35%">
          <Pane>one</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>two</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};

/** Three panes and two bars: only the pair either side of a bar moves. */
export const Panes: Story = {
  render: () => (
    <Box>
      <Splitter>
        <Splitter.Panel>
          <Pane>one</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>two</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>three</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};

/**
 * `min` and `max` are a four-way bound: the pair's sum is fixed, so the second
 * panel's 60% ceiling stops the first at 40% before its own 20% floor is
 * anywhere near.
 */
export const Bounds: Story = {
  render: () => (
    <Box>
      <Splitter>
        <Splitter.Panel min="20%">
          <Pane>min 20%</Pane>
        </Splitter.Panel>
        <Splitter.Panel max="60%">
          <Pane>max 60%</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};

/**
 * Enter or a double-click on the bar closes the panel and reopens it at the
 * size it had. `collapsible` takes a side, because a panel that may close
 * inward but never outward is the ordinary case.
 */
export const Collapsible: Story = {
  render: () => (
    <Box>
      <Splitter>
        <Splitter.Panel min="20%" collapsible={{ start: true }}>
          <Pane>collapsible</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>fixed</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};

/** A vertical splitter fills a parent that has a height, and falls back to 12rem. */
export const Vertical: Story = {
  render: () => (
    <Box tall>
      <Splitter layout="vertical">
        <Splitter.Panel>
          <Pane>top</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>bottom</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};

/** `resizable={false}` freezes both bars touching the panel. */
export const Frozen: Story = {
  render: () => (
    <Box>
      <Splitter>
        <Splitter.Panel resizable={false}>
          <Pane>frozen</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>two</Pane>
        </Splitter.Panel>
        <Splitter.Panel>
          <Pane>three</Pane>
        </Splitter.Panel>
      </Splitter>
    </Box>
  ),
};
