import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, X, FileText } from 'lucide-react';
import { DocumentSection as DocumentSectionType } from '../types';
import { FileUpload } from './FileUpload';

interface DocumentSectionProps {
  section: DocumentSectionType;
  onFileUpload: (sectionId: string, files: File[]) => void;
  onNotesChange: (sectionId: string, notes: string) => void;
  onRemoveFile: (sectionId: string, fileIndex: number) => void;
  onSummarize: (sectionId: string) => void;
}

export function DocumentSection({
  section,
  onFileUpload,
  onNotesChange,
  onRemoveFile,
  onSummarize
}: DocumentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusColor = (status: DocumentSectionType['status']) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'uploaded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="section-card overflow-hidden">
      <button
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{section.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(section.status)}`}>
            {section.status}
          </span>
          {isExpanded ? <ChevronUp className="text-gray-400" size={20} /> : <ChevronDown className="text-gray-400" size={20} />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 border-t border-gray-100">
          <FileUpload
            onFileSelect={(files) => onFileUpload(section.id, files)}
            accept={{
              'application/pdf': ['.pdf'],
              'image/*': ['.png', '.jpg', '.jpeg'],
              'application/msword': ['.doc'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'text/plain': ['.txt']
            }}
          />

          {section.files.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Uploaded Files:</h4>
              <ul className="space-y-2">
                {section.files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <button
                      onClick={() => onRemoveFile(section.id, index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSummarize(section.id)}
                disabled={section.status === 'processing'}
                className={`mt-4 btn btn-primary w-full flex items-center justify-center gap-2 ${
                  section.status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {section.status === 'processing' ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <FileText size={20} />
                )}
                <span>
                  {section.status === 'processing' ? 'Processing...' : 'Summarize Documents'}
                </span>
              </button>
            </div>
          )}

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              className="input"
              rows={3}
              value={section.notes || ''}
              onChange={(e) => onNotesChange(section.id, e.target.value)}
              placeholder="Add any additional notes here..."
            />
          </div>

          {section.summary && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Section Summary:</h4>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700">
                {section.summary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}