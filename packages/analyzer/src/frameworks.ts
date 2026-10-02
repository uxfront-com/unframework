/** Module specifiers that belong to a UI framework, which a component may never import. */
const FRAMEWORK_MODULES: readonly (readonly [RegExp, string])[] = [
  [/^(react|react-dom|react-native|next)(\/.*)?$/, "React"],
  [/^(preact)(\/.*)?$|^@preact\//, "Preact"],
  [/^(vue|nuxt|vue-router|pinia)(\/.*)?$|^@vue\/|^@nuxt\/|^#app(\/.*)?$/, "Vue"],
  [/^svelte(\/.*)?$|^@sveltejs\/|^\$app\//, "Svelte"],
  [/^solid-js(\/.*)?$|^@solidjs\//, "Solid"],
  [/^@angular\//, "Angular"],
  [/^@qwik\.dev\/|^@builder\.io\/qwik(-city)?(\/.*)?$/, "Qwik"],
  [/^astro(\/.*)?$|^astro:|^@astrojs\//, "Astro"],
  [/^lit(\/.*)?$|^@lit\//, "Lit"],
  [/^@stencil\//, "Stencil"],
  [/^@ember\/|^@glimmer\//, "Ember"],
];

/** The framework a module specifier belongs to, if any. */
export function frameworkOf(specifier: string): string | undefined {
  for (const [pattern, framework] of FRAMEWORK_MODULES) {
    if (pattern.test(specifier)) return framework;
  }
  return undefined;
}

/** Whether a specifier is Unframework's authoring API, which the compiler erases. */
export function isAuthoringModule(specifier: string): boolean {
  return specifier === "unframework" || specifier.startsWith("unframework/");
}
