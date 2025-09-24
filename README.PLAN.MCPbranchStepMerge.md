# MCP Branch Step-by-Step Merge Plan

**🎯 Purpose:** This document outlines the incremental merge strategy for integrating `origin/new_MCP_for_casework` branch into the current codebase while minimizing risk and maintaining system stability.

**📅 Created:** $(date)  
**🔄 Status:** [ ] Planning | [ ] In Progress | [ ] Completed  
**👤 Maintainer:** [Your Name]

**🏗️ Important Note:** The current codebase has been reorganized into a monorepo structure:
- `frontend-client/` - React frontend application
- `backend-mcp-client/` - Backend MCP services  
- `shared/` - Shared utilities
- `custom-mcp-servers/` - MCP server implementations (unchanged)
- `system-tests/` - E2E testing workspace

The source branch (`origin/new_MCP_for_casework`) still uses the old structure with everything in `src/`. This plan accounts for the path differences and includes manual file movement steps.

**🐛 Debugging Reference:** If you encounter issues during or after the merge, consider these recent major changes that could be related:
- **Console Logging Reduction:** Removed verbose `[STREAM DEBUG]` and `[DEBUG]` logging from `frontend-client/src/store/chatStore.ts` to reduce console noise
- **Graph Data Sanitization:** Added comprehensive NaN value prevention and position data validation in `ReagraphKnowledgeGraphViewer.tsx` 
- **MCP Configuration Updates:** Added new MCP servers (pubtator, dgidb, gene-enrich, ttd, etc.) to `backend-mcp-client/config/mcp_server_config.json`
- **Three.js Version Conflicts:** Added package.json resolutions to force consistent Three.js version across dependencies
- **UI Component Enhancements:** Made artifact buttons wrap properly and reduced console spam from graph rendering
- **React Version Rollback:** Rolled back to React 18.3.1 + Reagraph 4.21.2 to match the working combination from source branch (avoided React 19 upgrade to prevent codebase-wide impacts)

These changes were made to improve performance, reduce console noise, and fix rendering issues. If problems arise, check if they're related to these modifications.  

---

## 🚨 **Pre-Merge Assessment**

### **Current State Analysis**
- **Source Branch:** `origin/new_MCP_for_casework`
- **Target Branch:** `tool-granular` (current working branch)
- **Conflict Level:** HIGH - Significant structural changes detected
- **Risk Assessment:** MEDIUM-HIGH - Requires careful incremental approach

### **Key Conflicts Identified**
- Directory structure changes (`src/` → `frontend-client/src/` and `backend-mcp-client/src/`)
- Configuration file conflicts (`mcp_server_config.json`, `package.json`)
- Core service conflicts (`mcp.ts`, `chatStore.ts`)
- Build system conflicts (`tsconfig.app.tsbuildinfo`)
- **RESOLVED:** Monorepo structure already implemented (frontend-client/, backend-mcp-client/, shared/)

---

## 📋 **Merge Phases Overview**

| Phase | Component | Risk Level | Estimated Time | Dependencies |
|-------|-----------|------------|----------------|--------------|
| 1 | New MCP Servers | 🟢 Low | 2-3 hours | None |
| 2 | Dependencies & Config | 🟡 Medium | 1-2 hours | Phase 1 |
| 3 | New Components | 🟡 Medium | 3-4 hours | Phase 2 |
| 4 | State Management | 🔴 High | 2-3 hours | Phase 3 |
| 5 | Data & Utilities | 🟢 Low | 1 hour | Phase 4 |

---

## 🔄 **Phase 1: New MCP Servers** 
**Status:** [x] Not Started | [x] In Progress | [x] Completed | [ ] Failed

### **Objective**
Add new MCP servers without affecting existing functionality.

### **Components to Merge**
```bash
# New MCP Servers (Low Risk)
custom-mcp-servers/annotation-mcp/
custom-mcp-servers/bibliography-ranker-mcp/
custom-mcp-servers/chembl-mcp/
custom-mcp-servers/dgidb-mcp/
custom-mcp-servers/drugcentral-mcp/
custom-mcp-servers/gene-enrich-mcp/
custom-mcp-servers/gene-fetcher/
custom-mcp-servers/gtex-fetcher/
custom-mcp-servers/hpa-mcp/
custom-mcp-servers/microbiome-mcp/
custom-mcp-servers/pubtator-mcp/
custom-mcp-servers/translator2-mcp/
custom-mcp-servers/translator3-mcp/
custom-mcp-servers/ttd-mcp/
custom-mcp-servers/variant-domain-mcp/
custom-mcp-servers/variant-litsearch-mcp/
custom-mcp-servers/wiki-disease-mcp/
```

### **Commands**
```bash
# Create feature branch
git checkout -b feature/merge-new-mcp-servers

# Merge MCP servers directory
git checkout origin/new_MCP_for_casework -- custom-mcp-servers/

# Commit changes
git add custom-mcp-servers/
git commit -m "Add new MCP servers from new_MCP_for_casework branch

- Added 17 new MCP servers for biomedical research
- Includes PubTator, ChEMBL, DrugCentral, and other databases
- All servers include documentation and examples"

# Test build
npm run build

# Start application for UI testing
npm run dev
```

### **UI Testing Steps**
```bash
# 1. Start the application
npm run dev

# 2. Open browser to http://localhost:3000 (or your dev port)

# 3. Navigate to MCP server configuration/settings

# 4. Verify new MCP servers appear in the server list:
#    - annotation-mcp
#    - bibliography-ranker-mcp  
#    - chembl-mcp
#    - dgidb-mcp
#    - drugcentral-mcp
#    - gene-enrich-mcp
#    - gene-fetcher
#    - gtex-fetcher
#    - hpa-mcp
#    - microbiome-mcp
#    - pubtator-mcp
#    - translator2-mcp
#    - translator3-mcp
#    - ttd-mcp
#    - variant-domain-mcp
#    - variant-litsearch-mcp
#    - wiki-disease-mcp

# 5. Test each MCP server by:
#    - Enabling the server
#    - Checking that tools are loaded
#    - Testing a simple tool call
#    - Verifying response format
```

### **Testing Checklist**
- [x] All MCP servers compile without errors
- [x] No conflicts with existing MCP servers
- [x] Documentation files are properly formatted
- [x] Package.json files are valid
- [x] **UI Testing:** Start application and verify new MCP servers appear in server list
- [ ] **UI Testing:** Test each new MCP server through the UI interface
- [ ] **UI Testing:** Verify MCP server tools are accessible and functional
- [ ] **UI Testing:** Test MCP server responses and error handling

### **Rollback Procedure**
```bash
git reset --hard HEAD~1  # Undo the commit
git clean -fd custom-mcp-servers/  # Remove untracked files
```

---

## 🔄 **Phase 2: Dependencies & Configuration**
**Status:** [ ] Not Started | [ ] In Progress | [ ] Completed | [ ] Failed

### **Objective**
Update dependencies and MCP server configurations.

### **Components to Merge**
```bash
# Dependencies
package.json
package-lock.json

# Configuration (SKIP - MCP config already working)
# backend-mcp-client/config/mcp_server_config.json - ALREADY CONFIGURED
# backend-mcp-client/config/mcp_server_config.example.json - NOT NEEDED
```

### **Commands**
```bash
# SKIP MCP config - already working with new MCPs added
# Current config in backend-mcp-client/config/mcp_server_config.json is correct

# SKIP package.json merge - packages already split between workspaces
# Most packages from source branch are already present in frontend-client/ and backend-mcp-client/
# Missing packages were analyzed and found to be unused in main application code

# Only need to check for version updates if any packages are newer in source branch
# No new packages need to be added based on thorough codebase analysis

# Install dependencies (if any version updates were made)
npm install
```

### **Package Analysis Results**
**✅ COMPLETED:** Thorough analysis of missing packages from source branch:

**❌ NOT USED (Can Skip):**
- `@modelcontextprotocol/server-brave-search` - Not found in codebase
- `@modelcontextprotocol/server-puppeteer` - Only in pubmed-mcp package files
- `openapi-mcp-server` - Only in config examples and docs
- `fast-xml-parser` - Only in MCP server package files
- `python-shell` - Only in python-mcp and r-mcp package files
- `ajv` - Only in package-lock.json files

**✅ ALREADY PRESENT:**
- All major packages (AI SDKs, UI components, graph visualization) already in workspaces
- Many packages are newer versions than source branch
- Packages properly split between frontend-client/ and backend-mcp-client/

**📋 CONCLUSION:** Phase 2 can skip package merging entirely - no new packages needed.

### **Testing Checklist**
- [ ] `npm install` completes without errors
- [ ] Build process works (`npm run build`)
- [ ] MCP server configurations are valid (already working)
- [ ] No dependency conflicts

### **Rollback Procedure**
```bash
# No rollback needed - no package.json changes made
# MCP config is already working and doesn't need rollback
# If any version updates were made, they can be reverted individually
```

---

## 🔄 **Phase 3: New Components**
**Status:** [x] Not Started | [x] In Progress | [x] Completed | [ ] Failed

### **Objective**
Add new React components for enhanced functionality.

### **Components to Merge**
```bash
# New Components (Updated paths for monorepo structure)
frontend-client/src/components/artifacts/MasterGraphWorkspaceViewer.tsx
frontend-client/src/components/artifacts/ProteinVisualizationViewer.tsx

# Enhanced Components (manual merge required, updated paths)
frontend-client/src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx
frontend-client/src/components/artifacts/ArtifactContent.tsx
frontend-client/src/components/chat/ChatInterface.tsx
frontend-client/src/components/chat/AssistantMarkdown.tsx
```

### **Commands**
```bash
# Create feature branch
git checkout -b feature/merge-new-components

# Add new components (source branch has old structure)
git checkout origin/new_MCP_for_casework -- src/components/artifacts/MasterGraphWorkspaceViewer.tsx
git checkout origin/new_MCP_for_casework -- src/components/artifacts/ProteinVisualizationViewer.tsx

# Move to new monorepo structure
mkdir -p frontend-client/src/components/artifacts
mv src/components/artifacts/MasterGraphWorkspaceViewer.tsx frontend-client/src/components/artifacts/
mv src/components/artifacts/ProteinVisualizationViewer.tsx frontend-client/src/components/artifacts/

# Manual merge for enhanced components (resolve conflicts)
git checkout origin/new_MCP_for_casework -- src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx
# Move to new location
mv src/components/artifacts/ReagraphKnowledgeGraphViewer.tsx frontend-client/src/components/artifacts/
# Resolve conflicts manually, keeping both old and new functionality

# Update imports and paths for monorepo structure
# All imports need to be updated for new paths
```

### **Testing Checklist**
- [ ] Components compile without TypeScript errors
- [ ] New components render correctly
- [ ] Enhanced components maintain existing functionality
- [ ] No broken imports or missing dependencies

### **Rollback Procedure**
```bash
git reset --hard HEAD~1
git clean -fd frontend-client/src/components/artifacts/
```

---

## 🔄 **Phase 4: State Management**
**Status:** [ ] Not Started | [ ] In Progress | [ ] Completed | [ ] Failed

### **Objective**
Update core state management with enhanced workspace functionality.

### **Components to Merge**
```bash
# Core State Management (Updated paths for monorepo structure)
frontend-client/src/store/chatStore.ts

# Supporting Files (Updated paths)
frontend-client/src/types/artifacts.ts
frontend-client/src/types/nightingale.d.ts
frontend-client/src/mcp/types.ts
```

### **Commands**
```bash
# Create feature branch
git checkout -b feature/merge-state-management

# Backup current store
cp frontend-client/src/store/chatStore.ts frontend-client/src/store/chatStore.ts.backup

# Manual merge (high conflict potential, source branch has old structure)
git checkout origin/new_MCP_for_casework -- src/store/chatStore.ts
# Move to new location
mv src/store/chatStore.ts frontend-client/src/store/chatStore.ts
# Resolve conflicts carefully, preserving existing functionality

# Update type definitions (source branch has old structure)
git checkout origin/new_MCP_for_casework -- src/types/artifacts.ts
git checkout origin/new_MCP_for_casework -- src/types/nightingale.d.ts
# Move to new location
mv src/types/artifacts.ts frontend-client/src/types/artifacts.ts
mv src/types/nightingale.d.ts frontend-client/src/types/nightingale.d.ts
```

### **Testing Checklist**
- [ ] Application starts without errors
- [ ] Chat functionality works
- [ ] Graph visualization works
- [ ] Workspace functionality works (if implemented)
- [ ] No state management regressions

### **Rollback Procedure**
```bash
cp frontend-client/src/store/chatStore.ts.backup frontend-client/src/store/chatStore.ts
git checkout HEAD~1 -- frontend-client/src/types/artifacts.ts frontend-client/src/types/nightingale.d.ts
```

---

## 🔄 **Phase 5: Data & Utilities**
**Status:** [ ] Not Started | [ ] In Progress | [ ] Completed | [ ] Failed

### **Objective**
Add protein data files and utility scripts.

### **Components to Merge**
```bash
# Data Files
egfr_complete_domains_ptm_summary.json
egfr_domains_ptm_data.json
egfr_hpa_data.json
egfr_interpro.json

# Utility Scripts
get-egfr-domains-ptm.mjs
get-hpa-egfr.mjs
parse-interpro.mjs

# Documentation
interpro-vs-uniprot-comparison.md
chembl_mcp_research_comparison.md
```

### **Commands**
```bash
# Create feature branch
git checkout -b feature/merge-data-utilities

# Add data files
git checkout origin/new_MCP_for_casework -- egfr_*.json
git checkout origin/new_MCP_for_casework -- get-*.mjs
git checkout origin/new_MCP_for_casework -- parse-interpro.mjs

# Add documentation
git checkout origin/new_MCP_for_casework -- *.md

# Commit
git add .
git commit -m "Add protein data files and utility scripts

- Added EGFR protein domain and PTM data
- Added utility scripts for data processing
- Added research comparison documentation"
```

### **Testing Checklist**
- [ ] Data files are valid JSON
- [ ] Utility scripts run without errors
- [ ] Documentation is properly formatted

### **Rollback Procedure**
```bash
git reset --hard HEAD~1
git clean -fd *.json *.mjs *.md
```

---

## 🧪 **Integration Testing**

### **After Each Phase**
```bash
# Build test
npm run build

# Type check
npm run type-check

# Lint check
npm run lint

# Start application for UI testing
npm run dev

# UI Testing Checklist:
# - [ ] Application starts without errors
# - [ ] UI loads correctly
# - [ ] MCP servers are accessible (if applicable)
# - [ ] New features work as expected (if applicable)
# - [ ] No console errors in browser
# - [ ] No broken functionality from previous phases
```

### **Final Integration Test**
```bash
# Full test suite
npm test

# End-to-end testing
npm run test:e2e

# MCP server connectivity test
npm run test:mcp

# Comprehensive UI Testing
npm run dev

# UI Integration Test Checklist:
# - [ ] All new MCP servers are available and functional
# - [ ] Enhanced graph visualization works
# - [ ] Workspace management features work (if implemented)
# - [ ] Protein visualization works (if implemented)
# - [ ] Chat interface handles new MCP tools correctly
# - [ ] Knowledge graph rendering works with new data
# - [ ] No performance regressions
# - [ ] All existing functionality still works
```

---

## 📊 **Progress Tracking**

### **Phase Completion Status**
- [x] Phase 1: New MCP Servers
- [ ] Phase 2: Dependencies & Configuration  
- [ ] Phase 3: New Components
- [ ] Phase 4: State Management
- [ ] Phase 5: Data & Utilities

### **Issues Encountered**
| Phase | Issue | Resolution | Status |
|-------|-------|------------|--------|
| Phase 1 | medik-mcp has TypeScript syntax errors | Skipped problematic server for now | Resolved |
| Phase 1 | translator2-mcp missing src directory | Only has test scripts, no actual MCP server | Resolved |
| Phase 1 | Backend has many linting errors | Style issues only, doesn't prevent functionality | Resolved |

### **UI Testing Results**
| MCP Server | UI Accessible | Tools Loaded | Tested | Notes |
|------------|---------------|--------------|--------|-------|
| annotation-mcp | [ ] | [ ] | [ ] | |
| bibliography-ranker-mcp | [ ] | [ ] | [ ] | |
| chembl-mcp | [ ] | [ ] | [ ] | |
| dgidb-mcp | [ ] | [ ] | [ ] | |
| drugcentral-mcp | [ ] | [ ] | [ ] | |
| gene-enrich-mcp | [ ] | [ ] | [ ] | |
| gene-fetcher | [ ] | [ ] | [ ] | |
| gtex-fetcher | [ ] | [ ] | [ ] | |
| hpa-mcp | [ ] | [ ] | [ ] | |
| microbiome-mcp | [ ] | [ ] | [ ] | |
| pubtator-mcp | [ ] | [ ] | [ ] | |
| translator2-mcp | [ ] | [ ] | [ ] | |
| translator3-mcp | [ ] | [ ] | [ ] | |
| ttd-mcp | [ ] | [ ] | [ ] | |
| variant-domain-mcp | [ ] | [ ] | [ ] | |
| variant-litsearch-mcp | [ ] | [ ] | [ ] | |
| wiki-disease-mcp | [ ] | [ ] | [ ] | |

### **Notes & Observations**
- **Date:** [Date] - [Notes]
- **Date:** [Date] - [Notes]

---

## 🚨 **Emergency Procedures**

### **Complete Rollback**
```bash
# If everything goes wrong, rollback to original state
git checkout tool-granular
git branch -D feature/merge-*
git clean -fd
npm install
```

### **Partial Rollback**
```bash
# Rollback specific phase
git checkout tool-granular -- <specific-files>
git add <specific-files>
git commit -m "Rollback <phase-name>"
```

---

## 📝 **Post-Merge Tasks**

### **Cleanup**
- [ ] Remove backup files
- [ ] Update documentation
- [ ] Clean up feature branches
- [ ] Update this plan with lessons learned

### **Documentation Updates**
- [ ] Update main README.md
- [ ] Update MCP server documentation
- [ ] Update API documentation
- [ ] Update deployment instructions

---

**📋 Last Updated:** [Date]  
**👤 Updated By:** [Name]  
**🔄 Next Review:** [Date]
