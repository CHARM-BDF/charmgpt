import express from 'express';
import cors from 'cors';
import { Anthropic } from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Review prompt template
const REVIEW_PROMPT = `You are an expert NIH grant reviewer with extensive experience in reviewing Specific Aims sections. Your task is to provide a detailed, constructive review of a Specific Aims section in the context of the funding opportunity announcement (FOA).

# **Guide to Specific Aims Page for NIH Application**

   
The Specific Aims section is the most vital part of any NIH grant application. In this section, you must quickly gain the reviewers’ trust and confidence while simultaneously convincing them that your work is important to fund. You must also convey that you and your team are the best people to complete the work you’ve proposed. The Specific Aims section is central to your grant proposal. Therefore, **it should be the first section you write**. You may think of your Specific Aims page as an abbreviated version of the full grant. By having this page written and well- thought out, the remainder of grant application will be easier to write.

# **I.**     	**Introductory Paragraph:**

In this paragraph, your goal should be to introduce your research subject to the reviewers and quickly capture their attention. This paragraph should describe the significant gap in knowledge that directly relates to the critical need the funding entity deals with. It is critical to know your funding entity’s mission statement and ensure the critical need you are trying to fill fits well within its mission. It should include the following information:

•  *First Sentence/Hook:* Explain WHAT your research topic is and WHY it is critical that you conduct the research.

•  *What is Known:* State what is currently known in the specific field (3-5 sentences). Provide the reader with only the necessary details to understand why you are proposing the work. Remember to be concise and focused on only the key points.

•  *Gap in Knowledge:* Clearly state the gap in knowledge that needs to be addressed. Convey that your research will fill this gap using the funding that you are requesting. You can emphasize the most important words or phrases in your Specific Aims page by using *italics* or underline, but do so moderately. Overuse of italics or underlining can be distracting.

•  *The Critical Need:* The critical need is the knowledge (hypothesis-driven), technique, new compound, or treatment that you propose to develop. The critical need is the reason your proposal should be funded. Emphasize the significance of the problem you are trying to address. Additionally, it should be clear in this paragraph that your research proposes the next	logical  step 	to     	advance      	the                   	field.

# **II.**     	**The Second Paragraph**

In this paragraph, your goal should be to introduce the solution that fills the gap in knowledge. It is critical to convince your reviewers that you (and your colleagues) have the solution to address the current knowledge gap and the expertise to accomplish this solution. Keep your wording simple, relevant, and to the point. You will want to address the following points:  
•  What do you want to do?  
•  Why are you doing it?  
•  How do you want to do it?  
There is some flexibility in this paragraph, depending upon how your proposal is structured and what your goals are. For example, your research may be strictly hypothesis-driven and seek to test several elements of one general hypothesis. In other cases, you may be seeking to develop a critical tool or technique in the proposal. Based on these variations, this paragraph will shape up differently. However, it should include the following components:

•  *Long-Term Goal:* This is your overarching research goal. Align your long-term goals with the mission of your funding entity. Keep your wording general in this sentence—you are stating your long-term plans, and the reviewers understand that the specifics may be subject to change.

•  *Hypothesis and Proposal Objectives:* Your proposal should contain both of these components, depending on the long-term goal. State your central hypothesis clearly, specifically, and with simple language. Describe how your project addresses the critical need, and clearly state the proposed solution. In general, avoid vague hypotheses because it will be unclear to the reviewers what you expect to determine with the proposed research.

•  *Rationale:* Explain how you arrived at your central hypothesis (for example, using past studies and published literature). Briefly, state what your project’s completion would make possible (e.g., new therapeutics), and tie it to the funding entity’s mission.

•  *Qualifications:* Briefly state why your experimental design and your team are the best to accomplish the research goals. You can mention factors such as your preliminary data, personnel qualifications, laboratory equipment, etc., but it is important to keep it concise.

# **III.**     	**The Aims**

In this section, you will describe briefly each of the aims you will use to test your hypothesis. Ideally, the aims should be related, but not dependent, upon each other. If you do this, the failure of one aim (or an unexpected result from one aim) does not negatively influence any other aim or prevent the completion of the other aims.  
Within 2-4 sentences each, you should describe the experimental approach and how each aim will help answer your larger hypothesis. Plan to describe each aim in a separate paragraph. Additionally, these tips may help you to formulate your aims sections:

•  Give your aim an active title that clearly states the objective in relationship to the hypothesis. Include a brief summary of the experimental approach and anticipated outcomes for each aim. To make it easier for the reviewers to clearly read and understand each aim, it is often helpful to use headings and/or bullets to delineate each specific aim.  
 

# **IV.**     	**The Final Summary Paragraph**

This final paragraph of the Specific Aims is often overlooked, but it is vital for the impact of your proposal. If you end with the Aims Section (above) you will end on fine details and a narrow scope. Therefore, this final paragraph creates a firm, broad base to support your entire proposal. The final paragraph should include:

•  *Innovation*: What would completion of this proposal bring to the field that is not present currently?

•  *Expected Outcomes*: What do you expect to see at the completion of each aim? Include this information only if you have not placed it in the Aims.

•  *Impact*: State how your project would help those who need it. Include a broad impact statement about how your proposal will benefit the people or other subjects that you mentioned in the opening paragraph.  

Context:
FOA Text: {rfa_text}

Specific Aims to Review:
{aims_text}

Provide your review in markdown format, using appropriate headers and formatting.`;

// Tool definition
const reviewTool = {
  name: "review_specific_aims",
  description: "Reviews NIH grant Specific Aims section using Anthropic AI, providing detailed feedback and recommendations",
  parameters: {
    type: "object",
    properties: {
      aims_text: {
        type: "string",
        description: "The text of the Specific Aims section to review"
      },
      rfa_text: {
        type: "string",
        description: "The text or markdown of the grant RFA/FOA"
      }
    },
    required: ["aims_text", "rfa_text"]
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Tools listing endpoint
app.get('/tools', (req, res) => {
  res.json({ tools: [reviewTool] });
});

// Tool execution endpoint
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { aims_text, rfa_text } = req.body;

  if (toolName !== "review_specific_aims") {
    return res.status(404).json({
      content: [{
        type: "text",
        text: `Tool ${toolName} not found`
      }],
      isError: true
    });
  }

  try {
    // Validate input
    if (!aims_text || !rfa_text) {
      throw new Error("Missing required parameters: aims_text and rfa_text are required");
    }

    // Format the prompt
    const formattedPrompt = REVIEW_PROMPT
      .replace("{aims_text}", aims_text)
      .replace("{rfa_text}", rfa_text);

    // Get review from Anthropic
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: formattedPrompt
      }]
    });

    // Extract the review text from the response
    const reviewText = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : 'Error: Unable to generate review text';

    // Create artifact
    const artifact = {
      type: "text/markdown",
      id: crypto.randomUUID(),
      title: "NIH Specific Aims Review",
      content: reviewText,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "claude-3-sonnet-20240229"
      }
    };

    // Return response with both content and artifact
    return res.json({
      content: [{
        type: "text",
        text: "Review completed successfully. Click the attachment to view the detailed review.",
        forModel: true
      }],
      artifacts: [artifact],
      isError: false
    });

  } catch (error: unknown) {
    console.error('Error in review_specific_aims:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return res.status(500).json({
      content: [{
        type: "text",
        text: `Error generating review: ${errorMessage}`
      }],
      isError: true
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Aims Review MCP server running on port ${port}`);
}); 