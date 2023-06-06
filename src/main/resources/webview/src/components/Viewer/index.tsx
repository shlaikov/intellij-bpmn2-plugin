import { useState, useEffect, useRef } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

import ZoomBar from "../ZoomBar";
import ErrorBar, { EventError } from "../ErrorBar";

interface Props {
  xml: string;
}

function BPMNViewer({ xml }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnModelerRef = useRef<NavigatedViewer | null>(null);

  const [error, setError] = useState<EventError | null>(null);

  const importDiagram = (xml: string) => {
    bpmnModelerRef.current?.importXML(xml);
  };

  const zoomOut = (): void => {
    bpmnModelerRef.current?.get("zoomScroll").stepZoom(-1);
  };

  const zoomIn = (): void => {
    bpmnModelerRef.current?.get("zoomScroll").stepZoom(1);
  };

  const zoomReset = (): void => {
    bpmnModelerRef.current?.get("canvas").zoom("fit-viewport");
  };

  useEffect(() => {
    bpmnModelerRef.current = new NavigatedViewer({
      container: containerRef.current,
    });

    if (!error && xml) {
      importDiagram(xml);
    }

    bpmnModelerRef.current.on("import.done", (event: { error: EventError }) => {
      setError(null);

      if (event.error) {
        setError(event.error);
      }

      zoomReset();
    });

    return () => {
      bpmnModelerRef.current?.destroy();
    };
  });

  return (
    <>
      <ErrorBar error={error} />
      <ZoomBar zoomOut={zoomOut} zoomIn={zoomIn} zoomReset={zoomReset} />

      <div ref={containerRef} style={{ height: "100%" }} />
    </>
  );
}

export default BPMNViewer;
