"use client";

type Listener = (...args: any[]) => void;

export interface RealtimeSocket {
  id: string;
  on: (event: string, fn: Listener) => this;
  off: (event: string, fn?: Listener) => this;
  emit: (event: string, data?: any) => this;
  disconnect: () => void;
}

class SseRealtimeSocket implements RealtimeSocket {
  public id: string;
  private listeners = new Map<string, Set<Listener>>();
  private eventSource: EventSource | null = null;
  private closed = false;
  private connected = false;
  private pendingQueue: Array<{ event: string; data: any }> = [];

  constructor() {
    this.id = `sock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    if (typeof window !== "undefined") {
      this.connect();
    }
  }

  private connect() {
    if (this.closed) return;
    const es = new EventSource(`/api/realtime?clientId=${encodeURIComponent(this.id)}`);
    this.eventSource = es;

    es.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.event === "connected") {
          this.connected = true;
          const queued = [...this.pendingQueue];
          this.pendingQueue = [];
          for (const item of queued) {
            this.sendEvent(item.event, item.data);
          }
          return;
        }
        this.dispatchLocal(parsed.event, parsed.data);
      } catch {
        // Ignore malformed SSE packets
      }
    };

    es.onerror = () => {
      this.connected = false;
    };
  }

  private dispatchLocal(event: string, data: any) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[realtime] handler error for ${event}:`, err);
      }
    }
  }

  private sendEvent(event: string, data: any) {
    if (this.closed) return;
    fetch("/api/realtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: this.id, event, data }),
      keepalive: true,
    }).catch(() => null);
  }

  on(event: string, fn: Listener): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return this;
  }

  off(event: string, fn?: Listener): this {
    if (!fn) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, data?: any): this {
    if (this.closed) return this;
    if (!this.connected) {
      this.pendingQueue.push({ event, data });
      return this;
    }
    this.sendEvent(event, data);
    return this;
  }

  disconnect(): void {
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    this.pendingQueue = [];
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
  }
}

export function createRealtimeSocket(): RealtimeSocket {
  return new SseRealtimeSocket();
}
