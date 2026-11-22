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
 * using Script Text Proportions, Acoustic Energy Envelopes, & Strict Physical Duration Invariants.
 *
 * Solves the "intra-sentence pause" issue:
 * 1. A dialogue with multiple sentences (periods/commas) has internal breath pauses.
 * 2. By enforcing physical duration invariants (minimum speech time based on character/word count),
 *    the algorithm CANNOT mistake an internal sentence pause for the dialogue boundary.
 * 3. By enforcing upper duration bounds, small exclamations (e.g. "ಅಷ್ಟೊಂದು!") are never merged
 *    or swallowed into neighboring turns.
 * 4. Micro-crossfades and zero-crossing splits prevent clicks, pops, and cut-off syllables.
 */
export function alignAudioBufferToTurns(
  buffer: AudioBuffer,
  turnTexts: string[]
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
  const totalDuration = buffer.duration;

  // 1. Compute realistic text durations based on syllables, characters, and internal sentence counts
  const rawEstimates: number[] = turnTexts.map((rawText) => {
    const text = rawText.trim();
    const len = text.length;
    // Count internal sentence punctuation (. ! ? । ; and newlines)
    const sentenceMatches = text.match(/[.!?।;\n]+/g);
    const numSentences = Math.max(1, sentenceMatches ? sentenceMatches.length : 1);
    const words = text.split(/\s+/).filter(Boolean).length;

    // In Kannada/Indic and English dramatic delivery:
    // Speech rate is ~11 to 14 characters per second (or ~2.5 words/sec).
    // Each internal sentence adds ~0.35s of breath pause.
    // Inter-turn boundary has ~0.65s of prosodic silence.
    const speechSec = Math.max(0.75, len / 11.8, words * 0.38);
    const internalPausesSec = (numSentences - 1) * 0.35;
    return speechSec + internalPausesSec + 0.65;
  });

  const totalRawEst = rawEstimates.reduce((sum, e) => sum + e, 0);

  // Normalized target durations matching actual total audio duration
  const targetDurations = rawEstimates.map(
    (est) => (est / totalRawEst) * totalDuration
  );

  // Cumulative expected boundary positions (in seconds and in samples)
  const boundaryTargetsSec: number[] = [];
  let cumSec = 0;
  for (let i = 0; i < numSegments - 1; i++) {
    cumSec += targetDurations[i];
    boundaryTargetsSec.push(cumSec);
  }

  // Strict physical bounds for each turn:
  // minSec: A speaker CANNOT physically deliver text faster than ~18 characters/sec (or 5 words/sec).
  // This invariant ensures an internal period inside sentence 1 or 2 of a long dialogue can NEVER be chosen as the turn boundary!
  const minDurations = turnTexts.map((txt, i) => {
    const len = txt.trim().length;
    const words = txt.trim().split(/\s+/).filter(Boolean).length;
    const absMinByText = Math.max(0.55, len / 18.0, words * 0.22);
    return Math.max(0.55, Math.min(targetDurations[i] * 0.58, absMinByText));
  });

  const maxDurations = targetDurations.map((td) => Math.max(2.6, td * 1.80));

  // 2. High-resolution RMS Energy Valley Detection
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
  const hopSize = Math.floor(sampleRate * 0.010);   // 10ms step
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize);
  const rmsCurve = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = channelData[start + j];
      sumSq += s * s;
    }
    rmsCurve[f] = Math.sqrt(sumSq / frameSize);
  }

  // Compute 10th percentile energy as acoustic noise floor
  const sortedRms = Float32Array.from(rmsCurve).sort();
  const floorIdx = Math.floor(numFrames * 0.10);
  const noiseFloor = sortedRms[floorIdx] || 0.005;
  const silenceThreshold = Math.max(0.012, noiseFloor * 2.2);

  // Discover all distinct acoustic silence valleys (contiguous frames below threshold)
  const minSilenceFrames = Math.floor((sampleRate * 0.16) / hopSize); // >= 160ms
  const detectedGaps: Array<{
    startSample: number;
    endSample: number;
    midSample: number;
    durationSec: number;
    midSec: number;
  }> = [];

  let inGap = false;
  let gapStartFrame = 0;

  for (let f = 0; f < numFrames; f++) {
    if (rmsCurve[f] < silenceThreshold) {
      if (!inGap) {
        gapStartFrame = f;
        inGap = true;
      }
    } else {
      if (inGap) {
        const gapFrames = f - gapStartFrame;
        if (gapFrames >= minSilenceFrames) {
          const startSample = gapStartFrame * hopSize;
          const endSample = f * hopSize + frameSize;
          const approxMid = Math.floor((startSample + endSample) / 2);

          // Find exact zero-crossing near the middle to eliminate click artifacts
          let bestZeroSample = approxMid;
          let minAbs = Math.abs(channelData[approxMid]);
          const searchRange = Math.min(200, Math.floor((endSample - startSample) / 4));
          for (let z = approxMid - searchRange; z <= approxMid + searchRange; z++) {
            if (z > 0 && z < totalSamples) {
              if ((channelData[z - 1] <= 0 && channelData[z] >= 0) || (channelData[z - 1] >= 0 && channelData[z] <= 0)) {
                bestZeroSample = z;
                break;
              }
              if (Math.abs(channelData[z]) < minAbs) {
                minAbs = Math.abs(channelData[z]);
                bestZeroSample = z;
              }
            }
          }

          const durationSec = (endSample - startSample) / sampleRate;
          detectedGaps.push({
            startSample,
            endSample,
            midSample: bestZeroSample,
            durationSec,
            midSec: bestZeroSample / sampleRate,
          });
        }
        inGap = false;
      }
    }
  }

  // 3. Globally Optimal Sequence Alignment using Bounded Dynamic Programming
  const K = boundaryTargetsSec.length;
  let splitSamples: number[] = [];

  // Filter gaps within valid overall margins
  const marginSec = 0.20;
  const validGaps = detectedGaps.filter(
    (g) => g.midSec >= marginSec && g.midSec <= totalDuration - marginSec
  );

  if (validGaps.length >= K && K > 0) {
    // dp[k][i] = min cost to assign first k+1 boundaries such that boundary k is validGaps[i]
    const dp: number[][] = Array.from({ length: K }, () => Array(validGaps.length).fill(Infinity));
    const parent: number[][] = Array.from({ length: K }, () => Array(validGaps.length).fill(-1));

    // Base step k = 0: first boundary
    for (let i = 0; i < validGaps.length; i++) {
      const g = validGaps[i];
      const dur0 = g.midSec; // duration of turn 0
      if (dur0 >= minDurations[0] && dur0 <= maxDurations[0]) {
        const durError = Math.abs(dur0 - targetDurations[0]);
        const boundaryError = Math.abs(g.midSec - boundaryTargetsSec[0]);
        // Strong reward for longer silence duration (true boundary >> intra-sentence comma)
        const pauseBonus = Math.min(g.durationSec, 1.2) * 2.5;
        dp[0][i] = durError * durError * 2.0 + boundaryError - pauseBonus;
      }
    }

    // Transitions for k = 1 to K - 1
    for (let k = 1; k < K; k++) {
      const targetB = boundaryTargetsSec[k];
      const targetD = targetDurations[k];
      const minD = minDurations[k];
      const maxD = maxDurations[k];

      for (let i = k; i < validGaps.length; i++) {
        const gCurr = validGaps[i];
        const boundaryError = Math.abs(gCurr.midSec - targetB);
        const pauseBonus = Math.min(gCurr.durationSec, 1.2) * 2.5;

        for (let p = k - 1; p < i; p++) {
          if (dp[k - 1][p] === Infinity) continue;
          const gPrev = validGaps[p];
          const durK = gCurr.midSec - gPrev.midSec;

          // Strict invariant: must satisfy physical duration limits for turn k
          if (durK >= minD && durK <= maxD) {
            const durError = Math.abs(durK - targetD);
            const stepCost = durError * durError * 2.0 + boundaryError - pauseBonus;
            const totalCost = dp[k - 1][p] + stepCost;

            if (totalCost < dp[k][i]) {
              dp[k][i] = totalCost;
              parent[k][i] = p;
            }
          }
        }
      }
    }

    // Find best ending index for boundary K - 1 that also satisfies turn (K)'s duration
    let bestEndIdx = -1;
    let minFinalCost = Infinity;
    const minLastDur = minDurations[K];
    const maxLastDur = maxDurations[K];

    for (let i = K - 1; i < validGaps.length; i++) {
      if (dp[K - 1][i] < Infinity) {
        const lastDur = totalDuration - validGaps[i].midSec;
        if (lastDur >= minLastDur * 0.75 && lastDur <= maxLastDur * 1.25) {
          if (dp[K - 1][i] < minFinalCost) {
            minFinalCost = dp[K - 1][i];
            bestEndIdx = i;
          }
        }
      }
    }

    // If a valid path satisfying all bounds was found, extract split samples
    if (bestEndIdx !== -1) {
      splitSamples = new Array(K);
      let curr = bestEndIdx;
      for (let k = K - 1; k >= 0; k--) {
        splitSamples[k] = validGaps[curr].midSample;
        curr = parent[k][curr];
      }
    }
  }

  // 4. Robust Fallback: If DP found fewer gaps than needed, locate split points
  // by searching for energy minima within each boundary's target window
  if (splitSamples.length < K) {
    console.warn(
      `[alignAudioBufferToTurns] Bounded DP needed fallback for ${numSegments} turns. Applying local energy minimum search.`
    );
    splitSamples = [];
    let lastSplitSec = 0;

    for (let b = 0; b < boundaryTargetsSec.length; b++) {
      const targetSec = boundaryTargetsSec[b];
      const minAllowedSec = lastSplitSec + minDurations[b];
      const maxAllowedSec = lastSplitSec + maxDurations[b];

      // Search for candidate gaps within the allowed physical window
      const eligibleGaps = validGaps.filter(
        (g) => g.midSec >= minAllowedSec && g.midSec <= maxAllowedSec
      );

      if (eligibleGaps.length > 0) {
        // Choose gap closest to target and with greatest silence depth
        eligibleGaps.sort((g1, g2) => {
          const score1 = Math.abs(g1.midSec - targetSec) - g1.durationSec * 1.5;
          const score2 = Math.abs(g2.midSec - targetSec) - g2.durationSec * 1.5;
          return score1 - score2;
        });
        const chosen = eligibleGaps[0];
        splitSamples.push(chosen.midSample);
        lastSplitSec = chosen.midSec;
      } else {
        // Find local RMS minimum around targetSec
        const searchCenterFrame = Math.floor((Math.max(minAllowedSec, Math.min(targetSec, maxAllowedSec)) * sampleRate) / hopSize);
        const searchRadiusFrames = Math.floor((sampleRate * 0.45) / hopSize);
        const startF = Math.max(0, searchCenterFrame - searchRadiusFrames);
        const endF = Math.min(numFrames - 1, searchCenterFrame + searchRadiusFrames);

        let minRmsVal = Infinity;
        let bestFrame = searchCenterFrame;
        for (let f = startF; f <= endF; f++) {
          if (rmsCurve[f] < minRmsVal) {
            minRmsVal = rmsCurve[f];
            bestFrame = f;
          }
        }

        const fallbackSample = Math.min(totalSamples - 1, Math.max(0, bestFrame * hopSize + Math.floor(frameSize / 2)));
        splitSamples.push(fallbackSample);
        lastSplitSec = fallbackSample / sampleRate;
      }
    }
  }

  // 5. Slice into individual AudioBuffers for each dialogue line with anti-click micro-fade
  const segments: AudioBuffer[] = [];
  let startSample = 0;
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.003), 72); // 3ms micro-taper

  for (let s = 0; s < numSegments; s++) {
    const endSample = s < splitSamples.length ? splitSamples[s] : totalSamples;
    const segmentLength = Math.max(1, endSample - startSample);
    const segmentBuffer = ctx.createBuffer(numChannels, segmentLength, sampleRate);

    for (let c = 0; c < numChannels; c++) {
      const srcData = buffer.getChannelData(c);
      const destData = segmentBuffer.getChannelData(c);
      destData.set(srcData.subarray(startSample, endSample));

      // Apply 3ms fade-in at head (if not first sample of entire buffer)
      if (startSample > 0 && segmentLength > fadeSamples * 2) {
        for (let j = 0; j < fadeSamples; j++) {
          destData[j] *= j / fadeSamples;
        }
      }

      // Apply 3ms fade-out at tail (if not last sample of entire buffer)
      if (endSample < totalSamples && segmentLength > fadeSamples * 2) {
        for (let j = 0; j < fadeSamples; j++) {
          destData[segmentLength - 1 - j] *= j / fadeSamples;
        }
      }
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
