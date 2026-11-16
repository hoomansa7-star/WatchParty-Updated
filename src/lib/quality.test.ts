import test from "node:test";
import assert from "node:assert/strict";
import {
  inferMovieQualityFromDate,
  inferMovieQualityFromReleaseDates,
  getQualityBadgeClass,
} from "./quality";

const NOW = new Date("2026-11-15T00:00:00Z").getTime();

test("inferMovieQualityFromReleaseDates prioritizes Physical -> BLURAY over Digital -> WEB-DL", () => {
  const q = inferMovieQualityFromReleaseDates(
    [
      {
        iso_3166_1: "US",
        release_dates: [
          { release_date: "2026-07-01T00:00:00Z", type: 3 },
          { release_date: "2026-09-15T00:00:00Z", type: 4 },
          { release_date: "2026-11-01T00:00:00Z", type: 5 },
        ],
      },
    ],
    null,
    NOW
  );
  assert.equal(q, "BLURAY");
});

test("inferMovieQualityFromReleaseDates returns WEB-DL when digital released and physical is future", () => {
  const q = inferMovieQualityFromReleaseDates(
    [
      {
        iso_3166_1: "US",
        release_dates: [
          { release_date: "2026-09-01T00:00:00Z", type: 3 },
          { release_date: "2026-11-01T00:00:00Z", type: 4 },
          { release_date: "2026-12-20T00:00:00Z", type: 5 },
        ],
      },
    ],
    null,
    NOW
  );
  assert.equal(q, "WEB-DL");
});

test("inferMovieQualityFromReleaseDates returns HDCAM during theatrical window and SOON when unreleased", () => {
  const hdcam = inferMovieQualityFromReleaseDates(
    [
      {
        iso_3166_1: "US",
        release_dates: [{ release_date: "2026-11-01T00:00:00Z", type: 3 }],
      },
    ],
    null,
    NOW
  );
  assert.equal(hdcam, "HDCAM");

  const soon = inferMovieQualityFromReleaseDates(
    [
      {
        iso_3166_1: "US",
        release_dates: [{ release_date: "2026-12-18T00:00:00Z", type: 3 }],
      },
    ],
    null,
    NOW
  );
  assert.equal(soon, "SOON");
});

test("inferMovieQualityFromDate handles fallback date windows and getQualityBadgeClass assigns distinct styles", () => {
  assert.equal(inferMovieQualityFromDate("2026-12-25", NOW), "SOON");
  assert.equal(inferMovieQualityFromDate("2026-11-01", NOW), "HDCAM");
  assert.equal(inferMovieQualityFromDate("2026-09-01", NOW), "WEB-DL");
  assert.equal(inferMovieQualityFromDate("2025-05-01", NOW), "BLURAY");

  assert.match(getQualityBadgeClass("BLURAY"), /bg-sky-600/);
  assert.match(getQualityBadgeClass("WEB-DL"), /bg-purple-600/);
  assert.match(getQualityBadgeClass("HDCAM"), /bg-amber-600/);
});
