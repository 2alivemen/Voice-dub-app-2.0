import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene } from '../types/screenplay';
import {
  decodeAudioBase64,
  stitchAudioBuffers,
  audioBufferToWavBlob,
  blobToBase64,
  alignAudioBufferToTurns,
} from '../utils/audioUtils';
import { sanitizeDialogueTextForTTS } from '../utils/screenplayParser';

export type SynthesisMode = 'chronological-master' | 'character-batch-aligned';

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
 * Partitions dialogue turns into consecutive chunks where each chunk contains
 * at most 2 unique speakers (Gemini's dual-speaker limit), preserving strict script order.
 */
export function partitionTurnsIntoTwoSpeakerChunks(turns: DialogueTurn[]): DialogueTurn[][] {
  const chunks: DialogueTurn[][] = [];
  let currentChunk: DialogueTurn[] = [];
  let currentSpeakers = new Set<string>();

  for (const turn of turns) {
    const spk = turn.speaker.trim().toUpperCase();
    const wouldHaveSpeakers = new Set(currentSpeakers);
    wouldHaveSpeakers.add(spk);

    if (wouldHaveSpeakers.size > 2) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = [turn];
      currentSpeakers = new Set([spk]);
    } else {
      currentChunk.push(turn);
      currentSpeakers.add(spk);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Synthesizes an entire scene using the user's selected synthesis mode:
 *
 * Option 1 (Default - 'chronological-master'):
 * - Partitions turns into minimal dual-speaker chunks chronologically.
 * - Minimizes API requests (1-2 calls per scene) to prevent rate limits.
 * - Guarantees 100% chronological dialogue flow without jumbling.
 * - Slices chunk buffers using text-anchored acoustic windows so each dialogue card is playable.
 *
 * Option 3 ('character-batch-aligned'):
 * - Collects all lines per character (1 call per character).
 * - Slices batched audio using text-proportional script alignment.
 * - Reorganizes and stitches all takes in screenplay sequence.
 */
export async function synthesizeFullScene(
  scene: Scene,
  characterVoices: CharacterVoice[],
  onProgress?: (progressText: string, current: number, total: number) => void,
  mode: SynthesisMode = 'chronological-master'
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

  // Build voice assignment map for all characters
  const voiceMap: Record<string, { voiceName: GeminiPrebuiltVoice; basePersonality?: string }> = {};
  for (const cv of characterVoices) {
    voiceMap[cv.name.trim()] = {
      voiceName: cv.voiceName,
      basePersonality: cv.basePersonality,
    };
  }

  const turnAudios: Record<string, { audioBase64: string; duration: number }> = {};

  if (mode === 'chronological-master') {
    // ==========================================
    // OPTION 1 (DEFAULT): CHRONOLOGICAL MULTI-SPEAKER FLOW
    // ==========================================
    const chunks = partitionTurnsIntoTwoSpeakerChunks(scene.dialogueTurns);
    const totalChunks = chunks.length;
    const chunkBuffers: AudioBuffer[] = [];
    let caughtError: any = null;

    for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
      const chunkTurns = chunks[cIdx];
      const chunkSpeakers = Array.from(new Set(chunkTurns.map((t) => t.speaker.trim())));

      onProgress?.(
        `Voicing Scene ${scene.sceneNumber} Section ${cIdx + 1}/${totalChunks} (${chunkSpeakers.join(' & ')})...`,
        cIdx,
        totalChunks
      );

      if (cIdx > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      try {
        const payload = chunkTurns.map((turn) => ({
          id: turn.id,
          speaker: turn.speaker.trim(),
          text: sanitizeDialogueTextForTTS(turn.text),
          emotion: turn.emotion.trim(),
          vocalizeSpeakerName: turn.vocalizeSpeakerName ?? false,
        }));

        const result = await callBackendSynthesize(payload, voiceMap);
        const chunkBuffer = await decodeAudioBase64(result.audioBase64);
        chunkBuffers.push(chunkBuffer);

        // Slices chunk into takes for each turn card using script-proportional acoustic windows
        const slicedTakes = alignAudioBufferToTurns(
          chunkBuffer,
          chunkTurns.map((t) => t.text)
        );

        for (let s = 0; s < chunkTurns.length; s++) {
          const turn = chunkTurns[s];
          const segBuf = slicedTakes[s];
          const wavBlob = audioBufferToWavBlob(segBuf);
          const segBase64 = await blobToBase64(wavBlob);

          turnAudios[turn.id] = {
            audioBase64: segBase64,
            duration: segBuf.duration,
          };
        }
      } catch (err: any) {
        console.warn(`[synthesizeFullScene] Section ${cIdx + 1}/${totalChunks} failed:`, err);
        caughtError = err;
        break; // Stop remaining chunks, but preserve audio generated so far!
      }
    }

    let sceneAudioBase64 = '';
    let sceneDuration = 0;

    if (chunkBuffers.length > 0) {
      const stitchedBuffer = stitchAudioBuffers(chunkBuffers, 0.25);
      const masterBlob = audioBufferToWavBlob(stitchedBuffer);
      sceneAudioBase64 = await blobToBase64(masterBlob);
      sceneDuration = stitchedBuffer.duration;
    }

    if (caughtError) {
      // Attach the partial results to the error so caller can preserve them
      caughtError.partialResult = {
        sceneAudioBase64,
        sceneDuration,
        turnAudios,
        completedChunks: chunkBuffers.length,
        totalChunks,
      };
      throw caughtError;
    }

    return {
      sceneAudioBase64,
      sceneDuration,
      turnAudios,
    };
  } else {
    // ==========================================
    // OPTION 3: CHARACTER BATCH WITH SCRIPT ALIGNMENT
    // ==========================================
    const turnsBySpeaker: Record<string, DialogueTurn[]> = {};
    for (const turn of scene.dialogueTurns) {
      const spk = turn.speaker.trim();
      if (!turnsBySpeaker[spk]) {
        turnsBySpeaker[spk] = [];
      }
      turnsBySpeaker[spk].push(turn);
    }

    const uniqueSpeakers = Object.keys(turnsBySpeaker);
    const totalChars = uniqueSpeakers.length;
    const turnBuffersById: Record<string, AudioBuffer> = {};

    let caughtError: any = null;

    for (let cIdx = 0; cIdx < totalChars; cIdx++) {
      const speaker = uniqueSpeakers[cIdx];
      const charTurns = turnsBySpeaker[speaker];

      onProgress?.(
        `Voicing Character ${cIdx + 1}/${totalChars}: ${speaker} (${charTurns.length} line${charTurns.length > 1 ? 's' : ''})...`,
        cIdx,
        totalChars
      );

      if (cIdx > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      try {
        if (charTurns.length === 1) {
          const singleResult = await synthesizeSingleTurn(charTurns[0], characterVoices);
          const buf = await decodeAudioBase64(singleResult.audioBase64);
          turnAudios[charTurns[0].id] = singleResult;
          turnBuffersById[charTurns[0].id] = buf;
        } else {
          const payload = charTurns.map((turn, idx) => {
            let lineText = sanitizeDialogueTextForTTS(turn.text);
            if (idx < charTurns.length - 1) {
              lineText = `${lineText} ... ... `;
            }
            return {
              id: turn.id,
              speaker,
              text: lineText,
              emotion: turn.emotion.trim(),
              vocalizeSpeakerName: turn.vocalizeSpeakerName ?? false,
            };
          });

          const result = await callBackendSynthesize(payload, voiceMap);
          const combinedBuffer = await decodeAudioBase64(result.audioBase64);

          const segments = alignAudioBufferToTurns(
            combinedBuffer,
            charTurns.map((t) => t.text)
          );

          for (let s = 0; s < charTurns.length; s++) {
            const turn = charTurns[s];
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
      } catch (err: any) {
        console.warn(`[synthesizeFullScene] Character ${speaker} failed:`, err);
        caughtError = err;
        break; // Stop remaining characters, preserve audio generated so far!
      }
    }

    onProgress?.(`Reorganizing & Mastering Scene ${scene.sceneNumber} in script order...`, totalChars, totalChars);

    const orderedTurnBuffers: AudioBuffer[] = [];
    for (const turn of scene.dialogueTurns) {
      const buf = turnBuffersById[turn.id];
      if (buf) {
        orderedTurnBuffers.push(buf);
      }
    }

    let sceneAudioBase64 = '';
    let sceneDuration = 0;

    if (orderedTurnBuffers.length > 0) {
      const stitchedBuffer = stitchAudioBuffers(orderedTurnBuffers, 0.25);
      const wavBlob = audioBufferToWavBlob(stitchedBuffer);
      sceneAudioBase64 = await blobToBase64(wavBlob);
      sceneDuration = stitchedBuffer.duration;
    }

    if (caughtError) {
      caughtError.partialResult = {
        sceneAudioBase64,
        sceneDuration,
        turnAudios,
        completedChars: Object.keys(turnBuffersById).length,
      };
      throw caughtError;
    }

    return {
      sceneAudioBase64,
      sceneDuration,
      turnAudios,
    };
  }
}
