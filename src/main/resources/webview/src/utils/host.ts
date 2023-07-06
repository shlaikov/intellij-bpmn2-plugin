class Host {
    listeners: any[] = [];

    sendMessageToHost: any;

    constructor() {
        const { sendMessageToHost }: any = window;

        (window as any).processMessageFromHost = (message: any): void => {
            for (const l of this.listeners) {
                l(message);
            }
        };

        let queue: any[] = [];

        if (sendMessageToHost) {
            this.sendMessageToHost = sendMessageToHost;
        } else {
            this.sendMessageToHost = (message: any) => {
                queue.push(message);
            };

            Object.defineProperty(window, "sendMessageToHost", {
                get: () => this.sendMessageToHost,
                set: (value) => {
                    this.sendMessageToHost = value;

                    for (const item of queue) {
                        this.sendMessageToHost(item);
                    }

                    queue.length = 0;
                },
            });
        }
    }

    sendMessage(message: any) {
        this.sendMessageToHost(
            typeof message === "string" ? message : JSON.stringify(message)
        );
    }

    addMessageListener(listener: any) {
        this.listeners.push(listener);
    }

    removeMessageListener() {
        this.listeners = []
    }

    log(...msg: any[]) {
        console.log(msg);
    }
}

export default Host