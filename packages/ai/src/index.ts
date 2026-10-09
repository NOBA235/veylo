// Phase 5-6 adds src/providers/{rules,gemini,openai,bedrock}.ts behind a common interface.
import { AiProviderName } from "@veylo/types";

/** Resolve AI_PROVIDER; unknown or missing values mean `rules`, which needs no keys. */
export function resolveProviderName(
  raw: string | undefined = process.env.AI_PROVIDER,
): AiProviderName {
  const parsed = AiProviderName.safeParse(raw?.trim().toLowerCase());
  return parsed.success ? parsed.data : "rules";
}
