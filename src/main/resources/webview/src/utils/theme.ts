/** Must match `Theme.id` on the Kotlin side. */
export enum ThemeType {
  Dark = "dark",
  Light = "light",
}

export function isTheme(value: unknown): value is ThemeType {
  return value === ThemeType.Dark || value === ThemeType.Light;
}

export function getBackgroundColor(theme: ThemeType): string {
  return theme === ThemeType.Light ? "#fff" : "#000";
}

/** Default shape colours, in the form both the bpmn-js and the dmn-js DRD renderers take as config. */
export function diagramColors(theme: ThemeType) {
  return theme === ThemeType.Light
    ? { defaultFillColor: "#fff", defaultStrokeColor: "#212121", defaultLabelColor: "#212121" }
    : { defaultFillColor: "#212121", defaultStrokeColor: "#fff", defaultLabelColor: "#fff" };
}
