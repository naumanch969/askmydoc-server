import { body, param } from 'express-validator';

export const createSessionValidation = [
    body('documentId')
        .isMongoId()
        .withMessage('Invalid document ID'),
    body('title')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Title must be between 3 and 100 characters')
];

export const updateSessionValidation = [
    param('sessionId')
        .isMongoId()
        .withMessage('Invalid session ID'),
    body('title')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Title must be between 3 and 100 characters'),
    body('metadata')
        .optional()
        .isObject()
        .withMessage('Metadata must be an object')
];

export const deleteSessionValidation = [
    param('sessionId')
        .isMongoId()
        .withMessage('Invalid session ID')
];

export const getSessionValidation = [
    param('sessionId')
        .isMongoId()
        .withMessage('Invalid session ID')
];
