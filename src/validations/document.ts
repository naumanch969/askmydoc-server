import { body, param } from 'express-validator';

export const updateDocumentValidation = [
    param('documentId')
        .isMongoId()
        .withMessage('Invalid document ID'),
    body('title')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Title must be between 3 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters')
];

export const deleteDocumentValidation = [
    param('documentId')
        .isMongoId()
        .withMessage('Invalid document ID')
];

export const getDocumentValidation = [
    param('documentId')
        .isMongoId()
        .withMessage('Invalid document ID')
];
