import Papa from 'papaparse';

/**
 * Converts CSV content to markdown table format for better viewing
 */
export function csvToMarkdown(csvContent: string, maxRows: number = 100): string {
  try {
    // Quick line count (much faster than parsing) to get total rows
    const totalLines = (csvContent.match(/\n/g) || []).length + 1;
    const estimatedDataRows = Math.max(0, totalLines - 1); // -1 for header
    
    // Parse CSV using PapaParse - handles all edge cases properly
    // Use preview to only parse the rows we need for performance
    const parseResult = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: true,
      preview: maxRows + 1, // +1 for header row
      delimiter: ',',  // Force comma delimiter (don't guess, as pipe chars inside quotes confuse it)
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors);
    }

    const rows = parseResult.data as string[][];
    if (rows.length === 0) return 'Empty CSV file';
    
    const headers = rows[0];
    const dataRows = rows.slice(1); // All parsed data rows (limited by preview)
    
    // Build markdown table
    let markdown = '# CSV Data\n\n';
    
    // Show row count info
    if (dataRows.length === maxRows && estimatedDataRows > maxRows) {
      markdown += `*Showing first ${maxRows} of ~${estimatedDataRows.toLocaleString()} rows*\n\n`;
    } else if (dataRows.length > 0) {
      markdown += `*Showing all ${dataRows.length} rows*\n\n`;
    }
    
    // Header row - escape pipe characters to prevent markdown table issues
    const escapedHeaders = headers.map(h => (h || '').replace(/\|/g, '\\|'));
    markdown += '| ' + escapedHeaders.join(' | ') + ' |\n';
    
    // Separator row
    markdown += '| ' + escapedHeaders.map(() => '---').join(' | ') + ' |\n';
    
    // Data rows
    dataRows.forEach(row => {
      // Pad row to match header length
      const paddedRow = [...row];
      while (paddedRow.length < headers.length) {
        paddedRow.push('');
      }
      // Escape pipe characters in cell content to prevent markdown table issues
      const escapedRow = paddedRow.slice(0, headers.length).map(cell => 
        (cell || '').replace(/\|/g, '\\|')
      );
      markdown += '| ' + escapedRow.join(' | ') + ' |\n';
    });
    
    return markdown;
  } catch (error) {
    console.error('Error converting CSV to markdown:', error);
    return `# CSV Content\n\n\`\`\`csv\n${csvContent}\n\`\`\``;
  }
}

/**
 * Converts TSV content to markdown table format
 */
export function tsvToMarkdown(tsvContent: string, maxRows: number = 100): string {
  try {
    // Quick line count (much faster than parsing) to get total rows
    const totalLines = (tsvContent.match(/\n/g) || []).length + 1;
    const estimatedDataRows = Math.max(0, totalLines - 1); // -1 for header
    
    // Parse TSV using PapaParse with tab delimiter
    // Use preview to only parse the rows we need for performance
    const parseResult = Papa.parse(tsvContent, {
      header: false,
      delimiter: '\t',
      skipEmptyLines: true,
      preview: maxRows + 1, // +1 for header row
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      console.warn('TSV parsing errors:', parseResult.errors);
    }

    const rows = parseResult.data as string[][];
    if (rows.length === 0) return 'Empty TSV file';
    
    const headers = rows[0];
    const dataRows = rows.slice(1); // All parsed data rows (limited by preview)
    
    // Build markdown table
    let markdown = '# TSV Data\n\n';
    
    // Show row count info
    if (dataRows.length === maxRows && estimatedDataRows > maxRows) {
      markdown += `*Showing first ${maxRows} of ~${estimatedDataRows.toLocaleString()} rows*\n\n`;
    } else if (dataRows.length > 0) {
      markdown += `*Showing all ${dataRows.length} rows*\n\n`;
    }
    
    // Header row - escape pipe characters to prevent markdown table issues
    const escapedHeaders = headers.map(h => (h || '').replace(/\|/g, '\\|'));
    markdown += '| ' + escapedHeaders.join(' | ') + ' |\n';
    
    // Separator row
    markdown += '| ' + escapedHeaders.map(() => '---').join(' | ') + ' |\n';
    
    // Data rows
    dataRows.forEach(row => {
      // Pad row to match header length
      const paddedRow = [...row];
      while (paddedRow.length < headers.length) {
        paddedRow.push('');
      }
      // Escape pipe characters in cell content to prevent markdown table issues
      const escapedRow = paddedRow.slice(0, headers.length).map(cell => 
        (cell || '').replace(/\|/g, '\\|')
      );
      markdown += '| ' + escapedRow.join(' | ') + ' |\n';
    });
    
    return markdown;
  } catch (error) {
    console.error('Error converting TSV to markdown:', error);
    return `# TSV Content\n\n\`\`\`tsv\n${tsvContent}\n\`\`\``;
  }
}
