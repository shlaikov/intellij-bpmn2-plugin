import NavigatedViewer, { View } from "dmn-js/lib/NavigatedViewer";
import { migrateDiagram } from "@bpmn-io/dmn-migrate";

import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-js-shared.css";
import "dmn-js/dist/assets/dmn-js-drd.css";
import "dmn-js/dist/assets/dmn-js-decision-table.css";
import "dmn-js/dist/assets/dmn-js-literal-expression.css";
import "dmn-js/dist/assets/dmn-js-boxed-expression.css";
// The "embedded" flavour inlines the icon font, so no font files have to be served by the host.
import "dmn-js/dist/assets/dmn-font/css/dmn-embedded.css";
import "./dmn.css";

import { diagramColors } from "../utils/theme";
import { CanvasNavigation, Diagram } from "./canvasNavigation";
import type { DiagramRenderer, RendererOptions } from "./types";

const DRD = "drd";

/** dmn-js reads DMN 1.3 only; older files (1.1, 1.2 — most Camunda 7 models) are upgraded in memory first. */
async function toDmn13(xml: string): Promise<string> {
  try {
    return await migrateDiagram(xml);
  } catch {
    // Not migratable: let the importer report what is wrong with the original document.
    return xml;
  }
}

export default function createDmnRenderer({ container, theme }: RendererOptions): DiagramRenderer {
  const viewer = new NavigatedViewer({ container, drd: { drdRenderer: diagramColors(theme) } });
  // dmn-js keeps one viewer instance per view type, so there is at most one DRD canvas to navigate.
  const navigations = new WeakMap<object, CanvasNavigation>();

  const drdNavigation = (): CanvasNavigation | null => {
    if (viewer.getActiveView()?.type !== DRD) {
      return null;
    }

    const drd = viewer.getActiveViewer();
    if (!drd) {
      return null;
    }

    let navigation = navigations.get(drd);
    if (!navigation) {
      navigation = new CanvasNavigation(drd as Diagram);
      navigations.set(drd, navigation);
    }

    return navigation;
  };

  const tabName = (view: View): string => (view.type === DRD ? "Diagram" : view.name || view.id);

  return {
    async open(xml) {
      await viewer.importXML(await toDmn13(xml));
      drdNavigation()?.fit();
    },

    views: () => viewer.getViews().map((view) => ({ id: view.id, name: tabName(view), type: view.type })),
    activeViewId: () => viewer.getActiveView()?.id ?? null,
    async activate(viewId) {
      const view = viewer.getViews().find((candidate) => candidate.id === viewId);

      if (view && view !== viewer.getActiveView()) {
        await viewer.open(view);
      }
    },
    onViewsChanged: (listener) => viewer.on("views.changed", listener),

    navigation: drdNavigation,

    destroy: () => viewer.destroy(),
  };
}
