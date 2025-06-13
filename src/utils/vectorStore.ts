// utils/vectorStore.ts

import { TaskType } from "@google/generative-ai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { VectorStore } from "@langchain/core/vectorstores";

type VectorStoreType = "memory"  /* | "pinecone" | "weaviate" | "chroma" */;

export const createEmbeddings = () => {
    return new GoogleGenerativeAIEmbeddings({
        model: "text-embedding-004",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
};

export const createVectorStore = async (type: VectorStoreType = "memory"): Promise<VectorStore> => {
    const embeddings = createEmbeddings();

    switch (type) {
        case "memory":
            return new MemoryVectorStore(embeddings);
        default:
            throw new Error(`Unsupported vector store type: ${type}`);
    }
};

export const loadAndSplitPDF = async (filepath: string, chunkSize = 512, chunkOverlap = 64): Promise<Document[]> => {
    const loader = new PDFLoader(filepath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
    });

    return splitter.splitDocuments(docs);
};

export const initVectorStoreFromPDF = async (filepath: string, type: VectorStoreType = "memory"): Promise<VectorStore> => {
    try {
        const splitDocs = await loadAndSplitPDF(filepath);
        const vectorstore = await createVectorStore(type);
        await vectorstore.addDocuments(splitDocs);
        return vectorstore;
    } catch (error) {
        console.error("initVectorStoreFromPDF error:", error);
        throw error;
    }
};
