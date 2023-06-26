import { useState, useEffect, useRef } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import BaseViewer from "bpmn-js/lib/BaseViewer";

import ZoomBar from "../ZoomBar";
import ErrorBar, { EventError } from "../ErrorBar";
import THEME, { ThemeType, ITheme, getBackgroundColor } from "../../utils/theme";

interface Props {
  xml: string;
  theme: ThemeType;
}

function BPMNViewer({ xml, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bpmnModelerRef = useRef<NavigatedViewer | null>(null);

  const [colorOptions, setColorOptions] = useState<ITheme>(theme === ThemeType.Light ? THEME.lightType : THEME.darkType);
  const [viewboxCache, setViewboxCache] = useState<BaseViewer | null>(null);

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
      bpmnRenderer: colorOptions,
    });

    if (!error && xml) {
      importDiagram(xml);
    }

    bpmnModelerRef.current.get("canvas").viewbox(viewboxCache);
    bpmnModelerRef.current.on("import.done", (event: { error: EventError }) => {
      setError(null);

      if (event.error) {
        setError(event.error);
      }

      zoomReset();
    });

    return () => {
      bpmnModelerRef.current?.detach();
    };
  });

  useEffect(() => {
    setViewboxCache(bpmnModelerRef.current?.get("canvas").viewbox());
    setColorOptions(theme === ThemeType.Light ? THEME.lightType : THEME.darkType);
  }, [theme]);

  return (
    <>
      <ErrorBar error={error} />
      <ZoomBar zoomOut={zoomOut} zoomIn={zoomIn} zoomReset={zoomReset} theme={theme} />

      <div
        ref={containerRef}
        style={{
          height: "100%",
          backgroundColor: getBackgroundColor(theme),
        }}
      />
    </>
  );
}

export default BPMNViewer;
