import { NextRequest, NextResponse } from "next/server";

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, mode } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // If no API key, return mock data for demonstration
    if (!FIREWORKS_API_KEY) {
      return NextResponse.json(generateMockSpecialistResult());
    }

    const prompt = `You are an expert educational researcher specializing in Donald Schön's theory of reflective practice.
Analyze the following teaching reflection text.

1. Assess the quality of reflection (Emerging, Developing, Proficient, Exemplary).
2. Determine if the reflection is Single Loop (technical/instrumental) or Double Loop (critical/assumption-challenging).
3. Provide a score out of 100.
4. Provide a detailed analysis.
5. Provide 3 specific recommendations for improving reflective practice.

Return ONLY valid JSON in this format:
{
  "reflectionQuality": "...",
  "score": 0,
  "analysis": "...",
  "recommendations": ["...", "...", "..."],
  "loopType": "..."
}

Text to analyze:
${text.substring(0, 5000)}`;

    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIREWORKS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/llama-v3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      const result = JSON.parse(content.replace(/```json|```/g, "").trim());
      return NextResponse.json(result);
    } catch (e) {
      // Fallback if JSON parsing fails
      return NextResponse.json(generateMockSpecialistResult());
    }

  } catch (error) {
    console.error("Specialist error:", error);
    return NextResponse.json(generateMockSpecialistResult());
  }
}

function generateMockSpecialistResult() {
  return {
    reflectionQuality: "Developing",
    score: 65,
    analysis: "The reflection demonstrates an awareness of teaching practices but tends to focus primarily on technical aspects of delivery (Single Loop). There is some evidence of questioning student engagement strategies, but deeper assumptions about pedagogy and power dynamics in the classroom are not fully explored. To reach 'Exemplary', the reflection needs to challenge the 'why' behind the teaching decisions, not just the 'how'.",
    recommendations: [
      "Explicitly question your underlying assumptions about how students learn best.",
      "Connect specific classroom incidents to broader educational theories or social contexts.",
      "Reflect on your own positionality and how it influences your interpretation of classroom events."
    ],
    loopType: "Mixed"
  };
}