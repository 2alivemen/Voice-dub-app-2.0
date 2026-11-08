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
  minSilenceSec = 0.2,
  amplitudeThreshold = 0.04
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

  // 1. Compute script text length proportions
  const textWeights = turnTexts.map((txt) => Math.max(12, txt.trim().length));
  const totalWeight = textWeights.reduce((acc, w) => acc + w, 0);

  // Cumulative expected boundary ratios
  const expectedBoundarySamples: number[] = [];
  let currentCum = 0;
  for (let i = 0; i < numSegments - 1; i++) {
    currentCum += textWeights[i];
    const ratio = currentCum / totalWeight;
    expectedBoundarySamples.push(Math.floor(ratio * totalSamples));
  }

  // 2. Search for the optimal silence/low-energy split point around each expected boundary
  const splitIndices: number[] = [];
  const minSilenceSamples = Math.floor(sampleRate * minSilenceSec);

  // Average segment length in samples
  const avgSegmentSamples = Math.floor(totalSamples / numSegments);
  const searchTolerance = Math.floor(avgSegmentSamples * 0.35); // search within +/- 35% of an average line

  for (let b = 0; b < expectedBoundarySamples.length; b++) {
    const centerSample = expectedBoundarySamples[b];
    const prevBound = b === 0 ? 0 : splitIndices[b - 1];
    const minSearch = Math.max(prevBound + Math.floor(sampleRate * 0.25), centerSample - searchTolerance);
    const maxSearch = Math.min(totalSamples - Math.floor(sampleRate * 0.25), centerSample + searchTolerance);

    // Locate silence regions within the constrained search window
    let bestSplit = centerSample;
    let foundSilence = false;
    let maxSilenceDuration = 0;

    let inSilence = false;
    let silenceStart = minSearch;

    for (let i = minSearch; i < maxSearch; i++) {
      const isSilent = Math.abs(channelData[i]) < amplitudeThreshold;
      if (isSilent) {
        if (!inSilence) {
          silenceStart = i;
          inSilence = true;
        }
      } else {
        if (inSilence) {
          const duration = i - silenceStart;
          if (duration >= minSilenceSamples && duration > maxSilenceDuration) {
            maxSilenceDuration = duration;
            bestSplit = Math.floor(silenceStart + duration / 2);
            foundSilence = true;
          }
          inSilence = false;
        }
      }
    }

    // If no distinct silence region was found, find the point of minimum root-mean-square amplitude in window
    if (!foundSilence) {
      const step = Math.floor(sampleRate * 0.02); // 20ms steps
      let minRms = Infinity;
      let minRmsSample = centerSample;

      for (let s = minSearch; s < maxSearch - step; s += step) {
        let sumSquare = 0;
        for (let k = 0; k < step; k++) {
          const val = channelData[s + k];
          sumSquare += val * val;
        }
        const rms = Math.sqrt(sumSquare / step);
        if (rms < minRms) {
          minRms = rms;
          minRmsSample = s + Math.floor(step / 2);
        }
      }
      bestSplit = minRmsSample;
    }

    splitIndices.push(bestSplit);
  }

  // 3. Slice into individual AudioBuffers
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
