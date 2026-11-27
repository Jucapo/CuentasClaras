import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ACTION_OK, actionFailed, ActionResult, DataResult } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { NewSpace, SpaceMembership, SpacePatch, SpaceSettingsPatch } from './space.models';
import { SpacesApi } from './spaces.api';

interface LoadedSpaces {
  readonly userId: string;
  readonly memberships: readonly SpaceMembership[];
}

/** The user's spaces and the active one, remembered in `user_settings.last_space_id`. */
@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(SpacesApi);
  private readonly userSettings = inject(UserSettingsService);

  private readonly loaded = signal<LoadedSpaces | null>(null);
  private readonly selectedId = signal<string | null>(null);
  private pendingLoad: Promise<ActionResult> | null = null;

  /** Spaces the user belongs to, oldest membership first. */
  readonly memberships = computed(() => this.loaded()?.memberships ?? []);
  readonly hasSpace = computed(() => this.memberships().length > 0);

  /** Active space: the one picked in this session, else the remembered one, else the first. */
  readonly active = computed(() => {
    const memberships = this.memberships();
    const preferredId = this.selectedId() ?? this.userSettings.settings()?.last_space_id;
    return memberships.find((m) => m.space.id === preferredId) ?? memberships[0] ?? null;
  });
  readonly activeSpace = computed(() => this.active()?.space ?? null);
  readonly activeSettings = computed(() => this.active()?.settings ?? null);
  readonly activeRole = computed(() => this.active()?.role ?? null);
  /** Space configuration is owner-only (spec §3.1). */
  readonly canConfigure = computed(() => this.activeRole() === 'owner');
  /** Owners and editors manage accounts, categories and tags (spec §3.1). */
  readonly canEdit = computed(() => {
    const role = this.activeRole();
    return role === 'owner' || role === 'editor';
  });
  /** The user's default account in the active space. */
  readonly defaultAccountId = computed(() => this.active()?.defaultAccountId ?? null);

  constructor() {
    // Forget everything as soon as the session ends or another user signs in.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => {
        if (this.loaded() && this.loaded()?.userId !== userId) {
          this.reset();
        }
      });
    });
  }

  /** Loads the spaces of the signed-in user once; later calls reuse them. */
  ensureLoaded(): Promise<ActionResult> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return Promise.resolve(actionFailed(GENERIC_DATA_ERROR_MESSAGE));
    }
    if (this.loaded()?.userId === userId) {
      return Promise.resolve(ACTION_OK);
    }
    this.pendingLoad ??= this.load(userId).finally(() => (this.pendingLoad = null));
    return this.pendingLoad;
  }

  /** Makes a space the active one and remembers it for next time. */
  async select(spaceId: string): Promise<ActionResult> {
    this.selectedId.set(spaceId);
    return this.userSettings.update({ last_space_id: spaceId });
  }

  /** Creates a space owned by the user and makes it the active one; returns its id. */
  async createSpace(input: NewSpace): Promise<DataResult<string>> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const created = await this.api.createSpace(input);
    if (!created.ok) {
      return created;
    }
    this.selectedId.set(created.value);
    const reloaded = await this.load(userId);
    if (!reloaded.ok) {
      return reloaded;
    }
    // The space exists already; failing to remember it only affects the next visit.
    await this.userSettings.update({ last_space_id: created.value });
    return created;
  }

  /** Changes the name, icon or color of the active space (owner only). */
  async updateActiveSpace(patch: SpacePatch): Promise<ActionResult> {
    const active = this.active();
    if (!active) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.updateSpace(active.space.id, patch);
    if (result.ok) {
      this.replaceMembership(active.space.id, (m) => ({ ...m, space: { ...m.space, ...patch } }));
    }
    return result;
  }

  /** Sets (or clears, with null) the user's default account in the active space. */
  async setDefaultAccount(accountId: string | null): Promise<ActionResult> {
    const active = this.active();
    if (!active) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.setDefaultAccount(active.space.id, accountId);
    if (result.ok) {
      this.replaceMembership(active.space.id, (m) => ({ ...m, defaultAccountId: accountId }));
    }
    return result;
  }

  /** Forgets a default account that the database cleared (archived, made private or deleted). */
  forgetDefaultAccount(accountId: string): void {
    const active = this.active();
    if (active?.defaultAccountId === accountId) {
      this.replaceMembership(active.space.id, (m) => ({ ...m, defaultAccountId: null }));
    }
  }

  /** Saves what changed in the active space, then its settings (owner only). */
  async saveActivePreferences(
    space: SpacePatch,
    settings: SpaceSettingsPatch,
  ): Promise<ActionResult> {
    const current = this.activeSpace();
    const changed: SpacePatch = {};
    for (const key of ['name', 'icon', 'color'] as const) {
      const value = space[key];
      if (value !== undefined && value !== current?.[key]) {
        changed[key] = value;
      }
    }
    if (Object.keys(changed).length > 0) {
      const updated = await this.updateActiveSpace(changed);
      if (!updated.ok) {
        return updated;
      }
    }
    return this.updateActiveSettings(settings);
  }

  /** Saves preferences of the active space (owner only). */
  async updateActiveSettings(patch: SpaceSettingsPatch): Promise<ActionResult> {
    const active = this.active();
    if (!active) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.updateSettings(active.space.id, patch);
    if (!result.ok) {
      return result;
    }
    this.replaceMembership(active.space.id, (m) => ({ ...m, settings: result.value }));
    return ACTION_OK;
  }

  private async load(userId: string): Promise<ActionResult> {
    const [memberships] = await Promise.all([
      this.api.fetchMemberships(userId),
      // Without settings the active space falls back to the first one, so a failure is tolerated.
      this.userSettings.load(userId),
    ]);
    if (!memberships.ok) {
      return memberships;
    }
    if (this.auth.user()?.id === userId) {
      this.loaded.set({ userId, memberships: memberships.value });
    }
    return ACTION_OK;
  }

  private replaceMembership(
    spaceId: string,
    change: (membership: SpaceMembership) => SpaceMembership,
  ): void {
    this.loaded.update(
      (loaded) =>
        loaded && {
          ...loaded,
          memberships: loaded.memberships.map((m) => (m.space.id === spaceId ? change(m) : m)),
        },
    );
  }

  private reset(): void {
    this.loaded.set(null);
    this.selectedId.set(null);
    this.pendingLoad = null;
    this.userSettings.reset();
  }
}
