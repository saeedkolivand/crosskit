import type { Meta, StoryObj } from "@storybook/react-vite";
import { Cascader } from "@crosskit-ui/react";
import type { TreeNode } from "@crosskit-ui/core";

const meta = { title: "Components/Cascader", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj;

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
      { key: "suzhou", title: "Suzhou", disabled: true },
    ],
  },
];

const row = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "start" } as const;

export const Basics: Story = {
  render: () => (
    <div style={row}>
      <div style={{ inlineSize: 240 }}>
        <Cascader options={OPTIONS} aria-label="Place" />
      </div>
      <div style={{ inlineSize: 240 }}>
        <Cascader options={OPTIONS} defaultValue={["zhejiang", "hangzhou", "xihu"]} />
      </div>
      {/* Reports every level as it is chosen, not only a leaf — so a branch is
          a valid answer and the popup stays up to allow a deeper one. */}
      <div style={{ inlineSize: 240 }}>
        <Cascader options={OPTIONS} changeOnSelect separator=" › " />
      </div>
      {/* Hover opens the next COLUMN; it never commits. Only a click or Enter
          does that. */}
      <div style={{ inlineSize: 240 }}>
        <Cascader options={OPTIONS} expandTrigger="hover" />
      </div>
    </div>
  ),
};

export const SizesAndStatus: Story = {
  render: () => (
    <div style={row}>
      <div style={{ inlineSize: 200 }}>
        <Cascader options={OPTIONS} size="small" placeholder="Small" />
      </div>
      <div style={{ inlineSize: 200 }}>
        <Cascader options={OPTIONS} placeholder="Middle" />
      </div>
      <div style={{ inlineSize: 200 }}>
        <Cascader options={OPTIONS} size="large" placeholder="Large" />
      </div>
      <div style={{ inlineSize: 200 }}>
        <Cascader options={OPTIONS} status="error" placeholder="Error" />
      </div>
      <div style={{ inlineSize: 200 }}>
        <Cascader options={OPTIONS} disabled defaultValue={["zhejiang", "ningbo"]} />
      </div>
    </div>
  ),
};
