/** Joins an element's ref callbacks into one, whose cleanup runs each one's. */
export function mergeRefs<E extends Element>(
  ...refs: ((element: E | null) => (() => void) | void)[]
): (element: E | null) => () => void {
  return (element) => {
    const cleanups = refs.map((ref) => ref(element));
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  };
}
