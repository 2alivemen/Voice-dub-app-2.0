import React, { useState } from 'react';
import { X, Volume2, Mic, Play, Pause, RefreshCw, UserCheck, Plus, Sparkles, Check, Info } from 'lucide-react';
import { CharacterVoice, GeminiPrebuiltVoice } from '../types/screenplay';
import { auditionVoicePersona } from '../services/ttsService';

interface CharacterCastingDeskProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterVoice[];
  onUpdateCharacter: (updated: CharacterVoice) => void;
  onAddCharacter: (newChar: CharacterVoice) => void;
}

export const PREBUILT_VOICES: Array<{
  name: GeminiPrebuiltVoice;
  genderLabel: string;
  timbre: string;
  bestSuitedFor: string;
}> = [
  {
    name: 'Fenrir',
    genderLabel: 'Male Baritone',
    timbre: 'Deep, resonant, commanding baritone',
    bestSuitedFor: 'Emperors, generals, senior statesmen, authoritative figures',
  },
  {
    name: 'Charon',
    genderLabel: 'Male Bass',
    timbre: 'Heavy, gravelly, solemn bass with moral weight',
    bestSuitedFor: 'Elder statesmen, commanders, royal advisors, inquisitors',
  },
  {
    name: 'Kore',
    genderLabel: 'Female Mezzo',
    timbre: 'Calm, articulate, warm, and authoritative mezzo',
    bestSuitedFor: 'Wise queens, noblewomen, priestesses, scholars',
  },
  {
    name: 'Aoede',
    genderLabel: 'Female Soprano',
    timbre: 'Melodic, elegant, expressive, and breezy soprano',
    bestSuitedFor: 'Princesses, royal consorts, mythical figures, bards',
  },
  {
    name: 'Orus',
    genderLabel: 'Male Baritone',
    timbre: 'Bold, authoritative, intense, and defiant baritone',
    bestSuitedFor: 'Generals, warriors, challengers, commanders',
  },
  {
    name: 'Puck',
    genderLabel: 'Male Tenor',
    timbre: 'Youthful, spirited, agile, and expressive tenor',
    bestSuitedFor: 'Messengers, young princes, scouts, conspirators',
  },
  {
    name: 'Zephyr',
    genderLabel: 'Smooth Neutral',
    timbre: 'Measured, philosophical, smooth, and articulate neutral',
    bestSuitedFor: 'Sages, chroniclers, monks, philosophers, court advisors',
  },
  {
    name: 'Leda',
    genderLabel: 'Female Soft Alto',
    timbre: 'Gentle, poised, soft-spoken, and empathetic tone',
    bestSuitedFor: 'Courtiers, confidantes, healers, handmaidens',
  },
];

const PERSONALITY_PRESETS = [
  'Deep, measured, ominous cinematic documentary narrator.',
  'Controlled anger. Commanding, deliberate imperial authority.',
  'Regal sovereign with absolute authority, piercing and icy.',
  'Whispered paranoia and suppressed menace, urgent conspirator.',
  'Cynical court diplomat, measured, cautious, and calculating.',
  'Battlefield commander, breathless urgency and stern resolve.',
];

export const CharacterCastingDesk: React.FC<CharacterCastingDeskProps> = ({
  isOpen,
  onClose,
  characters,
  onUpdateCharacter,
  onAddCharacter,
}) => {
  const [activeAuditioningId, setActiveAuditioningId] = useState<string | null>(null);
  const [playingAuditionId, setPlayingAuditionId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [auditionError, setAuditionError] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newCharName, setNewCharName] = useState<string>('');

  if (!isOpen) return null;

  const handleAudition = async (char: CharacterVoice) => {
    try {
      setAuditionError(null);
      setActiveAuditioningId(char.id);

      const previewText = `I speak as ${char.name}. My voice shall echo through the halls of history.`;
      const base64Audio = await auditionVoicePersona(char.voiceName, char.basePersonality, previewText);

      onUpdateCharacter({
        ...char,
        auditionAudioBase64: base64Audio,
      });

      // Play immediately
      playAuditionAudio(char.id, base64Audio);
    } catch (err: any) {
      console.error(err);
      setAuditionError(err.message || 'Audition failed. Please check Gemini API key.');
    } finally {
      setActiveAuditioningId(null);
    }
  };

  const playAuditionAudio = (charId: string, base64Audio: string) => {
    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
    setAudioElement(audio);
    setPlayingAuditionId(charId);

    audio.onended = () => {
      setPlayingAuditionId(null);
    };

    audio.onerror = () => {
      setPlayingAuditionId(null);
    };

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      setPlayingAuditionId(null);
    });
  };

  const handleStopAudition = () => {
    if (audioElement) {
      audioElement.pause();
      setPlayingAuditionId(null);
    }
  };

  const handleCreateNewCharacter = () => {
    if (!newCharName.trim()) return;
    const colors = ['#f59e0b', '#38bdf8', '#ec4899', '#10b981', '#a855f7'];
    const newChar: CharacterVoice = {
      id: `char-custom-${Date.now()}`,
      name: newCharName.trim().toUpperCase(),
      voiceName: 'Fenrir',
      basePersonality: 'Resonant historical character with measured dramatic presence.',
      color: colors[characters.length % colors.length],
    };
    onAddCharacter(newChar);
    setNewCharName('');
    setIsAddingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#10131e] border border-[#262e44] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22293d] bg-[#141826]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-sky-950/60 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">Character Casting Desk</h2>
              <p className="text-xs text-slate-400">
                Persistent Gemini TTS voice allocation, gender/timbre profiling, and delivery style tuning.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleStopAudition();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#202638] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Guidance Banner on How Voices Are Assigned */}
        <div className="px-6 py-3 bg-[#0c0e18] border-b border-[#1b2234] text-xs text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] leading-relaxed">
            <div>
              <strong className="text-slate-200">How Voices & Genders Are Assigned in Scripts:</strong>
            </div>
            <p>
              1. <strong className="text-amber-300">In-Script Voice or Gender:</strong> Write <code className="text-amber-200 font-mono">Voice: Kore</code> or <code className="text-amber-200 font-mono">Voice: Female</code> or <code className="text-amber-200 font-mono">Voice: Charon</code> on its own line, or inside <code className="text-amber-200 font-mono">Style: Female voice (Kore), regal defiance</code>, or in the speaker tag <code className="text-amber-200 font-mono">VOICE 2 — VIKRAMADITYA (Male, Charon)(IA):</code>.
            </p>
            <p>
              2. <strong className="text-amber-300">Name Vocalization &amp; (IA) Rule:</strong> Regular character dialogue (e.g. <code className="text-amber-200 font-mono">VIKRAMADITYA: "..."</code>) announces the character name aloud before the dialogue. Adding <code className="text-amber-200 font-mono">(IA)</code> (e.g. <code className="text-amber-200 font-mono">VIKRAMADITYA(IA): "..."</code>) activates Inactive Announcement mode—the prebuilt voice switches, but the character name is not read aloud!
            </p>
            <p>
              3. <strong className="text-amber-300">Automatic Archetype Recognition:</strong> Female royalty/names (Queen, Empress, Lady, Lakshmi, Shantala) receive <strong>Kore</strong> (Female Mezzo); imperial/military rulers receive <strong>Fenrir</strong> (Male Baritone); priests/judges receive <strong>Charon</strong> (Male Bass); young conspirators/messengers receive <strong>Puck</strong> (Male Tenor).
            </p>
          </div>
        </div>

        {/* Global Audition Error banner */}
        {auditionError && (
          <div className="px-6 py-2.5 bg-rose-950/50 border-b border-rose-900/60 text-xs text-rose-300 flex items-center justify-between">
            <span>{auditionError}</span>
            <button onClick={() => setAuditionError(null)} className="text-slate-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Character Cards List */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {characters.map((char) => {
            const isAuditioning = activeAuditioningId === char.id;
            const isPlaying = playingAuditionId === char.id;

            return (
              <div
                key={char.id}
                className="p-4 sm:p-5 rounded-xl bg-[#0c0e17] border border-[#22293c] hover:border-[#2d3752] transition-colors flex flex-col gap-4 shadow-sm"
              >
                {/* Character Name & Voice Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1b2132]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: char.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-cinzel text-sm sm:text-base font-bold text-amber-200 tracking-wide">
                          {char.name}
                        </h3>
                        {char.assignmentSource && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#2e3952] bg-[#131724] text-amber-300" title="How this voice was assigned">
                            {char.assignmentSource}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Assigned Voice: <strong className="text-amber-300 font-mono">{char.voiceName}</strong> ({PREBUILT_VOICES.find(v => v.name === char.voiceName)?.genderLabel})
                      </span>
                    </div>
                  </div>

                  {/* Audition Voice Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (isPlaying) {
                          handleStopAudition();
                        } else if (char.auditionAudioBase64) {
                          playAuditionAudio(char.id, char.auditionAudioBase64);
                        } else {
                          handleAudition(char);
                        }
                      }}
                      disabled={isAuditioning}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-sky-800/60 bg-sky-950/40 hover:bg-sky-900/50 text-xs font-semibold text-sky-300 transition-colors shadow-sm disabled:opacity-50"
                      title="Audition voice delivery with current personality baseline"
                    >
                      {isAuditioning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Auditioning...</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-sky-300" />
                          <span>Pause Audition</span>
                        </>
                      ) : char.auditionAudioBase64 ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-sky-300" />
                          <span>Play Audition</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Audition Voice</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Prebuilt Voice Selectors (Male, Female, Tenor, Bass) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                    <span>Select Voice Actor & Timbre:</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Click to assign
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {PREBUILT_VOICES.map((v) => {
                      const isSelected = char.voiceName === v.name;
                      return (
                        <button
                          key={v.name}
                          onClick={() =>
                            onUpdateCharacter({
                              ...char,
                              voiceName: v.name,
                              auditionAudioBase64: undefined,
                            })
                          }
                          className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-950/40 ring-1 ring-amber-500/50 shadow-md'
                              : 'border-[#222a3e] bg-[#121624] hover:bg-[#181d2e] text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-cinzel text-xs font-bold text-amber-200">
                              {v.name}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              v.genderLabel.includes('Female')
                                ? 'bg-pink-950/60 border border-pink-800/50 text-pink-300'
                                : 'bg-sky-950/60 border border-sky-800/50 text-sky-300'
                            }`}>
                              {v.genderLabel}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                            {v.bestSuitedFor}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Base Personality & Delivery Style */}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Persistent Base Personality & Delivery Baseline</span>
                    </label>
                    <span className="text-[10px] text-slate-500 italic">
                      Passed to Gemini TTS speechMetadata across all scenes
                    </span>
                  </div>
                  <input
                    type="text"
                    value={char.basePersonality}
                    onChange={(e) =>
                      onUpdateCharacter({
                        ...char,
                        basePersonality: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#121622] border border-[#22293c] focus:border-amber-500/80 text-xs text-slate-200 outline-none"
                    placeholder="e.g. Controlled anger. Commanding, deliberate imperial delivery."
                  />

                  {/* Quick Preset Personality Chips */}
                  <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-500 mr-1">Presets:</span>
                    {PERSONALITY_PRESETS.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() =>
                          onUpdateCharacter({
                            ...char,
                            basePersonality: preset,
                          })
                        }
                        className="text-[10px] px-2 py-0.5 rounded border border-[#222a3e] bg-[#141824] hover:bg-[#1c2234] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {preset.split('.')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Character Section */}
          {isAddingNew ? (
            <div className="p-4 rounded-xl bg-[#121624] border border-amber-900/60 flex items-center justify-between gap-3">
              <input
                type="text"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                placeholder="CHARACTER NAME (e.g. QUEEN LAKSHMI)"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0a0d14] border border-[#262f46] text-xs uppercase font-semibold text-slate-200 outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewCharacter}
                  disabled={!newCharName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition-colors"
                >
                  Add Character
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full py-3 rounded-xl border border-dashed border-[#263048] hover:border-amber-600/60 text-slate-400 hover:text-amber-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors bg-[#0b0e16]/50"
            >
              <Plus className="w-4 h-4" />
              <span>Cast Additional Dramatis Persona</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#22293d] bg-[#141824] flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Voice identity is preserved across all scenes and dialogue turns.</span>
          </span>
          <button
            onClick={() => {
              handleStopAudition();
              onClose();
            }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-slate-950 transition-colors shadow-md shadow-amber-950/30"
          >
            <Check className="w-4 h-4" />
            <span>Save Casting Assignments</span>
          </button>
        </div>
      </div>
    </div>
  );
};
