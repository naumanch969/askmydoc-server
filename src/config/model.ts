import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const googleGenAi = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash", // or "gemini-1.0-pro", "gemini-pro", etc.
    temperature: 0,
    maxRetries: 2,
    // Other options you can pass:
    // apiKey: "YOUR_API_KEY", // (string) - override default API key
    // maxOutputTokens: 1024, // (number) - maximum tokens in the output
    // topP: 1, // (number) - nucleus sampling parameter
    // topK: 40, // (number) - top-k sampling parameter
    // stopSequences: ["\n"], // (string[]) - stop generation on these sequences
    // safetySettings: [{ category: "HARM_CATEGORY_DEROGATORY", threshold: 1 }], // (object[]) - safety settings
    // tools: [], // (array) - tools for function calling
    // streaming: false, // (boolean) - enable streaming responses
    // verbose: false, // (boolean) - enable verbose logging
});