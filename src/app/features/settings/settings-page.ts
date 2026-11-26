import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { APP_PATHS } from '../../core/routing/app-paths';
import { Button } from '../../shared/ui/atoms/button/button';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';

/** User and space settings. For now only shows the session and signs out. */
@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, Section, FormActions, Button],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sessionDescription = computed(() => {
    const email = this.auth.user()?.email;
    return email ? `Sesión iniciada como ${email}` : undefined;
  });
  protected readonly signingOut = signal(false);

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigate(['/', APP_PATHS.login]);
    } finally {
      this.signingOut.set(false);
    }
  }
}
