import { NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/llm";

/**
 * Reports which LLM providers have API keys configured (server-side). Used by
 * the configurator UI to show only enabled providers and to decide whether to
 * offer ModelCompare. Keys themselves are never exposed.
 */
export async function GET() {
  return NextResponse.json({
    providers: getConfiguredProviders(),
    demoMode: getConfiguredProviders().length === 0,
  });
}
