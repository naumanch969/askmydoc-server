import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const googleGenAi = new ChatGoogleGenerativeAI({ model: "gemini-1.5-pro", temperature: 0, maxRetries: 2, });