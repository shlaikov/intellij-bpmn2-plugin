class HostEvent extends Event {
    type: string;
    message: any;

    constructor(type: string, message = {}) {
        super(type);

        this.type = type;
        this.message = message;
    }

    public toString(): string {
        return JSON.stringify({
            'event': this.type,
            ...this.message
        });
    }
}

export default HostEvent;
