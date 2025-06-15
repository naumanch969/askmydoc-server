import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableSequence, RunnablePassthrough, RunnableWithMessageHistory, Runnable } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { convertDocsToString } from "./index.js";
import { getRedisMessageHistory } from "./messageHistory.js";
import { logger } from './logger.js';
import { Document } from "@langchain/core/documents";

export const buildRetrievalChain = async (retriever: Runnable): Promise<Runnable> => {
    const contextRetrievalChain = RunnableSequence.from([
        (input: { question: string }) => {
            if (!input.question) {
                logger.error('Empty question in retrieval chain');
                throw new Error('Question cannot be empty');
            }
            return input.question;
        },
        retriever,
        (docs: unknown) => {
            logger.info('Retrieved documents:', { docs });
            
            // Handle case where docs is not an array
            if (!Array.isArray(docs)) {
                logger.warn('Retriever did not return an array of documents');
                return 'No relevant information found.';
            }

            // Ensure all items are Document instances
            const validDocs = docs.filter((doc): doc is Document => 
                doc instanceof Document && typeof doc.pageContent === 'string'
            );

            if (validDocs.length === 0) {
                logger.warn('No valid documents found after filtering');
                return 'No relevant information found.';
            }

            return convertDocsToString(validDocs);
        }
    ]);

    return contextRetrievalChain;
}

export const buildRephraseQuestionChain = (model: Runnable) => {
    const stringOutputParser = new StringOutputParser();

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
    ]);

    return rephraseQuestionChain;
}

export const buildAnswerPrompt = () => {
    const ANSWER_CHAIN_SYSTEM_TEMPLATE = `You are an experienced researcher,
        expert at interpreting and answering questions based on provided sources.
        Using the below provided context and chat history, 
        answer the user's question to the best of your ability
        using only the resources provided. Be verbose!

        <context>
        {context}
        </context>`;

    const answerGenerationChainPrompt = ChatPromptTemplate.fromMessages([
        ["system", ANSWER_CHAIN_SYSTEM_TEMPLATE],
        new MessagesPlaceholder("history"),
        [
            "human",
            `Now, answer this question using the previous context and chat history:
  
            {standalone_question}`
        ]
    ]);

    return answerGenerationChainPrompt;
}

export const buildConversationChain = (model: ChatGoogleGenerativeAI, rephraseQuestionChain: Runnable, documentRetrievalChain: Runnable, answerPrompt: ChatPromptTemplate) => {
    const conversationalRetrievalChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            standalone_question: rephraseQuestionChain,
        }),
        RunnablePassthrough.assign({
            context: documentRetrievalChain,
        }),
        answerPrompt,
        model,
        new StringOutputParser() // Add string parser here to ensure we get a string output
    ]);

    return conversationalRetrievalChain;
}

export const wrapWithHistoryChain = (conversationalRetrievalChain: any) => {
    const finalRetrievalChain = new RunnableWithMessageHistory({
        runnable: conversationalRetrievalChain,
        getMessageHistory: (sessionId: string) => {
            logger.info(`Getting message history for session ${sessionId}`);
            return getRedisMessageHistory(sessionId);
        },
        inputMessagesKey: "question",
        historyMessagesKey: "history",
    });

    return finalRetrievalChain;
}

