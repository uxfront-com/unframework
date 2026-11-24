import { Directive, ElementRef, type OnInit, inject } from "@angular/core";

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
@Directive({ selector: "textarea[value]" })
export class TextCaret implements OnInit {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  ngOnInit(): void {
    const field = this.element.nativeElement;
    const text = field.value;
    field.value = "";
    field.value = text;
  }
}
