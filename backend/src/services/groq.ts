import Groq from "groq-sdk";
import "dotenv/config";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function chatCompletion(system: string, user: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });
  return res.choices[0]?.message?.content ?? "";
}
