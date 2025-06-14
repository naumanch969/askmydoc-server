import { PineconeStore } from "@langchain/community/vectorstores/pinecone";
import { Document as LC_Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pinecone, { pineconeIndex } from "../config/pinecone.js";
import { DocumentInstance } from "../models/document.js";

export const createEmbeddings = () => {
    return new GoogleGenerativeAIEmbeddings({
        model: "text-embedding-004",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
};

export const loadAndSplitPDF = async (document: DocumentInstance, chunkSize = 512, chunkOverlap = 64): Promise<LC_Document[]> => {

    const filepath = document.path;

    const loader = new PDFLoader(filepath);
    const docs = await loader.load();

    document.pageCount = docs.length;

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
    return splitter.splitDocuments(docs);
};

export const initVectorStoreFromPDF = async (document: DocumentInstance): Promise<void> => {
    try {

        const splitDocs = await loadAndSplitPDF(document);
        const embeddings = createEmbeddings();

        await PineconeStore.fromDocuments(splitDocs, embeddings, {
            pineconeIndex,
            namespace: document.namespace,
        });
    } catch (error) {
        console.error("Error initializing vector store from PDF:", error);
        throw new Error("Failed to initialize vector store from PDF");
    }
};

export const getVectorStore = async (document: DocumentInstance): Promise<PineconeStore> => {
    const embeddings = createEmbeddings();

    return await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace: document.namespace,
    });
};

export const getRetriever = async (indexName: string, namespace: string) => {
    const embeddings = createEmbeddings();
    const index = pinecone.Index(indexName);

    const store = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace,
    });

    return store.asRetriever();
};
