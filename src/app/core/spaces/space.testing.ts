import { SpaceMembership, SpaceSettings, UserSettings } from './space.models';

/** Space settings row with the database defaults, for tests. */
export function spaceSettingsFixture(overrides: Partial<SpaceSettings> = {}): SpaceSettings {
  return {
    space_id: 'space-1',
    main_currency: 'COP',
    month_start_day: 1,
    week_start: 'monday',
    budgets_enabled: true,
    default_period: 'month',
    onboarding_step: 1,
    onboarding_completed_at: null,
    ...overrides,
  };
}

/** Membership of the current user in a space, for tests. */
export function membershipFixture(
  id: string,
  name: string,
  role: SpaceMembership['role'] = 'owner',
): SpaceMembership {
  return {
    space: { id, name, icon: 'home', color: 'green' },
    role,
    defaultAccountId: null,
    settings: spaceSettingsFixture({ space_id: id }),
  };
}

/** User settings row with the database defaults, for tests. */
export function userSettingsFixture(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    user_id: 'user-1',
    theme: 'system',
    number_format: 'comma_dot',
    show_decimals: true,
    home_screen: 'categories',
    last_space_id: null,
    ...overrides,
  };
}
