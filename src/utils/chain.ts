import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableSequence, RunnablePassthrough, RunnableWithMessageHistory, Runnable } from "@langchain/core/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { convertDocsToString } from "./index.js";
import { getRedisMessageHistory } from "./messageHistory.js";


export const buildRetrievalChain = async (retriever: Runnable): Promise<Runnable> => {

    const contextRetrievalChain = RunnableSequence.from([
        (input: { question: string }) => input.question,
        retriever,
        convertDocsToString
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
        model
    ]);

    return conversationalRetrievalChain;
}

export const wrapWithHistoryChain = (conversationalRetrievalChain: any) => {

    const httpResponseOutputParser = new HttpResponseOutputParser({ contentType: "text/plain" });

    const finalRetrievalChain = new RunnableWithMessageHistory({
        runnable: conversationalRetrievalChain,
        getMessageHistory: (sessionId: string) => getRedisMessageHistory(sessionId),
        inputMessagesKey: "question",
        historyMessagesKey: "history",
    }).pipe(httpResponseOutputParser);

    return finalRetrievalChain;
}