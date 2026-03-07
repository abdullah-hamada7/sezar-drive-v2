import { API_BASE } from './http.service';

type RealtimeMessage = { type?: string; [key: string]: any };
type Listener = (message: RealtimeMessage) => void;

class RealtimeService {
    private ws: WebSocket | null = null;
    private listeners: Listener[] = [];
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private shouldReconnect = false;
    private token: string | null = null;

    private buildWsUrl(token: string) {
        const normalized = API_BASE.replace(/\/$/, '');
        const baseWithoutApi = normalized.replace(/\/api\/v1$/i, '');
        const wsBase = baseWithoutApi.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
        return `${wsBase}/ws/tracking?token=${encodeURIComponent(token)}`;
    }

    private emit(message: RealtimeMessage) {
        this.listeners.forEach((listener) => listener(message));
    }

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    connect(token: string) {
        this.token = token;
        this.shouldReconnect = true;

        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const url = this.buildWsUrl(token);
        const ws = new WebSocket(url);

        ws.onopen = () => {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                this.emit(parsed);
            } catch {
                this.emit({ type: 'unknown_message' });
            }
        };

        ws.onclose = () => {
            this.ws = null;
            if (!this.shouldReconnect || !this.token) return;
            this.reconnectTimer = setTimeout(() => this.connect(this.token as string), 5000);
        };

        ws.onerror = () => {
            ws.close();
        };

        this.ws = ws;
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const realtime = new RealtimeService();
