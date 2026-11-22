<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface MenuDish {
    id: string;
    name: string;
    price: number;
    vegetarian: boolean;
  }

  export interface MenuCourse {
    id: string;
    title: string;
    dishes: MenuDish[];
  }

  export interface MenuBoardProps {
    courses: MenuCourse[];
    closed: boolean;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "courses" | "closed" | "children" | "class" | "style" | "ref"
  > &
    MenuBoardProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let {
    courses,
    closed,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["menu-board", className]} {style} bind:this={ref} {...attributes}>
  {#if closed}
    <p>The kitchen is closed.</p>
  {:else}
    {#each courses as course (course.id)}
      <section aria-label={course.title}>
        <h2>{course.title}</h2
        ><ul>
          {#each course.dishes as dish (dish.id)}
            <li>{dish.name}, {dish.price.toFixed(2)}{#if dish.vegetarian}<span>{" (vegetarian)"}</span>{/if}</li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>
