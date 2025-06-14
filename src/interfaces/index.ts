export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
    createdAt?: Date;
    // metadata?: {
    //     tokens?: number;
    //     processingTime?: number;
    //     sources?: { page: number; content: string; }[];
    // };
}