import { fireworksChatCompletion } from "../src/lib/fireworks";

async function test() {
  console.log("Testing fireworksChatCompletion...");
  const apiKey = process.env.FIREWORKS_API_KEY;
  const res = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
      messages: [{ role: "user", content: "Extract 2 themes from: Teacher Carolyne expressed that using dialogue in math was challenging because pupils have low English proficiency." }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });
  console.log("status:", res.status);
  const data = await res.json();
  console.log("data:", JSON.stringify(data, null, 2));
}

test();
