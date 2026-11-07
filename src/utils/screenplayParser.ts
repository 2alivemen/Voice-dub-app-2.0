import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene, Screenplay } from '../types/screenplay';

const PREBUILT_VOICE_ROTATION: GeminiPrebuiltVoice[] = [
  'Fenrir',
  'Kore',
  'Aoede',
  'Orus',
  'Charon',
  'Puck',
  'Zephyr',
  'Leda',
];
const CHARACTER_COLOR_PALETTE = [
  '#f59e0b', // amber
  '#38bdf8', // sky
  '#ec4899', // pink
  '#10b981', // emerald
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#e11d48', // rose
];

// Helper to resolve voice name from user text (supports all 8 Gemini prebuilt voice names and natural gender/timbre descriptions)
export function parseVoiceDescriptor(descriptor: string): GeminiPrebuiltVoice {
  const s = descriptor.toLowerCase().trim();

  // 1. Direct voice name matches
  if (s.includes('aoede')) return 'Aoede';
  if (s.includes('orus')) return 'Orus';
  if (s.includes('leda')) return 'Leda';
  if (s.includes('kore')) return 'Kore';
  if (s.includes('charon')) return 'Charon';
  if (s.includes('puck')) return 'Puck';
  if (s.includes('zephyr')) return 'Zephyr';
  if (s.includes('fenrir')) return 'Fenrir';

  // 2. Persona, archetype, & timbre keywords
  if (s.includes('princess') || s.includes('melodic') || s.includes('mythical') || s.includes('consort') || s.includes('breezy')) {
    return 'Aoede';
  }
  if (s.includes('warrior') || s.includes('general') || s.includes('challenger') || s.includes('bold') || s.includes('intense')) {
    return 'Orus';
  }
  if (s.includes('healer') || s.includes('confidante') || s.includes('poised') || s.includes('gentle') || s.includes('soft-spoken')) {
    return 'Leda';
  }
  if (s.includes('female') || s.includes('woman') || s.includes('queen') || s.includes('soprano') || s.includes('lady') || s.includes('priestess')) {
    return 'Kore';
  }
  if (s.includes('bass') || s.includes('gravelly') || s.includes('dark') || s.includes('grave') || s.includes('priest') || s.includes('ancient') || s.includes('elder') || s.includes('inquisitor')) {
    return 'Charon';
  }
  if (s.includes('tenor') || s.includes('youth') || s.includes('agile') || s.includes('young') || s.includes('boy') || s.includes('messenger') || s.includes('scout')) {
    return 'Puck';
  }
  if (s.includes('neutral') || s.includes('smooth') || s.includes('philosopher') || s.includes('sage') || s.includes('monk') || s.includes('chronicler') || s.includes('measured')) {
    return 'Zephyr';
  }
  if (s.includes('baritone') || s.includes('deep') || s.includes('male') || s.includes('emperor') || s.includes('king') || s.includes('villain') || s.includes('commanding')) {
    return 'Fenrir';
  }

  // If user typed any specific capitalized or alphanumeric voice name, preserve it
  const cleanWord = descriptor.trim().replace(/^Voice:\s*/i, '').trim();
  if (/^[A-Za-z0-9_-]{3,25}$/.test(cleanWord)) {
    return cleanWord;
  }

  return 'Fenrir';
}

export const HISTORICAL_TEMPLATES: Array<{
  id: string;
  name: string;
  period: string;
  description: string;
  screenplayText: string;
}> = [
  {
    id: 'kalyana-court',
    name: 'The Royal Court at Kalyana (1117 CE)',
    period: 'Medieval India - Western Chalukya Empire',
    description: 'Imperial court drama with Emperor Vikramaditya VI and Narrator, showing in-script Voice and Style directions.',
    screenplayText: `TITLE: The Royal Court at Kalyana
ERA: 1117 CE, Western Chalukya Empire

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
"How long shall we permit this challenge to our authority?"

VOICE 1 — NARRATOR:
Voice: Fenrir
Style: Quiet suspense, building tension.
"No one in the hall dared to answer immediately."

VOICE 2 — VIKRAMADITYA(IA):
Voice: Charon
Style: Regal authority and resolute command.
"Summon the feudatories of Banavasi. Before the monsoon breaks, our banners shall fly over the Kaveri."
`,
  },
  {
    id: 'ides-of-march',
    name: 'The Ides of March (44 BC)',
    period: 'Ancient Rome - Roman Republic',
    description: '3-Speaker political tension in the Curia of Pompey between Caesar, Brutus, and Cassius.',
    screenplayText: `TITLE: The Ides of March
ERA: 44 BC, Ancient Rome

SCENE 1: INT. CURIA OF POMPEY - DUSK
The senate hall stands chilled in shadow. Conspirators circle the golden dais.

VOICE 1 — CAESAR(IA):
Voice: Fenrir
Style: Calm authority, sovereign dignity.
"Are we all ready? What is now amiss, that Caesar and his senate must redress?"

VOICE 2 — BRUTUS(IA):
Voice: Puck
Style: Restrained anxiety, intellectual contemplation.
"Most high, most mighty, and most puissant Caesar, Metellus Cimber throws before thy seat an humble heart."

VOICE 1 — CAESAR(IA):
Voice: Fenrir
Style: Cold, unyielding command.
"I must prevent thee, Cimber. Caesar does not turn for lowly flatteries."

VOICE 3 — CASSIUS(IA):
Voice: Charon
Style: Whispering with suppressed fury.
"Pardon, Caesar! Caesar, pardon! As low as to thy foot doth Cassius fall!"
`,
  },
  {
    id: 'tudor-council',
    name: 'The Tudor Council at Greenwich (1588)',
    period: 'Renaissance England - Elizabethan Era',
    description: '3-Speaker diplomatic standoff between Queen Elizabeth I (Female/Kore), Cecil, and Ambassador Mendoza.',
    screenplayText: `TITLE: The Tudor Council at Greenwich
ERA: 1588, Elizabethan England

SCENE 1: INT. COUNCIL CHAMBER, GREENWICH PALACE - CANDLELIGHT
Tapestries of heraldic beasts drape the oak-paneled chamber.

VOICE 1 — QUEEN ELIZABETH(IA):
Voice: Kore
Style: Regal, commanding defiance.
"Speak plainly, Cecil. Does King Philip believe his Armada shall cow the crown of England while my sailors yet draw breath?"

VOICE 2 — LORD CECIL(IA):
Voice: Fenrir
Style: Grave, calculated caution.
"Your Grace, their galleons have entered the narrow seas. One hundred and thirty warships, bristling with cast iron."

VOICE 3 — AMBASSADOR MENDOZA(IA):
Voice: Charon
Style: Haughty, veiled menace.
"Her Majesty would be wise to heed the terms. Spain seeks only the restoration of the true faith."
`,
  },
];

/**
 * Sanitizes dialogue text for Gemini TTS generation:
 * - Translates bracketed and parenthesized pause directives ([pause: 50ms], (pause 50ms), etc.) into natural prosodic ellipses (...)
 * - Converts [beat], (beat), [silence] to natural pause ellipses
 * - Strips outer surrounding quotes ("...", “...”)
 * - Cleans up inner adjacent quotation marks (e.g. 'Line 1" "Line 2' -> 'Line 1 Line 2')
 * - Ensures natural, expressive breathing pauses without speaking the word "pause" aloud
 */
export function sanitizeDialogueTextForTTS(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Replace bracketed or parenthesized pause directives with ellipsis for natural prosodic breath
  // Examples: [pause: 50ms], [pause 50 ms], (pause: 50ms), (pause 500ms), [pause 1.2s], [pause], (pause)
  text = text.replace(/\[\s*pause(?::|\s)+[\d.]+\s*(?:ms|s|sec|seconds)?\s*\]/gi, '... ');
  text = text.replace(/\(\s*pause(?::|\s)+[\d.]+\s*(?:ms|s|sec|seconds)?\s*\)/gi, '... ');
  text = text.replace(/\[\s*pause\s*\]/gi, '... ');
  text = text.replace(/\(\s*pause\s*\)/gi, '... ');

  // 2. Bare pause notations like "pause 50 ms", "pause 100ms", "(beat)", "[beat]", "(silence)", "[silence]"
  text = text.replace(/\bpause\s+[\d.]+\s*(?:ms|s|sec|seconds)?\b/gi, '... ');
  text = text.replace(/\[\s*(?:beat|silence|gap)\s*\]/gi, '... ');
  text = text.replace(/\(\s*(?:beat|silence|gap)\s*\)/gi, '... ');

  // 3. SSML break tags if present: <break time="..."/>
  text = text.replace(/<break[^>]*\/?>/gi, '... ');

  // 4. Strip surrounding quotation marks ("...", “...”, '...')
  text = text.replace(/^["“'‘]+|["”'’]+$/g, '').trim();

  // 5. Clean redundant internal quote pairings like 'Line 1" "Line 2' into seamless text
  text = text.replace(/["”]\s*["“]/g, ' ');

  // 6. Clean multiple consecutive ellipses or spaces
  text = text.replace(/(?:\s*\.\.\.){2,}/g, '... ');
  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();
}

// Parser function supporting Voice/Gender, Style, (IA) flags, and quoted dialogue
export function parseScreenplayText(text: string): {
  screenplay: Screenplay;
  detectedCharacters: CharacterVoice[];
} {
  const cleanInput = text.replace(/\r\n/g, '\n').trim();
  if (!cleanInput) {
    return {
      screenplay: {
        id: `script-${Date.now()}`,
        title: 'Untitled Historical Screenplay',
        periodOrEra: 'Historical Era',
        scenes: [],
      },
      detectedCharacters: [],
    };
  }

  const lines = cleanInput.split('\n');
  let title = 'Historical Film Production';
  let era = 'Historical Era';
  const scenes: Scene[] = [];
  const characterNamesSet = new Set<string>();
  const characterExplicitVoices: Record<string, GeminiPrebuiltVoice> = {};
  const characterVoiceSources: Record<string, string> = {};

  let currentScene: Scene | null = null;
  let sceneCounter = 0;
  let turnCounter = 0;

  let inContextBlock = false;
  let currentContextLines: string[] = [];

  let currentSpeaker: string | null = null;
  let currentStyle: string = '';
  let currentVocalizeName: boolean = false;
  let currentDialogueLines: string[] = [];

  // Helper to commit a pending dialogue turn
  const commitTurn = () => {
    if (currentSpeaker && currentDialogueLines.length > 0) {
      let spokenText = currentDialogueLines.join(' ').trim();
      spokenText = sanitizeDialogueTextForTTS(spokenText);

      if (spokenText) {
        if (!currentScene) {
          sceneCounter++;
          currentScene = {
            id: `scene-${sceneCounter}-${Date.now()}`,
            sceneNumber: sceneCounter,
            slug: `SCENE ${sceneCounter} — HISTORICAL SOUNDSTAGE`,
            context: '',
            dialogueTurns: [],
            status: 'idle',
          };
          scenes.push(currentScene);
        }

        turnCounter++;
        characterNamesSet.add(currentSpeaker);

        currentScene.dialogueTurns.push({
          id: `turn-${turnCounter}-${Date.now()}`,
          speaker: currentSpeaker,
          text: spokenText,
          emotion: currentStyle.trim() || 'Measured historical delivery',
          vocalizeSpeakerName: currentVocalizeName,
          status: 'idle',
        });
      }

      currentDialogueLines = [];
      currentStyle = '';
      currentSpeaker = null;
      currentVocalizeName = false;
    }
  };

  // Helper to commit context lines to current scene
  const commitContext = () => {
    if (currentScene && currentContextLines.length > 0) {
      const merged = currentContextLines.join(' ').trim();
      if (merged) {
        currentScene.context = currentScene.context
          ? `${currentScene.context}\n\n${merged}`
          : merged;
      }
      currentContextLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (inContextBlock) {
        commitContext();
        inContextBlock = false;
      }
      continue;
    }

    // 0. Ignore Markdown horizontal dividers / section breaks (---, ===, ***, ___):
    if (/^[-=*_~]{3,}$/.test(line)) {
      if (inContextBlock) {
        commitContext();
        inContextBlock = false;
      }
      continue;
    }

    // 1. Detect Metadata: TITLE: or ERA:
    if (/^TITLE\s*[:=]/i.test(line)) {
      title = line.replace(/^TITLE\s*[:=]\s*/i, '').trim();
      continue;
    }
    if (/^(ERA|PERIOD|SETTING)\s*[:=]/i.test(line)) {
      era = line.replace(/^(ERA|PERIOD|SETTING)\s*[:=]\s*/i, '').trim();
      continue;
    }

    // 2. Detect Scene Heading: e.g. "SCENE 04 — THE ROYAL COURT", "SCENE 1: ...", "INT. ..."
    const isSceneHeader =
      /^(SCENE\s+\d+|ACT\s+\d+|INT\.|EXT\.|INT\/EXT\.|###?\s+SCENE|#\s+SCENE|#\s+INT|#\s+EXT)/i.test(line);

    if (isSceneHeader) {
      commitTurn();
      commitContext();
      inContextBlock = false;
      const cleanSlug = line.replace(/^#+\s*/, '').trim();

      // If we already have a currentScene that hasn't received any dialogue turns or context yet,
      // this line is a continuation of the scene header (e.g. SCENE 1 followed by INT. ...)
      if (currentScene && currentScene.dialogueTurns.length === 0 && !currentScene.context.trim()) {
        currentScene.slug = `${currentScene.slug} — ${cleanSlug}`;
        continue;
      }

      sceneCounter++;
      currentScene = {
        id: `scene-${sceneCounter}-${Date.now()}`,
        sceneNumber: sceneCounter,
        slug: cleanSlug,
        context: '',
        dialogueTurns: [],
        status: 'idle',
      };
      scenes.push(currentScene);
      continue;
    }

    // 3. Detect Context Block: e.g. "CONTEXT:" or "SETTING:" or "[Context: ...]"
    const contextHeaderMatch = line.match(/^\[?(?:CONTEXT|STAGE DIRECTIONS?|ATMOSPHERE|SETTING)\s*[:=]?\s*(.*?)\]?$/i);
    if (contextHeaderMatch) {
      commitTurn();
      commitContext();
      inContextBlock = true;
      const inlineRemainder = contextHeaderMatch[1].trim();
      if (inlineRemainder) {
        currentContextLines.push(inlineRemainder);
      }
      continue;
    }

    // 4. In-Script Voice or Gender Selection on separate line:
    // e.g. "Voice: Fenrir", "Voice: Kore", "Voice: Female", "Gender: Female", "Voice: Charon"
    const voiceMatch = line.match(/^(?:Voice|Gender|Actor|Timbre)\s*[:=]\s*(.+)$/i);
    if (voiceMatch) {
      inContextBlock = false;
      const rawDescriptor = voiceMatch[1].trim();
      const resolvedVoice = parseVoiceDescriptor(rawDescriptor);
      if (currentSpeaker) {
        characterExplicitVoices[currentSpeaker] = resolvedVoice;
        characterVoiceSources[currentSpeaker] = `In-Script (Voice: ${rawDescriptor})`;
      }
      continue;
    }

    // 5. In-Script Style / Tone lines:
    // e.g. "Style: Deep, measured, ominous." or "Style: Female voice (Kore), regal defiance"
    const styleMatch = line.match(/^(?:Style|Tone|Delivery|Mood|Direction|Emotion|Pacing)\s*[:=]\s*(.+)$/i);
    if (styleMatch) {
      inContextBlock = false;
      const rawStyle = styleMatch[1].trim();

      // Check if the user embedded voice or gender inside the Style line!
      const hasVoiceInStyle = /(?:female|woman|queen|soprano|kore|aoede|leda|male|baritone|bass|grave|tenor|youth|puck|charon|fenrir|zephyr|orus)/i.test(rawStyle);
      if (hasVoiceInStyle && currentSpeaker && !characterExplicitVoices[currentSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(rawStyle);
        characterExplicitVoices[currentSpeaker] = detectedVoice;
        characterVoiceSources[currentSpeaker] = `From Style (${detectedVoice})`;

        // Clean out the voice/gender keyword from the emotional delivery instruction sent to Gemini TTS
        currentStyle = rawStyle
          .replace(/\b(?:voice|gender|actor)\s*[:=]?\s*(?:fenrir|charon|kore|aoede|orus|puck|zephyr|leda|male|female)\b/gi, '')
          .replace(/\b(?:female|male)\s+voice\b/gi, '')
          .replace(/\b(?:fenrir|charon|kore|aoede|orus|puck|zephyr|leda)\b/gi, '')
          .replace(/^\s*[,;.:-]+\s*/, '')
          .replace(/\s*[,;.:-]+\s*$/, '')
          .trim();
        if (!currentStyle) {
          currentStyle = 'Measured historical delivery';
        }
      } else {
        currentStyle = rawStyle;
      }
      continue;
    }

    // 5b. Detect Speaker with inline Style: e.g. "KING Style: bold military urgency", "VOICE 3 — SOMESHVARA Style: Orus..."
    const inlineSpeakerWithStyle = line.match(/^((?:(?:VOICE|CHARACTER|SPEAKER)\s*\d*\s*[-—–:]\s*)?[A-Za-z0-9\s._'()/,–—-]{2,40}?)\s*(?:[-—–]|\s)\s*Style\s*[:=]\s*(.+)$/i);
    if (inlineSpeakerWithStyle) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let extractedSpeakerRaw = inlineSpeakerWithStyle[1].trim();
      let rawStyle = inlineSpeakerWithStyle[2].trim();

      let isInactiveAnnouncement = /\b(?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\b/i.test(extractedSpeakerRaw);
      let isExplicitSayName = /\b(?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\b/i.test(extractedSpeakerRaw);

      let cleanSpeaker = extractedSpeakerRaw
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .replace(/^(?:VOICE|SPEAKER|CHARACTER)\s*\d*\s*[-—–:]\s*/i, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|aoede|leda|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr|orus)/i.test(extractedSpeakerRaw);
      const hasVoiceInStyle = /(?:female|woman|queen|soprano|kore|aoede|leda|male|baritone|bass|grave|tenor|youth|puck|charon|fenrir|zephyr|orus)/i.test(rawStyle);

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(extractedSpeakerRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      } else if (hasVoiceInStyle && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(rawStyle);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `From Style (${detectedVoice})`;
      }

      currentStyle = rawStyle;

      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      continue;
    }

    // 6. Detect Voice/Speaker Heading with VOICE or CHARACTER prefix (colon optional):
    // e.g. "VOICE 1 — NARRATOR:", "VOICE 2 — EMPRESS LAKSHMI (Kore, IA):", "VOICE 2 - VIKRAMADITYA"
    const voicePrefixMatch = line.match(/^(?:VOICE|CHARACTER|SPEAKER)\s*\d*\s*[-—–:]\s*([^:]+?)(?:\s*:\s*(.*))?$/i);
    if (voicePrefixMatch) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let extractedSpeakerRaw = voicePrefixMatch[1].trim();

      // Check for (IA) / (NO_NAME) or (SAY_NAME) flags anywhere in the speaker descriptor
      // IA = Inactive Announcement: switch voice without reading character's name aloud
      let isInactiveAnnouncement = /\b(?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\b/i.test(extractedSpeakerRaw);
      let isExplicitSayName = /\b(?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\b/i.test(extractedSpeakerRaw);

      // Check if speaker tag specifies voice/gender, e.g. (Male, Charon), (Female, Aoede), (Kore, IA)
      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|aoede|leda|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr|orus)/i.test(extractedSpeakerRaw);

      let cleanSpeaker = extractedSpeakerRaw
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '') // remove parens/brackets
        .replace(/^(?:VOICE|SPEAKER|CHARACTER)\s*\d*\s*[-—–:]\s*/i, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(extractedSpeakerRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      }

      // Name announcement logic:
      // Narrator speaks text directly unless explicitly asked to announce
      // Characters announce name unless marked with (IA)
      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      const inlineDialogue = voicePrefixMatch[2] ? voicePrefixMatch[2].trim() : '';
      if (inlineDialogue) {
        currentDialogueLines.push(inlineDialogue);
      }
      continue;
    }

    // 7. Detect General Speaker Line with Colon:
    // e.g. "NARRATOR:", "EMPRESS LAKSHMI (Kore, IA):", "VIKRAMADITYA:", "CAESAR (with calm authority):"
    const generalColonMatch = line.match(/^([A-Za-z0-9\s._'()/,–—-]+?)\s*(?:\(([^)]+)\)|\[([^\]]+)\])?:\s*(.*)$/);
    const nonSpeakerWords = /^(https?|scene|act|context|atmosphere|setting|stage\s+directions?|note|description|audio|take|dialogue|voice|style|gender|delivery|fade\s+in|fade\s+out|cut\s+to|dissolve\s+to|the\s+end|continued|int|ext)$/i;

    if (generalColonMatch && !nonSpeakerWords.test(generalColonMatch[1].trim())) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let candidateRaw = generalColonMatch[1].trim();
      let isInactiveAnnouncement = /\b(?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\b/i.test(line);
      let isExplicitSayName = /\b(?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\b/i.test(line);

      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|aoede|leda|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr|orus)/i.test(candidateRaw);

      let cleanSpeaker = candidateRaw
        .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(candidateRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      }

      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      const inlineEmotion = (generalColonMatch[2] || generalColonMatch[3] || '').trim();
      if (inlineEmotion && !/^(IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)$/i.test(inlineEmotion)) {
        // Also check if inline emotion has voice keywords
        if (/(?:female|male|kore|aoede|leda|fenrir|charon|puck|zephyr|orus)/i.test(inlineEmotion) && !characterExplicitVoices[cleanSpeaker]) {
          const detectedVoice = parseVoiceDescriptor(inlineEmotion);
          characterExplicitVoices[cleanSpeaker] = detectedVoice;
          characterVoiceSources[cleanSpeaker] = `From Tag (${detectedVoice})`;
        }
        currentStyle = inlineEmotion;
      }

      const inlineDialogue = generalColonMatch[4].trim();
      if (inlineDialogue) {
        currentDialogueLines.push(inlineDialogue);
      }
      continue;
    }

    // 8. Detect Uppercase Character Heading line without Colon (Hollywood Screenplay format):
    // e.g. "GENERAL KAEL", "EMPEROR VANE", "HIGH SEER LYRA (Aoede)", "KING AURELIUS (IA)"
    const namePartClean = line.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
    const isParentheticalOnly = /^\([^)]+\)$/.test(line);

    const hasLetters = /[a-zA-Z\p{L}]/u.test(namePartClean);
    const isUppercaseSpeakerHeading =
      hasLetters &&
      !isParentheticalOnly &&
      !nonSpeakerWords.test(namePartClean) &&
      /^[A-Z0-9\s'/-]{2,35}$/.test(namePartClean) &&
      namePartClean.split(/\s+/).length <= 5 &&
      !/[.!?,;]$/.test(namePartClean) &&
      !/^["“]/.test(line);

    if (isUppercaseSpeakerHeading) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let candidateRaw = line;
      let isInactiveAnnouncement = /\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\)/i.test(candidateRaw);
      let isExplicitSayName = /\((?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/i.test(candidateRaw);

      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|aoede|leda|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr|orus)/i.test(candidateRaw);

      let cleanSpeaker = candidateRaw
        .replace(/\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/gi, '')
        .replace(/\((?:[^)]+)\)/g, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(candidateRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      }

      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      // Check if there was an emotion/style inside parens, e.g. EMPEROR VANE (coldly)
      const parenMatch = candidateRaw.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const insideParen = parenMatch[1].trim();
        if (!/^(IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)$/i.test(insideParen)) {
          if (/(?:female|male|kore|aoede|leda|fenrir|charon|puck|zephyr|orus)/i.test(insideParen) && !characterExplicitVoices[cleanSpeaker]) {
            const detectedVoice = parseVoiceDescriptor(insideParen);
            characterExplicitVoices[cleanSpeaker] = detectedVoice;
            characterVoiceSources[cleanSpeaker] = `From Tag (${detectedVoice})`;
          }
          currentStyle = insideParen;
        }
      }

      continue;
    }

    // 9. Quoted Dialogue: e.g. "The news from the southern territories had reached the imperial court."
    if (/^["“].+["”]?$/.test(line)) {
      inContextBlock = false;
      if (!currentSpeaker) {
        currentSpeaker = 'NARRATOR';
        currentVocalizeName = false;
      }
      currentDialogueLines.push(line);
      continue;
    }

    // 10. If we have an active speaker and we're not in a context block, this line is spoken dialogue!
    if (currentSpeaker && !inContextBlock) {
      currentDialogueLines.push(line);
      continue;
    }

    // 11. If currently in context block, accumulate context
    if (inContextBlock) {
      currentContextLines.push(line);
      continue;
    }

    // 12. Otherwise, accumulate as context/atmosphere
    currentContextLines.push(line);
  }

  // Final commits
  commitTurn();
  commitContext();

  // If a scene has no dialogue turns, but accumulated context, convert context into NARRATOR turns
  for (const scene of scenes) {
    if (scene.dialogueTurns.length === 0 && scene.context.trim()) {
      const paragraphs = scene.context
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const speakerName = 'NARRATOR';
      characterNamesSet.add(speakerName);

      scene.dialogueTurns = paragraphs.map((para) => {
        turnCounter++;
        return {
          id: `turn-${turnCounter}-${Date.now()}`,
          speaker: speakerName,
          text: para.replace(/^["“](.*)["”]$/, '$1').trim(),
          emotion: 'Deep, measured historical narration',
          vocalizeSpeakerName: false,
          status: 'idle',
        };
      });

      scene.context = 'Cinematic historical narration track.';
    }
  }

  // Filter out any empty scenes that have no spoken dialogue turns
  let activeScenes = scenes.filter((scene) => scene.dialogueTurns && scene.dialogueTurns.length > 0);

  // If NO active scenes exist at all (e.g. user pasted raw narrative text without headings):
  if (activeScenes.length === 0) {
    const rawBlocks = cleanInput
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && !/^(?:TITLE|ERA|PERIOD|SETTING)\s*[:=]/i.test(p));

    if (rawBlocks.length > 0) {
      const speakerName = 'NARRATOR';
      characterNamesSet.add(speakerName);
      sceneCounter++;
      activeScenes.push({
        id: `scene-${sceneCounter}-${Date.now()}`,
        sceneNumber: 1,
        slug: 'SCENE 01 — HISTORICAL NARRATIVE',
        context: 'Narration track',
        dialogueTurns: rawBlocks.map((blk) => {
          turnCounter++;
          return {
            id: `turn-${turnCounter}-${Date.now()}`,
            speaker: speakerName,
            text: blk.replace(/^["“](.*)["”]$/, '$1').trim(),
            emotion: 'Deep, measured historical narration',
            vocalizeSpeakerName: false,
            status: 'idle',
          };
        }),
        status: 'idle',
      });
    }
  }

  // Renumber scenes sequentially 1, 2, 3...
  activeScenes.forEach((scene, index) => {
    scene.sceneNumber = index + 1;
  });

  // Ensure at least one character exists
  if (characterNamesSet.size === 0) {
    characterNamesSet.add('NARRATOR');
  }

  // Assign voices and persistent baselines
  const detectedCharacters: CharacterVoice[] = Array.from(characterNamesSet).map((name, idx) => {
    let voiceName: GeminiPrebuiltVoice = characterExplicitVoices[name] || PREBUILT_VOICE_ROTATION[idx % PREBUILT_VOICE_ROTATION.length];
    let assignmentSource = characterVoiceSources[name];
    const color = CHARACTER_COLOR_PALETTE[idx % CHARACTER_COLOR_PALETTE.length];
    const upper = name.toUpperCase();

    // If no explicit voice was provided, apply intelligent character archetype detection
    if (!characterExplicitVoices[name]) {
      if (
        upper.includes('QUEEN') ||
        upper.includes('EMPRESS') ||
        upper.includes('LADY') ||
        upper.includes('PRINCESS') ||
        upper.includes('LAKSHMI') ||
        upper.includes('SHANTALA') ||
        upper.includes('ELIZABETH') ||
        upper.includes('MARY') ||
        upper.includes('JOAN') ||
        upper.includes('CLEOPATRA') ||
        upper.includes('FEMALE')
      ) {
        voiceName = 'Kore'; // Female Mezzo-Soprano
        assignmentSource = 'Archetype (Female Sovereign -> Kore)';
      } else if (
        upper.includes('VIKRAMADITYA') ||
        upper.includes('EMPEROR') ||
        upper.includes('KING') ||
        upper.includes('CAESAR') ||
        upper.includes('GENERAL')
      ) {
        voiceName = 'Fenrir'; // Deep Baritone
        assignmentSource = 'Archetype (Imperial Ruler -> Fenrir)';
      } else if (
        upper.includes('PRIEST') ||
        upper.includes('JUDGE') ||
        upper.includes('INQUISITOR') ||
        upper.includes('CHARON')
      ) {
        voiceName = 'Charon'; // Grave Bass
        assignmentSource = 'Archetype (Grave Bass -> Charon)';
      } else if (
        upper.includes('CONSPIRATOR') ||
        upper.includes('MESSENGER') ||
        upper.includes('BRUTUS') ||
        upper.includes('PUCK')
      ) {
        voiceName = 'Puck'; // Agile Tenor
        assignmentSource = 'Archetype (Agile Tenor -> Puck)';
      } else if (upper.includes('NARRATOR') || upper.includes('CHRONICLER')) {
        voiceName = 'Fenrir'; // Deep Narrator
        assignmentSource = 'Documentary Narrator (Fenrir)';
      } else {
        assignmentSource = `Studio Cast Rotation (${voiceName})`;
      }
    }

    let defaultPersonality = 'Measured historical delivery, resonant cinematic voice.';
    if (upper.includes('NARRATOR') || upper.includes('CHRONICLER')) {
      defaultPersonality = 'Deep, measured, ominous cinematic documentary narrator.';
    } else if (upper.includes('VIKRAMADITYA') || upper.includes('EMPEROR') || upper.includes('KING') || upper.includes('CAESAR')) {
      defaultPersonality = 'Controlled anger. Commanding, deliberate imperial authority.';
    } else if (upper.includes('QUEEN') || upper.includes('LAKSHMI') || upper.includes('ELIZABETH') || upper.includes('SHANTALA')) {
      defaultPersonality = 'Regal sovereign with absolute authority and noble gravity.';
    } else if (upper.includes('CONSPIRATOR') || upper.includes('CASSIUS') || upper.includes('SPY')) {
      defaultPersonality = 'Whispered urgency with suppressed tension and vigilance.';
    } else if (upper.includes('SCHOLAR') || upper.includes('TURING') || upper.includes('CECIL')) {
      defaultPersonality = 'Intellectual gravitas, articulate contemplation and moral conviction.';
    }

    return {
      id: `char-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      voiceName,
      basePersonality: defaultPersonality,
      assignmentSource,
      color,
    };
  });

  return {
    screenplay: {
      id: `script-${Date.now()}`,
      title,
      periodOrEra: era,
      scenes: activeScenes,
    },
    detectedCharacters,
  };
}
