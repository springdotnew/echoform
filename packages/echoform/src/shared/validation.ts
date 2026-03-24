import type { StandardSchemaV1 } from "./standard-schema";

/**
 * Format validation issues into a human-readable string.
 */
function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const path = issue.path ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function reportValidationResult(result: StandardSchemaV1.Result<unknown>, context: string): void {
  if ("issues" in result && result.issues) {
    console.warn(
      `[echoform] Schema validation failed (${context}):\n${formatIssues(result.issues)}`,
    );
  }
}

/**
 * Validate a value against a Standard Schema v1 schema (advisory, logs warnings only).
 */
export function validateSchema(
  schema: StandardSchemaV1,
  value: unknown,
  context: string,
): void {
  let result: StandardSchemaV1.Result<unknown> | Promise<StandardSchemaV1.Result<unknown>>;
  try {
    result = schema["~standard"].validate(value);
  } catch (err) {
    console.warn(
      `[echoform] Schema validation threw an error (${context}):`,
      err,
    );
    return;
  }

  if (result instanceof Promise) {
    result
      .then((resolved) => reportValidationResult(resolved, context))
      .catch((err) => {
        console.warn(
          `[echoform] Async schema validation threw an error (${context}):`,
          err,
        );
      });
  } else {
    reportValidationResult(result, context);
  }
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

function toValidationResult(result: StandardSchemaV1.Result<unknown>, context: string): ValidationResult {
  if ("issues" in result && result.issues) {
    const error = `Schema validation failed (${context}):\n${formatIssues(result.issues)}`;
    console.warn(`[echoform] ${error}`);
    return { valid: false, error };
  }
  return { valid: true };
}

/**
 * Validate a value against a Standard Schema v1 schema (strict, returns result).
 * Used for callback input validation where invalid data should be rejected.
 */
export function validateSchemaStrict(
  schema: StandardSchemaV1,
  value: unknown,
  context: string,
): ValidationResult | Promise<ValidationResult> {
  let result: StandardSchemaV1.Result<unknown> | Promise<StandardSchemaV1.Result<unknown>>;
  try {
    result = schema["~standard"].validate(value);
  } catch (err) {
    const error = `Schema validation threw an error (${context}): ${String(err)}`;
    console.warn(`[echoform] ${error}`);
    return { valid: false, error };
  }

  if (result instanceof Promise) {
    return result
      .then((resolved) => toValidationResult(resolved, context))
      .catch((err) => {
        const error = `Async schema validation threw an error (${context}): ${String(err)}`;
        console.warn(`[echoform] ${error}`);
        return { valid: false, error } as ValidationResult;
      });
  }

  return toValidationResult(result, context);
}
