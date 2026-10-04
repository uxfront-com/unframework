<script setup lang="ts">
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

const { courses, closed } = defineProps<MenuBoardProps>();
</script>

<template>
  <div class="menu-board">
    <p v-if="closed">The kitchen is closed.</p>
    <template v-else>
      <section v-for="course in courses" :key="course.id" :aria-label="course.title">
        <h2>{{ course.title }}</h2>
        <ul>
          <li
            v-for="dish in course.dishes"
            :key="dish.id"
          >{{ dish.name }}, {{ dish.price.toFixed(2) }}<span
            v-if="dish.vegetarian"
          > (vegetarian)</span></li>
        </ul>
      </section>
    </template>
  </div>
</template>
