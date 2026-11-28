export interface Point {
  x: number;
  y: number;
}

export type PinchPhase = "start" | "move" | "end";

// The slice of diagram-js this module relies on; bpmn-js and the dmn-js DRD viewer both provide it.
interface Canvas {
  zoom(): number;
  zoom(scale: number | "fit-viewport", center?: Point | "auto"): number;
  getContainer(): HTMLElement;
}

interface ZoomScroll {
  stepZoom(direction: number): void;
  zoom(delta: number, position: Point): void;
  scroll(delta: { dx: number; dy: number }): void;
}

export interface Diagram {
  get(service: "canvas"): Canvas;
  get(service: "zoomScroll"): ZoomScroll;
}

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

  private toCanvas(point: Point): Point {
    const rect = this.diagram.get("canvas").getContainer().getBoundingClientRect();

    return { x: point.x - rect.left, y: point.y - rect.top };
  }
}
