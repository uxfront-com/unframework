// The preview shell's fixtures and the browser commands that serve them, as both sides of the
// shell's browser test see them: `shell-fixture.ts` implements the commands in Node.

/** The design system's catalogue, and a project whose examples nest and order by metadata. */
export const SHELL_FIXTURES = ["design-system", "shell-tree"] as const;
export type ShellFixture = (typeof SHELL_FIXTURES)[number];

declare module "vitest/browser" {
  interface BrowserCommands {
    /**
     * Writes a fixture's shell page to `.output/shell/<name>.html`, with a frame per target (all
     * seven unless `targets` names some) on a stub that answers every render, and returns the page.
     */
    ufShellFixture(name: ShellFixture, targets?: string[]): Promise<{ html: string }>;
    /** Emulates the system's colour scheme, as `prefers-color-scheme` reads it. */
    ufShellColorScheme(scheme: "light" | "dark"): Promise<void>;
  }
}
