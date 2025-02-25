# A quick look at MCP with Large Language Models and Node.js | Red Hat Developer
[Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) is a protocol that allows intergratrion between large language models (LLMs) and tools, often as part of an agent.  One of the interesting aspect of MCP is that tools hosted in a server can be consumed by different frameworks and even frameworks that use a different language from which the server was written. In this blog post we will experiment with MCP using JavaScript, TypeScript and Node.js and see how one tool implementation can be consumed using both the [Bee agent framework](https://github.com/i-am-bee/bee-agent-framework) and the [Ollama framework](https://github.com/ollama/ollama-js).  

Background
----------

We've been exploring function calling/tools, large language models, and agents with JavaScript, TypeScript and Node.js over the last year. In those explorations we've used some common tools with a number of different frameworks. The common tools along with a common set of questions have let us examine how different frameworks and models support function/tool calling and how you can use functions/tools with large language models in Node.js. If you want to read up on those explorations you can check out:

*   [Building agents with Large Language Models(LLMs) and Node.js](https://developers.redhat.com/blog/2024/10/25/building-agents-large-language-modelsllms-and-nodejs)
*   [A quick look at tool use/function calling with Node.js and Ollama](https://developers.redhat.com/blog/2024/09/10/quick-look-tool-usefunction-calling-nodejs-and-ollama)
*   [Diving Deeper with large language models and Node.js](https://developers.redhat.com/learn/diving-deeper-large-language-models-and-nodejs)

While we used a common set of tools in each of those explorations (a favorite color tool and a favorite hockey team tool), for each new framework we had to refactor the function/tool to meet the requirements of the specific framework. One of the promises of MCP,  which we will explore in this blog post, is that we can write a tool once and then use it with multiple frameworks. 

MCP Server
----------

The MCP server hosts the tools. In our case we will expose the following tools:

*   favorite\_color\_tool - returns the favorite color for person given their city and country
*   favorite\_hockey\_tool - returns the favorite hockey team for a person given their city and country

As we've seen be the case for many current AI libraries, Typescript/JavaScript is one of the supported languages. There is a [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) as well as the [create-typescript-server](https://github.com/modelcontextprotocol/create-typescript-server) template that can be used to quickly build an MCP server.  We used the create-typescript-server template to scaffold an MCP server that uses the SDK and then copied over our function/tool implementations from our earlier explorations. The end result is in: [favorite-server/src/index.ts](https://github.com/mhdawson/ai-tool-experimentation/blob/main/mcp/favorite-server/src/index.ts).

The tools are defined in the handler for the request to get the available tools:

```
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'favorite_color_tool',
        description:
          'returns the favorite color for person given their City and Country',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'the city for the person',
            },
            country: {
              type: 'string',
              description: 'the country for the person',
            },
          },
          required: ['city', 'country'],
        },
      },
      {
        name: 'favorite_hockey_tool',
        description:
          'returns the favorite hockey team for a person given their City and Country',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'the city for the person',
            },
            country: {
              type: 'string',
              description: 'the country for the person',
            },
          },
          required: ['city', 'country'],
        },
      },
    ],
  };
});
```


If you've followed our other explorations the tool definitions will look very familiar with the ones we used for the other frameworks. They are however, different and required a bit of tweaking in terms of names and structure. So while looking at how we might not have to change our tool implementation between frameworks we've had to make one more version of our tools definitions :).

The implementation of the functions themselves are in the handler for the request to get a tool. As with the definitinos they look very similar to the prior implementations but required some tweaks in terms of the input and outputs. We also tweaked the implementations to avoid throwing errors unless there was a failure, versus something like the parameter not maching an expected value. This was needed to ensure our existing set of questions progressed as expected. The function implementation was as follows:

```
server.setRequestHandler(CallToolRequestSchema, async request => {
  if (
    request.params.name === 'favorite_color_tool' ||
    request.params.name === 'favorite_hockey_tool'
  ) {
    let text = `the ${request.params.name} returned the city or country was not valid
                please ask the user for them`;

    const city = String(request.params.arguments?.city);
    const country = String(request.params.arguments?.country);

    if (city && country) {
      if (request.params.name === 'favorite_color_tool') {
        if (city === 'Ottawa' && country === 'Canada') {
          text =
            'the favorite_color_tool returned that the favorite color for Ottawa Canada is black';
        } else if (city === 'Montreal' && country === 'Canada') {
          text =
            'the favorite_color_tool returned that the favorite color for Montreal Canada is red';
        }
      } else if (request.params.name === 'favorite_hockey_tool') {
        if (city === 'Ottawa' && country === 'Canada') {
          text =
            'the favorite_hockey_tool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators';
        } else if (city === 'Montreal' && country === 'Canada') {
          text =
            'the favorite_hockey_tool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians';
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: text,
        },
      ],
    };
  } else {
    throw new Error('Unknown tool');
  }
});
```


Other than handling those two requests the other main part of the server code was to select the transport for the requests and to start the server using that transport. The existing SDK supports a couple of transports and also supporting implementing your own. To provide the advantages of being able to interoperate with different frameworks and even have servers and clients written in different languages, the transports use JSON RPC messages and run the tools in a separate process. This could be both an advantage or disadvantage depending on the inpact of the serialization/deserialization for each tool call as well as running an additional process for the MCP server.

We chose the "StdioServerTransport" which was the default generated by the template and was easy to use with both the Bee agent and Ollama frameworks.

In our case this code was as follows:

```
async function main() {
 const transport = new StdioServerTransport();
 await server.connect(transport);
}
```


Overall it was quite easy and quick to convert our existing tools/functions into a set of tools exposed by an MCP server.

You can easily build the MCP server by running the following commands:

```
git clone https://github.com/mhdawson/ai-tool-experimentation.git
cd ai-tool-experimentation/mcp/
npm install
npm run build
```


The resulting MCP server will be in \`ai-tool-experimentation/mcp/favorite-server/build/index.js\`. and can be run with:

```
node ai-tool-experimentation/mcp/favorite-server/build/index.js
```


As mentioned before, the full source for the MCP server is in [ai-tool-experimentation/mcp/favorite-server/src/index.ts](https://github.com/mhdawson/ai-tool-experimentation/blob/main/mcp/favorite-server/src/index.ts) if you want to take a look and experiement with modifying it.

Using the tools from the MCP Server
-----------------------------------

Now that we have an MCP Server that provides the favorite color and favorite hockey team tools, we will take a look at how we consume those tools from an application using the  [Bee agent framework](https://github.com/i-am-bee/bee-agent-framework) and the [Ollama framework](https://github.com/ollama/ollama-js).  

We will use our existing question flow where we ask a number of questions to see how the LLM calls functions and interacts with the user. The questions are as follows:

```
// Go through the question flow
const questions = [
  'What is my favorite color?',
  'My city is Ottawa',
  'My country is Canada',
  'I moved to Montreal. What is my favorite color now?',
  'My city is Montreal and my country is Canada',
  'What is the fastest car in the world?',
  'My city is Ottawa and my country is Canada, what is my favorite color?',
  'What is my favorite hockey team ?',
  'My city is Montreal and my country is Canada',
  'Who was the first president of the United States?',
];  
  
for (let i = 0; i < questions.length; i++) {
  console.log('QUESTION: ' + questions[i]);
  console.log('  RESPONSE:' + (await askQuestion(questions[i])));
}
```


For both frameworks we also need to start the MCP server. Just like on the server side we do this with the [typescript-sdk.](https://github.com/modelcontextprotocol/typescript-sdk) This makes it easy to start the MCP server and to get the list of available tools. The code is as follows:

```
const client = new Client(
 {
   name: 'test-client',
   version: '1.0.0',
 },
 {
   capabilities: {},
 },
);
await client.connect(
 new StdioClientTransport({
   command: 'node',
   args: ['favorite-server/build/index.js'],
 }),
);
```


As mentioned when we built the server we chose the Stdio transport so we use the same transport in the client as well. As you can see from the code we specify the command as **node favorite-server/build/index.js** to start the server. As you can see the sdk makes it easy to start the server and create a client that can be used to communicate with it.

When we start our examples we can see that the MCP server is started as a separate process:

```
ps -ef |grep node
midawson  235266  228043  8 10:57 pts/0    00:00:00 node bee-agent-mcp.js
midawson  235277  235266  0 10:57 pts/0    00:00:00 node favorite-server/build/index.js
```


The last part of using the tools from the MCP server is passing in the tools available to the framework and, when requested by the LL,M calling tools through the MCP client. The way you do that is specific to each framework so we'll cover that in a separate section for each framework.

### Bee agent framework

The Bee agent framework recently added support for MCP. This made it easy to use our new MCP server. It was really just a matter of removing our existing function/tool implementation and adding the use of the tools from the MCP server. If you want to look at the code we started with it is available in [test-dynamic.mjs](https://github.com/mhdawson/ai-tool-experimentation/blob/main/bee-agent-framework/test-dynamic.mjs). 

The  code to get the tools we need to provide when making calls to the LLM is as follows:

```
const availableTools = await MCPTool.fromClient(client);
```


MCPTool is a new class provided by the framework. The fromClient() method uses the MCP client to query the server for the available tools and convert them into the format needed by the Bee agent framework. At this point to use the tools from the MCP server all we need to do is pass in the tools when we create the agent just like we did before:

```
let agent = new BeeAgent({
 llm,
 memory: new TokenMemory({ llm }),
 tools: availableTools,
});
```


Otherwise the code is the same as in our earlier explorations. You can take a look at the updated example in [bee-agent-mcp.js](https://github.com/mhdawson/ai-tool-experimentation/blob/main/mcp/bee-agent-mcp.js). Thanks to the integrated support for MCP in the Bee agent framework, it was simple to use the tools provided by the MCP server.

### Ollama 

Ollama does not have integrated support for MCP yet, but it turned out to be relatively easy to convert the list of tools returned by the MCP server into the format needed by Ollama.

The object returned by the MCP server (as printed using util.inspect) was as follows:

```
{
 tools: [
   {
     name: 'favorite_color_tool',
     description: 'returns the favorite color for person given their City and Country',
     inputSchema: {
       type: 'object',
       properties: {
         city: { type: 'string', description: 'the city for the person' },
         country: { type: 'string', description: 'the country for the person' }
       },
       required: [ 'city', 'country' ]
     }
   },
   {
     name: 'favorite_hockey_tool',
     description: 'returns the favorite hockey team for a person given their City and Country',
     inputSchema: {
       type: 'object',
       properties: {
         city: { type: 'string', description: 'the city for the person' },
         country: { type: 'string', description: 'the country for the person' }
       },
       required: [ 'city', 'country' ]
     }
   }
 ]
}
```


The format we needed for Ollama was as follows:

```
[
 {
   type: 'function',
   function: {
     name: 'favorite_color_tool',
     description: 'returns the favorite color for person given their City and Country',
     parameters: {
       type: 'object',
       properties: {
         city: { type: 'string', description: 'the city for the person' },
         country: { type: 'string', description: 'the country for the person' }
       },
       required: [ 'city', 'country' ]
     }
   }
 },
 {
   type: 'function',
   function: {
     name: 'favorite_hockey_tool',
     description: 'returns the favorite hockey team for a person given their City and Country',
     parameters: {
       type: 'object',
       properties: {
         city: { type: 'string', description: 'the city for the person' },
         country: { type: 'string', description: 'the country for the person' }
       },
       required: [ 'city', 'country' ]
     }
   }
 }
]
```


It was relatively straight forward to map from one format to the other. We likely could have used a more general transformation tool to map from one schema to the other but we chose to just do the mapping manually. The code to get the tools from the MCP server and then do the mapping was as follows:

```
let availableTools = await client.listTools();
for (let i = 0; i < availableTools.tools.length; i++) {
 availableTools.tools[i].parameters = availableTools.tools[i].inputSchema;
 delete availableTools.tools[i].inputSchema;
 availableTools.tools[i] = {
   type: 'function',
   function: availableTools.tools[i],
 };
}
availableTools = availableTools.tools;
```


After replacing the code to define the tools in the [original version](https://github.com/mhdawson/ai-tool-experimentation/blob/main/ollama/favorite-color.mjs) with the code to get the tools from the MCP server and transform them we pass the tools to Ollama in the same way as before:

```
 await ollama.chat({
       model: model,
       messages: messages,
       tools: availableTools,
       options: ollamaOptions,
     }),
```


The last change needed was to integrate calling of tools the when requested by the LLM.  This ended up looking like this:

```
   try {
       const funcResponse = await client.callTool({
         name: tool.function.name,
         arguments: tool.function.arguments,
       });
       for (let i = 0; i < funcResponse.content.length; i++) {
         messages.push({
           role: 'tool',
           content: funcResponse.content[i].text,
         });
       }
     } catch (e) {
       messages.push({ role: 'tool', content: `tool call failed: ${e}` });
     }
   }
```


**client.callTool** uses the MCP client to call the tool provided by the MCP server. The format in which the tool name and arguments are provided by Ollama needed some transformation by as you can see it's minimal:

```
await client.callTool({
         name: tool.function.name,
         arguments: tool.function.arguments,
       });
```


Otherwise the code is similar to what we had used before. The code for the full mcp example with Olllama is in [ai-tool-experimentation/mcp/ollama-mcp.mjs](https://github.com/mhdawson/ai-tool-experimentation/blob/main/mcp/ollama-mcp.mjs). If you want to dig into a more detailed explanation of how the handleResponse method handles requests from the LLM to invoke functions you can check out our [earlier blog](https://developers.redhat.com/blog/2024/09/10/quick-look-tool-usefunction-calling-nodejs-and-ollama "A quick look at tool use/function calling with Node.js and Ollama").

All in all it was a bit more work to use MCP with Ollama as it did not have integrated support. However, the code required for the transformation of the tool objects was relatively simple and should be a 1 time effort for each framework you want to use (ie for new tools and MCP servers you can use the same transformation code for a given framework). If MCP takes off it's also likely that more frameworks will have a built in intergration.

Running the Examples
--------------------

To run the examples we first have to build the MCP Server which was written in TypeScript. If you have not already done that eariler you can do that by running the following commands:

```
git clone https://github.com/mhdawson/ai-tool-experimentation.git
cd ai-tool-experimentation/mcp/
npm install
npm run build
```


You can then run the examples with:

```
node bee-agent-mcp.js
```


or

```
node ollama-mcp.mjs
```


**NOTE:** The examples need a running Ollama server and you will need to update the examples to point to your running ollama server. Modify the following line in the examples to point to your compatible endpoint:

```
const OLLAMA_SERVER = 'http://10.1.2.38:11434';
```


You will also have to have already pulled the model specified for the example which by default is "granite3.1-dense" for the Bee agent framework example and "llama3.1" for the ollama example.

The following is an example of the output having run both examples:

```
midawson@midawson-virtualbox:~/funccalling/ai-tool-experimentation/mcp$ node bee-agent-mcp.js 
QUESTION: What is my favorite color?
 RESPONSE:To provide your favorite color, I need to know your current city and country. Could you please share these details with me?
QUESTION: My city is Ottawa
 RESPONSE:Thank you for sharing that information. Now, could you also tell me your country?
QUESTION: My country is Canada
 RESPONSE:Your favorite color is black.
QUESTION: I moved to Montreal. What is my favorite color now?
 RESPONSE:In Montreal, Canada, your favorite color remains black.
QUESTION: My city is Montreal and my country is Canada
 RESPONSE:Your favorite color in Montreal, Canada is red.
QUESTION: What is the fastest car in the world?
 RESPONSE:I'm sorry, I don't have a tool to provide information about the fastest car in the world. My current capabilities are limited to providing favorite colors based on city and country.
QUESTION: My city is Ottawa and my country is Canada, what is my favorite color?
 RESPONSE:Your favorite color in Ottawa, Canada is blue.
QUESTION: What is my favorite hockey team ?
 RESPONSE:In Ottawa, Canada, your favorite hockey team is the Senators.
QUESTION: My city is Montreal and my country is Canada
 RESPONSE:Your favorite hockey team in Montreal, Canada is the Canadiens.
QUESTION: Who was the first president of the United States?
 RESPONSE:I'm sorry, I don't have a tool to provide information about historical figures or events. My current capabilities are limited to providing favorite colors and hockey teams based on city and country.


midawson@midawson-virtualbox:~/funccalling/ai-tool-experimentation/mcp$ node ollama-mcp.mjs 
QUESTION: What is my favorite color?
 RESPONSE:I don't have enough information to determine your favorite color. Can you tell me what city or country you are from?
QUESTION: My city is Ottawa
 RESPONSE:I still don't have enough information to determine your favorite color. Can you also tell me what country you are from?
QUESTION: My country is Canada
 RESPONSE:I'm still missing a piece of information. Can you also tell me what province you are from in Canada?
QUESTION: I moved to Montreal. What is my favorite color now?
 RESPONSE:Your favorite color is red!
QUESTION: My city is Montreal and my country is Canada
 RESPONSE:Your favorite color is red.
QUESTION: What is the fastest car in the world?
 RESPONSE:I'm a helpful assistant, but I don't have any information about cars. Can you tell me something else?
QUESTION: My city is Ottawa and my country is Canada, what is my favorite color?
 RESPONSE:Your favorite color is black.
QUESTION: What is my favorite hockey team ?
 RESPONSE:I don't have enough information to determine your favorite hockey team. Can you tell me what city and country you are from?
QUESTION: My city is Montreal and my country is Canada
 RESPONSE:Your favorite hockey team is the Montreal Canadiens.
QUESTION: Who was the first president of the United States?
 RESPONSE:I'm a helpful assistant, but I don't have any information about the presidents of the United States. Can you tell me something else?
```


The Punchline
-------------

We've used the same functions from the same MCP Server implementation with 2 different frameworks and also with two different Models. There are variations between each run as expected when interacting with an LLM, but also because of the differences in the framework and model used. The Bee agent framework seemed to handle incomplete information better than the simple prompt we had used with Ollama. This makes sense as the Bee agent framework is more focussed on tool/function calling than the more generic Ollama framework. This is likely because it has a better prompt than the one we had to put together ourselves for Ollama.

### Wrapping up

From our exploration we were able to move our tools/functions over to an MCP server and then use those tools in two different frameworks with a few hours effort.

The ability to write tools once and use them with multiple frameworks without change would make it easier and more cost effective for tool providers to support more of the popular frameworks. It may also allow them to write the tools in the language of their choice. There are already a number of sites and sources which are working to make it easy to find existing MCP servers (just search on "Index of MCP servers" and you will find a bunch of them). One good example is in the same repo as the SDKs - [github.com/modelcontextprotocol/servers/.](https://github.com/modelcontextprotocol/servers/) One thing to keep in mind when you select an existing MCP server is that you may need to install additional runtimes if the language used by the MCP server is different from the one used by your appliction. 

The potential down sides we see with using MCP are the need for an additional process and the RPC serialization/deserialization. How much of a concern those are will likely depend on the application and the environment it is deployed to.

Overall, we'll be interested follow the level of adoption that MCP achieves and what new transports are developed (for example, around being able to run the server remotely).

If you want to learn more about developing with large language models and Node.js, JavaScript and TypeScript you can look at the articles shared in [https://developers.redhat.com/blog/2024/11/20/essential-ai-tutorials-nodejs-developers](https://developers.redhat.com/blog/2024/11/26/nine-nodejs-pillars-and-nodejs-reference-architecture#wrapping_up).

If you want to learn more about what the Red Hat Node.js team is up to in general check these out:

*   [https://developers.redhat.com/topics/nodejs](https://developers.redhat.com/topics/nodejs)
*   [https://developers.redhat.com/topics/nodejs/ai](https://developers.redhat.com/topics/nodejs/ai)
*   [https://developers.redhat.com/e-books/developers-guide-nodejs-reference-architecture](https://developers.redhat.com/e-books/developers-guide-nodejs-reference-architecture)
*   [https://github.com/nodeshift/nodejs-reference-architecture](https://github.com/nodeshift/nodejs-reference-architecture)