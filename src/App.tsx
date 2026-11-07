/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SceneCard } from './components/SceneCard';
import { ScreenplayEditorModal } from './components/ScreenplayEditorModal';
import { CharacterCastingDesk } from './components/CharacterCastingDesk';
import { ExportModal } from './components/ExportModal';
import { AudioTimelinePlayer } from './components/AudioTimelinePlayer';
import { HISTORICAL_TEMPLATES, parseScreenplayText } from './utils/screenplayParser';
import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene, Screenplay } from './types/screenplay';
import { synthesizeFullScene, synthesizeSingleTurn } from './services/ttsService';
import { stitchAudioBuffers, audioBufferToWavBlob, blobToBase64, decodeAudioBase64 } from './utils/audioUtils';
import { Film, Mic, Sparkles, Sliders, AlertCircle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, FileText, Check } from 'lucide-react';

export default function App() {
  // 1. Initial State loaded from the example script template ("The Ides of March")
  const defaultParse = React.useMemo(() => {
    return parseScreenplayText(HISTORICAL_TEMPLATES[0].screenplayText);
  }, []);

  const [screenplay, setScreenplay] = useState<Screenplay>(defaultParse.screenplay);
  const [characterVoices, setCharacterVoices] = useState<CharacterVoice[]>(defaultParse.detectedCharacters);

  // Quick Paste Script on the Main Page
  const [quickPasteText, setQuickPasteText] = useState<string>('');
  const [isQuickPasteOpen, setIsQuickPasteOpen] = useState<boolean>(true);

  // Backend Health & Capabilities
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [backendHealth, setBackendHealth] = useState<any>(null);

  // Modal Visibility
  const [isScreenplayModalOpen, setIsScreenplayModalOpen] = useState<boolean>(false);
  const [isCastingModalOpen, setIsCastingModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Synthesis Execution State
  const [isSynthesizingAll, setIsSynthesizingAll] = useState<boolean>(false);
  const [activeSceneGeneratingId, setActiveSceneGeneratingId] = useState<string | null>(null);
  const [activeLineGeneratingId, setActiveLineGeneratingId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Master Soundtrack
  const [masterAudioBase64, setMasterAudioBase64] = useState<string | null>(null);
  const [isPlayingMaster, setIsPlayingMaster] = useState<boolean>(false);

  // Fetch backend status on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        console.log('[Historical Voice Studio Backend]', data);
        setHasApiKey(Boolean(data.hasApiKey));
        setBackendHealth(data);
      })
      .catch((err) => {
        console.warn('Backend health check error:', err);
      });
  }, []);

  // Update a scene in local state
  const handleUpdateScene = (updatedScene: Scene) => {
    setScreenplay((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === updatedScene.id ? updatedScene : s)),
    }));
  };

  // Synthesize single scene
  const handleSynthesizeScene = async (sceneToSynth: Scene) => {
    if (!sceneToSynth.dialogueTurns || sceneToSynth.dialogueTurns.length === 0) {
      setGlobalError(`Scene ${sceneToSynth.sceneNumber} contains no spoken dialogue turns to voice.`);
      return;
    }

    try {
      setGlobalError(null);
      setActiveSceneGeneratingId(sceneToSynth.id);
      setProgressMessage(`Preparing Scene ${sceneToSynth.sceneNumber}...`);
      setProgressPercent(10);

      console.log(`[Synthesis] Starting synthesis for Scene ${sceneToSynth.sceneNumber}:`, sceneToSynth.slug);

      const result = await synthesizeFullScene(
        sceneToSynth,
        characterVoices,
        (msg, cur, tot) => {
          setProgressMessage(msg);
          setProgressPercent(Math.round(((cur + 1) / (tot + 1)) * 90));
        }
      );

      // Merge turn audios into the scene turns
      const updatedTurns = sceneToSynth.dialogueTurns.map((turn) => {
        const turnAudio = result.turnAudios[turn.id];
        if (turnAudio) {
          return {
            ...turn,
            audioBase64: turnAudio.audioBase64,
            duration: turnAudio.duration,
            status: 'ready' as const,
            error: undefined,
          };
        }
        return {
          ...turn,
          status: 'ready' as const,
          error: undefined,
        };
      });

      const updatedScene: Scene = {
        ...sceneToSynth,
        audioBase64: result.sceneAudioBase64,
        duration: result.sceneDuration,
        dialogueTurns: updatedTurns,
        status: 'ready',
        error: undefined,
      };

      handleUpdateScene(updatedScene);
      setProgressMessage(`Scene ${sceneToSynth.sceneNumber} voiced successfully!`);
      setProgressPercent(100);

      // Re-stitch master soundtrack in background
      recalculateMasterTrack([
        ...screenplay.scenes.filter((s) => s.id !== updatedScene.id),
        updatedScene,
      ]);
    } catch (err: any) {
      console.error('[Scene Synthesis Error]', err);
      const errMsg = err?.message || 'Scene synthesis failed. Please verify API key and network connection.';
      setGlobalError(errMsg);
      handleUpdateScene({
        ...sceneToSynth,
        status: 'error',
        error: errMsg,
      });
    } finally {
      setActiveSceneGeneratingId(null);
      setTimeout(() => {
        setProgressMessage('');
        setProgressPercent(0);
      }, 3000);
    }
  };

  // Regenerate an individual dialogue turn without re-recording the full scene
  const handleRegenerateLine = async (turn: DialogueTurn, sceneId: string) => {
    try {
      setGlobalError(null);
      setActiveLineGeneratingId(turn.id);

      console.log(`[Line Retake] Re-recording turn ${turn.id} (${turn.speaker}): "${turn.text}"`);

      const result = await synthesizeSingleTurn(turn, characterVoices);

      const targetScene = screenplay.scenes.find((s) => s.id === sceneId);
      if (!targetScene) return;

      const updatedTurns = targetScene.dialogueTurns.map((t) =>
        t.id === turn.id
          ? {
              ...t,
              audioBase64: result.audioBase64,
              duration: result.duration,
              status: 'ready' as const,
              error: undefined,
            }
          : t
      );

      // If all turns have individual audio takes, re-stitch scene take!
      const allTurnsHaveAudio = updatedTurns.every((t) => t.audioBase64);
      let updatedSceneAudio = targetScene.audioBase64;
      let updatedDuration = targetScene.duration;

      if (allTurnsHaveAudio) {
        const turnBuffers: AudioBuffer[] = [];
        for (const t of updatedTurns) {
          if (t.audioBase64) {
            const buf = await decodeAudioBase64(t.audioBase64);
            turnBuffers.push(buf);
          }
        }
        const stitched = stitchAudioBuffers(turnBuffers, 0.25);
        const wavBlob = audioBufferToWavBlob(stitched);
        updatedSceneAudio = await blobToBase64(wavBlob);
        updatedDuration = stitched.duration;
      }

      const updatedScene: Scene = {
        ...targetScene,
        audioBase64: updatedSceneAudio,
        duration: updatedDuration,
        dialogueTurns: updatedTurns,
      };

      handleUpdateScene(updatedScene);

      // Re-stitch master soundtrack so it reflects the retake
      recalculateMasterTrack([
        ...screenplay.scenes.filter((s) => s.id !== updatedScene.id),
        updatedScene,
      ]);

      setProgressMessage(`Take recorded for ${turn.speaker}!`);
      setTimeout(() => setProgressMessage(''), 2500);
    } catch (err: any) {
      console.error('[Line Retake Error]', err);
      setGlobalError(err.message || 'Line re-record failed.');
    } finally {
      setActiveLineGeneratingId(null);
    }
  };

  // Synthesize all scenes sequentially
  const handleSynthesizeAllScenes = async (scenesToRun?: Scene[], customVoices?: CharacterVoice[]) => {
    const rawScenes = scenesToRun || screenplay.scenes;
    const targetScenes = rawScenes.filter((s) => s.dialogueTurns && s.dialogueTurns.length > 0);
    const voices = customVoices || characterVoices;

    if (targetScenes.length === 0) {
      setGlobalError('No spoken dialogue turns to voice. Please paste or enter screenplay text with dialogue.');
      return;
    }

    try {
      setGlobalError(null);
      setIsSynthesizingAll(true);
      const totalScenes = targetScenes.length;

      for (let i = 0; i < totalScenes; i++) {
        const currentScene = targetScenes[i];
        setProgressMessage(`Recording Scene ${i + 1} of ${totalScenes}: ${currentScene.slug}...`);
        setProgressPercent(Math.round(((i) / totalScenes) * 100));

        const result = await synthesizeFullScene(
          currentScene,
          voices,
          (msg) => {
            setProgressMessage(`[Scene ${i + 1}/${totalScenes}] ${msg}`);
          }
        );

        const updatedTurns = currentScene.dialogueTurns.map((turn) => {
          const turnAudio = result.turnAudios[turn.id];
          return {
            ...turn,
            audioBase64: turnAudio?.audioBase64 || turn.audioBase64,
            duration: turnAudio?.duration || turn.duration,
            status: 'ready' as const,
          };
        });

        const updatedScene: Scene = {
          ...currentScene,
          audioBase64: result.sceneAudioBase64,
          duration: result.sceneDuration,
          dialogueTurns: updatedTurns,
          status: 'ready',
        };

        handleUpdateScene(updatedScene);
      }

      setProgressMessage('Film vocal mastering complete! Stitched master soundtrack.');
      setProgressPercent(100);

      // Re-stitch master soundtrack
      recalculateMasterTrack(targetScenes);
    } catch (err: any) {
      console.error('[Synthesize All Error]', err);
      setGlobalError(err.message || 'Batch synthesis encountered an error. Please verify quota or network connection.');
    } finally {
      setIsSynthesizingAll(false);
      setTimeout(() => {
        setProgressMessage('');
        setProgressPercent(0);
      }, 3000);
    }
  };

  // Handle Quick Paste & Instant Generate on Main Page
  const handleQuickPasteAndGenerate = async () => {
    const raw = quickPasteText.trim();
    if (!raw) {
      setGlobalError('Please enter or paste screenplay dialogue text in the box below.');
      return;
    }

    try {
      setGlobalError(null);
      setProgressMessage('Parsing screenplay and assigning voice personas...');
      setProgressPercent(5);

      const parsed = parseScreenplayText(raw);
      if (parsed.screenplay.scenes.length === 0) {
        setGlobalError('Could not find any dialogue or scenes in the pasted text.');
        return;
      }

      // Update state
      setScreenplay(parsed.screenplay);
      setCharacterVoices(parsed.detectedCharacters);
      setMasterAudioBase64(null);

      // Immediately launch voice generation!
      await handleSynthesizeAllScenes(parsed.screenplay.scenes, parsed.detectedCharacters);
    } catch (err: any) {
      console.error('[Quick Paste Error]', err);
      setGlobalError(err.message || 'Failed to process pasted screenplay text.');
    }
  };

  // Recalculate Master Soundtrack AudioBuffer and Base64
  const recalculateMasterTrack = async (scenesList: Scene[]) => {
    try {
      const voicedScenes = scenesList.filter((s) => s.audioBase64);
      if (voicedScenes.length === 0) {
        setMasterAudioBase64(null);
        return;
      }

      const sceneBuffers: AudioBuffer[] = [];
      for (const scene of voicedScenes) {
        if (scene.audioBase64) {
          const buf = await decodeAudioBase64(scene.audioBase64);
          sceneBuffers.push(buf);
        }
      }

      const stitched = stitchAudioBuffers(sceneBuffers, 0.4);
      const wavBlob = audioBufferToWavBlob(stitched);
      const base64 = await blobToBase64(wavBlob);
      setMasterAudioBase64(base64);
    } catch (e) {
      console.warn('Master track calculation error:', e);
    }
  };

  // Apply new screenplay from editor modal
  const handleApplyScreenplay = (newScreenplay: Screenplay, characters: CharacterVoice[], autoVoice = false) => {
    setScreenplay(newScreenplay);
    setCharacterVoices(characters);
    setMasterAudioBase64(null);

    if (autoVoice) {
      handleSynthesizeAllScenes(newScreenplay.scenes, characters);
    }
  };

  // Update a single character's voice/personality
  const handleUpdateCharacter = (updated: CharacterVoice) => {
    setCharacterVoices((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  // Direct In-Line character voice assignment
  const handleUpdateCharacterVoice = (speaker: string, newVoice: GeminiPrebuiltVoice) => {
    setCharacterVoices((prev) => {
      const exists = prev.some((c) => c.name.trim().toLowerCase() === speaker.trim().toLowerCase());
      if (exists) {
        return prev.map((c) =>
          c.name.trim().toLowerCase() === speaker.trim().toLowerCase()
            ? { ...c, voiceName: newVoice, assignmentSource: 'Manual In-Line Selection' }
            : c
        );
      } else {
        return [
          ...prev,
          {
            id: `char-${Date.now()}`,
            name: speaker.toUpperCase(),
            voiceName: newVoice,
            basePersonality: 'Historical dramatic performance',
            assignmentSource: 'Manual In-Line Selection',
            color: '#f59e0b',
          },
        ];
      }
    });
  };

  // Add custom character
  const handleAddCharacter = (newChar: CharacterVoice) => {
    setCharacterVoices((prev) => [...prev, newChar]);
  };

  const completedScenesCount = screenplay.scenes.filter((s) => s.audioBase64).length;
  const isMasterTrackReady = masterAudioBase64 !== null;

  // Live breakdown of quick paste text
  const quickParsedStats = React.useMemo(() => {
    if (!quickPasteText.trim()) return null;
    try {
      const p = parseScreenplayText(quickPasteText);
      const turnsCount = p.screenplay.scenes.reduce((acc, s) => acc + s.dialogueTurns.length, 0);
      return {
        scenesCount: p.screenplay.scenes.length,
        turnsCount,
        characters: p.detectedCharacters,
      };
    } catch {
      return null;
    }
  }, [quickPasteText]);

  return (
    <div className="min-h-screen bg-[#090b11] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      {/* Top Header */}
      <Header
        screenplay={screenplay}
        hasApiKey={hasApiKey}
        isSynthesizingAny={isSynthesizingAll || activeSceneGeneratingId !== null}
        completedScenesCount={completedScenesCount}
        totalScenesCount={screenplay.scenes.length}
        onOpenScreenplayModal={() => setIsScreenplayModalOpen(true)}
        onOpenCastingModal={() => setIsCastingModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onSynthesizeAllScenes={() => handleSynthesizeAllScenes()}
        onPlayMasterTrack={() => setIsPlayingMaster(true)}
        isMasterTrackReady={isMasterTrackReady}
      />

      {/* Real-time Progress Bar */}
      {(isSynthesizingAll || activeSceneGeneratingId !== null || progressMessage) && (
        <div className="sticky top-[61px] z-30 bg-[#121624] border-b border-amber-800/80 px-4 py-3 shadow-xl">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-amber-200 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span className="tracking-wide">{progressMessage || 'Synthesizing historical voice audio with Gemini TTS...'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-amber-400">{progressPercent}%</span>
              <div className="w-44 h-2.5 bg-[#1b2132] rounded-full overflow-hidden border border-[#273046]">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prominent Global Error Banner */}
      {globalError && (
        <div className="bg-rose-950/90 border-b border-rose-800 text-xs text-rose-200 px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <strong className="block font-semibold text-rose-100">Audio Synthesis Notification</strong>
                <span>{globalError}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setGlobalError(null);
                  handleSynthesizeAllScenes();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold text-xs transition-colors"
              >
                Retry Request
              </button>
              <button
                onClick={() => setGlobalError(null)}
                className="px-3 py-1.5 rounded-lg border border-rose-800/80 bg-rose-900/40 hover:bg-rose-900 text-rose-300 text-xs transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Soundtrack Player */}
      {masterAudioBase64 && (
        <section className="border-b border-[#22283a] bg-[#0c0f18] px-4 lg:px-8 py-3 shadow-inner">
          <div className="max-w-7xl mx-auto">
            <AudioTimelinePlayer
              title={`Master Film Soundtrack — "${screenplay.title}"`}
              subtitle={`Complete film audio with natural inter-scene room transitions (${completedScenesCount} scenes voiced)`}
              audioBase64={masterAudioBase64}
              downloadFilename={`${screenplay.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Master_Soundtrack.wav`}
            />
          </div>
        </section>
      )}

      {/* Main Soundstage Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Direct Screenplay Quick Paste / Intake Station */}
        <section className="p-5 rounded-xl bg-[#0f121d] border border-[#232b40] shadow-md flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1b2234]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-cinzel text-sm font-bold text-amber-200 uppercase tracking-wider">
                  Direct Screenplay Intake & Instant Voice Generator
                </h2>
                <p className="text-xs text-slate-400">
                  Paste any dialogue, script, or historical narration text below. Click <strong>Generate Voices for Script</strong> to produce audio instantly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScreenplayModalOpen(true)}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-medium"
              >
                Open Full Screenplay Studio
              </button>
              <button
                onClick={() => setIsQuickPasteOpen(!isQuickPasteOpen)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                {isQuickPasteOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isQuickPasteOpen && (
            <div className="space-y-3 pt-1">
              {/* Preset Shortcuts */}
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="text-slate-400 font-medium">Quick Presets:</span>
                {HISTORICAL_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setQuickPasteText(tmpl.screenplayText)}
                    className="px-2.5 py-1 rounded border border-[#263148] bg-[#141824] hover:bg-[#1a2132] text-slate-300 text-xs transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
                <button
                  onClick={() => setQuickPasteText('')}
                  className="px-2.5 py-1 rounded border border-[#263148] bg-[#10131d] hover:bg-[#151926] text-slate-500 hover:text-slate-300 text-xs transition-colors"
                >
                  Clear Box
                </button>
              </div>

              {/* In-Script Formatting Guide Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#0a0c13] border border-[#1d2334] text-[11px]">
                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0">1.</span>
                  <div>
                    <strong className="text-amber-200">Character Name Vocalization:</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      <code className="text-amber-300">VIKRAMADITYA:</code> announces name aloud.
                      <br />
                      <code className="text-sky-300">VIKRAMADITYA(IA):</code> speaks direct dialogue (IA = Inactive Announcement).
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0">2.</span>
                  <div>
                    <strong className="text-amber-200">In-Script Voice & Gender:</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Write <code className="text-amber-300">Voice: Kore</code>, <code className="text-amber-300">Voice: Aoede</code>, <code className="text-amber-300">Voice: Orus</code>, <code className="text-amber-300">Voice: Fenrir</code>, or in <code className="text-amber-300">Style: Aoede, melodic cadence...</code> (Supports all 8 Gemini studio voices)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-amber-400 font-bold shrink-0">3.</span>
                  <div>
                    <strong className="text-amber-200">Individual Line Takes:</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Each dialogue turn card has its own dedicated <strong>Play Take</strong> and <strong>Download WAV</strong> button to fine-tune individual lines.
                    </div>
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={quickPasteText}
                onChange={(e) => setQuickPasteText(e.target.value)}
                rows={5}
                className="w-full p-3.5 rounded-lg bg-[#080a0f] border border-[#20283c] focus:border-amber-500/80 text-xs font-script leading-relaxed text-slate-200 placeholder-slate-600 outline-none resize-y shadow-inner"
                placeholder={`Paste your script here, for example:

SCENE 04 — THE ROYAL COURT

CONTEXT:
Kalyana, circa 1117 CE. The emperor has received reports of Hoysala expansion. The atmosphere is tense.

VOICE 1 — NARRATOR:
Voice: Fenrir
Style: Deep, measured, ominous.
"The news from the southern territories had reached the imperial court."

VOICE 2 — VIKRAMADITYA(IA):
Voice: Charon
Style: Controlled anger. Commanding, deliberate delivery.
"How long shall we permit this challenge to our authority?"`}
              />

              {/* Live parser summary and generate button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {quickParsedStats && quickParsedStats.turnsCount > 0 ? (
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded font-mono text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready: {quickParsedStats.scenesCount} scene(s), {quickParsedStats.turnsCount} turn(s), cast: {quickParsedStats.characters.map((c) => c.name).join(', ')}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px]">
                      Paste dialogue in "Speaker: Line" format or narrative text.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!quickPasteText.trim()) return;
                      const parsed = parseScreenplayText(quickPasteText);
                      setScreenplay(parsed.screenplay);
                      setCharacterVoices(parsed.detectedCharacters);
                    }}
                    disabled={!quickPasteText.trim()}
                    className="px-3 py-1.5 rounded-lg border border-[#2a344c] bg-[#141824] hover:bg-[#1a2030] disabled:opacity-40 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Load into Scene Cards Only
                  </button>

                  <button
                    onClick={handleQuickPasteAndGenerate}
                    disabled={!quickPasteText.trim() || isSynthesizingAll}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-950/40 active:scale-95"
                  >
                    {isSynthesizingAll ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Synthesizing Voice...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 fill-slate-950" />
                        <span>Generate Voices for Script</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Studio Control Ribbon / Casting Summary */}
        <section className="p-4 rounded-xl bg-[#0f121c] border border-[#20273a] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#151928] border border-[#2b354e] flex items-center justify-center text-amber-400 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-cinzel text-xs font-bold uppercase tracking-wider text-amber-200">
                  Cast & Voice Identity Desk
                </h2>
                <span className="text-[10px] text-slate-500 font-mono">
                  {characterVoices.length} Dramatis Personae
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {characterVoices.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => setIsCastingModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#263048] bg-[#141824] hover:bg-[#1c2234] text-xs text-slate-300 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: char.color }}
                    />
                    <span className="font-medium">{char.name}</span>
                    <span className="text-[10px] text-amber-400/90 font-mono">
                      ({char.voiceName})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            {/* Master Character Name Vocalization Toggle */}
            <button
              onClick={() => {
                const anyVocalized = screenplay.scenes.some((s) =>
                  s.dialogueTurns.some((t) => t.vocalizeSpeakerName)
                );
                const nextState = !anyVocalized;
                setScreenplay((prev) => ({
                  ...prev,
                  scenes: prev.scenes.map((s) => ({
                    ...s,
                    dialogueTurns: s.dialogueTurns.map((t) => ({
                      ...t,
                      vocalizeSpeakerName: nextState,
                    })),
                  })),
                }));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a344c] bg-[#141824] hover:bg-[#1a2030] text-xs text-slate-300 transition-colors"
              title="Toggle whether voices announce the character's name aloud before dialogue across all lines"
            >
              {screenplay.scenes.some((s) => s.dialogueTurns.some((t) => t.vocalizeSpeakerName)) ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Names Announced: <strong>ON</strong></span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Names Announced: <strong>OFF (Direct Dialogue)</strong></span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsCastingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#28324a] bg-[#141824] hover:bg-[#1c2234] text-xs font-semibold text-slate-200 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Tune Voice Personas</span>
            </button>
          </div>
        </section>

        {/* Scene Production List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-[#1c2234]">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" />
              <h2 className="font-cinzel text-sm font-bold uppercase tracking-wider text-slate-200">
                Screenplay Scenes & Dialogue Turns
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-mono">
                {screenplay.scenes.length} Scenes /{' '}
                {screenplay.scenes.reduce((acc, s) => acc + s.dialogueTurns.length, 0)} Turns
              </span>
            </div>
          </div>

          {screenplay.scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              characterVoices={characterVoices}
              isSynthesizingScene={activeSceneGeneratingId === scene.id}
              activeLineGeneratingId={activeLineGeneratingId}
              onSynthesizeScene={handleSynthesizeScene}
              onUpdateScene={handleUpdateScene}
              onRegenerateLine={handleRegenerateLine}
              onUpdateCharacterVoice={handleUpdateCharacterVoice}
            />
          ))}
        </div>
      </main>

      {/* Screenplay Editor Modal */}
      <ScreenplayEditorModal
        isOpen={isScreenplayModalOpen}
        onClose={() => setIsScreenplayModalOpen(false)}
        currentScreenplay={screenplay}
        onApplyScreenplay={handleApplyScreenplay}
      />

      {/* Character Casting Desk Modal */}
      <CharacterCastingDesk
        isOpen={isCastingModalOpen}
        onClose={() => setIsCastingModalOpen(false)}
        characters={characterVoices}
        onUpdateCharacter={handleUpdateCharacter}
        onAddCharacter={handleAddCharacter}
      />

      {/* Export Station Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplay={screenplay}
        scenes={screenplay.scenes}
      />
    </div>
  );
}
