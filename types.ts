
export interface FrameData {
  id: string;
  pageIndex: number; // 0-based index of the image source
  notes: string[]; // Array of pitches, e.g., ["C4", "rest"]
  duration: number; // in beats, e.g., 1.0, 0.5
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (0-1000 scale)
}

export interface SheetAnalysisResult {
  tempo: number; // BPM
  frames: FrameData[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}
