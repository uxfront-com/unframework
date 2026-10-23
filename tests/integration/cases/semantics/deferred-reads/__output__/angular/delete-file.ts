import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface DeleteFileProps {
  fileName: string;
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
  selector: "uf-delete-file",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fileName = this.fileName();
    @let copies = this.copies();
    @let confirming = this.confirming();
    <section
      class="delete-file"
      aria-label="File"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>{{ fileName }}, {{ copies }}&ngsp;{{ copies === 1 ? "copy" : "copies" }}</p>
      <button type="button" (click)="addCopy()">Add a copy</button>
      @if (confirming) {
        <button type="button" (click)="confirmDelete()">Confirm the deletion</button>
      } @else {
        <button type="button" (click)="requestDelete()">Delete</button>
      }
    </section>
  `,
})
export default class DeleteFile {
  readonly fileName = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly deleted = output<[fileName: string, copies: number]>();
  protected readonly copies = signal(1);
  protected readonly confirming = signal(false);
  private resolveConfirmation: (() => void) | undefined;

  protected async requestDelete() {
    this.confirming.set(true);
    await new Promise<void>((resolve) => {
      this.resolveConfirmation = resolve;
    });
    this.confirming.set(false);
    this.deleted.emit([this.fileName(), this.copies()]);
  }

  protected addCopy() {
    this.copies.update((copies) => copies + 1);
  }

  protected confirmDelete() {
    this.resolveConfirmation?.();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
