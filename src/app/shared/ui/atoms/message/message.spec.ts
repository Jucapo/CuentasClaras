import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Message } from './message';

@Component({
  imports: [Message],
  template: `
    <cc-message>No se pudo guardar.</cc-message>
    <cc-message tone="info">Te enviamos un correo.</cc-message>
  `,
})
class Host {}

describe('Message', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('announces errors as alerts and information as status', () => {
    const [error, info] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('cc-message'),
    );
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent?.trim()).toBe('No se pudo guardar.');
    expect(info.getAttribute('role')).toBe('status');
    expect(info.classList).toContain('tone-info');
  });
});
