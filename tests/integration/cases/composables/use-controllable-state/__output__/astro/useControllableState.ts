export function useControllableState<T>(value: () => T | undefined, initial: T) {
  const local = initial as T;
  const current = value() ?? local;

  return { current };
}
