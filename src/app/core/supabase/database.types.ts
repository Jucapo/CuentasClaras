export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      space_members: {
        Row: {
          default_account_id: string | null;
          joined_at: string;
          role: Database['public']['Enums']['member_role'];
          space_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          default_account_id?: string | null;
          joined_at?: string;
          role: Database['public']['Enums']['member_role'];
          space_id: string;
          user_id: string;
        };
        Update: {
          default_account_id?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['member_role'];
          space_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'space_members_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'space_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      space_settings: {
        Row: {
          budgets_enabled: boolean;
          default_period: Database['public']['Enums']['period_kind'];
          main_currency: string;
          month_start_day: number;
          onboarding_completed_at: string | null;
          onboarding_step: number;
          space_id: string;
          week_start: Database['public']['Enums']['weekday'];
        };
        ComputedFields: never;
        Insert: {
          budgets_enabled?: boolean;
          default_period?: Database['public']['Enums']['period_kind'];
          main_currency?: string;
          month_start_day?: number;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          space_id: string;
          week_start?: Database['public']['Enums']['weekday'];
        };
        Update: {
          budgets_enabled?: boolean;
          default_period?: Database['public']['Enums']['period_kind'];
          main_currency?: string;
          month_start_day?: number;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          space_id?: string;
          week_start?: Database['public']['Enums']['weekday'];
        };
        Relationships: [
          {
            foreignKeyName: 'space_settings_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: true;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      spaces: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'spaces_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      user_settings: {
        Row: {
          home_screen: Database['public']['Enums']['home_screen'];
          last_space_id: string | null;
          number_format: Database['public']['Enums']['number_format'];
          show_decimals: boolean;
          theme: Database['public']['Enums']['theme_preference'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          home_screen?: Database['public']['Enums']['home_screen'];
          last_space_id?: string | null;
          number_format?: Database['public']['Enums']['number_format'];
          show_decimals?: boolean;
          theme?: Database['public']['Enums']['theme_preference'];
          user_id: string;
        };
        Update: {
          home_screen?: Database['public']['Enums']['home_screen'];
          last_space_id?: string | null;
          number_format?: Database['public']['Enums']['number_format'];
          show_decimals?: boolean;
          theme?: Database['public']['Enums']['theme_preference'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_last_space_id_fkey';
            columns: ['last_space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_space: {
        Args: {
          main_currency: string;
          month_start_day: number;
          space_name: string;
          week_start: Database['public']['Enums']['weekday'];
        };
        Returns: string;
      };
    };
    Enums: {
      home_screen: 'accounts' | 'categories' | 'transactions' | 'budget' | 'summary';
      member_role: 'owner' | 'editor' | 'viewer';
      number_format: 'comma_dot' | 'dot_comma' | 'space_comma';
      period_kind: 'day' | 'week' | 'month' | 'year' | 'all';
      theme_preference: 'system' | 'light' | 'dark';
      weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      home_screen: ['accounts', 'categories', 'transactions', 'budget', 'summary'],
      member_role: ['owner', 'editor', 'viewer'],
      number_format: ['comma_dot', 'dot_comma', 'space_comma'],
      period_kind: ['day', 'week', 'month', 'year', 'all'],
      theme_preference: ['system', 'light', 'dark'],
      weekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
  },
} as const;
