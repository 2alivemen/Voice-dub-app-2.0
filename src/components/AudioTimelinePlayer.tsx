import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Disc3 } from 'lucide-react';
import { downloadBlob, base64ToArrayBuffer, getAudioContext } from '../utils/audioUtils';

interface AudioTimelinePlayerProps {
  title: string;
  subtitle?: string;
  audioBase64?: string;
  downloadFilename?: string;
  onEnded?: () => void;
}

export const AudioTimelinePlayer: React.FC<AudioTimelinePlayerProps> = ({
  title,
  subtitle,
  audioBase64,
  downloadFilename = 'Audio_Take.wav',
  onEnded,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [peaks, setPeaks] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load audio source and extract waveform peaks
  useEffect(() => {
    if (!audioBase64) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPeaks([]);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      return;
    }

    const audioUrl = `data:audio/wav;base64,${audioBase64}`;
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = audioUrl;
    audio.volume = isMuted ? 0 : volume;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
      onEnded?.();
    };

    // Extract waveform peaks using Web Audio API
    try {
      const audioCtx = getAudioContext();
      const arrayBuffer = base64ToArrayBuffer(audioBase64);
      audioCtx.decodeAudioData(arrayBuffer.slice(0)).then((decoded) => {
        const rawData = decoded.getChannelData(0);
        const sampleSize = 80; // Number of waveform bars
        const step = Math.floor(rawData.length / sampleSize);
        const newPeaks: number[] = [];

        for (let i = 0; i < sampleSize; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += Math.abs(rawData[i * step + j] || 0);
          }
          newPeaks.push(sum / step);
        }

        // Normalize peaks
        const maxPeak = Math.max(...newPeaks, 0.01);
        setPeaks(newPeaks.map((p) => p / maxPeak));
      });
    } catch (e) {
      console.warn('Waveform decoding error:', e);
    }

    return () => {
      audio.pause();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioBase64]);

  // Update current time tick
  useEffect(() => {
    const updateTick = () => {
      if (audioRef.current && isPlaying) {
        setCurrentTime(audioRef.current.currentTime);
        animationFrameRef.current = requestAnimationFrame(updateTick);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTick);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current || !audioBase64) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio play error:', err);
      });
    }
  };

  // Replay
  const handleReplay = () => {
    if (!audioRef.current || !audioBase64) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().then(() => {
      setIsPlaying(true);
    });
  };

  // Scrub timeline
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      setIsMuted(false);
      audioRef.current.volume = volume || 0.8;
    } else {
      setIsMuted(true);
      audioRef.current.volume = 0;
    }
  };

  // Format cinematic timecode: mm:ss.ms
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  // Handle download take
  const handleDownloadWav = () => {
    if (!audioBase64) return;
    const arrayBuf = base64ToArrayBuffer(audioBase64);
    const blob = new Blob([arrayBuf], { type: 'audio/wav' });
    downloadBlob(blob, downloadFilename);
  };

  if (!audioBase64) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[#0e111a] border border-[#232b3e] rounded-xl p-4 shadow-xl flex flex-col gap-3">
      {/* Track info bar */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#1b2132]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
            <Disc3 className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <h4 className="font-cinzel text-xs font-bold text-slate-100 tracking-wide">{title}</h4>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>

        {/* Timecode counter */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-amber-400 tracking-wider bg-[#141824] px-2.5 py-1 rounded border border-[#242c40]">
            {formatTimecode(currentTime)} / {formatTimecode(duration)}
          </span>
          <button
            onClick={handleDownloadWav}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#242c40] bg-[#141824] hover:bg-[#1a2030] text-[11px] font-medium text-slate-300 transition-colors"
            title="Download this audio master as WAV file"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>WAV</span>
          </button>
        </div>
      </div>

      {/* Interactive Waveform Display */}
      <div
        onClick={handleScrub}
        className="h-14 bg-[#080a0f] rounded-lg border border-[#1b2130] relative overflow-hidden cursor-pointer group flex items-center px-2"
        title="Click or drag to scrub playhead"
      >
        {/* Waveform bars */}
        <div className="w-full h-full flex items-center justify-between gap-[2px]">
          {peaks.length > 0 ? (
            peaks.map((peak, idx) => {
              const barPercent = (idx / peaks.length) * 100;
              const isPast = barPercent <= progressPercent;
              return (
                <div
                  key={idx}
                  className={`w-full rounded-sm transition-all duration-75 ${
                    isPast
                      ? 'bg-gradient-to-t from-amber-600 to-amber-400'
                      : 'bg-[#22293b] group-hover:bg-[#2c364c]'
                  }`}
                  style={{
                    height: `${Math.max(12, peak * 85)}%`,
                  }}
                />
              );
            })
          ) : (
            <div className="w-full flex items-center justify-center text-xs text-slate-600">
              Generating waveform...
            </div>
          )}
        </div>

        {/* Playhead line */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)] pointer-events-none transition-all duration-75"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Control Buttons & Volume */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-amber-900/40"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
            )}
          </button>

          {/* Replay */}
          <button
            onClick={handleReplay}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a2030] flex items-center justify-center transition-colors"
            title="Replay from start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-[#232b3e] rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
