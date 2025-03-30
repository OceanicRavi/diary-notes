import { v4 as uuid } from 'uuid';
import { supabase } from './supabase';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { DocumentSection, DocumentSections } from '../types';

export async function uploadFile(file: File, section: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${section}/${uuid()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('mortgage-docs')
    .upload(fileName, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('mortgage-docs')
    .getPublicUrl(fileName);

  console.log(`File uploaded successfully: ${publicUrl}`);
  return publicUrl;
}

export async function processDocuments(sectionId: string, files: File[], webhookUrl: string): Promise<any> {
  try {
    // Upload files to Supabase storage
    const uploadPromises = files.map(file => uploadFile(file, sectionId));
    const fileUrls = await Promise.all(uploadPromises);

    console.log('All files uploaded successfully:');
    fileUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });

    // Call the document processing edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sectionId,
        fileUrls,
        webhookUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error processing documents:', error);
    throw error instanceof Error ? error : new Error('Failed to process documents');
  }
}

export async function generateDocument(sections: DocumentSections, format: 'pdf' | 'docx'): Promise<Blob> {
  const completedSections = Object.values(sections).filter(
    section => section.status === 'complete'
  );

  if (format === 'docx') {
    const doc = new Document({
      sections: [{
        properties: {},
        children: completedSections.map(section => new Paragraph({
          children: [
            new TextRun({ text: section.title, bold: true }),
            new TextRun({ text: '\n' }),
            new TextRun({ text: section.summary || '' }),
            new TextRun({ text: '\n\n' }),
          ],
        })),
      }],
    });

    return await Packer.toBlob(doc);
  } else {
    const pdf = new jsPDF();
    let yOffset = 20;

    completedSections.forEach((section) => {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(section.title, 20, yOffset);
      yOffset += 10;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(section.summary || '', 170);
      pdf.text(lines, 20, yOffset);
      yOffset += lines.length * 7 + 10;
    });

    return pdf.output('blob');
  }
}