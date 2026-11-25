import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from "@angular/core";

export interface StepperProps {
  start?: number;
}

@Component({
  selector: "uf-stepper",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <div
      class="stepper"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output>{{ count }}</output>
      <button type="button" (click)="add()">Add one</button>
    </div>
  `,
})
export default class Stepper implements OnInit {
  readonly start = input<number, number | undefined>(0, {
    transform: (value) => (value === undefined ? 0 : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufChange = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly count = linkedSignal(() => untracked(() => this.start()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  protected add() {
    this.count.update((count) => count + 1);
    this.ufChange.emit(this.count());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
