export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  handleSession(webSocket) {
    webSocket.accept();
    this.sessions.push(webSocket);

    webSocket.addEventListener("message", async (msg) => {
      // Broadcast message to all other connected clients in this room
      const data = msg.data;
      this.broadcast(data, webSocket);
    });

    webSocket.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== webSocket);
    });
  }

  broadcast(message, sender) {
    this.sessions.forEach((session) => {
      if (session.readyState === WebSocket.READY) {
        // Echo back to everyone including sender (simplified state sync)
        // Or exclude sender: if (session !== sender)
        // For this app, Host is source of truth, so we simply relay everything.
        session.send(message);
      }
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1).split("/");
    
    // Path format: /ws/<ROOM_CODE>
    if (path[0] === "ws" && path[1]) {
      const roomCode = path[1].toUpperCase();
      const id = env.GAME_ROOM.idFromName(roomCode);
      const obj = env.GAME_ROOM.get(id);
      return obj.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};