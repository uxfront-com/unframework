import { ref } from "unframework";

import Groups from "./Groups.uf.tsx";

// Listeners and models in a list inside a fill, and in a fill whose component sits in a list:
// Qwik's optimizer hoists an arrow's capture there out of the fill's segment, which then reads
// a name it does not declare (src/listeners.ts, `Listeners.explicit`).
export default function FillLists() {
  const chosen = ref("none");
  const picked = ref<string[]>([]);
  function choose(name: string) {
    chosen.value = name;
  }
  return (
    <div>
      <p role="status">
        {chosen.value} {picked.value.join(",")}
      </p>
      <Groups items={["Ada", "Bo"]}>
        {{
          group: ({ items }) => (
            <ul>
              {items.map((name) => (
                <li key={name}>
                  <button type="button" onClick={() => choose(name)}>
                    Pick {name}
                  </button>
                  <label>
                    <input type="checkbox" value={name} v-model={picked.value} />
                    Tick {name}
                  </label>
                </li>
              ))}
            </ul>
          ),
        }}
      </Groups>
      {["x", "y"].map((outer) => (
        <section key={outer}>
          <Groups items={["1"]}>
            {{
              group: ({ items }) => (
                <button type="button" onClick={() => choose(outer + items.join(""))}>
                  Pick {outer}
                </button>
              ),
            }}
          </Groups>
        </section>
      ))}
    </div>
  );
}
