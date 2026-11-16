import test from "node:test";
import assert from "node:assert/strict";
import { getMovieEmbedServers, getTvEmbedServers } from "./embed-servers";

test("getMovieEmbedServers places sandbox-compatible players at the top of the list", () => {
  const servers = getMovieEmbedServers(1244944);
  assert.ok(servers.length >= 5);
  assert.equal(servers[0].id, "vidzee");
  assert.equal(servers[0].sandboxCompatible, true);
  assert.equal(servers[1].id, "moviesapi");
  assert.equal(servers[1].sandboxCompatible, true);
  assert.equal(servers[2].id, "smashystream");
  assert.equal(servers[2].sandboxCompatible, true);

  const firstIncompatibleIdx = servers.findIndex((s) => !s.sandboxCompatible);
  const lastCompatibleIdx = servers.reduce(
    (acc, s, idx) => (s.sandboxCompatible ? idx : acc),
    -1
  );
  assert.ok(
    lastCompatibleIdx < firstIncompatibleIdx,
    "All sandboxCompatible servers must come before sandbox-restricted mirrors"
  );
});

test("getTvEmbedServers constructs valid season and episode URLs", () => {
  const servers = getTvEmbedServers(1396, 2, 5);
  assert.equal(servers[0].url, "https://player.vidzee.wtf/embed/tv/1396/2/5");
  assert.equal(servers[1].url, "https://moviesapi.to/tv/1396-2-5");
});
