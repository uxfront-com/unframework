<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["a" | "button"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["a" | "button"]>, "children"> & {
      href?: string;
      disabled?: boolean;
      text: string;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["a" | "button"] | null;
    };

  let {
    href,
    disabled,
    text,
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();

  function press(event: MouseEvent) {
    event.preventDefault();
  }
</script>

<svelte:element
  this={href ? "a" : "button"}
  href={(href ? "a" : "button") === "a" ? href : undefined}
  disabled={(href ? "a" : "button") === "button" ? disabled : undefined}
  class={["base", className]}
  title="Base"
  onclick={((event) => {
    press(event);
    onclick?.(event);
  }) satisfies Props["onclick"]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</svelte:element>
