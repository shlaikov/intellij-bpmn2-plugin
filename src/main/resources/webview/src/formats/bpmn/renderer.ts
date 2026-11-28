import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

import { diagramColors } from "../../utils/theme";
import { CanvasMarks } from "../canvas/marks";
import { CanvasNavigation, Diagram } from "../canvas/navigation";
import type { DiagramRenderer, Marks, RendererOptions } from "../types";

const NO_MARKS: Marks = new Map();

export default function createBpmnRenderer({ container, theme }: RendererOptions): DiagramRenderer {
  const viewer = new NavigatedViewer({ container, bpmnRenderer: diagramColors(theme) });
  const navigation = new CanvasNavigation(viewer as unknown as Diagram);
  const canvasMarks = new CanvasMarks(viewer as unknown as Diagram);

  let opened = false;
  let marks = NO_MARKS;

  return {
    async open(xml) {
      await viewer.importXML(xml);
      opened = true;
      navigation.fit();
    },

    // A BPMN document is shown as a single canvas.
    views: () => [],
    activeViewId: () => null,
    activate: async () => undefined,
    onViewsChanged: () => undefined,

    navigation: () => navigation,

    definitions: () => (opened ? viewer.getDefinitions() : null),
    setMarks(next) {
      marks = next;
      canvasMarks.set(marks, null);
    },
    reveal(id) {
      canvasMarks.set(marks, id);
      if (id) {
        canvasMarks.scrollTo(id);
      }
    },

    destroy: () => viewer.destroy(),
  };
}
