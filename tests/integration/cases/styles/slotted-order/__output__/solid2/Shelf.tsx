import Amber from "./Amber";
import Blue from "./Blue";
import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default function Shelf(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <section {...props}>
      <Blue>
        <p class="caption" data-uf-721c504a-s="">
          In blue
        </p>
      </Blue>
      <Amber>
        <p class="caption" data-uf-c97301b3-s="">
          In amber
        </p>
      </Amber>
      <KeyedFor each={items} by={(item) => item.label}>
        {(item) => (
          <div>
            <Dynamic component={item.value.warm ? Amber : Blue}>
              <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                {item.value.label}
              </p>
            </Dynamic>
          </div>
        )}
      </KeyedFor>
    </section>
  );
}
