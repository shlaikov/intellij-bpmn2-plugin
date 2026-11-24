import "./style.css";

import type { DiagramViewTab } from "../../renderers/types";

interface Props {
  views: DiagramViewTab[];
  active: string | null;
  onSelect(viewId: string): void;
}

/** Switches between the parts of a multi-view document (a DMN file's DRD and its decisions). */
function ViewTabs({ views, active, onSelect }: Props) {
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
          {view.name}
        </button>
      ))}
    </nav>
  );
}

export default ViewTabs;
