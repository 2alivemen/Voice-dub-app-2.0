export type GeminiPrebuiltVoice =
  | 'Fenrir'
  | 'Charon'
  | 'Kore'
  | 'Aoede'
  | 'Orus'
  | 'Puck'
  | 'Zephyr'
  | 'Leda'
  | (string & {});

export interface DialogueTurn {
  id: string;
  speaker: string;
  text: string;
  emotion: string; // e.g. "restrained anger", "whispering in suspense", "solemn authority"
  vocalizeSpeakerName?: boolean; // If true, speaks "SPEAKER: Dialogue", if false (default), speaks dialogue only
  audioBase64?: string;
  duration?: number; // duration in seconds
  status: 'idle' | 'generating' | 'ready' | 'error';
  error?: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  slug: string; // e.g. "INT. SENATE CHAMBER - NIGHT"
  context: string; // Non-spoken historical stage & atmosphere description
  dialogueTurns: DialogueTurn[];
  audioBase64?: string;
  duration?: number;
  status: 'idle' | 'generating' | 'ready' | 'error';
  error?: string;
}

export interface CharacterVoice {
  id: string;
  name: string;
  voiceName: GeminiPrebuiltVoice;
  basePersonality: string;
  color: string;
  roleDescription?: string;
  assignmentSource?: string; // e.g. "Script Voice Tag", "Detected from Style (Female)", "Historical Archetype (Emperor)"
  auditionAudioBase64?: string;
  isAuditioning?: boolean;
}

export interface Screenplay {
  id: string;
  title: string;
  periodOrEra: string;
  authorOrAttribution?: string;
  scenes: Scene[];
}

export interface GenerationProgress {
  isGenerating: boolean;
  totalBatches: number;
  completedBatches: number;
  currentMessage: string;
  error?: string;
}

export interface AudioManifestItem {
  sceneNumber: number;
  sceneSlug: string;
  turnIndex: number;
  speaker: string;
  voiceName: string;
  emotion: string;
  dialogueText: string;
  durationSeconds?: number;
  audioFile: string;
}
