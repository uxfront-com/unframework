import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-template-tip",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let example = this.example();
    @let note = this.note();
    @let path = this.path();
    <figure
      class="template-tip"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
