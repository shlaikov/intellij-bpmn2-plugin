import DiagramView from "./components/DiagramView";
import Message from "./components/Message";
import { hosted, InitialData, initialData, notifyReady } from "./host/bridge";
import { isDiagramKind } from "./renderers";
import { exampleBpmn, exampleDmn } from "./utils/exampleDiagram";
import { isTheme, ThemeType } from "./utils/theme";

/** Without a host (`yarn dev`) show a sample; `?kind=dmn&theme=dark` picks which one and how. */
function devData(): InitialData {
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind") ?? "bpmn";

  return { kind, file: kind === "dmn" ? exampleDmn : exampleBpmn, theme: params.get("theme") };
}

const { kind, file, theme: hostTheme } = import.meta.env.DEV && !hosted ? devData() : initialData();
const theme = isTheme(hostTheme) ? hostTheme : ThemeType.Light;

function App() {
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
