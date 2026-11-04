export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  let local = $state.raw<T>(initial);
  const current = $derived(value() ?? local);

  function set(next: T) {
    local = next;
    onChange(next);
  }

  return {
    get current() {
      return current;
    },
    set,
  };
}
