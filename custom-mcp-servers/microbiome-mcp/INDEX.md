# MCP API Integration Template

**🎯 Purpose:** Rapidly create Model Context Protocol (MCP) servers that integrate with external APIs and return both text and structured artifacts.

**⚡ Time to First Working MCP:** ~15-30 minutes  
**📚 Based on:** Proven patterns from PubMed MCP implementation  
**🔧 Difficulty:** Beginner to Intermediate  

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
cd custom-mcp-servers/template2/
./setup.sh your-api-name
```

### Option 2: Manual Setup
```bash
cp -r template2/ your-api-name-mcp/
cd your-api-name-mcp/
npm install
# Follow README.md for customization
```

## 📂 Template Structure

```
template2/
├── src/
│   └── index.ts           # Main template with TODO markers
├── examples/
│   └── newsapi-implementation.md  # Complete real-world example
├── package.json           # Pre-configured dependencies
├── tsconfig.json          # TypeScript configuration
├── env.example            # Environment variable template
├── setup.sh               # Automated project generator
├── README.md              # Comprehensive documentation
├── QUICK_REFERENCE.md     # Fast customization checklist
└── INDEX.md               # This overview file
```

## 📋 What You Get

✅ **Complete MCP Server Skeleton** - All boilerplate code included  
✅ **Input Validation** - Zod schemas for type safety  
✅ **Error Handling** - Robust error management patterns  
✅ **Authentication Support** - Multiple auth patterns (Bearer, API key, etc.)  
✅ **Data Formatting** - Functions for both text and artifact responses  
✅ **TypeScript Ready** - Full type safety and development tools  
✅ **Development Tools** - Build scripts, linting, hot reload  
✅ **Documentation** - Comprehensive guides and examples  

## 🎯 What You Need to Customize

The template is designed so you only need to fill in **7 key sections** marked with `TODO` comments:

1. **API Configuration** (5 min) - Base URL, service name, auth
2. **Input Schemas** (10 min) - Define tool parameters with Zod  
3. **API Authentication** (5 min) - Configure headers/auth pattern
4. **Data Formatting** (10 min) - Format responses for Claude and artifacts
5. **Query Building** (5 min) - Transform parameters to API queries
6. **Tool Definitions** (5 min) - Define available tools and descriptions
7. **Tool Execution** (10 min) - Implement API calls and response handling

**Total estimated time:** 50 minutes for a complete, production-ready MCP server.

## 📖 Documentation Guide

**Start here based on your experience level:**

### 🟢 Beginner
1. **README.md** - Complete step-by-step guide
2. **examples/newsapi-implementation.md** - See a real example
3. **QUICK_REFERENCE.md** - Use as checklist while coding

### 🟡 Intermediate  
1. **QUICK_REFERENCE.md** - Jump straight to customization points
2. **examples/newsapi-implementation.md** - Reference for patterns
3. **README.md** - Reference specific sections as needed

### 🔴 Advanced
1. **src/index.ts** - Review TODO comments and customize directly
2. **QUICK_REFERENCE.md** - Quick validation checklist

## 🌟 Example APIs This Template Supports

**✅ Ready to Use:** JSON REST APIs, XML APIs, GraphQL APIs, HTML scraping  
**✅ Authentication:** Bearer tokens, API keys, Basic auth, Query parameters  
**✅ Response Types:** JSON, XML, HTML, Plain text  
**✅ Use Cases:** Research, News, Data analysis, Content management, Social media  

### Real-World Examples
- **NewsAPI** - Search and retrieve news articles
- **GitHub API** - Repository and issue management  
- **Weather APIs** - Current conditions and forecasts
- **Academic APIs** - Research paper search and citation
- **Financial APIs** - Market data and analysis
- **Social Media APIs** - Posts, profiles, analytics

## 🏗️ Architecture Overview

```
Claude/MCP Client
       ↓
   MCP Protocol
       ↓
  Your MCP Server (this template)
       ↓
   External API
       ↓
  Formatted Response
       ↓
Claude (text + artifacts)
```

**Key Features:**
- **Text Response**: Formatted markdown for Claude to read and analyze
- **Artifacts**: Structured JSON data for programmatic use
- **Error Handling**: Graceful degradation and informative error messages
- **Validation**: Input sanitization and type checking
- **Logging**: Debug information for development and troubleshooting

## 🎨 Artifact Types Supported

The template supports multiple artifact types for different use cases:

- `application/json` - General structured data
- `application/vnd.bibliography` - Research citations and references  
- `application/vnd.dataset` - Tabular data for analysis
- `application/vnd.analytics` - Statistical analysis results
- `application/vnd.news-articles` - News article collections
- Custom types for your specific domain

## ⚠️ Prerequisites

- **Node.js 18+** and npm
- **TypeScript knowledge** (basic level sufficient)
- **API documentation** for the service you want to integrate
- **API credentials** (key, token, etc.) for your target API

## 🤝 Support & Community

**Having issues?**
1. Check **QUICK_REFERENCE.md** for common problems
2. Review the **examples/** folder for working implementations
3. Verify your API credentials and endpoint URLs
4. Check the debug logs for detailed error information

**Want to contribute?**
- Submit example implementations for popular APIs
- Improve documentation and add more patterns
- Report bugs or suggest enhancements
- Share your successful integrations

## 📈 Success Stories

This template pattern has been successfully used to create MCP servers for:
- PubMed research paper search
- News aggregation and analysis
- Weather data integration  
- GitHub repository management
- Financial market data access
- Academic citation management

---

**Ready to build your MCP server?** Start with the automated setup or dive into the README.md for detailed guidance. Most developers have a working integration within 30 minutes! 🚀 