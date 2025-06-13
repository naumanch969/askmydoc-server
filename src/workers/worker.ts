import { Worker } from "bullmq";
import { initMemoryVectorStoreFromPDF } from "../utils/chain.js";

const worker = new Worker('file-upload-queue',
    async (job) => {

        // Get the file
        const data = JSON.parse(job.data as string);
        const filepath = data.path;

        await initMemoryVectorStoreFromPDF(filepath);

    },
    { concurrency: 1, connection: { host: 'localhost', port: 6379 } }
)

