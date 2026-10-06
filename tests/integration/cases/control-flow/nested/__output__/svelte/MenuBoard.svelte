<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { courses, closed }: MenuBoardProps = $props();
</script>

<div class="menu-board">
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
