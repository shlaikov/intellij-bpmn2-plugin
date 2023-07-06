import { useState, useEffect } from "react";

import BPMNViewer from "./components/Viewer";
import { exampleDiagram } from "./utils/exampleDiagram";
import { ThemeType } from "./utils/theme";
import Host from "./utils/host";

(window as any).Host = new Host();

function App() {
  const { bpmn2Data = {} }: any = window;

  const [xml, setXML] = useState("");
  const [theme, setTheme] = useState<ThemeType>(bpmn2Data.theme);

  useEffect(() => {
    setTheme(bpmn2Data.theme);

    if (bpmn2Data.file) {
      setXML(bpmn2Data.file);
    } else if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
      setXML(exampleDiagram);
    }
  }, []);

  return <BPMNViewer xml={xml} theme={theme} />;
}

export default App;
