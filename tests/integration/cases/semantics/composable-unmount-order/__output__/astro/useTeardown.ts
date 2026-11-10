export function useTeardown(name: () => string) {
  const title = `Panel ${name()}`;

  return { title };
}
