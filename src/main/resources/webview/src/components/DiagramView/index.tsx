import "./style.css";

import { useEffect, useRef } from "react";

import ErrorBar from "../ErrorBar";
import ViewTabs from "../ViewTabs";
import ZoomBar from "../ZoomBar";
import { installInput, notifyReady } from "../../host/bridge";
import { useDiagram } from "../../hooks/useDiagram";
import type { DiagramKind } from "../../formats/types";
import { ThemeType } from "../../utils/theme";

interface Props {
  kind: DiagramKind;
  xml: string;
  theme: ThemeType;
}

/**
 * The format-agnostic shell around a diagram: the surrounding chrome (view tabs, zoom bar, error bar) of a
 * renderer it knows only through the `DiagramRenderer` contract.
 */
function DiagramView({ kind, xml, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { renderer, settled, error, views, selectView } = useDiagram(kind, xml, theme, containerRef);

  useEffect(() => {
    if (settled) {
      notifyReady();
    }
  }, [settled]);

  useEffect(() => installInput(() => renderer?.navigation() ?? null), [renderer]);

  const navigation = () => renderer?.navigation();

  return (
    <div className={`io-diagram-view theme-${theme}`}>
      <ErrorBar error={error} />

      {views.tabs.length > 1 && <ViewTabs views={views.tabs} active={views.active} onSelect={selectView} />}

      {views.navigable && (
        <ZoomBar
          zoomOut={() => navigation()?.zoomOut()}
          zoomIn={() => navigation()?.zoomIn()}
          zoomReset={() => navigation()?.fit()}
          theme={theme}
        />
      )}

      <div ref={containerRef} className="io-diagram-view__canvas" />
    </div>
  );
}

export default DiagramView;
