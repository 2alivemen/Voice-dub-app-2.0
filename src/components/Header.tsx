import React from 'react';
import { Film, Mic, Download, Play, Sliders, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Screenplay } from '../types/screenplay';

interface HeaderProps {
  screenplay: Screenplay;
  hasApiKey: boolean;
  isSynthesizingAny: boolean;
  completedScenesCount: number;
  totalScenesCount: number;
  onOpenScreenplayModal: () => void;
  onOpenCastingModal: () => void;
  onOpenExportModal: () => void;
  onSynthesizeAllScenes: () => void;
  onPlayMasterTrack: () => void;
  isMasterTrackReady: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  screenplay,
  hasApiKey,
  isSynthesizingAny,
  completedScenesCount,
  totalScenesCount,
  onOpenScreenplayModal,
  onOpenCastingModal,
  onOpenExportModal,
  onSynthesizeAllScenes,
  onPlayMasterTrack,
  isMasterTrackReady,
}) => {
  return (
    <header className="border-b border-[#222838] bg-[#0e111a]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Film Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d97706] to-[#b45309] p-0.5 flex items-center justify-center shadow-lg shadow-amber-950/40">
            <div className="w-full h-full bg-[#131622] rounded-[6px] flex items-center justify-center text-amber-400">
              <Film className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-cinzel text-lg lg:text-xl font-bold tracking-wide text-amber-100">
                Historical Film Voice Studio
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-900/60 bg-amber-950/40 text-amber-300">
                Gemini 3.8 TTS
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-300">{screenplay.title}</span>
              <span>•</span>
              <span className="text-slate-400 italic">{screenplay.periodOrEra}</span>
              <span>•</span>
              <span className="font-mono text-slate-400">
                {completedScenesCount} of {totalScenesCount} scenes voiced
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
          {/* API Key Health Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono ${
              hasApiKey
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-400'
                : 'border-rose-800/60 bg-rose-950/30 text-rose-400'
            }`}
            title={hasApiKey ? 'Server configured with official Gemini API' : 'GEMINI_API_KEY missing in Secrets'}
          >
            {hasApiKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span>{hasApiKey ? 'TTS Engine Live' : 'API Key Missing'}</span>
          </div>

          {/* Screenplay button */}
          <button
            onClick={onOpenScreenplayModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2a3248] bg-[#161a26] hover:bg-[#1e2436] text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Screenplay</span>
          </button>

          {/* Casting desk button */}
          <button
            onClick={onOpenCastingModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2a3248] bg-[#161a26] hover:bg-[#1e2436] text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Casting Desk</span>
          </button>

          {/* Master Soundtrack Playhead */}
          {isMasterTrackReady && (
            <button
              onClick={onPlayMasterTrack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-800/70 bg-amber-950/40 hover:bg-amber-900/50 text-xs font-medium text-amber-300 transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-amber-300" />
              <span>Play Master</span>
            </button>
          )}

          {/* Export Station button */}
          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-900/60 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-medium text-emerald-300 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & ZIP</span>
          </button>

          {/* Record / Synthesize All Scenes */}
          <button
            onClick={onSynthesizeAllScenes}
            disabled={isSynthesizingAny || !hasApiKey}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-xs font-semibold text-slate-950 transition-all shadow-md shadow-amber-900/20 active:scale-95"
          >
            {isSynthesizingAny ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mastering Audio...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 fill-slate-950" />
                <span>Voice Entire Film</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
