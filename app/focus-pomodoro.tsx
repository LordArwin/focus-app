'use client';

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "focus" | "shortBreak" | "longBreak";
type BackgroundKind = "image" | "video";

const STORAGE_KEY = "focus-app-settings";
const DEFAULT_BACKDROP =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80";
const DEFAULT_SPOTIFY =
  "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M";
const ALARM_URL = new URL("./assets/alarme.mp3", import.meta.url).href;

const PRESET_BACKDROPS = [
  {
    label: "Study Session",
    url: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2dnaDQ1NDR4dGF0MjNlMW5ubzhiYjZwbDlud3Vhbm80eDV4ZXlkbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/6XX4V0O8a0xdS/giphy.gif",
  },
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function parseSpotifyEmbedUrl(input: string) {
  const value = input.trim();
  if (!value) return "";
  if (value.includes("open.spotify.com/embed/")) return value;

  const match = value.match(
    /open\.spotify\.com\/(playlist|album|track|artist|episode)\/([A-Za-z0-9]+)/,
  );
  if (!match) return "";

  const [, type, id] = match;
  return `https://open.spotify.com/embed/${type}/${id}`;
}

function detectBackgroundKind(input: string): BackgroundKind {
  const value = input.trim().toLowerCase();
  if (/\.(mp4|webm|ogg|mov)(\?|#|$)/.test(value)) {
    return "video";
  }

  return "image";
}

function PlayPauseIcon({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
        <path fill="currentColor" d="M8 5.5v13l10-6.5z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
      <path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        fill="currentColor"
        d="M12 5a7 7 0 1 1-4.95 11.95l1.41-1.41A5 5 0 1 0 12 7h-2V4l-4 4 4 4V9h2a3 3 0 1 1 0 6h-1v2h1a5 5 0 1 0 0-10z"
      />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          fill="currentColor"
          d="M12 5c5.5 0 9.5 4.5 10.7 7-1.2 2.5-5.2 7-10.7 7-5.5 0-9.5-4.5-10.7-7C2.5 9.5 6.5 5 12 5zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        fill="currentColor"
        d="M3.28 4.72 4.7 3.3l16 16-1.42 1.42-2.16-2.16A11.2 11.2 0 0 1 12 19c-5.5 0-9.5-4.5-10.7-7a15 15 0 0 1 4.07-4.99L3.28 4.72zM8.9 10.33A4 4 0 0 0 13.67 15.1l-4.77-4.77zM12 5c5.5 0 9.5 4.5 10.7 7a15 15 0 0 1-2.86 3.79l-1.4-1.4A13.1 13.1 0 0 0 21 12c-1.2-2.5-5.2-7-10.7-7-1.2 0-2.3.2-3.33.52L5.5 4.05A11.2 11.2 0 0 1 12 5z"
      />
    </svg>
  );
}

function loadSettings() {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as Partial<{
      workMinutes: number;
      shortBreakMinutes: number;
      longBreakMinutes: number;
      roundsBeforeLongBreak: number;
      backgroundUrl: string;
      backgroundKind: BackgroundKind;
      spotifyUrl: string;
    }>;
  } catch {
    return null;
  }
}

export default function FocusPomodoro() {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [roundsBeforeLongBreak, setRoundsBeforeLongBreak] = useState(4);
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKDROP);
  const [backgroundKind, setBackgroundKind] = useState<BackgroundKind>("image");
  const [backgroundInput, setBackgroundInput] = useState(DEFAULT_BACKDROP);
  const [spotifyInput, setSpotifyInput] = useState(DEFAULT_SPOTIFY);
  const [spotifyUrl, setSpotifyUrl] = useState(DEFAULT_SPOTIFY);
  const [phase, setPhase] = useState<Phase>("focus");
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [focusSpotifyVisible, setFocusSpotifyVisible] = useState(true);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const backgroundObjectUrlRef = useRef<string | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (backgroundObjectUrlRef.current) {
        URL.revokeObjectURL(backgroundObjectUrlRef.current);
        backgroundObjectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    alarmAudioRef.current = new Audio(ALARM_URL);
    alarmAudioRef.current.preload = "auto";

    return () => {
      alarmAudioRef.current?.pause();
      alarmAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const settings = loadSettings();
    const timeoutId = window.setTimeout(() => {
      if (settings) {
        const nextWorkMinutes = clampNumber(settings.workMinutes ?? 25, 1, 180);
        const nextShortBreakMinutes = clampNumber(settings.shortBreakMinutes ?? 5, 1, 60);
        const nextLongBreakMinutes = clampNumber(settings.longBreakMinutes ?? 15, 1, 120);
        const nextRoundsBeforeLongBreak = clampNumber(
          settings.roundsBeforeLongBreak ?? 4,
          1,
          12,
        );
        const nextBackgroundUrl = settings.backgroundUrl ?? DEFAULT_BACKDROP;
        const nextBackgroundKind =
          settings.backgroundKind ?? detectBackgroundKind(nextBackgroundUrl);
        const nextSpotifyInput = settings.spotifyUrl ?? DEFAULT_SPOTIFY;
        const embeddedSpotify = parseSpotifyEmbedUrl(nextSpotifyInput);

        setWorkMinutes(nextWorkMinutes);
        setShortBreakMinutes(nextShortBreakMinutes);
        setLongBreakMinutes(nextLongBreakMinutes);
        setRoundsBeforeLongBreak(nextRoundsBeforeLongBreak);
        setBackgroundUrl(nextBackgroundUrl);
        setBackgroundKind(nextBackgroundKind);
        setBackgroundInput(nextBackgroundUrl);
        setSpotifyInput(nextSpotifyInput);
        setSpotifyUrl(embeddedSpotify || DEFAULT_SPOTIFY);
        setSecondsLeft(nextWorkMinutes * 60);
      }

      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const currentSettings = loadSettings() ?? {};
    const storedBackgroundUrl = backgroundUrl.startsWith("blob:")
      ? currentSettings.backgroundUrl ?? DEFAULT_BACKDROP
      : backgroundUrl;
    const storedBackgroundKind = backgroundUrl.startsWith("blob:")
      ? currentSettings.backgroundKind ?? backgroundKind
      : backgroundKind;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        roundsBeforeLongBreak,
        backgroundUrl: storedBackgroundUrl,
        backgroundKind: storedBackgroundKind,
        spotifyUrl,
      }),
    );
  }, [
    backgroundUrl,
    backgroundKind,
    isLoaded,
    longBreakMinutes,
    roundsBeforeLongBreak,
    shortBreakMinutes,
    spotifyUrl,
    workMinutes,
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) {
          return current - 1;
        }

        window.clearInterval(interval);
        alarmAudioRef.current?.pause();
        if (alarmAudioRef.current) {
          alarmAudioRef.current.currentTime = 0;
          void alarmAudioRef.current.play().catch(() => {});
        }

        if (phase === "focus") {
          const nextCycles = cyclesCompleted + 1;
          const nextPhase =
            nextCycles % roundsBeforeLongBreak === 0 ? "longBreak" : "shortBreak";
          const nextDuration =
            nextPhase === "longBreak"
              ? longBreakMinutes * 60
              : shortBreakMinutes * 60;

          setPhase(nextPhase);
          setCyclesCompleted(nextCycles);
          setIsRunning(false);
          setAwaitingContinue(true);
          return nextDuration;
        }

        setPhase("focus");
        setIsRunning(false);
        setAwaitingContinue(true);
        return workMinutes * 60;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    cyclesCompleted,
    isRunning,
    longBreakMinutes,
    phase,
    roundsBeforeLongBreak,
    shortBreakMinutes,
    workMinutes,
  ]);

  const activeDuration =
    phase === "focus"
      ? workMinutes * 60
      : phase === "shortBreak"
        ? shortBreakMinutes * 60
        : longBreakMinutes * 60;

  const progress = useMemo(() => {
    if (activeDuration === 0) return 0;
    return Math.min(
      100,
      Math.max(0, ((activeDuration - secondsLeft) / activeDuration) * 100),
    );
  }, [activeDuration, secondsLeft]);

  const phaseLabels: Record<Phase, string> = {
    focus: "Foco profundo",
    shortBreak: "Pausa curta",
    longBreak: "Pausa longa",
  };

  function applyBackground(value: string) {
    const trimmed = value.trim();
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
      backgroundObjectUrlRef.current = null;
    }
    setBackgroundInput(trimmed);
    setBackgroundUrl(trimmed || DEFAULT_BACKDROP);
    setBackgroundKind(detectBackgroundKind(trimmed || DEFAULT_BACKDROP));
  }

  function applyBackgroundFile(file: File) {
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    backgroundObjectUrlRef.current = objectUrl;
    setBackgroundUrl(objectUrl);
    setBackgroundKind(
      file.type.startsWith("video/")
        ? "video"
        : detectBackgroundKind(file.name || file.type),
    );
    setBackgroundInput(file.name);
  }

  function applySpotify(value: string) {
    const embedded = parseSpotifyEmbedUrl(value);
    setSpotifyInput(value);
    setSpotifyUrl(embedded || DEFAULT_SPOTIFY);
  }

  function toggleTimer() {
    setAwaitingContinue(false);
    setIsRunning((current) => !current);
  }

  function resetTimer() {
    setIsRunning(false);
    setAwaitingContinue(false);
    setPhase("focus");
    setCyclesCompleted(0);
    setSecondsLeft(workMinutes * 60);
  }

  function skipPhase() {
    setIsRunning(false);
    setAwaitingContinue(false);

    if (phase === "focus") {
      const nextCycles = cyclesCompleted + 1;
      const nextPhase =
        nextCycles % roundsBeforeLongBreak === 0 ? "longBreak" : "shortBreak";
      setCyclesCompleted(nextCycles);
      setPhase(nextPhase);
      setSecondsLeft(
        nextPhase === "longBreak" ? longBreakMinutes * 60 : shortBreakMinutes * 60,
      );
      return;
    }

    setPhase("focus");
    setSecondsLeft(workMinutes * 60);
  }

  function applyPreset(url: string) {
    if (backgroundObjectUrlRef.current) {
      URL.revokeObjectURL(backgroundObjectUrlRef.current);
      backgroundObjectUrlRef.current = null;
    }
    setBackgroundInput(url);
    setBackgroundUrl(url);
    setBackgroundKind(detectBackgroundKind(url));
  }

  const showEditor = !isRunning;
  const focusMode = isRunning;
  const focusPlayLabel = awaitingContinue ? "Continuar" : isRunning ? "Pausar" : "Iniciar";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] text-white">
      {backgroundKind === "video" ? (
        <video
          key={backgroundUrl}
          className="absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-700 ease-out"
          src={backgroundUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-[background-image,transform,opacity] duration-700 ease-out"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(7, 11, 20, 0.08), rgba(7, 11, 20, 0.52)), url(${backgroundUrl})`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_34%),radial-gradient(circle_at_20%_20%,_rgba(125,211,252,0.14),_transparent_26%),radial-gradient(circle_at_80%_15%,_rgba(251,191,36,0.1),_transparent_22%),linear-gradient(135deg,_rgba(7,11,20,0.08),_rgba(7,11,20,0.45))] animate-drift" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        {focusMode ? (
          <div className="relative mt-4 min-h-[calc(100vh-5.5rem)]">
            <article className="absolute left-0 top-0 z-10 rounded-[18px] border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div
                  className="relative grid h-24 w-24 place-items-center rounded-full border border-white/10 bg-black/30 shadow-[0_0_35px_rgba(34,211,238,0.15)] sm:h-28 sm:w-28"
                  style={{
                    background: `conic-gradient(rgba(34,211,238,0.95) ${progress}%, rgba(255,255,255,0.1) ${progress}% 100%)`,
                  }}
                >
                  <div className="grid h-[82%] w-[82%] place-items-center rounded-full border border-white/10 bg-[#070b14]/90 text-center">
                    <div>
                      <div className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {formatTime(secondsLeft)}
                      </div>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/50">
                        {phaseLabels[phase]}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTimer}
                  aria-label={focusPlayLabel}
                  title={focusPlayLabel}
                  className="grid h-7 w-7 place-items-center rounded-full bg-cyan-400/85 text-slate-950 transition hover:bg-cyan-300"
                >
                  <PlayPauseIcon paused={!isRunning || awaitingContinue} />
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  aria-label="Resetar"
                  title="Resetar"
                  className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <ResetIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setFocusSpotifyVisible((current) => !current)}
                  aria-label={focusSpotifyVisible ? "Ocultar Spotify" : "Mostrar Spotify"}
                  title={focusSpotifyVisible ? "Ocultar Spotify" : "Mostrar Spotify"}
                  className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <EyeIcon hidden={!focusSpotifyVisible} />
                </button>
              </div>
            </article>

            {focusSpotifyVisible ? (
              <article className="absolute right-0 top-0 z-10 w-[min(21rem,calc(100vw-2rem))] rounded-[18px] border border-white/10 bg-black/25 p-2.5 shadow-2xl shadow-black/25 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.32em] text-white/45">
                      Spotify
                    </p>
                    <h3 className="mt-1 text-xs font-medium text-white/90">
                      Playlist compacta
                    </h3>
                  </div>
                </div>

                <div className="mt-2.5 overflow-hidden rounded-[16px] border border-white/10 bg-black/40">
                  <iframe
                    title="Spotify playlist embed"
                    src={spotifyUrl}
                    className="h-36 w-full"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              </article>
            ) : null}

          </div>
        ) : (
          <>
            {showEditor ? (
              <header className="mt-4 grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                    Focus Studio
                  </p>
                  <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                    Pomodoro com fundo animado, Spotify e foco limpo.
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-white/72">
                    Ajuste tudo primeiro, depois esconda a interface para deixar só o fundo, o timer e a playlist.
                  </p>
                </div>

                <div className="grid gap-3 rounded-[20px] border border-white/10 bg-black/25 p-4 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-[0.3em] text-white/45">Sessão</span>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                      {phaseLabels[phase]}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                      <div className="text-lg font-semibold text-white">{cyclesCompleted}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
                        Ciclos
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                      <div className="text-lg font-semibold text-white">{roundsBeforeLongBreak}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
                        Longa
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                      <div className="text-lg font-semibold text-white">{formatTime(secondsLeft)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">
                        Restante
                      </div>
                    </div>
                  </div>
                </div>
              </header>
            ) : null}

            <section className="mt-4 grid flex-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="grid place-items-center gap-4">
                <article className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/25 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
                  <div className="relative grid gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-white/45">
                          Temporizador
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-white">
                          {phaseLabels[phase]}
                        </h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                        {isRunning ? "Em foco" : "Pausado"}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <div
                        className="relative grid h-52 w-52 place-items-center rounded-full border border-white/10 bg-black/30 shadow-[0_0_60px_rgba(34,211,238,0.16)] sm:h-64 sm:w-64"
                        style={{
                          background: `conic-gradient(rgba(34,211,238,0.95) ${progress}%, rgba(255,255,255,0.1) ${progress}% 100%)`,
                        }}
                      >
                        <div className="grid h-[84%] w-[84%] place-items-center rounded-full border border-white/10 bg-[#070b14]/90 text-center">
                          <div>
                            <div className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                              {formatTime(secondsLeft)}
                            </div>
                            <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-white/50">
                              {phaseLabels[phase]}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {showEditor ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={toggleTimer}
                          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                        >
                          Iniciar
                        </button>
                        <button
                          type="button"
                          onClick={resetTimer}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Resetar
                        </button>
                        <button
                          type="button"
                          onClick={skipPhase}
                          className="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/20"
                        >
                          Pular
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className="rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/45">
                        Spotify
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">
                        Playlist compacta
                      </h3>
                    </div>
                  </div>

                  {showEditor ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        type="url"
                        value={spotifyInput}
                        onChange={(event) => setSpotifyInput(event.target.value)}
                        placeholder="Link da playlist"
                        className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/50"
                      />
                      <button
                        type="button"
                        onClick={() => applySpotify(spotifyInput)}
                        className="self-start rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-300/18"
                      >
                        Carregar
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 overflow-hidden rounded-[20px] border border-white/10 bg-black/40">
                    <iframe
                      title="Spotify playlist embed"
                      src={spotifyUrl}
                      className="h-40 w-full sm:h-52"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                  </div>
                </article>
              </div>

              {showEditor ? (
                <aside className="grid gap-4">
                  <article className="grid gap-4 rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/45">
                          Configurações
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                          Ajuste os ciclos
                        </h3>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2 text-sm text-white/75">
                        Minutos de foco
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={workMinutes}
                          onChange={(event) => {
                            const nextValue = clampNumber(Number(event.target.value), 1, 180);
                            setWorkMinutes(nextValue);
                            if (phase === "focus" && !isRunning) {
                              setSecondsLeft(nextValue * 60);
                            }
                          }}
                          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-white outline-none transition focus:border-cyan-300/50"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-white/75">
                        Pausa curta
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={shortBreakMinutes}
                          onChange={(event) => {
                            const nextValue = clampNumber(Number(event.target.value), 1, 60);
                            setShortBreakMinutes(nextValue);
                            if (phase === "shortBreak" && !isRunning) {
                              setSecondsLeft(nextValue * 60);
                            }
                          }}
                          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-white outline-none transition focus:border-cyan-300/50"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-white/75">
                        Pausa longa
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={longBreakMinutes}
                          onChange={(event) => {
                            const nextValue = clampNumber(Number(event.target.value), 1, 120);
                            setLongBreakMinutes(nextValue);
                            if (phase === "longBreak" && !isRunning) {
                              setSecondsLeft(nextValue * 60);
                            }
                          }}
                          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-white outline-none transition focus:border-cyan-300/50"
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-white/75">
                        Ciclos até longa
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={roundsBeforeLongBreak}
                          onChange={(event) =>
                            setRoundsBeforeLongBreak(
                              clampNumber(Number(event.target.value), 1, 12),
                            )
                          }
                          className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-white outline-none transition focus:border-cyan-300/50"
                        />
                      </label>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-3">
                      <p className="text-sm font-medium text-white">Imagem, GIF ou vídeo de fundo</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="url"
                          value={backgroundInput}
                          onChange={(event) => setBackgroundInput(event.target.value)}
                          placeholder="https://..."
                          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/50"
                        />
                        <button
                          type="button"
                          onClick={() => applyBackground(backgroundInput)}
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                          >
                            Aplicar
                          </button>
                      </div>
                      <div className="mt-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white/80 transition hover:bg-black/35">
                          <span>Importar do computador</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              applyBackgroundFile(file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <p className="mt-2 text-xs text-white/55">
                          Arquivos locais funcionam na sessão atual. Depois de recarregar, o fundo volta para a última URL salva.
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-white/55">
                        URLs diretas de imagem, GIF, MP4, WEBM ou OGG funcionam como fundo.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {PRESET_BACKDROPS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPreset(preset.url)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/12"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                </aside>
              ) : null}
            </section>
          </>
        )}

        {isRunning ? (
          <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/75 backdrop-blur-xl">
            Modo foco ativo
          </div>
        ) : null}
      </div>
    </main>
  );
}
