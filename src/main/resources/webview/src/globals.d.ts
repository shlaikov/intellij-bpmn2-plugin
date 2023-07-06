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
