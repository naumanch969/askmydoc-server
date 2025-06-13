import { Request, Response } from 'express';
import { buildConversationChain, buildRetrievalChain, wrapWithHistoryChain, buildRephraseQuestionChain, buildAnswerPrompt } from '../utils/chain.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createVectorStore } from '../utils/vectorStore.js';


export const queryPDF = async (req: Request, res: Response) => {
    try {
        const query = req.body.question || req.query.question || "What's inside the document?";
        const sessionId = req.headers['x-session-id'] || 'anonymous-session';

        const vectorStore = await createVectorStore();
        const retriever = vectorStore.asRetriever();

        // Initialize the model
        const model = new ChatGoogleGenerativeAI({ model: "gemini-1.5-pro", temperature: 0, maxRetries: 2, });

        // Rephrase question chain
        const rephraseQuestionChain = buildRephraseQuestionChain(model);

        // Chain to get context/similarity-search from the vector store
        const contextRetrievalChain = await buildRetrievalChain(retriever);

        // Answer generation chain prompt
        const answerGenerationChainPrompt = buildAnswerPrompt();

        // Conversational retrieval
        const conversationalRetrievalChain = buildConversationChain(model, rephraseQuestionChain, contextRetrievalChain, answerGenerationChainPrompt);

        // Final Retrieval Chain
        const finalRetrievalChain = wrapWithHistoryChain(conversationalRetrievalChain);


        const stream = await finalRetrievalChain.stream(
            { question: query },
            { configurable: { sessionId } }
        );

        res.json({ result: stream });

    } catch (error) {
        console.error("Error in queryPDF:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
