// The MCP SDK registers tools with Zod raw shapes. Derive them from the contract registry.
import { toolContracts, type ToolName } from "@veylo/types";
import { z, type ZodRawShape } from "zod";

export function inputShape(name: ToolName): ZodRawShape {
  return (toolContracts[name].input as z.ZodObject<ZodRawShape>).shape;
}

/** Some outputs carry refinements (ZodEffects); the SDK needs the underlying object's shape. */
export function outputShape(name: ToolName): ZodRawShape {
  const schema = toolContracts[name].output as z.ZodTypeAny;
  const base = schema instanceof z.ZodEffects ? schema.innerType() : schema;
  if (!(base instanceof z.ZodObject)) throw new Error(`Output schema of ${name} is not an object`);
  return base.shape as ZodRawShape;
}
