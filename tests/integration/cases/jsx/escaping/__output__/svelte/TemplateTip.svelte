<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TemplateTipProps {
    example: string;
    note: string;
    path: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["figure"],
    "example" | "note" | "path" | "children" | "class" | "style" | "ref"
  > &
    TemplateTipProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["figure"] | null;
    };

  let {
    example,
    note,
    path,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<figure class={["template-tip", className]} {style} bind:this={ref} {...attributes}>
  <figcaption
    title="Vue &#123;&#123; name &#125;&#125;, Svelte &#123;#if ok&#125;, Angular @if (ok) &amp; JSX &#123;name&#125;"
  >Template syntax &amp; escaping</figcaption
  ><pre><code>{example}</code></pre
  ><p
    data-sample="<b> &quot;double&quot; 'single' C:\temp"
  >Static: &lt;b>not bold&lt;/b>, &#123;&#123; name &#125;&#125;, @if (ok) &#123; &#125;</p
  ><p>Literal: &#123;&#123; name &#125;&#125; &lt;i>not italic&lt;/i> &#123;#each items&#125; @for "quoted" C:\temp café</p
  ><p title="Say &quot;hi&quot; &amp; wave">Quoted attribute</p
  ><p title={note} data-path={path}>Bound: {note} in {path + "\\index.ts"}</p
  ><p>Mustache: {"{{ " + path + " }}"}</p
  ><p>Done &amp;check;</p>
</figure>
