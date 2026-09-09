"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import "./RyuFlixPlayer.css";

interface RyuFlixPlayerProps {
  src: string;
  title?: string;
  resumeAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export function RyuFlixPlayer({
  src,
  title,
  resumeAt = 0,
  onTimeUpdate,
  onEnded,
}: RyuFlixPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const showControls = useCallback(() => {
    setControlsVisible(true);

    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }

    if (playing) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [playing]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch {
      setError(true);
    }
  }, []);

  const seek = useCallback((amount: number) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = Math.max(
      0,
      Math.min(video.duration || 0, video.currentTime + amount),
    );

    showControls();
  }, [showControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setMuted(video.muted);

    if (!video.muted && video.volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  }, []);

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const nextVolume = Math.max(0, Math.min(1, value));

    video.volume = nextVolume;
    video.muted = nextVolume === 0;

    setVolume(nextVolume);
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await player.requestFullscreen();
      }
    } catch {
      // Some mobile browsers can reject programmatic fullscreen.
    }
  }, []);

  const changeSpeed = useCallback(
    (speed: number) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.playbackRate = speed;
      setPlaybackRate(speed);
      setSettingsOpen(false);
      showControls();
    },
    [showControls],
  );

  const handleSeekBar = useCallback(
    (event: MouseEvent<HTMLInputElement>) => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      const value = Number(event.currentTarget.value);

      if (Number.isFinite(value)) {
        video.currentTime = value;
        showControls();
      }
    },
    [showControls],
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setLoading(true);
    setError(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    video.pause();
    video.currentTime = 0;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);

      if (
        resumeAt > 0 &&
        Number.isFinite(resumeAt) &&
        resumeAt < (video.duration || Number.POSITIVE_INFINITY) - 5
      ) {
        video.currentTime = resumeAt;
        setCurrentTime(resumeAt);
      }

      setLoading(false);
    };

    const handleDurationChange = () => {
      if (Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime || 0;
      const length = Number.isFinite(video.duration) ? video.duration : 0;

      setCurrentTime(time);

      onTimeUpdate?.(time, length);
    };

    const handlePlay = () => {
      setPlaying(true);
      setLoading(false);
      showControls();
    };

    const handlePause = () => {
      setPlaying(false);
      setControlsVisible(true);
    };

    const handleWaiting = () => {
      setLoading(true);
    };

    const handlePlaying = () => {
      setLoading(false);
    };

    const handleCanPlay = () => {
      setLoading(false);
    };

    const handleEnded = () => {
      setPlaying(false);
      setControlsVisible(true);
      onEnded?.();
    };

    const handleError = () => {
      setLoading(false);
      setError(true);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, [onEnded, onTimeUpdate, resumeAt, showControls]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          void togglePlay();
          break;

        case "arrowleft":
          event.preventDefault();
          seek(-10);
          break;

        case "arrowright":
          event.preventDefault();
          seek(10);
          break;

        case "m":
          event.preventDefault();
          toggleMute();
          break;

        case "f":
          event.preventDefault();
          void toggleFullscreen();
          break;

        case "escape":
          setSettingsOpen(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [seek, toggleFullscreen, toggleMute, togglePlay]);

  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const volumePercent = Math.round(volume * 100);

  return (
    <div
      ref={playerRef}
      className={`ryu-player ${fullscreen ? "ryu-player--fullscreen" : ""}`}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing) {
          setControlsVisible(false);
        }
      }}
      onClick={() => {
        if (settingsOpen) {
          setSettingsOpen(false);
        }
      }}
    >
      <HlsJsVideo
        ref={videoRef}
        className="ryu-player__video"
        src={src}
        playsInline
        preload="metadata"
      />

      <div
        className={`ryu-player__loading ${
          loading ? "ryu-player__loading--visible" : ""
        }`}
      >
        <div className="ryu-player__spinner" />
      </div>

      {error && (
        <div className="ryu-player__error">
          <div className="ryu-player__error-icon">!</div>
          <h3>Playback error</h3>
          <p>
            This media source could not be played. Try another server or reload
            the player.
          </p>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;

              setError(false);
              setLoading(true);

              if (video) {
                video.load();
              }
            }}
          >
            Retry
          </button>
        </div>
      )}

      <button
        type="button"
        className="ryu-player__center-button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={(event) => {
          event.stopPropagation();
          void togglePlay();
        }}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>

      <div
        className={`ryu-player__chrome ${
          controlsVisible ? "ryu-player__chrome--visible" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ryu-player__top">
          <div className="ryu-player__title">
            <span className="ryu-player__brand">RYUFLIX</span>
            {title && <span className="ryu-player__title-text">{title}</span>}
          </div>

          <div className="ryu-player__top-actions">
            <button
              type="button"
              className="ryu-player__icon-button"
              aria-label="Settings"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              ⚙
            </button>
          </div>
        </div>

        <div className="ryu-player__bottom">
          <div className="ryu-player__timeline">
            <span className="ryu-player__time">
              {formatTime(currentTime)}
            </span>

            <input
              className="ryu-player__seek"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              style={
                {
                  "--progress": `${progress}%`,
                } as React.CSSProperties
              }
              onChange={handleSeekBar}
              aria-label="Video progress"
            />

            <span className="ryu-player__time">
              {formatTime(duration)}
            </span>
          </div>

          <div className="ryu-player__controls">
            <button
              type="button"
              className="ryu-player__control"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => void togglePlay()}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>

            <button
              type="button"
              className="ryu-player__control"
              aria-label="Rewind 10 seconds"
              onClick={() => seek(-10)}
            >
              ↶
            </button>

            <button
              type="button"
              className="ryu-player__control"
              aria-label="Forward 10 seconds"
              onClick={() => seek(10)}
            >
              ↷
            </button>

            <button
              type="button"
              className="ryu-player__control"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={toggleMute}
            >
              {muted || volume === 0 ? "🔇" : "🔊"}
            </button>

            <input
              className="ryu-player__volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              style={
                {
                  "--volume": `${volumePercent}%`,
                } as React.CSSProperties
              }
              onChange={(event) =>
                changeVolume(Number(event.target.value))
              }
              aria-label="Volume"
            />

            <div className="ryu-player__spacer" />

            <button
              type="button"
              className="ryu-player__control ryu-player__control--settings"
              aria-label="Playback settings"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              {playbackRate}×
            </button>

            <button
              type="button"
              className="ryu-player__control"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? "⛶" : "⛶"}
            </button>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="ryu-player__settings"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="ryu-player__settings-title">
            Playback speed
          </div>

          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`ryu-player__settings-option ${
                playbackRate === speed
                  ? "ryu-player__settings-option--active"
                  : ""
              }`}
              onClick={() => changeSpeed(speed)}
            >
              <span>{speed}×</span>
              {playbackRate === speed && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
