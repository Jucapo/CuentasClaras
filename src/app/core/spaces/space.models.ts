import { Enums, Tables, TablesUpdate } from '../supabase/database.types';

/** Role of a member in a space. */
export type MemberRole = Enums<'member_role'>;

/** First day of the week. */
export type Weekday = Enums<'weekday'>;

/** Thousands/decimal separators: comma_dot = 1,234.56 · dot_comma = 1.234,56 · space_comma = 1 234,56. */
export type NumberFormat = Enums<'number_format'>;

/** Light, dark or follow the system. */
export type ThemePreference = Enums<'theme_preference'>;

/** Space preferences (row of `space_settings`). */
export type SpaceSettings = Tables<'space_settings'>;

/** Space preferences the owner can change. */
export type SpaceSettingsPatch = Pick<
  TablesUpdate<'space_settings'>,
  | 'main_currency'
  | 'month_start_day'
  | 'week_start'
  | 'budgets_enabled'
  | 'default_period'
  | 'onboarding_step'
  | 'onboarding_completed_at'
  | 'onboarding_postponed_at'
>;

/** Per-user preferences (row of `user_settings`). */
export type UserSettings = Tables<'user_settings'>;

/** User preferences the user can change. */
export type UserSettingsPatch = Pick<
  TablesUpdate<'user_settings'>,
  'theme' | 'number_format' | 'show_decimals' | 'home_screen' | 'last_space_id'
>;

/** Name, icon and color of a space. */
export interface SpaceSummary {
  readonly id: string;
  readonly name: string;
  /** Icon catalog key. */
  readonly icon: string;
  /** Palette key. */
  readonly color: string;
}

/** What the owner can change of a space itself (its settings are separate). */
export interface SpacePatch {
  name?: string;
  icon?: string;
  color?: string;
}

/** A space the current user belongs to, with their role, default account and its settings. */
export interface SpaceMembership {
  readonly space: SpaceSummary;
  readonly role: MemberRole;
  /** The member's default account in this space (spec §3.1), if any. */
  readonly defaultAccountId: string | null;
  readonly settings: SpaceSettings;
}

/** Data needed to create a space (wizard step 1). */
export interface NewSpace {
  readonly name: string;
  readonly mainCurrency: string;
  readonly monthStartDay: number;
  readonly weekStart: Weekday;
}
