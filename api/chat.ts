// Passage en Serverless Function classique pour Ã©viter les timeouts de 10s de l'Edge
// export const config = {
//     runtime: 'edge',
// };

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

        const modelId = 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        // ... (Historique reste identique)
        const contents = messages.map((m: any) => {
            const parts: any[] = [{ text: m.text }];
            if (m.file) {
                parts.push({
                    inlineData: {
                        mimeType: m.file.mimeType,
                        data: m.file.data
                    }
                });
            }
            return {
                role: m.role === 'model' ? 'model' : 'user',
                parts
            };
        });

        const body = {
            contents,
            systemInstruction: {
                parts: [{ text: `${systemInstruction}\n\nCONTEXTE DU COURS :\n${courseContent}` }]
            },
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({ error: `Erreur API Google (${response.status}): ${errorText}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Erreur API Gemini');
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "DÃ©solÃ©e, je n'ai pas pu gÃ©nÃ©rer de rÃ©ponse.";

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
