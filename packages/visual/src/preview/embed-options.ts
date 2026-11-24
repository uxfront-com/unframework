// An embed's options in its URL (ADR-0116): `controls`, `theme` and `resize`, read the same way by
// the embed page and by the standalone frame it opens. Browser-safe, with no imports: the frame
// imports it, and the embed page writes it into its script with `toString()`, so it reads nothing
// from outside its body.

/** The names of the three parameters, as `protocol.ts` declares them. */
export interface EmbedParamNames {
  controls: string;
  theme: string;
  resize: string;
}

/** What an embed's URL asks for. Each is off when its parameter is absent. */
export interface EmbedOptions {
  controls: boolean;
  theme?: "light" | "dark";
  resize: boolean;
}

/**
 * The options in a URL's parameters, or why they are not ones an embed takes, as a sentence that
 * names the parameter and its values. A parameter given twice must hold an accepted value each
 * time, so a page and its embed never read it differently.
 */
export function embedOptions(
  params: URLSearchParams,
  names: EmbedParamNames,
): EmbedOptions | { error: string } {
  const accepted: [name: string, values: string[]][] = [
    [names.controls, ["true"]],
    [names.theme, ["light", "dark"]],
    [names.resize, ["true"]],
  ];
  for (const [name, values] of accepted) {
    for (const value of params.getAll(name)) {
      if (values.includes(value)) {
        continue;
      }
      const list = values.join(" or ");
      return { error: `The ${name} parameter takes ${list}, not ${JSON.stringify(value)}.` };
    }
  }
  const theme = params.get(names.theme);
  return {
    controls: params.has(names.controls),
    ...(theme === "light" || theme === "dark" ? { theme } : {}),
    resize: params.has(names.resize),
  };
}
