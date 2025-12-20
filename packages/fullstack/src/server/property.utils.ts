/**
 * Property mapping utilities for server-side view handling.
 */

import type {
  Prop,
  DataProp,
  EventProp,
  ViewProps,
  SerializableValue,
} from "../shared/types";
import type { EventUid, PropName } from "../shared/branded.types";
import { createPropName } from "../shared/branded.types";

/**
 * Reserved prop names that should be filtered out.
 */
const RESERVED_PROPS: ReadonlyArray<string> = ['children', 'key'] as const;

/**
 * Type guard for checking if a value is a function.
 */
function isFunction(value: unknown): value is (...args: ReadonlyArray<SerializableValue>) => unknown {
  return typeof value === 'function';
}

/**
 * Checks if a prop name is valid (not reserved and has a defined value).
 */
export function isValidProp(
  name: string,
  props: ViewProps
): boolean {
  return !RESERVED_PROPS.includes(name) && props[name] !== undefined;
}

/**
 * Maps a prop name and value to a Prop discriminated union.
 * Functions become EventProps, other values become DataProps.
 */
export function mapPropToTransport(
  name: string,
  value: unknown,
  registerEvent: (event: (...args: ReadonlyArray<SerializableValue>) => unknown) => EventUid
): Prop {
  const propName = createPropName(name);

  if (isFunction(value)) {
    const eventProp: EventProp = {
      name: propName,
      type: 'event' as const,
      uid: registerEvent(value),
    };
    return eventProp;
  }

  const dataProp: DataProp = {
    name: propName,
    type: 'data' as const,
    data: value as SerializableValue,
  };
  return dataProp;
}

/**
 * Filters props to only include valid (non-reserved, defined) props.
 */
export function filterValidProps(props: ViewProps): ReadonlyArray<string> {
  return Object.keys(props).filter((name) => isValidProp(name, props));
}

/**
 * Maps all valid props from a ViewProps object.
 */
export function mapAllProps(
  props: ViewProps,
  registerEvent: (event: (...args: ReadonlyArray<SerializableValue>) => unknown) => EventUid
): ReadonlyArray<Prop> {
  return filterValidProps(props).map((name) =>
    mapPropToTransport(name, props[name], registerEvent)
  );
}

/**
 * Finds a prop by name in a prop array.
 */
export function findPropByName(
  props: ReadonlyArray<Prop>,
  name: PropName
): Prop | undefined {
  return props.find((prop) => prop.name === name);
}

/**
 * Creates an updated props array with a new or replaced prop.
 */
export function upsertProp(
  props: ReadonlyArray<Prop>,
  newProp: Prop
): ReadonlyArray<Prop> {
  const existingIndex = props.findIndex((p) => p.name === newProp.name);
  if (existingIndex === -1) {
    return [...props, newProp];
  }
  return [...props.slice(0, existingIndex), newProp, ...props.slice(existingIndex + 1)];
}

/**
 * Removes props by name from a prop array.
 */
export function removeProps(
  props: ReadonlyArray<Prop>,
  namesToRemove: ReadonlyArray<PropName>
): ReadonlyArray<Prop> {
  const nameSet = new Set(namesToRemove);
  return props.filter((prop) => !nameSet.has(prop.name));
}
