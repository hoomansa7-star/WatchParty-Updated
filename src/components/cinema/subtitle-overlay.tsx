"use client";

import { useEffect, useState, useMemo } from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  Eye,
  EyeOff,
  Play,
  Pause,
  Clock,
  FastForward,
  Rewind,
  Check,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface Cue {
  start: number;
  end: number;
  text: string;
}

interface SubtitleOverlayProps {
  vttUrl: string | null;
  currentTime?: number;
  isPlaying?: boolean;
  className?: string;
  subtitleLabel?: string | null;
  totalDuration?: number; // Total duration in seconds
  isLiveSynced?: boolean;
  serverName?: string;
  onTimeChange?: (newTime: number) => void;
  onSwitchToLiveServer?: () => void;
}

/**
 * Custom VTT subtitle parser with SSA/ASS tag stripping
 */
function parseVtt(vttText: string): Cue[] {
  const cues: Cue[] = [];
  const lines = vttText.split(/\r?\n/);
  let i = 0;

  // Skip WEBVTT header and metadata
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes("-->")) {
      const parts = line.split("-->").map((s) => s.trim().split(" ")[0]);
      if (parts.length >= 2) {
        const start = parseTimestamp(parts[0]);
        const end = parseTimestamp(parts[1]);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== "" && !lines[i].includes("-->")) {
          // Remove ASS/SSA tags like {\an8}, {\pos(..)}, {\b1} and HTML/VTT tags like <v ...>, <b>, <font>
          const cleanLine = lines[i]
            .replace(/\{\\an\d+\}/gi, "")
            .replace(/\{\\[^}]+\}/g, "")
            .replace(/<[^>]*>/g, "")
            .replace(/&rlm;|&lrm;/gi, "")
            .trim();
          if (cleanLine) textLines.push(cleanLine);
          i++;
        }

        if (!isNaN(start) && !isNaN(end) && textLines.length > 0) {
          cues.push({
            start,
            end,
            text: textLines.join("\n"),
          });
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return cues;
}

function parseTimestamp(ts: string): number {
  // Format: HH:MM:SS.mmm or MM:SS.mmm
  const parts = ts.replace(",", ".").split(":");
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const remainingSec = s % 60;
  const h = Math.floor(m / 60);
  const remainingMin = m % 60;
  if (h > 0) {
    return `${h}:${remainingMin.toString().padStart(2, "0")}:${remainingSec.toString().padStart(2, "0")}`;
  }
  return `${remainingMin.toString().padStart(2, "0")}:${remainingSec.toString().padStart(2, "0")}`;
}

function parseTimeToSeconds(input: string): number | null {
  const clean = input.trim().replace(/：/g, ":");
  if (!clean) return null;
  const parts = clean.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    // If user enters just "41" -> 41 minutes (or if > 120 then seconds)
    return parts[0] <= 180 ? parts[0] * 60 : parts[0];
  }
  return null;
}

function findActiveCue(cues: Cue[], timeSec: number): Cue | null {
  let lo = 0;
  let hi = cues.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].start <= timeSec) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (candidate !== -1 && timeSec <= cues[candidate].end) {
    return cues[candidate];
  }
  // Handle overlapping earlier cues if sorted by start time
  for (let i = Math.max(0, candidate - 2); i < Math.min(cues.length, candidate + 2); i++) {
    if (timeSec >= cues[i].start && timeSec <= cues[i].end) {
      return cues[i];
    }
  }
  return null;
}

export function SubtitleOverlay({
  vttUrl,
  currentTime,
  isPlaying = true,
  className = "",
  subtitleLabel,
  totalDuration = 7200,
  isLiveSynced = false,
  serverName,
  onTimeChange,
  onSwitchToLiveServer,
}: SubtitleOverlayProps) {
  const [cues, setCues] = useState<Cue[]>([]);
  const [offset, setOffset] = useState<number>(0); // Fine sync offset in seconds
  const [internalTime, setInternalTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [showSyncControls, setShowSyncControls] = useState(false);
  const [jumpInput, setJumpInput] = useState<string>("");

  // Load and parse VTT file
  useEffect(() => {
    if (!vttUrl) return;

    let isMounted = true;
    fetch(vttUrl)
      .then((res) => res.text())
      .then((text) => {
        if (isMounted) {
          const parsed = parseVtt(text);
          setCues(parsed);
        }
      })
      .catch((err) => console.error("Error loading VTT for overlay:", err));

    return () => {
      isMounted = false;
    };
  }, [vttUrl]);

  // Sync internal time with parent provided currentTime (e.g. from postMessage or native video)
  useEffect(() => {
    if (typeof currentTime === "number" && currentTime >= 0) {
      setInternalTime(currentTime);
    }
  }, [currentTime]);

  // Sync isPlaying with parent
  useEffect(() => {
    if (typeof isPlaying === "boolean") {
      setIsTimerRunning(isPlaying);
    }
  }, [isPlaying]);

  // Internal ticking timer ONLY runs as fallback when neither parent time nor live sync is active
  const hasExternalTime = typeof currentTime === "number" && currentTime >= 0;
  useEffect(() => {
    if (!vttUrl || !isTimerRunning || !isVisible || isLiveSynced || hasExternalTime) return;

    const interval = setInterval(() => {
      setInternalTime((t) => t + 0.5);
    }, 500);

    return () => clearInterval(interval);
  }, [vttUrl, isTimerRunning, isVisible, isLiveSynced, hasExternalTime]);

  const effectiveTime = (hasExternalTime ? (currentTime as number) : internalTime) + offset;

  // Find active cue via binary search (O(log N))
  const activeCue = useMemo(() => {
    if (!cues.length || !isVisible) return null;
    return findActiveCue(cues, effectiveTime);
  }, [cues, effectiveTime, isVisible]);

  // Compute maximum duration from cues or totalDuration prop
  const maxMovieDuration = useMemo(() => {
    if (cues.length > 0) {
      const lastCue = cues[cues.length - 1];
      if (lastCue && lastCue.end > 0) {
        return Math.max(lastCue.end + 60, totalDuration || 7200);
      }
    }
    return totalDuration || 7200;
  }, [cues, totalDuration]);

  const handleJumpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseTimeToSeconds(jumpInput);
    if (parsed !== null) {
      setInternalTime(parsed);
      onTimeChange?.(parsed);
      setJumpInput("");
    }
  };

  const handleAdjustSeconds = (delta: number) => {
    const newTime = Math.max(0, effectiveTime + delta);
    setInternalTime(newTime);
    onTimeChange?.(newTime);
  };

  if (!vttUrl) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 ${className}`}>
      {/* Top Sync Offset Control Bar (Interactive) */}
      <div className="flex justify-end items-center gap-2 pointer-events-auto">
        <Popover open={showSyncControls} onOpenChange={setShowSyncControls}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={`h-8 px-2.5 bg-zinc-950/90 hover:bg-black text-white text-xs gap-1.5 shadow-md rounded-lg border ${
                isLiveSynced ? "border-emerald-500/50 hover:border-emerald-500" : "border-yellow-500/30 hover:border-yellow-500/50"
              }`}
              title={isLiveSynced ? "زیرنویس به طور خودکار با ویدیو همگام است" : "تنظیم و همگام‌سازی زمان زیرنویس با فیلم"}
            >
              {isLiveSynced ? (
                <>
                  <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                    {formatTime(effectiveTime)}
                  </span>
                  <span className="font-medium text-emerald-300 hidden sm:inline text-[11px]">همگام خودکار ⚡</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="size-3.5 text-yellow-400 shrink-0" />
                  <span className="font-medium text-zinc-200 hidden sm:inline">هماهنگی زیرنویس</span>
                  <span className="font-mono text-[11px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30 font-bold">
                    {formatTime(effectiveTime)}
                  </span>
                </>
              )}
              {offset !== 0 && (
                <span className={`px-1 rounded text-[10px] font-mono ${offset > 0 ? "bg-amber-500/30 text-amber-300" : "bg-blue-500/30 text-blue-300"}`}>
                  {offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 bg-zinc-950 border-zinc-800 text-white p-3.5 shadow-2xl rounded-xl space-y-3"
            align="end"
            dir="rtl"
          >
            {/* Header: Status and Title */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-yellow-400" />
                <span className="text-xs font-bold text-zinc-100">هماهنگی زمان زیرنویس</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                  onClick={() => setIsTimerRunning((r) => !r)}
                  title={isTimerRunning ? "توقف تایمر زیرنویس" : "ادامه تایمر زیرنویس"}
                >
                  {isTimerRunning ? <Pause className="size-3.5 text-amber-400" /> : <Play className="size-3.5 text-green-400" />}
                </Button>
                <span className="text-xs font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-yellow-400">
                  {formatTime(effectiveTime)}
                </span>
              </div>
            </div>

            {/* Live Sync Status Banner */}
            {isLiveSynced ? (
              <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-lg p-2.5 text-xs flex items-start gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse mt-1 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-emerald-300 font-semibold text-[11px]">همگام‌سازی خودکار و زنده فعال است ✨</p>
                  <p className="text-[10px] text-emerald-400/80">
                    با جلو/عقب زدن یا توقف فیلم، زیرنویس دقیقاً و خودکار جابجا می‌شود.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-lg p-2.5 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                  <Clock className="size-3.5 text-amber-400 shrink-0" />
                  <span>کنترل دستی زمان ({serverName || "VidZee"})</span>
                </div>
                <p className="text-[10px] text-zinc-300 leading-relaxed">
                  اگر فیلم را جلو/عقب زدید، زمان فیلم (مثلاً <strong>25:30</strong>) را در کادر زیر بنویسید یا از دکمه‌های پرش سریع استفاده کنید.
                </p>
                {onSwitchToLiveServer && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-950 hover:bg-zinc-900 text-zinc-200 text-[10px] gap-1 h-6 font-normal"
                    onClick={() => {
                      onSwitchToLiveServer();
                      setShowSyncControls(false);
                    }}
                  >
                    <Zap className="size-2.5 text-yellow-400" />
                    تست سرور VidLink Pro (در صورت موجود بودن)
                  </Button>
                )}
              </div>
            )}

            {subtitleLabel && (
              <p className="text-[11px] text-zinc-400 truncate" title={subtitleLabel}>
                زیرنویس: {subtitleLabel}
              </p>
            )}

            {/* Jump to specific Movie Time Input */}
            <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
              <label className="text-[11px] font-medium text-zinc-300 block">
                🎯 پرش به زمان فیلم (مثلاً 41:30 یا 25):
              </label>
              <form onSubmit={handleJumpSubmit} className="flex gap-1.5">
                <Input
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder="مثال: 41:30"
                  className="h-8 text-xs bg-zinc-950 border-zinc-700 text-center font-mono text-white placeholder:text-zinc-600"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-3 text-xs bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shrink-0"
                >
                  برو به این زمان
                </Button>
              </form>
              <p className="text-[10px] text-zinc-500">
                زمانی که روی پلیر فیلم می‌بینید را بنویسید تا زیرنویس دقیقاً به آنجا بپرد.
              </p>
            </div>

            {/* Timeline Scrubber Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>اسکرابر زمان</span>
                <span>{formatTime(internalTime)} / {formatTime(maxMovieDuration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxMovieDuration}
                step={1}
                value={internalTime}
                onChange={(e) => setInternalTime(Number(e.target.value))}
                className="w-full accent-yellow-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
            </div>

            {/* Quick Multi-Minute Jump Buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 block font-medium">پرش‌های سریع:</span>
              <div className="grid grid-cols-4 gap-1 direction-ltr">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                  onClick={() => handleAdjustSeconds(-300)}
                  title="5 دقیقه به عقب"
                >
                  -5 دقیقه
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                  onClick={() => handleAdjustSeconds(-60)}
                  title="1 دقیقه به عقب"
                >
                  -1 دقیقه
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                  onClick={() => handleAdjustSeconds(60)}
                  title="1 دقیقه به جلو"
                >
                  +1 دقیقه
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                  onClick={() => handleAdjustSeconds(300)}
                  title="5 دقیقه به جلو"
                >
                  +5 دقیقه
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-1 direction-ltr">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  onClick={() => handleAdjustSeconds(-10)}
                >
                  -10s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  onClick={() => handleAdjustSeconds(-5)}
                >
                  -5s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  onClick={() => handleAdjustSeconds(5)}
                >
                  +5s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                  onClick={() => handleAdjustSeconds(10)}
                >
                  +10s
                </Button>
              </div>
            </div>

            {/* Fine Audio/Subtitle Delay Sync Offset (+/- 0.5s) */}
            <div className="space-y-1 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>تنظیم ظریف هماهنگی صدا:</span>
                <span className="font-mono text-[10px] text-yellow-400">
                  {offset !== 0 ? (offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`) : "هماهنگ"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 direction-ltr">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  onClick={() => setOffset((o) => o - 1)}
                >
                  -1s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  onClick={() => setOffset((o) => o - 0.5)}
                >
                  -0.5s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  onClick={() => setOffset((o) => o + 0.5)}
                >
                  +0.5s
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                  onClick={() => setOffset((o) => o + 1)}
                >
                  +1s
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-zinc-400 hover:text-white gap-1"
                onClick={() => setIsVisible((v) => !v)}
              >
                {isVisible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {isVisible ? "مخفی کردن زیرنویس" : "نمایش زیرنویس"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] text-zinc-400 hover:text-white gap-1"
                onClick={() => {
                  setOffset(0);
                  setInternalTime(0);
                }}
              >
                <RotateCcw className="size-3" />
                بازنشانی به 00:00
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Subtitle Cue Text Display (no backdrop-blur/animation over GPU video plane) */}
      {activeCue ? (
        <div className="mb-6 flex justify-center text-center">
          <div
            dir="rtl"
            className="max-w-[92%] sm:max-w-[82%] bg-black/90 text-amber-100 font-medium text-sm sm:text-base md:text-lg px-4 py-2 rounded-xl border border-yellow-500/25 shadow-lg leading-relaxed whitespace-pre-line tracking-wide"
          >
            {activeCue.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
