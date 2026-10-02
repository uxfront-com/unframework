// L10's font audit: text the bundled font cannot render falls back to a system font, which fails
// the capture before anything is compared.
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { describeTargets, LayerFailure, mount } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

// Update mode would write artefacts for this scenario, which must stay absent.
describeTargets("stub/fonts", () => {
  it.skipIf(inject("ufHarness").update)(
    "fails L10 on a glyph outside the bundled font",
    async () => {
      const view = await mount({ html: "<p>Latin and 漢字</p>" });
      const error = await view.expectParity("initial").then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(LayerFailure);
      const l10 = (error as LayerFailure).failures.find((failure) => failure.startsWith("L10: "));
      expect(l10).toMatch(
        /^L10: font-fallback \(check\+live, reference\): Text rendered with a font outside the bundle:/,
      );
      expect(l10).toMatch(/<p> rendered \d+ glyph\(s\) with ".+" \(system font\)/);
    },
  );

  it.skipIf(inject("ufHarness").update)(
    "fails L10 on a glyph outside the bundled font in a form control's own rendering",
    async () => {
      // A <textarea> draws its text in its user-agent shadow root, which no selector reaches.
      const view = await mount({ html: "<textarea>Latin and 漢字</textarea>" });
      const error = await view.expectParity("textarea").then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(LayerFailure);
      const l10 = (error as LayerFailure).failures.find((failure) => failure.startsWith("L10: "));
      expect(l10).toMatch(/<textarea> rendered \d+ glyph\(s\) with ".+" \(system font\)/);
    },
  );
});
