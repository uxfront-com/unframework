<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface AuthorBylineProps {
    author: string;
    published: string;
    minutes: number;
    affiliation?: string;
  }

  let props: AuthorBylineProps = $props();
</script>

<p
  class="byline"
>By {props.author}, {props.affiliation ?? "independent"}<br /><time
  datetime={props.published}
>{props.published}</time> · {props.minutes} min read</p>
