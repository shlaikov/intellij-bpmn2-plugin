import { useState, useEffect, useRef } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import BaseViewer from "bpmn-js/lib/BaseViewer";

import ZoomBar from "../ZoomBar";
import ErrorBoundary from "../ErrorBoundary";
import ErrorBar, { EventError } from "../ErrorBar";
import diagram from "../../modules/diagram";
import THEME, { ThemeType, ITheme, getBackgroundColor } from "../../utils/theme";

interface Props {
  xml: string;
  theme: ThemeType;
}

// diagram-js ZoomScroll defaults (lib/navigation/zoomscroll/ZoomScroll.js)
const SCROLL_SCALE = 0.75;
const ZOOM_FACTOR = 0.02;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;

function BPMNViewer({ xml, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bpmnModelerRef = useRef<NavigatedViewer | null>(null);

  const [colorOptions, setColorOptions] = useState<ITheme>(theme === ThemeType.Light ? THEME.lightType : THEME.darkType);
  const [viewboxCache, setViewboxCache] = useState<BaseViewer | null>(null);

  const [error, setError] = useState<EventError | Error | null>(null);

  const importDiagram = async (xml: string) => {
    try {
      await bpmnModelerRef.current?.importXML(xml);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error);
      }
    }
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
      additionalModules: [...diagram],
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

    // Off-screen JCEF (2026.2+, and most 2025.x setups) can't deliver usable wheel events to the page,
    // so the Kotlin host intercepts them and calls this with precise deltas. See LoadableJCEFHtmlPanel.
    window.bpmn2Wheel = (dx, dy, x, y, ctrl, meta) => {
      const viewer = bpmnModelerRef.current;
      const container = containerRef.current;
      if (!viewer || !container) return;

      const zoomScroll = viewer.get("zoomScroll");
      if (ctrl || meta) {
        const rect = container.getBoundingClientRect();
        const delta = -SCROLL_SCALE * ZOOM_FACTOR * Math.hypot(dx, dy) * Math.sign(dy || dx);
        zoomScroll.zoom(delta, { x: x - rect.left, y: y - rect.top });
      } else {
        zoomScroll.scroll({ dx: -SCROLL_SCALE * dx, dy: -SCROLL_SCALE * dy });
      }
    };

    // macOS trackpad pinch, delivered by the IDE's gesture support via the Kotlin host (ZoomableViewport).
    // `magnification` is the sum of per-event magnifications since the gesture started; Apple's convention
    // is to compound `scale *= 1 + m` per event, which is exp(sum) to first order.
    let pinchStart: { scale: number; at: { x: number; y: number } } | null = null;
    window.bpmn2Pinch = (phase, magnification, x, y) => {
      const viewer = bpmnModelerRef.current;
      const container = containerRef.current;
      if (!viewer || !container) return;

      const canvas = viewer.get("canvas");
      if (phase === "start") {
        const rect = container.getBoundingClientRect();
        pinchStart = { scale: canvas.zoom(), at: { x: x - rect.left, y: y - rect.top } };
      } else if (phase === "move" && pinchStart) {
        const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStart.scale * Math.exp(magnification)));
        canvas.zoom(scale, pinchStart.at);
      } else if (phase === "end") {
        pinchStart = null;
      }
    };

    return () => {
      delete window.bpmn2Pinch;
      delete window.bpmn2Wheel;
      bpmnModelerRef.current?.detach();
    };
  });

  useEffect(() => {
    setViewboxCache(bpmnModelerRef.current?.get("canvas").viewbox());
    setColorOptions(theme === ThemeType.Light ? THEME.lightType : THEME.darkType);
  }, [theme]);

  if (typeof xml !== 'string') {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        alignContent: "center",
        backgroundColor: getBackgroundColor(theme),
      }}>
        <ErrorBoundary text="Unsupported file format" theme={theme} />
      </div>
    );
  }

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
