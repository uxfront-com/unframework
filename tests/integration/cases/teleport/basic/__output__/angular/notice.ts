import {
  Component,
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  inject,
  input,
  signal,
} from "@angular/core";

export interface NoticeProps {
  message: string;
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

/** Mounts its template's content into the element `ufTeleport` selects once rendered, and removes it on destroy. */
@Directive({ selector: "ng-template[ufTeleport]" })
export class Teleport {
  readonly ufTeleport = input.required<string>();

  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const container = inject(ViewContainerRef);
    const document = inject(DOCUMENT);
    let nodes: Node[] = [];
    afterNextRender(() => {
      const target = document.querySelector(this.ufTeleport());
      if (!target) return;
      const view = container.createEmbeddedView(template);
      view.detectChanges();
      nodes = view.rootNodes;
      target.append(...nodes);
    });
    inject(DestroyRef).onDestroy(() => {
      for (const node of nodes) node.parentNode?.removeChild(node);
    });
  }
}

@Component({
  selector: "uf-notice",
  imports: [ScopeAttributes, Teleport],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let dismissed = this.dismissed();
    <section
      class="inbox"
      aria-label="Inbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>Dismissed {{ dismissed }} times</p>
      <ng-template ufTeleport="body">
        <div data-teleported="true" class="notice">
          <p role="status">{{ message }} ({{ dismissed }})</p>
          <button type="button" (click)="onDismiss()">Dismiss</button>
        </div>
      </ng-template>
    </section>
  `,
})
export default class Notice {
  readonly message = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly dismissed = signal(0);

  protected onDismiss() {
    this.dismissed.update((dismissed) => dismissed + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
