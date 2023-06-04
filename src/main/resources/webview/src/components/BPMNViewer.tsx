import { useEffect, useRef } from "react";
import BpmnJS from "bpmn-js/lib/NavigatedViewer";

interface Props {
  xml: string;
}

function BPMNViewer({ xml }: Props) {
  const containerRef = useRef(null);

  const displayDiagram = (viewer: BpmnJS, diagramXML: string) => {
    viewer.importXML(diagramXML);
  };

  useEffect(() => {
    const container = containerRef.current;
    const bpmnViewer = new BpmnJS({ container });

    bpmnViewer.get("canvas").zoom("fit-viewport");

    displayDiagram(bpmnViewer, xml);

    return () => {
      bpmnViewer.destroy();
    };
  });

  return <div style={{ height: "100%" }} ref={containerRef} />;
}

export default BPMNViewer;
