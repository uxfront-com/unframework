import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { run, tree, write } from "../helpers.ts";
import { check, consumer, designSystem, inRepository, SOURCE_TREE } from "./helpers.ts";

const TOOLCHAIN = "tests/toolchains/angular";
const FESM = "angular/fesm2022/unframework-angular.mjs";
const TYPES = "angular/types/unframework-angular.d.ts";

const angular = (files: Readonly<Record<string, string>> = {}, under = "") =>
  designSystem({
    config: { targets: ["angular"], package: { resolveFrom: inRepository(TOOLCHAIN) } },
    frameworks: ["@angular/core", "@angular/common"],
    files,
    under,
  });

const ngc = (directory: string) => check(TOOLCHAIN, "ngc", ["-p", directory, "--pretty", "false"]);

const PANEL = {
  "src/Panel.uf.tsx": `import { defineSlots } from "unframework";

export default function Panel(props: { title: string }) {
  const slots = defineSlots<{ default?: () => unknown; head?: (props: { title: string }) => unknown }>();
  return <section><header>{slots.head?.({ title: props.title })}</header>{slots.default?.()}</section>;
}
`,
};

const cardConsumer = (binding: string): string => `import { Component } from "@angular/core";
import { Card, useToggle } from "demo-ds/angular";

@Component({
  selector: "app-consumer",
  imports: [Card],
  template: \`<uf-card [label]="${binding}" />\`,
})
export class Consumer {
  readonly toggle = useToggle;
}
`;

const panelConsumer = (read: string): string => `import { Component } from "@angular/core";
import { Panel, PanelHead } from "demo-ds/angular";

@Component({
  selector: "app-consumer",
  imports: [Panel, PanelHead],
  template: \`
    <uf-panel [title]="'Hi'">
      <ng-template ufPanelHead let-title="title">{{ ${read} }}</ng-template>
    </uf-panel>
  \`,
})
export class Consumer {}
`;

describe("build --package: Angular", () => {
  it("holds the Angular Package Format, partially compiled, with its metadata", async () => {
    const root = angular();
    const before = await run(root, "build", "--package");
    expect(before.stderr).not.toContain("error");
    expect(before.code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(Object.keys(files)).toEqual(
      [FESM, TYPES, "angular/package.json", "package.json", ...SOURCE_TREE].toSorted(),
    );
    const format = JSON.parse(files["angular/package.json"] ?? "");
    expect(format.exports["."]).toEqual({
      types: "./types/unframework-angular.d.ts",
      default: "./fesm2022/unframework-angular.mjs",
    });
    expect(format.sideEffects).toBe(false);
    expect(files[FESM]).toContain("ɵɵngDeclareComponent");
    expect(files[FESM]).not.toContain("ɵɵdefineComponent");
    expect(files[FESM]).not.toContain("sourceMappingURL");
    expect(files[FESM]).not.toContain("tslib");
    expect(files[FESM]).toContain(".card");
    expect(files[TYPES]).toContain("InputSignal<string>");

    const manifest = JSON.parse(files["package.json"] ?? "");
    expect(manifest.exports["./angular"]).toEqual({
      types: `./${TYPES}`,
      default: `./${FESM}`,
    });
    expect(Object.keys(manifest.exports["./angular"])).toEqual(["types", "default"]);
    expect(manifest.peerDependencies).toEqual({
      "@angular/core": "^22.0.0",
      "@angular/common": "^22.0.0",
    });
    expect(manifest.peerDependenciesMeta["@angular/common"]).toEqual({ optional: true });
    // The target's own tree isn't the package.
    expect(tree(join(root, "dist", "angular"))["card.ts"]).toContain("@Component");
  });

  it("comes first in the manifest, whatever the config's order", async () => {
    const root = designSystem({
      config: {
        targets: ["astro", "angular"],
        package: { resolveFrom: { angular: inRepository(TOOLCHAIN) } },
      },
      frameworks: ["@angular/core", "@angular/common"],
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const { exports } = JSON.parse(tree(join(root, "dist", "package"))["package.json"] ?? "");
    expect(Object.keys(exports).slice(0, 2)).toEqual(["./angular", "./astro"]);
  });

  it("gives the same bytes twice, and leaves nothing in the project", async () => {
    const root = angular();
    expect((await run(root, "build", "--package")).code).toBe(0);
    const first = tree(join(root, "dist", "package"));
    expect((await run(root, "build", "--package")).code).toBe(0);
    expect(tree(join(root, "dist", "package"))).toEqual(first);
    expect(JSON.stringify(first)).not.toContain(".package-");
    expect(JSON.stringify(first)).not.toContain(root);
    expect(readdirSync(join(root, "dist")).toSorted()).toEqual(["angular", "package"]);
    expect(existsSync(join(root, "node_modules", ".cache"))).toBe(false);
    expect(existsSync(join(root, ".angular"))).toBe(false);
  });

  it("types a consumer that imports the subpath, and stops one that misuses it", async () => {
    const root = angular();
    expect((await run(root, "build", "--package")).code).toBe(0);
    const good = ngc(consumer(root, "angular", { "consumer.ts": cardConsumer("'Hi'") }));
    expect(good.output).toBe("");
    expect(good.code).toBe(0);
    const bad = ngc(consumer(root, "angular", { "consumer.ts": cardConsumer("1") }));
    expect(bad.code).not.toBe(0);
    expect(bad.output).toContain("TS2322");
  });

  it("exports the slot directives a consumer imports, typed by the slot's props", async () => {
    const root = angular(PANEL);
    expect((await run(root, "build", "--package")).code).toBe(0);
    const good = ngc(consumer(root, "angular", { "consumer.ts": panelConsumer("title.length") }));
    expect(good.output).toBe("");
    expect(good.code).toBe(0);
    const bad = ngc(consumer(root, "angular", { "consumer.ts": panelConsumer("title.nope") }));
    expect(bad.code).not.toBe(0);
    expect(bad.output).toContain("nope");
    const files = tree(join(root, "dist", "package"));
    expect(files[FESM]).toContain('from "@angular/common"');
    // The scoping directive isn't a slot's, so it stays private.
    expect(files[TYPES]).not.toMatch(/export (declare class |\{[^}]*)ScopeAttributes/);
  });

  it("finds a slot directive whose decorator the formatter broke over lines", async () => {
    const slot = "headWithAVeryLongNameThatPushesTheDecoratorPastThePrintWidthOfTheFormatter";
    const root = angular({
      "src/Panel.uf.tsx": `import { defineSlots } from "unframework";

export default function Panel() {
  const slots = defineSlots<{ ${slot}?: () => unknown }>();
  return <section>{slots.${slot}?.()}</section>;
}
`,
    });
    expect((await run(root, "build", "--package")).code).toBe(0);
    const source = tree(join(root, "dist", "angular"))["panel.ts"];
    expect(source).toMatch(/@Directive\(\{\n/);
    expect(tree(join(root, "dist", "package"))[TYPES]).toContain(
      "export declare class PanelHeadWithAVeryLongName",
    );
  });

  it("packages what only the project can declare: a passed-through module, and globals", async () => {
    const root = angular({
      "src/Styled.uf.tsx": `import { tone } from "virtual:styled";

import "virtual:styled.css";

export default function Styled() {
  return <p class={tone()}>Hi</p>;
}
`,
      "src/shared/env.ts": `export const mode: string | undefined = process.env.NODE_ENV;
export const dev: unknown = import.meta.env.DEV;
`,
      "src/Env.uf.tsx": `import { mode } from "./shared/env";

export default function Env() {
  return <p>{mode}</p>;
}
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).not.toContain("error");
    expect(code).toBe(0);
    const files = tree(join(root, "dist", "package"));
    expect(files[FESM]).toContain('from "virtual:styled"');
    expect(files[FESM]).toContain('import "virtual:styled.css"');
    // A declaration that keeps the sheet is an error in a strict consumer (TS2882).
    expect(files[TYPES]).not.toContain("virtual:styled.css");
  });

  it("keeps a sheet's url() as written", async () => {
    const root = angular({
      "src/Card.css": '.card {\n  background: url("./missing.png");\n}\n',
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).not.toContain("error");
    expect(code).toBe(0);
    expect(tree(join(root, "dist", "package"))[FESM]).toContain("url(./missing.png)");
  });

  it("builds under a directory whose name holds .ts. and a space", async () => {
    const root = angular({}, "a.ts.net/with space");
    const { code, stderr } = await run(root, "build", "--package");
    expect(stderr).not.toContain("error");
    expect(code).toBe(0);
  });

  it("reports ngc's own error as UF7009, and keeps the last good package", async () => {
    const root = angular();
    expect((await run(root, "build", "--package")).code).toBe(0);
    const before = tree(join(root, "dist", "package"));
    write(root, {
      "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
    });
    const { code, stderr } = await run(root, "build", "--package");
    expect(code).toBe(1);
    expect(stderr).toContain("UF7009");
    expect(stderr).toContain("TS4094");
    expect(stderr).toContain("dist/angular/shared/format.ts");
    expect(stderr).not.toContain("Compiling with Angular sources");
    expect(tree(join(root, "dist", "package"))).toEqual(before);
  });

  it("leaves ng-packagr's coloured spinner out of UF7009", async () => {
    vi.stubEnv("FORCE_COLOR", "1");
    vi.stubEnv("NO_COLOR", undefined);
    try {
      const root = angular({
        "src/shared/format.ts": `export const formatLabel = (label: string): string => label.trim();
export const Klass = class {
  private y = 1;
};
`,
      });
      const { code, stderr } = await run(root, "build", "--package");
      expect(code).toBe(1);
      expect(stderr).toContain("TS4094");
      expect(stderr).not.toContain("Compiling with Angular sources");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports a project without ng-packagr or Angular as UF7008, and writes nothing", async () => {
    const without = designSystem({
      config: { targets: ["angular"] },
      frameworks: ["@angular/core"],
    });
    const missing = await run(without, "build", "--package");
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("UF7008");
    expect(missing.stderr).toContain("ng-packagr");
    expect(existsSync(join(without, "dist"))).toBe(false);

    const noCore = designSystem({
      config: { targets: ["angular"], package: { resolveFrom: inRepository(TOOLCHAIN) } },
    });
    const untyped = await run(noCore, "build", "--package");
    expect(untyped.code).toBe(1);
    expect(untyped.stderr).toContain("UF7008");
    expect(untyped.stderr).toContain("@angular/core");
  });
});
