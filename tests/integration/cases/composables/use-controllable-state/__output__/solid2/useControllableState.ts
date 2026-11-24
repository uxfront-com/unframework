import { createState } from "./_unframework/createState";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const [local, setLocal] = createState<T>(initial);
  const current = () => value() ?? local();

  function set(next: T) {
    setLocal(next);
    onChange(next);
  }

  return { current, set };
}
