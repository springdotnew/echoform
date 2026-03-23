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

/**
 * Validate a value against a Standard Schema v1 schema.
 *
 * Returns `true` if valid, logs a warning and returns `false` if invalid.
 * Handles both sync and async validation results.
 *
 * @param schema - The Standard Schema v1 schema to validate against.
 * @param value - The value to validate.
 * @param context - A description of where the validation is happening (for logging).
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
      `[react-fullstack] Schema validation threw an error (${context}):`,
      err,
    );
    return;
  }

  if (result instanceof Promise) {
    result.then((resolved) => {
      if ("issues" in resolved && resolved.issues) {
        console.warn(
          `[react-fullstack] Schema validation failed (${context}):\n${formatIssues(resolved.issues)}`,
        );
      }
    }).catch((err) => {
      console.warn(
        `[react-fullstack] Async schema validation threw an error (${context}):`,
        err,
      );
    });
  } else {
    if ("issues" in result && result.issues) {
      console.warn(
        `[react-fullstack] Schema validation failed (${context}):\n${formatIssues(result.issues)}`,
      );
    }
  }
}
