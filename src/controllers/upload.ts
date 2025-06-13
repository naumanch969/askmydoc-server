import { Request, Response } from 'express';
import { Queue } from 'bullmq'

const queue = new Queue('file-upload-queue', { connection: { host: 'localhost', port: 6379 } })

export const uploadPDF = async (req: Request, res: any) => {

    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('file', file)

    // Add to queue
    await queue.add('file-ready', JSON.stringify({ filename: file.originalname, destination: file.destination, path: file.path }))



    res.json({ message: 'Hello from the controller!' });
};