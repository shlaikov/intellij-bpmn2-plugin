// bpmn-js-differ ships no type declarations; this covers the part of the API the plugin uses.

declare module "bpmn-js-differ" {
  export interface ModdleElement {
    $type: string;
    id?: string;
    name?: string;
    [property: string]: unknown;
  }

  export interface Result {
    _added: Record<string, ModdleElement>;
    _removed: Record<string, ModdleElement>;
    _changed: Record<string, { model: ModdleElement; attrs: Record<string, { oldValue: unknown; newValue: unknown }> }>;
    _layoutChanged: Record<string, ModdleElement>;
  }

  /** Compares two `bpmn:Definitions` trees; the keys of the result's maps are element ids. */
  export function diff(a: unknown, b: unknown): Result;
}
