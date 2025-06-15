export interface ApiResponse<T> {
    data: T;
    message: string;
    status: number;
    success: boolean;
}

export interface SocketMessage {
    sessionId: string;
    message: string;
    clerkId: string;
}