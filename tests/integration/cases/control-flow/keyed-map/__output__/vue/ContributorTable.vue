<script setup lang="ts">
export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

const { caption, contributors } = defineProps<ContributorTableProps>();
</script>

<template>
  <table class="contributors">
    <caption>{{ caption }}</caption>
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Commits</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="contributor in contributors" :key="contributor.login">
        <td>
          <a :href="`https://example.com/people/${contributor.login}`">{{ contributor.name }}</a>
        </td>
        <td>{{ contributor.commits }}</td>
      </tr>
    </tbody>
  </table>
</template>
