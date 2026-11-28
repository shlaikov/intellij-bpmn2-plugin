import "./style.css";

import type { Change, ChangeKind } from "../../formats/types";

interface Props {
  /** `null`: the two documents could not be compared, `message` says why. */
  changes: Change[] | null;
  message: string;
  selected: Change | null;
  onSelect(change: Change): void;
  onClose(): void;
}

export const KIND_LABELS: Record<ChangeKind, string> = {
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  layout: "Moved",
};

const KINDS = Object.keys(KIND_LABELS) as ChangeKind[];

/** What differs between the two documents; picking an entry shows the element on both sides. */
function ChangeList({ changes, message, selected, onSelect, onClose }: Props) {
  const count = (kind: ChangeKind) => changes?.filter((change) => change.kind === kind).length ?? 0;

  return (
    <aside className="io-changes">
      <header className="io-changes__header">
        <span className="io-changes__heading">Changes</span>

        {KINDS.filter(count).map((kind) => (
          <span key={kind} className={`io-changes__count io-changes__count--${kind}`} title={KIND_LABELS[kind]}>
            {count(kind)}
          </span>
        ))}

        <button type="button" className="io-changes__close" title="Hide the list of changes" onClick={onClose}>
          ×
        </button>
      </header>

      {changes && changes.length > 0 ? (
        <ul className="io-changes__list">
          {changes.map((change, index) => (
            <li
              key={index}
              className={`io-changes__item${change === selected ? " io-changes__item--selected" : ""}`}
              onClick={() => onSelect(change)}
            >
              <span className={`io-changes__kind io-changes__kind--${change.kind}`} title={KIND_LABELS[change.kind]} />

              <div className="io-changes__body">
                <div className="io-changes__title">
                  <span className="io-changes__type">{change.type}</span> {change.name}
                </div>

                {change.attributes.map((attribute) => (
                  <div key={attribute.name} className="io-changes__attribute">
                    <span className="io-changes__attribute-name">{attribute.name}:</span>{" "}
                    {attribute.before && <del>{attribute.before}</del>}
                    {attribute.before && attribute.after && " → "}
                    {attribute.after && <ins>{attribute.after}</ins>}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="io-changes__empty">{changes ? "No differences in the diagram" : message}</p>
      )}
    </aside>
  );
}

export default ChangeList;
