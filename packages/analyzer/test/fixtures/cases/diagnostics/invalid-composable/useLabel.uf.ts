import { useId } from "@uxfront/unframework";

export function useLabel() {
  const id = useId();
  return { id };
}
