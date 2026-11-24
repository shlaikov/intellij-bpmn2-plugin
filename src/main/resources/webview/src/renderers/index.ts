import type { CreateRenderer, DiagramKind } from "./types";

/**
 * Renderers are loaded on demand: a page shows one document, so it should not pay for the other library.
 */
const loaders: Record<DiagramKind, () => Promise<{ default: CreateRenderer }>> = {
  bpmn: () => import("./bpmn"),
  dmn: () => import("./dmn"),
};

export function isDiagramKind(value: unknown): value is DiagramKind {
  return typeof value === "string" && value in loaders;
}

export async function loadRenderer(kind: DiagramKind): Promise<CreateRenderer> {
  return (await loaders[kind]()).default;
}
