export function styleText(style: object | string | null | undefined): string | undefined {
  if (style === null || style === undefined || typeof style === "string") return style ?? undefined;
  return Object.entries(style)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const property = key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `${property}: ${value}`;
    })
    .join("; ");
}
