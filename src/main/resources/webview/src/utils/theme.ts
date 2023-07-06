export const darkType = 'dark'
export const lightType = 'light'

export enum ThemeType {
    Dark = darkType,
    Light = lightType
}

export interface ITheme {
    defaultFillColor: string;
    defaultStrokeColor: string;
}

export interface ThemeColorOptions {
    lightType: ITheme;
    darkType: ITheme;
}

export const THEME: ThemeColorOptions = {
    lightType: { defaultFillColor: "#fff", defaultStrokeColor: "#212121" },
    darkType: { defaultFillColor: "#212121", defaultStrokeColor: "#fff" }
}

export function getBackgroundColor(theme: ThemeType) {
    return theme === ThemeType.Light ? "#fff" : "#000"
}

export default THEME;
