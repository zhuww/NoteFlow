
import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { MusicPlayer } from './components/MusicPlayer';
import { analyzeSheetMusic } from './services/geminiService';
import { AppStatus, SheetAnalysisResult } from './types';
import { Music } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [imageSrcs, setImageSrcs] = useState<string[]>([]);
  const [sheetData, setSheetData] = useState<SheetAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesSelect = async (files: File[]) => {
    try {
      setStatus(AppStatus.ANALYZING);
      setErrorMessage(null);

      // Read all files as Base64
      const filePromises = files.map(file => {
        return new Promise<{ base64: string, type: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve({ base64: res, type: file.type });
          };
          reader.onerror = reject;
        });
      });

      const results = await Promise.all(filePromises);
      
      // Store full Data URLs for display
      const srcs = results.map(r => r.base64);
      setImageSrcs(srcs);

      // Extract pure base64 for API
      const rawBase64s = results.map(r => r.base64.split(',')[1]);
      const mimeTypes = results.map(r => r.type);

      try {
        const result = await analyzeSheetMusic(rawBase64s, mimeTypes);
        setSheetData(result);
        setStatus(AppStatus.READY);
      } catch (error) {
        console.error(error);
        setStatus(AppStatus.ERROR);
        setErrorMessage("Failed to analyze sheet music. Please ensure the images are clear and try again.");
      }

    } catch (error) {
      console.error(error);
      setStatus(AppStatus.ERROR);
      setErrorMessage("Error reading files.");
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setImageSrcs([]);
    setSheetData(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="w-full bg-slate-900/50 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
              <Music className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              NoteFlow
            </h1>
          </div>
          <div className="text-sm text-slate-500">
            AI Sheet Music Reader
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        
        {/* State: IDLE or ANALYZING or ERROR */}
        {(status === AppStatus.IDLE || status === AppStatus.ANALYZING || status === AppStatus.ERROR) && (
          <div className="w-full max-w-2xl text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
                Bring your sheet music <br/>
                <span className="text-cyan-400">to life</span>
              </h2>
              <p className="text-lg text-slate-400 max-w-lg mx-auto">
                Upload pictures of your sheet music. Our AI will analyze the notes, tempo, and rhythm across multiple pages to create an interactive playback experience.
              </p>
            </div>

            <FileUpload 
              onFilesSelect={handleFilesSelect} 
              isLoading={status === AppStatus.ANALYZING} 
            />

            {status === AppStatus.ERROR && (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
                <p>{errorMessage}</p>
                <button onClick={handleReset} className="text-sm underline mt-2 hover:text-white">Try Again</button>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left mt-12">
               <FeatureCard title="Beat-Focused" desc="Visuals stay steady on the full beat while individual notes play." />
               <FeatureCard title="Multi-Page" desc="Upload multiple consecutive pages to play a full song." />
               <FeatureCard title="Polyphonic" desc="Recognizes complex chords and rhythms across staves." />
            </div>
          </div>
        )}

        {/* State: READY or PLAYING (Handled by MusicPlayer) */}
        {(status === AppStatus.READY || status === AppStatus.PLAYING) && imageSrcs.length > 0 && sheetData && (
          <MusicPlayer 
            imageSrcs={imageSrcs} 
            data={sheetData} 
            onReset={handleReset} 
          />
        )}

      </main>
    </div>
  );
};

const FeatureCard: React.FC<{title: string, desc: string}> = ({title, desc}) => (
  <div className="p-6 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
    <h3 className="font-semibold text-cyan-400 mb-2">{title}</h3>
    <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
  </div>
);

export default App;
