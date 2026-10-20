// Angular's hosts in the ARIA snapshot (ADR-0060). Vitest's ARIA snapshot is a fork of
// Playwright's, with its rule that every element whose `display` isn't `inline` is spaced, so it
// shows what the rule changes in the snapshot L7 compares.
import { afterEach, describe, expect, it } from "vitest";

import { inlineHosts } from "../src/normalize/rules/aria-hosts.ts";
import { NORMALIZE_TARGETS } from "../src/normalize/targets.ts";

const HOST = 'style="display: contents"';

/** `html`, rendered in the page. */
function render(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the ARIA snapshot rule: inlineHosts", () => {
  it("leaves out the space each host adds, on Angular, and puts the hosts back", async () => {
    const html = `<p><uf-badge ${HOST}><span>Build</span></uf-badge><uf-pill ${HOST}><span>passing</span></uf-pill></p><p>plain<uf-tag ${HOST}>wide</uf-tag>toggled</p>`;
    const root = render(html);
    await expect.element(root).toMatchAriaInlineSnapshot(`
      - paragraph: Build passing
      - paragraph: plain wide toggled
    `);
    const hosts = [...root.querySelectorAll("uf-badge, uf-pill, uf-tag")];
    const before = hosts.map((host) => host.getAttribute("style"));
    const restore = inlineHosts(root, "angular");
    await expect.element(root).toMatchAriaInlineSnapshot(`
      - paragraph: Buildpassing
      - paragraph: plainwidetoggled
    `);
    restore();
    expect(hosts.map((host) => host.getAttribute("style"))).toEqual(before);
    // A host styled from a style sheet gets no `style` back.
    const bare = render("<style>uf-tag { display: contents }</style><p>a<uf-tag>b</uf-tag></p>");
    inlineHosts(bare, "angular")();
    expect(bare.querySelector("uf-tag")!.hasAttribute("style")).toBe(false);
  });

  it("keeps every space the source writes, beside the same words", async () => {
    const root = render(
      `<section>Build</section><section>passing</section><p>Build passing</p><ul><li>Build</li><li>passing</li></ul><p>Build<uf-s ${HOST}>passing</uf-s> and Build passing, <strong>Build</strong><uf-t ${HOST}>passing</uf-t></p>`,
    );
    const reference = render(
      `<section>Build</section><section>passing</section><p>Build passing</p><ul><li>Build</li><li>passing</li></ul><p>Buildpassing and Build passing, <strong>Build</strong>passing</p>`,
    );
    const restore = inlineHosts(root, "angular");
    const expected = `
      - text: Build passing
      - paragraph: Build passing
      - list:
        - listitem: Build
        - listitem: passing
      - paragraph:
        - text: Buildpassing and Build passing,
        - strong: Build
        - text: passing
    `;
    await expect.element(reference).toMatchAriaInlineSnapshot(expected);
    await expect.element(root).toMatchAriaInlineSnapshot(expected);
    restore();
  });

  it("does nothing on any other target", async () => {
    for (const target of NORMALIZE_TARGETS.filter((each) => each !== "angular")) {
      const html = `<p><uf-a ${HOST}>Build</uf-a><uf-b ${HOST}>passing</uf-b></p>`;
      const root = render(html);
      const restore = inlineHosts(root, target);
      await expect.element(root).toMatchAriaInlineSnapshot(`- paragraph: Build passing`);
      restore();
      expect(root.innerHTML).toBe(html);
      root.remove();
    }
  });

  it("keeps a real difference: a missing word still differs", async () => {
    const root = render(`<p><uf-a ${HOST}>Build</uf-a><uf-b ${HOST}></uf-b></p>`);
    const restore = inlineHosts(root, "angular");
    // The other targets read "Buildpassing"; the rule edits no text.
    await expect.element(root).toMatchAriaInlineSnapshot(`- paragraph: Build`);
    restore();
  });

  it("changes no element that only looks like a host", () => {
    const html = `<p><span ${HOST}>a</span><uf-x>b</uf-x><uf-y style="display: block">c</uf-y></p>`;
    const root = render(html);
    inlineHosts(root, "angular");
    expect(root.innerHTML).toBe(html);
  });

  it("leaves a host whose box parent lays out flex or grid items, which CSS would make a box", () => {
    const html = `<div style="display: flex"><uf-x ${HOST}><span>a</span></uf-x><div><uf-y ${HOST}><uf-z ${HOST}>b</uf-z></uf-y></div></div><div style="display: grid"><uf-w ${HOST}><uf-v ${HOST}>c</uf-v></uf-w></div>`;
    const root = render(html);
    inlineHosts(root, "angular");
    expect([...root.querySelectorAll("[style*='inline']")].map((host) => host.localName)).toEqual([
      "uf-y",
      "uf-z",
    ]);
  });
});
