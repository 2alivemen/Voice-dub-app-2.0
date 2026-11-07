import React, { useState } from 'react';
import { X, Download, Package, FileSpreadsheet, FileJson, Disc3, CheckCircle2, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { Scene, Screenplay, AudioManifestItem } from '../types/screenplay';
import { downloadBlob, downloadProjectZip, base64ToArrayBuffer, stitchAudioBuffers, audioBufferToWavBlob, decodeAudioBase64 } from '../utils/audioUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenplay: Screenplay;
  scenes: Scene[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  screenplay,
  scenes,
}) => {
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [isStitchingMaster, setIsStitchingMaster] = useState<boolean>(false);
  const [silenceGap, setSilenceGap] = useState<number>(0.4); // 400ms pause between scenes

  if (!isOpen) return null;

  const completedScenes = scenes.filter((s) => s.audioBase64);

  // Generate manifest items
  const manifestItems: AudioManifestItem[] = [];
  for (const scene of scenes) {
    const padded = String(scene.sceneNumber).padStart(3, '0');
    scene.dialogueTurns.forEach((turn, tIdx) => {
      manifestItems.push({
        sceneNumber: scene.sceneNumber,
        sceneSlug: scene.slug,
        turnIndex: tIdx,
        speaker: turn.speaker,
        voiceName: 'Prebuilt Gemini Voice',
        emotion: turn.emotion || 'Natural Dramatic',
        dialogueText: turn.text,
        durationSeconds: turn.duration,
        audioFile: `Scene_${padded}.wav`,
      });
    });
  }

  // Handle single scene WAV download
  const handleDownloadScene = (scene: Scene) => {
    if (!scene.audioBase64) return;
    const arrayBuf = base64ToArrayBuffer(scene.audioBase64);
    const blob = new Blob([arrayBuf], { type: 'audio/wav' });
    const padded = String(scene.sceneNumber).padStart(3, '0');
    downloadBlob(blob, `Scene_${padded}.wav`);
  };

  // Build Master Soundtrack AudioBuffer
  const buildMasterBuffer = async (): Promise<AudioBuffer | undefined> => {
    if (completedScenes.length === 0) return undefined;
    const buffers: AudioBuffer[] = [];
    for (const scene of completedScenes) {
      if (scene.audioBase64) {
        const decoded = await decodeAudioBase64(scene.audioBase64);
        buffers.push(decoded);
      }
    }
    return stitchAudioBuffers(buffers, silenceGap);
  };

  // Download Master Soundtrack WAV
  const handleDownloadMasterTrack = async () => {
    try {
      setIsStitchingMaster(true);
      const masterBuf = await buildMasterBuffer();
      if (!masterBuf) return;
      const wavBlob = audioBufferToWavBlob(masterBuf);
      downloadBlob(wavBlob, `${screenplay.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Master_Soundtrack.wav`);
    } catch (err) {
      console.error('Error generating master soundtrack:', err);
    } finally {
      setIsStitchingMaster(false);
    }
  };

  // Download Full ZIP Archive
  const handleDownloadZipPackage = async () => {
    try {
      setIsZipping(true);
      const masterBuf = await buildMasterBuffer();
      await downloadProjectZip(screenplay, scenes, manifestItems, masterBuf);
    } catch (err) {
      console.error('Error creating project ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#10131d] border border-[#262f46] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22293d] bg-[#141824]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-slate-100">Film Audio Master & Export Station</h2>
              <p className="text-xs text-slate-400">
                Download individual scene WAVs, complete ZIP package, or master combined soundtrack.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#202638] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Top Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full ZIP Package Card */}
            <div className="p-4 rounded-xl bg-[#0d1019] border border-[#222a3e] flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  <Package className="w-4 h-4" />
                  <span>Production Master ZIP Archive</span>
                </div>
                <p className="text-xs text-slate-400">
                  Includes ordered scene audio files (<code className="text-slate-300">Scene_001.wav</code>), continuous master soundtrack, structured <code className="text-slate-300">manifest.json</code>, and production-ready <code className="text-slate-300">manifest.csv</code>.
                </p>
              </div>

              <button
                onClick={handleDownloadZipPackage}
                disabled={isZipping || completedScenes.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-950/30"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Packaging Master Archive...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Full ZIP Package</span>
                  </>
                )}
              </button>
            </div>

            {/* Master Soundtrack WAV Card */}
            <div className="p-4 rounded-xl bg-[#0d1019] border border-[#222a3e] flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
                  <Disc3 className="w-4 h-4" />
                  <span>Combined Master Soundtrack (.WAV)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Concatenates all completed scenes into one continuous, seamlessly mastered film audio file with room silence gaps.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-[11px] text-slate-400">Inter-scene pause:</label>
                  <select
                    value={silenceGap}
                    onChange={(e) => setSilenceGap(parseFloat(e.target.value))}
                    className="bg-[#141826] border border-[#2a344c] rounded px-2 py-0.5 text-xs text-slate-300 outline-none"
                  >
                    <option value={0.25}>0.25s (Tight cut)</option>
                    <option value={0.4}>0.4s (Standard film pacing)</option>
                    <option value={0.8}>0.8s (Dramatic breath)</option>
                    <option value={1.2}>1.2s (Long scene transition)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleDownloadMasterTrack}
                disabled={isStitchingMaster || completedScenes.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-amber-950/30"
              >
                {isStitchingMaster ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mastering Combined WAV...</span>
                  </>
                ) : (
                  <>
                    <Disc3 className="w-4 h-4" />
                    <span>Download Master Soundtrack WAV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Individual Scene Clips Table */}
          <div className="p-4 rounded-xl bg-[#0c0e17] border border-[#20273a] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1b2132]">
              <h3 className="font-cinzel text-xs font-bold text-amber-200 uppercase tracking-wider">
                Individual Scene Audio Files
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {completedScenes.length} of {scenes.length} voiced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1c2232] text-slate-400 font-mono text-[11px]">
                    <th className="py-2 px-3">File Name</th>
                    <th className="py-2 px-3">Scene Slug</th>
                    <th className="py-2 px-3">Dialogue Turns</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171c2a]">
                  {scenes.map((scene) => {
                    const isReady = scene.audioBase64 !== undefined;
                    const padded = String(scene.sceneNumber).padStart(3, '0');
                    const filename = `Scene_${padded}.wav`;

                    return (
                      <tr key={scene.id} className="hover:bg-[#121624] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-amber-300">
                          {filename}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 truncate max-w-[200px]" title={scene.slug}>
                          {scene.slug}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {scene.dialogueTurns.length} turns
                        </td>
                        <td className="py-2.5 px-3">
                          {isReady ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-500">
                              Not voiced yet
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDownloadScene(scene)}
                            disabled={!isReady}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#2b354e] bg-[#141826] hover:bg-[#1c2234] disabled:opacity-40 text-[11px] text-slate-200 transition-colors"
                          >
                            <Download className="w-3 h-3 text-amber-400" />
                            <span>Download</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Technical Specifications & Quota Transparency */}
          <div className="p-4 rounded-xl bg-[#090b10] border border-[#1d2334] text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Official Gemini TTS Production Specs & Limitations</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-300">Gemini 3.8 Flash TTS Engine:</strong> High-fidelity unary WAV generation directly returns 24kHz, 16-bit Mono linear PCM.
              </li>
              <li>
                <strong className="text-slate-300">Multi-Speaker Constraints:</strong> The official Gemini API supports up to 2 prebuilt voices per request. Scenes featuring 3 or more dramatis personae are cleanly partitioned into sequential conversational pairs, joined with acoustic room silence.
              </li>
              <li>
                <strong className="text-slate-300">Quota & Retry Policy:</strong> All synthesis calls utilize server-side token management with exponential backoff on HTTP 429 rate limits.
              </li>
              <li>
                <strong className="text-slate-300">Stage Direction Isolation:</strong> Context descriptions and bracketed cues are never vocalized; they instruct the model's emotional pacing and delivery style via verified <code className="text-amber-300 font-mono">speechMetadata.style</code> parameters.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#22293d] bg-[#141824] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#22293d] hover:bg-[#2c354e] text-xs font-semibold text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
