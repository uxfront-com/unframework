/**
 * Subscribes to nothing, for `useSyncExternalStore`: whether a component renders on a client,
 * and whether it has mounted, never change once they are true.
 */
export function subscribeNothing(): () => void {
  return () => {};
}
