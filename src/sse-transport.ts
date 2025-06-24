import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class SSEServerTransport implements Transport {
  private messageHandlers: ((message: JSONRPCMessage) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private eventSource: EventTarget | null = null;

  constructor(private request: Request, private responseStream: WritableStreamDefaultWriter) {}

  async start(): Promise<void> {
    // Send SSE headers
    await this.responseStream.write(
      new TextEncoder().encode(
        "HTTP/1.1 200 OK\r\n" +
        "Content-Type: text/event-stream\r\n" +
        "Cache-Control: no-cache\r\n" +
        "Connection: keep-alive\r\n" +
        "Access-Control-Allow-Origin: *\r\n" +
        "\r\n"
      )
    );

    // Read incoming messages from request body
    if (this.request.body) {
      const reader = this.request.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                this.messageHandlers.forEach(handler => handler(message));
              } catch (error) {
                console.error("Failed to parse message:", error);
              }
            }
          }
        }
      } catch (error) {
        this.errorHandlers.forEach(handler => handler(error as Error));
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    const data = JSON.stringify(message);
    const sseMessage = `data: ${data}\n\n`;
    await this.responseStream.write(new TextEncoder().encode(sseMessage));
  }

  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.closeHandlers.forEach(handler => handler());
    await this.responseStream.close();
  }
}