import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, X, FileText, Image, Eye, Download, UploadCloud } from 'lucide-react';
import { DocumentSection as DocumentSectionType } from '../types';
import { FileUpload } from './FileUpload';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface DocumentSectionProps {
  section: DocumentSectionType;
  onFileUpload: (sectionId: string, files: File[]) => void;
  onNotesChange: (sectionId: string, notes: string) => void;
  onRemoveFile: (sectionId: string, fileIndex: number) => void;
  onSummarize: (sectionId: string) => void;
}

interface ExtractedImage {
  name: string;
  data: string; // Base64 data
}

interface ProgressInfo {
  current: number;
  total: number;
  message: string;
}

// Helper function to check if file is PDF
const isPDF = (file: File): boolean => {
  return file.type === 'application/pdf';
};

// Helper function to generate a unique identifier
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export function DocumentSection({
  section,
  onFileUpload,
  onNotesChange,
  onRemoveFile,
  onSummarize
}: DocumentSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [extractedImages, setExtractedImages] = useState<{[fileId: string]: ExtractedImage[]}>({});
  const [conversionStatus, setConversionStatus] = useState<{[fileId: string]: 'idle' | 'converting' | 'done' | 'error'}>({});
  const [progressInfo, setProgressInfo] = useState<{[fileId: string]: ProgressInfo}>({});
  const [previewImage, setPreviewImage] = useState<ExtractedImage | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  // Function to convert file to PDF
  const convertToPDF = async (file: File, fileIndex: number) => {
    const fileId = `${file.name}-${fileIndex}`;
    setConversionStatus(prev => ({ ...prev, [fileId]: 'converting' }));
    
    try {
      const fileType = file.type;
      const fileName = file.name.split('.')[0] || 'converted';
      const doc = new jsPDF();
      
      // Update progress
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Starting conversion...' } 
      }));
      
      // For images (JPG, PNG)
      if (fileType.startsWith('image/')) {
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 10, total: 100, message: 'Processing image...' } 
        }));
        
        const img = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image to canvas
        ctx?.drawImage(img, 0, 0);
        
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 40, total: 100, message: 'Converting to PDF format...' } 
        }));
        
        // Get image data URL
        const imageData = canvas.toDataURL('image/jpeg');
        
        // Add image to PDF (adjusting dimensions to fit page)
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height) * 0.9;
        const width = img.width * ratio;
        const height = img.height * ratio;
        const x = (pdfWidth - width) / 2;
        const y = (pdfHeight - height) / 2;
        
        doc.addImage(imageData, 'JPEG', x, y, width, height);
        
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 80, total: 100, message: 'Finalizing PDF...' } 
        }));
        
        doc.save(`${fileName}.pdf`);
      } 
      // For DOC/DOCX files
      else if (fileType === 'application/msword' || 
               fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Read file as ArrayBuffer
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 10, total: 100, message: 'Reading document...' } 
        }));
        
        const arrayBuffer = await file.arrayBuffer();
        
        // Convert to HTML using mammoth
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 30, total: 100, message: 'Converting document to HTML...' } 
        }));
        
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;
        
        // Split the HTML content into pages
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 50, total: 100, message: 'Preparing pages...' } 
        }));
        
        const contentArray = splitIntoPages(html);
        
        // Add each page to the PDF
        let pageIndex = 0;
        const totalPages = contentArray.length;
        
        for (const content of contentArray) {
          setProgressInfo(prev => ({ 
            ...prev, 
            [fileId]: { 
              current: 50 + Math.floor((pageIndex / totalPages) * 40), 
              total: 100, 
              message: `Processing page ${pageIndex + 1} of ${totalPages}...` 
            } 
          }));
          
          if (pageIndex > 0) doc.addPage();
          
          await new Promise<void>((resolve) => {
            doc.html(content, {
              callback: function() {
                resolve();
              },
              x: 10,
              y: 10,
              width: doc.internal.pageSize.getWidth() - 20,
              windowWidth: 800
            });
          });
          
          pageIndex++;
        }
        
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 90, total: 100, message: 'Finalizing PDF...' } 
        }));
        
        doc.save(`${fileName}.pdf`);
      }
      // For TXT files
      else if (fileType === 'text/plain') {
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 20, total: 100, message: 'Reading text content...' } 
        }));
        
        const text = await file.text();
        const lines = text.split('\n');
        
        // PDF settings
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const lineHeight = 7;
        let y = margin;
        
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 40, total: 100, message: 'Creating PDF...' } 
        }));
        
        // Add lines to PDF
        let lineCount = 0;
        const totalLines = lines.length;
        
        lines.forEach(line => {
          // Update progress every 100 lines
          if (lineCount % 100 === 0) {
            setProgressInfo(prev => ({ 
              ...prev, 
              [fileId]: { 
                current: 40 + Math.floor((lineCount / totalLines) * 50), 
                total: 100, 
                message: `Processing line ${lineCount} of ${totalLines}...` 
              } 
            }));
          }
          
          // Check if we need a new page
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          
          // Add text and increment y position
          doc.text(line, margin, y);
          y += lineHeight;
          lineCount++;
        });
        
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { current: 90, total: 100, message: 'Finalizing PDF...' } 
        }));
        
        doc.save(`${fileName}.pdf`);
      }
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 100, total: 100, message: 'Conversion complete!' } 
      }));
      
      setConversionStatus(prev => ({ ...prev, [fileId]: 'done' }));
    } catch (error) {
      console.error("Error converting file to PDF:", error);
      setConversionStatus(prev => ({ ...prev, [fileId]: 'error' }));
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Error during conversion' } 
      }));
    }
  };

  // Helper function to split HTML content into pages
  const splitIntoPages = (html: string): string[] => {
    // Simple implementation - split by headers or after N paragraphs
    const paragraphs = html.split('<p>');
    const pages: string[] = [];
    let currentPage = '<div>';
    let paragraphCount = 0;
    
    paragraphs.forEach(p => {
      if (!p.trim()) return;
      
      // Complete the paragraph tag
      const paragraph = p.startsWith('<p>') ? p : `<p>${p}`;
      
      // Start a new page if this paragraph contains a header or we've reached max paragraphs per page
      if ((paragraph.includes('<h1>') || paragraph.includes('<h2>')) && paragraphCount > 0 || paragraphCount >= 10) {
        currentPage += '</div>';
        pages.push(currentPage);
        currentPage = '<div>';
        paragraphCount = 0;
      }
      
      currentPage += paragraph;
      paragraphCount++;
    });
    
    // Add the last page
    if (paragraphCount > 0) {
      currentPage += '</div>';
      pages.push(currentPage);
    }
    
    return pages;
  };

  // Function to extract images from PDF
  const extractImagesFromPDF = async (file: File, fileIndex: number) => {
    const fileId = `${file.name}-${fileIndex}`;
    
    try {
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Starting image extraction...' } 
      }));
      
      const extractedImgs: ExtractedImage[] = [];
      const url = URL.createObjectURL(file);
      
      // Load the PDF document
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 10, total: 100, message: 'Loading PDF document...' } 
      }));
      
      const pdf = await pdfjsLib.getDocument(url).promise;
      const numPages = pdf.numPages;
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 20, 
          total: 100, 
          message: `PDF loaded. Processing ${numPages} pages...` 
        } 
      }));
      
      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { 
            current: 20 + Math.floor((pageNum / numPages) * 60), 
            total: 100, 
            message: `Scanning page ${pageNum} of ${numPages} for images...` 
          } 
        }));
        
        const page = await pdf.getPage(pageNum);
        const operatorList = await page.getOperatorList();
        const commonObjs = page.commonObjs;
        const imgIndex = [];
        
        // Find all image operations
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
            imgIndex.push(i);
          }
        }
        
        // Update message with image count
        if (imgIndex.length > 0) {
          setProgressInfo(prev => ({ 
            ...prev, 
            [fileId]: { 
              current: 20 + Math.floor((pageNum / numPages) * 60), 
              total: 100, 
              message: `Found ${imgIndex.length} images on page ${pageNum}. Extracting...` 
            } 
          }));
        }
        
        // Extract each image
        for (let i = 0; i < imgIndex.length; i++) {
          const imageArgs = operatorList.argsArray[imgIndex[i]];
          const imageId = imageArgs[0];
          
          // Try to get the image (may fail if the image is in a pattern or masked)
          try {
            const img = await page.objs.get(imageId);
            if (!img) continue;
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx?.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
            
            const imageData = canvas.toDataURL('image/png');
            const imageName = `image-page${pageNum}-${i}-${generateId()}.png`;
            
            extractedImgs.push({
              name: imageName,
              data: imageData
            });
          } catch (e) {
            console.warn(`Failed to extract image ${imageId}:`, e);
          }
        }
      }
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 90, 
          total: 100, 
          message: `Extracted ${extractedImgs.length} images. Finalizing...` 
        } 
      }));
      
      // Add the extracted images to state
      setExtractedImages(prev => ({ 
        ...prev, 
        [fileId]: extractedImgs 
      }));
      
      // Clean up
      URL.revokeObjectURL(url);
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 100, 
          total: 100, 
          message: extractedImgs.length > 0 
            ? `Successfully extracted ${extractedImgs.length} images` 
            : 'No images found in PDF'
        } 
      }));
      
      // Clear progress info after a delay
      setTimeout(() => {
        setProgressInfo(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 3000);
      
    } catch (error) {
      console.error("Error extracting images from PDF:", error);
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Error extracting images' } 
      }));
    }
  };

  // Function to convert PDF to images (rendering each page as an image)
  const convertPDFToImages = async (file: File, fileIndex: number, download: boolean = true): Promise<File[] | null> => {
    const fileId = `${file.name}-${fileIndex}`;
    setConversionStatus(prev => ({ ...prev, [fileId]: 'converting' }));
    
    try {
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Starting PDF to image conversion...' } 
      }));
      
      const url = URL.createObjectURL(file);
      const convertedImages: File[] = [];
      
      // Load the PDF document
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 10, total: 100, message: 'Loading PDF document...' } 
      }));
      
      const pdf = await pdfjsLib.getDocument(url).promise;
      const numPages = pdf.numPages;
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 20, 
          total: 100, 
          message: `PDF loaded. Converting ${numPages} pages to images...` 
        } 
      }));
      
      // Convert each page to an image
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setProgressInfo(prev => ({ 
          ...prev, 
          [fileId]: { 
            current: 20 + Math.floor((pageNum / numPages) * 70), 
            total: 100, 
            message: `Converting page ${pageNum} of ${numPages} to image...` 
          } 
        }));
        
        const page = await pdf.getPage(pageNum);
        
        // Set scale for high quality rendering
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context!,
          viewport: viewport
        }).promise;
        
        // Convert canvas to image file
        const imageData = canvas.toDataURL('image/png');
        const fileName = numPages === 1 
          ? `${file.name.replace('.pdf', '')}.png` 
          : `${file.name.replace('.pdf', '')}_page${pageNum}.png`;
          
        // Convert base64 to file
        const base64Response = await fetch(imageData);
        const blob = await base64Response.blob();
        const imageFile = new File([blob], fileName, { type: 'image/png' });
        
        if (download) {
          // Download the image
          const downloadLink = document.createElement('a');
          downloadLink.href = imageData;
          downloadLink.download = fileName;
          downloadLink.click();
        }
        
        convertedImages.push(imageFile);
      }
      
      // Clean up
      URL.revokeObjectURL(url);
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 100, 
          total: 100, 
          message: download 
            ? `Successfully downloaded ${numPages} image${numPages !== 1 ? 's' : ''}` 
            : 'Conversion complete, uploading images...'
        } 
      }));
      
      setConversionStatus(prev => ({ ...prev, [fileId]: 'done' }));
      
      // Clear progress info after a delay if downloading
      if (download) {
        setTimeout(() => {
          setProgressInfo(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
        }, 3000);
      }
      
      return convertedImages;
    } catch (error) {
      console.error("Error converting PDF to images:", error);
      setConversionStatus(prev => ({ ...prev, [fileId]: 'error' }));
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Error converting PDF to images' } 
      }));
      return null;
    }
  };

  // Function to convert PDF to images and upload them
  const convertAndUploadAsImages = async (file: File, fileIndex: number) => {
    const fileId = `${file.name}-${fileIndex}`;
    
    try {
      // Convert the PDF to images
      const imageFiles = await convertPDFToImages(file, fileIndex, false);
      
      if (!imageFiles || imageFiles.length === 0) {
        throw new Error("Failed to convert PDF to images");
      }
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 90, total: 100, message: 'Adding images to uploaded files...' } 
      }));
      
      // Upload the converted images
      onFileUpload(section.id, imageFiles);
      
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { 
          current: 100, 
          total: 100, 
          message: `Successfully uploaded ${imageFiles.length} image${imageFiles.length !== 1 ? 's' : ''}`
        } 
      }));
      
      // Clear progress info after a delay
      setTimeout(() => {
        setProgressInfo(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 3000);
      
    } catch (error) {
      console.error("Error converting and uploading PDF as images:", error);
      setProgressInfo(prev => ({ 
        ...prev, 
        [fileId]: { current: 0, total: 100, message: 'Error converting and uploading' } 
      }));
    }
  };

  // Function to download an extracted image
  const downloadExtractedImage = (image: ExtractedImage) => {
    const link = document.createElement('a');
    link.href = image.data;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Function to preview an image
  const openImagePreview = (image: ExtractedImage) => {
    setPreviewImage(image);
    setShowPreviewModal(true);
  };
  
  // Function to close preview modal
  const closeImagePreview = () => {
    setShowPreviewModal(false);
    setPreviewImage(null);
  };

  // Enhanced file upload handler
  const handleFileUpload = (sectionId: string, files: File[]) => {
    // Call the original onFileUpload handler
    onFileUpload(sectionId, files);
    
    // Process each file
    files.forEach((file, idx) => {
      const newIndex = section.files.length + idx;
      const fileId = `${file.name}-${newIndex}`;
      
      // Initialize conversion status for non-PDFs
      if (!isPDF(file)) {
        setConversionStatus(prev => ({ ...prev, [fileId]: 'idle' }));
      }
      // Extract images from PDFs
      else {
        extractImagesFromPDF(file, newIndex);
      }
    });
  };

  // Calculate progress percentage
  const getProgressPercentage = (progress: ProgressInfo) => {
    return (progress.current / progress.total) * 100;
  };

  // Helper function to check if a PDF has no extracted images
  const pdfHasNoExtractedImages = (fileId: string): boolean => {
    return !extractedImages[fileId] || extractedImages[fileId].length === 0;
  };

  return (
    <div className="section-card overflow-hidden">
      {/* Image Preview Modal */}
      {showPreviewModal && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-medium text-lg">{previewImage.name}</h3>
              <button 
                onClick={closeImagePreview}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center">
              <img 
                src={previewImage.data} 
                alt={previewImage.name} 
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => downloadExtractedImage(previewImage)}
                className="btn btn-primary flex items-center gap-2"
              >
                Download Image
              </button>
            </div>
          </div>
        </div>
      )}

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
            onFileSelect={(files) => handleFileUpload(section.id, files)}
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
              <ul className="space-y-3">
                {section.files.map((file, index) => {
                  const fileId = `${file.name}-${index}`;
                  const fileIsPDF = file.type === 'application/pdf';
                  const hasExtractedImages = extractedImages[fileId] && extractedImages[fileId].length > 0;
                  const fileProgress = progressInfo[fileId];
                  const noImagesExtracted = fileIsPDF && pdfHasNoExtractedImages(fileId);
                  
                  return (
                    <li key={index} className="bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-700 truncate flex items-center">
                          <FileText size={16} className="mr-2 text-gray-500" />
                          {file.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Non-PDF file options */}
                          {!fileIsPDF && (
                            <button
                              onClick={() => convertToPDF(file, index)}
                              disabled={conversionStatus[fileId] === 'converting'}
                              className={`text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded transition-colors ${
                                conversionStatus[fileId] === 'converting' ? 'opacity-50 cursor-wait' : ''
                              }`}
                            >
                              {conversionStatus[fileId] === 'converting' ? (
                                <span className="flex items-center">
                                  <RefreshCw size={12} className="animate-spin mr-1" />
                                  Converting...
                                </span>
                              ) : (
                                'Download as PDF'
                              )}
                            </button>
                          )}

                          {/* PDF file options */}
                          {fileIsPDF && (
                            <>
                              {/* Download as Image option */}
                              <button
                                onClick={() => convertPDFToImages(file, index)}
                                disabled={conversionStatus[fileId] === 'converting'}
                                className={`text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded transition-colors flex items-center ${
                                  conversionStatus[fileId] === 'converting' ? 'opacity-50 cursor-wait' : ''
                                }`}
                              >
                                {conversionStatus[fileId] === 'converting' ? (
                                  <span className="flex items-center">
                                    <RefreshCw size={12} className="animate-spin mr-1" />
                                    Converting...
                                  </span>
                                ) : (
                                  <>
                                    <Download size={12} className="mr-1" />
                                    Download as Image
                                  </>
                                )}
                              </button>

                              {/* Upload as Image option */}
                              <button
                                onClick={() => convertAndUploadAsImages(file, index)}
                                disabled={conversionStatus[fileId] === 'converting'}
                                className={`text-xs bg-green-500 hover:bg-green-600 text-white py-1 px-2 rounded transition-colors flex items-center ${
                                  conversionStatus[fileId] === 'converting' ? 'opacity-50 cursor-wait' : ''
                                }`}
                              >
                                {conversionStatus[fileId] === 'converting' ? (
                                  <span className="flex items-center">
                                    <RefreshCw size={12} className="animate-spin mr-1" />
                                    Converting...
                                  </span>
                                ) : (
                                  <>
                                    <UploadCloud size={12} className="mr-1" />
                                    Upload as Image
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onRemoveFile(section.id, index)}
                            className="text-gray-600 hover:text-red-500 transition-colors p-1"
                            title="Remove file"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      {fileProgress && (
                        <div className="px-4 py-2 border-t border-gray-200">
                          <div className="text-s text-blue-600 mb-1">{fileProgress.message}</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${getProgressPercentage(fileProgress)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show extracted images for PDFs */}
                      {fileIsPDF && hasExtractedImages && (
                        <div className="border-t border-gray-200 px-4 py-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
                            <Image size={14} className="mr-1" />
                            Extracted Images: {extractedImages[fileId].length}
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {extractedImages[fileId].map((image, imgIdx) => (
                              <div key={imgIdx} className="flex items-center bg-white rounded border border-gray-300 px-2 py-1">
                                <span className="text-xs text-gray-600 truncate max-w-[100px]">{image.name}</span>
                                <div className="flex ml-2">
                                  <button
                                    onClick={() => openImagePreview(image)}
                                    className="text-gray-400 hover:text-blue-600 mr-1"
                                    title="Preview image"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  <button
                                    onClick={() => downloadExtractedImage(image)}
                                    className="text-gray-400 hover:text-primary-600"
                                    title="Download image"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
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
        </div>
      )}
    </div>
  );
}