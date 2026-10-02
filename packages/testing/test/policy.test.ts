import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { settleArtefact, settleArtefactDirectory, writeIfChanged } from "../src/node/policy.ts";
import type { ArtefactContext } from "../src/node/policy.ts";

let root: string;
let artefact: string;
let ledgerDir: string;

const write = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "uf-policy-"));
  artefact = join(root, "cases", "basics", "hello", "__expected__", "dom.initial.html");
  ledgerDir = join(root, ".reports", "ledger", "run-1");
});

const check = (role: ArtefactContext["role"]): ArtefactContext => ({
  role,
  update: false,
  root,
  reference: "vue",
});
const update = (role: ArtefactContext["role"]): ArtefactContext => ({
  ...check(role),
  update: true,
  ledgerDir,
});

describe("settleArtefact in check mode", () => {
  it("passes when the committed file matches", () => {
    write(artefact, "<p>Hi</p>\n");
    expect(settleArtefact(artefact, "<p>Hi</p>\n", check("follower"))).toEqual({
      pass: true,
      status: "matched",
      message: "",
    });
  });

  it("fails on a missing file, naming the command and the writer, and never writes", () => {
    const outcome = settleArtefact(artefact, "<p>Hi</p>\n", check("follower"));
    expect(outcome).toMatchObject({ pass: false, status: "missing" });
    expect(outcome.message).toBe(
      "Missing artefact cases/basics/hello/__expected__/dom.initial.html. Run `pnpm test:update` to write it (the reference target, vue, writes it).",
    );
    expect(existsSync(artefact)).toBe(false);
  });

  it("fails on a difference with a diff, and never writes", () => {
    write(artefact, "<p>Hi</p>\n");
    const outcome = settleArtefact(artefact, "<p>Bye</p>\n", check("reference"));
    expect(outcome).toMatchObject({ pass: false, status: "mismatch" });
    expect(outcome.message).toContain("- <p>Hi</p>\n+ <p>Bye</p>");
    expect(outcome.message).toContain("pnpm test:update");
    expect(readFileSync(artefact, "utf8")).toBe("<p>Hi</p>\n");
  });

  it("fails on an artefact this run no longer produces", () => {
    write(artefact, "old\n");
    expect(settleArtefact(artefact, undefined, check("owner"))).toMatchObject({
      pass: false,
      status: "stale",
    });
    expect(settleArtefact(join(root, "absent.json"), undefined, check("owner"))).toMatchObject({
      pass: true,
    });
  });

  it("refuses relative paths", () => {
    expect(() => settleArtefact("cases/x.html", "", check("owner"))).toThrow(/absolute/);
  });
});

describe("settleArtefact in update mode", () => {
  it("lets an owner write, and delete what it no longer produces", () => {
    expect(settleArtefact(artefact, "new\n", update("owner"))).toMatchObject({
      pass: true,
      status: "written",
    });
    expect(readFileSync(artefact, "utf8")).toBe("new\n");
    settleArtefact(artefact, undefined, update("owner"));
    expect(existsSync(artefact)).toBe(false);
    expect(existsSync(ledgerDir)).toBe(false);
  });

  it("lets the reference write and record it in the run's ledger", () => {
    settleArtefact(artefact, "<p>Hi</p>\n", update("reference"));
    expect(readFileSync(artefact, "utf8")).toBe("<p>Hi</p>\n");
    expect(
      existsSync(join(ledgerDir, "cases", "basics", "hello", "__expected__", "dom.initial.html")),
    ).toBe(true);
  });

  it("makes a follower compare against what the reference wrote in this run", () => {
    settleArtefact(artefact, "<p>Hi</p>\n", update("reference"));
    expect(settleArtefact(artefact, "<p>Hi</p>\n", update("follower")).status).toBe("matched");
    const outcome = settleArtefact(artefact, "<p>Bye</p>\n", update("follower"));
    expect(outcome).toMatchObject({ pass: false, status: "mismatch" });
    expect(outcome.message).toMatch(/as the reference wrote it in this run/);
    expect(readFileSync(artefact, "utf8")).toBe("<p>Hi</p>\n");
  });

  it("fails a follower when the reference wrote nothing in this run, even if a file exists", () => {
    write(artefact, "<p>Hi</p>\n");
    const outcome = settleArtefact(artefact, "<p>Hi</p>\n", update("follower"));
    expect(outcome).toMatchObject({ pass: false, status: "missing-reference" });
    expect(outcome.message).toMatch(/The reference target \(vue\) did not write/);
  });

  it("needs the ledger to coordinate the reference and its followers", () => {
    expect(() => settleArtefact(artefact, "x", { role: "reference", update: true, root })).toThrow(
      /ledger/,
    );
  });
});

describe("writeIfChanged", () => {
  it("leaves an unchanged file alone", () => {
    write(artefact, "same\n");
    const past = new Date("2020-01-01T00:00:00Z");
    utimesSync(artefact, past, past);
    expect(writeIfChanged(artefact, "same\n")).toBe(false);
    expect(statSync(artefact).mtime.toISOString()).toBe(past.toISOString());
    expect(writeIfChanged(artefact, "changed\n")).toBe(true);
  });
});

describe("settleArtefactDirectory", () => {
  const directory = () => join(root, "cases", "basics", "hello", "__output__", "vue");
  const files = new Map([
    ["Hello.vue", "<template />\n"],
    ["nested/Part.vue", "<template />\n"],
  ]);

  it("passes when the directory holds exactly the files", () => {
    for (const [file, contents] of files) write(join(directory(), file), contents);
    expect(settleArtefactDirectory(directory(), files, { update: false, root }).pass).toBe(true);
  });

  it("reports missing, stale and different files together", () => {
    write(join(directory(), "Hello.vue"), "<template>old</template>\n");
    write(join(directory(), "Stale.vue"), "x\n");
    const outcome = settleArtefactDirectory(directory(), files, { update: false, root });
    expect(outcome.pass).toBe(false);
    expect(outcome.message).toContain("Stale artefact cases/basics/hello/__output__/vue/Stale.vue");
    expect(outcome.message).toContain(
      "Missing artefact cases/basics/hello/__output__/vue/nested/Part.vue",
    );
    expect(outcome.message).toContain("cases/basics/hello/__output__/vue/Hello.vue differs");
  });

  it("passes for no files and no directory", () => {
    expect(settleArtefactDirectory(directory(), new Map(), { update: false, root }).pass).toBe(
      true,
    );
  });

  it("writes the files and deletes stale ones and empty directories in update mode", () => {
    write(join(directory(), "old", "Stale.vue"), "x\n");
    settleArtefactDirectory(directory(), files, { update: true, root });
    expect(readFileSync(join(directory(), "nested", "Part.vue"), "utf8")).toBe("<template />\n");
    expect(existsSync(join(directory(), "old"))).toBe(false);
    settleArtefactDirectory(directory(), new Map(), { update: true, root });
    expect(existsSync(directory())).toBe(false);
  });
});
