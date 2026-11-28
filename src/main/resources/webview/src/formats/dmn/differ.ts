import { byKind, typeLabel } from "../changes";
import type { AttributeChange, Change, ChangeKind, Differ } from "../types";

/**
 * DMN comparison. There is no library for it, and ids alone are not enough to go by: a DMN 1.1 file has
 * none on its rules and cells, and the upgrade to 1.3 (`@bpmn-io/dmn-migrate`) invents random ones — different
 * ones for the same file on each side. So only what the diagram shows (decisions, inputs, …) is matched by id
 * strictly; the clauses and rules of a table fall back to their content and then their position when their
 * ids have nothing in common, and cells go by column.
 *
 * Works on the trees the two viewers hold, so every id it reports exists in the page it is reported for.
 */

/** A dmn-moddle element: `$type` plus the properties of its type, as read from the XML. */
interface Element {
  $type: string;
  id?: string;
  name?: string;
  [property: string]: unknown;
}

const isElement = (value: unknown): value is Element => typeof value === "object" && value !== null;

const element = (value: unknown): Element | undefined =>
  isElement(value) && !Array.isArray(value) ? value : undefined;

const elements = (value: unknown): Element[] => (Array.isArray(value) ? value.filter(isElement) : []);

const text = (value: unknown): string => (value === undefined || value === null ? "" : String(value));

/** The target of a `<requiredInput href="#id"/>`-style reference. */
const referenced = (value: unknown): string => text(element(value)?.href).replace(/^#/, "");

/** Everything an element says, without ids and without what it merely points back to. */
function content(value: unknown, seen = new Set<object>()): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => content(item, seen));
  }
  if (!isElement(value)) {
    return value ?? null;
  }
  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  const result: Record<string, unknown> = { $type: value.$type };

  for (const key of Object.keys(value).sort()) {
    if (key !== "id" && !key.startsWith("$")) {
      result[key] = content(value[key], seen);
    }
  }

  return result;
}

const signature = (value: unknown): string => JSON.stringify(content(value));

interface Matching {
  pairs: Array<[left: Element, right: Element]>;
  removed: Element[];
  added: Element[];
}

/**
 * Pairs up the items of two lists by id. With `byContent`, lists that have no id in common — the sign of ids
 * made up on import — are paired by equal content and then by position instead, so that an edited rule is one
 * change rather than a removal and an addition.
 */
function match(left: Element[], right: Element[], byContent: boolean): Matching {
  const pairs: Matching["pairs"] = [];
  let removed = [...left];
  let added = [...right];

  const pairUp = (key: (item: Element) => string | undefined) => {
    const candidates = new Map<string, Element[]>();

    for (const item of added) {
      const itemKey = key(item);
      if (itemKey !== undefined) {
        candidates.set(itemKey, [...(candidates.get(itemKey) ?? []), item]);
      }
    }

    removed = removed.filter((item) => {
      const itemKey = key(item);
      const partner = itemKey === undefined ? undefined : candidates.get(itemKey)?.shift();

      if (partner) {
        pairs.push([item, partner]);
        added = added.filter((candidate) => candidate !== partner);
      }

      return !partner;
    });
  };

  pairUp((item) => item.id);

  if (byContent && pairs.length === 0) {
    pairUp(signature);

    const count = Math.min(removed.length, added.length);
    for (let index = 0; index < count; index++) {
      pairs.push([removed[index], added[index]]);
    }
    removed = removed.slice(count);
    added = added.slice(count);
  }

  return { pairs, removed, added };
}

/** The properties of an element that are compared one by one, with the name each goes by in the list. */
type Properties = Array<[name: string, read: (item: Element) => unknown]>;

function attributeChanges(left: Element, right: Element, properties: Properties): AttributeChange[] {
  const changes: AttributeChange[] = [];

  for (const [name, read] of properties) {
    const before = text(read(left));
    const after = text(read(right));

    if (before !== after) {
      changes.push({ name, before, after });
    }
  }

  return changes;
}

const DRG_PROPERTIES: Properties = [
  ["type", (item) => typeLabel(item.$type)],
  ["name", (item) => item.name],
  ["description", (item) => item.description],
  ["question", (item) => item.question],
  ["allowedAnswers", (item) => item.allowedAnswers],
  ["variable", (item) => element(item.variable)?.name],
  ["typeRef", (item) => element(item.variable)?.typeRef],
  ["sourceType", (item) => (item.$type === "dmn:KnowledgeSource" ? item.type : undefined)],
  ["locationURI", (item) => item.locationURI],
  ["text", (item) => item.text],
  ["source", (item) => referenced(item.sourceRef)],
  ["target", (item) => referenced(item.targetRef)],
];

const TABLE_PROPERTIES: Properties = [
  ["hitPolicy", (item) => item.hitPolicy ?? "UNIQUE"],
  ["aggregation", (item) => item.aggregation],
];

const INPUT_PROPERTIES: Properties = [
  ["label", (item) => item.label],
  ["expression", (item) => element(item.inputExpression)?.text],
  ["typeRef", (item) => element(item.inputExpression)?.typeRef],
  ["values", (item) => element(item.inputValues)?.text],
];

const OUTPUT_PROPERTIES: Properties = [
  ["label", (item) => item.label],
  ["name", (item) => item.name],
  ["typeRef", (item) => item.typeRef],
  ["values", (item) => element(item.outputValues)?.text],
];

const EXPRESSION_PROPERTIES: Properties = [
  ["text", (item) => item.text],
  ["typeRef", (item) => item.typeRef],
  ["expressionLanguage", (item) => item.expressionLanguage],
];

const REQUIREMENTS = ["informationRequirement", "knowledgeRequirement", "authorityRequirement"];

const requirements = (item: Element): Element[] => REQUIREMENTS.flatMap((property) => elements(item[property]));

const requirementSource = (requirement: Element): string =>
  ["requiredDecision", "requiredInput", "requiredKnowledge", "requiredAuthority"]
    .map((property) => referenced(requirement[property]))
    .find(Boolean) ?? "";

const inputLabel = (input: Element): string => text(input.label) || text(element(input.inputExpression)?.text);

const outputLabel = (output: Element): string => text(output.label) || text(output.name);

/** Decisions, inputs and so on, and the annotations and associations drawn between them. */
const drawn = (definitions: Element): Element[] => [
  ...elements(definitions.drgElement),
  ...elements(definitions.artifact),
];

/** Where each element of the diagram is drawn, as a comparable string, by element id. */
function layout(definitions: Element): Map<string, string> {
  const result = new Map<string, string>();
  const diagram = elements(element(definitions.dmnDI)?.diagrams)[0];

  for (const shape of elements(diagram?.diagramElements)) {
    const target = shape.dmnElementRef;
    const id = isElement(target) ? target.id : text(target);
    const bounds = element(shape.bounds);

    if (id && bounds) {
      result.set(id, [bounds.x, bounds.y, bounds.width, bounds.height].join(","));
    }
  }

  return result;
}

const dmnDiffer: Differ = (leftDefinitions, rightDefinitions) => {
  const changes: Change[] = [];
  const left = new Map<string, ChangeKind>();
  const right = new Map<string, ChangeKind>();

  const before = element(leftDefinitions);
  const after = element(rightDefinitions);

  if (!before || !after) {
    return { changes, left, right };
  }

  const mark = (marks: Map<string, ChangeKind>, item: Element | undefined, kind: ChangeKind) => {
    if (item?.id) {
      marks.set(item.id, kind);
    }
  };

  const nameIn = (definitions: Element, id: string): string =>
    text(drawn(definitions).find((item) => item.id === id)?.name) || id;

  /** The clauses of two tables: reports the differences, returns which column of one is which of the other. */
  const compareClauses = (
    decision: Element,
    type: string,
    leftClauses: Element[],
    rightClauses: Element[],
    properties: Properties,
    label: (clause: Element) => string
  ): Array<[left: number, right: number, label: string]> => {
    const matching = match(leftClauses, rightClauses, true);
    const view = decision.id;

    for (const clause of matching.removed) {
      mark(left, clause, "removed");
      changes.push({ kind: "removed", type, name: label(clause), left: clause.id, view, attributes: [] });
    }
    for (const clause of matching.added) {
      mark(right, clause, "added");
      changes.push({ kind: "added", type, name: label(clause), right: clause.id, view, attributes: [] });
    }
    for (const [leftClause, rightClause] of matching.pairs) {
      const attributes = attributeChanges(leftClause, rightClause, properties);

      // Not highlighted: the column's id addresses every cell in it, and those have not changed.
      if (attributes.length > 0) {
        changes.push({
          kind: "changed",
          type,
          name: label(rightClause),
          left: leftClause.id,
          right: rightClause.id,
          view,
          attributes,
        });
      }
    }

    return matching.pairs.map(([leftClause, rightClause]) => [
      leftClauses.indexOf(leftClause),
      rightClauses.indexOf(rightClause),
      label(rightClause),
    ]);
  };

  const compareTables = (decision: Element, leftTable: Element, rightTable: Element) => {
    const view = decision.id;
    const tableName = text(decision.name);

    const tableAttributes = attributeChanges(leftTable, rightTable, TABLE_PROPERTIES);
    if (tableAttributes.length > 0) {
      changes.push({ kind: "changed", type: "Decision Table", name: tableName, view, attributes: tableAttributes });
    }

    const inputs = compareClauses(
      decision,
      "Input",
      elements(leftTable.input),
      elements(rightTable.input),
      INPUT_PROPERTIES,
      inputLabel
    );
    const outputs = compareClauses(
      decision,
      "Output",
      elements(leftTable.output),
      elements(rightTable.output),
      OUTPUT_PROPERTIES,
      outputLabel
    );

    const leftRules = elements(leftTable.rule);
    const rightRules = elements(rightTable.rule);
    const rules = match(leftRules, rightRules, true);

    const ruleType = (rule: Element, all: Element[]) => `Rule ${all.indexOf(rule) + 1}`;

    for (const rule of rules.removed) {
      mark(left, rule, "removed");
      changes.push({
        kind: "removed",
        type: ruleType(rule, leftRules),
        name: tableName,
        left: rule.id,
        view,
        attributes: [],
      });
    }
    for (const rule of rules.added) {
      mark(right, rule, "added");
      changes.push({
        kind: "added",
        type: ruleType(rule, rightRules),
        name: tableName,
        right: rule.id,
        view,
        attributes: [],
      });
    }

    for (const [leftRule, rightRule] of rules.pairs) {
      const attributes = attributeChanges(leftRule, rightRule, [["annotation", (rule) => rule.description]]);

      const compareCells = (property: string, columns: Array<[number, number, string]>) => {
        for (const [leftIndex, rightIndex, label] of columns) {
          const leftCell = elements(leftRule[property])[leftIndex];
          const rightCell = elements(rightRule[property])[rightIndex];

          if (text(leftCell?.text) !== text(rightCell?.text)) {
            mark(left, leftCell, "changed");
            mark(right, rightCell, "changed");
            attributes.push({ name: label, before: text(leftCell?.text), after: text(rightCell?.text) });
          }
        }
      };

      compareCells("inputEntry", inputs);
      compareCells("outputEntry", outputs);

      if (attributes.length > 0) {
        changes.push({
          kind: "changed",
          type: ruleType(rightRule, rightRules),
          name: tableName,
          left: leftRule.id,
          right: rightRule.id,
          view,
          attributes,
        });
      }
    }
  };

  /** A decision's table or expression, a business knowledge model's function. Returns whether it differs. */
  const compareLogic = (leftItem: Element, rightItem: Element): boolean => {
    const reported = changes.length;
    const leftLogic = element(leftItem.decisionLogic ?? leftItem.encapsulatedLogic);
    const rightLogic = element(rightItem.decisionLogic ?? rightItem.encapsulatedLogic);
    const view = rightItem.id;
    const name = text(rightItem.name);

    if (!leftLogic || !rightLogic || leftLogic.$type !== rightLogic.$type) {
      if (leftLogic || rightLogic) {
        const logicType = (logic: Element | undefined) => (logic ? typeLabel(logic.$type) : "");

        changes.push({
          kind: "changed",
          type: "Decision Logic",
          name,
          left: leftItem.id,
          right: rightItem.id,
          attributes: [{ name: "type", before: logicType(leftLogic), after: logicType(rightLogic) }],
        });
      }
    } else if (leftLogic.$type === "dmn:DecisionTable") {
      compareTables(rightItem, leftLogic, rightLogic);
    } else if (leftLogic.$type === "dmn:LiteralExpression") {
      const attributes = attributeChanges(leftLogic, rightLogic, EXPRESSION_PROPERTIES);

      if (attributes.length > 0) {
        changes.push({ kind: "changed", type: "Literal Expression", name, view, attributes });
      }
    } else if (signature(leftLogic) !== signature(rightLogic)) {
      // Boxed expressions: known to differ, not compared part by part.
      changes.push({ kind: "changed", type: typeLabel(rightLogic.$type), name, view, attributes: [] });
    }

    return changes.length > reported;
  };

  const compareRequirements = (leftItem: Element, rightItem: Element) => {
    const key = (requirement: Element) => `${requirement.$type} ${requirementSource(requirement)}`;
    const leftRequirements = requirements(leftItem);
    const rightRequirements = requirements(rightItem);

    const describe = (definitions: Element, requirement: Element, owner: Element) => ({
      type: typeLabel(requirement.$type),
      name: `${nameIn(definitions, requirementSource(requirement))} → ${text(owner.name) || text(owner.id)}`,
      attributes: [],
    });

    for (const requirement of leftRequirements) {
      if (!rightRequirements.some((candidate) => key(candidate) === key(requirement))) {
        mark(left, requirement, "removed");
        changes.push({ kind: "removed", ...describe(before, requirement, leftItem), left: requirement.id });
      }
    }
    for (const requirement of rightRequirements) {
      if (!leftRequirements.some((candidate) => key(candidate) === key(requirement))) {
        mark(right, requirement, "added");
        changes.push({ kind: "added", ...describe(after, requirement, rightItem), right: requirement.id });
      }
    }
  };

  const definitionsAttributes = attributeChanges(before, after, [["name", (item) => item.name]]);
  if (definitionsAttributes.length > 0) {
    changes.push({ kind: "changed", type: "Definitions", name: text(after.name), attributes: definitionsAttributes });
  }

  const matching = match(drawn(before), drawn(after), false);
  const leftLayout = layout(before);
  const rightLayout = layout(after);

  for (const item of matching.removed) {
    mark(left, item, "removed");
    requirements(item).forEach((requirement) => mark(left, requirement, "removed"));
    changes.push({
      kind: "removed",
      type: typeLabel(item.$type),
      name: text(item.name),
      left: item.id,
      attributes: [],
    });
  }

  for (const item of matching.added) {
    mark(right, item, "added");
    requirements(item).forEach((requirement) => mark(right, requirement, "added"));
    changes.push({ kind: "added", type: typeLabel(item.$type), name: text(item.name), right: item.id, attributes: [] });
  }

  for (const [leftItem, rightItem] of matching.pairs) {
    const id = text(rightItem.id);
    const attributes = attributeChanges(leftItem, rightItem, DRG_PROPERTIES);
    const described = { type: typeLabel(rightItem.$type), name: text(rightItem.name), left: id, right: id };

    if (attributes.length > 0) {
      changes.push({ kind: "changed", ...described, attributes });
    }

    const logicDiffers = compareLogic(leftItem, rightItem);

    compareRequirements(leftItem, rightItem);

    if (attributes.length > 0 || logicDiffers) {
      mark(left, leftItem, "changed");
      mark(right, rightItem, "changed");
    } else if (leftLayout.get(id) !== rightLayout.get(id)) {
      mark(left, leftItem, "layout");
      mark(right, rightItem, "layout");
      changes.push({ kind: "layout", ...described, attributes: [] });
    }
  }

  return { changes: byKind(changes), left, right };
};

export default dmnDiffer;
