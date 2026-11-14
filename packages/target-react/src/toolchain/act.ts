// What the React mount and hydrate adapters share (browser).
import type { MountListener } from "@unframework.dev/codegen";
import { act as reactAct } from "react";

/** React's props for the test's listeners: `onChange` for `change`, as the emitted output reads them. */
export function listenerProps(
  on: Readonly<Record<string, MountListener>> = {},
): Record<string, MountListener> {
  return Object.fromEntries(
    Object.entries(on).map(([name, listener]) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
      listener,
    ]),
  );
}

/**
 * React's `act`, with `IS_REACT_ACT_ENVIRONMENT` set only while it runs: inside `act` React
 * expects the flag (it logs an error without it), and outside it the flag would make React
 * report every update a scheduled task makes as an update outside `act`.
 */
export async function act<T>(callback: () => T | Promise<T>): Promise<T> {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  try {
    return await reactAct(callback);
  } finally {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
  }
}
