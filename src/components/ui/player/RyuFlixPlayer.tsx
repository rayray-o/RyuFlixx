"use client";

import { useEffect, useRef } from "react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { VideoPlayer, VideoSkin } from "@videojs/react/video";
import "@videojs/react/video/skin.css";

interface RyuFlixPlayerProps {
  src: string;
  title?: string;
  resumeAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export default function RyuFlixPlayer({
  src,
  title,
  resumeAt = 0,
  onTimeUpdate,
  onEnded,
}: RyuFlixPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeAppliedRef = useRef<string | null>(null);

  /*
   * Reset resume tracking whenever the media changes.
   * This prevents an old movie/episode position from being
   * accidentally applied to a new source.
   */
  useEffect(() => {
    resumeAppliedRef.current = null;
  }, [src]);

  /*
   * Connect RyuFlix's existing progress/history system
   * to the actual Video.js media element.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      const duration = video.duration;

      if (
        resumeAt > 0 &&
        Number.isFinite(resumeAt) &&
        resumeAt < duration &&
        resumeAppliedRef.current !== src
      ) {
        try {
          video.currentTime = resumeAt;
        } catch {
          // The browser may reject seeking before the media is ready.
        }

        resumeAppliedRef.current = src;
      }

      onTimeUpdate?.(
        Number.isFinite(video.currentTime) ? video.currentTime : 0,
        Number.isFinite(duration) ? duration : 0,
      );
    };

    const handleTimeUpdate = () => {
      const currentTime = Number.isFinite(video.currentTime)
        ? video.currentTime
        : 0;

      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      onTimeUpdate?.(currentTime, duration);
    };

    const handleEnded = () => {
      onEnded?.();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [src, resumeAt, onTimeUpdate, onEnded]);

  return (
    <div
      className="h-full w-full"
      aria-label={title || "RyuFlix video player"}
    >
      <VideoPlayer>
        <VideoSkin>
          <HlsJsVideo
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
          />
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
      }
