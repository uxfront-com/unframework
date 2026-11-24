import { DestroyRef, Directive, ElementRef, Renderer2, inject, output } from "@angular/core";

@Directive({ selector: "[ufKeydownOnce]" })
export class KeydownOnce {
  readonly ufKeydownOnce = output<KeyboardEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "keydown",
      (event: KeyboardEvent) => this.ufKeydownOnce.emit(event),
      { once: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}
