import type { CreateRenderer, DiagramKind, Diff, Differ } from "./types";

/**
 * The supported formats, and the one place the rest of the page gets at them. A format is a folder here with
 * a `renderer` (how a document is shown) and a `differ` (how two of them are compared).
 *
 * Both are loaded on demand: a page shows documents of one format, and only a comparison needs a differ, so
 * nothing pays for a library it does not use.
 */
interface Format {
  renderer(): Promise<{ default: CreateRenderer }>;
  differ(): Promise<{ default: Differ }>;
}

const formats: Record<DiagramKind, Format> = {
  bpmn: { renderer: () => import("./bpmn/renderer"), differ: () => import("./bpmn/differ") },
  dmn: { renderer: () => import("./dmn/renderer"), differ: () => import("./dmn/differ") },
};

export function isDiagramKind(value: unknown): value is DiagramKind {
  return typeof value === "string" && value in formats;
}

export async function loadRenderer(kind: DiagramKind): Promise<CreateRenderer> {
  return (await formats[kind].renderer()).default;
}

/**
 * What differs between two documents of a format, given as their renderers hold them
 * (`DiagramRenderer.definitions()`): `before` is the older one.
 */
export async function compare(kind: DiagramKind, before: unknown, after: unknown): Promise<Diff> {
  const differ = (await formats[kind].differ()).default;

  return differ(before, after);
}
