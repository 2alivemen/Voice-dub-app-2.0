import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene } from '../types/screenplay';
import {
  decodeAudioBase64,
  stitchAudioBuffers,
  audioBufferToWavBlob,
  blobToBase64,
} from '../utils/audioUtils';
import { sanitizeDialogueTextForTTS } from '../utils/screenplayParser';

export interface TTSApiResponse {
  audioBase64: string;
  mimeType: string;
  speakers?: string[];
  turnIds?: string[];
  modelUsed?: string;
}

// Synthesize turns via the backend proxy
export async function callBackendSynthesize(
  turns: Array<{ id: string; speaker: string; text: string; emotion?: string; vocalizeSpeakerName?: boolean }>,
  voiceAssignments: Record<string, { voiceName: GeminiPrebuiltVoice; basePersonality?: string }>
): Promise<TTSApiResponse> {
  const response = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      turns,
      voiceAssignments,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Synthesis failed with status ${response.status}`);
  }

  return data;
}

// Audition a voice with custom delivery style
export async function auditionVoicePersona(
  voiceName: GeminiPrebuiltVoice,
  personality: string,
  previewText?: string
): Promise<string> {
  const response = await fetch('/api/tts/audition', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceName,
      personality,
      previewText,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Audition failed with status ${response.status}`);
  }

  return data.audioBase64;
}

/**
 * Synthesizes an individual dialogue turn.
 * Provides a dedicated audio take for this turn so the user can play or download it individually.
 * Sanitizes pause directives ([pause: 50ms], etc.) to natural prosodic breath markers.
 */
export async function synthesizeSingleTurn(
  turn: DialogueTurn,
  characterVoices: CharacterVoice[]
): Promise<{ audioBase64: string; duration: number }> {
  const speaker = turn.speaker.trim();
  const cv = characterVoices.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase());
  const voiceName = cv ? cv.voiceName : 'Fenrir';
  const basePersonality = cv ? cv.basePersonality : 'Historical dramatic performance';

  const voiceMap = {
    [speaker]: {
      voiceName,
      basePersonality,
    },
  };

  const cleanText = sanitizeDialogueTextForTTS(turn.text);

  const payload = [
    {
      id: turn.id,
      speaker,
      text: cleanText,
      emotion: turn.emotion.trim(),
      vocalizeSpeakerName: turn.vocalizeSpeakerName ?? false,
    },
  ];

  const result = await callBackendSynthesize(payload, voiceMap);
  const buffer = await decodeAudioBase64(result.audioBase64);

  return {
    audioBase64: result.audioBase64,
    duration: buffer.duration,
  };
}

/**
 * Synthesizes an entire scene in exact chronological screenplay order:
 * - Iterates strictly through dialogue turns in script sequence (Turn 1, Turn 2, Turn 3...).
 * - Caches and reuses already-voiced turns so repeated attempts or retakes don't waste API quota.
 * - Paces requests (1.2s delay) to stay comfortably within rate limits, while the backend's
 *   exponential backoff handles any transient rate limits seamlessly.
 * - Sanitizes all pause directives ([pause: 50ms], (pause 50ms), etc.) to natural speech pauses (...).
 * - Stitches all individual turn audio takes into a master soundtrack in 100% script sequence.
 */
export async function synthesizeFullScene(
  scene: Scene,
  characterVoices: CharacterVoice[],
  onProgress?: (progressText: string, current: number, total: number) => void
): Promise<{
  sceneAudioBase64: string;
  sceneDuration: number;
  turnAudios: Record<string, { audioBase64: string; duration: number }>;
}> {
  if (!scene.dialogueTurns || scene.dialogueTurns.length === 0) {
    console.warn(`[synthesizeFullScene] Scene ${scene.sceneNumber} (${scene.slug}) contains no spoken dialogue turns.`);
    return {
      sceneAudioBase64: '',
      sceneDuration: 0,
      turnAudios: {},
    };
  }

  const totalTurns = scene.dialogueTurns.length;
  const turnAudios: Record<string, { audioBase64: string; duration: number }> = {};
  const orderedTurnBuffers: AudioBuffer[] = [];

  // Synthesize each turn in guaranteed chronological sequence
  for (let i = 0; i < totalTurns; i++) {
    const turn = scene.dialogueTurns[i];
    const speaker = turn.speaker.trim();

    onProgress?.(
      `Voicing Line ${i + 1}/${totalTurns} (${speaker})...`,
      i,
      totalTurns
    );

    // If turn was already recorded and has valid audio, reuse it to save API calls
    if (turn.audioBase64 && turn.duration && turn.duration > 0) {
      try {
        const cachedBuffer = await decodeAudioBase64(turn.audioBase64);
        turnAudios[turn.id] = {
          audioBase64: turn.audioBase64,
          duration: turn.duration,
        };
        orderedTurnBuffers.push(cachedBuffer);
        continue;
      } catch {
        // If decoding cached audio fails, regenerate this turn below
      }
    }

    // Pacing pause between API calls to stay within free-tier RPM limits
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    // Synthesize turn take
    const singleResult = await synthesizeSingleTurn(turn, characterVoices);
    const buf = await decodeAudioBase64(singleResult.audioBase64);

    turnAudios[turn.id] = {
      audioBase64: singleResult.audioBase64,
      duration: buf.duration,
    };
    orderedTurnBuffers.push(buf);
  }

  // Master all turn buffers in the EXACT original screenplay sequence!
  onProgress?.(`Mastering Scene ${scene.sceneNumber} in script order...`, totalTurns, totalTurns);

  const stitchedBuffer = stitchAudioBuffers(orderedTurnBuffers, 0.25);
  const wavBlob = audioBufferToWavBlob(stitchedBuffer);
  const sceneAudioBase64 = await blobToBase64(wavBlob);

  return {
    sceneAudioBase64,
    sceneDuration: stitchedBuffer.duration,
    turnAudios,
  };
}
