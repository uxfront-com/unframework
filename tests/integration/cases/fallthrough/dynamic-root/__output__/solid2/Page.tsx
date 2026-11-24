import Base from "./Base";
import Primary from "./Primary";
import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { cx } from "./_unframework/cx";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Page.uf.tsx.css";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [linked, setLinked] = createState(true);
  const [tone, setTone] = createState("rgb(29, 78, 216)");
  const [pressed, setPressed] = createState("none");
  const [items] = createState([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  return (
    <section class={props.class ? `page ${props.class}` : "page"} data-uf-64cf7c28="" {...others}>
      <Primary
        href={linked() ? "#docs" : undefined}
        disabled={true}
        text="Docs"
        class="wide"
        style={{ color: tone() }}
        onPress={() => setPressed("docs")}
        data-uf-64cf7c28=""
      />
      <Base
        disabled={true}
        text="Off"
        class={cx("off", { muted: !linked() })}
        onPress={() => setPressed("off")}
        data-uf-64cf7c28=""
      />
      <Base text="Save" class="save" onPress={() => setPressed("save")} data-uf-64cf7c28="" />
      <ul aria-label="Items" data-uf-64cf7c28="">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li data-uf-64cf7c28="">
              <Dynamic
                component={item.value.href ? "a" : "button"}
                href={(item.value.href ? "a" : "button") === "a" ? item.value.href : undefined}
                disabled={
                  (item.value.href ? "a" : "button") === "button" ? item.value.disabled : undefined
                }
                class="item"
                data-uf-64cf7c28=""
              >
                {item.value.label}
              </Dynamic>
            </li>
          )}
        </KeyedFor>
      </ul>
      <button
        type="button"
        onClick={() => {
          setLinked(!linked());
          setTone(linked() ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)");
        }}
        data-uf-64cf7c28=""
      >
        Toggle
      </button>
      <output data-uf-64cf7c28="">{pressed()}</output>
    </section>
  );
}
