import {
  Component,
  Directive,
  ElementRef,
  InjectionToken,
  type OnInit,
  Renderer2,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

export interface ConfirmDialogProps {
  title: string;
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

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
  selector: "uf-confirm-dialog",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      tabindex="-1"
      class="dialog"
      (keydown)="onKeydown($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2 [attr.id]="titleId">{{ title }}</h2>
      <button type="button" #cancel (click)="ufClose.emit()">Cancel</button>
      <button type="button" (click)="confirm.emit()">Delete</button>
    </div>
  `,
})
export default class ConfirmDialog {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly confirm = output<void>();
  readonly ufClose = output<void>();
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>("cancel");
  protected readonly titleId = `uf-id-confirm-dialog-${inject(idCounter).next++}`;

  constructor() {
    afterNextRender(() => {
      this.cancel()?.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.ufClose.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
