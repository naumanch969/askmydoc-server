import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import uploadRoutes from "../routes/upload.js";
import chatRoutes from "../routes/chat.js";
import { createServer } from "http";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.NODE_SERVER_PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => { res.send('Welcome to the API'); });

app.use('/api/upload', uploadRoutes)
app.use('/api/chat', chatRoutes)

httpServer.listen(PORT, () => {
    console.log(`Server running (HTTP + Socket) on port ${PORT}`);
});
