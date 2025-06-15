export enum DocumentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    INDEXED = 'indexed',
    FAILED = 'failed'
}
export enum SessionStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    ARCHIVED = 'archived'
}
export enum ChatMessageType {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system',
    ERROR = 'error'
}
export enum ErrorCode {
    UNAUTHORIZED = 'unauthorized',
    NOT_FOUND = 'not_found',
    INTERNAL_ERROR = 'internal_error',
    BAD_REQUEST = 'bad_request',
    FORBIDDEN = 'forbidden'
}