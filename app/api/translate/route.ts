import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Initialize OpenAI client inside the function to avoid build-time errors
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    const { text, texts } = await req.json();
    
    // Handle batch processing (multiple texts)
    if (texts && Array.isArray(texts)) {
      if (texts.length === 0) {
        return NextResponse.json(
          { error: "Texts array cannot be empty" }, 
          { status: 400 }
        );
      }

      // Process up to 100 texts in one request
      const textsToProcess = texts.slice(0, 100);
      const batchContent = textsToProcess.map((t, index) => `${index + 1}. ${t}`).join('\n');

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a Football Manager translator. Translate English into natural Indonesian (semi-formal). Use natural and easy-to-understand Indonesian language. Examples: 'We dominated the game' → 'Kita benar-benar menguasai pertandingan.', 'Board expects a top-half finish' → 'Manajemen berharap kita bisa finis di papan atas.', 'Transfer budget adjusted' → 'Dana transfer sudah disesuaikan.' Keep placeholders like [%number#1] unchanged. Avoid slang like 'nguasain' or 'udah', and avoid overly formal language. IMPORTANT: You will receive numbered texts. Return ONLY the translated texts in the same numbered format, one per line. Do not add explanations or additional formatting." 
          },
          { 
            role: "user", 
            content: batchContent 
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      const batchTranslation = completion.choices[0].message.content;
      
      // Parse the numbered responses back into array
      const translatedTexts = batchTranslation
        ?.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim()) || [];

      return NextResponse.json({ 
        translatedTexts: translatedTexts,
        processedCount: textsToProcess.length
      });
    }
    
    // Handle single text processing (backward compatibility)
    if (!text) {
      return NextResponse.json(
        { error: "Text or texts array is required" }, 
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