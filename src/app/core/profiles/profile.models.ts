import { Tables } from '../supabase/database.types';

/** What the app shows of a person: the name other members see (spec §3.1). */
export type Profile = Pick<Tables<'profiles'>, 'user_id' | 'display_name' | 'avatar_url'>;
