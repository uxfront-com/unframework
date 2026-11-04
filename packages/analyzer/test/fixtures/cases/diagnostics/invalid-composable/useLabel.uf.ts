import { useId } from "unframework";

export function useLabel() {
  const id = useId();
  return { id };
}
