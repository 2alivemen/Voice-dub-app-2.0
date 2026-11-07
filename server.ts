import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for exponential backoff retry on rate limits and transient network errors
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1500): Promise<T> {
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
          delayMs = Math.ceil(parseFloat(secMatch[1]) * 1000) + 750;
        }
      } else {
        const msgMatch = err?.message?.match(/Please retry in ([\d.]+)s/i);
        if (msgMatch) {
          delayMs = Math.ceil(parseFloat(msgMatch[1]) * 1000) + 750;
        }
      }

      // Cap delay to 32 seconds max
      if (delayMs > 32000) {
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

// Resilient TTS generation: uses gemini-3.8-flash-tts, gemini-2.5-flash, and fallback
async function generateTTSAudioWithFallback(
  ai: GoogleGenAI,
  contents: any,
  speechConfig: any,
  preferredModel = 'gemini-3.8-flash-tts'
): Promise<{ base64Audio: string; modelUsed: string }> {
  // Prioritize gemini-3.8-flash-tts (full audio model with higher quota) over lite-tts (which only has 10 req/day)
  const candidateModels = [
    preferredModel,
    'gemini-3.8-flash-tts',
    'gemini-2.5-flash',
    'gemini-3.8-flash-lite-tts',
  ];
  const modelsToTry = candidateModels.filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig,
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
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

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
      const isDailyLimit =
        err?.message?.includes('GenerateRequestsPerDay') ||
        err?.message?.includes('requests per day limit exceeded');
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      let errorMessage = err.message || 'Failed to synthesize audition take.';
      if (isDailyLimit) {
        errorMessage = 'Gemini API Daily Free Tier Quota Limit reached (50 requests/day).';
      } else if (isRateLimit) {
        const msgMatch = err?.message?.match(/Please retry in ([\d.]+)s/i);
        const sec = msgMatch ? Math.ceil(parseFloat(msgMatch[1])) : 20;
        errorMessage = `Gemini Free Tier rate limit reached (3 requests/min). Please wait ${sec}s before auditioning again.`;
      }

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
        err?.message?.includes('requests per day limit exceeded');
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('quota');

      let errorMessage = err.message || 'Gemini TTS synthesis failed.';
      if (isDailyLimit) {
        errorMessage = 'Gemini API Daily Free Tier Quota Limit reached (50 requests/day).';
      } else if (isRateLimit) {
        const msgMatch = err?.message?.match(/Please retry in ([\d.]+)s/i);
        const sec = msgMatch ? Math.ceil(parseFloat(msgMatch[1])) : 20;
        errorMessage = `Gemini Free Tier rate limit reached (3 requests/min). Please wait ${sec}s before generating the next line.`;
      }

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
