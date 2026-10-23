import Notice from "./Notice";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ build: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ build, class: className, style, ...attributes }) => {
    return (
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <Notice label="Build" action$={() => <a href="#logs">See the logs</a>}>
          Build {build} failed.
        </Notice>
        <Notice label="Deploy" />
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
