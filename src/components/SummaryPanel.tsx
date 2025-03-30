import React from 'react';
import { Download, FileText, File as FilePdf } from 'lucide-react';
import { DocumentSections } from '../types';
import ReactMarkdown from 'react-markdown';

interface SummaryPanelProps {
  sections: DocumentSections;
  onDownload: (format: 'pdf' | 'docx') => void;
}

export function SummaryPanel({ sections, onDownload }: SummaryPanelProps) {
  const allSectionsComplete = Object.values(sections).every(
    (section) => section.status === 'complete'
  );


  const renderSummaryContent = (summary: string | null | undefined) => {
    return (
      <div className="text-sm text-gray-700 bg-gray-100 p-4 rounded-md border border-gray-300">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    );
  };



  return (
    <div className="section-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Summary Preview</h2>
        {allSectionsComplete && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-1.5 rounded-full border border-green-200">
            <span className="text-sm font-medium">✓ All Sections Completed</span>
          </div>
        )}
      </div>
  
      <div className="space-y-6 max-h-screen overflow-y-auto">
        {Object.values(sections).map((section) => {
          if (!section.summary) return null;
  
          return (
            <div key={section.id} className="pb-6 border-b border-gray-200 last:border-0">
              <h3 className="font-medium text-gray-900 mb-3">{section.title}</h3>
              {renderSummaryContent(section.summary)}
            </div>
          );
        })}
      </div>
  
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => onDownload('docx')}
          className="btn btn-secondary flex items-center gap-2"
        >
          <FileText size={20} />
          <span>Download as Word</span>
        </button>
        <button
          onClick={() => onDownload('pdf')}
          className="btn btn-primary flex items-center gap-2"
        >
          <FilePdf size={20} />
          <span>Download as PDF</span>
        </button>
      </div>
    </div>
  );
  
}