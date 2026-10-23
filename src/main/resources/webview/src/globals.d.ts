declare const window: Window &
    typeof globalThis & {
        processMessageFromHost: (...args: any[]) => void
        sendMessageToHost: (...args: any[]) => void
        bpmn2Data: {
            baseUrl: string;
            file: string;
            theme: string;
        };
    }

interface Window {
    /** Installed by the Viewer; the Kotlin host calls it with precise wheel deltas in OSR mode. */
    bpmn2Wheel?: (dx: number, dy: number, x: number, y: number, ctrl: boolean, meta: boolean) => void;
    /** Installed by the Viewer; the Kotlin host forwards macOS trackpad pinch gestures here. */
    bpmn2Pinch?: (phase: "start" | "move" | "end", magnification: number, x: number, y: number) => void;
}

declare module 'bpmn-js/lib/NavigatedViewer' {
    export default class BpmnJS {
        constructor(options?: {
            container: HTMLElement | null;
            width?: string | number;
            height?: string | number;
            bpmnRenderer?: object;
            textRenderer?: object;
            additionalModules?: Array;
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
            | 'zoomScroll');

        invoke(fn: (...v: any[]) => void | any[]): void;

        on(name: string, callback: function): void;

        clear(): void;

        importXML(
            xml: string,
        ): void;

        detach(): void;
    }
}
