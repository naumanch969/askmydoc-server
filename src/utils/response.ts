import { Response } from 'express';
import { ApiResponse } from '../interfaces/index.js';

export const sendResponse = <T>(res: Response, data: T, message?: string, status = 200): void => {
    const response: ApiResponse<T> = {
        data,
        message,
        status
    };
    res.status(status).json(response);
};

export const sendError = (res: Response, message: string, status = 500): void => {
    const response: ApiResponse<null> = {
        data: null,
        message,
        status
    };
    res.status(status).json(response);
}; 