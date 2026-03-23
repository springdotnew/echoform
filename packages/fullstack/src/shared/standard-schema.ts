/**
 * Standard Schema v1 type definition.
 * Compatible with zod, valibot, arktype, and any library implementing the spec.
 * See: https://github.com/standard-schema/standard-schema
 */

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type Result<Output> =
    | { readonly value: Output }
    | { readonly issues: ReadonlyArray<Issue> };

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey> | undefined;
  }

  /** Infer the input type from a Standard Schema. */
  export type InferInput<T> = T extends StandardSchemaV1<infer I, unknown>
    ? I
    : never;

  /** Infer the output type from a Standard Schema. */
  export type InferOutput<T> = T extends StandardSchemaV1<unknown, infer O>
    ? O
    : never;
}
