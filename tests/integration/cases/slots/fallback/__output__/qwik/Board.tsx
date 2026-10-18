import Notice from "./Notice";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ build: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ build, class: className, style }) => {
    return (
      <div class={className} style={style}>
        <Notice label="Build" action$={() => <a href="#logs">See the logs</a>}>
          Build {build} failed.
        </Notice>
        <Notice label="Deploy" />
      </div>
    );
  },
);
