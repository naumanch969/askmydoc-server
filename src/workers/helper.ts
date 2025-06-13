import { TaskType } from "@google/generative-ai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";

export const getVectorStore = async () => {
    // Embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "text-embedding-004", // 768 dimensions
        taskType: TaskType.RETRIEVAL_DOCUMENT,
    });

    // Vector Store
    const vectorStore = new MemoryVectorStore(embeddings);

    return vectorStore;
}

export const initializeVectorstoreWithDocuments = async (filepath: string) => {

    try {
        // Load the PDF file
        const loader = new PDFLoader(filepath);
        const docs = await loader.load();
        console.log(docs.slice(0, 5));

        // Split the documents into chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 64,
        });
        const splitDocs = await splitter.splitDocuments(docs);
        console.log(splitDocs.slice(0, 5));

        // Vector Store
        const vectorstore = await getVectorStore();
        await vectorstore.addDocuments(splitDocs);

    } catch (error) {
        console.error("Error initializing vector store with documents:", error);
        throw error;
    }

};

export const convertDocsToString = (documents: Document[]): string => {
    return documents.map((document) => {
        return `<doc>\n${document.pageContent}\n</doc>`
    }).join("\n");
};
