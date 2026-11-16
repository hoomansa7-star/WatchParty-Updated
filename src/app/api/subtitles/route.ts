import { NextRequest, NextResponse } from 'next/server';
import {
  searchSubtitles,
  downloadSubtitleText,
  srtToVtt,
  getAutoPersianSubtitle,
} from '@/lib/subtitles';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const action = searchParams.get('action') || 'search';
  const url = searchParams.get('url');
  const lang = searchParams.get('lang') || 'fa';
  const tmdbId = searchParams.get('tmdbId');
  const imdbId = searchParams.get('imdbId');
  const year = searchParams.get('year');
  const format = searchParams.get('format');

  try {
    // 1. Auto-select and fetch best Persian subtitle
    if (action === 'auto') {
      if (!q && !tmdbId && !imdbId) {
        return NextResponse.json(
          { error: 'Missing movie query (q), tmdbId, or imdbId' },
          { status: 400 }
        );
      }

      const result = await getAutoPersianSubtitle({
        title: q,
        tmdbId: tmdbId || null,
        imdbId: imdbId || null,
        year: year ? parseInt(year, 10) : null,
      });

      if (!result) {
        return NextResponse.json(
          { ok: false, error: 'هیچ زیرنویس فارسی معتبری برای این عنوان یافت نشد' },
          { status: 404 }
        );
      }

      if (format === 'vtt') {
        return new NextResponse(result.vtt, {
          headers: {
            'Content-Type': 'text/vtt; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      return NextResponse.json({
        ok: true,
        subtitle: result.subtitle,
        vtt: result.vtt,
        candidatesCount: result.allCandidates.length,
      });
    }

    // 2. Download specific subtitle
    if (action === 'download') {
      if (!url) {
        return NextResponse.json({ error: 'Missing subtitle URL (url)' }, { status: 400 });
      }

      const srtOrVtt = await downloadSubtitleText(url);
      const vtt = srtToVtt(srtOrVtt);
      return new NextResponse(vtt, {
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 3. Search subtitles list
    if (action === 'search') {
      if (!q && !imdbId) {
        return NextResponse.json({ error: 'Missing query (q) or imdbId' }, { status: 400 });
      }

      const results = await searchSubtitles(q, lang, imdbId);
      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Subtitle API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
