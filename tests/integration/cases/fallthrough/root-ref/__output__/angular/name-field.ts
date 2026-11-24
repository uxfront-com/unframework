import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input as input_1,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-name-field",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <input
      #input
      name="name"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      (focus)="fill()"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    />
  `,
})
export default class NameField {
  readonly label = input_1.required<string>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");
  readonly ufElement = viewChild<ElementRef<HTMLInputElement>>("ufElement");
  private readonly mounted = signal(false);

  constructor() {
    afterNextRender(() => {
      this.mounted.set((this.input()?.nativeElement ?? null) !== null);
    });
  }

  protected fill() {
    if (this.input()?.nativeElement && !this.input()!.nativeElement.value && this.mounted())
      this.input()!.nativeElement.value = "Ada";
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
