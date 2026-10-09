import type { toolContracts, ToolName } from "@veylo/types";
import type { z } from "zod";

/** What a caller sends (defaults not yet applied). */
export type ToolInput<N extends ToolName> = z.input<(typeof toolContracts)[N]["input"]>;
/** What a handler receives (validated, defaults applied). */
export type ToolArgs<N extends ToolName> = z.output<(typeof toolContracts)[N]["input"]>;
export type ToolOutput<N extends ToolName> = z.output<(typeof toolContracts)[N]["output"]>;
