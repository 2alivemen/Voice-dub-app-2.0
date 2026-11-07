import React, { useState } from 'react';
import { Play, Mic, Download, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, EyeOff } from 'lucide-react';
import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene } from '../types/screenplay';
import { DialogueTurnCard } from './DialogueTurnCard';
import { AudioTimelinePlayer } from './AudioTimelinePlayer';
import { base64ToArrayBuffer, downloadBlob } from '../utils/audioUtils';

interface SceneCardProps {
  scene: Scene;
  characterVoices: CharacterVoice[];
  isSynthesizingScene: boolean;
  activeLineGeneratingId: string | null;
  onSynthesizeScene: (scene: Scene) => void;
  onUpdateScene: (updatedScene: Scene) => void;
  onRegenerateLine: (turn: DialogueTurn, sceneId: string) => void;
  onUpdateCharacterVoice?: (speaker: string, newVoice: GeminiPrebuiltVoice) => void;
  onVoiceAllLinesIndividually?: (scene: Scene) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  characterVoices,
  isSynthesizingScene,
  activeLineGeneratingId,
  onSynthesizeScene,
  onUpdateScene,
  onRegenerateLine,
  onUpdateCharacterVoice,
  onVoiceAllLinesIndividually,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Character mapping
  const charVoiceMap = React.useMemo(() => {
    const map: Record<string, CharacterVoice> = {};
    for (const cv of characterVoices) {
      map[cv.name.trim().toLowerCase()] = cv;
    }
    return map;
  }, [characterVoices]);

  // Unique speakers in this scene
  const sceneSpeakers = React.useMemo(() => {
    return Array.from(new Set(scene.dialogueTurns.map((t) => t.speaker.trim())));
  }, [scene.dialogueTurns]);

  const handleUpdateTurn = (updatedTurn: DialogueTurn) => {
    const updatedTurns = scene.dialogueTurns.map((t) =>
      t.id === updatedTurn.id ? updatedTurn : t
    );
    onUpdateScene({
      ...scene,
      dialogueTurns: updatedTurns,
    });
  };

  const handleBatchToggleNameVocalization = (vocalize: boolean) => {
    const updatedTurns = scene.dialogueTurns.map((t) => ({
      ...t,
      vocalizeSpeakerName: vocalize,
      audioBase64: undefined,
    }));
    onUpdateScene({
      ...scene,
      dialogueTurns: updatedTurns,
    });
  };

  const handleDownloadSceneWav = () => {
    if (!scene.audioBase64) return;
    const arrayBuf = base64ToArrayBuffer(scene.audioBase64);
    const blob = new Blob([arrayBuf], { type: 'audio/wav' });
    const padded = String(scene.sceneNumber).padStart(3, '0');
    downloadBlob(blob, `Scene_${padded}.wav`);
  };

  const completedTurns = scene.dialogueTurns.filter((t) => t.audioBase64).length;
  const isFullyVoiced = scene.audioBase64 !== undefined;

  return (
    <div className="bg-[#10131e] border border-[#232b3e] rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Scene Header */}
      <div className="p-4 sm:p-5 bg-[#141826] border-b border-[#20273c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Scene Title & Slug */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/60 flex items-center justify-center font-cinzel text-xs font-bold text-amber-300 shrink-0">
            {scene.sceneNumber}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-cinzel text-sm sm:text-base font-bold text-amber-100 tracking-wide">
                {scene.slug}
              </h3>
              {isFullyVoiced ? (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-800/60 bg-emerald-950/40 text-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Scene Voiced</span>
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-700/60 bg-slate-900/60 text-slate-400">
                  {completedTurns}/{scene.dialogueTurns.length} turns ready
                </span>
              )}
            </div>

            {/* Dramatis Personae in this Scene */}
            <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
              <span className="text-slate-400">Speakers ({sceneSpeakers.length}):</span>
              {sceneSpeakers.map((speaker) => {
                const cv = charVoiceMap[speaker.toLowerCase()];
                return (
                  <span
                    key={speaker}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#2b354e] bg-[#0d1019] text-[11px]"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cv?.color || '#f59e0b' }}
                    />
                    <span className="font-medium text-slate-200">{speaker}</span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      [{cv?.voiceName || 'Fenrir'}]
                    </span>
                  </span>
                );
              })}

              {sceneSpeakers.length > 2 && (
                <span className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-800/50 px-2 py-0.5 rounded">
                  Multi-speaker ({sceneSpeakers.length} cast): Auto-batched into 2-speaker pairs
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scene Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Download Scene WAV button */}
          {scene.audioBase64 && (
            <button
              onClick={handleDownloadSceneWav}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2b354e] bg-[#141826] hover:bg-[#1c2234] text-xs font-medium text-slate-300 transition-colors shadow-sm"
              title="Download Scene audio as Scene_00X.wav"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Scene_{String(scene.sceneNumber).padStart(3, '0')}.wav</span>
            </button>
          )}

          {/* Synthesize Scene Button */}
          <button
            onClick={() => onSynthesizeScene(scene)}
            disabled={isSynthesizingScene}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-xs font-semibold text-slate-950 transition-all shadow-md shadow-amber-950/30 active:scale-95"
            title="Synthesize all dialogue turns using multi-speaker Gemini TTS"
          >
            {isSynthesizingScene ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Recording Scene...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 fill-slate-950" />
                <span>{scene.audioBase64 ? 'Re-synthesize Scene' : 'Voice Scene'}</span>
              </>
            )}
          </button>

          {/* Collapse/Expand button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1f2638] transition-colors"
            title={isExpanded ? 'Collapse Scene' : 'Expand Scene'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Scene Audio Player Take */}
      {scene.audioBase64 && (
        <div className="p-4 bg-[#0a0c13] border-b border-[#1c2234]">
          <AudioTimelinePlayer
            title={`Scene ${scene.sceneNumber} Master Take`}
            subtitle={scene.slug}
            audioBase64={scene.audioBase64}
            downloadFilename={`Scene_${String(scene.sceneNumber).padStart(3, '0')}.wav`}
          />
        </div>
      )}

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Non-Spoken Atmosphere / Stage Directions Box */}
          {scene.context && (
            <div className="p-3.5 rounded-xl bg-[#090b10] border border-[#1b2234] flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                <EyeOff className="w-3.5 h-3.5" />
                <span>Non-Spoken Historical Atmosphere & Stage Direction</span>
              </div>
              <p className="text-xs font-script text-slate-400 italic leading-relaxed">
                {scene.context}
              </p>
              <span className="text-[10px] text-slate-500">
                Stage directions and ambient notes are strictly preserved for historical direction and never read aloud.
              </span>
            </div>
          )}

          {/* Dialogue Turns List Header & Batch Controls */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 px-1 border-b border-[#1a2030] pb-2">
              <span className="font-semibold uppercase tracking-wider text-amber-200">
                Dialogue Sequence ({scene.dialogueTurns.length} turns)
              </span>

              {/* Batch scene helpers: Quick set IA or Announce, or Voice All */}
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="text-slate-500">Scene Name Mode:</span>
                <button
                  onClick={() => handleBatchToggleNameVocalization(false)}
                  className="px-2 py-0.5 rounded border border-[#2b354e] bg-[#121624] hover:bg-[#191f32] text-sky-300 text-[10px] transition-colors"
                  title="Make all characters speak directly without reading character names aloud"
                >
                  Set All Direct (IA)
                </button>
                <button
                  onClick={() => handleBatchToggleNameVocalization(true)}
                  className="px-2 py-0.5 rounded border border-[#2b354e] bg-[#121624] hover:bg-[#191f32] text-amber-300 text-[10px] transition-colors"
                  title="Make actors announce their character name before dialogue"
                >
                  Set All Announce
                </button>
              </div>
            </div>

            {scene.dialogueTurns.map((turn, tIdx) => (
              <DialogueTurnCard
                key={turn.id}
                turn={turn}
                index={tIdx}
                assignedCharacter={charVoiceMap[turn.speaker.trim().toLowerCase()]}
                isGeneratingLine={activeLineGeneratingId === turn.id}
                onUpdateTurn={handleUpdateTurn}
                onRegenerateLine={(t) => onRegenerateLine(t, scene.id)}
                onUpdateCharacterVoice={onUpdateCharacterVoice}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
