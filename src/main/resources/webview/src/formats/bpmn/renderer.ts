import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

import { diagramColors } from "../utils/theme";
import { CanvasNavigation, Diagram } from "./canvasNavigation";
import type { DiagramRenderer, RendererOptions } from "./types";

export default function createBpmnRenderer({ container, theme }: RendererOptions): DiagramRenderer {
  const viewer = new NavigatedViewer({ container, bpmnRenderer: diagramColors(theme) });
  const navigation = new CanvasNavigation(viewer as unknown as Diagram);

  return {
    async open(xml) {
      await viewer.importXML(xml);
      navigation.fit();
    },

    // A BPMN document is shown as a single canvas.
    views: () => [],
    activeViewId: () => null,
    activate: async () => undefined,
    onViewsChanged: () => undefined,

    navigation: () => navigation,

    destroy: () => viewer.destroy(),
  };
}
