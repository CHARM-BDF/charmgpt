import fs from 'fs';
import path from 'path';

interface LogSection {
  type: string;
  content: string;
  timestamp: string;
  sequence: number;
  sectionStart: number;
  sectionEnd: number;
}

interface ExtractedData {
  toolExecution: LogSection[];
  formatterInput: LogSection[];
  formatterOutput: LogSection[];
  artifactCollection: LogSection[];
  storeFormat: LogSection[];
  sequentialThinking: LogSection[];
  sequence: LogSection[];
}

function extractLogData(logFilePath: string): ExtractedData {
  const logContent = fs.readFileSync(logFilePath, 'utf-8');
  const lines = logContent.split('\n');
  
  const extractedData: ExtractedData = {
    toolExecution: [],
    formatterInput: [],
    formatterOutput: [],
    artifactCollection: [],
    storeFormat: [],
    sequentialThinking: [],
    sequence: []
  };

  let currentSection: LogSection | null = null;
  let currentContent: string[] = [];
  let sequenceCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Extract timestamp if present
    const timestampMatch = line.match(/\[(.*?)\]/);
    const timestamp = timestampMatch ? timestampMatch[1] : '';

    // Check for section markers
    if (line.includes('TOOL-EXECUTION:')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'toolExecution', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (line.includes('[FORMATTER INPUT]')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'formatterInput', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (line.includes('[FORMATTER OUTPUT]')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'formatterOutput', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (line.includes('ARTIFACT-COLLECTION:')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'artifactCollection', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (line.includes('[STORE FORMAT]')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'storeFormat', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (line.includes('SEQUENTIAL-THINKING:')) {
      if (currentSection) {
        currentSection.content = currentContent.join('\n');
        currentSection.sectionEnd = i - 1;
        addToExtractedData(extractedData, currentSection);
      }
      currentSection = { 
        type: 'sequentialThinking', 
        content: '', 
        timestamp,
        sequence: sequenceCounter++,
        sectionStart: i,
        sectionEnd: -1
      };
      currentContent = [line];
    }
    else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Add the last section if exists
  if (currentSection) {
    currentSection.content = currentContent.join('\n');
    currentSection.sectionEnd = lines.length - 1;
    addToExtractedData(extractedData, currentSection);
  }

  // Sort all sections by sequence number
  for (const key of Object.keys(extractedData)) {
    if (key !== 'sequence') {
      (extractedData[key as keyof ExtractedData] as LogSection[]).sort((a, b) => a.sequence - b.sequence);
    }
  }

  return extractedData;
}

function addToExtractedData(data: ExtractedData, section: LogSection) {
  switch (section.type) {
    case 'toolExecution':
      data.toolExecution.push(section);
      break;
    case 'formatterInput':
      data.formatterInput.push(section);
      break;
    case 'formatterOutput':
      data.formatterOutput.push(section);
      break;
    case 'artifactCollection':
      data.artifactCollection.push(section);
      break;
    case 'storeFormat':
      data.storeFormat.push(section);
      break;
    case 'sequentialThinking':
      data.sequentialThinking.push(section);
      break;
  }
  
  data.sequence.push(section);
}

function saveExtractedData(data: ExtractedData, outputDir: string) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save each section to a separate file
  for (const [key, sections] of Object.entries(data)) {
    const outputPath = path.join(outputDir, `${key}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(sections, null, 2));
  }

  // Create a summary file with section counts and sequence
  const summary = {
    totalSections: data.sequence.length,
    sectionCounts: {
      toolExecution: data.toolExecution.length,
      formatterInput: data.formatterInput.length,
      formatterOutput: data.formatterOutput.length,
      artifactCollection: data.artifactCollection.length,
      storeFormat: data.storeFormat.length,
      sequentialThinking: data.sequentialThinking.length
    },
    sequence: data.sequence.map(s => ({
      type: s.type,
      sequence: s.sequence,
      timestamp: s.timestamp,
      lineRange: `${s.sectionStart}-${s.sectionEnd}`
    }))
  };

  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Please provide a log file path');
    process.exit(1);
  }

  const logFilePath = args[0];
  const outputDir = args[1] || 'extracted-logs';

  try {
    const extractedData = extractLogData(logFilePath);
    saveExtractedData(extractedData, outputDir);
    console.log(`Successfully extracted data to ${outputDir}`);
  } catch (error) {
    console.error('Error processing log file:', error);
    process.exit(1);
  }
} 