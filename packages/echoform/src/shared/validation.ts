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

type ValidResult = { readonly valid: true };
type InvalidResult = { readonly valid: false; readonly error: string };
export type ValidationResult = ValidResult | InvalidResult;

function createValidationError(prefix: string, context: string, err: unknown): InvalidResult {
  const error = `${prefix} (${context}): ${String(err)}`;
  console.warn(`[echoform] ${error}`);
  return { valid: false, error };
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
    return createValidationError("Schema validation threw an error", context, err);
  }

  if (result instanceof Promise) {
    return result
      .then((resolved) => toValidationResult(resolved, context))
      .catch((err) => createValidationError("Async schema validation threw an error", context, err));
  }

  return toValidationResult(result, context);
}
