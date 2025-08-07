Great. I’ll help you design a system prompt and code strategy for your React + Node application using LLMs and the Model Context Protocol (MCP) that can:

* Select the best tool for a task (search, summarize, classify, generate graphs, etc.)
* Avoid repeating the same operations unnecessarily
* Support sequential thinking and task chaining
* Log and reason over previous tool invocations during a session

I’ll provide:

* A well-structured system prompt for effective tool planning and deduplication
* A strategy for task memory and reasoning
* TypeScript/NodeJS snippets for handling the tool history and task orchestration

I’ll let you know when everything is ready.


# LLM Tool Orchestration with MCP: Prompt Design, Memory, and Code Strategy

## Overview

Building a React + NodeJS application with **LLM-driven tool orchestration** requires careful planning of how the AI selects and sequences tool calls. The **Model Context Protocol (MCP)** provides a standardized way to expose tools to the LLM (like a "USB-C port" for connecting AI to external data and services). Using MCP, our system can register tools (e.g. a PubMed search API, a summarizer, a classifier, a knowledge graph builder) that the LLM can invoke as needed.

To solve complex user tasks, the LLM should **reason step-by-step and call the appropriate tools in sequence**. We need to guide the model to pick the best tool (or combination of tools) for each subtask, carry over results to subsequent steps, and **avoid redundant calls** (e.g. not repeating the same PubMed query twice). This involves:

* Crafting a strong **system prompt** that clearly describes the tools and instructs the model in planning multi-step solutions while avoiding repetition. A well-designed system prompt is crucial for effective tool use.
* Maintaining a **session memory** of tool invocations and their results. Since LLMs are stateless and don't inherently remember past calls, we must track this context externally. Memory allows the agent to reuse information it already fetched, leading to more coherent behavior and no repeated work.
* Implementing a robust **orchestration logic** (in Node/TypeScript) that manages the dialogue between the LLM and tools. This includes checking the session history to prevent duplicate tool calls, caching results of idempotent tools (tools that produce the same output when given the same input), and chaining tool outputs to inputs of follow-up tools.
* Integrating with a **React frontend** to maintain the session and display the step-by-step progress or final results to the user, ensuring a smooth interactive experience.

Below, we detail each part of the strategy – from prompt design to memory management – and provide code examples for a Node backend and React frontend. These examples illustrate how to implement the session tracking, duplicate checking, and dynamic tool invocation chain.

## System Prompt for Tool Selection & Planning

The system prompt sets the stage for the LLM, defining its role, available tools, and how to approach tasks. We want the prompt to encourage a **“reason then act”** strategy (similar to the ReAct pattern) where the model first analyzes the user request, then decides which tool to use, observes the result, and continues reasoning. Key elements to include in the prompt:

* **Tool Descriptions:** List each tool’s name and purpose clearly. This helps the model select the right tool for a given subtask. (For example: *“Tool `search_papers` – searches PubMed for relevant papers. Tool `summarize_text` – summarizes given text.”*) Clear definitions guide the agent on how and when to use each tool.
* **Sequential Reasoning Instruction:** Instruct the model to break down complex tasks into substeps. The model should determine the sequence of actions (e.g. *first search, then summarize, then analyze*). This aligns with the ReAct paradigm, which interleaves reasoning and acting to dynamically adjust plans based on intermediate results.
* **No Redundant Calls:** Emphasize that the agent should **not repeat tool calls** with the same input if results are already available. The prompt can mention that results from previous tool invocations are stored in memory for reuse. (E.g. *“Avoid calling a tool again on the same query if you have already done so; use the cached result from memory instead.”*) This nudges the model to utilize prior outputs instead of looping or redoing work.
* **Output Expectations:** If using a function-calling format or a specific response schema, explain how the model should output a tool call vs. a final answer. For example, instruct that when it needs information, it should output a function/tool call with arguments, and otherwise provide the final answer.

Below is an **example system prompt template** incorporating these principles:

```text
You are an AI assistant capable of using tools to fulfill user requests. You have access to the following tools:

- `search_papers` (read-only): Search for academic papers or articles by keyword.
- `summarize_text` (read-only): Summarize a given text document or content.
- `classify_text` (read-only): Classify text into categories (e.g., topics or sentiment).
- `generate_knowledge_graph` (read/write): Create a knowledge graph from provided information.

Follow these guidelines:
1. **Tool Selection:** Analyze the user's request and decide which tool (or sequence of tools) will best accomplish each part of the task. Use the most relevant tool for each subtask. If multiple steps are required, plan the steps in a logical order.
2. **Sequential Reasoning:** Break complex tasks into smaller steps. Reason through the task step-by-step, and invoke tools one at a time to gather information or perform actions. After getting a tool result, incorporate that information before moving to the next step.
3. **Avoid Redundancy:** Do not repeat a tool action on the same or equivalent input. Remember the results of tools you've already used. *(For example, if you have already used `search_papers` to find results for "machine learning biomarkers", do not search again for the same query; use the results you have.)* Tools are idempotent: calling them with identical inputs will not yield new information:contentReference[oaicite:10]{index=10}.
4. **Use Memory:** Assume you have a memory of this session’s tool calls and outcomes. Refer to that memory instead of re-calling tools unnecessarily. Leverage existing data to answer follow-up questions or to proceed to the next step.
5. **Final Answer:** Only provide a direct answer to the user **after** you have gathered sufficient information using the tools. The final answer should synthesize all the information obtained.

Always think aloud about which tool is needed next, but respond to the user only with either a tool invocation or the final answer. Be concise and focus on fulfilling the task.
```

This system prompt explicitly instructs the model on how to behave. By listing tools and guidelines, it **primes the LLM to act as a problem-solving agent**: plan its actions, call tools as needed, and avoid repeating work. Such prompt tuning is known to significantly improve an agent’s effective tool use and prevents it from "just responding with the same tool invocation over and over".

## Session Memory and Tool Invocation Tracking

To support the LLM in following those rules, the backend should manage a **session state** that keeps track of all tool calls and their results for each user session (or conversation). This serves two purposes: it provides context to the model about what has already been done, and it allows the system to short-circuit duplicate requests.

**Design strategy for memory:**

* **Unique Session Context:** Assign each user (or each chat session) a unique context (e.g., a session ID). Maintain a data structure (in memory or a database) that stores the history of that session: the user’s queries, the tools invoked, the parameters used, and the results returned by each tool. This is the working memory of the agent.
* **Record Tool Results:** Every time a tool is invoked, log the input parameters and the output. For example, if `search_papers` was called with query "cancer biomarkers", store the list of papers returned. Memory is crucial because the LLM itself won't remember past calls across messages. With this external memory, our agent can refer back to prior results and maintain context, leading to more coherent and efficient behavior.
* **Duplicate Checking:** Before invoking a tool, check if the **same query or input** has already been used with that tool in this session. If yes, you can **reuse the previous result** instead of calling the tool again. Many tool operations (especially searches or deterministic analyses) are **idempotent**, meaning repeated calls with the same arguments have no additional effect. We can leverage this by caching results. For instance, tag each tool invocation by a key like `toolName:hash(parameters)` to quickly detect repeats.
* **Result Reuse:** When a repeat request is detected, the system can feed the cached result back to the LLM as if the tool was called. This can be done by either instructing the LLM (via the prompt or an assistant message) that "the result of X from last time is Y", or by intercepting the tool call and returning the saved result directly. By doing this, the workflow continues without redundant external API calls, saving time and avoiding rate limits or unnecessary computations.
* **Updating Context to LLM:** After each tool call (actual or fetched from cache), update the LLM’s context with the outcome. Typically, this is done by providing the tool’s result as the assistant’s message (if the LLM supports function calling, this would be the function result). This allows the LLM to incorporate the new information into its next reasoning step. For example, after a `search_papers` call, the next model prompt might include a summary of the search results so the model knows what it has to work with.

By managing session memory diligently, we ensure the agent doesn't lose track of what it's already done. The presence of memory prevents the frustrating scenario of the AI asking the same questions or performing the same searches repeatedly. It also enables the agent to handle follow-up user queries in context, and to chain multi-step tasks seamlessly using information gained in earlier steps.

## Orchestration Logic: Tool Selection and Chaining

With the system prompt guiding the LLM and session memory in place, the core runtime logic will orchestrate the loop of **LLM → Tool → LLM** until the task is complete. The process can be summarized in a few steps:

1. **LLM Analysis:** Send the user’s request (and possibly a summary of context so far) to the LLM along with the system prompt. The LLM will respond either with a **tool invocation** (if it decides it needs to use a tool) or with a **final answer** (if it believes it has enough information).
2. **Tool Invocation & Duplicate Check:** If the LLM’s response indicates a tool should be used (e.g., via a function call or a special format in the assistant message), parse out the tool name and parameters. **Check the session history** for this tool call:

   * If the exact same call was made before, retrieve the cached result instead of calling the tool API again.
   * If not, call the appropriate tool function/API on the backend. Store the result in the session memory.
3. **Return Tool Result to LLM:** Take the tool’s output and provide it back to the LLM as input for the next round. In practice, if using OpenAI function calling or MCP, this is done by returning the function’s result in the model’s conversation. The LLM “sees” the result (often termed as an observation) and can now reason with it.
4. **Iterate:** With the new information, the LLM may decide another tool is needed, or it might now be ready to give the final answer. If another tool is needed, repeat steps 2-3. This loop continues until the LLM produces a final answer rather than another tool call.
5. **Deliver Answer:** Once a final answer is produced, return it to the user. Also log this interaction in memory (for future context if the user asks follow-ups).

This approach is essentially implementing a controlled ReAct pattern: the LLM reasons and chooses actions in a loop, and our backend ensures each action is executed with no duplication and proper state tracking. The result is an agent that can **dynamically chain multiple tools** (search → summarize → analyze, etc.) with awareness of what has been done so far.

Below are **code snippets in TypeScript** demonstrating how you might implement this. We provide a simplified Node.js backend orchestrator and a React frontend integration. The code is annotated to highlight how task history is maintained, how duplicate tool calls are detected, and how tasks are chained logically.

### Node.js Backend Orchestrator (TypeScript)

In the backend code, we define a set of tools, a session memory store, and the main loop that interacts with the LLM. This example assumes we have an `llmClient` that can take a list of messages (with our system prompt, user prompt, etc.) and either return a direct answer or indicate a tool function to call (similar to OpenAI’s function calling or Anthropic’s tool use with MCP). The tools themselves are abstracted as functions we can call (for example, `searchPapers()` might call a PubMed API).

```ts
// Define an interface for tool call records and session memory
interface ToolCall {
  tool: string;
  params: any;          // parameters used for the tool
  result: any;          // result returned by the tool
}

interface SessionData {
  history: ToolCall[];  // log of all tool calls in this session
}

// In-memory session store (keyed by sessionId)
const sessions: Record<string, SessionData> = {};

// Helper to get or create session data
function getSession(sessionId: string): SessionData {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { history: [] };
  }
  return sessions[sessionId];
}

// Example tools available (backed by some implementation)
const tools = {
  search_papers: async (query: string) => { /* call PubMed API and return results */ },
  summarize_text: async (text: string) => { /* call summarization API or model */ },
  classify_text: async (text: string) => { /* perform classification */ },
  generate_knowledge_graph: async (data: any) => { /* generate a knowledge graph */ }
};

// Main function to process user tasks using the LLM and tools
async function processUserRequest(sessionId: string, userQuery: string): Promise<string> {
  const session = getSession(sessionId);

  // Assemble the conversation messages for the LLM
  const messages = [
    { role: "system", content: SYSTEM_PROMPT_TEMPLATE },    // from earlier step, including tool descriptions and instructions
    { role: "user", content: userQuery }
  ];

  let finalAnswer = "";
  while (true) {
    // 1. Send messages to LLM and get response (could be a tool request or final answer)
    const llmResponse = await llmClient.generate(messages);
    // (For illustration, assume llmResponse has either llmResponse.toolCall when a tool is requested, or llmResponse.content for answer.)

    if (llmResponse.toolCall) {
      const { name: toolName, params } = llmResponse.toolCall;
      console.log(`LLM requested tool: ${toolName} with params ${JSON.stringify(params)}`);

      // 2. Check if this tool call was already done in this session
      const previousCall = session.history.find(
        call => call.tool === toolName && JSON.stringify(call.params) === JSON.stringify(params)
      );
      let toolResult;
      if (previousCall) {
        // Duplicate detected – reuse the result
        console.log(`Reusing cached result for tool ${toolName}`);
        toolResult = previousCall.result;
      } else {
        // No duplicate – invoke the tool and get fresh result
        const toolFunction = tools[toolName as keyof typeof tools];
        if (!toolFunction) {
          throw new Error(`Tool ${toolName} is not recognized.`);
        }
        toolResult = await toolFunction(...Object.values(params));  // assuming params is an object of arguments
        // Store this call in session history for future reference
        session.history.push({ tool: toolName, params, result: toolResult });
      }

      // 3. Provide the tool result back to the LLM as the next message (so it can reason on it)
      // Here we format it as an assistant message. In a function-calling scenario, this would be the function result.
      messages.push({ role: "assistant", content: `Tool ${toolName} output: ${JSON.stringify(toolResult)}` });
      continue;  // loop again for LLM's next response
    } else {
      // LLM provided a final answer (no tool call)
      finalAnswer = llmResponse.content;
      // Optionally, store the final answer or any summary in session (not strictly needed unless for later retrieval)
      break;
    }
  }

  return finalAnswer;
}
```

**What this code does:**

* It maintains a `sessions` object to track each session’s history of `ToolCall` records. Each record logs which `tool` was used with which `params` and what `result` was obtained.
* Before calling a tool, it checks `session.history` for a matching entry (using a simple `JSON.stringify` comparison of parameters for exact match). If found, it logs a message and reuses the `previousCall.result` instead of calling the external API again. This implements the **duplicate call avoidance** logic. For example, if `search_papers` was already called with `{"query": "cancer biomarkers"}`, it will not call the API again; it will reuse the stored result.
* If no previous call matches, it actually invokes the tool function from the `tools` map. After getting the `toolResult`, it pushes a new record into `session.history`. Over time, this history grows, and any repeat query (even if triggered by a slightly different user prompt later in the conversation) will be detected.
* After obtaining a tool result (whether fresh or cached), the code **feeds the result back into the LLM’s context** by appending it as an assistant message. In practice, if using an API that supports function call handling (e.g., OpenAI’s `function_call` or Anthropic’s MCP), the mechanism might be slightly different (the result would be passed as the function’s return value). But logically, we’re giving the model the observation it requested.
* The loop continues, allowing the LLM to decide if another tool is needed. Each iteration corresponds to one reasoning → tool action cycle. This is the agent’s sequential reasoning in action.
* When `llmResponse.toolCall` is not present, the LLM has produced a final answer (`llmResponse.content`). The loop breaks and we return that answer to the user.

This orchestrator ensures **multi-step workflows are executed intelligently**. The LLM is always operating with full awareness of past steps (since the `messages` array grows with each tool output), and the backend never does redundant work (thanks to the cache check using `session.history`). Notably, tools like searches or static analyses are effectively treated as pure functions with cached outputs – since they’re idempotent, calling them with the same input yields the same result, so caching is safe and does not alter correctness.

### React Frontend Integration (TypeScript)

On the React side, the main tasks are to send the user’s request to the backend (along with an identifier for the session) and display the results. The frontend can also maintain a local record of the conversation if needed for rendering, but the source of truth for the AI’s memory is on the backend. Here's an example of how the React component might handle user queries and maintain the session:

```tsx
import { useState, useRef } from 'react';

function ChatInterface() {
  const [conversation, setConversation] = useState<Array<{ sender: string, text: string }>>([]);
  // sessionId could be generated once per chat session (e.g., UUID or received from backend on session init)
  const sessionId = useRef<string>(() => generateUniqueSessionId());  // pseudo-function to get an ID

  const sendUserQuery = async (userQuery: string) => {
    // Update local conversation state with the user's question
    setConversation(prev => [...prev, { sender: 'user', text: userQuery }]);

    // Send the query to the backend API
    try {
      const response = await fetch('/api/processQuery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current, query: userQuery })
      });
      const data = await response.json();

      // Assume the backend returns { answer: "..."} after processing
      if (data.answer) {
        setConversation(prev => [...prev, { sender: 'assistant', text: data.answer }]);
      }
    } catch (error) {
      console.error("Error querying backend:", error);
    }
  };

  // ... (JSX for rendering the conversation and an input box to call sendUserQuery)
}
```

Key points in this frontend snippet:

* We keep a `conversation` state to render the chat messages (user and assistant). This is just for UI; the real memory of tool usage lives on the server.
* We use a `sessionId` (stored in a `useRef` so it persists across re-renders and doesn't change). In a real app, you might get this `sessionId` from the server when the session starts, or generate a GUID on the client and inform the server. The important thing is that the same `sessionId` is sent with each request so the backend can retrieve the correct session context.
* When the user submits a query (`sendUserQuery`), we optimistically add the user's message to the conversation state for immediate UI feedback. Then we `fetch` the `/api/processQuery` endpoint (which would be handled by the Node backend’s `processUserRequest` or similar logic).
* The body of the POST includes the `sessionId` and the `query`. The backend uses `sessionId` to tie the request to the user's session data (as we saw in `getSession(sessionId)` earlier).
* Upon receiving the response, which contains the assistant’s answer, we update the conversation state with the assistant's reply. The UI would then show the new answer.
* Any subsequent question the user asks will carry the same `sessionId`, so the backend will reuse the accumulated `session.history` and the conversation context to continue the multi-step reasoning where it left off.

With this setup, the **React frontend and Node backend work together** to manage the session state. The front end ensures each request is labeled with the correct session, and the back end ensures that the session’s history is consulted on each step. This design avoids repeating expensive tool calls and supports coherent multi-turn interactions.

## Conclusion

By combining a carefully engineered system prompt with a solid backend memory design, we achieve a powerful orchestration of LLM and tools. The prompt guides the model to **think in steps and use tools thoughtfully**, while the session tracking guarantees that prior work is remembered (since the LLM itself won't remember beyond its context window) and **not needlessly repeated**. This leads to efficient multi-step workflows: the LLM can search for information, summarize it, perform analysis, and compile results all in one coherent session, without falling into loops or redundant queries.

In summary, our strategy entails: *clear instructions to the LLM on tool use and no-duplication, a session-based cache of tool results to enforce idempotency, and an agent loop that dynamically chains tool outputs to inputs for subsequent actions.* The React/Node implementation sketches above illustrate how to put these pieces together in practice. With this architecture, the application can leverage LLM reasoning through MCP to adaptively select tools and execute complex tasks, all while maintaining efficiency and context over the course of a session.

**Sources:**

* Anthropic, *Introducing the Model Context Protocol (MCP)* – MCP as a standard interface for AI tools
* PromptingGuide.ai, *ReAct Prompting* – LLM reasoning + acting paradigm for sequential decision making
* Sebastian (Medium), *LLM Agents: Custom Tools in Autogen* – Importance of system prompts to steer tool usage and avoid repetition
* MCP Documentation – Tool definitions and idempotent behavior (no effect if repeated with same args)
* Redis AI Blog, *AI Agents and Memory* – Need for memory in agents since LLMs are stateless, to avoid repetitive queries and maintain context
