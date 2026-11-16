import test from "node:test";
import assert from "node:assert/strict";
import { RealtimeHub, computeEffectiveTime } from "./realtime-hub";

test("computeEffectiveTime advances only while playing", () => {
  const paused = computeEffectiveTime(
    { currentTime: 42, isPlaying: false, lastUpdate: 1000, hostSocketId: "h1" },
    6000
  );
  assert.equal(paused, 42);

  const playing = computeEffectiveTime(
    { currentTime: 42, isPlaying: true, lastUpdate: 1000, hostSocketId: "h1" },
    6000
  );
  assert.equal(playing, 47);
});

test("RealtimeHub handles room join, chat broadcast, playback sync, and host disconnect", () => {
  const hub = new RealtimeHub();
  const hostEvents: Array<{ event: string; payload: any }> = [];
  const guestEvents: Array<{ event: string; payload: any }> = [];

  hub.registerClient("sock_host", (event, payload) => hostEvents.push({ event, payload }));
  hub.registerClient("sock_guest", (event, payload) => guestEvents.push({ event, payload }));

  hub.handleEvent("sock_host", "join:room", {
    roomId: "room_1",
    userId: "u_host",
    username: "HostUser",
    isHost: true,
  });

  hub.handleEvent("sock_guest", "join:room", {
    roomId: "room_1",
    userId: "u_guest",
    username: "GuestUser",
    isHost: false,
  });

  const snap = hub.getRoomSnapshot("room_1");
  assert.ok(snap);
  assert.equal(snap.members.length, 2);
  assert.ok(hostEvents.some((e) => e.event === "playback:request-sync"));

  // Guest cannot hijack host playback sync
  hub.handleEvent("sock_guest", "playback:sync", {
    roomId: "room_1",
    currentTime: 99,
    isPlaying: true,
  });
  assert.equal(hub.getRoomSnapshot("room_1")?.playback.currentTime, 0);

  // Host can sync playback
  hub.handleEvent("sock_host", "playback:sync", {
    roomId: "room_1",
    currentTime: 120,
    isPlaying: true,
  });
  assert.equal(hub.getRoomSnapshot("room_1")?.playback.currentTime, 120);
  assert.equal(hub.getRoomSnapshot("room_1")?.playback.isPlaying, true);
  assert.ok(guestEvents.some((e) => e.event === "playback:sync" && e.payload.currentTime === 120));

  // Chat message broadcasts to all room members
  hub.handleEvent("sock_guest", "chat:message", {
    roomId: "room_1",
    userId: "u_guest",
    username: "GuestUser",
    content: "Hello WatchParty!",
  });
  assert.ok(hostEvents.some((e) => e.event === "chat:message" && e.payload.content === "Hello WatchParty!"));

  // Host disconnect pauses playback for remaining members
  hub.unregisterClient("sock_host");
  assert.equal(hub.getRoomSnapshot("room_1")?.playback.isPlaying, false);
  assert.ok(guestEvents.some((e) => e.event === "playback:sync" && e.payload.isPlaying === false));
});
