import { RefObject, useCallback, useEffect, useState } from "react";

import { loadRenderer } from "../formats";
import type { DiagramKind, DiagramRenderer, DiagramViewTab } from "../formats/types";
import type { ThemeType } from "../utils/theme";

export interface ViewState {
  tabs: DiagramViewTab[];
  active: string | null;
  navigable: boolean;
}

export interface Diagram {
  /** Set as soon as the renderer exists; whether the document is on screen is what `settled` and `error` say. */
  renderer: DiagramRenderer | null;
  /** The document has been rendered or has failed to; nothing more will happen on its own. */
  settled: boolean;
  error: Error | null;
  views: ViewState;
  selectView(viewId: string): Promise<void>;
}

const NO_VIEWS: ViewState = { tabs: [], active: null, navigable: false };

const toError = (reason: unknown): Error => (reason instanceof Error ? reason : new Error(String(reason)));

/**
 * The lifecycle of one renderer: created in `container` for `xml`, destroyed when any of the inputs changes
 * or the component goes away. With `xml` being `null` there is nothing to render and it settles at once.
 */
export function useDiagram(
  kind: DiagramKind,
  xml: string | null,
  theme: ThemeType,
  container: RefObject<HTMLElement>
): Diagram {
  const [renderer, setRenderer] = useState<DiagramRenderer | null>(null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [views, setViews] = useState<ViewState>(NO_VIEWS);

  useEffect(() => {
    const element = container.current;

    setError(null);
    setViews(NO_VIEWS);
    setSettled(xml === null);

    if (!element || xml === null) {
      return;
    }

    let disposed = false;
    let created: DiagramRenderer | undefined;

    const syncViews = () => {
      if (!disposed && created) {
        setViews({
          tabs: created.views(),
          active: created.activeViewId(),
          navigable: created.navigation() !== null,
        });
      }
    };

    const start = async () => {
      try {
        const createRenderer = await loadRenderer(kind);
        if (disposed) {
          return;
        }

        created = createRenderer({ container: element, theme });
        setRenderer(created);
        created.onViewsChanged(syncViews);

        await created.open(xml);
        syncViews();
      } catch (reason: unknown) {
        if (!disposed) {
          setError(toError(reason));
        }
      } finally {
        if (!disposed) {
          setSettled(true);
        }
      }
    };

    start();

    return () => {
      disposed = true;
      setRenderer(null);
      created?.destroy();
    };
  }, [kind, xml, theme, container]);

  const selectView = useCallback(
    async (viewId: string) => {
      try {
        await renderer?.activate(viewId);
        setError(null);
      } catch (reason: unknown) {
        setError(toError(reason));
      }
    },
    [renderer]
  );

  return { renderer, settled, error, views, selectView };
}
