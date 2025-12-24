
import { GoogleGenAI } from '@google/genai';

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { messages, systemInstruction, courseContent } = await req.json();
        const apiKey = process.env.API_KEY || process.env.VITE_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'ClÃ© API non configurÃ©e sur le serveur Vercel' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const genAI = new GoogleGenAI({ apiKey });
        // @ts-ignore
        const model = genAI.getGenerativeModel({
            model: 'models/gemini-2.5-flash',
            systemInstruction: `${systemInstruction}\n\nCONTEXTE DU COURS :\n${courseContent}`
        });

        // We take the last message as the prompt
        const lastMessage = messages[messages.length - 1];
        const history = messages.slice(0, -1).map((m: any) => ({
            role: m.role,
            parts: [{ text: m.text }, ...(m.file ? [{ inlineData: { data: m.file.data, mimeType: m.file.mimeType } }] : [])]
        }));

        const chat = model.startChat({
            history: history,
        });

        const result = await chat.sendMessage([{ text: lastMessage.text }, ...(lastMessage.file ? [{ inlineData: { data: lastMessage.file.data, mimeType: lastMessage.file.mimeType } }] : [])]);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ text }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
