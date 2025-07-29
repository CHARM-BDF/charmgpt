import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { FileEntry, FileMetadata } from '../types/fileManagement';

export class TextExtractionService {
  /**
   * Extract text from a file based on its mime type
   */
  async extractText(file: Buffer, fileEntry: FileEntry): Promise<Partial<FileMetadata['textExtraction']>> {
    try {
      switch (fileEntry.mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(file);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromDOCX(file);
        default:
          throw new Error(`Unsupported file type: ${fileEntry.mimeType}`);
      }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        format: fileEntry.mimeType,
        extractedAt: new Date()
      };
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractFromPDF(file: Buffer): Promise<Partial<FileMetadata['textExtraction']>> {
    const data = await pdfParse(file);
    
    return {
      status: 'completed',
      content: data.text,
      format: 'application/pdf',
      extractedAt: new Date(),
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
        charCount: data.text.length
      }
    };
  }

  /**
   * Extract text from DOCX files
   */
  private async extractFromDOCX(file: Buffer): Promise<Partial<FileMetadata['textExtraction']>> {
    const result = await mammoth.extractRawText({ buffer: file });
    const text = result.value;

    return {
      status: 'completed',
      content: text,
      format: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extractedAt: new Date(),
      metadata: {
        wordCount: text.split(/\s+/).length,
        charCount: text.length
      }
    };
  }
} 