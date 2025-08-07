

Here’s an outline of a **complete plan** and corresponding **file/folder structure** for building an MCP server that:

* Loads markdown biomedical documents
* Chunks and indexes them semantically
* Responds to a question with the most relevant information (used internally by an LLM, not shown to the user)

---

## ✅ **MCP Server Plan Overview**

### 🔁 Workflow Summary:

1. **Ingest & Chunk** markdown biomedical documents (e.g., ADPKD materials).
2. **Embed** each chunk using a model (e.g., OpenAI, SentenceTransformers).
3. **Store** chunks in a vector store (e.g., Qdrant, Weaviate, or local FAISS).
4. **Serve** an MCP tool: `pkd_context_provider`

   * Accepts a user question
   * Embeds the question
   * Finds most relevant chunks
   * Returns selected chunks as hidden LLM context (not user-visible)

---

## 📁 **File/Folder Structure**

```
mcp-pkd-context-server/
│
├── 📁 data/
│   ├── adpkd_uti.md             ← Raw markdown files about PKD
│   └── ...                      ← Additional PKD documents
│
├── 📁 src/
│   ├── 📁 chunking/
│   │   └── markdownChunker.ts   ← Splits markdown by headers + paragraph, adds overlap
│   │
│   ├── 📁 embedding/
│   │   └── embedder.ts          ← Converts chunks/questions into vector embeddings
│   │
│   ├── 📁 store/
│   │   ├── vectorStore.ts       ← Loads/saves/query chunks using FAISS or Qdrant
│   │   └── metadataTypes.ts     ← Defines metadata schema for each chunk
│   │
│   ├── 📁 tools/
│   │   └── pkdContextProvider.ts ← MCP tool logic: receives question, returns context
│   │
│   └── server.ts                ← Starts the MCP server and registers the tool
│
├── 📁 scripts/
│   └── indexMarkdownFiles.ts   ← CLI to ingest, chunk, embed, and index all .md files
│
├── 📁 config/
│   └── settings.json            ← Config for embedding model, vector DB URL, etc.
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📄 **What Each Component Does**

### 📁 `data/`

Contains all markdown files that describe aspects of polycystic kidney disease (e.g., ADPKD infections). These are pre-loaded, chunked, and embedded.

---

### 📁 `src/chunking/markdownChunker.ts`

* Parses markdown files
* Splits by `#`, `##`, `###`, etc.
* Further splits large sections by paragraphs (with overlap)
* Outputs chunks with section metadata

---

### 📁 `src/embedding/embedder.ts`

* Uses an embedding model (e.g., OpenAI `text-embedding-3-small`) to turn chunks or queries into vectors
* Exports `embedText(text: string): number[]`

---

### 📁 `src/store/vectorStore.ts`

* Stores/retrieves embedded chunks using FAISS, Qdrant, or another vector DB
* Exports:

  * `storeChunk(chunk: Chunk)`
  * `querySimilarChunks(queryVector: number[], topK: number): Chunk[]`

---

### 📁 `src/tools/pkdContextProvider.ts`

* Implements MCP tool:

  * Receives a question from the MCP runtime
  * Embeds the question
  * Queries vector DB
  * Returns top chunks as `context` (not as artifacts)

---

### 📁 `src/server.ts`

* Bootstraps the MCP tool
* Registers it to respond to LLM agent requests
* Can optionally preload or monitor the `data/` folder for new files

---

### 📁 `scripts/indexMarkdownFiles.ts`

* CLI tool to:

  * Load files from `data/`
  * Chunk them
  * Embed them
  * Store in vector DB
* Run this once or on file changes

---

### 📁 `config/settings.json`

Holds:

```json
{
  "embeddingModel": "openai:text-embedding-3-small",
  "vectorDb": "http://localhost:6333",
  "chunkSize": 300,
  "chunkOverlap": 75
}
```

---

## 🚀 Development Plan (Step-by-Step)

1. **Set up the project**: TypeScript + Node.js
2. **Implement `markdownChunker.ts`** to process docs
3. **Use OpenAI or local embeddings** to generate vectors
4. **Choose vector store (Qdrant or FAISS) and set up indexing**
5. **Create and test the `pkdContextProvider` tool**
6. **Register the tool with your MCP runtime (`server.ts`)**
7. **Test with real user questions about PKD**

---

Would you like me to generate an initial version of this as code (e.g. `markdownChunker.ts` or `pkdContextProvider.ts`)?



# ADDITIONAL INFORMATION

Thanks — this is a rich and well-structured biomedical document, and it’s well-suited to chunking and retrieval for context injection. Given your goal (select *only the relevant context for an LLM to use* — not expose the source directly), your original plan remains valid, but we should be smart about chunking and metadata.

---

### ✅ Confirmed Strategy: Silent Retrieval + Context Injection

We **do not need to change the architecture**, but here’s how to **chunk this kind of markdown document effectively** to optimize retrieval:

---

## 🧱 Chunking Strategy for Biomedical Documents

### 🎯 Goals:

* Enable semantic relevance in vector search
* Preserve clinical context (e.g. don't cut mid-symptom list)
* Retain section-based structure for interpretability

---

### ✅ Recommended: **Section-Aware Chunking + Sliding Window (Optional)**

---

#### 1. **Split by Section Headers**

Markdown docs like yours use headings like `## DIAGNOSIS` or `### Management`. These are natural chunk boundaries.

```ts
const sectionChunks = splitByMarkdownHeaders(markdownText);
```

---

#### 2. **Subdivide Large Sections (if needed)**

Some sections (like `MANAGEMENT`) are long. Use paragraph-based chunking with overlap:

```ts
function chunkSection(sectionText: string): string[] {
  return slidingWindowChunks(sectionText, {
    maxTokens: 300,     // or ~1,200 characters
    overlap: 100        // ~20–30% token overlap
  });
}
```

This maintains context while avoiding mid-sentence splits.

---

#### 3. **Attach Metadata for Search Filtering (optional)**

Add metadata per chunk:

```json
{
  "doc_id": "ADPKD_UTI",
  "section": "Management",
  "subsection": "Empiric antimicrobial therapy",
  "source_url": "...",
  "tokens": 298
}
```

You can then optionally filter or rerank results based on section type (e.g., prefer `Diagnosis` for "how is it diagnosed?").

---

## 🧠 Inference-Time Prompting

When a user asks:

> “What antibiotics are best for treating a kidney cyst infection in ADPKD?”

You embed the query, retrieve (say) 2–3 chunks, then inject into your final LLM call:

```json
[
  {
    "role": "system",
    "content": "You are a biomedical assistant answering questions about ADPKD. Use the background below to help answer."
  },
  {
    "role": "system",
    "content": "Context:\n" + retrievedChunks.join("\n\n")
  },
  {
    "role": "user",
    "content": "What antibiotics are best for treating a kidney cyst infection in ADPKD?"
  }
]
```

✅ **The user never sees the raw document**, but the LLM benefits from it.

---

## 🧰 Want Code?

I can provide:

* A TypeScript function to **chunk markdown using headers and paragraph limits**
* A script to **embed + store chunks in a vector DB**
* A simple MCP tool that accepts a question, retrieves relevant chunk(s), and returns context

Would you like that as:

* A single `.ts` file example
* A full MCP tool module template
* Or a step-by-step integration guide?

Let me know your preferred level of help.
