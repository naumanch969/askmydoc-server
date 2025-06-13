import { Worker } from "bullmq";
import { initializeVectorstoreWithDocuments } from "./helper.js";

const worker = new Worker('file-upload-queue',
    async (job) => {

        // Get the file
        const data = JSON.parse(job.data as string);
        const filepath = data.path;

        await initializeVectorstoreWithDocuments(filepath);

    },
    { concurrency: 1, connection: { host: 'localhost', port: 6379 } }
)

