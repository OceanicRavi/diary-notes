export type DocumentSection = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'uploaded' | 'processing' | 'error' | 'complete';
  files: File[];
  notes?: string;
  summary?: string;
  webhookUrl: string;
};

export type EmploymentType = 'salaried' | 'self-employed';

export type DocumentSections = {
  [key: string]: DocumentSection;
};