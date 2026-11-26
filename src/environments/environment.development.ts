import { Environment } from './environment.model';

/** Development configuration (`ng serve`). Points to the same Supabase project as production for now. */
export const environment: Environment = {
  production: false,
  supabase: {
    url: 'https://ryuknhuvydlwtbgruqdt.supabase.co',
    publishableKey: 'sb_publishable_0o_Xd2FdkEWWasxFm_Y4Kg_t3WBQ-qI',
  },
  features: {
    publicSignup: false,
  },
};
