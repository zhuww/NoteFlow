
import React, { useRef, useState } from 'react';
import { Upload, FileImage, Loader2, Files } from 'lucide-react';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, isLoading }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    // Filter for images only
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length > 0) {
      setSelectedCount(validFiles.length);
      onFilesSelect(validFiles);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer
          ${dragActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-slate-600 bg-slate-800/50 hover:border-slate-400 hover:bg-slate-800'}
          ${isLoading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          multiple
          className="hidden" 
          accept="image/png, image/jpeg, image/jpg"
          onChange={handleChange}
        />
        
        {isLoading ? (
          <div className="flex flex-col items-center text-cyan-400 animate-pulse">
            <Loader2 className="w-12 h-12 mb-4 animate-spin" />
            <p className="text-lg font-medium">Analyzing {selectedCount > 0 ? `${selectedCount} Pages` : 'Score'}...</p>
            <p className="text-sm text-slate-400 mt-2">Identifying notes, tempo & pages</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-300">
            <div className="p-4 rounded-full bg-slate-700/50 mb-4">
              {selectedCount > 0 ? <Files className="w-8 h-8 text-cyan-400" /> : <Upload className="w-8 h-8" />}
            </div>
            <p className="text-lg font-medium text-slate-200">
              {selectedCount > 0 ? "Upload selected files?" : "Click or drag sheet music pages"}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {selectedCount > 0 
                ? `${selectedCount} file${selectedCount !== 1 ? 's' : ''} selected` 
                : "Supports JPG, PNG (Single or Multiple Pages)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
