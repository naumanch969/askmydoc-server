import multer from "multer"
import { Document } from "@langchain/core/documents"
import path from "path";

export const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || 'uploads');
    },
    filename: (req, file, cb) => {

        const now = new Date();
        const timestamp = now.toLocaleString('sv-SE', { timeZone: 'Asia/Karachi' }).replace(/[: ]/g, '-');
        const originalName = file.originalname;
        const ext = path.extname(originalName);

        const baseName = path.basename(originalName, ext);
        const prefix = `${timestamp}-`; // e.g., 25 + 1 = 26 chars

        const maxFilenameLength = 255;
        const availableLength = maxFilenameLength - prefix.length - ext.length;

        // Truncate baseName if it's too long
        const safeBaseName = baseName.length > availableLength
            ? baseName.slice(0, availableLength)
            : baseName;

        const finalName = `${prefix}${safeBaseName}${ext}`;
        cb(null, finalName);
    }
});

export const convertDocsToString = (documents: Document[]): string => {
    return documents.map((document) => {
        return `<doc>\n${document.pageContent}\n</doc>`
    }).join("\n");
};

export const getNamespace = (userId: string, filename: string) => {
    const namespace = `${userId}::${filename}`;
    return namespace.replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize namespace
}