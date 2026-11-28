import type { ThemeType } from "../utils/theme";
import type { CanvasNavigation } from "./canvas/navigation";

/** Must match `DiagramKind.id` on the Kotlin side. */
export type DiagramKind = "bpmn" | "dmn";

/** `DiagramViewTab.type` of the view that is a diagram (the DMN DRD) rather than one element's details. */
export const DIAGRAM_VIEW = "drd";

/** One openable part of a document. A BPMN file has none worth listing; a DMN file has its DRD and decisions. */
export interface DiagramViewTab {
  id: string;
  name: string;
  type: string;
}

/** How an element differs between the two documents of a comparison. `layout`: only moved or resized. */
export type ChangeKind = "added" | "removed" | "changed" | "layout";

/** Element id -> how to highlight it. Ids the document does not have are ignored. */
export type Marks = ReadonlyMap<string, ChangeKind>;

export interface RendererOptions {
  container: HTMLElement;
  theme: ThemeType;
}

export interface AttributeChange {
  name: string;
  before: string;
  after: string;
}

/** One entry of the list of changes. */
export interface Change {
  kind: ChangeKind;
  /** What the element is ("User Task", "Rule 3") and what it is called. */
  type: string;
  name: string;
  /** The element to bring into view on each side, where it exists. */
  left?: string;
  right?: string;
  /** Id of the view the change is in, for documents with several (a DMN decision); none: the diagram. */
  view?: string;
  attributes: AttributeChange[];
}

export interface Diff {
  changes: Change[];
  /** What to highlight in each document, by that document's own element ids. */
  left: Marks;
  right: Marks;
}

/** Compares two parsed documents, as returned by `DiagramRenderer.definitions()`: older first. */
export type Differ = (left: unknown, right: unknown) => Diff;

/**
 * What the shell needs from a diagram library. The shell (`DiagramView`, the host bridge) depends only on
 * this, so supporting another format means adding a folder next to this file and registering it in `./index.ts`.
 */
export interface DiagramRenderer {
  /** Renders the document; rejects if it cannot be imported. */
  open(xml: string): Promise<void>;

  views(): DiagramViewTab[];
  activeViewId(): string | null;
  activate(viewId: string): Promise<void>;
  /** `listener` is called whenever `views()` or `activeViewId()` may have changed. */
  onViewsChanged(listener: () => void): void;

  /** Pan/zoom control of the active view, or `null` when it is not a canvas (e.g. a decision table). */
  navigation(): CanvasNavigation | null;

  /** The parsed document as the library holds it (a moddle tree), for the format's differ; `null` until `open` succeeds. */
  definitions(): unknown;
  /** Highlights elements. Stays in force, across view switches too, until it is replaced. */
  setMarks(marks: Marks): void;
  /** Brings the element into view and emphasises it; `null` drops the emphasis. */
  reveal(id: string | null): void;

  destroy(): void;
}

export type CreateRenderer = (options: RendererOptions) => DiagramRenderer;
