import { NextRequest, NextResponse } from "next/server";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || "http://localhost:8000";
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Send file to Python NLP Service for cleaning and basic stats
    const nlpFormData = new FormData();
    nlpFormData.append("file", file);

    const nlpResponse = await fetch(`${NLP_SERVICE_URL}/process`, {
      method: "POST",
      body: nlpFormData,
    });

    if (!nlpResponse.ok) {
      throw new Error("NLP Service unavailable");
    }

    const nlpData = await nlpResponse.json();

    // 2. Use Fireworks AI for Thematic Analysis (Simulated if no key)
    let themes = [];
    let sentiment = { positive: 33, neutral: 34, negative: 33 };

    if (FIREWORKS_API_KEY) {
      // Call Fireworks AI for theme extraction
      const fwResponse = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "accounts/fireworks/models/llama-v3-70b-instruct",
          messages: [
            {
              role: "user",
              content: `Analyze the following text using Braun and Clarke's thematic analysis approach. Identify 3-5 key themes. Return ONLY a JSON array of objects with keys: "name", "description", "keywords" (array of strings), "prevalence" (integer 0-100). Do not include markdown formatting.\n\nText: ${nlpData.cleaned_text.substring(0, 4000)}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (fwResponse.ok) {
        const fwData = await fwResponse.json();
        const content = fwData.choices[0].message.content;
        try {
          themes = JSON.parse(content.replace(/```json|```/g, "").trim());
        } catch (e) {
          console.error("Failed to parse AI themes", e);
        }
      }
    }

    // Fallback themes if AI fails or no key
    if (themes.length === 0) {
      themes = nlpData.top_keywords.slice(0, 5).map((kw: any) => ({
        name: kw.word.charAt(0).toUpperCase() + kw.word.slice(1),
        description: `Cluster related to the concept of "${kw.word}"`,
        keywords: [kw.word],
        prevalence: Math.min(100, Math.round((kw.count / nlpData.stats.total_words) * 1000))
      }));
    }

    // Mock sentiment if not provided by NLP service
    if (nlpData.sentiment) {
      sentiment = nlpData.sentiment;
    }

    return NextResponse.json({
      fileName: file.name,
      stats: nlpData.stats,
      wordFrequency: nlpData.top_keywords,
      themes: themes,
      sentiment: sentiment,
      cleanedText: nlpData.cleaned_text.substring(0, 5000) // Limit text sent to client
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal Server Error during analysis" },
      { status: 500 }
    );
  }
}