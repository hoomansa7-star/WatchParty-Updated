"use client";

import { useState } from "react";
import { Subtitles, Loader2, Download, Search, Sparkles, Check, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface SubtitleResult {
  id: string;
  title: string;
  language: string;
  url: string;
  source?: 'opensubtitles' | 'yts' | 'subdl' | 'subscene' | 'mock';
  downloads?: number;
  rating?: number;
  release?: string;
  score?: number;
}

interface SubtitleSelectorProps {
  title?: string;
  tmdbId?: number | string | null;
  imdbId?: string | null;
  year?: number | null;
  onSubtitleReady: (vttUrl: string, subInfo?: { title: string; source: string }) => void;
}

export function SubtitleSelector({
  title = "",
  tmdbId,
  imdbId,
  year,
  onSubtitleReady,
}: SubtitleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(title);
  const [results, setResults] = useState<SubtitleResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAutoPicking, setIsAutoPicking] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        action: "search",
        q: query.trim(),
        lang: "fa",
      });
      if (imdbId) params.set("imdbId", imdbId);

      const res = await fetch(`/api/subtitles?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "خطا در دریافت لیست زیرنویس‌ها");

      setResults(data.results || []);
      if (data.results?.length === 0) {
        setError("هیچ زیرنویس فارسی برای این عنوان یافت نشد.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAutoPick = async () => {
    setIsAutoPicking(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        action: "auto",
        q: query || title,
      });
      if (tmdbId) params.set("tmdbId", String(tmdbId));
      if (imdbId) params.set("imdbId", imdbId);
      if (year) params.set("year", String(year));

      const res = await fetch(`/api/subtitles?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.ok || !data.vtt) {
        throw new Error(data.error || "زیرنویس خودکار پیدا نشد. لطفاً از لیست زیر دستی انتخاب کنید.");
      }

      const blob = new Blob([data.vtt], { type: "text/vtt" });
      const blobUrl = URL.createObjectURL(blob);

      onSubtitleReady(blobUrl, {
        title: data.subtitle?.title || "Persian Subtitle",
        source: data.subtitle?.source || "OpenSubtitles",
      });

      toast.success("بهترین زیرنویس فارسی به صورت خودکار اعمال شد ✨", {
        description: data.subtitle?.title,
      });

      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsAutoPicking(false);
    }
  };

  const handleDownload = async (url: string, id: string, subObj: SubtitleResult) => {
    setDownloadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/subtitles?action=download&url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "خطا در دانلود فایل زیرنویس");
      }

      const vttText = await res.text();
      const blob = new Blob([vttText], { type: "text/vtt" });
      const blobUrl = URL.createObjectURL(blob);

      onSubtitleReady(blobUrl, {
        title: subObj.title,
        source: subObj.source || "manual",
      });

      toast.success("زیرنویس فارسی انتخاب و فعال شد");
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && results.length === 0 && (query || title)) {
      handleSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-zinc-900/90 border-white/20 text-white hover:bg-white/10 shrink-0 text-xs px-2.5"
          title="مدیریت و زیرنویس فارسی هوشمند"
        >
          <Subtitles className="size-3.5 text-yellow-400" />
          <span className="hidden sm:inline font-medium">زیرنویس فارسی</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] bg-zinc-950 text-white border-zinc-800" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Subtitles className="h-5 w-5 text-red-500" />
              مرکز زیرنویس فارسی (Auto & Multi-Source)
            </span>
            <Badge variant="secondary" className="bg-red-950/60 text-red-300 border-red-800 text-[10px] gap-1">
              <Sparkles className="size-3 text-yellow-400" /> هوشمند
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Quick Auto-Pick Banner */}
        <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0 text-yellow-400">
              <Zap className="size-4 fill-current" />
            </div>
            <div className="text-right min-w-0">
              <p className="text-xs font-semibold text-zinc-100 truncate">
                انتخاب خودکار هماهنگ‌ترین زیرنویس
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                تحلیل کیفیت، تعداد دانلود و نسخه BluRay/WEB-DL
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAutoPick}
            disabled={isAutoPicking}
            className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs h-8 px-3 gap-1.5 shadow-md shadow-yellow-500/20"
          >
            {isAutoPicking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>انتخاب خودکار</span>
          </Button>
        </div>

        <div className="flex gap-2 mt-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="جستجوی نام فیلم یا سریال..."
            className="bg-zinc-900 border-zinc-800 text-right text-white text-xs h-9"
          />
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={isSearching}
            className="gap-1.5 shrink-0 h-9 px-3 text-xs"
          >
            {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            جستجو
          </Button>
        </div>

        {error && (
          <div className="text-red-400 text-xs mt-1 text-right">{error}</div>
        )}

        <ScrollArea className="h-[280px] mt-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
          {results.length > 0 ? (
            <div className="space-y-1.5">
              {results.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/80 transition-colors border border-zinc-800/70 gap-2"
                >
                  <div className="flex flex-col gap-1 overflow-hidden min-w-0 text-right">
                    <span
                      className="text-xs font-medium truncate text-zinc-100"
                      title={sub.title}
                      dir="ltr"
                    >
                      {sub.title}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-zinc-700 text-zinc-300">
                        فارسی
                      </Badge>
                      {sub.source && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
                          {sub.source}
                        </Badge>
                      )}
                      {sub.downloads ? (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {sub.downloads.toLocaleString()} dl
                        </span>
                      ) : null}
                      {sub.rating ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                          <Star className="size-2.5 fill-current" /> {sub.rating}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 gap-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 h-7 text-xs px-2.5"
                    disabled={downloadingId === sub.id}
                    onClick={() => handleDownload(sub.url, sub.id, sub)}
                  >
                    {downloadingId === sub.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Download className="size-3" />
                        <span>انتخاب</span>
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : !isSearching && !error ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs text-center p-6 gap-2">
              <Subtitles className="size-8 opacity-30" />
              <span>برای مشاهده گزینه‌ها، دکمه جستجو یا «انتخاب خودکار» را بزنید.</span>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
