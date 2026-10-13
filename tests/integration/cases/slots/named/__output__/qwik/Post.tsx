import Card from "./Card";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ author: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ author, class: className, style }) => {
    return (
      <>
        <Card
          header$={() => <h2>Release notes</h2>}
          footer$={() => <small>By {author}</small>}
          class={className}
          style={style}
        >
          <p>Slots arrive in M3.</p>
        </Card>
      </>
    );
  },
);
