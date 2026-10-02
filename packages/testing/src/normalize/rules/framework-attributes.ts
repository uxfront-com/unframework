import type { NormalizeTarget } from "../targets.ts";
import { attributeName, forEachElement } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Attributes a framework adds on its own, which no source asks for, by the target whose
 * framework adds them. Authored attributes, the compiler's own scope attributes (`data-uf-*`)
 * and the serialiser's form state (`uf:*`) are not in the list and always stay.
 */
export const FRAMEWORK_ATTRIBUTES: readonly { framework: NormalizeTarget; pattern: RegExp }[] = [
  // Emulated view encapsulation, on the host and on each element of a styled component.
  { framework: "angular", pattern: /^_nghost-/ },
  { framework: "angular", pattern: /^_ngcontent-/ },
  // Dev-mode input reflection (provideNgReflectAttributes).
  { framework: "angular", pattern: /^ng-reflect-/ },
  // bootstrapApplication's root markers, and hydration data (provideClientHydration).
  { framework: "angular", pattern: /^ng-version$/ },
  { framework: "angular", pattern: /^ng-server-context$/ },
  { framework: "angular", pattern: /^ngh$/ },
  // Qwik 2: q:key, q:p, q:container…; event and data attributes q-e:click, q-d:…, q-w:…; and the
  // bare `:` (Q_PROPS_SEPARATOR) on every server-rendered element.
  { framework: "qwik", pattern: /^q:/ },
  { framework: "qwik", pattern: /^q-[a-z]:/ },
  { framework: "qwik", pattern: /^:$/ },
  // Qwik 1 listeners.
  { framework: "qwik", pattern: /^on(?:-document|-window)?:/ },
  // Hydration keys.
  { framework: "solid", pattern: /^data-hk$/ },
  // Scoped-style hashes, and the dev toolbar's source annotations.
  { framework: "astro", pattern: /^data-astro-cid-/ },
  { framework: "astro", pattern: /^data-astro-source-/ },
];

/**
 * Whether `target`'s framework adds the attribute on its own (see `FRAMEWORK_ATTRIBUTES`). The
 * same name in another target's output is not noise: it is an attribute that target rendered.
 */
export function isFrameworkAttribute(name: string, target: NormalizeTarget): boolean {
  return FRAMEWORK_ATTRIBUTES.some(
    ({ framework, pattern }) => framework === target && pattern.test(name),
  );
}

/**
 * Rule 2: removes every attribute the target's framework added (see `FRAMEWORK_ATTRIBUTES`).
 * Without a target no framework is known, so nothing is noise and every attribute stays: the
 * reference's output is never normalised by another framework's rules.
 */
export function removeFrameworkAttributes(root: TreeParent, target?: NormalizeTarget): void {
  if (target === undefined) return;
  forEachElement(root, (element) => {
    element.attrs = element.attrs.filter(
      (attribute) => !isFrameworkAttribute(attributeName(attribute), target),
    );
  });
}
