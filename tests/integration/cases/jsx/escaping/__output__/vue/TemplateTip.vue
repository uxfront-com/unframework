<script setup lang="ts">
export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

const { example, note, path } = defineProps<TemplateTipProps>();
</script>

<template>
  <figure class="template-tip">
    <figcaption
      title="Vue {{ name }}, Svelte {#if ok}, Angular @if (ok) &amp; JSX {name}"
    >Template syntax &amp; escaping</figcaption>
    <pre><code>{{ example }}</code></pre>
    <p
      data-sample="<b> &quot;double&quot; 'single' C:\temp"
    >Static: &lt;b>not bold&lt;/b>, {&#123; name }}, @if (ok) { }</p>
    <p>Literal: {&#123; name }} &lt;i>not italic&lt;/i> {#each items} @for "quoted" C:\temp café</p>
    <p title="Say &quot;hi&quot; &amp; wave">Quoted attribute</p>
    <p :title="note" :data-path="path">Bound: {{ note }} in {{ path + "\\index.ts" }}</p>
    <p>Mustache: {{ "{{ " + path + " \u007d\u007d" }}</p>
    <p>Done &amp;check;</p>
  </figure>
</template>
