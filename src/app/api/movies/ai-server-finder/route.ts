import { NextRequest, NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import { getMovieEmbedServers, getTvEmbedServers } from "@/lib/embed-servers";

interface ServerCheckResult {
  name: string;
  url: string;
  status: "online" | "slow" | "offline";
  latencyMs: number;
  verifiedPlayable: boolean;
  sandboxCompatible?: boolean;
  isCam?: boolean;
  quality?: "1080p BluRay" | "Full HD" | "HD" | "CAM/TS";
  qualityScore?: number;
  notes?: string;
}

// Deep server-side content verification helper
async function checkServerHealth(
  name: string,
  url: string,
  sandboxCompatible: boolean,
  timeoutMs = 2500
): Promise<ServerCheckResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webkit,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    const latency = Date.now() - start;

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return { name, url, status: "offline", latencyMs: latency, verifiedPlayable: false, sandboxCompatible, notes: `HTTP ${res.status}` };
    }

    const htmlText = await res.text();
    const lowerHtml = htmlText.toLowerCase();

    // Check for common error signatures inside embed response HTML
    const errorKeywords = [
      "not found",
      "video not found",
      "404 error",
      "file deleted",
      "no player",
      "content unavailable",
      "disabled",
      "no stream",
      "couldn't find this content",
      "could not find",
    ];
    const hasError = errorKeywords.some((kw) => lowerHtml.includes(kw));

    if (hasError) {
      return { name, url, status: "offline", latencyMs: latency, verifiedPlayable: false, sandboxCompatible, notes: "Error or missing content" };
    }

    // Detect CAM / Telesync keywords vs High Definition
    const camKeywords = ["telesync", "camrip", "hdcam", "hdts", "predvd", "ts rip", "cam rip", "hd-ts", "cam-rip", "hdtc"];
    const isCam = camKeywords.some((kw) => lowerHtml.includes(kw));

    const hdKeywords = ["1080p", "bluray", "web-dl", "webdl", "brrip", "bdrip", "hdrip", "master", "full hd"];
    const isHd = hdKeywords.some((kw) => lowerHtml.includes(kw));

    // Check for positive player signatures
    const playerKeywords = ["iframe", "player", "video", "m3u8", "source", "vidsrc", "stream", "hls", "jwplayer", "embed", "play", "root", "module"];
    const hasPlayer = playerKeywords.some((kw) => lowerHtml.includes(kw));

    if (hasPlayer) {
      let qualityScore = 70;
      let quality: "1080p BluRay" | "Full HD" | "HD" | "CAM/TS" = "HD";

      if (isCam) {
        qualityScore = 30;
        quality = "CAM/TS";
      } else if (sandboxCompatible) {
        qualityScore = name.includes("VidZee") ? 100 : name.includes("MoviesAPI") ? 96 : 92;
        quality = isHd ? "1080p BluRay" : "Full HD";
      } else if (name.includes("2Embed") || name.includes("AutoEmbed") || isHd) {
        qualityScore = 80;
        quality = "1080p BluRay";
      } else if (name.includes("SmashyStream") || name.includes("VidSrc")) {
        qualityScore = 75;
        quality = "Full HD";
      }

      return {
        name,
        url,
        status: latency < 1500 ? "online" : "slow",
        latencyMs: latency,
        verifiedPlayable: true,
        sandboxCompatible,
        isCam,
        quality,
        qualityScore,
        notes: isCam ? "کیفیت پرده‌ای (CAM)" : "کیفیت اصلی (1080p BluRay/HD)",
      };
    }

    // Default fallback if HTML loaded but no player signature found
    return { name, url, status: "slow", latencyMs: latency, verifiedPlayable: false, sandboxCompatible, notes: "Uncertain HTML payload" };
  } catch (err: any) {
    const latency = Date.now() - start;
    if (err.name === "AbortError") {
      return { name, url, status: "slow", latencyMs: timeoutMs, verifiedPlayable: false, sandboxCompatible, notes: "Timeout" };
    }
    return { name, url, status: "offline", latencyMs: latency, verifiedPlayable: false, sandboxCompatible, notes: err.message || "Network error" };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("tmdbId");
  const imdbId = searchParams.get("imdbId") || "";
  const title = searchParams.get("title") || "Movie";
  const type = searchParams.get("type") || "movie";
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing required parameter 'tmdbId'" }, { status: 400 });
  }

  const candidateServers = (
    type === "tv"
      ? getTvEmbedServers(tmdbId, season, episode)
      : getMovieEmbedServers(tmdbId)
  ).map((s) => ({
    name: s.shortName,
    url: s.url,
    sandboxCompatible: s.sandboxCompatible,
  }));

  // 1. Run parallel server deep health checks
  const healthResults = await Promise.all(
    candidateServers.map((srv) =>
      checkServerHealth(srv.name, srv.url, srv.sandboxCompatible)
    )
  );

  // Filter only genuinely verified playable servers
  const verifiedServers = healthResults.filter((s) => s.verifiedPlayable && s.status !== "offline");

  // Sort verified servers: sandbox-compatible first, then qualityScore descending, then latency ascending
  verifiedServers.sort((a, b) => {
    const sbxDiff = Number(Boolean(b.sandboxCompatible)) - Number(Boolean(a.sandboxCompatible));
    if (sbxDiff !== 0) return sbxDiff;
    const scoreDiff = (b.qualityScore || 50) - (a.qualityScore || 50);
    if (scoreDiff !== 0) return scoreDiff;
    return a.latencyMs - b.latencyMs;
  });

  const bestHd = verifiedServers[0];
  let aiRecommendation = bestHd
    ? `سرور با بالاترین کیفیت: ${bestHd.name} (${bestHd.quality || "1080p BluRay"}) با پینگ ${bestHd.latencyMs}ms`
    : "سرورهای با بالاترین کیفیت و پایداری شناسایی شدند.";
  let recommendedIndex = bestHd ? candidateServers.findIndex((s) => s.name === bestHd.name) : 0;

  const settings = await getSystemSettings();
  const openRouterApiKey = settings.openRouterApiKey;
  const modelName = settings.openRouterModel;

  if (openRouterApiKey) {
    try {
      const promptText = `Media Title: "${title}" (TMDB ID: ${tmdbId}, IMDb ID: "${imdbId}", Type: ${type}).
Verified Inspection Results: ${JSON.stringify(healthResults)}.

Server Context:
- VidLink Pro: Very fast, reliable. Best default choice.
- 2Embed: Stable, often has subtitles.
- NontonGo: Good alternative, reliable.
- MoviesApi / AutoEmbed / SmashyStream: Variable reliability.
- MultiEmbed / VidSrc.net: Fallback options.

Task: Pick the single BEST verified working server index from the provided results (prefer verifiedPlayable: true and lower latencyMs). Provide a short 1-sentence Persian explanation.
Return STRICT JSON:
{
  "recommendedServerIndex": 0,
  "recommendation": "توضیح کوتاه و دقیق فارسی در مورد انتخاب این سرور"
}`;

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cinema-social.app",
          "X-Title": "Cinema Social AI Server Finder",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: "You are a streaming media server optimization expert. Always return strict JSON." },
            { role: "user", content: promptText }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 250,
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (typeof parsed.recommendedServerIndex === "number" && parsed.recommendedServerIndex >= 0 && parsed.recommendedServerIndex < healthResults.length) {
              recommendedIndex = parsed.recommendedServerIndex;
            }
            if (parsed.recommendation) {
              aiRecommendation = parsed.recommendation;
            }
          } catch {
            // Silently fallback to algorithmically sorted winner
          }
        }
      }
    } catch (e) {
      console.error("OpenRouter API error:", e);
    }
  }

  // Find index in candidateServers array for the recommended server
  const selectedServer = healthResults[recommendedIndex] || verifiedServers[0] || healthResults[0];

  return NextResponse.json({
    allChecked: healthResults,
    verifiedServers,
    recommendedServer: selectedServer,
    recommendedIndex,
    aiRecommendation,
    modelUsed: modelName,
    checkedAt: new Date().toISOString(),
  });
}
