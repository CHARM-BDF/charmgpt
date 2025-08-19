/**
 * Converts CSV content to markdown table format for better viewing
 */
export function csvToMarkdown(csvContent: string, maxRows: number = 100): string {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return 'Empty CSV file';
    
    // Parse CSV (simple parser - doesn't handle quoted commas)
    const rows = lines.map(line => line.split(',').map(cell => cell.trim()));
    
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
      markdown += '| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |\n';
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
    const csvContent = tsvContent.replace(/\t/g, ',');
    return csvToMarkdown(csvContent, maxRows).replace('# CSV Data', '# TSV Data');
  } catch (error) {
    console.error('Error converting TSV to markdown:', error);
    return `# TSV Content\n\n\`\`\`tsv\n${tsvContent}\n\`\`\``;
  }
}
