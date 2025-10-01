# PubTator Snippet View Artifact - Implementation Plan

**🎯 Purpose:** Create a new artifact type that displays PubTator search results with highlighted text snippets followed by formatted bibliography entries.

**📊 Data Source:** PubTator search results with `text_hl` and paper metadata  
**🎨 Display Type:** Snippet + Bibliography hybrid view  
**🔧 Implementation:** New artifact type + UI component

## 📋 Data Structure Analysis

### Input Data (PubTator Search Results)
```json
{
  "results": [
    {
      "pmid": 39331042,
      "title": "VPS13B is localized at the interface between Golgi cisternae...",
      "journal": "J Cell Biol",
      "authors": ["Ugur B", "Schueder F", "Shin J", ...],
      "date": "2024-12-02T00:00:00Z",
      "text_hl": "This delay is phenocopied by the loss of @<m>GENE_FAM177A1</m>...",
      "citations": {
        "NLM": "Ugur B, Schueder F, Shin J...",
        "BibTeX": "@article{39331042, title={...}"
      }
    }
  ]
}
```

### Key Fields Mapping
| PubTator Field | Bibliography Field | Notes |
|----------------|-------------------|-------|
| `pmid` | `pmid` | Direct mapping |
| `title` | `title` | Direct mapping |
| `journal` | `journal` | Direct mapping |
| `authors` | `authors` | Array of strings |
| `date` | `year` | Extract year from ISO date |
| `text_hl` | `snippet` | New field for snippet display |
| `citations.NLM` | `citation` | Optional formatted citation |

## 🎨 Display Design

### Visual Layout
```
Snippet View Results

1. [HIGHLIGHTED TEXT SNIPPET]
   Authors, Year. Title. Journal. [Link to paper]

2. [HIGHLIGHTED TEXT SNIPPET]  
   Authors, Year. Title. Journal. [Link to paper]
```

### Snippet Formatting
- **Highlighted text** from `text_hl` field
- **Entity highlighting** preserved (e.g., `@<m>GENE_FAM177A1</m>`)
- **Clean formatting** with proper line breaks

### Bibliography Formatting
- **Academic style** similar to existing bibliography
- **Author truncation** (first 5, then "et al.")
- **Clickable PubMed links**
- **Hover tooltips** for full author lists

## 🔧 Implementation Steps

### Phase 1: Artifact Type Definition
1. **Add new artifact type** to `src/types/artifacts.ts`
   ```typescript
   | 'application/vnd.snippet-view'
   ```

2. **Update PubTator MCP** to return new artifact type
   ```typescript
   {
     type: "application/vnd.snippet-view",
     title: "PubTator Snippet Results",
     content: {
       snippets: processedResults,
       search_info: searchParams
     }
   }
   ```

### Phase 2: Data Processing
1. **Transform PubTator data** to snippet format
   ```typescript
   interface SnippetEntry {
     snippet: string;        // from text_hl
     authors: string[];      // from authors
     title: string;          // from title
     journal: string;        // from journal
     year: string;           // extracted from date
     pmid: string;           // from pmid
     citation?: string;      // from citations.NLM
   }
   ```

2. **Process text_hl** to clean up entity markup
   ```typescript
   function cleanSnippetText(textHl: string): string {
     // Remove @<m> tags but keep entity names
     // Convert @@@entity@@@ to clean text
     // Preserve highlighting structure
   }
   ```

### Phase 3: UI Component
1. **Add case** to `ArtifactContent.tsx`
   ```typescript
   case 'application/vnd.snippet-view':
     return <SnippetViewRenderer data={artifact.content} />;
   ```

2. **Create SnippetViewRenderer** component
   - Display snippets with highlighting
   - Format bibliography entries
   - Handle entity markup
   - Responsive design

### Phase 4: Integration
1. **Update PubTator MCP** search tool
2. **Test with real data**
3. **Handle edge cases** (missing fields, malformed data)

## 📊 Data Transformation Logic

### Snippet Processing
```typescript
function processSnippetData(results: any[]): SnippetEntry[] {
  return results.map(result => ({
    snippet: cleanSnippetText(result.text_hl),
    authors: result.authors || [],
    title: result.title || 'Untitled',
    journal: result.journal || 'Unknown Journal',
    year: extractYear(result.date),
    pmid: result.pmid?.toString() || '',
    citation: result.citations?.NLM
  }));
}
```

### Text Cleaning
```typescript
function cleanSnippetText(textHl: string): string {
  return textHl
    .replace(/@<m>([^<]+)<\/m>/g, '$1')  // Remove @<m> tags
    .replace(/@@@([^@]+)@@@/g, '$1')     // Remove @@@ markers
    .replace(/@GENE_[^@\s]+/g, '')       // Remove gene IDs
    .replace(/@DISEASE_[^@\s]+/g, '')    // Remove disease IDs
    .trim();
}
```

## 🎯 Expected Benefits

1. **Enhanced Context**: Users see relevant text snippets
2. **Entity Highlighting**: Important terms are visually emphasized
3. **Academic Format**: Proper citation formatting
4. **Interactive Links**: Direct access to full papers
5. **Consistent UI**: Matches existing bibliography style

## 🚧 Challenges & Solutions

### Challenge 1: Entity Markup Complexity
**Problem**: PubTator uses complex markup (`@<m>GENE_FAM177A1</m>`, `@@@FAM177A1@@@`)
**Solution**: Create robust text cleaning function with regex patterns

### Challenge 2: Missing Data Fields
**Problem**: Some papers may lack authors, journal, or other fields
**Solution**: Graceful fallbacks and default values

### Challenge 3: Snippet Length
**Problem**: Snippets may be too long or too short
**Solution**: Truncation with "..." and expandable view option

## 📋 Testing Strategy

1. **Unit Tests**: Data transformation functions
2. **Integration Tests**: Full MCP → UI pipeline
3. **Edge Cases**: Missing data, malformed markup
4. **UI Tests**: Responsive design, accessibility

## 🎯 Success Metrics

- [ ] New artifact type recognized by UI
- [ ] Snippets display with proper highlighting
- [ ] Bibliography formatting matches existing style
- [ ] Clickable PubMed links work
- [ ] Responsive design on mobile/desktop
- [ ] Error handling for missing data

---

**Ready to implement?** This plan provides a clear roadmap for creating the snippet view artifact that combines PubTator's highlighted text with academic bibliography formatting.
