import React, { useState } from 'react';
import { X, Upload, FileText, Check, Sparkles, BookOpen, AlertCircle, Mic, Play } from 'lucide-react';
import { HISTORICAL_TEMPLATES, parseScreenplayText } from '../utils/screenplayParser';
import { CharacterVoice, Screenplay } from '../types/screenplay';

interface ScreenplayEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreenplay: Screenplay;
  onApplyScreenplay: (newScreenplay: Screenplay, characters: CharacterVoice[], autoVoice?: boolean) => void;
}

export const ScreenplayEditorModal: React.FC<ScreenplayEditorModalProps> = ({
  isOpen,
  onClose,
  currentScreenplay,
  onApplyScreenplay,
}) => {
  const initialText = React.useMemo(() => {
    let raw = `TITLE: ${currentScreenplay.title}\nERA: ${currentScreenplay.periodOrEra}\n\n`;
    for (const scene of currentScreenplay.scenes) {
      raw += `${scene.slug}\n`;
      if (scene.context) {
        raw += `${scene.context}\n\n`;
      }
      for (const turn of scene.dialogueTurns) {
        raw += `${turn.speaker}${turn.emotion ? ` (${turn.emotion})` : ''}\n${turn.text}\n\n`;
      }
      raw += '\n';
    }
    return raw.trim();
  }, [currentScreenplay]);

  const [text, setText] = useState<string>(initialText);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Live parsed stats
  const parsedPreview = React.useMemo(() => {
    try {
      return parseScreenplayText(text);
    } catch {
      return null;
    }
  }, [text]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setText(content);
        setSelectedTemplateId('');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = HISTORICAL_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setText(tmpl.screenplayText);
    }
  };

  const handleApply = (autoVoice = false) => {
    if (!parsedPreview || parsedPreview.screenplay.scenes.length === 0) return;
    onApplyScreenplay(parsedPreview.screenplay, parsedPreview.detectedCharacters, autoVoice);
    onClose();
  };

  const totalTurns = parsedPreview
    ? parsedPreview.screenplay.scenes.reduce((acc, s) => acc + s.dialogueTurns.length, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#10131d] border border-[#262d42] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22293d] bg-[#141824]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-cinzel text-base font-bold text-amber-100">Screenplay Intake & Editor</h2>
              <p className="text-xs text-slate-400">
                Paste any dialogue, historical narrative, or script format. Automatic parsing converts speakers, emotions, and narration.
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

        {/* Templates Bar */}
        <div className="px-6 py-3 border-b border-[#1e2436] bg-[#0c0f17] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">Historical Screenplay Presets:</span>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {HISTORICAL_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl.id)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  selectedTemplateId === tmpl.id
                    ? 'border-amber-600 bg-amber-950/50 text-amber-300 font-medium'
                    : 'border-[#262e44] bg-[#141824] hover:bg-[#1a2030] text-slate-300'
                }`}
                title={tmpl.description}
              >
                {tmpl.name}
              </button>
            ))}

            {/* File Upload Input */}
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[#262e44] bg-[#141824] hover:bg-[#1a2030] text-slate-300 transition-colors">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload .txt / .md</span>
              <input
                type="file"
                accept=".txt,.md,.fountain"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Screenplay Text Area */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>Paste or Edit Screenplay Text</span>
                {totalTurns > 0 && (
                  <span className="font-mono text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                    ✓ {totalTurns} Spoken Turns Ready
                  </span>
                )}
              </label>
              <span className="font-mono text-[11px] text-slate-500">
                {text.split('\n').length} lines
              </span>
            </div>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSelectedTemplateId('');
              }}
              rows={16}
              className="w-full flex-1 p-4 rounded-lg bg-[#0a0c12] border border-[#22293d] focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 text-xs font-script leading-relaxed text-slate-200 placeholder-slate-600 outline-none resize-none shadow-inner"
              placeholder={`Paste any historical screenplay or narrative text:\n\nSCENE 1: INT. ROMAN SENATE - NIGHT\nCandles flicker in the great rotunda.\n\nCAESAR (with solemn authority):\nAre we all ready?\n\nBRUTUS (whispering):\nMost high, most mighty Caesar.`}
            />

            {/* Comprehensive Parsing & Screenplay Guide */}
            <div className="p-3.5 rounded-lg bg-[#131724] border border-[#20273a] flex flex-col gap-2 text-[11px] text-slate-400 leading-normal">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
                <BookOpen className="w-4 h-4" />
                <span>Screenplay Direction, Voice &amp; Syntax Guide:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <div className="flex flex-col gap-1">
                  <p>
                    • <strong>Name Vocalization:</strong> Write <code className="text-amber-200 font-mono">KING: "..."</code> to announce name aloud. Write <code className="text-sky-300 font-mono">KING (IA): "..."</code> or <code className="text-sky-300 font-mono">VOICE 1 — KING (IA):</code> for <strong>Inactive Announcement</strong>—the voice switches directly without speaking the character name! (Narrator is direct by default).
                  </p>
                  <p>
                    • <strong>Style &amp; Delivery Syntax:</strong> Both separate lines (<code className="text-amber-200 font-mono">Style: Calm authority</code>) and inline (<code className="text-amber-200 font-mono">KING Style: Calm authority</code> or <code className="text-amber-200 font-mono">KING (IA, Style: Bold):</code>) are fully supported.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p>
                    • <strong>Quotes Optional:</strong> Dialogues work identically whether enclosed in quotation marks <code className="text-amber-200 font-mono">"..."</code> or written unquoted. Stray quotes are cleaned automatically.
                  </p>
                  <p>
                    • <strong>Natural Pauses &amp; Beats:</strong> Use an ellipsis <code className="text-amber-200 font-mono">... </code> or tags like <code className="text-amber-200 font-mono">[pause: 50ms]</code>, <code className="text-amber-200 font-mono">(pause 50ms)</code>, or <code className="text-amber-200 font-mono">(beat)</code>. The engine translates them into natural acoustic breath pauses without speaking the word "pause" aloud!
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 pt-1 border-t border-[#1e2536]">
                • <strong>8 Prebuilt Studio Voices:</strong> <code className="text-amber-300 font-mono">Fenrir</code> (Deep Baritone/Emperor), <code className="text-amber-300 font-mono">Charon</code> (Grave Bass/Elder), <code className="text-amber-300 font-mono">Kore</code> (Female Mezzo-Soprano/Queen), <code className="text-amber-300 font-mono">Aoede</code> (Melodic Female/Princess), <code className="text-amber-300 font-mono">Orus</code> (Bold Military Urgency/General), <code className="text-amber-300 font-mono">Puck</code> (Agile Tenor/Youth), <code className="text-amber-300 font-mono">Zephyr</code> (Warm Audiobook Narration/Sage), <code className="text-amber-300 font-mono">Leda</code> (Gentle Female/Confidante).
              </p>
            </div>
          </div>

          {/* Parser Live Breakdown */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="p-4 rounded-lg bg-[#0e111a] border border-[#22283a] flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Live Parser Output</span>
              </h3>

              {parsedPreview && parsedPreview.screenplay.scenes.length > 0 ? (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1b2132]">
                    <span className="text-slate-400">Title:</span>
                    <span className="font-semibold text-slate-200 text-right truncate max-w-[140px]">
                      {parsedPreview.screenplay.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#1b2132]">
                    <span className="text-slate-400">Detected Scenes:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {parsedPreview.screenplay.scenes.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#1b2132]">
                    <span className="text-slate-400">Dialogue Turns:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {totalTurns}
                    </span>
                  </div>

                  {/* Character Cast Detected */}
                  <div className="pt-1">
                    <span className="text-slate-400 block mb-2 font-medium">
                      Characters ({parsedPreview.detectedCharacters.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {parsedPreview.detectedCharacters.map((char) => (
                        <div
                          key={char.id}
                          className="px-2 py-1 rounded border border-[#28324a] bg-[#141826] text-[11px] flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: char.color }}
                          />
                          <span className="font-medium text-slate-200">{char.name}</span>
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            [{char.voiceName}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-300/80">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Paste text to detect scenes and characters.</span>
                </div>
              )}
            </div>

            {/* One-Click Action Card */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span>Ready to Produce?</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Click <strong>Apply & Voice Now</strong> to import the screenplay and immediately begin synthesizing speech takes with Gemini TTS.
              </p>
              <button
                onClick={() => handleApply(true)}
                disabled={!parsedPreview || totalTurns === 0}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-950/40 active:scale-95"
              >
                <Mic className="w-3.5 h-3.5 fill-slate-950" />
                <span>Apply & Voice All Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#22293d] bg-[#141824] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#1f2538] transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApply(false)}
              disabled={!parsedPreview || totalTurns === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#2b354e] bg-[#161a26] hover:bg-[#1e2436] text-xs font-medium text-slate-300 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Workspace Only</span>
            </button>
            <button
              onClick={() => handleApply(true)}
              disabled={!parsedPreview || totalTurns === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-slate-950 transition-colors shadow-md shadow-amber-950/30"
            >
              <Mic className="w-4 h-4 fill-slate-950" />
              <span>Apply & Voice Immediately</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
