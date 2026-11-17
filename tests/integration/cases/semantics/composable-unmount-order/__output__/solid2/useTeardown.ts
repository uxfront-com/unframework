import { onSettled } from "solid-js";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const title = () => `Panel ${name()}`;

  onSettled(() => () => report(`${name()} closed`));

  return { title };
}
