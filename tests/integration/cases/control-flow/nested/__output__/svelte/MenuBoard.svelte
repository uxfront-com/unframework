<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

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

  type Props = MenuBoardProps & { class?: ClassValue; style?: string };

  let { courses, closed, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["menu-board", className]} {style} {...scopeAttributes(attributes)}>
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
