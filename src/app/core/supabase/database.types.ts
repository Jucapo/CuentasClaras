export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          account_group: Database['public']['Enums']['account_group'];
          archived_at: string | null;
          color: string;
          created_at: string;
          currency: string;
          icon: string;
          id: string;
          include_in_space_by_default: boolean;
          include_in_total: boolean;
          initial_balance: number;
          initial_balance_date: string;
          kind: Database['public']['Enums']['account_kind'];
          name: string;
          owner_id: string;
          sort_order: number;
          space_id: string;
          visibility: Database['public']['Enums']['account_visibility'];
        };
        ComputedFields: never;
        Insert: {
          account_group?: never;
          archived_at?: string | null;
          color: string;
          created_at?: string;
          currency: string;
          icon: string;
          id?: string;
          include_in_space_by_default?: boolean;
          include_in_total: boolean;
          initial_balance?: number;
          initial_balance_date: string;
          kind: Database['public']['Enums']['account_kind'];
          name: string;
          owner_id?: string;
          sort_order: number;
          space_id: string;
          visibility?: Database['public']['Enums']['account_visibility'];
        };
        Update: {
          account_group?: never;
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          currency?: string;
          icon?: string;
          id?: string;
          include_in_space_by_default?: boolean;
          include_in_total?: boolean;
          initial_balance?: number;
          initial_balance_date?: string;
          kind?: Database['public']['Enums']['account_kind'];
          name?: string;
          owner_id?: string;
          sort_order?: number;
          space_id?: string;
          visibility?: Database['public']['Enums']['account_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'accounts_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      budgets: {
        Row: {
          amount: number;
          category_id: string;
          created_at: string;
          currency: string;
          effective_from: string;
          id: string;
          space_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category_id: string;
          created_at?: string;
          currency: string;
          effective_from: string;
          id?: string;
          space_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string;
          created_at?: string;
          currency?: string;
          effective_from?: string;
          id?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_space_id_category_id_fkey';
            columns: ['space_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'budgets_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          icon: string;
          id: string;
          kind: Database['public']['Enums']['category_kind'];
          name: string;
          parent_id: string | null;
          sort_order: number;
          space_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          icon: string;
          id?: string;
          kind: Database['public']['Enums']['category_kind'];
          name: string;
          parent_id?: string | null;
          sort_order: number;
          space_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          icon?: string;
          id?: string;
          kind?: Database['public']['Enums']['category_kind'];
          name?: string;
          parent_id?: string | null;
          sort_order?: number;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'categories_space_id_parent_id_fkey';
            columns: ['space_id', 'parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['space_id', 'id'];
          },
        ];
      };
      category_default_tags: {
        Row: {
          category_id: string;
          space_id: string;
          tag_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          space_id: string;
          tag_id: string;
        };
        Update: {
          category_id?: string;
          space_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'category_default_tags_space_id_category_id_fkey';
            columns: ['space_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'category_default_tags_space_id_tag_id_fkey';
            columns: ['space_id', 'tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['space_id', 'id'];
          },
        ];
      };
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
            foreignKeyName: 'space_members_default_account_fkey';
            columns: ['space_id', 'default_account_id'];
            isOneToOne: false;
            referencedRelation: 'account_balances';
            referencedColumns: ['space_id', 'account_id'];
          },
          {
            foreignKeyName: 'space_members_default_account_fkey';
            columns: ['space_id', 'default_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['space_id', 'id'];
          },
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
          onboarding_postponed_at: string | null;
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
          onboarding_postponed_at?: string | null;
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
          onboarding_postponed_at?: string | null;
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
          color: string;
          created_at: string;
          created_by: string | null;
          icon: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          icon?: string;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          created_by?: string | null;
          icon?: string;
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
      tags: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          id: string;
          name: string;
          space_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color: string;
          created_at?: string;
          id?: string;
          name: string;
          space_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
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
      account_balances: {
        Row: {
          account_id: string;
          balance: number;
          currency: string;
          initial_balance: number;
          movements_total: number | null;
          space_id: string;
        };
        ComputedFields: never;
        Insert: {
          account_id?: string | null;
          balance?: number | null;
          currency?: string | null;
          initial_balance?: number | null;
          movements_total?: never;
          space_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          balance?: number | null;
          currency?: string | null;
          initial_balance?: number | null;
          movements_total?: never;
          space_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      create_category_tree: {
        Args: {
          category_kind: Database['public']['Enums']['category_kind'];
          target_space_id: string;
          tree: Json;
        };
        Returns: undefined;
      };
      create_space: {
        Args: {
          main_currency: string;
          month_start_day: number;
          space_name: string;
          week_start: Database['public']['Enums']['weekday'];
        };
        Returns: string;
      };
      reorder_categories: { Args: { category_ids: string[] }; Returns: undefined };
      set_default_account: {
        Args: { target_account_id: string; target_space_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_group: 'accounts' | 'savings' | 'debts' | 'receivables' | 'assets';
      account_kind:
        | 'cash'
        | 'bank'
        | 'wallet'
        | 'savings'
        | 'credit_card'
        | 'loan'
        | 'simple_debt'
        | 'receivable'
        | 'asset';
      account_visibility: 'shared' | 'private';
      category_kind: 'expense' | 'income';
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
      account_group: ['accounts', 'savings', 'debts', 'receivables', 'assets'],
      account_kind: [
        'cash',
        'bank',
        'wallet',
        'savings',
        'credit_card',
        'loan',
        'simple_debt',
        'receivable',
        'asset',
      ],
      account_visibility: ['shared', 'private'],
      category_kind: ['expense', 'income'],
      home_screen: ['accounts', 'categories', 'transactions', 'budget', 'summary'],
      member_role: ['owner', 'editor', 'viewer'],
      number_format: ['comma_dot', 'dot_comma', 'space_comma'],
      period_kind: ['day', 'week', 'month', 'year', 'all'],
      theme_preference: ['system', 'light', 'dark'],
      weekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
  },
} as const;
