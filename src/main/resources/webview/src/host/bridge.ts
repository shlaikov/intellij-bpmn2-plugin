import type { CanvasNavigation, PinchPhase } from "../renderers/canvasNavigation";

/**
 * The only place that talks to the Kotlin host (`editor/WebView.kt`, `utils/LoadableJCEFHtmlPanel.kt`).
 *
 * Webview -> host: JSON messages through `window.sendMessageToHost`, which the host defines in `index.html`
 * itself, so it exists before any of this code runs.
 * Host -> webview: `window.bpmn2Wheel` / `window.bpmn2Pinch`, see `installInput`.
 */

type Send = (message: string) => void;

declare global {
  interface Window {
    bpmn2Data?: InitialData;
    sendMessageToHost?: Send;
    bpmn2Wheel?: (dx: number, dy: number, x: number, y: number, ctrl: boolean, meta: boolean) => void;
    bpmn2Pinch?: (phase: PinchPhase, magnification: number, x: number, y: number) => void;
  }
}

/** What the host substitutes for `$$initialData$$` in `index.html`; untrusted until validated by the app. */
export interface InitialData {
  kind?: unknown;
  file?: unknown;
  theme?: unknown;
}

/** `false` under `yarn dev`, where `index.html` is served as is, with its placeholders unfilled. */
export const hosted = window.bpmn2Data !== undefined;

export function initialData(): InitialData {
  return window.bpmn2Data ?? {};
}

function post(message: { event: string }): void {
  if (hosted) {
    window.sendMessageToHost?.(JSON.stringify(message));
  }
}

/** Tells the host the document is on screen (or has failed to render), so it can drop its loading indicator. */
export function notifyReady(): void {
  post({ event: "init" });
}

function isScrollable(element: Element, axis: "x" | "y"): boolean {
  const overflow = getComputedStyle(element)[axis === "x" ? "overflowX" : "overflowY"];

  if (overflow !== "auto" && overflow !== "scroll") {
    return false;
  }

  return axis === "x" ? element.scrollWidth > element.clientWidth : element.scrollHeight > element.clientHeight;
}

function scrollUnderPointer(dx: number, dy: number, x: number, y: number): void {
  for (let element = document.elementFromPoint(x, y); element; element = element.parentElement) {
    if ((dx && isScrollable(element, "x")) || (dy && isScrollable(element, "y"))) {
      element.scrollBy(dx, dy);
      return;
    }
  }
}

/**
 * Off-screen JCEF (2026.2+, and most 2025.x setups) cannot deliver usable wheel events or any pinch gesture
 * to the page, so the host intercepts them and calls these functions instead. `navigation` returns the canvas
 * to drive, or `null` when the active view is plain HTML (a decision table) — then the wheel scrolls whatever
 * is scrollable under the pointer, because the host has consumed the native event.
 *
 * Returns a function that uninstalls the handlers.
 */
export function installInput(navigation: () => CanvasNavigation | null): () => void {
  window.bpmn2Wheel = (dx, dy, x, y, ctrl, meta) => {
    const canvas = navigation();

    if (!canvas) {
      scrollUnderPointer(dx, dy, x, y);
    } else if (ctrl || meta) {
      canvas.zoomByWheel(dx, dy, { x, y });
    } else {
      canvas.scroll(dx, dy);
    }
  };

  window.bpmn2Pinch = (phase, magnification, x, y) => {
    navigation()?.pinch(phase, magnification, { x, y });
  };

  return () => {
    delete window.bpmn2Wheel;
    delete window.bpmn2Pinch;
  };
}
