declare const window: Window &
    typeof globalThis & {
        bpmn2Data: {
            baseUrl: string;
            lang: string;
            file: string;
            showChrome: "1" | "0";
        };
    }

declare module 'bpmn-js/lib/NavigatedViewer' {
    export default class BpmnJS {
        constructor(options?: {
            container: HTMLInputElement | null;
            width?: string | number;
            height?: string | number;
            position?: string;
            deferUpdate?: boolean;
        });

        get(name: | 'canvas'
            | 'elementFactory'
            | 'elementRegistry'
            | 'eventBus'
            | 'moddle'
            | 'modeling'
            | 'translate'
            | 'defaultRenderer');

        invoke(fn: (...v: any[]) => void | any[]): void;

        clear(): void;

        importXML(
            xml: string,
        ): void;

        destroy(): void;
    }
}
