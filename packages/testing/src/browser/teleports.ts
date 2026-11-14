// What a view teleported (ADR-0098): the elements its render appends to `document.body`, outside
// its container. A teleport's content mounts into `to` once its component has mounted, and the
// corpus pins `to="body"`, so every capture of the view covers its container, then these
// elements in `body` order (L7, L9, L10, L11 and L12's).
//
// The page's `body` is read as it is whenever a capture or a query needs it: each element child
// that holds no mount root, was not there when the test started, and no view or client render
// has claimed yet is claimed by the one reading. The harness reads a view right after each of
// its actions settles, so what an action teleported goes to the view that acted. A claimed
// element carries a test id of its view's, `uf-root-N-teleported`, through which the view's
// queries (`view.getByRole`) and `view.user` reach it and what it holds. The captures leave that
// stamp out.

import { ROOT_ATTRIBUTE } from "./determinism.ts";

/** The test id of what a view teleported, beside its container's `uf-root-N`. */
export function teleportedTestId(testId: string): string {
  return `${testId}-teleported`;
}

/** Who claims teleported elements: a view, or L12's client render. */
export type TeleportOwner = object;

/** The owner of each claimed element. */
const owners = new WeakMap<Element, TeleportOwner>();

/** The test id each claimed element carries for its view, which no capture shows. */
const stamps = new WeakMap<Element, string>();

/** The elements in `body` when the test started, which nothing in it teleported. */
let baseline = new WeakSet<Element>(document.body.children);

/** Starts a test: what `body` holds now is the page's, not anything a view teleports. */
export function startTeleports(): void {
  baseline = new WeakSet(document.body.children);
}

/** Whether an element of `body` is a mount root, or holds one (L12's client render's `<form>`). */
function holdsRoot(element: Element): boolean {
  return (
    element.hasAttribute(ROOT_ATTRIBUTE) || element.querySelector(`[${ROOT_ATTRIBUTE}]`) !== null
  );
}

/**
 * Claims what `body` holds that no one has, then gives the owner's elements in `body` order.
 * `stamp` is the test id each element it claims carries for its view; an element with a test id
 * of its own fails, since the stamp would replace it.
 */
export function teleportedBy(owner: TeleportOwner, stamp?: string): Element[] {
  const found: Element[] = [];
  for (const element of document.body.children) {
    if (!owners.has(element) && !baseline.has(element) && !holdsRoot(element)) {
      if (stamp !== undefined) {
        const own = element.getAttribute("data-testid");
        if (own !== null && own !== stamp) {
          throw new Error(
            `A teleported <${element.localName}> has a data-testid of its own, "${own}": the harness gives what a view teleports a test id of the view's, so its queries reach it. Query it by its role, its label or its text.`,
          );
        }
        element.setAttribute("data-testid", stamp);
        stamps.set(element, stamp);
      }
      owners.set(element, owner);
    }
    if (owners.get(element) === owner) found.push(element);
  }
  return found;
}

/**
 * Runs `read` with the stamps taken off the elements, synchronously, so no framework sees them
 * gone: the DOM capture shows what the component rendered.
 */
export function withoutStamps<T>(elements: readonly Element[], stamp: string, read: () => T): T {
  const stamped = elements.filter((element) => element.getAttribute("data-testid") === stamp);
  for (const element of stamped) element.removeAttribute("data-testid");
  try {
    return read();
  } finally {
    for (const element of stamped) element.setAttribute("data-testid", stamp);
  }
}

/**
 * What the test left in `body` (ADR-0098): every element that was not there when it started and
 * holds no mount root, once its views are unmounted. A component that appends to `body`, a
 * teleport's content included, removes it when it unmounts.
 */
export function leftInBody(): string[] {
  return [...document.body.children]
    .filter((element) => !baseline.has(element) && !holdsRoot(element))
    .map((element) => {
      const attributes = [...element.attributes]
        .filter(({ name, value }) => name !== "data-testid" || stamps.get(element) !== value)
        .map(({ name, value }) => (value === "" ? ` ${name}` : ` ${name}="${value}"`))
        .join("");
      return `<${element.localName}${attributes}>`;
    });
}
