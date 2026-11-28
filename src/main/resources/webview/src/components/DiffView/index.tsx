import "../DiagramView/style.css";
import "./markers.css";
import "./style.css";

import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from "react";

import ChangeList from "../ChangeList";
import ViewTabs from "../ViewTabs";
import ZoomBar from "../ZoomBar";
import { installInput, notifyReady } from "../../host/bridge";
import { Diagram, useDiagram } from "../../hooks/useDiagram";
import { compare } from "../../formats";
import type { Bounds, CanvasNavigation } from "../../formats/canvas/navigation";
import { Change, ChangeKind, DIAGRAM_VIEW, DiagramKind, DiagramViewTab, Diff } from "../../formats/types";
import { ThemeType } from "../../utils/theme";

/** One of the two documents; `xml` is `null` when the file does not exist in that version. */
export interface DiffSide {
  title: string;
  xml: string | null;
}

interface Props {
  kind: DiagramKind;
  theme: ThemeType;
  left: DiffSide;
  right: DiffSide;
}

/** The list of changes takes room the diagrams need more in a narrow preview. */
const LIST_MIN_WIDTH = 900;

/**
 * Views are matched across the two documents by element id; the diagram view (whose id is the id of the
 * definitions, free to differ) by being the diagram.
 */
const viewKey = (tab: DiagramViewTab): string => (tab.type === DIAGRAM_VIEW ? DIAGRAM_VIEW : tab.id);

const activeKey = (diagram: Diagram): string | null => {
  const active = diagram.views.tabs.find((tab) => tab.id === diagram.views.active);

  return active ? viewKey(active) : null;
};

function union(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Makes two canvases show the same part of their diagrams — both versions of a diagram share one coordinate
 * space, so the same viewbox puts an unchanged element at the same spot — and the same plane when a collapsed
 * sub-process is drilled into. Returns the function that separates them again.
 */
function link(a: CanvasNavigation, b: CanvasNavigation): () => void {
  let busy = false;

  const follow = (leader: CanvasNavigation, follower: CanvasNavigation, switchPlane: boolean) => () => {
    if (busy) {
      return;
    }

    busy = true;
    try {
      // A plane only one version has is looked at alone.
      if (!switchPlane || follower.setRoot(leader.rootId())) {
        follower.setViewbox(leader.viewbox());
      }
    } finally {
      busy = false;
    }
  };

  const unsubscribe = [
    a.onViewboxChanged(follow(a, b, false)),
    b.onViewboxChanged(follow(b, a, false)),
    a.onRootChanged(follow(a, b, true)),
    b.onRootChanged(follow(b, a, true)),
  ];

  return () => unsubscribe.forEach((off) => off());
}

/** Two versions of a document side by side, with what differs highlighted in both and listed next to them. */
function DiffView({ kind, theme, left: leftSide, right: rightSide }: Props) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const left = useDiagram(kind, leftSide.xml, theme, leftRef);
  const right = useDiagram(kind, rightSide.xml, theme, rightRef);

  const [diff, setDiff] = useState<Diff | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [selected, setSelected] = useState<Change | null>(null);
  const [listOpen, setListOpen] = useState(() => window.innerWidth >= LIST_MIN_WIDTH);
  const [view, setView] = useState<string | null>(null);

  const settled = left.settled && right.settled;

  useEffect(() => {
    if (settled) {
      notifyReady();
    }
  }, [settled]);

  // The comparison itself, once both documents are on screen.
  useEffect(() => {
    setDiff(null);
    setFailure(null);
    setSelected(null);

    const before = settled ? left.renderer?.definitions() : null;
    const after = settled ? right.renderer?.definitions() : null;

    if (!before || !after) {
      return;
    }

    let disposed = false;

    const run = async () => {
      try {
        const result = await compare(kind, before, after);
        if (disposed) {
          return;
        }

        left.renderer?.setMarks(result.left);
        right.renderer?.setMarks(result.right);
        setDiff(result);
      } catch (reason: unknown) {
        if (!disposed) {
          setFailure(reason instanceof Error ? reason.message : String(reason));
        }
      }
    };

    run();

    return () => {
      disposed = true;
    };
  }, [kind, settled, left.renderer, right.renderer]);

  const navigations = (): CanvasNavigation[] =>
    [left, right].flatMap((diagram) => diagram.renderer?.navigation() ?? []);

  /** Like the zoom bar's "reset" for one diagram, but for what the two of them cover together. */
  const fit = () => {
    const all = navigations();
    const content = all.flatMap((navigation) => navigation.contentBounds() ?? []);

    if (content.length > 0) {
      all.forEach((navigation) => navigation.fitTo(content.reduce(union)));
    }
  };

  // The active view of a DMN document changes which canvas there is to link, if any.
  useEffect(() => {
    const [a, b] = settled ? navigations() : [];

    return a && b ? link(a, b) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, left.renderer, right.renderer, left.views, right.views]);

  useEffect(() => {
    if (settled) {
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, left.renderer, right.renderer]);

  // Wheel and pinch go to the diagram under the pointer; the other one follows through the link.
  useEffect(
    () =>
      installInput((x, y) => {
        for (const [ref, diagram] of [
          [leftRef, left],
          [rightRef, right],
        ] as Array<[RefObject<HTMLElement>, Diagram]>) {
          const rect = ref.current?.getBoundingClientRect();

          if (rect && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
            return diagram.renderer?.navigation() ?? null;
          }
        }

        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [left.renderer, right.renderer]
  );

  // Views that are not a canvas (decision tables) scroll as HTML; keep the two at the same offset.
  useEffect(() => {
    const a = leftRef.current;
    const b = rightRef.current;
    if (!a || !b) {
      return;
    }

    const follow = (leader: HTMLElement, follower: HTMLElement) => () => {
      follower.scrollTop = leader.scrollTop;
      follower.scrollLeft = leader.scrollLeft;
    };
    const onLeft = follow(a, b);
    const onRight = follow(b, a);

    a.addEventListener("scroll", onLeft);
    b.addEventListener("scroll", onRight);

    return () => {
      a.removeEventListener("scroll", onLeft);
      b.removeEventListener("scroll", onRight);
    };
  }, []);

  // One row of tabs for both documents: both show the same view, as far as each has it.
  const tabs = useMemo(() => {
    const merged = new Map<string, DiagramViewTab>();

    // The right-hand (newer) document goes first, so its names win.
    for (const tab of [...right.views.tabs, ...left.views.tabs]) {
      const key = viewKey(tab);
      if (!merged.has(key)) {
        merged.set(key, { ...tab, id: key });
      }
    }

    return [...merged.values()];
  }, [left.views.tabs, right.views.tabs]);

  const leftKey = activeKey(left);
  const rightKey = activeKey(right);
  const shownKeys = useRef<{ left: string | null; right: string | null }>({ left: null, right: null });

  // A view can also be switched from inside a document (a decision table's "view DRD"): follow whichever moved.
  useEffect(() => {
    const shown = shownKeys.current;
    shownKeys.current = { left: leftKey, right: rightKey };

    if (leftKey && leftKey !== shown.left) {
      setView(leftKey);
    } else if (rightKey && rightKey !== shown.right) {
      setView(rightKey);
    }
  }, [leftKey, rightKey]);

  useEffect(() => {
    for (const diagram of [left, right]) {
      const tab = diagram.views.tabs.find((candidate) => viewKey(candidate) === view);

      if (tab && tab.id !== diagram.views.active) {
        diagram.selectView(tab.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, left.views, right.views]);

  // Runs again when a view has been switched, which is when the element of another view becomes reachable.
  useEffect(() => {
    left.renderer?.reveal(selected?.left ?? null);
    right.renderer?.reveal(selected?.right ?? null);
  }, [selected, left.renderer, right.renderer, left.views, right.views]);

  const select = (change: Change) => {
    setSelected(change);

    if (tabs.length > 0) {
      setView(change.view ?? DIAGRAM_VIEW);
    }
  };

  const tabMarks = useMemo(() => {
    const marks = new Map<string, ChangeKind>();

    for (const change of diff?.changes ?? []) {
      if (change.view) {
        marks.set(change.view, "changed");
      }
    }

    return marks;
  }, [diff]);

  const pane = (side: DiffSide, diagram: Diagram, ref: RefObject<HTMLDivElement>): ReactNode => {
    let notice: string | null = null;

    if (side.xml === null) {
      notice = "The file does not exist in this version";
    } else if (diagram.error) {
      notice = diagram.error.message;
    } else if (view && diagram.views.tabs.length > 0 && !diagram.views.tabs.some((tab) => viewKey(tab) === view)) {
      notice = "Not present in this version";
    }

    return (
      <section className="io-diff__pane">
        {/* Also when there is no title: the two panes must be the same size to show the same viewbox alike. */}
        <header className="io-diff__title" title={side.title}>
          {side.title || "\u00a0"}
        </header>

        <div className="io-diff__content">
          <div ref={ref} className="io-diagram-view__canvas io-diff__canvas" />

          {notice && <pre className={`io-diff__notice${diagram.error ? " io-diff__notice--error" : ""}`}>{notice}</pre>}
        </div>
      </section>
    );
  };

  const comparable = leftSide.xml !== null && rightSide.xml !== null && !left.error && !right.error;
  const message = failure ?? (comparable ? "Comparing…" : "There are no two versions to compare");

  return (
    <div className={`io-diagram-view io-diff theme-${theme}`}>
      {tabs.length > 1 && <ViewTabs views={tabs} active={view} onSelect={setView} marks={tabMarks} />}

      <div className="io-diff__body">
        <div className="io-diff__panes">
          {pane(leftSide, left, leftRef)}
          {pane(rightSide, right, rightRef)}

          {(left.views.navigable || right.views.navigable) && (
            <ZoomBar
              zoomOut={() => navigations()[0]?.zoomOut()}
              zoomIn={() => navigations()[0]?.zoomIn()}
              zoomReset={fit}
              theme={theme}
            />
          )}

          {!listOpen && (
            <button type="button" className="io-diff__open-list" onClick={() => setListOpen(true)}>
              Changes{diff ? ` (${diff.changes.length})` : ""}
            </button>
          )}
        </div>

        {listOpen && (
          <ChangeList
            changes={diff?.changes ?? null}
            message={message}
            selected={selected}
            onSelect={select}
            onClose={() => setListOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default DiffView;
