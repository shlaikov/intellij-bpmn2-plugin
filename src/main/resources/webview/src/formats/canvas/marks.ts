import type { Diagram } from "./navigation";
import type { Marks } from "../types";

const FOCUS = "diff-focus";

/**
 * Change highlighting on a diagram-js canvas (BPMN, the DMN DRD): CSS classes on the elements' graphics,
 * styled in `components/DiffView/markers.css`.
 */
export class CanvasMarks {
  private applied: Array<[id: string, marker: string]> = [];

  constructor(private readonly diagram: Diagram) {}

  /** Replaces the highlighting; ids this diagram does not have are skipped. */
  set(marks: Marks, focus: string | null): void {
    const canvas = this.diagram.get("canvas");
    const registry = this.diagram.get("elementRegistry");

    for (const [id, marker] of this.applied) {
      // The element is gone when the DRD has been re-imported in the meantime.
      if (registry.get(id)) {
        canvas.removeMarker(id, marker);
      }
    }
    this.applied = [];

    const add = (id: string, marker: string) => {
      if (registry.get(id)) {
        canvas.addMarker(id, marker);
        this.applied.push([id, marker]);
      }
    };

    marks.forEach((kind, id) => add(id, `diff-${kind}`));
    if (focus) {
      add(focus, FOCUS);
    }
  }

  /** Scrolls `id` into view, switching to its plane if needed; `false` if this diagram does not have it. */
  scrollTo(id: string): boolean {
    const element = this.diagram.get("elementRegistry").get(id);

    if (element) {
      this.diagram.get("canvas").scrollToElement(element);
    }

    return element !== undefined;
  }
}
