import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';
import { Form } from './form';

@Component({
  imports: [Form],
  template: `
    <cc-form label="Datos" [form]="f">
      <button type="submit">Enviar</button>
    </cc-form>
  `,
})
class Host {
  readonly action = vi.fn(async () => undefined);
  readonly model = signal({ name: 'Hogar' });
  readonly f = form(
    this.model,
    (path) => {
      required(path.name);
    },
    { submission: { action: this.action } },
  );
}

describe('Form', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  function formElement(): HTMLFormElement {
    return (fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement;
  }

  it('renders a named form without browser validation', () => {
    expect(formElement().getAttribute('aria-label')).toBe('Datos');
    expect(formElement().noValidate).toBe(true);
  });

  it('runs the submission action of a valid form without reloading the page', async () => {
    const event = new Event('submit', { cancelable: true });
    formElement().dispatchEvent(event);
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.action).toHaveBeenCalledTimes(1);
  });

  it('does not submit an invalid form', async () => {
    fixture.componentInstance.model.set({ name: '' });
    formElement().dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.action).not.toHaveBeenCalled();
  });
});
