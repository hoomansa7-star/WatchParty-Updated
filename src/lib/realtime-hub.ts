export interface HubRoomMember {
  userId: string;
  username: string;
  socketId: string;
  isHost: boolean;
  isVideoChat?: boolean;
  isMuted?: boolean;
}

export interface HubPlaybackState {
  currentTime: number;
  isPlaying: boolean;
  lastUpdate: number;
  hostSocketId: string | null;
}

export interface HubRoomState {
  id: string;
  members: Map<string, HubRoomMember>;
  playback: HubPlaybackState;
}

export type HubEmitFn = (event: string, payload: unknown) => void;

interface ClientSession {
  clientId: string;
  emit: HubEmitFn;
  rooms: Set<string>;
  userByRoom: Map<string, { userId: string; username: string }>;
  userChannelId: string | null;
}

export function computeEffectiveTime(playback: HubPlaybackState, now = Date.now()): number {
  if (!playback.isPlaying) return playback.currentTime;
  const elapsedSec = Math.max(0, (now - playback.lastUpdate) / 1000);
  return playback.currentTime + elapsedSec;
}

export class RealtimeHub {
  private rooms = new Map<string, HubRoomState>();
  private clients = new Map<string, ClientSession>();

  registerClient(clientId: string, emit: HubEmitFn): void {
    const existing = this.clients.get(clientId);
    if (existing) {
      existing.emit = emit;
      return;
    }
    this.clients.set(clientId, {
      clientId,
      emit,
      rooms: new Set(),
      userByRoom: new Map(),
      userChannelId: null,
    });
  }

  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const roomId of Array.from(client.rooms)) {
      const userInfo = client.userByRoom.get(roomId);
      if (userInfo) {
        this.leaveRoom(clientId, { roomId, userId: userInfo.userId });
      }
    }

    this.clients.delete(clientId);
  }

  private getOrCreateRoom(roomId: string): HubRoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        members: new Map(),
        playback: {
          currentTime: 0,
          isPlaying: false,
          lastUpdate: Date.now(),
          hostSocketId: null,
        },
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  private emitToClient(clientId: string, event: string, payload: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    try {
      client.emit(event, payload);
    } catch {
      // Ignore closed stream errors
    }
  }

  private emitToRoom(roomId: string, event: string, payload: unknown, exceptClientId?: string): void {
    for (const client of this.clients.values()) {
      if (client.rooms.has(roomId) && client.clientId !== exceptClientId) {
        this.emitToClient(client.clientId, event, payload);
      }
    }
  }

  private emitToUser(userId: string, event: string, payload: unknown): void {
    for (const client of this.clients.values()) {
      if (client.userChannelId === userId) {
        this.emitToClient(client.clientId, event, payload);
      }
    }
  }

  private broadcastMembers(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    this.emitToRoom(roomId, "room:members", {
      members: Array.from(room.members.values()),
    });
  }

  private systemMessage(roomId: string, message: string, userId?: string): void {
    const msg = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      userId: userId || "system",
      username: "System",
      content: message,
      type: "SYSTEM",
      createdAt: new Date().toISOString(),
    };
    this.emitToRoom(roomId, "chat:message", msg);
  }

  handleEvent(clientId: string, event: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (event) {
      case "user:register": {
        if (data?.userId) {
          client.userChannelId = data.userId;
        }
        break;
      }

      case "join:room": {
        const roomId = data?.roomId;
        const userId = data?.userId;
        const username = data?.username || "Guest";
        const isHost = Boolean(data?.isHost);
        if (!roomId || !userId) return;

        const room = this.getOrCreateRoom(roomId);
        client.rooms.add(roomId);
        client.userByRoom.set(roomId, { userId, username });

        room.members.set(userId, {
          userId,
          username,
          socketId: clientId,
          isHost,
          isVideoChat: false,
          isMuted: false,
        });

        if (isHost) {
          room.playback.hostSocketId = clientId;
        }

        this.broadcastMembers(roomId);
        this.emitToClient(clientId, "playback:sync", {
          roomId,
          currentTime: computeEffectiveTime(room.playback),
          isPlaying: room.playback.isPlaying,
          serverTimestamp: Date.now(),
        });

        if (!isHost && room.playback.hostSocketId) {
          this.emitToClient(room.playback.hostSocketId, "playback:request-sync", {
            roomId,
            requesterId: userId,
          });
        }
        break;
      }

      case "leave:room": {
        this.leaveRoom(clientId, {
          roomId: data?.roomId,
          userId: data?.userId,
        });
        break;
      }

      case "chat:message": {
        const roomId = data?.roomId;
        if (!roomId) return;
        const msg = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          userId: data.userId || "system",
          username: data.username || "Guest",
          content: String(data.content || ""),
          type: data.type || "TEXT",
          createdAt: new Date().toISOString(),
        };
        this.emitToRoom(roomId, "chat:message", msg);
        break;
      }

      case "chat:reaction": {
        if (!data?.roomId) return;
        this.emitToRoom(data.roomId, "chat:reaction", {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          emoji: data.emoji,
          userId: data.userId,
          username: data.username,
        });
        break;
      }

      case "chat:typing": {
        if (!data?.roomId) return;
        this.emitToRoom(
          data.roomId,
          "chat:typing",
          { userId: data.userId, username: data.username },
          clientId
        );
        break;
      }

      case "playback:sync": {
        const room = this.rooms.get(data?.roomId);
        if (!room) return;
        if (room.playback.hostSocketId !== clientId) return;
        room.playback = {
          currentTime: Number(data.currentTime) || 0,
          isPlaying: Boolean(data.isPlaying),
          lastUpdate: Date.now(),
          hostSocketId: clientId,
        };
        this.emitToRoom(data.roomId, "playback:sync", {
          roomId: data.roomId,
          currentTime: room.playback.currentTime,
          isPlaying: room.playback.isPlaying,
          serverTimestamp: Date.now(),
        });
        break;
      }

      case "playback:seek": {
        const room = this.rooms.get(data?.roomId);
        if (!room) return;
        if (room.playback.hostSocketId !== clientId) return;
        room.playback.currentTime = Number(data.currentTime) || 0;
        room.playback.lastUpdate = Date.now();
        this.emitToRoom(data.roomId, "playback:sync", {
          roomId: data.roomId,
          currentTime: room.playback.currentTime,
          isPlaying: room.playback.isPlaying,
          serverTimestamp: Date.now(),
        });
        break;
      }

      case "room:change-movie": {
        if (!data?.roomId) return;
        const room = this.rooms.get(data.roomId);
        if (room) {
          room.playback.currentTime = 0;
          room.playback.isPlaying = false;
          room.playback.lastUpdate = Date.now();
        }
        this.emitToRoom(data.roomId, "room:movie-changed", {
          roomId: data.roomId,
          movie: data.movie,
        });
        this.systemMessage(data.roomId, `Movie changed to "${data.movie?.title || "New Movie"}"`);
        break;
      }

      case "room:subtitle": {
        if (!data?.roomId) return;
        this.emitToRoom(data.roomId, "room:subtitle", data, clientId);
        if (data.title) {
          this.systemMessage(data.roomId, `زیرنویس فارسی "${data.title}" هماهنگ شد`);
        }
        break;
      }

      case "CMD:joinVideo":
      case "CMD:joinScreen": {
        for (const roomId of client.rooms) {
          const userInfo = client.userByRoom.get(roomId);
          const room = this.rooms.get(roomId);
          if (userInfo && room) {
            const member = room.members.get(userInfo.userId);
            if (member) {
              member.isVideoChat = true;
              this.broadcastMembers(roomId);
            }
          }
        }
        break;
      }

      case "CMD:leaveVideo":
      case "CMD:leaveScreen": {
        for (const roomId of client.rooms) {
          const userInfo = client.userByRoom.get(roomId);
          const room = this.rooms.get(roomId);
          if (userInfo && room) {
            const member = room.members.get(userInfo.userId);
            if (member) {
              member.isVideoChat = false;
              this.broadcastMembers(roomId);
            }
          }
        }
        break;
      }

      case "CMD:userMute": {
        for (const roomId of client.rooms) {
          const userInfo = client.userByRoom.get(roomId);
          const room = this.rooms.get(roomId);
          if (userInfo && room) {
            const member = room.members.get(userInfo.userId);
            if (member) {
              member.isMuted = Boolean(data?.isMuted);
              this.broadcastMembers(roomId);
            }
          }
        }
        break;
      }

      case "signal": {
        for (const roomId of client.rooms) {
          const room = this.rooms.get(roomId);
          const senderInfo = client.userByRoom.get(roomId);
          if (!room || !senderInfo) continue;
          const targetMember = room.members.get(data?.to);
          if (targetMember) {
            this.emitToClient(targetMember.socketId, "signal", {
              from: senderInfo.userId,
              msg: data.msg,
            });
            break;
          }
        }
        break;
      }

      case "notify:invite": {
        if (!data?.targetUserId) return;
        this.emitToUser(data.targetUserId, "notification:new", {
          type: "ROOM_INVITE",
          content: `${data.fromUsername} invited you to room: ${data.roomName}`,
          link: `/room/${data.roomId}`,
        });
        break;
      }

      case "dm:send": {
        if (!data?.targetUserId) return;
        this.emitToUser(data.targetUserId, "dm:receive", data.message);
        break;
      }
    }
  }

  leaveRoom(clientId: string, data: { roomId?: string; userId?: string }): void {
    const client = this.clients.get(clientId);
    const roomId = data.roomId;
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    const userId = data.userId || client?.userByRoom.get(roomId)?.userId;

    if (room && userId) {
      const member = room.members.get(userId);
      const wasHost = member?.isHost;
      room.members.delete(userId);
      if (member) {
        this.systemMessage(roomId, `${member.username} left`, userId);
      }
      if (wasHost) {
        room.playback.isPlaying = false;
        room.playback.lastUpdate = Date.now();
        room.playback.hostSocketId = null;
        this.emitToRoom(roomId, "playback:sync", {
          roomId,
          currentTime: computeEffectiveTime(room.playback),
          isPlaying: false,
          serverTimestamp: Date.now(),
        });
        this.systemMessage(roomId, "Host disconnected — playback paused");
      }
      this.broadcastMembers(roomId);
      if (room.members.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    if (client) {
      client.rooms.delete(roomId);
      client.userByRoom.delete(roomId);
    }
  }

  getRoomSnapshot(roomId: string): { members: HubRoomMember[]; playback: HubPlaybackState } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      members: Array.from(room.members.values()),
      playback: { ...room.playback },
    };
  }
}

const globalForHub = globalThis as unknown as {
  __watchpartyRealtimeHub?: RealtimeHub;
};

export const realtimeHub: RealtimeHub =
  globalForHub.__watchpartyRealtimeHub ?? (globalForHub.__watchpartyRealtimeHub = new RealtimeHub());
