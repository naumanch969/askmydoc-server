import { TaskType } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { CharacterTextSplitter } from "@langchain/textsplitters";


const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004", // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey: process.env.GOOGLE_API_KEY
});

const textSplitter = new CharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
});

export const getVectorStore = async () => {

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: "http://localhost:6333",
        collectionName: "pdf-docs",
    });

    return vectorStore;
}

export const getTextSplitter = () => {
    return textSplitter;
};
export const getEmbeddings = () => {
    return embeddings;
}
