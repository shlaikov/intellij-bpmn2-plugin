import { useEffect, useRef } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

interface Props {
  xml: string;
}

function BPMNViewer({ xml }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnModelerRef = useRef<NavigatedViewer | null>(null);

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

    if (xml) {
      importDiagram(xml);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bpmnModelerRef.current.on("import.done", (_event: unknown) => {
      zoomReset();
    });

    return () => {
      bpmnModelerRef.current?.destroy();
    };
  });

  return (
    <>
      <div className="io-zoom-controls">
        <ul className="io-zoom-reset io-control-list">
          <li>
            <div title="reset zoom" onClick={() => zoomReset()}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            </div>
          </li>
          <li>
            <hr />
          </li>
          <li>
            <div title="zoom in" onClick={() => zoomIn()}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </li>
          <li>
            <hr />
          </li>
          <li>
            <div title="zoom out" onClick={() => zoomOut()}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </li>
        </ul>
      </div>

      <div ref={containerRef} style={{ height: "100%" }} />
    </>
  );
}

export default BPMNViewer;
