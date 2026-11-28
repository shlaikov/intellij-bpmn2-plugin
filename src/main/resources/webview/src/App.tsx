import DiagramView from "./components/DiagramView";
import DiffView, { DiffSide } from "./components/DiffView";
import Message from "./components/Message";
import { hosted, InitialData, initialData, notifyReady } from "./host/bridge";
import { isDiagramKind } from "./formats";
import { exampleBpmn, exampleBpmnBefore, exampleDmn, exampleDmnBefore } from "./utils/exampleDiagram";
import { isTheme, ThemeType } from "./utils/theme";

/**
 * Without a host (`yarn dev`) show a sample; `?kind=dmn&theme=dark` picks which one and how.
 * `?diff` compares it with an earlier version of itself, `?diff=added` and `?diff=broken` with nothing and
 * with a file that is not a diagram.
 */
function devData(): InitialData {
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind") ?? "bpmn";
  const theme = params.get("theme");
  const [before, file] = kind === "dmn" ? [exampleDmnBefore, exampleDmn] : [exampleBpmnBefore, exampleBpmn];

  if (!params.has("diff")) {
    return { kind, file, theme };
  }

  const left = { added: null, broken: "<definitions" }[params.get("diff") ?? ""];

  return {
    kind,
    theme,
    diff: { left: left === undefined ? before : left, leftTitle: "HEAD", right: file, rightTitle: "Your version" },
  };
}

function diffSides(diff: unknown): [DiffSide, DiffSide] | null {
  if (typeof diff !== "object" || diff === null) {
    return null;
  }

  const { left, leftTitle, right, rightTitle } = diff as Record<string, unknown>;

  const side = (xml: unknown, title: unknown): DiffSide => ({
    xml: typeof xml === "string" ? xml : null,
    title: typeof title === "string" ? title : "",
  });

  return [side(left, leftTitle), side(right, rightTitle)];
}

const { kind, file, diff, theme: hostTheme } = import.meta.env.DEV && !hosted ? devData() : initialData();
const theme = isTheme(hostTheme) ? hostTheme : ThemeType.Light;
const sides = diffSides(diff);

function App() {
  if (isDiagramKind(kind) && sides) {
    return <DiffView kind={kind} theme={theme} left={sides[0]} right={sides[1]} />;
  }

  if (!isDiagramKind(kind) || typeof file !== "string") {
    notifyReady();

    return (
      <div className={`io-diagram-view theme-${theme}`}>
        <Message text="Unsupported file format" />
      </div>
    );
  }

  return <DiagramView kind={kind} xml={file} theme={theme} />;
}

export default App;
