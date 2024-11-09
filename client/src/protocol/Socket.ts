import { BufferReader, BufferWriter } from '../../../shared/packet/index';

export class Socket {
    private static _instance: Socket;
    ws!: WebSocket;
    writer: BufferWriter = new BufferWriter();
    readonly URL = 'ws://localhost:9001/ws';

    static getInstance(): Socket {
        if (!Socket._instance) {
            Socket._instance = new Socket();
        }
        return Socket._instance;
    }

    connect(): void {
        if (this.isOpen()) {
            throw new Error('Socket_connect: Socket is already open!');
        }

        if (this.isConnecting()) {
            throw new Error('Socket_connect: Socket is already connecting!');
        }

        this.ws = new WebSocket(this.URL);
        this.ws.onopen = this.open.bind(this);
        this.ws.onclose = this.close.bind(this);
        this.ws.onerror = this.error.bind(this);
        this.ws.onmessage = this.message.bind(this);
    }

    send(): void {
        if (this.isOpen()) {
            this.ws.send(this.writer.getBuffer());
            this.writer.clear();
        }
    }

    private isOpen(): boolean {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    private isConnecting(): boolean {
        return this.ws && this.ws.readyState === WebSocket.CONNECTING;
    }

    private open() {
        console.log('ws opened');
    }

    private close() {
        console.log('ws closed');
    }

    private error() {
        console.error('ws error');
    }

    private message() {
        console.log('ws message');
    }
}
