async function listModels() {
  const key = process.env.FIREWORKS_API_KEY;
  const res = await fetch("https://api.fireworks.ai/inference/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  const ids: string[] = (data.data || []).map((m: any) => m.id);
  console.log("Total models:", ids.length);
  console.log("Models matching llama / qwen / deepseek / glm:");
  console.log(ids.filter(id => id.includes("llama") || id.includes("qwen") || id.includes("glm") || id.includes("deepseek")));
}
listModels();
