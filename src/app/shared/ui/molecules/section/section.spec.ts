import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Section } from './section';

@Component({
  imports: [Section],
  template: `<cc-section title="Espacio" description="Solo el propietario lo cambia."
    ><p>Hogar</p></cc-section
  >`,
})
class Host {}

describe('Section', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('is a region named by its heading', () => {
    const element = fixture.nativeElement as HTMLElement;
    const section = element.querySelector('section');
    const heading = element.querySelector('h2');
    expect(heading?.textContent).toBe('Espacio');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(element.querySelector('.description')?.textContent).toBe(
      'Solo el propietario lo cambia.',
    );
    expect(element.querySelector('p:not(.description)')?.textContent).toBe('Hogar');
  });
});
