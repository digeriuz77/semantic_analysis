import { NextRequest, NextResponse } from "next/server";
import { getConfiguredProviders, getChatAdapter, isProviderConfigured } from "@/lib/llm";
import { ALL_PROVIDERS, PROVIDER_DEFAULT_MODEL } from "@/lib/providers";
import type { LlmProvider } from "@/types";

export const runtime = "nodejs";

/**
 * Reports which LLM providers have API keys configured (server-side). Used by
 * the configurator UI to show only enabled providers and to decide whether to
 * offer ModelCompare. Keys themselves are never exposed.
 *
 * GET /api/providers?ping=<provider>&model=<id> sends a 1-token test request
 * so a deployment can verify the key + model end-to-end before real analysis.
 */
export async function GET(request: NextRequest) {
  const providers = getConfiguredProviders();

  const ping = request.nextUrl.searchParams.get("ping");
  if (!ping) {
    return NextResponse.json({ providers, demoMode: providers.length === 0 });
  }

  if (!ALL_PROVIDERS.includes(ping as LlmProvider)) {
    return NextResponse.json({ error: `Unknown provider "${ping}"` }, { status: 400 });
  }
  const provider = ping as LlmProvider;
  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { ok: false, error: `${provider} has no API key configured (.env.local)` },
      { status: 400 }
    );
  }

  const model =
    request.nextUrl.searchParams.get("model") || PROVIDER_DEFAULT_MODEL[provider];
  const started = Date.now();
  try {
    const adapter = getChatAdapter(provider);
    const reply = await adapter.complete({
      user: "Reply with the single word: ok",
      temperature: 0,
      maxTokens: 8,
      model,
    });
    return NextResponse.json({
      ok: true,
      provider,
      model,
      latencyMs: Date.now() - started,
      replyPreview: reply.slice(0, 80),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      provider,
      model,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
