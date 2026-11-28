import type { Change, ChangeKind } from "./types";

const KIND_ORDER: ChangeKind[] = ["changed", "added", "removed", "layout"];

/** "bpmn:ExclusiveGateway" -> "Exclusive Gateway" */
export function typeLabel(type: string): string {
  return type.replace(/^.*:/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function byKind(changes: Change[]): Change[] {
  // Array.prototype.sort is stable, so entries of one kind keep the order they were found in.
  return [...changes].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
