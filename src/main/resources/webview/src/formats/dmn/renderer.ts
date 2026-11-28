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

import { diagramColors } from "../../utils/theme";
import { CanvasMarks } from "../canvas/marks";
import { CanvasNavigation, Diagram } from "../canvas/navigation";
import { DIAGRAM_VIEW as DRD, DiagramRenderer, Marks, RendererOptions } from "../types";

const NO_MARKS: Marks = new Map();

let scopes = 0;

const quoted = (value: string): string => `"${value.replace(/["\\]/g, "\\$&").replace(/\n/g, "\\a ")}"`;

/**
 * Decision tables are HTML that dmn-js re-renders at will, so their highlighting is a style sheet rather
 * than classes on the cells: a rule is addressed by `data-row-id`, an input column by `data-col-id`, a single
 * cell by `data-element-id`. Colours come from `components/DiffView/markers.css`.
 */
function tableMarksCss(scope: string, marks: Marks, focus: string | null): string {
  const within = `[data-diff-scope=${quoted(scope)}]`;
  const cells = (id: string) =>
    ["data-row-id", "data-col-id", "data-element-id"].map((attr) => `${within} [${attr}=${quoted(id)}]`).join(",");

  const rules: string[] = [];

  marks.forEach((kind, id) => rules.push(`${cells(id)}{background-color:var(--diff-${kind}-fill) !important}`));
  if (focus) {
    rules.push(`${cells(focus)}{box-shadow:inset 0 0 0 2px var(--diff-focus)}`);
  }

  return rules.join("\n");
}

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
  const canvasMarks = new WeakMap<object, CanvasMarks>();

  const scope = `dmn-${++scopes}`;
  const tableMarks = document.createElement("style");

  let opened = false;
  let marks = NO_MARKS;
  let focus: string | null = null;

  container.dataset.diffScope = scope;
  document.head.appendChild(tableMarks);

  const activeDrd = () => (viewer.getActiveView()?.type === DRD ? viewer.getActiveViewer() ?? null : null);

  const drdMarks = (): CanvasMarks | null => {
    const drd = activeDrd();
    if (!drd) {
      return null;
    }

    let found = canvasMarks.get(drd);
    if (!found) {
      found = new CanvasMarks(drd as Diagram);
      canvasMarks.set(drd, found);
    }

    return found;
  };

  const applyMarks = () => {
    tableMarks.textContent = tableMarksCss(scope, marks, focus);
    drdMarks()?.set(marks, focus);
  };

  // Opening the DRD imports it anew, which drops the classes on its elements.
  viewer.on("views.changed", applyMarks);

  const drdNavigation = (): CanvasNavigation | null => {
    const drd = activeDrd();
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
      opened = true;
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

    definitions: () => (opened ? viewer.getDefinitions() : null),
    setMarks(next) {
      marks = next;
      applyMarks();
    },
    reveal(id) {
      focus = id;
      applyMarks();

      if (id && !drdMarks()?.scrollTo(id)) {
        const cell = Array.from(container.querySelectorAll("[data-row-id],[data-col-id],[data-element-id]")).find(
          (element) =>
            [
              element.getAttribute("data-row-id"),
              element.getAttribute("data-col-id"),
              element.getAttribute("data-element-id"),
            ].includes(id)
        );

        cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    },

    destroy() {
      tableMarks.remove();
      viewer.destroy();
    },
  };
}
