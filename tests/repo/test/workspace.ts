import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { parseSync } from "oxc-parser";

export const root: string = fileURLToPath(new URL("../../..", import.meta.url));

export interface WorkspacePackage {
  directory: string;
  path: string;
  manifest: Record<string, any>;
}

/** The packages under packages/, except the v1 reference compiler. */
export function packages(): WorkspacePackage[] {
  const base = join(root, "packages");
  return readdirSync(base)
    .filter(
      (directory) =>
        directory !== "compiler-v1" && existsSync(join(base, directory, "package.json")),
    )
    .sort()
    .map((directory) => ({
      directory,
      path: join(base, directory),
      manifest: JSON.parse(readFileSync(join(base, directory, "package.json"), "utf8")),
    }));
}

/** Every TypeScript source file under a directory. */
export function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:[cm]?ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(path);
  }
  return files.sort();
}

export interface ImportRecord {
  file: string;
  specifier: string;
  typeOnly: boolean;
}

/** The module specifiers a file imports or re-exports, statically or dynamically. */
export function importsOf(file: string): ImportRecord[] {
  const source = readFileSync(file, "utf8");
  const { module, program } = parseSync(file, source);
  const records: ImportRecord[] = [];
  const name = relative(root, file);
  for (const entry of module.staticImports) {
    const typeOnly = entry.entries.length > 0 && entry.entries.every((item) => item.isType);
    const declaration = program.body.find(
      (statement) => statement.type === "ImportDeclaration" && statement.start === entry.start,
    );
    const declaredType =
      declaration?.type === "ImportDeclaration" && declaration.importKind === "type";
    records.push({
      file: name,
      specifier: entry.moduleRequest.value,
      typeOnly: typeOnly || declaredType,
    });
  }
  for (const entry of module.staticExports) {
    for (const item of entry.entries) {
      if (item.moduleRequest) {
        records.push({ file: name, specifier: item.moduleRequest.value, typeOnly: item.isType });
      }
    }
  }
  for (const entry of module.dynamicImports) {
    const literal = source.slice(entry.moduleRequest.start, entry.moduleRequest.end);
    const match = /^["'`]([^"'`]+)["'`]$/.exec(literal.trim());
    if (match) records.push({ file: name, specifier: match[1]!, typeOnly: false });
  }
  return records;
}

/** The package a bare specifier names (`@scope/name` or `name`); undefined for relative ones. */
export function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) {
    return undefined;
  }
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
