import { PineconeStore } from "@langchain/community/vectorstores/pinecone";
import { Document as LC_Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import pinecone, { pineconeIndex } from "../config/pinecone.js";
import { DocumentInstance } from "../models/document.js";
import { logger } from "./logger.js";

export const getEmbeddingsModel = () => {
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
    const splitDocs = await splitter.splitDocuments(docs);
    document.chunkCount = splitDocs.length;

    return splitDocs;
};

export const initVectorStoreFromPDF = async (document: DocumentInstance): Promise<void> => {
    try {
        const splitDocs = await loadAndSplitPDF(document);
        const embeddings = getEmbeddingsModel();

        await PineconeStore.fromDocuments(splitDocs, embeddings, {
            pineconeIndex,
            namespace: document.namespace,
        });
    } catch (error) {
        logger.error("Error initializing vector store from PDF:", error);
        throw new Error("Failed to initialize vector store from PDF");
    }
};

export const getVectorStore = async (document: DocumentInstance): Promise<PineconeStore> => {
    const embeddings = getEmbeddingsModel();

    return await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace: document.namespace,
    });
};

export const getRetriever = async (indexName: string, namespace: string) => {
    const embeddings = getEmbeddingsModel();
    const index = pinecone.Index(indexName);

    const store = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace,
    });

    // Create a retriever with proper error handling
    const retriever = store.asRetriever({
        searchKwargs: {
            fetchK: 4, // Number of documents to retrieve
        },
    });

    // // Wrap the retriever to handle errors and validate input
    // return {
    //     invoke: async (input: string) => {
    //         if (!input || typeof input !== 'string') {
    //             logger.error('Invalid input to retriever:', input);
    //             throw new Error('Invalid query input');
    //         }

    //         try {
    //             logger.info(`Retrieving documents for query: ${input}`);
    //             const results = await retriever.invoke(input);
    //             logger.info(`Retrieved ${results.length} documents`);
    //             return results;
    //         } catch (error) {
    //             logger.error('Error in retriever:', error);
    //             throw new Error('Failed to retrieve documents');
    //         }
    //     }
    // };

    return retriever;
};
