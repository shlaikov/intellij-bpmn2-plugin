import { useState, useEffect } from "react";

import BPMNViewer from "./components/BPMNViewer";
import { exampleDiagram } from "./utils/exampleDiagram";

function App() {
  const [xml, setXML] = useState("");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { bpmn2Data = {} }: any = window;

    if (bpmn2Data.file) {
      setXML(bpmn2Data.file);
    } else if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
      setXML(exampleDiagram);
    }
  }, []);

  return <BPMNViewer xml={xml} />;
}

export default App;
