
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, SkipForward, SkipBack } from 'lucide-react';
import { SheetAnalysisResult } from '../types';

interface MusicPlayerProps {
  imageSrcs: string[]; // Array of base64 strings
  data: SheetAnalysisResult;
  onReset: () => void;
}

// Polyphonic Audio Engine
class AudioEngine {
  ctx: AudioContext | null = null;
  gainNode: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.gain.value = 0.3; // Master Volume
    }
  }

  resume = () => {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  };

  playTone = (pitch: string, durationSec: number, startTime: number) => {
    if (!this.ctx || !this.gainNode) return;
    if (pitch.toLowerCase().includes('rest')) return;

    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const regex = /^([a-zA-Z#]+)(\d+)$/;
    const match = pitch.match(regex);
    
    let frequency = 440;
    
    if (match) {
      const note = match[1].toUpperCase();
      const octave = parseInt(match[2]);
      const semitoneIndex = notes.indexOf(note);
      if (semitoneIndex !== -1) {
        const noteMidi = (octave + 1) * 12 + semitoneIndex;
        frequency = 440 * Math.pow(2, (noteMidi - 69) / 12);
      }
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; // Richer sound
    osc.frequency.setValueAtTime(frequency, startTime);
    
    // Improved Envelope for clear articulation
    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    
    // Quick attack
    noteGain.gain.linearRampToValueAtTime(0.5, startTime + 0.02); 
    // Sustain for most of the duration
    noteGain.gain.setValueAtTime(0.4, startTime + Math.max(0.05, durationSec * 0.8));
    // Quick release at the end
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);
    
    osc.connect(noteGain);
    noteGain.connect(this.gainNode);
    
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.1);
  };

  playChord = (pitches: string[], durationSec: number) => {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Slight humanization could be added here, but exact sync is better for reading
    pitches.forEach(pitch => this.playTone(pitch, durationSec, now));
  };
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ imageSrcs, data, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioEngine = useRef<AudioEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Store multiple images
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Audio & Preload Images
  useEffect(() => {
    audioEngine.current = new AudioEngine();
    
    // Preload all images
    imagesRef.current = [];
    imageSrcs.forEach(src => {
      const img = new Image();
      img.src = src;
      imagesRef.current.push(img);
    });

    // Wait for the first image to load to draw initial frame
    const firstImg = imagesRef.current[0];
    if (firstImg) {
      firstImg.onload = () => drawFrame(0);
      // In case it's already cached
      if (firstImg.complete) drawFrame(0);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrcs]);

  // Handle Canvas Drawing (Cropping & Highlighting)
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const frame = data.frames[index];

    if (!canvas || !frame) return;

    // Select the correct image based on pageIndex
    const imgIndex = frame.pageIndex || 0; 
    const img = imagesRef.current[imgIndex];

    if (!img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Get Context Coordinates (The large crop)
    const [c_ymin, c_xmin, c_ymax, c_xmax] = frame.box_2d;

    const srcX = (c_xmin / 1000) * img.naturalWidth;
    const srcY = (c_ymin / 1000) * img.naturalHeight;
    const srcW = ((c_xmax - c_xmin) / 1000) * img.naturalWidth;
    const srcH = ((c_ymax - c_ymin) / 1000) * img.naturalHeight;

    // 2. Set Canvas Size
    // We want a fixed viewing height but dynamic width to maintain aspect ratio
    // Since we are requesting wider crops (2 measures), we allow the canvas to be wider
    const displayHeight = 400; 
    const aspectRatio = srcW / srcH;
    const displayWidth = displayHeight * aspectRatio;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // 3. Draw The Sheet Music Context
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the main crop
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

    // 4. Draw Note Highlights
    if (frame.note_coordinates && frame.note_coordinates.length > 0) {
      
      // Use high contrast amber/gold for visibility
      ctx.fillStyle = 'rgba(251, 191, 36, 0.45)'; // Amber 400 with opacity
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'; // Amber 500 solid border
      ctx.lineWidth = 2.5;

      frame.note_coordinates.forEach(noteBox => {
        const [n_ymin, n_xmin, n_ymax, n_xmax] = noteBox;

        // Calculate relative position within the crop
        const relX = (n_xmin - c_xmin) / (c_xmax - c_xmin); 
        const drawX = relX * displayWidth;

        const relY = (n_ymin - c_ymin) / (c_ymax - c_ymin);
        const drawY = relY * displayHeight;

        const relW = (n_xmax - n_xmin) / (c_xmax - c_xmin);
        const drawW = relW * displayWidth;

        const relH = (n_ymax - n_ymin) / (c_ymax - c_ymin);
        const drawH = relH * displayHeight;

        // Draw highlight
        ctx.beginPath();
        const padding = 2;
        // Ensure rounded rect radius doesn't exceed dimensions
        const r = Math.min(4, drawW/2, drawH/2);
        ctx.roundRect(drawX - padding, drawY - padding, Math.max(1, drawW + (padding*2)), Math.max(1, drawH + (padding*2)), r);
        ctx.fill();
        ctx.stroke();
      });
    }

  }, [data.frames]);

  // Effect to redraw when frame changes
  useEffect(() => {
    drawFrame(currentFrameIndex);
  }, [currentFrameIndex, drawFrame]);


  const playFrame = (index: number) => {
    if (index >= data.frames.length) {
      setIsPlaying(false);
      setCurrentFrameIndex(0);
      return;
    }

    const frame = data.frames[index];
    setCurrentFrameIndex(index);

    const beatDurationSec = 60 / data.tempo;
    const frameDurationSec = (beatDurationSec * frame.duration) / playbackSpeed;
    const frameDurationMs = frameDurationSec * 1000;

    // Play Audio
    audioEngine.current?.resume();
    // Play slightly shorter than full duration to articulate between notes
    audioEngine.current?.playChord(frame.notes, frameDurationSec * 0.95);

    // Schedule next
    timeoutRef.current = setTimeout(() => {
      playFrame(index + 1);
    }, frameDurationMs);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      setIsPlaying(true);
      playFrame(currentFrameIndex);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const currentFrame = data.frames[currentFrameIndex];

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Player Stage */}
      <div 
        ref={containerRef}
        className="relative w-full min-h-[550px] bg-slate-900 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-800 flex flex-col items-center justify-center p-8"
      >
        {/* Decorative background glow based on activity */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-20' : 'opacity-0'} bg-gradient-to-t from-cyan-900/40 to-transparent pointer-events-none`} />

        {/* The "Sheet Music" Display */}
        <div className="relative z-10 shadow-2xl rounded-lg overflow-hidden border-4 border-slate-700 bg-white min-h-[400px] flex items-center justify-center">
           <canvas 
             ref={canvasRef} 
             className="block max-w-full max-h-[450px] object-contain bg-white"
           />
        </div>

        {/* Current Info Display */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center w-full px-4">
           <div className="flex flex-wrap justify-center gap-2 mb-2">
            {currentFrame?.notes.map((note, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-slate-800/90 backdrop-blur text-cyan-400 font-mono text-sm border border-slate-700 shadow-lg">
                {note}
              </span>
            ))}
           </div>
           
           {currentFrame?.notes.includes('rest') && (
             <span className="text-slate-500 text-xs uppercase tracking-widest bg-slate-900/80 px-2 py-1 rounded">Rest</span>
           )}
           
           {imageSrcs.length > 1 && (
             <span className="text-slate-500 text-[10px] mt-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">
               Page {currentFrame?.pageIndex !== undefined ? currentFrame.pageIndex + 1 : 1}
             </span>
           )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-wrap items-center justify-between gap-6 border border-slate-700 shadow-xl">
        
        {/* Tempo Info */}
        <div className="flex items-center space-x-3 min-w-[120px]">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-cyan-400">
            <Volume2 size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tempo</span>
            <span className="text-lg font-semibold text-white">{data.tempo} <span className="text-xs text-slate-500">BPM</span></span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-6">
          <button 
            onClick={handleStop}
            className="p-4 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            title="Reset"
          >
            <RotateCcw size={24} />
          </button>
          
          <button 
            onClick={handlePlayPause}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-lg shadow-cyan-900/20
              ${isPlaying 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 rotate-0' 
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 rotate-0'
              }`}
          >
            {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-2" />}
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center space-x-3 bg-slate-900/50 rounded-xl p-2 border border-slate-700/50">
           <button 
             onClick={() => setPlaybackSpeed(Math.max(0.25, playbackSpeed - 0.25))}
             className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
           >
             <SkipBack size={18} />
           </button>
           <div className="flex flex-col items-center w-16">
             <span className="text-lg font-bold text-white">{playbackSpeed.toFixed(2)}x</span>
             <span className="text-[10px] text-slate-500 uppercase">Speed</span>
           </div>
           <button 
             onClick={() => setPlaybackSpeed(Math.min(2.0, playbackSpeed + 0.25))}
             className="p-3 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
           >
             <SkipForward size={18} />
           </button>
        </div>

        {/* Upload Button */}
        <div className="border-l border-slate-700 pl-6">
          <button 
            onClick={onReset}
            className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors"
          >
            Upload New
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-linear"
          style={{ width: `${((currentFrameIndex + 1) / data.frames.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
