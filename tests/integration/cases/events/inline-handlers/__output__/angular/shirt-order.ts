import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input as input_1,
  signal,
  viewChild,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input_1.required<HTMLElement>();
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
  selector: "uf-shirt-order",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let size = this.size();
    @let quantity = this.quantity();
    @let note = this.note();
    <section
      class="shirt-order"
      aria-label="Shirt order"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">{{ quantity + " x size " + size }}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          [attr.aria-pressed]="size === 'S'"
          (click)="onSmall($event)"
        >Small</button>
        <button
          type="button"
          value="M"
          [attr.aria-pressed]="size === 'M'"
          (click)="onMedium($event)"
        >Medium</button>
        <button
          type="button"
          value="L"
          [attr.aria-pressed]="size === 'L'"
          (click)="onLarge($event)"
        >Large</button>
      </div>
      <button type="button" (click)="onAddOne()">Add one</button>
      <label>Note<input name="note" #noteField (input)="onNoteInput($event)" /></label>
      <p>Note: {{ note }}</p>
      <button type="button" (click)="onReset()">Reset</button>
    </section>
  `,
})
export default class ShirtOrder {
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  private readonly noteField = viewChild<ElementRef<HTMLInputElement>>("noteField");
  protected readonly size = signal("M");
  protected readonly quantity = signal(1);
  protected readonly note = signal("");

  protected onSmall(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onMedium(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onLarge(event: PointerEvent) {
    this.size.set((event.currentTarget as HTMLButtonElement).value);
  }

  protected onAddOne() {
    this.quantity.update((quantity) => quantity + 1);
  }

  protected onNoteInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onReset() {
    this.quantity.set(1);
    this.size.set("M");
    this.note.set("");
    const input = this.noteField()?.nativeElement ?? null;
    if (input) input.value = "";
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
