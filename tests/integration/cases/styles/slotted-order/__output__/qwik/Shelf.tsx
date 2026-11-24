import Amber from "./Amber";
import Blue from "./Blue";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <section class={className} style={style} {...attributes}>
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
      {items.map((item) => {
        const Tag = item.warm ? Amber : Blue;

        return (
          <div key={item.label}>
            <Tag>
              <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                {item.label}
              </p>
            </Tag>
          </div>
        );
      })}
    </section>
  );
});
