import { Environment } from './environment.model';

/** Development configuration (`ng serve`): the local Supabase stack started with `npm run db:start`. */
export const environment: Environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    // Default publishable key of every local Supabase stack (printed by `supabase status`).
    publishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
  features: {
    publicSignup: false,
  },
};
