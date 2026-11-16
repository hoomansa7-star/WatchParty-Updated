export interface EmbedServer {
  id: string;
  name: string;
  shortName: string;
  url: string;
  sandbox?: boolean | string;
  sandboxCompatible: boolean;
}

export function getMovieEmbedServers(tmdbId: number | string): EmbedServer[] {
  const id = String(tmdbId);
  return [
    {
      id: "vidzee",
      name: "VidZee (سرور اصلی بدون محدودیت 1080p ✨)",
      shortName: "VidZee",
      url: `https://player.vidzee.wtf/embed/movie/${id}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "moviesapi",
      name: "MoviesAPI (پخش مستقیم Full HD 💎)",
      shortName: "MoviesAPI",
      url: `https://moviesapi.to/movie/${id}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "smashystream",
      name: "SmashyStream (سرور چند سورس HQ 🎬)",
      shortName: "SmashyStream",
      url: `https://embed.smashystream.com/playere.php?tmdb=${id}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "vidlink",
      name: "VidLink Pro (هماهنگ با زیرنویس — تب جدید)",
      shortName: "VidLink Pro",
      url: `https://vidlink.pro/movie/${id}?primaryColor=f59e0b&secondaryColor=18181b&icons=default`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "autoembed",
      name: "AutoEmbed (کیفیت Full HD — تب جدید)",
      shortName: "AutoEmbed",
      url: `https://autoembed.co/movie/tmdb/${id}`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "2embed",
      name: "2Embed (1080p BluRay — تب جدید)",
      shortName: "2Embed",
      url: `https://www.2embed.cc/embed/tmdb/movie?id=${id}`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "vidsrc",
      name: "VidSrc.to (سرور پرسرعت — تب جدید)",
      shortName: "VidSrc.to",
      url: `https://vidsrc.to/embed/movie/${id}`,
      sandbox: false,
      sandboxCompatible: false,
    },
  ];
}

export function getTvEmbedServers(
  tmdbId: number | string,
  season: number | string = 1,
  episode: number | string = 1
): EmbedServer[] {
  const id = String(tmdbId);
  const s = String(season);
  const e = String(episode);
  return [
    {
      id: "vidzee",
      name: "VidZee (سرور اصلی بدون محدودیت 1080p ✨)",
      shortName: "VidZee",
      url: `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "moviesapi",
      name: "MoviesAPI (پخش مستقیم Full HD 💎)",
      shortName: "MoviesAPI",
      url: `https://moviesapi.to/tv/${id}-${s}-${e}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "smashystream",
      name: "SmashyStream (سرور چند سورس HQ 🎬)",
      shortName: "SmashyStream",
      url: `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
      sandbox: false,
      sandboxCompatible: true,
    },
    {
      id: "vidlink",
      name: "VidLink Pro (هماهنگ با زیرنویس — تب جدید)",
      shortName: "VidLink Pro",
      url: `https://vidlink.pro/tv/${id}/${s}/${e}`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "autoembed",
      name: "AutoEmbed (کیفیت Full HD — تب جدید)",
      shortName: "AutoEmbed",
      url: `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "2embed",
      name: "2Embed (1080p BluRay — تب جدید)",
      shortName: "2Embed",
      url: `https://www.2embed.cc/embed/tmdb/tv?id=${id}&s=${s}&e=${e}`,
      sandbox: false,
      sandboxCompatible: false,
    },
    {
      id: "vidsrc",
      name: "VidSrc.to (سرور پرسرعت — تب جدید)",
      shortName: "VidSrc.to",
      url: `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
      sandbox: false,
      sandboxCompatible: false,
    },
  ];
}
