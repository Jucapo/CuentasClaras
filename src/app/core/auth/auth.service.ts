import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { AuthError, Session } from '@supabase/supabase-js';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { APP_PATHS } from '../routing/app-paths';
import { SupabaseService } from '../supabase/supabase.service';
import { authErrorMessage } from './auth-error-messages';

/** Outcome of an auth operation, with a user-facing message on failure. */
export type AuthResult = ActionResult;

const SUCCESS: AuthResult = ACTION_OK;

function failure(error: AuthError): AuthResult {
  return actionFailed(authErrorMessage(error));
}

/** Session state and email/password flows backed by Supabase Auth. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(SupabaseService).client.auth;
  private readonly document = inject(DOCUMENT);
  private readonly currentSession = signal<Session | null>(null);

  readonly session = this.currentSession.asReadonly();
  readonly user = computed(() => this.currentSession()?.user ?? null);
  readonly isAuthenticated = computed(() => this.currentSession() !== null);

  /** Restores the stored session (or the one in a recovery link) and tracks later changes. */
  async init(): Promise<void> {
    const { data } = await this.auth.getSession();
    this.currentSession.set(data.session);
    this.auth.onAuthStateChange((_event, session) => this.currentSession.set(session));
  }

  /** Signs in with email and password. */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.auth.signInWithPassword({ email, password });
    if (error) {
      return failure(error);
    }
    this.currentSession.set(data.session);
    return SUCCESS;
  }

  /** Creates an account; Supabase sends a confirmation email that returns to the login page. */
  async signUp(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.appUrl(APP_PATHS.login) },
    });
    return error ? failure(error) : SUCCESS;
  }

  /** Sends the password reset email, whose link opens the reset page. */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await this.auth.resetPasswordForEmail(email, {
      redirectTo: this.appUrl(APP_PATHS.resetPassword),
    });
    return error ? failure(error) : SUCCESS;
  }

  /** Signs in with the token hash of an invitation email (spec §3.3), confirming the email. */
  async verifyInvite(tokenHash: string): Promise<AuthResult> {
    const { data, error } = await this.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
    if (error) {
      return failure(error);
    }
    this.currentSession.set(data.session);
    return SUCCESS;
  }

  /** Sets a new password for the current (or recovery) session. */
  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await this.auth.updateUser({ password });
    return error ? failure(error) : SUCCESS;
  }

  /** Signs out on this device only. */
  async signOut(): Promise<void> {
    // Local scope on purpose: signing out here must not end the session on the user's other devices.
    await this.auth.signOut({ scope: 'local' });
    this.currentSession.set(null);
  }

  private appUrl(path: string): string {
    return new URL(path, this.document.baseURI).href;
  }
}
