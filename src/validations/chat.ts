import { body, param } from 'express-validator';

export const sendMessageValidation = [
    param('sessionId')
        .isMongoId()
        .withMessage('Invalid session ID'),
    body('message')
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters')
];

export const getChatHistoryValidation = [
    param('sessionId')
        .isMongoId()
        .withMessage('Invalid session ID')
];
