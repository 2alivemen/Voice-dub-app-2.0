import JSZip from 'jszip';
import { AudioManifestItem, Scene, Screenplay } from '../types/screenplay';

// Shared Web Audio Context
let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

// Convert Base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Decode base64 audio into AudioBuffer
export async function decodeAudioBase64(base64: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = base64ToArrayBuffer(base64);
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

// Encode AudioBuffer to standard 16-bit PCM WAV Blob
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // subchunk1size (16 for PCM)
  setUint16(1); // audio format (1 = PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

// Convert ArrayBuffer/Blob to Base64
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Seamlessly stitch multiple audio buffers with configurable silence gap
export function stitchAudioBuffers(
  buffers: AudioBuffer[],
  silenceGapSeconds = 0.25
): AudioBuffer {
  if (buffers.length === 0) {
    const ctx = getAudioContext();
    return ctx.createBuffer(1, 1, 24000);
  }

  if (buffers.length === 1) {
    return buffers[0];
  }

  const sampleRate = buffers[0].sampleRate;
  const numChannels = buffers[0].numberOfChannels;
  const silenceSamples = Math.round(silenceGapSeconds * sampleRate);

  let totalSamples = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalSamples += buffers[i].length;
    if (i < buffers.length - 1) {
      totalSamples += silenceSamples;
    }
  }

  const ctx = getAudioContext();
  const outputBuffer = ctx.createBuffer(numChannels, totalSamples, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const outputData = outputBuffer.getChannelData(channel);
    let currentOffset = 0;

    for (let i = 0; i < buffers.length; i++) {
      const inputData = buffers[i].getChannelData(channel < buffers[i].numberOfChannels ? channel : 0);
      outputData.set(inputData, currentOffset);
      currentOffset += inputData.length;

      if (i < buffers.length - 1) {
        // Room silence
        currentOffset += silenceSamples;
      }
    }
  }

  return outputBuffer;
}

/**
 * Splits an AudioBuffer into N segments by locating low-amplitude silence gaps.
 * Used for batched character synthesis where all lines of a character in a scene
 * are synthesized collectively in 1 API call, then sliced into individual takes.
 */
export function splitAudioBufferIntoSegments(
  buffer: AudioBuffer,
  expectedSegments: number,
  minSilenceSec = 0.35,
  amplitudeThreshold = 0.03
): AudioBuffer[] {
  const ctx = getAudioContext();
  if (expectedSegments <= 1 || buffer.duration <= 0.1) {
    return [buffer];
  }

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const channelData = buffer.getChannelData(0);
  const minSilenceSamples = Math.floor(sampleRate * minSilenceSec);

  // Scan for silence regions (amplitude < amplitudeThreshold)
  const silenceWindows: Array<{ start: number; end: number; duration: number }> = [];
  let inSilence = false;
  let silenceStart = 0;

  // Skip the first and last 0.15s of audio when detecting internal splits
  const scanStart = Math.floor(sampleRate * 0.15);
  const scanEnd = channelData.length - Math.floor(sampleRate * 0.15);

  for (let i = scanStart; i < scanEnd; i++) {
    const isSilent = Math.abs(channelData[i]) < amplitudeThreshold;
    if (isSilent) {
      if (!inSilence) {
        silenceStart = i;
        inSilence = true;
      }
    } else {
      if (inSilence) {
        const duration = i - silenceStart;
        if (duration >= minSilenceSamples) {
          silenceWindows.push({ start: silenceStart, end: i, duration });
        }
        inSilence = false;
      }
    }
  }

  // Pick the top (expectedSegments - 1) longest and best-spaced silence windows
  let splitIndices: number[] = [];

  if (silenceWindows.length >= expectedSegments - 1) {
    // Sort by duration descending to find the most significant silence pauses,
    // take the top (expectedSegments - 1), and then re-sort them chronologically
    const topWindows = [...silenceWindows]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, expectedSegments - 1)
      .sort((a, b) => a.start - b.start);

    splitIndices = topWindows.map((w) => Math.floor(w.start + w.duration / 2));
  } else {
    // Fallback: if silence detection found fewer gaps, distribute split points proportionally
    for (let s = 1; s < expectedSegments; s++) {
      splitIndices.push(Math.floor((buffer.length / expectedSegments) * s));
    }
  }

  // Slice the buffer into segment buffers
  const segments: AudioBuffer[] = [];
  let startSample = 0;

  for (let s = 0; s < expectedSegments; s++) {
    const endSample = s < splitIndices.length ? splitIndices[s] : buffer.length;
    const segmentLength = Math.max(1, endSample - startSample);
    const segmentBuffer = ctx.createBuffer(numChannels, segmentLength, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const destData = segmentBuffer.getChannelData(c);
      destData.set(srcData.subarray(startSample, endSample));
    }

    segments.push(segmentBuffer);
    startSample = endSample;
  }

  return segments;
}

/**
 * Intelligently aligns and slices a combined AudioBuffer to individual dialogue turns
 * using Script Text Proportions & Acoustic Energy Windows:
 * 1. Computes the expected boundary points based on the relative character/word length of each line in the script.
 * 2. Constrains silence/pause detection to a narrow window centered around the script-predicted boundary.
 * 3. This prevents intra-sentence pauses from causing premature splits and prevents words from being cut in half!
 */
export function alignAudioBufferToTurns(
  buffer: AudioBuffer,
  turnTexts: string[],
  minSilenceSec = 0.18,
  amplitudeThreshold = 0.035
): AudioBuffer[] {
  const ctx = getAudioContext();
  const numSegments = turnTexts.length;

  if (numSegments <= 1 || buffer.duration <= 0.1) {
    return [buffer];
  }

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const channelData = buffer.getChannelData(0);
  const totalSamples = buffer.length;

  // 1. Compute script text length proportions:
  // Short exclamations like "ಅಷ್ಟೊಂದು!" (9 chars) still take ~1.2s to speak plus the 800ms pause.
  // Adding a base acoustic overhead (+22 chars equivalent) ensures short lines receive an accurate time slice
  // and are never skipped or collapsed into neighboring lines!
  const textWeights = turnTexts.map((txt) => txt.trim().length + 22);
  const totalWeight = textWeights.reduce((acc, w) => acc + w, 0);

  // Cumulative expected boundary positions
  let cum = 0;
  const expectedBoundaries: number[] = [];
  for (let i = 0; i < numSegments - 1; i++) {
    cum += textWeights[i];
    expectedBoundaries.push(Math.floor((cum / totalWeight) * totalSamples));
  }

  // 2. Discover all distinct acoustic silence regions in the entire audio buffer
  const minSilenceSamples = Math.floor(sampleRate * minSilenceSec);
  const detectedGaps: Array<{ start: number; end: number; mid: number; duration: number }> = [];
  let inSilence = false;
  let sStart = 0;

  for (let i = 0; i < totalSamples; i++) {
    const isSilent = Math.abs(channelData[i]) < amplitudeThreshold;
    if (isSilent) {
      if (!inSilence) {
        sStart = i;
        inSilence = true;
      }
    } else {
      if (inSilence) {
        const len = i - sStart;
        if (len >= minSilenceSamples) {
          detectedGaps.push({
            start: sStart,
            end: i,
            mid: Math.floor(sStart + len / 2),
            duration: len,
          });
        }
        inSilence = false;
      }
    }
  }

  // 3. Globally Optimal Sequence Alignment using Dynamic Programming
  // Rather than making greedy independent choices that can get tricked by short words or comma pauses,
  // we find the global set of (numSegments - 1) pause gaps that jointly minimizes distance to expected
  // script boundaries while strongly favoring true inter-line pauses (which have longer duration due to [pause: 800ms]).
  const K = expectedBoundaries.length;
  let splitIndices: number[] = [];

  const minMargin = Math.floor(sampleRate * 0.15);
  const minSpeechSamples = Math.floor(sampleRate * 0.15); // Accommodate quick 1-word responses like "ಹೌದು" or "ಹೂ ಮತ್ತೆ"
  const validGaps = detectedGaps.filter(
    (g) => g.mid >= minMargin && g.mid <= totalSamples - minMargin
  );

  if (validGaps.length >= K && K > 0) {
    // DP state: dp[k][i] = minimum cost to assign the first (k+1) boundaries such that boundary k is validGaps[i]
    const dp: number[][] = Array.from({ length: K }, () => Array(validGaps.length).fill(Infinity));
    const parent: number[][] = Array.from({ length: K }, () => Array(validGaps.length).fill(-1));

    // Base step k = 0 (first boundary)
    for (let i = 0; i < validGaps.length; i++) {
      const g = validGaps[i];
      const dist = Math.abs(g.mid - expectedBoundaries[0]);
      // Strongly reward longer pause duration (inter-line gap with [pause: 800ms] is much wider than a comma)
      const pauseDurationSec = g.duration / sampleRate;
      const pauseBonus = Math.min(pauseDurationSec, 1.2) * (sampleRate * 0.7);
      dp[0][i] = dist - pauseBonus;
    }

    // Transitions for k = 1 to K - 1
    for (let k = 1; k < K; k++) {
      const target = expectedBoundaries[k];
      for (let i = k; i < validGaps.length; i++) {
        const gCurrent = validGaps[i];
        const dist = Math.abs(gCurrent.mid - target);
        const pauseDurationSec = gCurrent.duration / sampleRate;
        const pauseBonus = Math.min(pauseDurationSec, 1.2) * (sampleRate * 0.7);
        const currentCost = dist - pauseBonus;

        for (let p = k - 1; p < i; p++) {
          const gPrev = validGaps[p];
          if (gCurrent.mid >= gPrev.mid + minSpeechSamples) {
            const totalCost = dp[k - 1][p] + currentCost;
            if (totalCost < dp[k][i]) {
              dp[k][i] = totalCost;
              parent[k][i] = p;
            }
          }
        }
      }
    }

    // Find best ending index for boundary K - 1
    let bestEndIdx = -1;
    let minFinalCost = Infinity;
    for (let i = K - 1; i < validGaps.length; i++) {
      if (dp[K - 1][i] < minFinalCost) {
        minFinalCost = dp[K - 1][i];
        bestEndIdx = i;
      }
    }

    if (bestEndIdx !== -1) {
      splitIndices = new Array(K);
      let curr = bestEndIdx;
      for (let k = K - 1; k >= 0; k--) {
        splitIndices[k] = validGaps[curr].mid;
        curr = parent[k][curr];
      }
    }
  }

  // Fallback: If DP found fewer gaps than needed, fall back to sequential closest-gap search
  if (splitIndices.length < K) {
    splitIndices = [];
    let lastSplitSample = 0;
    for (let b = 0; b < expectedBoundaries.length; b++) {
      const target = expectedBoundaries[b];
      const remainingSegmentsAfter = expectedBoundaries.length - 1 - b;

      const candidateGaps = detectedGaps.filter(
        (g) =>
          g.mid > lastSplitSample + minSpeechSamples &&
          totalSamples - g.mid >= remainingSegmentsAfter * minSpeechSamples
      );

      if (candidateGaps.length > 0) {
        candidateGaps.sort((g1, g2) => Math.abs(g1.mid - target) - Math.abs(g2.mid - target));
        const chosenGap = candidateGaps[0];
        splitIndices.push(chosenGap.mid);
        lastSplitSample = chosenGap.mid;
      } else {
        splitIndices.push(target);
        lastSplitSample = target;
      }
    }
  }

  // 4. Slice into individual AudioBuffers for each dialogue line
  const segments: AudioBuffer[] = [];
  let startSample = 0;

  for (let s = 0; s < numSegments; s++) {
    const endSample = s < splitIndices.length ? splitIndices[s] : totalSamples;
    const segmentLength = Math.max(1, endSample - startSample);
    const segmentBuffer = ctx.createBuffer(numChannels, segmentLength, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const destData = segmentBuffer.getChannelData(c);
      destData.set(srcData.subarray(startSample, endSample));
    }

    segments.push(segmentBuffer);
    startSample = endSample;
  }

  return segments;
}

// Trigger browser download for Blob
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Build and trigger complete ZIP download package
export async function downloadProjectZip(
  screenplay: Screenplay,
  scenes: Scene[],
  manifestItems: AudioManifestItem[],
  masterBuffer?: AudioBuffer
): Promise<void> {
  const zip = new JSZip();
  const projectFolder = zip.folder(`Historical_Film_Voice_Studio_${screenplay.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`) || zip;

  // 1. Add Scenes folder
  const scenesFolder = projectFolder.folder('scenes');

  for (const scene of scenes) {
    if (scene.audioBase64) {
      const paddedNum = String(scene.sceneNumber).padStart(3, '0');
      const filename = `Scene_${paddedNum}.wav`;
      const arrayBuf = base64ToArrayBuffer(scene.audioBase64);
      scenesFolder?.file(filename, arrayBuf);
    }
  }

  // 2. Add individual dialogue line takes folder
  const linesFolder = projectFolder.folder('dialogue_lines');
  for (const scene of scenes) {
    const sceneNum = String(scene.sceneNumber).padStart(2, '0');
    scene.dialogueTurns.forEach((turn, idx) => {
      if (turn.audioBase64) {
        const lineNum = String(idx + 1).padStart(3, '0');
        const safeSpeaker = turn.speaker.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Scene_${sceneNum}_Line_${lineNum}_${safeSpeaker}.wav`;
        const arrayBuf = base64ToArrayBuffer(turn.audioBase64);
        linesFolder?.file(filename, arrayBuf);
      }
    });
  }

  // 3. Add Master Soundtrack if present
  if (masterBuffer) {
    const masterBlob = audioBufferToWavBlob(masterBuffer);
    const masterArrayBuf = await masterBlob.arrayBuffer();
    projectFolder.file('Master_Soundtrack.wav', masterArrayBuf);
  }

  // 3. Add manifest.json
  const manifestJson = JSON.stringify(
    {
      title: screenplay.title,
      period: screenplay.periodOrEra,
      generatedAt: new Date().toISOString(),
      scenesCount: scenes.length,
      manifest: manifestItems,
    },
    null,
    2
  );
  projectFolder.file('manifest.json', manifestJson);

  // 4. Add manifest.csv
  const csvRows = [
    ['Scene', 'Slug', 'Turn Index', 'Speaker', 'Voice Name', 'Emotion Style', 'Duration Sec', 'Spoken Text'],
    ...manifestItems.map((item) => [
      `Scene ${item.sceneNumber}`,
      `"${item.sceneSlug.replace(/"/g, '""')}"`,
      String(item.turnIndex + 1),
      `"${item.speaker.replace(/"/g, '""')}"`,
      item.voiceName,
      `"${item.emotion.replace(/"/g, '""')}"`,
      item.durationSeconds ? item.durationSeconds.toFixed(2) : '0',
      `"${item.dialogueText.replace(/"/g, '""')}"`,
    ]),
  ];
  const csvContent = csvRows.map((r) => r.join(',')).join('\n');
  projectFolder.file('manifest.csv', csvContent);

  // 5. Add Screenplay script.txt
  let screenplayScript = `TITLE: ${screenplay.title}\nERA: ${screenplay.periodOrEra}\n\n`;
  for (const s of scenes) {
    screenplayScript += `${s.slug}\n`;
    if (s.context) {
      screenplayScript += `${s.context}\n\n`;
    }
    for (const t of s.dialogueTurns) {
      screenplayScript += `${t.speaker} ${t.emotion ? `(${t.emotion})` : ''}\n${t.text}\n\n`;
    }
    screenplayScript += '\n';
  }
  projectFolder.file('screenplay_script.txt', screenplayScript);

  // Generate and download zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipName = `${screenplay.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audio_Master_Package.zip`;
  downloadBlob(zipBlob, zipName);
}
