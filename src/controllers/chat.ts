import { Request, Response } from 'express';
import { getVectorStore } from '../config/init.js';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { convertDocsToString } from '../workers/helper.js';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from "@langchain/core/output_parsers";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";


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

        // Initialize the model
        const model = new ChatGoogleGenerativeAI({ model: "gemini-1.5-pro", temperature: 0, maxRetries: 2, });

        // Initialize output parser
        const stringOutputParser = new StringOutputParser();

        // Rephrase question chain prompt
        const REPHRASE_QUESTION_SYSTEM_TEMPLATE =
            `Given the following conversation and a follow up question, 
            rephrase the follow up question to be a standalone question.`;

        const rephraseQuestionChainPrompt = ChatPromptTemplate.fromMessages([
            ["system", REPHRASE_QUESTION_SYSTEM_TEMPLATE],
            new MessagesPlaceholder("history"),
            [
                "human",
                "Rephrase the following question as a standalone question:\n{question}"
            ],
        ]);

        // Rephrase question chain
        const rephraseQuestionChain = RunnableSequence.from([
            rephraseQuestionChainPrompt,
            model,
            stringOutputParser,
        ])

        // Answer generation chain prompt
        const ANSWER_CHAIN_SYSTEM_TEMPLATE = `You are an experienced researcher, 
            expert at interpreting and answering questions based on provided sources.
            Using the below provided context and chat history, 
            answer the user's question to the best of 
            your ability 
            using only the resources provided. Be verbose!

            <context>
            {context}
            </context>`;

        const answerGenerationChainPrompt = ChatPromptTemplate.fromMessages([
            ["system", ANSWER_CHAIN_SYSTEM_TEMPLATE],
            new MessagesPlaceholder("history"),
            [
                "human",
                "Now, answer this question using the previous context and chat history:\n{standalone_question}"
            ]
        ]);

        // Conversational retrieval chain
        const conversationalRetrievalChain = RunnableSequence.from([
            RunnablePassthrough.assign({
                standalone_question: rephraseQuestionChain,
            }),
            RunnablePassthrough.assign({
                context: contextRetrievalChain,
            }),
            answerGenerationChainPrompt,
            model,
            stringOutputParser,
        ]);

        // Initialize message history - to store the conversation history of session
        const messageHistory = new ChatMessageHistory();

        // Final retrieval chain with message history
        const finalRetrievalChain = new RunnableWithMessageHistory({
            runnable: conversationalRetrievalChain,
            getMessageHistory: (_sessionId) => messageHistory,
            historyMessagesKey: "history",
            inputMessagesKey: "question",
        });

        // Run the final retrieval chain with the query
        const originalAnswer = await finalRetrievalChain.invoke({ question: query, }, { configurable: { sessionId: "test" } });
        const followUpAnswer = await finalRetrievalChain.invoke({ question: "What did I just ask you?", }, { configurable: { sessionId: "test" } });

        res.json({ result: originalAnswer, followUp: followUpAnswer });
    } catch (error) {
        console.error("Error in queryPDF:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
``
