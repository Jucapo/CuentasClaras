/** Build-time configuration shared by every environment file. */
export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    /** Publishable (anon) key: public by design, access is enforced by RLS. */
    publishableKey: string;
  };
  features: {
    /** Shows the sign-up screen. Keep in sync with "Allow new users to sign up" in Supabase. */
    publicSignup: boolean;
  };
}
