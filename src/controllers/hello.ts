import { Request, Response } from 'express';

export const helloController = (req: Request, res: Response) => {
    res.json({ message: 'Hello from the controller!' });
};