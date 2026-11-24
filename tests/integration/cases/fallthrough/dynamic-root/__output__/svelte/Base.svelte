<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type {
    ClassValue,
    DOMAttributes,
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";

  type Props = Omit<
    HTMLAnchorAttributes & HTMLButtonAttributes,
    | "href"
    | "disabled"
    | "text"
    | "onpress"
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "onpress" | "children"> & {
      href?: string;
      disabled?: boolean;
      text: string;
      onpress?: () => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["a" | "button"] | null;
    };

  let {
    href,
    disabled,
    text,
    onpress,
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();

  function press(event: MouseEvent) {
    event.preventDefault();
    onpress?.();
  }
</script>

<svelte:element
  this={href ? "a" : "button"}
  href={(href ? "a" : "button") === "a" ? href : undefined}
  disabled={(href ? "a" : "button") === "button" ? disabled : undefined}
  class={["base", className]}
  onclick={((event) => {
    press(event);
    onclick?.(event);
  }) satisfies Props["onclick"]}
  style={mergeStyle({ padding: "4px 8px" }, style)}
  bind:this={ref}
  {...attributes}
>{text}</svelte:element>
