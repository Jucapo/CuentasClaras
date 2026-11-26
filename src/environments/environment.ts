import { Environment } from './environment.model';

/** Production configuration. */
export const environment: Environment = {
  production: true,
  supabase: {
    url: 'https://ryuknhuvydlwtbgruqdt.supabase.co',
    publishableKey: 'sb_publishable_0o_Xd2FdkEWWasxFm_Y4Kg_t3WBQ-qI',
  },
  features: {
    publicSignup: false,
  },
};
