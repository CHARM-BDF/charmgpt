Great! Here's a **step-by-step instruction plan** for building the PKD document selector MCP tool using your coding assistant. It breaks the process into modular tasks so you can ask for help at any stage — and I’ll be able to help you implement each component easily.

---

## ✅ Project Goal

Build an MCP server that:

* Ingests markdown biomedical documents
* Chunks and embeds them
* Indexes them in a vector store
* Responds to a user’s question with relevant context (but not visible text)
* Injects that context silently into an LLM for question answering

---

## 🧩 Step-by-Step Plan (MCP + Vector RAG Setup)

---

### 🔧 STEP 1: **Project Setup**

#### Objective:

Create a new Node.js + TypeScript project and install dependencies.

#### Tasks:

* Initialize project:

  ```bash
  npm init -y
  npm install typescript ts-node @types/node --save-dev
  npx tsc --init
  ```
* Install dependencies:

  ```bash
  npm install openai dotenv axios
  npm install qdrant-client # or faiss if using local
  ```
* Add folder structure:

  ```
  mkdir -p src/{chunking,embedding,store,tools}
  mkdir data config scripts
  touch src/server.ts
  ```

---

### 🧠 STEP 2: **Chunk Markdown Files**

#### Objective:

Split long markdown files into semantically meaningful sections.

#### Tasks:

* Create `src/chunking/markdownChunker.ts`
* Function: `chunkMarkdown(text: string): Chunk[]`

  * Use regex to split on `##`, `###`
  * Inside each section, break by paragraph (\~300–500 words)
  * Add optional overlap (e.g., 1 paragraph)

✅ When done: You'll have an array of `{ text, section, fileName }` objects

---

### 🤖 STEP 3: **Embed the Chunks**

#### Objective:

Generate vector embeddings from text chunks.

#### Tasks:

* Create `src/embedding/embedder.ts`
* Load OpenAI embedding API key from `.env`
* Function: `embedText(text: string): Promise<number[]>`
* Wrapper: `embedChunks(chunks: Chunk[]): Promise<EmbeddedChunk[]>`

✅ Output is embedded vectors ready for vector DB storage.

---

### 🧱 STEP 4: **Index with Vector Store**

#### Objective:

Store embedded chunks in a searchable vector database.

#### Tasks:

* Create `src/store/vectorStore.ts`
* Use Qdrant, Weaviate, or FAISS
* Functions:

  * `storeChunks(chunks: EmbeddedChunk[])`
  * `queryChunks(vector: number[], topK: number): EmbeddedChunk[]`

✅ You now have a searchable knowledge base of PKD document chunks.

---

### 🔌 STEP 5: **Ingest Script**

#### Objective:

Index all documents in `data/` folder.

#### Tasks:

* Create `scripts/indexMarkdownFiles.ts`
* Steps:

  1. Read `.md` files
  2. Chunk each
  3. Embed
  4. Store in vector DB

✅ This script prepares your content for question-answering.

---

### 🛠️ STEP 6: **MCP Tool: `pkd_context_provider`**

#### Objective:

Build a tool to select relevant chunks for a user question.

#### Tasks:

* Create `src/tools/pkdContextProvider.ts`
* Function: `async function handle(query: string)`

  * Embed the query
  * Search vector DB
  * Return top 1–3 chunks concatenated into `context: string`

✅ This tool becomes callable by your LLM runtime.

---

### 🚀 STEP 7: **Wire Up MCP Server**

#### Objective:

Register the MCP tool and serve it.

#### Tasks:

* In `src/server.ts`:

  * Register `pkd_context_provider` as a tool
  * Log incoming requests and returned context
  * Make sure output goes only to the LLM prompt, not as an artifact

✅ Your server is now a retriever backend for the LLM.

---

### 💬 STEP 8: **LLM Prompt Injection**

#### Objective:

Make sure MCP runtime injects returned context into the system/user prompt

#### Example:

```json
[
  { "role": "system", "content": "Use this context to answer the question:\n[CONTEXT]" },
  { "role": "user", "content": "[QUESTION]" }
]
```

✅ Now the user gets an informed answer, without seeing the docs.

---

## 🔁 What You Can Ask Me for Help With

At any stage, just tell me:

* “Create the code for Step 2” (Chunking)
* “Help me implement OpenAI embedding call”
* “Set up the vector DB query”
* “Show how the tool handles the MCP input/output format”

And I’ll deliver the code for that part, ready to paste into your environment.

---

Would you like to start with **Step 2 (chunkMarkdown)** now, or with the **embedding step**?
