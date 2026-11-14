import ConfirmDialog from "./confirm-dialog";
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
  output,
  signal,
} from "@angular/core";

export interface FilesProps {
  file: string;
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
  selector: "uf-files",
  imports: [ConfirmDialog, ScopeAttributes, Teleport],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let file = this.file();
    @let open = this.open();
    <section
      class="files"
      aria-label="Files"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>{{ file }}</p>
      <button type="button" (click)="onClick()">Delete {{ file }}</button>
      @if (open) {
        <ng-template ufTeleport="body">
          <div data-teleported="true" class="backdrop">
            <uf-confirm-dialog
              [title]="'Delete ' + file + '?'"
              (confirm)="confirm()"
              (ufClose)="onClose()"
            />
          </div>
        </ng-template>
      }
    </section>
  `,
})
export default class Files {
  readonly file = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly delete = output<string>();
  protected readonly open = signal(false);

  protected confirm() {
    this.open.set(false);
    this.delete.emit(this.file());
  }

  protected onClick() {
    this.open.set(true);
  }

  protected onClose() {
    this.open.set(false);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
