"use client";

import { memo, useEffect, useState } from "react";
import { Play, Pause, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SubtitleOverlay } from "@/components/cinema/subtitle-overlay";

interface MemoStreamIframeProps {
  src: string;
  onLoad: () => void;
  onError: () => void;
}

export const MemoStreamIframe = memo(function MemoStreamIframe({
  src,
  onLoad,
  onError,
}: MemoStreamIframeProps) {
  return (
    <iframe
      key={src}
      src={src}
      className="size-full absolute inset-0 border-0"
      allowFullScreen={true}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
      onLoad={onLoad}
      onError={onError}
    />
  );
});

function formatPlayerTime(seconds: number): string {
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

function parseTimeStringToSeconds(input: string): number | null {
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
    return parts[0] * 60;
  }
  return null;
}

interface StreamPlaybackContainerProps {
  children: React.ReactNode;
  vttUrl: string | null;
  subtitleLabel: string | null;
  totalDuration: number;
  serverName?: string;
  onSwitchToLiveServer?: () => void;
  externalTime: number | null;
  externalIsPlaying: boolean | null;
  isLiveSynced: boolean;
}

/**
 * Isolates the 1-second playback clock, timeline scrubber, and subtitle cue matching.
 * Because `children` (the video iframe and overlays) comes from the parent, 1-second
 * clock ticks never re-render MovieView or reconcile the video iframe.
 */
export function StreamPlaybackContainer({
  children,
  vttUrl,
  subtitleLabel,
  totalDuration,
  serverName,
  onSwitchToLiveServer,
  externalTime,
  externalIsPlaying,
  isLiveSynced,
}: StreamPlaybackContainerProps) {
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [jumpMinuteInput, setJumpMinuteInput] = useState<string>("");

  useEffect(() => {
    if (typeof externalTime === "number" && externalTime >= 0) {
      setCurrentTime(externalTime);
    }
  }, [externalTime]);

  useEffect(() => {
    if (typeof externalIsPlaying === "boolean") {
      setIsPlaying(externalIsPlaying);
    }
  }, [externalIsPlaying]);

  useEffect(() => {
    if (!isPlaying || isLiveSynced) return;
    const interval = setInterval(() => {
      setCurrentTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isLiveSynced]);

  return (
    <>
      <div className="flex-1 min-h-0 w-full bg-black relative flex items-center justify-center overflow-hidden">
        {children}
        <SubtitleOverlay
          vttUrl={vttUrl}
          subtitleLabel={subtitleLabel}
          currentTime={currentTime}
          isPlaying={isPlaying}
          totalDuration={totalDuration}
          isLiveSynced={isLiveSynced}
          serverName={serverName}
          onTimeChange={(t) => setCurrentTime(t)}
          onSwitchToLiveServer={onSwitchToLiveServer}
        />
      </div>

      {/* Lightweight opaque timeline control bar (no backdrop-blur over GPU video) */}
      <div
        className="bg-zinc-950 border-t border-white/10 px-3 sm:px-4 py-2 flex flex-col gap-1.5 shrink-0 select-none"
        dir="rtl"
      >
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-white hover:bg-white/10 shrink-0 rounded-full"
            onClick={() => setIsPlaying((p) => !p)}
            title={isPlaying ? "توقف زیرنویس و تایمر" : "شروع / ادامه پخش زیرنویس"}
          >
            {isPlaying ? (
              <Pause className="size-4 text-amber-400 fill-amber-400/30" />
            ) : (
              <Play className="size-4 text-green-400 fill-green-400/30" />
            )}
          </Button>

          <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-white" dir="ltr">
            <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {formatPlayerTime(currentTime)}
            </span>
            <span className="text-white/40">/</span>
            <span className="text-white/60">{formatPlayerTime(totalDuration)}</span>
            <span className="text-[11px] text-amber-200/80 ms-1 hidden sm:inline" dir="rtl">
              (دقیقه {Math.floor(currentTime / 60)})
            </span>
          </div>

          <div className="flex-1 min-w-0 flex items-center relative" dir="ltr">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={1}
              value={currentTime}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              title="جابجایی در طول فیلم و هماهنگی زیرنویس"
            />
          </div>

          <div className="shrink-0 flex items-center gap-1 text-[11px]">
            {isLiveSynced ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="hidden md:inline">همگام خودکار با پلیر ⚡</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                <Clock className="size-3 text-amber-400" />
                <span className="hidden md:inline">کنترل دستی زیرنویس</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1" dir="ltr">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200 rounded"
              onClick={() => setCurrentTime((t) => Math.max(0, t - 60))}
              title="۱ دقیقه به عقب"
            >
              -1m
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200 rounded"
              onClick={() => setCurrentTime((t) => Math.max(0, t - 10))}
              title="۱۰ ثانیه به عقب"
            >
              -10s
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200 rounded"
              onClick={() => setCurrentTime((t) => Math.min(totalDuration, t + 10))}
              title="۱۰ ثانیه به جلو"
            >
              +10s
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200 rounded"
              onClick={() => setCurrentTime((t) => Math.min(totalDuration, t + 60))}
              title="۱ دقیقه به جلو"
            >
              +1m
            </Button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const sec = parseTimeStringToSeconds(jumpMinuteInput);
              if (sec !== null && sec >= 0) {
                setCurrentTime(sec);
                setJumpMinuteInput("");
                toast.success(`پرش به زمان ${formatPlayerTime(sec)}`);
              } else {
                toast.error("زمان وارد شده نامعتبر است (مثال: 41 یا 1:34:09)");
              }
            }}
            className="flex items-center gap-1.5"
          >
            <span className="text-zinc-400 text-[11px] hidden sm:inline">پرش مستقیم:</span>
            <Input
              value={jumpMinuteInput}
              onChange={(e) => setJumpMinuteInput(e.target.value)}
              placeholder="دقیقه (مثلاً 41 یا 1:34:09)"
              className="h-6 w-28 text-center font-mono text-[11px] bg-zinc-900 border-zinc-700 text-white p-0 rounded"
            />
            <Button
              type="submit"
              size="sm"
              className="h-6 px-2.5 text-[11px] bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded"
            >
              برو
            </Button>
          </form>

          <div className="flex items-center gap-2 text-zinc-400 text-[11px] truncate max-w-sm">
            {subtitleLabel ? (
              <span className="truncate text-zinc-300">
                زیرنویس: <strong className="text-amber-300 font-normal">{subtitleLabel}</strong>
              </span>
            ) : (
              <span className="text-zinc-500 hidden sm:inline">بدون زیرنویس</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
