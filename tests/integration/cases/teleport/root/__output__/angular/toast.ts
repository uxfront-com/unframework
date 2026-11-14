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
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
} from "@angular/core";

export interface ToastProps {
  message: string;
}

/** The teleports a render created, which mount in the document's order. */
const TeleportQueue: { anchor: Node; mount: () => void }[] = [];

/** Mounts its template's content into the element `ufTeleport` selects once rendered, and removes it on destroy. */
@Directive({ selector: "ng-template[ufTeleport]" })
export class Teleport implements OnInit {
  readonly ufTeleport = input.required<string>();
  readonly ufTeleportHost = input<HTMLElement>();
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufTeleportHost();
    for (const name of host?.getAttributeNames() ?? []) {
      if (name.startsWith("data-uf-")) this.renderer.removeAttribute(host, name);
    }
  }

  constructor() {
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    const container = inject(ViewContainerRef);
    const document = inject(DOCUMENT);
    let nodes: Node[] = [];
    const mount = () => {
      const target = document.querySelector(this.ufTeleport());
      if (!target) return;
      const view = container.createEmbeddedView(template);
      view.detectChanges();
      nodes = view.rootNodes;
      target.append(...nodes);
    };
    // Angular runs a render's callbacks in no source order: each teleport queues itself, and the
    // first to write mounts them all in the order of their anchors.
    afterNextRender({
      earlyRead: () => {
        TeleportQueue.push({ anchor: container.element.nativeElement as Node, mount });
      },
      write: () => {
        const due = TeleportQueue.splice(0).sort((a, b) =>
          a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        );
        for (const each of due) each.mount();
      },
    });
    inject(DestroyRef).onDestroy(() => {
      for (const node of nodes) node.parentNode?.removeChild(node);
    });
  }
}

@Component({
  selector: "uf-toast",
  imports: [Teleport],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    <ng-template ufTeleport="body" [ufTeleportHost]="this.host">
      <div data-teleported="true" class="toast" role="alert" data-uf-416dbabb="">
        <p data-uf-416dbabb="">{{ message }}</p>
      </div>
    </ng-template>
  `,
  styleUrl: "./Toast.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Toast {
  readonly message = input.required<string>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
