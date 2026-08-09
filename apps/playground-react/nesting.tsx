import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@crosskit-ui/styles";
import {
  Alert,
  Button,
  Card,
  Cascader,
  Descriptions,
  Empty,
  List,
  Result,
  Skeleton,
  Splitter,
  Statistic,
  Steps,
  Upload,
  Watermark,
} from "@crosskit-ui/react";

/**
 * One pairing, rendered inside its container and loose beside it.
 *
 * The comparison is the assertion: an absolute expectation only says what
 * today renders, while the pair says whether the container changed anything.
 */
function Pair({
  id,
  container,
  children,
}: {
  id: string;
  container: (c: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 8, inlineSize: 600 }}>
      <div id={`${id}-in`}>{container(children)}</div>
      <div id={`${id}-out`}>{children}</div>
    </div>
  );
}

const STEPS = [{ title: "One", description: "First" }, { title: "Two" }];
const ROWS = [
  { id: "a", name: "Row A" },
  { id: "b", name: "Row B" },
];
const CASCADE = [{ key: "a", title: "A", children: [{ key: "a1", title: "A1" }] }];
// Seeded rather than picked: a row has to exist for the list parts to render,
// and a nesting harness cannot open a file dialog.
const FILES = [
  { uid: "1", name: "a.txt", size: 3, type: "text/plain", status: "done" as const, percent: 100 },
];

function Harness() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 32 }}>
      {/* Not a nesting: a Button rendered as *another component's part*. Rule 3
          spreads consumer attributes last, so the stamped
          `data-part="close-trigger"` replaces the button's own `root`, and any
          button rule requiring `[data-part="root"]` stops matching.

          No loose control beside it, deliberately. A Button outside an Alert
          sits in a different font context, so comparing the two measures
          inheritance rather than whether the rule matched — the spec asserts
          the glyph against its own `1em` instead. */}
      <div id="stamped-in">
        <Alert title="Heads up" dismissible onDismiss={() => {}}>
          Something happened
        </Alert>
      </div>

      <Pair id="card-list" container={c => <Card>{c}</Card>}>
        <List
          header="Head"
          footer="Foot"
          dataSource={ROWS}
          rowKey={r => r.id}
          renderItem={r => r.name}
        />
      </Pair>

      <Pair id="card-desc" container={c => <Card>{c}</Card>}>
        <Descriptions title="Profile" items={[{ label: "Name", children: "Ada" }]} />
      </Pair>

      <Pair
        id="result-stat"
        container={c => (
          <Result status="success" title="Done">
            {c}
          </Result>
        )}
      >
        <Statistic title="Users" value={42} />
      </Pair>

      <Pair id="alert-steps" container={c => <Alert title="Heads up">{c}</Alert>}>
        <Steps items={STEPS} current={0} />
      </Pair>

      <Pair id="skeleton-stat" container={c => <Skeleton.Node>{c}</Skeleton.Node>}>
        <Statistic title="Users" value={42} />
      </Pair>

      <Pair id="empty-list" container={c => <Empty>{c}</Empty>}>
        <List dataSource={ROWS} rowKey={r => r.id} renderItem={r => r.name} footer="Foot" />
      </Pair>

      <Pair id="button-result" container={c => <Button>{c}</Button>}>
        <Result status="info" title="t" />
      </Pair>

      {/* The four newest components, in both directions. Each was written by
          someone who knew only its own `data-part` vocabulary, and all four hold
          arbitrary consumer content — which is the pairing that makes a shared
          part name into a leak. */}

      <Pair
        id="splitter-list"
        container={c => (
          <Splitter>
            <Splitter.Panel>{c}</Splitter.Panel>
            <Splitter.Panel>b</Splitter.Panel>
          </Splitter>
        )}
      >
        <List
          header="Head"
          footer="Foot"
          dataSource={ROWS}
          rowKey={r => r.id}
          renderItem={r => r.name}
        />
      </Pair>

      <Pair id="watermark-desc" container={c => <Watermark content="draft">{c}</Watermark>}>
        <Descriptions title="Profile" items={[{ label: "Name", children: "Ada" }]} />
      </Pair>

      <Pair id="dragger-list" container={c => <Upload.Dragger>{c}</Upload.Dragger>}>
        <List dataSource={ROWS} rowKey={r => r.id} renderItem={r => r.name} footer="Foot" />
      </Pair>

      {/* The other direction: an old container holding a new component, so the
          new parts are the ones a foreign rule could reach. */}

      <Pair id="card-splitter" container={c => <Card>{c}</Card>}>
        <Splitter>
          <Splitter.Panel>a</Splitter.Panel>
          <Splitter.Panel>b</Splitter.Panel>
        </Splitter>
      </Pair>

      <Pair id="card-upload" container={c => <Card>{c}</Card>}>
        <Upload defaultFileList={FILES}>
          <Button>Pick</Button>
        </Upload>
      </Pair>

      <Pair id="card-cascader" container={c => <Card>{c}</Card>}>
        <Cascader options={CASCADE} defaultValue={["a", "a1"]} />
      </Pair>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
);
