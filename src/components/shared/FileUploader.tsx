
import React, { useState, useCallback } from 'react';

interface FileUploaderProps {
  onFileSelect: (file: File | null) => void;
  fullWidth?: boolean;
  acceptedMimeTypes?: string[];
  fileTypeDescription?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileSelect, 
  fullWidth = false,
  acceptedMimeTypes = ['application/pdf'],
  fileTypeDescription = 'PDF'
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_SIZE_MB = 10;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  const handleFileChange = useCallback((files: FileList | null) => {
    setError(null);
    const selectedFile = files?.[0] || null;
    
    if (!selectedFile) {
      setFile(null);
      onFileSelect(null);
      return;
    }

    if (!acceptedMimeTypes.includes(selectedFile.type)) {
      setError(`Invalid file type. Please upload a ${fileTypeDescription} file.`);
      setFile(null);
      onFileSelect(null);
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      setFile(null);
      onFileSelect(null);
      return;
    }

    setFile(selectedFile);
    onFileSelect(selectedFile);
  }, [onFileSelect, acceptedMimeTypes, fileTypeDescription]);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [handleFileChange]);
  
  const handleRemoveFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setFile(null);
    onFileSelect(null);
    setError(null);
  };

  const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>, entering: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(entering);
  };

  if (file) {
    return (
        <div className={`p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between transition-all duration-300 ${fullWidth ? 'w-full' : ''}`}>
            <div className="flex items-center gap-3 overflow-hidden">
                 <svg className="w-6 h-6 text-green-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                 </svg>
                 <span className="text-sm font-medium text-slate-800 truncate" title={file.name}>{file.name}</span>
            </div>
            <button onClick={handleRemoveFile} className="text-sm font-semibold text-red-500 hover:text-red-700 transition ml-4 flex-shrink-0">
                Remove
            </button>
        </div>
    )
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
        <label
            onDrop={handleDrop}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            className={`
                flex w-full flex-col items-center justify-center p-8
                border-2 border-dashed rounded-lg cursor-pointer
                transition-all duration-300 ease-in-out
                ${isDragging ? 'border-primary bg-primary-100 scale-105 shadow-lg' : error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white hover:border-primary hover:bg-primary-50'}
            `}
        >
            <div className="flex flex-col items-center justify-center text-center">
                <svg className={`w-12 h-12 transition-colors ${isDragging ? 'text-primary' : 'text-slate-400'}`} fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4 4-4-4h3v-3h2v3z" />
                </svg>
                <p className="mt-4 text-base sm:text-lg text-slate-600">
                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="mt-1 text-sm text-slate-500">{fileTypeDescription} (Max 10MB)</p>
                <input type='file' className="hidden" onChange={(e) => handleFileChange(e.target.files)} accept={acceptedMimeTypes.join(',')} aria-label="File Uploader"/>
            </div>
        </label>
        {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
};

export default FileUploader;
