import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for exponential backoff retry on rate limits and transient network errors
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;

      // Strict daily quota exhaustion check (cannot be solved by waiting seconds)
      const isDailyLimit =
        err?.message?.includes('GenerateRequestsPerDay') ||
        err?.message?.includes('requests per day limit exceeded') ||
        err?.message?.includes('PerDayPerProject');

      if (isDailyLimit) {
        throw err;
      }

      // Rate limit (429 / RESOURCE_EXHAUSTED / quota) or transient error (500/503)
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      const isTransient =
        isRateLimit ||
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.status === 500;

      if (attempt >= maxRetries || !isTransient) {
        throw err;
      }

      // Check if Google provided a retryDelay in errorDetails / details / message
      let delayMs = initialDelay * Math.pow(2, attempt - 1);

      const detailsList = err?.errorDetails || err?.details || [];
      const retryInfo = Array.isArray(detailsList)
        ? detailsList.find((d: any) => d?.retryDelay || d?.['@type']?.includes('RetryInfo'))
        : null;

      if (retryInfo?.retryDelay) {
        const secMatch = String(retryInfo.retryDelay).match(/([\d.]+)s?/);
        if (secMatch) {
          delayMs = Math.ceil(parseFloat(secMatch[1]) * 1000) + 1000;
        }
      } else {
        const msgMatch = err?.message?.match(/Please retry in ([\d.]+)s/i);
        if (msgMatch) {
          delayMs = Math.ceil(parseFloat(msgMatch[1]) * 1000) + 1000;
        }
      }

      // Cap delay to 45 seconds max
      if (delayMs > 45000) {
        throw err;
      }

      console.warn(
        `[Gemini TTS Rate Limit Retry] Attempt ${attempt}/${maxRetries}. Waiting ${Math.round(
          delayMs
        )}ms before retry...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Helper to format clean, accurate rate limit and quota error messages
function formatQuotaErrorMessage(err: any): string {
  const isDailyLimit =
    err?.message?.includes('GenerateRequestsPerDay') ||
    err?.message?.includes('requests per day limit exceeded') ||
    err?.message?.includes('PerDayPerProject');

  // Parse exact retry delay if provided by Google API
  let retryTimeStr = '';
  const detailsList = err?.errorDetails || err?.details || [];
  const retryInfo = Array.isArray(detailsList)
    ? detailsList.find((d: any) => d?.retryDelay || d?.['@type']?.includes('RetryInfo'))
    : null;

  if (retryInfo?.retryDelay) {
    const sec = parseFloat(String(retryInfo.retryDelay).replace('s', ''));
    if (!isNaN(sec)) {
      if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        retryTimeStr = `${h}h ${m}m`;
      } else if (sec >= 60) {
        retryTimeStr = `${Math.ceil(sec / 60)} minutes`;
      } else {
        retryTimeStr = `${Math.ceil(sec)} seconds`;
      }
    }
  }

  if (!retryTimeStr) {
    const rawMatch = err?.message?.match(/Please retry in ([\d.]+)([a-z]+)?/i);
    if (rawMatch) {
      const num = parseFloat(rawMatch[1]);
      const unit = rawMatch[2] || 's';
      if (!isNaN(num)) {
        if (num >= 3600 || unit === 'h') {
          const totalSec = unit === 'h' ? num * 3600 : num;
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          retryTimeStr = `${h}h ${m}m`;
        } else if (num >= 60 || unit === 'm') {
          const totalSec = unit === 'm' ? num * 60 : num;
          retryTimeStr = `${Math.ceil(totalSec / 60)} minutes`;
        } else {
          retryTimeStr = `${Math.ceil(num)} seconds`;
        }
      } else {
        retryTimeStr = rawMatch[1].replace(/\.\d+s?$/, 's');
      }
    }
  }

  if (isDailyLimit) {
    const retryNote = retryTimeStr ? ` Resets in ~${retryTimeStr} (at midnight UTC).` : ' Quota resets daily at midnight UTC.';
    return `Gemini Free Tier daily quota limit reached (10 requests/day per project).${retryNote} Upgrade to a paid plan or provide a custom Gemini API key with billing enabled to continue.`;
  }

  const isRateLimit =
    err?.status === 429 ||
    err?.message?.includes('429') ||
    err?.message?.includes('RESOURCE_EXHAUSTED') ||
    err?.message?.includes('quota');

  if (isRateLimit) {
    const secNote = retryTimeStr || '20s';
    return `Gemini Free Tier short-term rate limit reached. Please wait ${secNote} before generating audio again.`;
  }

  return err?.message || 'Gemini TTS synthesis encountered an unexpected error.';
}

// Resilient TTS generation: uses gemini-3.8-flash-tts, gemini-3.8-flash-lite-tts, and gemini-2.5-flash-preview-tts
async function generateTTSAudioWithFallback(
  ai: GoogleGenAI,
  contents: any,
  speechConfig: any,
  preferredModel = 'gemini-3.8-flash-tts'
): Promise<{ base64Audio: string; modelUsed: string }> {
  // Use valid active TTS models only (gemini-2.5-flash is retired/404)
  const candidateModels = [
    preferredModel,
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash-lite-tts',
    'gemini-2.5-flash-preview-tts',
  ];
  const modelsToTry = candidateModels.filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      let callContents = contents;
      let callSpeechConfig = speechConfig;

      // gemini-2.5-flash-preview-tts requires clear TTS instructions and doesn't accept multiSpeakerVoiceConfig
      if (model.includes('preview-tts')) {
        // Strip speechMetadata if present and ensure prompt tells model to read aloud
        if (Array.isArray(contents)) {
          callContents = contents.map((c: any) => {
            if (c.parts && Array.isArray(c.parts)) {
              return {
                ...c,
                parts: c.parts.map((p: any) => {
                  const rawText = p.text || '';
                  const prefix = rawText.startsWith('Please read') ? '' : 'Please read aloud with dramatic clarity: ';
                  return { text: `${prefix}${rawText}` };
                }),
              };
            }
            return c;
          });
        }

        // If multiSpeakerVoiceConfig was passed, preview-tts only supports single voiceConfig
        if (speechConfig?.multiSpeakerVoiceConfig) {
          const firstSpeaker = speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs?.[0];
          callSpeechConfig = {
            voiceConfig: firstSpeaker?.voiceConfig || { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          };
        }
      }

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model,
          contents: callContents,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: callSpeechConfig,
          },
        })
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return { base64Audio, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini TTS] Model ${model} encountered an issue (${err.message?.slice(0, 120)}). Trying fallback model...`);
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const portArg = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
  // Dev server must always bind to port 3000 (port 8080 is occupied by nginx reverse proxy)
  const PORT = !isNaN(portArg) ? portArg : 3000;

  app.use(express.json({ limit: '50mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY is not set in environment. Gemini TTS synthesis calls will return an informative error until configured.');
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health & Capabilities Endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      service: 'Historical Film Voice Studio Backend',
      supportedVoices: ['Fenrir', 'Charon', 'Kore', 'Aoede', 'Orus', 'Puck', 'Zephyr', 'Leda'],
      models: {
        primary: 'gemini-3.8-flash-lite-tts',
        flagship: 'gemini-3.8-flash-tts',
      },
      features: {
        multiSpeakerLimit: 2,
        outputFormat: 'audio/wav',
        sampleRate: 24000,
        bitDepth: 16,
      },
    });
  });

  // Audition voice endpoint
  app.post('/api/tts/audition', async (req: Request, res: Response): Promise<void> => {
    try {
      const apiKey = (req.headers['x-gemini-api-key'] as string)?.trim() || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(401).json({ error: 'GEMINI_API_KEY is missing. Please configure it in the Secrets panel.' });
        return;
      }
      const activeAi =
        apiKey === process.env.GEMINI_API_KEY
          ? ai
          : new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

      const { voiceName, personality, previewText } = req.body;
      const validVoices = ['Fenrir', 'Charon', 'Kore', 'Aoede', 'Orus', 'Puck', 'Zephyr', 'Leda'];
      // Accept any matching prebuilt voice (case-insensitive) or any valid alphanumeric voice name
      const matchedPrebuilt = validVoices.find((v) => v.toLowerCase() === (voiceName || '').toString().toLowerCase());
      const selectedVoice = matchedPrebuilt || (voiceName && /^[A-Za-z0-9_-]{2,30}$/.test(voiceName) ? voiceName : 'Fenrir');
      const textToSpeak = previewText || `This is ${selectedVoice}, performing historical dramatic dialogue.`;
      const styleInstruction = personality
        ? `Historical dramatic performance. ${personality}`
        : 'Historical dramatic performance. Measured, cinematic clarity.';

      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: textToSpeak,
              speechMetadata: {
                style: styleInstruction,
              },
            },
          ],
        },
      ];

      const speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: selectedVoice },
        },
      };

      const { base64Audio, modelUsed } = await generateTTSAudioWithFallback(
        activeAi,
        contents,
        speechConfig,
        'gemini-3.8-flash-tts'
      );

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName: selectedVoice,
        modelUsed,
      });
    } catch (err: any) {
      console.error('[Audition Error]', err);
      const errorMessage = formatQuotaErrorMessage(err);
      res.status(err?.status || 500).json({
        error: errorMessage,
        status: err?.status,
      });
    }
  });

  // Core Multi-Speaker and Single-Speaker Synthesis Endpoint
  app.post('/api/tts/synthesize', async (req: Request, res: Response): Promise<void> => {
    try {
      const apiKey = (req.headers['x-gemini-api-key'] as string)?.trim() || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(401).json({ error: 'GEMINI_API_KEY is missing. Please configure it in the Secrets panel.' });
        return;
      }
      const activeAi =
        apiKey === process.env.GEMINI_API_KEY
          ? ai
          : new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

      const { turns, voiceAssignments, preferredModel } = req.body as {
        turns: Array<{
          id: string;
          speaker: string;
          text: string;
          emotion?: string;
          vocalizeSpeakerName?: boolean;
        }>;
        voiceAssignments: Record<string, {
          voiceName: 'Fenrir' | 'Charon' | 'Kore' | 'Aoede' | 'Orus' | 'Puck' | 'Zephyr' | 'Leda' | string;
          basePersonality?: string;
        }>;
        preferredModel?: string;
      };

      if (!turns || !Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ error: 'At least one dialogue turn is required.' });
        return;
      }

      // Collect unique speakers in this batch
      const uniqueSpeakers = Array.from(new Set(turns.map((t) => t.speaker.trim())));

      if (uniqueSpeakers.length > 2) {
        res.status(400).json({
          error: `Gemini multi-speaker TTS supports at most 2 speakers per request (received ${uniqueSpeakers.length}: ${uniqueSpeakers.join(', ')}). The client must partition batches.`,
        });
        return;
      }

      let speechConfig: any;
      let contents: any;

      if (uniqueSpeakers.length === 1) {
        // Single speaker configuration
        const speaker = uniqueSpeakers[0];
        const speakerConfig = voiceAssignments?.[speaker] || { voiceName: 'Fenrir', basePersonality: 'Cinematic narrator' };
        const voiceName = speakerConfig.voiceName || 'Fenrir';

        speechConfig = {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        };

        contents = [
          {
            role: 'user',
            parts: turns.map((turn) => {
              const combinedStyle = [
                speakerConfig.basePersonality,
                turn.emotion ? `Delivery: ${turn.emotion}` : undefined,
              ].filter(Boolean).join('. ');

              const spokenText = turn.vocalizeSpeakerName
                ? `${turn.speaker}: ${turn.text.trim()}`
                : turn.text.trim();

              return {
                text: spokenText,
                speechMetadata: {
                  style: combinedStyle || 'Measured cinematic delivery',
                },
              };
            }),
          },
        ];
      } else {
        // Exactly two speakers: official dual-speaker multiSpeakerVoiceConfig
        const [speakerA, speakerB] = uniqueSpeakers;
        const configA = voiceAssignments?.[speakerA] || { voiceName: 'Fenrir', basePersonality: 'Dramatic historical voice' };
        const configB = voiceAssignments?.[speakerB] || { voiceName: 'Kore', basePersonality: 'Dramatic historical voice' };

        const voiceA = configA.voiceName || 'Fenrir';
        const voiceB = configB.voiceName || 'Kore';

        speechConfig = {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speakerA,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceA },
                },
              },
              {
                speaker: speakerB,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceB },
                },
              },
            ],
          },
        };

        contents = [
          {
            role: 'user',
            parts: turns.map((turn) => {
              const isSpeakerA = turn.speaker.trim().toLowerCase() === speakerA.toLowerCase();
              const activeSpeaker = isSpeakerA ? speakerA : speakerB;
              const activeConfig = isSpeakerA ? configA : configB;

              const combinedStyle = [
                activeConfig.basePersonality,
                turn.emotion ? `Delivery: ${turn.emotion}` : undefined,
              ].filter(Boolean).join('. ');

              const spokenText = turn.vocalizeSpeakerName
                ? `${activeSpeaker}: ${turn.text.trim()}`
                : turn.text.trim();

              return {
                text: spokenText,
                speechMetadata: {
                  speaker: activeSpeaker,
                  style: combinedStyle || 'Measured cinematic delivery',
                },
              };
            }),
          },
        ];
      }

      const { base64Audio, modelUsed } = await generateTTSAudioWithFallback(
        activeAi,
        contents,
        speechConfig,
        preferredModel || 'gemini-3.8-flash-tts'
      );

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        speakers: uniqueSpeakers,
        turnIds: turns.map((t) => t.id),
        modelUsed,
      });
    } catch (err: any) {
      console.error('[Synthesize Error]', err);
      const isDailyLimit =
        err?.message?.includes('GenerateRequestsPerDay') ||
        err?.message?.includes('requests per day limit exceeded') ||
        err?.message?.includes('PerDayPerProject');
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      const errorMessage = formatQuotaErrorMessage(err);

      res.status(err?.status || 500).json({
        error: errorMessage,
        code: isDailyLimit || isRateLimit ? 'RATE_LIMIT' : 'TTS_ERROR',
        status: err?.status,
      });
    }
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Historical Film Voice Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
