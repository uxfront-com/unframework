---
"@uxfront/unframework": minor
"@unframework.dev/ir": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/compiler": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-solid2": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-astro": minor
---

Pass a consumer's attributes, listeners and ref through to a component's root on every target. An attribute or a DOM listener a component doesn't declare now lands on its root element, or passes on to its root component, where it used to be UF3035 or UF3036: `<SaveButton id="save" aria-describedby="hint" type="submit" onFocus={track} />`. The consumer's value wins over the root's own, and `class` and `style` merge as before. A `ref` on a component that doesn't call `defineExpose` holds its root element, typed as that element: `useTemplateRef<HTMLButtonElement>()`. To put what a consumer passes on another element, set `defineOptions({ inheritAttrs: false })` and spread the props' rest on it, `function Field({ label, ...rest }: FieldProps)` with `<input {...rest} />`.

Each target writes it its own way, which ADR-0118 records. Two changes to what the outputs declare:

- React's `<Name>Attributes` is now a type alias of the root element's props, without the component's own.
- Angular reserves `ufAttributes`, `ufListeners` and `ufElement` as prop names (UF2003), since a component that takes fallthrough declares them. A hand-written Angular consumer passes an attribute in `[ufAttributes]`, since one written on the host stays on the host.
