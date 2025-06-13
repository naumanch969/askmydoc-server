import { Request, Response } from 'express';
import { getVectorStore } from '../config/init.js';
import { RunnableSequence } from '@langchain/core/runnables';
import { convertDocsToString } from '../workers/helper.js';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from "@langchain/core/output_parsers";

export const queryPDF = async (req: Request, res: Response) => {
    try {
        const query = "What's inside the document?";

        const vectorStore = await getVectorStore();
        const retriever = vectorStore.asRetriever();

        // Chain to get context/similarity-search from the vector store
        const contextRetrievalChain = RunnableSequence.from([
            (input) => input.question,
            retriever,
            convertDocsToString
        ]);

        // Answer Generation Prompt
        const TEMPLATE_STRING = `You are an experienced researcher, 
        expert at interpreting and answering questions based on provided sources.
        Using the provided context, answer the user's question 
        to the best of your ability using only the resources provided. 
        Be verbose!

        <context>

        {context}

        </context>

        Now, answer this question using the above context:

        {question}`;

        const answerGenerationPrompt = ChatPromptTemplate.fromTemplate(
            TEMPLATE_STRING
        );


        // Initialize the model
        const model = new ChatGoogleGenerativeAI({ model: "gemini-1.5-pro", temperature: 0, maxRetries: 2, });

        // Initialize output parser
        const outputParser = new StringOutputParser();

        // Chain to generate the answer
        const retrievalChain = RunnableSequence.from([
            {
                context: contextRetrievalChain,
                question: (input) => input.question,
            },
            answerGenerationPrompt,
            model,
            outputParser
        ]);

        // Run the chain with the query
        const answer = await retrievalChain.invoke({ question: query });

        res.json({ result: answer });
    } catch (error) {
        console.error("Error in queryPDF:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
``
