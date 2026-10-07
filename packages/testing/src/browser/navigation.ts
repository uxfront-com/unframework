// The navigation guard (ADR-0050): a form submission or a link a component does not prevent
// would navigate the tester frame away, and Vitest then loses the whole spec file ("Cannot
// connect to the iframe"), every test of it unrecorded. So the setup file prevents what the
// component left alone, and the test fails L8 at its next settle, naming what was not prevented.

/** What the guard prevented since a test last took the list. */
const prevented: string[] = [];

let installed = false;

/**
 * Installs the guard once per page: bubbling listeners on `window`, which run after every
 * framework's own (Solid's and Qwik's delegation listen on the document, React's on its root,
 * the others on the element), so a component that prevents the default has done so by then.
 */
export function installNavigationGuard(): void {
  if (installed) return;
  installed = true;
  window.addEventListener("submit", (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    prevented.push(
      `a form submission was not prevented: the component's submit listener must call event.preventDefault() (${describe(event.target)}).`,
    );
  });
  window.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    const link = target instanceof Element ? target.closest("a[href]") : null;
    if (!link) return;
    event.preventDefault();
    prevented.push(
      `a link's navigation was not prevented: a click on a link leaves the page unless the component prevents it (${describe(link)}).`,
    );
  });
}

/** What the guard prevented since this was last called, and forgets it. */
export function takePreventedNavigations(): string[] {
  return prevented.splice(0);
}

/** An element for a message: its tag, and its id or name if it has one. */
function describe(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "outside an element";
  const name = target.getAttribute("id") ?? target.getAttribute("name");
  return `<${target.localName}${name ? ` "${name}"` : ""}>`;
}
