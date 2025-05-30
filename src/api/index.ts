import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helloRoutes from "../routes/hello.js";

import { createServer } from "http";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = process.env.NODE_SERVER_PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: "AskMyDoc API is running!" });
});

app.get('/hello', helloRoutes)

httpServer.listen(PORT, () =>
    console.log(`Server running (HTTP + Socket) on port ${PORT}`)
);
