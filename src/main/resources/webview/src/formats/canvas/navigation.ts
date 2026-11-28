export interface Point {
  x: number;
  y: number;
}

export type PinchPhase = "start" | "move" | "end";

export interface Bounds extends Point {
  width: number;
  height: number;
}

interface Root {
  id: string;
}

// The slice of diagram-js this module and `marks.ts` rely on; bpmn-js and the dmn-js DRD viewer both
// provide it.
interface Canvas {
  zoom(): number;
  zoom(scale: number | "fit-viewport", center?: Point | "auto"): number;
  getContainer(): HTMLElement;
  viewbox(): Bounds & { inner: Bounds; outer: { width: number; height: number } };
  viewbox(box: Bounds): unknown;
  getRootElement(): Root;
  findRoot(id: string): Root | undefined;
  setRootElement(root: Root): unknown;
  scrollToElement(element: object): void;
  addMarker(id: string, marker: string): void;
  removeMarker(id: string, marker: string): void;
}

interface EventBus {
  on(event: string, priority: number, callback: (event: never) => void): void;
  off(event: string, callback: (event: never) => void): void;
}

interface ElementRegistry {
  get(id: string): object | undefined;
}

interface ZoomScroll {
  stepZoom(direction: number): void;
  zoom(delta: number, position: Point): void;
  scroll(delta: { dx: number; dy: number }): void;
}

export interface Diagram {
  get(service: "canvas"): Canvas;
  get(service: "zoomScroll"): ZoomScroll;
  get(service: "eventBus"): EventBus;
  get(service: "elementRegistry"): ElementRegistry;
}

/** Below the library's own listeners, so they have settled (e.g. the viewbox restored on drill-down). */
const LOW_PRIORITY = 250;

/** Space left around the content when it is fitted, in diagram units. */
const FIT_PADDING = 20;

// diagram-js ZoomScroll defaults (lib/navigation/zoomscroll/ZoomScroll.js)
const SCROLL_SCALE = 0.75;
const ZOOM_FACTOR = 0.02;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;

/**
 * Pan and zoom of a diagram-js canvas, driven by the zoom bar and by input the Kotlin host forwards
 * (see `host/bridge.ts`). Positions are viewport coordinates, as reported by the host.
 */
export class CanvasNavigation {
  private pinchStart: { scale: number; at: Point } | null = null;

  constructor(private readonly diagram: Diagram) {}

  zoomIn(): void {
    this.diagram.get("zoomScroll").stepZoom(1);
  }

  zoomOut(): void {
    this.diagram.get("zoomScroll").stepZoom(-1);
  }

  fit(): void {
    this.diagram.get("canvas").zoom("fit-viewport", "auto");
  }

  scroll(dx: number, dy: number): void {
    this.diagram.get("zoomScroll").scroll({ dx: -SCROLL_SCALE * dx, dy: -SCROLL_SCALE * dy });
  }

  /** Wheel zoom around `at`; the larger the wheel delta, the larger the step. */
  zoomByWheel(dx: number, dy: number, at: Point): void {
    const delta = -SCROLL_SCALE * ZOOM_FACTOR * Math.hypot(dx, dy) * Math.sign(dy || dx);

    this.diagram.get("zoomScroll").zoom(delta, this.toCanvas(at));
  }

  /**
   * macOS trackpad pinch. `magnification` is the sum of per-event magnifications since the gesture started;
   * Apple's convention is to compound `scale *= 1 + m` per event, which is exp(sum) to first order.
   */
  pinch(phase: PinchPhase, magnification: number, at: Point): void {
    const canvas = this.diagram.get("canvas");

    if (phase === "start") {
      this.pinchStart = { scale: canvas.zoom(), at: this.toCanvas(at) };
    } else if (phase === "move" && this.pinchStart) {
      const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.pinchStart.scale * Math.exp(magnification)));

      canvas.zoom(scale, this.pinchStart.at);
    } else if (phase === "end") {
      this.pinchStart = null;
    }
  }

  /** The visible part of the diagram, in diagram coordinates. */
  viewbox(): Bounds {
    const { x, y, width, height } = this.diagram.get("canvas").viewbox();

    return { x, y, width, height };
  }

  setViewbox(box: Bounds): void {
    this.diagram.get("canvas").viewbox(box);
  }

  /** What is drawn on the current plane, in diagram coordinates; `null` when there is nothing. */
  contentBounds(): Bounds | null {
    const { inner } = this.diagram.get("canvas").viewbox();

    return inner.width > 0 && inner.height > 0 ? inner : null;
  }

  /**
   * Shows all of `content`, like `fit()` does for the diagram's own content: zoomed out as far as that takes,
   * but never zoomed in — something small is centred at its natural size.
   */
  fitTo(content: Bounds): void {
    const { outer } = this.diagram.get("canvas").viewbox();
    const width = Math.max(content.width + 2 * FIT_PADDING, outer.width);
    const height = Math.max(content.height + 2 * FIT_PADDING, outer.height);

    this.setViewbox({
      x: content.x + (content.width - width) / 2,
      y: content.y + (content.height - height) / 2,
      width,
      height,
    });
  }

  /** Subscribes to pan and zoom; returns the function that unsubscribes. */
  onViewboxChanged(listener: () => void): () => void {
    return this.subscribe("canvas.viewbox.changed", listener);
  }

  /** The plane on screen: the process, or a collapsed sub-process that has been drilled into. */
  rootId(): string {
    return this.diagram.get("canvas").getRootElement().id;
  }

  /** Switches to the plane `id`; `false` if this diagram has no such plane. */
  setRoot(id: string): boolean {
    const canvas = this.diagram.get("canvas");
    const root = canvas.findRoot(id);

    if (!root) {
      return false;
    }
    if (root !== canvas.getRootElement()) {
      canvas.setRootElement(root);
    }

    return true;
  }

  onRootChanged(listener: () => void): () => void {
    return this.subscribe("root.set", listener);
  }

  private subscribe(event: string, listener: () => void): () => void {
    const eventBus = this.diagram.get("eventBus");
    const callback = () => listener();

    eventBus.on(event, LOW_PRIORITY, callback);

    return () => eventBus.off(event, callback);
  }

  private toCanvas(point: Point): Point {
    const rect = this.diagram.get("canvas").getContainer().getBoundingClientRect();

    return { x: point.x - rect.left, y: point.y - rect.top };
  }
}
