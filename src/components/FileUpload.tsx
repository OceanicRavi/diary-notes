import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
}

export function FileUpload({ onFileSelect, accept, multiple = true }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFileSelect(acceptedFiles);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
        ${isDragActive 
          ? 'border-primary-500 bg-primary-50' 
          : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
    >
      <input {...getInputProps()} />
      <Upload className={`mx-auto h-12 w-12 ${isDragActive ? 'text-primary-500' : 'text-gray-400'}`} />
      <p className="mt-4 text-sm text-gray-600">
        {isDragActive ? (
          'Drop the files here...'
        ) : (
          'Drag & drop files here, or click to select files'
        )}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        Supported formats: PDF, DOC, DOCX, TXT, PNG, JPG
      </p>
    </div>
  );
}