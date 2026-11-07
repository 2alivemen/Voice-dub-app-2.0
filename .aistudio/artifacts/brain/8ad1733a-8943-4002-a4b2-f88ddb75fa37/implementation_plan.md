# Historical Film Voice Studio

A dedicated audio production and vocal mastering workstation for animated historical films, powered by Google's official Gemini Text-to-Speech API. Writers and sound directors can import screenplays, assign persistent voice personas, nuance dialogue turns with authentic historical stage directions, synthesize multi-speaker scenes, and export production-ready audio masters.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and workflow decisions were confirmed in Phase 1:

- **Screenplay Workspace Baseline**: Clean studio workspace with an instant "Load Historical Screenplay Template" action featuring a multi-speaker dramatic scene (e.g. Roman Senate or Royal Council) to immediately test synthesis.
- **Multi-Speaker Synthesis Strategy**: Sequential 2-speaker paired requests with calculated inter-turn room tone/silence gaps. When a scene contains 3+ speakers, requests are decomposed into contiguous or conversational 2-speaker batches, preserving chronological order, character voice assignments, and individual line re-generation capability.
- **Audio Delivery Format**: Comprehensive dual delivery:
  1. Individual downloadable scene WAV files (`Scene_001.wav`, `Scene_002.wav`, etc.)
  2. Full project ZIP archive containing all audio takes and a detailed screenplay manifest (`manifest.json` and `manifest.csv`)
  3. Seamless client-side combined soundtrack player and single-click master track export.

---

## 1. Overview & Core Concept

- **What It Does**: Parses standard screenplay formats (scene headings, character dialogue, parenthetical emotional directions, scene descriptions). Provides a dedicated Character Voice Casting desk where each historical figure is assigned a prebuilt Gemini TTS voice (`Puck`, `Charon`, `Kore`, `Fenrir`, `Zephyr`) and persistent delivery baseline. Sends turn-by-turn spoken lines to the official Gemini TTS API with genuine `speechMetadata` (speaker and emotional delivery styling) while strictly excluding non-spoken stage directions.
- **Target Audience / Persona**: Animators, indie historical filmmakers, game narrative designers, radio drama producers, and audio dramatists producing cinematic vocal tracks.
- **Key Value**: Replaces robotic single-tone speech with authentic, emotionally dynamic multi-speaker dialogue synthesis, honoring strict historical screenplay pacing without re-generating full scenes when adjusting single lines.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Screenplay Intake & Ingestion**:
   - The user pastes or uploads a screenplay (`.txt` or `.md`).
   - The engine automatically parses scene slugs (`INT./EXT.`), stage directions, characters, parentheticals, and dialogue lines.
   - Live editable screenplay view displays structured cards; users can tweak dialogue, emotions, or reorder lines.
2. **Casting & Voice Personas**:
   - A dedicated casting desk detects all active dramatis personae.
   - Directors assign Gemini prebuilt voices (`Fenrir`, `Kore`, `Puck`, `Charon`, `Zephyr`), base personality tags (e.g. *"Stately Victorian scholar with measured pacing"*, *"Stern Roman senator, low resonant register"*), and preview test utterances.
3. **Studio Recording & Multi-Speaker Batching**:
   - Scene Director view groups dialogue. For 2-speaker segments, native dual-speaker Gemini TTS synthesis is engaged (`gemini-3.8-flash-tts` with `multiSpeakerVoiceConfig`).
   - For scenes exceeding 2 speakers, the coordinator batches turns into sequential dual-speaker requests, maintaining consistent audio sample rate (24kHz mono 16-bit PCM/WAV).
   - Real-time progress bar tracks synthesis, retry attempts, and API quota status.
4. **Playback, Line-Level Re-recording & Mastering**:
   - Interactive waveform preview for each line and scene.
   - Individual line retry: if an actor's delivery needs adjustment, edit the emotional style and hit *"Re-record Line"* without touching the rest of the scene.
   - Download individual scene WAVs, complete ZIP package, or master stitched soundtrack.

### Visual Identity & Theme
- **Aesthetic Direction**: Vintage cinematic soundstage meets modern digital audio workstation (DAW). Deep slate and dark bronze finish reminiscent of high-end mixing consoles, analog VU meters, and celluloid film reels.
- **Color Palette**:
  - Background: Deep charcoal / Obsidian (`#0c0d10`, `#14161d`)
  - Console Surface: Muted slate (`#1b1e28`) with micro-borders (`#2d3244`)
  - Film Amber Accent: Warm gold/brass (`#e5a93c`, `#f3c46b`) for active playheads and recording cues
  - Signal Indicators: Studio emerald (`#10b981`) for completed takes, crimson (`#ef4444`) for active recording/errors, and soft sapphire (`#38bdf8`) for voice selection tags.
- **Typography & Hierarchy**:
  - Display & Headings: Stately editorial serif (`Cinzel` or `Playfair Display`) evoking historical cinema.
  - Interface & Controls: Clean structured sans (`Plus Jakarta Sans`) for controls, knobs, and parameter labels.
  - Script & Dialogue: Authentic typewriter monospaced script styling (`Courier Prime` / `JetBrains Mono`) for screenplay lines. Tabular figures for all audio timestamps and scene timecodes.

---

## 3. Key Product Decisions & Trade-Offs

- **Official Gemini TTS Model Selection**:
  - *Chosen Approach*: Use `gemini-3.8-flash-tts` for multi-speaker screenplay synthesis, emotional nuances, and stage pacing, with fallback to `gemini-3.8-flash-lite-tts` for single-speaker narration.
  - *Why*: As specified in the official SDK documentation, `gemini-3.8-flash-tts` natively supports `multiSpeakerVoiceConfig` (up to 2 speakers) and fine-grained `speechMetadata.style` per turn.
- **Strict Separation of Stage Directions & Dialogue**:
  - *Chosen Approach*: Parentheticals (e.g., `(whispering in terror)`, `[with calm authority]`) and scene action blocks are completely separated during parsing. Only genuine character dialogue is sent inside `part.text`, while emotional cues and base personalities are merged into `speechMetadata.style`.
  - *Why*: Ensures the voice model never speaks stage directions aloud or hallucinates bracketed text.
- **Multi-Speaker De-clustering for >2 Characters**:
  - *Chosen Approach*: When a scene has 3 or more characters speaking, the synthesis engine partitions the scene dialogue into contiguous conversational pairs, synthesizes each pair using Gemini's native dual-speaker engine, and seamlessly joins them with acoustic room silence.
  - *Why*: Respects Gemini API's strict 2-speaker ceiling per request while preserving chronological dialogue flow and multi-turn conversational chemistry.
- **Client-Side WAV Assembly & ZIP Packaging**:
  - *Chosen Approach*: Binary WAV stitching and ZIP packaging executed in-browser using standard Web Audio API buffers and lightweight in-memory zip creation.
  - *Why*: Zero server file storage leaks, instantaneous downloads, and reliable concatenation of 24kHz 16-bit mono PCM chunks.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Historical Film Voice Studio                     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────┐                         ┌──────────────────────┐
│ Screenplay Parser     │                         │ Casting Desk         │
│ - INT/EXT Header      │                         │ - Voice Assignment   │
│ - Stage Directions    │                         │   (Puck, Kore, etc.) │
│ - Spoken Dialogue     │                         │ - Base Personality   │
│ - Emotional Cues      │                         │ - Audition Player    │
└───────────────────────┘                         └──────────────────────┘
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Scene Director & Multi-Speaker Batch Coordinator                       │
│ - 2-Speaker Direct Multi-Speaker Pairing                               │
│ - N-Speaker Chronological Partitioning                                 │
│ - Turn-Level SpeechMetadata Assembly (Personality + Turn Emotion)      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                         HTTP POST /api/tts/synthesize
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Express Server-Side Proxy (`server.ts`)                                │
│ - GoogleGenAI SDK (`gemini-3.8-flash-tts`)                             │
│ - User-Agent telemetry: `aistudio-build`                               │
│ - Secure process.env.GEMINI_API_KEY handling                           │
│ - Request throttling, exponential backoff, detailed error propagation  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Web Audio Engine & Export Station                                      │
│ - Real-time Waveform Canvas & Audio Scrubbing                          │
│ - Per-line Re-recording & Audio Buffer Splicing                        │
│ - WAV Encoder (24kHz Mono 16-bit RIFF)                                 │
│ - Master Soundtrack Stitcher & ZIP Exporter (WAVs + Manifest JSON/CSV) │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Screenplay**:
  - `id`: string
  - `title`: string
  - `scenes`: Array of `Scene`
- **Scene**:
  - `id`: string, `sceneNumber`: number, `heading`: string (`EXT. ROMAN FORUM - DUSK`)
  - `context`: string (historical description, non-spoken)
  - `dialogueTurns`: Array of `DialogueTurn`
  - `audioTake`: `{ wavBase64?: string, duration?: number, status: 'idle'|'generating'|'ready'|'error' }`
- **DialogueTurn**:
  - `id`: string, `speaker`: string, `text`: string, `emotion`: string
  - `audioTake`: `{ wavBase64?: string, duration?: number, status: 'idle'|'generating'|'ready'|'error' }`
- **CharacterVoice**:
  - `speaker`: string, `voiceName`: `'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'`
  - `basePersonality`: string, `role`: string

### Interactive Handlers & Workflow
1. Screenplay file drag-and-drop or paste -> instant tokenized parser -> updates reactive scene tree.
2. Character auto-detection -> populates casting desk cards -> updates voice assignments.
3. Turn emotion selector with quick historical mood presets (Restrained Anger, Regal Authority, Melancholic Whisper, Battlefield Urgency, Cautious Conspiracy).
4. Scene Batch Generator -> sends chunked requests to `/api/tts/synthesize` -> updates audio takes.
5. Per-turn "Regenerate Take" -> calls single or dual-turn API -> replaces turn buffer and refreshes scene master audio.
6. Export Station -> generates sequential scene WAVs, project ZIP with manifest, and master audio track.
