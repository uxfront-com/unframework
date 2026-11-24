import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import ConfirmDialog from "./confirm-dialog";
import {
  ApplicationRef,
  Component,
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  type OnInit,
  Renderer2,
  TemplateRef,
  afterEveryRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface FilesProps {
  file: string;
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
    const application = inject(ApplicationRef);
    const document = inject(DOCUMENT);
    const anchor: Node = inject<ElementRef<Comment>>(ElementRef).nativeElement;
    let view: EmbeddedViewRef<unknown> | undefined;
    const mount = () => {
      const target = document.querySelector(this.ufTeleport());
      if (!target) return;
      view = template.createEmbeddedView({});
      application.attachView(view);
      view.detectChanges();
      target.append(...view.rootNodes);
    };
    const unmount = () => {
      const nodes: Node[] = view?.rootNodes ?? [];
      view?.destroy();
      view = undefined;
      for (const node of nodes) node.parentNode?.removeChild(node);
    };
    // Angular runs a render's callbacks in no source order: each teleport queues itself, and the
    // first to write mounts them all in the order of their anchors. A template projected into a
    // slot that isn't rendered has no anchor in the document, so it waits for one.
    afterEveryRender({
      earlyRead: () => {
        if (!view && anchor.isConnected) TeleportQueue.push({ anchor, mount });
      },
      write: () => {
        const due = TeleportQueue.splice(0).sort((a, b) =>
          a.anchor.compareDocumentPosition(b.anchor) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        );
        for (const each of due) each.mount();
        // The view reads the component's state, which this render may have changed.
        if (view && !anchor.isConnected) unmount();
        else view?.detectChanges();
      },
    });
    inject(DestroyRef).onDestroy(unmount);
  }
}

@Component({
  selector: "uf-files",
  imports: [ConfirmDialog, ScopeAttributes, Fallthrough, Teleport],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly delete = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
