import type { NormalizeTarget } from "../targets.ts";

/** The `display` values whose children are flex or grid items, which CSS makes boxes. */
const ITEM_LAYOUTS = new Set(["flex", "inline-flex", "grid", "inline-grid"]);

/**
 * The ARIA snapshot rule: on Angular only, sets each host under `root` to `display: inline` until
 * the returned function puts its `style` back (ADR-0060). Take the snapshot in between.
 *
 * Playwright's ARIA snapshot puts a space at the start and the end of every element whose
 * `display` isn't `inline`, and Angular's host is `display: contents` (ADR-0010), so two
 * components rendered side by side as inline content read "Build passing" where every other
 * target reads "Buildpassing". An inline host adds no space, so the snapshot comes out as the
 * other targets' does, and Playwright still lays out everything else: no text is edited, so a
 * missing word still differs. The hosts are Angular's `uf-` elements whose computed `display` is
 * `contents`, found in the live DOM.
 *
 * A host whose box parent lays its children out as flex or grid items stays as it is: set inline,
 * CSS would make the host itself a box, and its children inline. Its element children are items,
 * and so boxes, on every target, so the snapshot spaces them anyway.
 */
export function inlineHosts(root: Element, target?: NormalizeTarget): () => void {
  if (target !== "angular") return () => {};
  const hosts = [...root.querySelectorAll("*")].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.localName.startsWith("uf-") &&
      getComputedStyle(element).display === "contents" &&
      !ITEM_LAYOUTS.has(getComputedStyle(boxParent(element)).display),
  );
  const styles = hosts.map((host) => host.getAttribute("style"));
  // The attribute itself, not `host.style`: Chrome writes a CSSOM change back to the attribute
  // later, which would undo the restore.
  hosts.forEach((host, index) => {
    const style = styles[index];
    host.setAttribute("style", `${style ? `${style};` : ""}display: inline !important`);
  });
  return () => {
    hosts.forEach((host, index) => {
      const style = styles[index]!;
      if (style === null) host.removeAttribute("style");
      else host.setAttribute("style", style);
    });
  };
}

/** The element whose box holds `element`'s: its nearest parent that isn't `display: contents`. */
function boxParent(element: Element): Element {
  let parent = element.parentElement!;
  while (parent.parentElement && getComputedStyle(parent).display === "contents") {
    parent = parent.parentElement;
  }
  return parent;
}
