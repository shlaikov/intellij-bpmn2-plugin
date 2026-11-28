import { diff, ModdleElement } from "bpmn-js-differ";

import { byKind, typeLabel } from "../changes";
import type { Change, ChangeKind, Differ } from "../types";

function isElement(value: unknown): value is ModdleElement {
  return typeof value === "object" && value !== null;
}

/** An attribute value as text: referenced elements by their name, lists item by item. */
function text(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(text).join(", ");
  }
  if (isElement(value)) {
    return value.name || value.id || typeLabel(String(value.$type ?? ""));
  }

  return String(value);
}

function displayName(element: ModdleElement): string {
  if (element.name) {
    return element.name;
  }

  // Flows and associations are rarely named; their ends say more than an id does.
  if (isElement(element.sourceRef) && isElement(element.targetRef)) {
    return `${text(element.sourceRef)} → ${text(element.targetRef)}`;
  }

  return element.id ?? "";
}

/** BPMN comparison by bpmn-js-differ, which matches elements by id. */
const bpmnDiffer: Differ = (leftDefinitions, rightDefinitions) => {
  const result = diff(leftDefinitions, rightDefinitions);

  const changes: Change[] = [];
  const left = new Map<string, ChangeKind>();
  const right = new Map<string, ChangeKind>();

  const describe = (kind: ChangeKind, element: ModdleElement): Change => ({
    kind,
    type: typeLabel(element.$type),
    name: displayName(element),
    attributes: [],
  });

  for (const [id, element] of Object.entries(result._removed)) {
    left.set(id, "removed");
    changes.push({ ...describe("removed", element), left: id });
  }

  for (const [id, element] of Object.entries(result._added)) {
    right.set(id, "added");
    changes.push({ ...describe("added", element), right: id });
  }

  for (const [id, { model, attrs }] of Object.entries(result._changed)) {
    left.set(id, "changed");
    right.set(id, "changed");
    changes.push({
      ...describe("changed", model),
      left: id,
      right: id,
      attributes: Object.entries(attrs).map(([name, { oldValue, newValue }]) => ({
        name,
        before: text(oldValue),
        after: text(newValue),
      })),
    });
  }

  for (const [id, element] of Object.entries(result._layoutChanged)) {
    // A new element has no previous position, and a change of content matters more than a move.
    if (!left.has(id) && !right.has(id)) {
      left.set(id, "layout");
      right.set(id, "layout");
      changes.push({ ...describe("layout", element), left: id, right: id });
    }
  }

  return { changes: byKind(changes), left, right };
};

export default bpmnDiffer;
