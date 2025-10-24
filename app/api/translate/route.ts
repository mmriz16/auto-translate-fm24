import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return NextResponse.json(
        { error: "Text is required" }, 
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a Football Manager translator. Translate English into natural Indonesian (semi-formal). Use natural and easy-to-understand Indonesian language. Examples: 'We dominated the game' → 'Kita benar-benar menguasai pertandingan.', 'Board expects a top-half finish' → 'Manajemen berharap kita bisa finis di papan atas.', 'Transfer budget adjusted' → 'Dana transfer sudah disesuaikan.' Keep placeholders like [%number#1] unchanged. Avoid slang like 'nguasain' or 'udah', and avoid overly formal language. IMPORTANT: Return ONLY the translated text without quotes, explanations, or additional formatting." 
        },
        { 
          role: "user", 
          content: text 
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const translation = completion.choices[0].message.content;
    
    return NextResponse.json({ 
      translatedText: translation 
    });
    
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { 
        error: "Translation failed", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}