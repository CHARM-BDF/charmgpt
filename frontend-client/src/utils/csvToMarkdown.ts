import Papa from 'papaparse';

/**
 * Converts CSV content to markdown table format for better viewing
 */
export function csvToMarkdown(csvContent: string, maxRows: number = 100): string {
  try {
    // Parse CSV using PapaParse - handles all edge cases properly
    const parseResult = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors);
    }

    const rows = parseResult.data as string[][];
    if (rows.length === 0) return 'Empty CSV file';
    
    const headers = rows[0];
    const dataRows = rows.slice(1, maxRows + 1); // Limit rows for performance
    
    // Build markdown table
    let markdown = '# CSV Data\n\n';
    
    if (rows.length > maxRows + 1) {
      markdown += `*Showing first ${maxRows} rows of ${rows.length - 1} total data rows*\n\n`;
    }
    
    // Header row
    markdown += '| ' + headers.join(' | ') + ' |\n';
    
    // Separator row
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
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
    
    if (rows.length > maxRows + 1) {
      markdown += `\n*... and ${rows.length - maxRows - 1} more rows*`;
    }
    
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
    // Parse TSV using PapaParse with tab delimiter
    const parseResult = Papa.parse(tsvContent, {
      header: false,
      delimiter: '\t',
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      console.warn('TSV parsing errors:', parseResult.errors);
    }

    const rows = parseResult.data as string[][];
    if (rows.length === 0) return 'Empty TSV file';
    
    const headers = rows[0];
    const dataRows = rows.slice(1, maxRows + 1);
    
    // Build markdown table
    let markdown = '# TSV Data\n\n';
    
    if (rows.length > maxRows + 1) {
      markdown += `*Showing first ${maxRows} rows of ${rows.length - 1} total data rows*\n\n`;
    }
    
    // Header row
    markdown += '| ' + headers.join(' | ') + ' |\n';
    
    // Separator row
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
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
    
    if (rows.length > maxRows + 1) {
      markdown += `\n*... and ${rows.length - maxRows - 1} more rows*`;
    }
    
    return markdown;
  } catch (error) {
    console.error('Error converting TSV to markdown:', error);
    return `# TSV Content\n\n\`\`\`tsv\n${tsvContent}\n\`\`\``;
  }
}
