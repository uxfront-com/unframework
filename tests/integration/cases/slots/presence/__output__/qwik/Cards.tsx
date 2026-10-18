import Card from "./Card";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={["cards", className]} style={style}>
        <Card label="Full" title$={() => <h3>Weather</h3>}>
          <p>Sunny, 21°</p>
        </Card>
        <Card label="Bare" />
      </div>
    );
  },
);
