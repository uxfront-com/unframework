// L10's font audit: text the bundled font cannot render falls back to a system font, which fails
// the capture before anything is compared.
import { expect, inject, it } from "vitest";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

// Update mode would write artefacts for these scenarios, which must stay absent. Without them
// L7 fails too, which is not the subject: its failure is consumed.
describeTargets("stub/fonts", () => {
  it.skipIf(inject("ufHarness").update)(
    "fails L10 on a glyph outside the bundled font",
    async () => {
      const view = await mount({ html: "<p>Latin and 漢字</p>" });
      await view.expectParity("initial");
      expectLayerFailure("L7", /Missing artefact/);
      const l10 = expectLayerFailure(
        "L10",
        /^font-fallback \(check\+live, reference\): Text rendered with a font outside the bundle:/,
      );
      expect(l10).toMatch(/<p> rendered \d+ glyph\(s\) with ".+" \(system font\)/);
    },
  );

  it.skipIf(inject("ufHarness").update)(
    "renders the code elements, monospace in Chromium's own styles, with the bundled font",
    async ({ task }) => {
      const view = await mount({
        html: "<pre>pre</pre><p><code>code</code> <kbd>kbd</kbd> <samp>samp</samp> <tt>tt</tt></p><xmp>xmp</xmp><listing>listing</listing>",
      });
      await view.expectParity("code");
      expectLayerFailure("L7", /Missing artefact/);
      // The audit passed: "dom" is the live reference, so its capture is published, not compared.
      expect(task.meta.uf?.layers.L10).toEqual({ status: "skip", reason: LIVE_REFERENCE_SKIP });
    },
  );

  it.skipIf(inject("ufHarness").update)(
    "fails L10 on a glyph outside the bundled font in a form control's own rendering",
    async () => {
      // A <textarea> draws its text in its user-agent shadow root, which no selector reaches.
      const view = await mount({ html: "<textarea>Latin and 漢字</textarea>" });
      await view.expectParity("textarea");
      expectLayerFailure("L7", /Missing artefact/);
      // An unlabelled textarea, which axe reports, is not the subject either.
      expectLayerFailure("L11", /^axe-core violations differ[\s\S]*\blabel \(critical\)/);
      const l10 = expectLayerFailure("L10", /^font-fallback /);
      expect(l10).toMatch(/<textarea> rendered \d+ glyph\(s\) with ".+" \(system font\)/);
    },
  );
});
