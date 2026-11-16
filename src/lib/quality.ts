export type MovieQuality = "BLURAY" | "WEB-DL" | "HDRIP" | "HDCAM" | "TS" | "SOON";

export interface TmdbReleaseDateItem {
  release_date: string;
  type: number; // 1: Premiere, 2: Theatrical (limited), 3: Theatrical, 4: Digital, 5: Physical, 6: TV
}

export interface TmdbCountryReleases {
  iso_3166_1: string;
  release_dates: TmdbReleaseDateItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fallback quality inference from a single release_date string when full
 * TMDB release_dates breakdown is unavailable.
 */
export function inferMovieQualityFromDate(
  releaseDate?: string | null,
  nowMs = Date.now()
): MovieQuality {
  if (!releaseDate) return "WEB-DL";
  const ts = new Date(releaseDate).getTime();
  if (Number.isNaN(ts)) return "WEB-DL";

  if (ts > nowMs) return "SOON";

  const ageDays = (nowMs - ts) / DAY_MS;
  if (ageDays < 45) return "HDCAM";
  if (ageDays < 110) return "WEB-DL";
  return "BLURAY";
}

/**
 * Determine the highest available release quality from TMDB `/movie/{id}/release_dates`
 * results. Priority order:
 * 1. Physical (type 5) already released -> BLURAY
 * 2. Digital / TV (type 4 or 6) already released -> WEB-DL
 * 3. Theatrical / Premiere (type 1, 2, 3) already released:
 *    - >= 120 days old (legacy catalog without explicit digital/physical metadata) -> BLURAY
 *    - >= 75 days old -> WEB-DL
 *    - < 75 days old (in theaters) -> HDCAM
 * 4. All release dates in the future -> SOON
 */
export function inferMovieQualityFromReleaseDates(
  countries: TmdbCountryReleases[] | null | undefined,
  fallbackReleaseDate?: string | null,
  nowMs = Date.now()
): MovieQuality {
  if (!countries || countries.length === 0) {
    return inferMovieQualityFromDate(fallbackReleaseDate, nowMs);
  }

  let hasPhysical = false;
  let hasDigital = false;
  let earliestTheatricalMs: number | null = null;
  let hasAnyDate = false;

  for (const country of countries) {
    for (const item of country.release_dates || []) {
      const ts = new Date(item.release_date).getTime();
      if (Number.isNaN(ts)) continue;
      hasAnyDate = true;
      if (ts > nowMs) continue; // Future release

      if (item.type === 5) {
        hasPhysical = true;
      } else if (item.type === 4 || item.type === 6) {
        hasDigital = true;
      } else if (item.type === 1 || item.type === 2 || item.type === 3) {
        if (earliestTheatricalMs === null || ts < earliestTheatricalMs) {
          earliestTheatricalMs = ts;
        }
      }
    }
  }

  if (hasPhysical) return "BLURAY";
  if (hasDigital) return "WEB-DL";

  if (earliestTheatricalMs !== null) {
    const ageDays = (nowMs - earliestTheatricalMs) / DAY_MS;
    if (ageDays >= 120) return "BLURAY";
    if (ageDays >= 75) return "WEB-DL";
    return "HDCAM";
  }

  if (hasAnyDate) return "SOON";

  return inferMovieQualityFromDate(fallbackReleaseDate, nowMs);
}

export function getQualityBadgeClass(quality: string): string {
  const q = quality.toUpperCase();
  if (q.includes("BLURAY") || q.includes("4K")) {
    return "bg-sky-600/95 text-white border-sky-300/30";
  }
  if (q.includes("WEB-DL") || q.includes("WEBDL") || q.includes("WEB")) {
    return "bg-purple-600/95 text-white border-purple-300/30";
  }
  if (q.includes("HDRIP") || q.includes("HD")) {
    return q.includes("CAM")
      ? "bg-amber-600/95 text-white border-amber-300/30"
      : "bg-indigo-600/95 text-white border-indigo-300/30";
  }
  if (q.includes("CAM") || q === "TS") {
    return "bg-amber-600/95 text-white border-amber-300/30";
  }
  if (q === "SOON") {
    return "bg-zinc-700/95 text-zinc-100 border-white/20";
  }
  return "bg-purple-600/95 text-white border-purple-300/30";
}
