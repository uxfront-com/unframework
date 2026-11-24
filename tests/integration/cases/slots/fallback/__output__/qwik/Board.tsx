import Notice from "./Notice";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { build: string } & Omit<PropsOf<"div">, "build" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ build, class: className, style, ...attributes }) => {
  return (
    <div class={className} style={style} {...attributes}>
      <Notice label="Build" action$={() => <a href="#logs">See the logs</a>}>
        Build {build} failed.
      </Notice>
      <Notice label="Deploy" />
    </div>
  );
});
