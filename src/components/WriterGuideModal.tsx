import React, { useState } from 'react';
import { X, BookOpen, Check, Copy, CheckCircle2, AlertTriangle, Sparkles, Volume2 } from 'lucide-react';

interface WriterGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WriterGuideModal: React.FC<WriterGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const kannadaSnippet = `SCENE 01 — ಸಹಕಾರಿ ಸಂಘ: ಜೇನುತುಪ್ಪದ ಖರೀದಿ

INT. ಸಹಕಾರಿ ಸಂಘದ ದೊಡ್ಡ ಹಾಲ್ — ಹಗಲು

CONTEXT: A customer visits a Malnad cooperative society to purchase honey.

ATMOSPHERE: Quiet rural cooperative society ambience. Subtle indoor room tone.

---

VOICE 2 — LAKSHMAN (IA):
Voice: Orus
Style: Middle-aged rural Karnataka male voice, medium-low pitch, grounded and conversational. Natural Malnad Kannada pronunciation.

"ಕರ್ವಾಲೋ ಮಂದಣ್ಣಾಂತ, ಬೀಮನ್ ಕೆಲಸ ಕಲೀತಾ ಇದಾರೆ. ನನ್ನೆಸರು ಲಕ್ಷ್ಮಣಾಂತ. ಹೊಸದಾಗಿ ಕೆಲಸಕ್ಕೆ ಸೇರಿಕೊಂಡಿದೀನಿ."

VOICE 1 — POORNACHANDRA TEJASWI (IA):
Voice: Zephyr
Style: Warm, measured Kannada literary narration. Mature male voice, thoughtful and articulate.

"ನಾನು ಸಂಘದ ಹಳೆಯ ಜೇನುತುಪ್ಪ ಇಟ್ಟಿದ್ದ ಕೊಠಡಿಯ ಒಳಗೆ ನಡೆದೆ... ಮಂದಣ್ಣ ಒಂದು ತುದಿಯಲ್ಲಿ ಮರದ ಪೆಟ್ಟಿಗೆಯೊಂದನ್ನು ಸರಿಪಡಿಸುತ್ತಿದ್ದ."

MANDANNA (IA):
Style: Elderly villager, rustic tone.
ಬನ್ನಿ ಸಾಹೇಬ್ರೇ, ಜೇನುತುಪ್ಪ ಬೇಕಿತ್ತಾ? ಇಲ್ಲೇ ಇದೆ ನೋಡಿ.`;

  const englishSnippet = `SCENE 01 — THE ROYAL COUNCIL CHAMBER

INT. WESTERN CHALUKYA PALACE, KALYANA — NIGHT

CONTEXT: Emperor Vikramaditya convenes a war council before the monsoon.

ATMOSPHERE: Ominous stone hall with flickering torchlight.

---

VOICE 1 — NARRATOR:
Voice: Fenrir
Style: Deep, measured, ominous cinematic documentary narrator.
"The courier had ridden for three days without sleep."

VOICE 2 — VIKRAMADITYA (IA):
Voice: Charon
Style: Controlled imperial authority, grave and decisive.
"How long shall we permit this challenge to our banners?"

GENERAL SOMESHVARA Style: Orus, bold military urgency with stern authority
"Every watchtower along the river has sent word. The feudatories stand ready."`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0d1019] border border-[#232b40] shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1d2436] bg-[#111522]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-cinzel text-base sm:text-lg font-bold text-amber-100 flex items-center gap-2">
                <span>Screenplay Writer's Complete Handbook</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300">
                  Syntax &amp; Best Practices
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Guaranteed rules to ensure flawless scene sequencing, character voices, and audio takes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1a2030] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#141824] border border-[#222a3d] flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 1. Character Name Vocalization
              </span>
              <p className="text-slate-300">
                Always append <code className="text-sky-300 font-mono font-bold">(IA)</code> to character names (e.g. <code className="text-sky-300 font-mono">LAKSHMAN (IA):</code>) so the voice actor speaks dialogue directly without yelling the character's name aloud!
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141824] border border-[#222a3d] flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" /> 2. Natural Pauses &amp; Beats
              </span>
              <p className="text-slate-300">
                Write <code className="text-amber-300 font-mono">... </code> or <code className="text-amber-300 font-mono">[pause: 50ms]</code> / <code className="text-amber-300 font-mono">(beat)</code>. The engine maps all of them to natural breath pauses without vocalizing "pause".
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141824] border border-[#222a3d] flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> 3. Quotes Are Optional
              </span>
              <p className="text-slate-300">
                Both quoted dialogue <code className="text-amber-300 font-mono">"ಹಲೋ"</code> and unquoted dialogue <code className="text-amber-300 font-mono">ಹಲೋ</code> work identically. Redundant or stray quotes are sanitized automatically.
              </p>
            </div>
          </div>

          {/* DOs and DONTs Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
              <span>Writer's DOs and DON'Ts</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DOs */}
              <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-900/40 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>DO (Follow These)</span>
                </div>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Use (IA) for Dialogue:</strong> Write <code className="text-sky-300 font-mono">CHARACTER (IA):</code> or <code className="text-sky-300 font-mono">VOICE 1 — NAME (IA):</code>. IA stands for <em>Inactive Announcement</em>—the model switches voice smoothly and speaks dialogue directly.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Narrator Default:</strong> For <code className="text-amber-300 font-mono">NARRATOR:</code>, you do not need (IA)—the studio defaults Narrator to direct speech.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Style &amp; Delivery:</strong> Describe emotions vividly: <code className="text-amber-300 font-mono">Style: Warm, measured Kannada literary narration.</code> or <code className="text-amber-300 font-mono">Style: Controlled imperial anger.</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Inline Style is Allowed:</strong> You can write <code className="text-amber-300 font-mono">KING Style: Bold military urgency</code> or <code className="text-amber-300 font-mono">KING (IA, Style: Bold):</code> on one line.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Use Natural Ellipses for Breaths:</strong> To add a pause or hesitation, write <code className="text-amber-300 font-mono">... </code> inside the sentence.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Explicit Voice Casting:</strong> Pick from any of the 8 Gemini studio voices: <code className="text-amber-300 font-mono">Voice: Orus</code>, <code className="text-amber-300 font-mono">Voice: Zephyr</code>, <code className="text-amber-300 font-mono">Voice: Kore</code>, <code className="text-amber-300 font-mono">Voice: Fenrir</code>, etc.</span>
                  </li>
                </ul>
              </div>

              {/* DONTs */}
              <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-900/40 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>DON'T (Avoid These)</span>
                </div>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Don't Forget (IA) Unless You Want Names Read:</strong> If you write <code className="text-rose-300 font-mono">LAKSHMAN: "ಹಲೋ"</code> without <code className="text-sky-300 font-mono">(IA)</code>, the voice actor will literally say: <em>"Lakshman: ಹಲೋ"</em>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Don't Worry About Pause Numbers:</strong> If your script has <code className="text-amber-300 font-mono">[pause: 50ms]</code>, the app converts it to a natural breath pause (<code className="text-amber-300 font-mono">... </code>). However, writing <code className="text-amber-300 font-mono">... </code> directly is even cleaner.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Don't Vary Character Spelling:</strong> Don't write <code className="text-slate-300 font-mono">LAKSHMAN</code> in turn 1 and <code className="text-slate-300 font-mono">LAKSHMANA</code> in turn 2—use consistent names so the studio groups the casting correctly.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Don't Put Dialogue on the Context Line:</strong> Keep <code className="text-amber-300 font-mono">CONTEXT:</code> and <code className="text-amber-300 font-mono">ATMOSPHERE:</code> for setting notes; they are never spoken aloud. Put spoken words under a character header.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Don't Worry About Quotation Marks:</strong> You don't have to rewrite a whole script if some dialogues have quotes and some don't. The engine handles both!</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 8 Studio Voices Reference */}
          <div className="space-y-3">
            <h3 className="text-sm font-cinzel font-bold text-amber-200 uppercase tracking-wider">
              <span>The 8 Gemini Prebuilt Voices &amp; Archetypes</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-amber-400 text-xs">Fenrir</div>
                <div className="text-[11px] text-slate-300 font-medium">Deep Baritone / Emperor</div>
                <div className="text-[10px] text-slate-500 mt-1">Commanding rulers, kings, solemn male narration</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-amber-400 text-xs">Charon</div>
                <div className="text-[11px] text-slate-300 font-medium">Grave Bass / Elder</div>
                <div className="text-[10px] text-slate-500 mt-1">Ancient sages, priests, conspirators, dark mystery</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-sky-400 text-xs">Kore</div>
                <div className="text-[11px] text-slate-300 font-medium">Female Mezzo-Soprano / Queen</div>
                <div className="text-[10px] text-slate-500 mt-1">Empresses, noble women, commanding female sovereigns</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-sky-400 text-xs">Aoede</div>
                <div className="text-[11px] text-slate-300 font-medium">Melodic Female / Princess</div>
                <div className="text-[10px] text-slate-500 mt-1">Lyrical, vibrant, youth, princesses, villagers</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-amber-400 text-xs">Orus</div>
                <div className="text-[11px] text-slate-300 font-medium">Bold Male / Warrior / General</div>
                <div className="text-[10px] text-slate-500 mt-1">Military urgency, rustic conversational males, commanders</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-amber-400 text-xs">Puck</div>
                <div className="text-[11px] text-slate-300 font-medium">Agile Tenor / Youth</div>
                <div className="text-[10px] text-slate-500 mt-1">Young warriors, scouts, messengers, fast dialogue</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-emerald-400 text-xs">Zephyr</div>
                <div className="text-[11px] text-slate-300 font-medium">Warm Literary Narrator / Sage</div>
                <div className="text-[10px] text-slate-500 mt-1">Literary audiobooks, Tejaswi narration, thoughtful scholars</div>
              </div>
              <div className="p-3 rounded-lg bg-[#111420] border border-[#1e2538]">
                <div className="font-mono font-bold text-sky-400 text-xs">Leda</div>
                <div className="text-[11px] text-slate-300 font-medium">Poised Female / Confidante</div>
                <div className="text-[10px] text-slate-500 mt-1">Gentle, calm wisdom, court healers, poised advisors</div>
              </div>
            </div>
          </div>

          {/* Copyable Script Examples */}
          <div className="space-y-4">
            <h3 className="text-sm font-cinzel font-bold text-amber-200 uppercase tracking-wider">
              <span>Ready-to-Use Screenplay Templates</span>
            </h3>

            {/* Kannada Example */}
            <div className="p-4 rounded-xl bg-[#090b10] border border-[#1f2638] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 text-xs">Example 1: Kannada Literary Screenplay (Carvalho Style)</span>
                <button
                  onClick={() => copyToClipboard(kannadaSnippet, 'kannada')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161c2b] hover:bg-[#1f273c] text-slate-300 hover:text-white transition-colors text-[11px]"
                >
                  {copiedSnippet === 'kannada' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'kannada' ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#05060a] border border-[#171c2b] text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-48">
                {kannadaSnippet}
              </pre>
            </div>

            {/* English Example */}
            <div className="p-4 rounded-xl bg-[#090b10] border border-[#1f2638] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-300 text-xs">Example 2: Historical Imperial Drama (English / Multi-Speaker)</span>
                <button
                  onClick={() => copyToClipboard(englishSnippet, 'english')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161c2b] hover:bg-[#1f273c] text-slate-300 hover:text-white transition-colors text-[11px]"
                >
                  {copiedSnippet === 'english' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'english' ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-[#05060a] border border-[#171c2b] text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-48">
                {englishSnippet}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1d2436] bg-[#111522] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs transition-colors"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
