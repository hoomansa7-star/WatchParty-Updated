import unzipper from 'unzipper';
import iconv from 'iconv-lite';
import zlib from 'zlib';
import { Buffer } from 'buffer';
import { tmdbDetail } from './tmdb';

export interface SubtitleResult {
  id: string;
  title: string;
  language: string;
  url: string;
  source: 'opensubtitles' | 'yts' | 'subdl' | 'subscene';
  downloads?: number;
  rating?: number;
  release?: string;
  format?: 'gz' | 'zip' | 'srt' | 'vtt';
  score?: number;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'TemporaryUserAgent',
  'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
};

// In-memory cache for auto-picked subtitles (TTL 1 hour)
interface CachedAutoSub {
  vtt: string;
  subtitle: SubtitleResult;
  allCandidates: SubtitleResult[];
  cachedAt: number;
}
const autoSubCache = new Map<string, CachedAutoSub>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Searches real Persian subtitles across multiple sources (OpenSubtitles, YTS-Subs, Subdl)
 */
export async function searchSubtitles(
  query: string,
  lang = 'fa',
  imdbId?: string | null
): Promise<SubtitleResult[]> {
  const results: SubtitleResult[] = [];
  const cleanQuery = query.replace(/[^\w\s-]/gi, ' ').trim();

  // 1. Primary: OpenSubtitles REST API (Fastest and largest Persian database)
  try {
    const osResults = await searchOpenSubtitles(cleanQuery, imdbId);
    results.push(...osResults);
  } catch (err) {
    console.warn('[Subtitles] OpenSubtitles search error:', err);
  }

  // 2. Secondary: YTS-subs (if IMDB ID is present)
  if (imdbId && results.length < 15) {
    try {
      const ytsResults = await searchYtsSubs(imdbId);
      results.push(...ytsResults);
    } catch (err) {
      console.warn('[Subtitles] YTS-subs search error:', err);
    }
  }

  // 3. Fallback: Subdl scraper
  if (results.length < 5) {
    try {
      const subdlResults = await searchSubdlScraper(cleanQuery, lang);
      results.push(...subdlResults);
    } catch (err) {
      console.warn('[Subtitles] Subdl scraper error:', err);
    }
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>();
  const deduped: SubtitleResult[] = [];
  for (const r of results) {
    if (!seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      deduped.push(r);
    }
  }

  return scoreAndRankSubtitles(deduped, { title: query });
}

/**
 * Searches OpenSubtitles REST API for Persian subtitles
 */
async function searchOpenSubtitles(
  query: string,
  imdbId?: string | null
): Promise<SubtitleResult[]> {
  const results: SubtitleResult[] = [];
  const endpoints: string[] = [];

  if (imdbId) {
    const numericImdb = imdbId.replace(/^tt/i, '');
    endpoints.push(`https://rest.opensubtitles.org/search/imdbid-${numericImdb}/sublanguageid-per`);
  }
  if (query) {
    endpoints.push(`https://rest.opensubtitles.org/search/query-${encodeURIComponent(query)}/sublanguageid-per`);
  }

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { 'User-Agent': 'TemporaryUserAgent' },
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const item of data) {
        if (!item.SubDownloadLink) continue;
        results.push({
          id: `os-${item.IDSubtitleFile || item.IDSubtitle || Math.random().toString(36).slice(2)}`,
          title: item.SubFileName || item.MovieReleaseName || item.MovieName || query,
          language: 'fa',
          url: item.SubDownloadLink,
          source: 'opensubtitles',
          downloads: parseInt(item.SubDownloadsCnt || '0', 10),
          rating: parseFloat(item.SubRating || '0'),
          release: item.MovieReleaseName || item.SubFileName || '',
          format: 'gz',
        });
      }

      if (results.length >= 25) break;
    } catch (e) {
      console.warn('[Subtitles] OpenSubtitles fetch failed on', ep, e);
    }
  }

  return results;
}

/**
 * Searches YTS-Subs for Persian subtitles by IMDB ID
 */
async function searchYtsSubs(imdbId: string): Promise<SubtitleResult[]> {
  const cleanId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
  const res = await fetch(`https://yts-subs.com/movie-imdb/${cleanId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const results: SubtitleResult[] = [];

  // Match rows in table
  const rowRegex = /<tr[^>]*data-id="[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    if (/farsi|persian/i.test(rowHtml)) {
      const linkMatch = rowHtml.match(/href="(\/subtitles\/[^"]+)"/i);
      const nameMatch = rowHtml.match(/<a[^>]*href="\/subtitles\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i);
      const ratingMatch = rowHtml.match(/class="label\s+label-[^"]*"[^>]*>(\d+)<\/span>/i);

      if (linkMatch) {
        const subPath = linkMatch[1];
        const subName = nameMatch
          ? nameMatch[1].replace(/<[^>]+>/g, '').trim()
          : `Persian Subtitle (${cleanId})`;
        const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

        results.push({
          id: `yts-${subPath.replace(/\//g, '-')}`,
          title: subName,
          language: 'fa',
          url: `https://yts-subs.com${subPath}`,
          source: 'yts',
          rating,
          format: 'zip',
        });
      }
    }
  }

  return results;
}

/**
 * Subdl scraper fallback
 */
async function searchSubdlScraper(query: string, lang = 'fa'): Promise<SubtitleResult[]> {
  const results: SubtitleResult[] = [];
  const searchUrl = `https://subdl.com/search/${encodeURIComponent(query)}`;
  try {
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!searchRes.ok) return [];
    const searchHtml = await searchRes.text();

    const matches = [...searchHtml.matchAll(/href="(\/subtitle\/(sd\d+)\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    if (matches.length === 0) return [];

    const moviePaths = Array.from(new Set(matches.slice(0, 2).map((m) => m[1])));
    for (const moviePath of moviePaths) {
      const pageRes = await fetch(`https://subdl.com${moviePath}/farsi_persian`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!pageRes.ok) continue;

      const html = await pageRes.text();
      const dlRegex = /href="(https?:\/\/dl\.subdl\.com\/subtitle\/[^"]+\.zip)"/gi;
      let dlMatch;
      while ((dlMatch = dlRegex.exec(html)) !== null) {
        results.push({
          id: `subdl-${results.length + 1}`,
          title: `${query} - Persian Subtitle`,
          language: lang,
          url: dlMatch[1],
          source: 'subdl',
          format: 'zip',
        });
        if (results.length >= 10) break;
      }
      if (results.length > 0) break;
    }
  } catch (e) {
    console.warn('[Subtitles] Subdl scraper error:', e);
  }
  return results;
}

/**
 * Intelligently scores and ranks Persian subtitles so the cleanest, best-synced release is #1
 */
export function scoreAndRankSubtitles(
  subtitles: SubtitleResult[],
  opts?: { title?: string; year?: number | null }
): SubtitleResult[] {
  const scored = subtitles.map((sub) => {
    let score = 0;
    const name = (sub.title || '').toLowerCase();
    const release = (sub.release || '').toLowerCase();
    const combined = `${name} ${release}`;

    // 1. Quality Indicators (Prefer BluRay and WebDL)
    if (combined.includes('bluray') || combined.includes('bdrip') || combined.includes('brrip')) {
      score += 45;
    } else if (combined.includes('web-dl') || combined.includes('webrip') || combined.includes('web.')) {
      score += 35;
    } else if (combined.includes('1080p') || combined.includes('720p')) {
      score += 20;
    }

    // 2. Heavy Penalty for Low Quality / Cam rips
    if (
      combined.includes('cam') ||
      combined.includes('hdcam') ||
      combined.includes('telesync') ||
      combined.includes('.ts.') ||
      combined.includes('hdts') ||
      combined.includes('screener')
    ) {
      score -= 100;
    }

    // 3. Trusted Persian translation teams / translators
    const reputablePersianTeams = [
      'film2media',
      'zarfilm',
      'dibamovie',
      'amir_t6262',
      'tahmasebi',
      'tinymoviez',
      'baromovie',
      'subscene',
      'farsisubtitle',
      'ariafilm',
      'avafilm',
    ];
    for (const team of reputablePersianTeams) {
      if (combined.includes(team)) {
        score += 30;
        break;
      }
    }

    // 4. Popularity (Downloads Count)
    const downloads = sub.downloads || 0;
    if (downloads > 0) {
      score += Math.min(50, Math.log10(downloads + 1) * 12);
    }

    // 5. Rating
    const rating = sub.rating || 0;
    if (rating > 0) {
      score += rating * 5;
    }

    // 6. Year matching
    if (opts?.year && combined.includes(String(opts.year))) {
      score += 15;
    }

    return { ...sub, score };
  });

  return scored.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Downloads a subtitle from an OpenSubtitles .gz, YTS/Subdl .zip, or direct SRT/VTT URL
 */
export async function downloadSubtitleText(subtitleUrl: string): Promise<string> {
  let targetUrl = subtitleUrl;

  // Handle YTS-subs landing page if URL is a page rather than a zip
  if (targetUrl.includes('yts-subs.com/subtitles/') && !targetUrl.includes('/download/')) {
    try {
      const pageRes = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (pageRes.ok) {
        const pageHtml = await pageRes.text();
        const dlMatch = pageHtml.match(/href="(\/subtitles\/download\/[^"]+)"/i);
        if (dlMatch) {
          targetUrl = `https://yts-subs.com${dlMatch[1]}`;
        }
      }
    } catch (e) {
      console.warn('[Subtitles] YTS download link extraction failed:', e);
    }
  }

  // Handle Subscene detail page
  if (targetUrl.includes('subscene.com/subtitles/') && !targetUrl.endsWith('/download')) {
    const pageRes = await fetch(targetUrl, { headers: DEFAULT_HEADERS });
    if (pageRes.ok) {
      const pageHtml = await pageRes.text();
      const downloadMatch = pageHtml.match(/href="(\/subtitles\/[^"]+\/download)"/i);
      if (downloadMatch) {
        targetUrl = `https://subscene.com${downloadMatch[1]}`;
      }
    }
  }

  const res = await fetch(targetUrl, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`Failed to download subtitle file: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const contentDisp = (res.headers.get('content-disposition') || '').toLowerCase();

  // 1. Check for GZIP (.gz from OpenSubtitles)
  const isGz =
    targetUrl.endsWith('.gz') ||
    contentType.includes('gzip') ||
    (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

  if (isGz) {
    try {
      const decompressed = zlib.gunzipSync(buffer);
      return decodeSubtitleBuffer(decompressed);
    } catch (e) {
      console.warn('[Subtitles] Gunzip decompression failed, trying buffer fallback:', e);
    }
  }

  // 2. Check for ZIP archive
  const isZip =
    targetUrl.endsWith('.zip') ||
    contentType.includes('zip') ||
    contentDisp.includes('.zip') ||
    (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (isZip) {
    try {
      const directory = await unzipper.Open.buffer(buffer);
      const srtFile = directory.files.find((d) =>
        /\.(srt|vtt)$/i.test(d.path)
      );
      if (srtFile) {
        const srtBuffer = await srtFile.buffer();
        return decodeSubtitleBuffer(srtBuffer);
      }
    } catch (e) {
      console.warn('[Subtitles] ZIP extraction failed, falling back to direct buffer:', e);
    }
  }

  return decodeSubtitleBuffer(buffer);
}

/**
 * Smart buffer decoder for UTF-8 and Persian Windows-1256 encodings
 */
export function decodeSubtitleBuffer(buffer: Buffer): string {
  // Try UTF-8 first
  const utf8Str = buffer.toString('utf8');

  // If valid UTF-8 and contains Persian characters, return clean UTF-8
  const persianRegex = /[\u0600-\u06FF]/;
  const hasReplacement = utf8Str.includes('\uFFFD');

  if (!hasReplacement && persianRegex.test(utf8Str)) {
    return cleanSubtitleText(utf8Str);
  }

  // If replacement characters found or no Persian letters detected, test Windows-1256
  const win1256Str = iconv.decode(buffer, 'win1256');
  if (persianRegex.test(win1256Str)) {
    return cleanSubtitleText(win1256Str);
  }

  return cleanSubtitleText(utf8Str);
}

/**
 * Removes SSA/ASS styling tags, ads, and BOM characters
 */
function cleanSubtitleText(text: string): string {
  return text
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .replace(/\{\\an\d+\}/gi, '') // Strip ASS alignment tags {\an8}
    .replace(/\{\\[^}]+\}/g, '') // Strip all ASS tags like {\pos(..)}, {\b1}
    .replace(/&rlm;|&lrm;/gi, '') // Strip unicode direction marks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * Converts SRT formatted subtitle text to WebVTT format
 */
export function srtToVtt(srt: string): string {
  const cleaned = cleanSubtitleText(srt);
  if (cleaned.trim().startsWith('WEBVTT')) {
    return cleaned;
  }

  let vtt = 'WEBVTT\n\n';
  vtt += cleaned
    // Fix timestamps (SRT uses comma, VTT uses dot)
    .replace(/^(\d{2}:\d{2}:\d{2}),(\d{3})/gm, '$1.$2')
    .replace(/^(\d{2}:\d{2}),(\d{3})/gm, '00:$1.$2')
    .replace(/<br\s*\/?>/gi, '\n');

  return vtt;
}

/**
 * High-level automatic Persian subtitle resolver
 * Resolves TMDB -> IMDB, searches top sites, picks the #1 best subtitle,
 * downloads it, converts to WebVTT, and caches the result.
 */
export async function getAutoPersianSubtitle({
  title,
  tmdbId,
  imdbId,
  year,
}: {
  title: string;
  tmdbId?: number | string | null;
  imdbId?: string | null;
  year?: number | null;
}): Promise<{
  vtt: string;
  subtitle: SubtitleResult;
  allCandidates: SubtitleResult[];
} | null> {
  const cacheKey = `${title}_${tmdbId || ''}_${imdbId || ''}`;
  const cached = autoSubCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      vtt: cached.vtt,
      subtitle: cached.subtitle,
      allCandidates: cached.allCandidates,
    };
  }

  // 1. Resolve IMDB ID if missing but TMDB ID is given
  let resolvedImdbId = imdbId;
  if (!resolvedImdbId && tmdbId) {
    try {
      const numId = typeof tmdbId === 'string' ? parseInt(tmdbId, 10) : tmdbId;
      if (!isNaN(numId)) {
        const detail = await tmdbDetail(numId);
        if (detail && (detail as any).imdb_id) {
          resolvedImdbId = (detail as any).imdb_id;
        }
      }
    } catch (e) {
      console.warn('[Subtitles] Failed to resolve IMDB ID from TMDB:', e);
    }
  }

  // 2. Search all providers
  const candidates = await searchSubtitles(title, 'fa', resolvedImdbId);
  if (candidates.length === 0) {
    return null;
  }

  // 3. Try downloading the top candidate (with automatic fallback to #2 and #3 if network fails)
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    const candidate = candidates[i];
    try {
      const srtText = await downloadSubtitleText(candidate.url);
      const vtt = srtToVtt(srtText);

      // Verify VTT has content
      if (vtt.length > 50 && vtt.includes('-->')) {
        const result = {
          vtt,
          subtitle: candidate,
          allCandidates: candidates,
          cachedAt: Date.now(),
        };
        autoSubCache.set(cacheKey, result);
        return {
          vtt,
          subtitle: candidate,
          allCandidates: candidates,
        };
      }
    } catch (err) {
      console.warn(`[Subtitles] Candidate #${i + 1} (${candidate.title}) failed to download:`, err);
    }
  }

  return null;
}
