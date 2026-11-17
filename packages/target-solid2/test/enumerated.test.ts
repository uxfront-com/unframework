// An enumerated attribute's boolean (ADR-0102): Vue writes `aria-expanded="false"`, and Solid 2
// would write a boolean as the attribute's presence, so a bound value and a spread's key alike go
// through `enumeratedValue`, which the server render shows.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../src/toolchain/server.ts";
import { compileForServer, emitSource, packageDir } from "./fixtures.ts";

const scratch = join(packageDir, ".uf-tmp", `enumerated-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const SOURCE = `interface Attrs {
  "aria-expanded": boolean;
  draggable: boolean;
}

export default function Disclosure({ pressed, attrs }: { pressed: boolean; attrs: Attrs }) {
  return (
    <div>
      <button type="button" aria-pressed={pressed}>
        Bound
      </button>
      <button type="button" {...attrs}>
        Spread
      </button>
    </div>
  );
}
`;

describe("solid2 enumerated attributes", () => {
  it("writes a bound and a spread boolean as its name, false included", async () => {
    const output = await emitSource(SOURCE);
    expect(output).toContain("aria-pressed={enumeratedValue(props.pressed)}");
    expect(output).toContain('aria-expanded={enumeratedValue(props.attrs["aria-expanded"])}');
    expect(output).toContain("draggable={enumeratedValue(props.attrs.draggable)}");
    const file = join(scratch, "Disclosure.tsx");
    const path = join(scratch, `${randomUUID()}.js`);
    writeFileSync(path, await compileForServer(output, file));
    const component = ((await import(path)) as { default: unknown }).default;
    const html = await renderToString(component, {
      props: { pressed: false, attrs: { "aria-expanded": false, draggable: true } },
    });
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('draggable="true"');
  });
});
