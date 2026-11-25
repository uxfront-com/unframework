export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export default function TemplateTip({ example, note, path }: TemplateTipProps) {
  return (
    <figure class="template-tip">
      <figcaption title="Vue {{ name }}, Svelte {#if ok}, Angular @if (ok) &amp; JSX {name}">
        Template syntax &amp; escaping
      </figcaption>
      <pre>
        <code>{example}</code>
      </pre>
      <p data-sample="&lt;b&gt; &quot;double&quot; 'single' C:\temp">
        Static: &lt;b&gt;not bold&lt;/b&gt;, &#123;&#123; name &#125;&#125;, @if (ok) &#123; &#125;
      </p>
      <p>
        {'Literal: {{ name }} <i>not italic</i> {#each items} @for "quoted" C:\\temp caf\u00e9'}
      </p>
      <p title={'Say "hi" & wave'}>Quoted attribute</p>
      <p title={note} data-path={path}>
        Bound: {note} in {path + "\\index.ts"}
      </p>
      <p>Mustache: {"{{ " + path + " }}"}</p>
      <p>Done &check;</p>
    </figure>
  );
}
