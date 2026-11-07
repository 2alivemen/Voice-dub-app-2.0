import React, { useState } from 'react';
import { Mic, Play, Pause, RefreshCw, AlertCircle, Sparkles, Download, CheckCircle2, Volume2, UserCheck, MicOff } from 'lucide-react';
import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice } from '../types/screenplay';
import { base64ToArrayBuffer, downloadBlob } from '../utils/audioUtils';

interface DialogueTurnCardProps {
  turn: DialogueTurn;
  index: number;
  assignedCharacter?: CharacterVoice;
  isGeneratingLine: boolean;
  onUpdateTurn: (updated: DialogueTurn) => void;
  onRegenerateLine: (turn: DialogueTurn) => void;
  onUpdateCharacterVoice?: (speaker: string, newVoice: GeminiPrebuiltVoice) => void;
}

const HISTORICAL_EMOTION_PRESETS = [
  'Deep, measured, ominous',
  'Controlled anger, commanding',
  'Quiet suspense, building tension',
  'Regal authority, deliberate',
  'Restrained anger',
  'Whispering in terror',
  'Urgent resolve',
  'Grave solemnity',
  'Sorrowful contemplation',
];

const GEMINI_VOICES: Array<{ name: GeminiPrebuiltVoice; label: string; gender: string }> = [
  { name: 'Fenrir', label: 'Fenrir', gender: 'Male Baritone (Commanding)' },
  { name: 'Charon', label: 'Charon', gender: 'Male Bass (Solemn/Gravelly)' },
  { name: 'Kore', label: 'Kore', gender: 'Female Mezzo (Regal/Warm)' },
  { name: 'Aoede', label: 'Aoede', gender: 'Female Soprano (Melodic/Expressive)' },
  { name: 'Orus', label: 'Orus', gender: 'Male Baritone (Bold/Warrior)' },
  { name: 'Puck', label: 'Puck', gender: 'Male Tenor (Youthful/Agile)' },
  { name: 'Zephyr', label: 'Zephyr', gender: 'Smooth Neutral (Sage/Philosopher)' },
  { name: 'Leda', label: 'Leda', gender: 'Female Soft Alto (Gentle/Healer)' },
];

export const DialogueTurnCard: React.FC<DialogueTurnCardProps> = ({
  turn,
  index,
  assignedCharacter,
  isGeneratingLine,
  onUpdateTurn,
  onRegenerateLine,
  onUpdateCharacterVoice,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const charName = assignedCharacter?.name || turn.speaker;
  const voiceName = assignedCharacter?.voiceName || 'Fenrir';
  const charColor = assignedCharacter?.color || '#f59e0b';

  const togglePlayLine = () => {
    if (!turn.audioBase64) {
      // If not yet voiced, trigger synthesis of this line!
      onRegenerateLine(turn);
      return;
    }

    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(`data:audio/wav;base64,${turn.audioBase64}`);
    setAudioElement(audio);
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.onerror = () => {
      setIsPlaying(false);
    };

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      setIsPlaying(false);
    });
  };

  const handleDownloadLineWav = () => {
    if (!turn.audioBase64) {
      onRegenerateLine(turn);
      return;
    }
    const arrayBuf = base64ToArrayBuffer(turn.audioBase64);
    const blob = new Blob([arrayBuf], { type: 'audio/wav' });
    const safeSpeaker = turn.speaker.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadBlob(blob, `Line_${String(index + 1).padStart(3, '0')}_${safeSpeaker}.wav`);
  };

  const isVoiced = Boolean(turn.audioBase64);
  const isVocalizingName = Boolean(turn.vocalizeSpeakerName);

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#0c0e17] border border-[#1f263a] hover:border-[#2d3752] transition-colors flex flex-col gap-3.5 shadow-sm">
      {/* Turn Header: Speaker, Assigned Voice, Line Number, Name Vocalization Toggle, and Audio Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#181d2c]">
        {/* Character identity & voice badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: charColor }}
          />
          <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-200 tracking-wider">
            {charName}
          </span>

          {/* Quick In-Line Voice Selector Dropdown */}
          <div className="flex items-center gap-1">
            <select
              value={voiceName}
              onChange={(e) => {
                const newVoice = e.target.value as GeminiPrebuiltVoice;
                if (onUpdateCharacterVoice) {
                  onUpdateCharacterVoice(turn.speaker, newVoice);
                }
              }}
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#2b354e] bg-[#141826] text-amber-300 focus:border-amber-500 outline-none cursor-pointer"
              title="Click to change this character's persistent Gemini TTS voice"
            >
              {GEMINI_VOICES.map((v) => (
                <option key={v.name} value={v.name}>
                  Voice: {v.name} ({v.gender})
                </option>
              ))}
            </select>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">
            Line #{index + 1}
          </span>

          {/* Toggle: Announce Speaker Name vs Direct Dialogue (IA mode) */}
          <button
            onClick={() =>
              onUpdateTurn({
                ...turn,
                vocalizeSpeakerName: !isVocalizingName,
                audioBase64: undefined, // prompt change invalidates current take
              })
            }
            className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full border transition-all ${
              isVocalizingName
                ? 'border-amber-700/80 bg-amber-950/70 text-amber-300 font-semibold shadow-sm'
                : 'border-sky-800/60 bg-sky-950/50 text-sky-300 hover:text-sky-200'
            }`}
            title="Click to toggle name announcement. Inactive Announcement (IA) changes the voice without speaking the character name aloud."
          >
            {isVocalizingName ? (
              <>
                <Volume2 className="w-3 h-3 text-amber-400" />
                <span>Name Announced Aloud</span>
              </>
            ) : (
              <>
                <MicOff className="w-3 h-3 text-sky-400" />
                <span>Direct Dialogue (IA - No Name)</span>
              </>
            )}
          </button>

          {isVoiced ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" />
              <span>Take Ready</span>
              {turn.duration && <span className="text-slate-400">({turn.duration.toFixed(1)}s)</span>}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500">
              Not voiced yet
            </span>
          )}
        </div>

        {/* Action buttons: ALWAYS visible Play, Individual Download WAV, and Record Take */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Individual line audio player: Plays if ready, or voices & plays if not yet generated */}
          <button
            onClick={togglePlayLine}
            disabled={isGeneratingLine}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-all shadow-sm active:scale-95 ${
              isVoiced
                ? 'border-emerald-700/70 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300'
                : 'border-[#2d3752] bg-[#141826] hover:bg-[#1d2436] text-amber-300'
            }`}
            title={
              isVoiced
                ? 'Preview this individual dialogue take'
                : 'Synthesize only this dialogue turn and play it immediately'
            }
          >
            {isGeneratingLine ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Voicing Line...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-emerald-300" />
                <span>Pause Take</span>
              </>
            ) : isVoiced ? (
              <>
                <Play className="w-3.5 h-3.5 fill-emerald-300" />
                <span>Play Take</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Play / Voice Line</span>
              </>
            )}
          </button>

          {/* Explicit Individual Download Button: Always present */}
          <button
            onClick={handleDownloadLineWav}
            disabled={isGeneratingLine}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-colors shadow-sm ${
              isVoiced
                ? 'border-[#2b354e] bg-[#141824] hover:bg-[#1a2132] text-slate-200'
                : 'border-[#222a3e] bg-[#10131e] hover:bg-[#161c2a] text-slate-400'
            }`}
            title={
              isVoiced
                ? `Download Line ${index + 1} (${charName}) as standalone WAV file`
                : 'Voice this line to download WAV'
            }
          >
            <Download className={`w-3.5 h-3.5 ${isVoiced ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Download WAV</span>
          </button>

          {/* Re-record Single Line Button */}
          <button
            onClick={() => onRegenerateLine(turn)}
            disabled={isGeneratingLine}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-md border border-amber-700/70 bg-gradient-to-r from-amber-600/80 to-amber-700/80 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-xs font-bold text-slate-950 transition-all shadow-sm active:scale-95"
            title="Fine-tune this single line with current emotional direction"
          >
            {isGeneratingLine ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                <span>Recording Take...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                <span>{turn.audioBase64 ? 'Re-record Take' : 'Record Take'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spoken Dialogue Text (Verbatim Speech) */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center justify-between">
          <span>Spoken Dialogue (Verbatim Speech)</span>
          <span className="text-[10px] text-slate-500 font-normal italic">
            {isVocalizingName
              ? `Spoken as: "${charName}: ${turn.text.trim()}"`
              : 'Spoken directly without character name announcement'}
          </span>
        </label>
        <textarea
          value={turn.text}
          onChange={(e) =>
            onUpdateTurn({
              ...turn,
              text: e.target.value,
              audioBase64: undefined,
            })
          }
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-[#07090e] border border-[#1e2538] focus:border-amber-500/80 text-xs font-script leading-relaxed text-slate-100 placeholder-slate-600 outline-none resize-none shadow-inner"
          placeholder="Spoken dialogue words..."
        />
      </div>

      {/* Per-Turn Emotional Direction / Delivery Style */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Turn Emotional Direction / Delivery Style</span>
          </label>
          <span className="text-[10px] text-slate-500 italic">
            Passed as Gemini TTS speechMetadata (never spoken aloud)
          </span>
        </div>

        <input
          type="text"
          value={turn.emotion}
          onChange={(e) =>
            onUpdateTurn({
              ...turn,
              emotion: e.target.value,
            })
          }
          className="w-full px-3 py-1.5 rounded-lg bg-[#121622] border border-[#20273a] focus:border-amber-500/80 text-xs text-amber-200 placeholder-slate-600 outline-none font-sans shadow-inner"
          placeholder="e.g. Deep, measured, ominous / Controlled anger, commanding / Quiet suspense..."
        />

        {/* Emotion Preset Chips */}
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
          <span className="text-[10px] text-slate-500 mr-1">Presets:</span>
          {HISTORICAL_EMOTION_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() =>
                onUpdateTurn({
                  ...turn,
                  emotion: preset,
                })
              }
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                turn.emotion.toLowerCase().includes(preset.toLowerCase().slice(0, 10))
                  ? 'border-amber-600/70 bg-amber-950/50 text-amber-300 font-medium'
                  : 'border-[#1f273b] bg-[#111420] hover:bg-[#181d2c] text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Turn Error State */}
      {turn.error && (
        <div className="p-2.5 rounded bg-rose-950/50 border border-rose-900 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{turn.error}</span>
        </div>
      )}
    </div>
  );
};
