/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
