import { Component, input } from "@angular/core";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

@Component({
  selector: "uf-template-tip",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let example = this.example();
    @let note = this.note();
    @let path = this.path();
    <figure class="template-tip">
      <ng-container ngNonBindable ngPreserveWhitespaces><figcaption
        title="Vue &#123;&#123; name &#125;&#125;, Svelte &#123;#if ok&#125;, Angular @if (ok) &amp; JSX &#123;name&#125;"
      >Template syntax &amp; escaping</figcaption></ng-container>
      <pre><code>{{ example }}</code></pre>
      <p
        data-sample="<b> &quot;double&quot; 'single' C:\\temp"
      >Static: &lt;b>not bold&lt;/b>, {{ "\\u007b\\u007b" }} name &#125;&#125;, &#64;if (ok) &#123; &#125;</p>
      <p>Literal: {{ "\\u007b\\u007b" }} name &#125;&#125; &lt;i>not italic&lt;/i> &#123;#each items&#125; &#64;for "quoted" C:\\temp café</p>
      <p title="Say &quot;hi&quot; &amp; wave">Quoted attribute</p>
      <p
        [attr.title]="note"
        [attr.data-path]="path"
      >Bound: {{ note }} in {{ path + "\\\\index.ts" }}</p>
      <p>Mustache: {{ "\\u007b\\u007b " + path + " \\u007d\\u007d" }}</p>
      <p>Done &amp;check;</p>
    </figure>
  `,
})
export default class TemplateTip {
  readonly example = input.required<string>();
  readonly note = input.required<string>();
  readonly path = input.required<string>();
}
