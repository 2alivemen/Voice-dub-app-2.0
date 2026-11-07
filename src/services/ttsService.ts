import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene } from '../types/screenplay';
import {
  decodeAudioBase64,
  stitchAudioBuffers,
  audioBufferToWavBlob,
  blobToBase64,
  splitAudioBufferIntoSegments,
} from '../utils/audioUtils';

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

  const payload = [
    {
      id: turn.id,
      speaker,
      text: turn.text.trim(),
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
 * Synthesizes an entire scene using Intelligent Character Batching:
 * - Collects all lines for each character and synthesizes them in 1 API call per character.
 * - This dramatically reduces API hits from N turns to just K characters (e.g., 10 turns -> 2-3 calls).
 * - Slices the batched audio into individual dialogue turn takes so each line remains independently playable/re-recordable.
 * - Reorganizes and stitches all turns into the exact chronological screenplay sequence.
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

  // 1. Group dialogue turns by character
  const turnsBySpeaker: Record<string, DialogueTurn[]> = {};
  for (const turn of scene.dialogueTurns) {
    const spk = turn.speaker.trim();
    if (!turnsBySpeaker[spk]) {
      turnsBySpeaker[spk] = [];
    }
    turnsBySpeaker[spk].push(turn);
  }

  const uniqueSpeakerNames = Object.keys(turnsBySpeaker);
  const totalCharacters = uniqueSpeakerNames.length;
  const turnAudios: Record<string, { audioBase64: string; duration: number }> = {};
  const turnBuffersById: Record<string, AudioBuffer> = {};

  // 2. Synthesize all dialogue for each character in 1 collective call per character
  for (let cIdx = 0; cIdx < totalCharacters; cIdx++) {
    const speaker = uniqueSpeakerNames[cIdx];
    const characterTurns = turnsBySpeaker[speaker];
    const cv = characterVoices.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase());
    const voiceName = cv ? cv.voiceName : 'Fenrir';
    const basePersonality = cv ? cv.basePersonality : 'Historical dramatic performance';

    onProgress?.(
      `Voicing Character ${cIdx + 1}/${totalCharacters}: ${speaker} (${characterTurns.length} line${
        characterTurns.length > 1 ? 's' : ''
      })...`,
      cIdx,
      totalCharacters
    );

    if (cIdx > 0) {
      // Pacing pause between character calls to keep RPM well within quota
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (characterTurns.length === 1) {
      // Single line for this character: synthesize directly
      const singleResult = await synthesizeSingleTurn(characterTurns[0], characterVoices);
      const buf = await decodeAudioBase64(singleResult.audioBase64);
      turnAudios[characterTurns[0].id] = singleResult;
      turnBuffersById[characterTurns[0].id] = buf;
    } else {
      // Multiple lines for this character: batch all lines into 1 single API call with pause separators
      const batchedPayload = characterTurns.map((t, idx) => {
        let lineText = t.text.trim();
        // Insert pause marker between lines so audio segments can be cleanly partitioned
        if (idx < characterTurns.length - 1 && !lineText.endsWith('[pause: 1.2s]')) {
          lineText = `${lineText} [pause: 1.2s]`;
        }
        return {
          id: t.id,
          speaker,
          text: lineText,
          emotion: t.emotion.trim(),
          vocalizeSpeakerName: t.vocalizeSpeakerName ?? false,
        };
      });

      const voiceMap = {
        [speaker]: {
          voiceName,
          basePersonality,
        },
      };

      const result = await callBackendSynthesize(batchedPayload, voiceMap);
      const combinedBuffer = await decodeAudioBase64(result.audioBase64);

      // Split the collective buffer into individual audio takes for each turn
      const segments = splitAudioBufferIntoSegments(combinedBuffer, characterTurns.length, 0.4);

      for (let s = 0; s < characterTurns.length; s++) {
        const turn = characterTurns[s];
        const segBuf = segments[s];
        const wavBlob = audioBufferToWavBlob(segBuf);
        const segBase64 = await blobToBase64(wavBlob);

        turnAudios[turn.id] = {
          audioBase64: segBase64,
          duration: segBuf.duration,
        };
        turnBuffersById[turn.id] = segBuf;
      }
    }
  }

  // 3. Reorganize and stitch all turn buffers in the EXACT original screenplay sequence!
  onProgress?.(`Reorganizing & Mastering Scene ${scene.sceneNumber} in script order...`, totalCharacters, totalCharacters);

  const orderedTurnBuffers: AudioBuffer[] = [];
  for (const turn of scene.dialogueTurns) {
    const buf = turnBuffersById[turn.id];
    if (buf) {
      orderedTurnBuffers.push(buf);
    }
  }

  const stitchedBuffer = stitchAudioBuffers(orderedTurnBuffers, 0.25);
  const wavBlob = audioBufferToWavBlob(stitchedBuffer);
  const sceneAudioBase64 = await blobToBase64(wavBlob);

  return {
    sceneAudioBase64,
    sceneDuration: stitchedBuffer.duration,
    turnAudios,
  };
}
