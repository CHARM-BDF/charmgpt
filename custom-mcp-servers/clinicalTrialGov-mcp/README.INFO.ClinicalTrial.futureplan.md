# ClinicalTrials.gov MCP - Future Enhancement Plans

## Overview

This document outlines potential enhancements to the ClinicalTrials.gov MCP server, particularly focused on supporting rare disease research. These enhancements would add additional search capabilities beyond the current basic search functionality.

## Current Capabilities

The current `search-trials` tool supports:
- Condition/disease searches (with validation)
- Intervention/treatment searches (with validation)
- General term searches (with automatic cleaning of restrictive words)
- Term validation against ClinicalTrials.gov dictionaries
- Dosing information extraction and summarization

## Proposed Additional Search Types

### 1. Status-Based Filtering

**Priority: HIGH** - Critical for patient referrals and finding active trials

**API Parameter:** `filter.overallStatus`

**Use Cases:**
- Find actively recruiting trials for patient referrals
- Track completed trials for outcomes data
- Identify trials that are no longer recruiting

**Possible Status Values:**
- `RECRUITING` - Actively enrolling participants
- `ACTIVE_NOT_RECRUITING` - Study ongoing but not enrolling
- `COMPLETED` - Study has ended
- `TERMINATED` - Study stopped early
- `SUSPENDED` - Temporarily paused
- `WITHDRAWN` - Study withdrawn before enrollment
- `UNKNOWN` - Status not verified

**Example Tool:**
```typescript
{
  name: "search-recruiting-trials",
  description: "Search for actively recruiting clinical trials",
  parameters: {
    condition: string,
    intervention: string,
    other_terms: string,
    status: "RECRUITING" | "ACTIVE_NOT_RECRUITING" | "COMPLETED" | ...
  }
}
```

### 2. Phase-Specific Searches

**Priority: HIGH** - Early phase trials are critical for rare diseases

**API Parameter:** `filter.phase`

**Use Cases:**
- Find Phase 1/2 trials for experimental treatments
- Identify Phase 3 trials for regulatory approval
- Track Phase 4 post-marketing studies

**Possible Phase Values:**
- `PHASE1` - Safety and dosage
- `PHASE2` - Efficacy and side effects
- `PHASE3` - Confirmatory studies
- `PHASE4` - Post-marketing surveillance
- `EARLY_PHASE1` - Very early stage
- `NOT_APPLICABLE` - Observational studies

**Example Tool:**
```typescript
{
  name: "search-by-phase",
  description: "Search clinical trials filtered by study phase",
  parameters: {
    condition: string,
    intervention: string,
    phases: string[] // ["PHASE1", "PHASE2"]
  }
}
```

### 3. Location-Based Searches

**Priority: MEDIUM** - Important for patient accessibility

**API Parameter:** `query.locn`

**Use Cases:**
- Find trials near specific geographic locations
- Identify international trial sites
- Filter by country, state, or city

**Example Tool:**
```typescript
{
  name: "search-by-location",
  description: "Search clinical trials by geographic location",
  parameters: {
    condition: string,
    intervention: string,
    location: string, // "United States", "California", "Boston"
    radius_miles?: number // Optional radius for proximity search
  }
}
```

### 4. Date Range Filtering

**Priority: MEDIUM** - Useful for tracking recent research

**API Parameter:** `filter.advanced` (with date parameters)

**Use Cases:**
- Find trials started in the last 2 years
- Track upcoming trial start dates
- Historical analysis of trial trends
- Find recently completed trials with results

**Example Tool:**
```typescript
{
  name: "search-by-date-range",
  description: "Search clinical trials within a date range",
  parameters: {
    condition: string,
    intervention: string,
    start_date?: string, // "2020-01-01"
    completion_date?: string, // "2025-12-31"
    last_updated_since?: string // "2024-01-01"
  }
}
```

### 5. Sponsor/Collaborator Searches

**Priority: MEDIUM** - Track research by organization type

**API Parameters:** `query.spons`, `query.lead`

**Use Cases:**
- Find trials sponsored by rare disease foundations
- Track industry vs. academic research
- Identify trials by specific pharmaceutical companies
- Find NIH-funded rare disease research

**Example Tool:**
```typescript
{
  name: "search-by-sponsor",
  description: "Search clinical trials by sponsor or collaborator",
  parameters: {
    condition: string,
    sponsor_name: string, // "National Institutes of Health", "Pfizer"
    sponsor_type?: "INDUSTRY" | "NIH" | "OTHER"
  }
}
```

### 6. Age-Specific Searches

**Priority: MEDIUM** - Important for pediatric rare diseases

**API Parameter:** `filter.age`

**Use Cases:**
- Find pediatric trials for rare childhood diseases
- Identify adult-only trials
- Track age-specific treatment protocols

**Possible Age Values:**
- `CHILD` - 0-17 years
- `ADULT` - 18-64 years
- `OLDER_ADULT` - 65+ years

**Example Tool:**
```typescript
{
  name: "search-by-age",
  description: "Search clinical trials filtered by age group",
  parameters: {
    condition: string,
    intervention: string,
    age_groups: string[] // ["CHILD", "ADULT"]
  }
}
```

### 7. Expanded Access / Compassionate Use

**Priority: HIGH** - Critical for rare disease patients

**API Parameter:** `filter.studyType` or `query.term: "expanded access"`

**Use Cases:**
- Find expanded access programs for patients who can't participate in trials
- Identify compassionate use protocols
- Track treatment access outside of formal trials

**Example Tool:**
```typescript
{
  name: "search-expanded-access",
  description: "Search for expanded access/compassionate use programs",
  parameters: {
    condition: string,
    intervention: string
  }
}
```

### 8. Orphan Drug Designation Searches

**Priority: MEDIUM** - Relevant for rare disease research

**API Parameter:** `query.term: "orphan"` or `query.term: "orphan drug designation"`

**Use Cases:**
- Find trials with FDA orphan drug designation
- Track rare disease drug development
- Identify incentives for rare disease research

**Example Tool:**
```typescript
{
  name: "search-orphan-drug-trials",
  description: "Search for clinical trials with orphan drug designation",
  parameters: {
    condition: string,
    intervention?: string
  }
}
```

### 9. Study Type Filtering

**API Parameter:** `filter.studyType`

**Use Cases:**
- Distinguish interventional vs. observational studies
- Find expanded access programs
- Identify registry studies

**Possible Types:**
- `INTERVENTIONAL` - Treatment studies
- `OBSERVATIONAL` - Observational/registry studies
- `EXPANDED_ACCESS` - Compassionate use

### 10. Combination Search Tool

**Priority: HIGH** - Most flexible and powerful

**Example Tool:**
```typescript
{
  name: "search-trials-advanced",
  description: "Advanced search with multiple filters",
  parameters: {
    condition?: string,
    intervention?: string,
    other_terms?: string,
    status?: string[], // ["RECRUITING", "ACTIVE_NOT_RECRUITING"]
    phases?: string[], // ["PHASE1", "PHASE2"]
    location?: string,
    age_groups?: string[],
    study_type?: string,
    start_date?: string,
    completion_date?: string,
    sponsor?: string,
    max_results?: number
  }
}
```

## Implementation Priority

### Phase 1 (High Priority)
1. **Status filtering** - Essential for finding active trials
2. **Phase filtering** - Critical for rare disease research (often Phase 1/2)
3. **Expanded access search** - Important for patient access

### Phase 2 (Medium Priority)
4. **Location filtering** - Patient accessibility
5. **Date range filtering** - Recent research tracking
6. **Age group filtering** - Pediatric rare diseases

### Phase 3 (Lower Priority)
7. **Sponsor filtering** - Research tracking
8. **Orphan drug searches** - Specialized use case
9. **Combination advanced search** - Most flexible but complex

## Technical Considerations

### API Limitations
- Some filters may require specific parameter formats
- Not all combinations may be supported
- Response pagination may be needed for large result sets

### Implementation Approach
1. **Option A:** Add parameters to existing `search-trials` tool
   - Pros: Single tool, simpler interface
   - Cons: Tool becomes complex with many optional parameters

2. **Option B:** Create separate specialized tools
   - Pros: Clear separation of concerns, easier to use
   - Cons: More tools to maintain, potential duplication

3. **Option C:** Hybrid approach
   - Keep `search-trials` for basic searches
   - Add `search-trials-advanced` for filtered searches
   - Add specialized tools for common use cases (recruiting, expanded access)

**Recommendation:** Option C (Hybrid approach)

## Additional Features to Consider

### Result Sorting
- Sort by: relevance, start date, completion date, last updated
- API Parameter: `sort`

### Pagination Support
- Handle large result sets with `pageToken`
- Support for retrieving all results across multiple pages

### Result Formatting Enhancements
- Group results by status, phase, or location
- Highlight recruiting trials
- Show distance from location (if location search implemented)
- Include sponsor information in summary

### Autocomplete Enhancements
- Add autocomplete for locations
- Add autocomplete for sponsor names
- Add autocomplete for study phases

## Use Case Examples

### Example 1: Finding Active Trials for Patient Referral
```
Tool: search-recruiting-trials
Parameters:
  - condition: "Duchenne muscular dystrophy"
  - location: "United States"
  - age_groups: ["CHILD"]
Result: List of actively recruiting trials with locations
```

### Example 2: Tracking Early-Stage Research
```
Tool: search-by-phase
Parameters:
  - condition: "rare genetic disorder"
  - phases: ["PHASE1", "PHASE2"]
  - status: ["RECRUITING", "ACTIVE_NOT_RECRUITING"]
Result: Early-stage trials that are active
```

### Example 3: Finding Expanded Access Programs
```
Tool: search-expanded-access
Parameters:
  - condition: "ultra-rare disease"
  - intervention: "experimental treatment"
Result: Expanded access programs for patients who can't join trials
```

### Example 4: Recent Research Analysis
```
Tool: search-by-date-range
Parameters:
  - condition: "rare disease"
  - start_date: "2023-01-01"
  - completion_date: "2025-12-31"
Result: Trials started or completed in the last 2-3 years
```

## Notes

- All proposed tools should maintain the same validation and term cleaning logic
- Dosing information extraction should be included in all search results
- Markdown artifacts should be generated for all result types
- Consider rate limiting for API calls if implementing multiple tools
- Some API parameters may require testing to confirm exact format and behavior

