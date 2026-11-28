import "./style.css";

import type { ChangeKind, DiagramViewTab } from "../../formats/types";

interface Props {
  views: DiagramViewTab[];
  active: string | null;
  onSelect(viewId: string): void;
  /** In a comparison: the views that differ, by id. */
  marks?: ReadonlyMap<string, ChangeKind>;
}

/** Switches between the parts of a multi-view document (a DMN file's DRD and its decisions). */
function ViewTabs({ views, active, onSelect, marks }: Props) {
  return (
    <nav className="io-view-tabs">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={view.id === active ? "io-view-tab io-view-tab--active" : "io-view-tab"}
          title={view.name}
          onClick={() => onSelect(view.id)}
        >
          {marks?.has(view.id) && <span className={`io-view-tab__mark io-view-tab__mark--${marks.get(view.id)}`} />}
          {view.name}
        </button>
      ))}
    </nav>
  );
}

export default ViewTabs;
