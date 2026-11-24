import type { ThemeType } from "../utils/theme";
import type { CanvasNavigation } from "./canvasNavigation";

/** Must match `DiagramKind.id` on the Kotlin side. */
export type DiagramKind = "bpmn" | "dmn";

/** One openable part of a document. A BPMN file has none worth listing; a DMN file has its DRD and decisions. */
export interface DiagramViewTab {
  id: string;
  name: string;
  type: string;
}

export interface RendererOptions {
  container: HTMLElement;
  theme: ThemeType;
}

/**
 * What the shell needs from a diagram library. The shell (`DiagramView`, the host bridge) depends only on
 * this, so supporting another format means adding one implementation and registering it in `./index.ts`.
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

  destroy(): void;
}

export type CreateRenderer = (options: RendererOptions) => DiagramRenderer;
