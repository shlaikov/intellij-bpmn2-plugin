// dmn-js and dmn-migrate ship no type declarations; this covers the part of the API the plugin uses.

declare module "dmn-js/lib/NavigatedViewer" {
  export interface View {
    id: string;
    name?: string;
    /** `drd`, `decisionTable`, `literalExpression` or `boxedExpression`. */
    type: string;
  }

  /** The viewer of one view type; the DRD one is a diagram-js instance. */
  export interface ViewViewer {
    get(service: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  export default class DmnJS {
    constructor(options: { container: HTMLElement; drd?: object; decisionTable?: object; common?: object });

    importXML(xml: string): Promise<{ warnings: unknown[] }>;
    getViews(): View[];
    getActiveView(): View | undefined;
    getActiveViewer(): ViewViewer | undefined;
    open(view: View): Promise<unknown>;
    on(event: string, callback: () => void): void;
    destroy(): void;
  }
}

declare module "@bpmn-io/dmn-migrate" {
  export function migrateDiagram(xml: string): Promise<string>;
}
