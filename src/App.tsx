import React, { useState } from 'react';
import { DocumentSection, DocumentSections, EmploymentType } from './types';
import { DocumentSection as DocumentSectionComponent } from './components/DocumentSection';
import { SummaryPanel } from './components/SummaryPanel';
import { processDocuments, generateDocument } from './lib/documentProcessor';

const initialSections: DocumentSections = {
  identification: {
    id: 'identification',
    title: 'Identification',
    description: 'Upload government-issued ID documents',
    status: 'pending',
    files: [],
    webhookUrl: 'https://novanexus.app.n8n.cloud/webhook-test/425bf551-ef8c-4690-a31d-40fa7c0183b9',
  },
  income: {
    id: 'income',
    title: 'Income Documents',
    description: 'Upload pay stubs, T4s, or business financial statements',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/income',
  },
  bankStatements: {
    id: 'bankStatements',
    title: 'Bank Statements',
    description: 'Upload last 3 months of bank statements',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/bank-statements',
  },
  depositProof: {
    id: 'depositProof',
    title: 'Deposit Proof',
    description: 'Upload proof of down payment',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/deposit-proof',
  },
  assetsLiabilities: {
    id: 'assetsLiabilities',
    title: 'Assets & Liabilities',
    description: 'Upload statements for investments, debts, etc.',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/assets-liabilities',
  },
  propertyInfo: {
    id: 'propertyInfo',
    title: 'Property Information',
    description: 'Upload property details, MLS listing, or purchase agreement',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/property-info',
  },
  other: {
    id: 'other',
    title: 'Other Documents',
    description: 'Upload any additional supporting documents',
    status: 'pending',
    files: [],
    webhookUrl: 'https://n8n.example.com/webhook/other',
  },
};

function App() {
  const [sections, setSections] = useState<DocumentSections>(initialSections);
  const [employmentType, setEmploymentType] = useState<EmploymentType>('salaried');
  const [email, setEmail] = useState('');

  const handleFileUpload = async (sectionId: string, files: File[]) => {
    try {
      setSections((prev) => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          files: [...prev[sectionId].files, ...files],
          status: 'uploaded',
        },
      }));
    } catch (error) {
      console.error('Error uploading files:', error);
      setSections((prev) => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          status: 'error',
        },
      }));
    }
  };

  const handleSummarize = async (sectionId: string) => {
    const section = sections[sectionId];
    if (section.files.length === 0) {
      alert('Please upload files before summarizing');
      return;
    }

    try {
      setSections((prev) => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          status: 'processing',
        },
      }));

      const summary = await processDocuments(sectionId, section.files, section.webhookUrl);

      setSections((prev) => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          status: 'complete',
          summary,
        },
      }));
    } catch (error) {
      console.error('Error processing documents:', error);
      setSections((prev) => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          status: 'error',
        },
      }));
    }
  };

  const handleNotesChange = (sectionId: string, notes: string) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        notes,
      },
    }));
  };

  const handleRemoveFile = (sectionId: string, fileIndex: number) => {
    setSections((prev) => ({
      ...prev,
      [sectionId]: {
        ...prev[sectionId],
        files: prev[sectionId].files.filter((_, index) => index !== fileIndex),
        status: prev[sectionId].files.length === 1 ? 'pending' : prev[sectionId].status,
      },
    }));
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    try {
      const blob = await generateDocument(sections, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mortgage-summary.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating document:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mortgage Document Upload</h1>
          <p className="mt-2 text-gray-600">
            Upload your documents section by section. We'll generate a summary for each section as you go.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address (optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter your email to receive the summary"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employment Type
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="salaried"
                checked={employmentType === 'salaried'}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="form-radio text-blue-600"
              />
              <span className="ml-2">Salaried</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="self-employed"
                checked={employmentType === 'self-employed'}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="form-radio text-blue-600"
              />
              <span className="ml-2">Self-Employed</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {Object.values(sections).map((section) => (
              <DocumentSectionComponent
                key={section.id}
                section={section}
                onFileUpload={handleFileUpload}
                onNotesChange={handleNotesChange}
                onRemoveFile={handleRemoveFile}
                onSummarize={handleSummarize}
              />
            ))}
          </div>

          <div className="lg:sticky lg:top-8 lg:h-fit">
            <SummaryPanel
              sections={sections}
              onDownload={handleDownload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App