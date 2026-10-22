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
  selector: "uf-note-editor",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let bold = this.bold();
    @let saves = this.saves();
    <form
      class="note-editor"
      aria-label="Note"
      (submit)="onNoteSubmit($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <label>Title<input name="title" (input)="onTitleInput($event)" /></label>
      <label>Text<textarea name="text"></textarea></label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          [attr.aria-pressed]="bold"
          (mousedown)="onBoldMousedown($event)"
          (click)="onBold()"
        >Bold</button>
      </div>
      <button type="submit" (click)="save()">Save</button>
      <p role="status">Saves: {{ saves }}</p>
    </form>
  `,
})
export default class NoteEditor {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly saved = output<[title: string, bold: boolean]>();
  private readonly title = signal("");
  protected readonly bold = signal(false);
  protected readonly saves = signal(0);

  protected save() {
    this.saves.update((saves) => saves + 1);
    this.saved.emit([this.title(), this.bold()]);
  }

  protected onNoteSubmit(event: SubmitEvent) {
    event.preventDefault();
  }

  protected onTitleInput(event: InputEvent) {
    this.title.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onBoldMousedown(event: MouseEvent) {
    event.preventDefault();
  }

  protected onBold() {
    this.bold.set(!this.bold());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
