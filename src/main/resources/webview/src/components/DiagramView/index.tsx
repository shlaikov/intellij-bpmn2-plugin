import "./style.css";

import { useCallback, useEffect, useRef, useState } from "react";

import ErrorBar from "../ErrorBar";
import ViewTabs from "../ViewTabs";
import ZoomBar from "../ZoomBar";
import { installInput, notifyReady } from "../../host/bridge";
import { loadRenderer } from "../../renderers";
import type { DiagramKind, DiagramRenderer, DiagramViewTab } from "../../renderers/types";
import { ThemeType } from "../../utils/theme";

interface Props {
  kind: DiagramKind;
  xml: string;
  theme: ThemeType;
}

interface ViewState {
  tabs: DiagramViewTab[];
  active: string | null;
  navigable: boolean;
}

const NO_VIEWS: ViewState = { tabs: [], active: null, navigable: false };

const toError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(String(reason)));

/**
 * The format-agnostic shell around a diagram: it owns the renderer's lifecycle and the surrounding chrome
 * (view tabs, zoom bar, error bar) and knows nothing about BPMN or DMN beyond the `DiagramRenderer` contract.
 */
function DiagramView({ kind, xml, theme }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<DiagramRenderer | null>(null);

  const [viewState, setViewState] = useState<ViewState>(NO_VIEWS);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let renderer: DiagramRenderer | undefined;

    const syncViews = () => {
      if (!disposed && renderer) {
        setViewState({
          tabs: renderer.views(),
          active: renderer.activeViewId(),
          navigable: renderer.navigation() !== null,
        });
      }
    };

    const start = async () => {
      try {
        const createRenderer = await loadRenderer(kind);
        if (disposed) {
          return;
        }

        renderer = createRenderer({ container, theme });
        rendererRef.current = renderer;
        renderer.onViewsChanged(syncViews);

        await renderer.open(xml);
        syncViews();
      } catch (reason: unknown) {
        if (!disposed) {
          setError(toError(reason));
        }
      } finally {
        if (!disposed) {
          notifyReady();
        }
      }
    };

    setError(null);
    setViewState(NO_VIEWS);
    start();

    const uninstallInput = installInput(() => rendererRef.current?.navigation() ?? null);

    return () => {
      disposed = true;
      uninstallInput();
      rendererRef.current = null;
      renderer?.destroy();
    };
  }, [kind, xml, theme]);

  const selectView = useCallback(async (viewId: string) => {
    try {
      await rendererRef.current?.activate(viewId);
      setError(null);
    } catch (reason: unknown) {
      setError(toError(reason));
    }
  }, []);

  const navigation = () => rendererRef.current?.navigation();

  return (
    <div className={`io-diagram-view theme-${theme}`}>
      <ErrorBar error={error} />

      {viewState.tabs.length > 1 && (
        <ViewTabs views={viewState.tabs} active={viewState.active} onSelect={selectView} />
      )}

      {viewState.navigable && (
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
