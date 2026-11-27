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
      exchange_rates: {
        Row: {
          base: string;
          created_at: string;
          date: string;
          id: string;
          quote: string;
          rate: number;
          source: Database['public']['Enums']['exchange_rate_source'];
          space_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          base: string;
          created_at?: string;
          date: string;
          id?: string;
          quote: string;
          rate: number;
          source?: Database['public']['Enums']['exchange_rate_source'];
          space_id?: string | null;
        };
        Update: {
          base?: string;
          created_at?: string;
          date?: string;
          id?: string;
          quote?: string;
          rate?: number;
          source?: Database['public']['Enums']['exchange_rate_source'];
          space_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'exchange_rates_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      installment_plans: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          installments: number;
          kind: Database['public']['Enums']['installment_plan_kind'];
          rate: number;
          source_transaction_id: string | null;
          space_id: string;
          start_date: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          installments: number;
          kind: Database['public']['Enums']['installment_plan_kind'];
          rate?: number;
          source_transaction_id?: string | null;
          space_id: string;
          start_date: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          installments?: number;
          kind?: Database['public']['Enums']['installment_plan_kind'];
          rate?: number;
          source_transaction_id?: string | null;
          space_id?: string;
          start_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'installment_plans_space_id_account_id_fkey';
            columns: ['space_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'account_balances';
            referencedColumns: ['space_id', 'account_id'];
          },
          {
            foreignKeyName: 'installment_plans_space_id_account_id_fkey';
            columns: ['space_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'installment_plans_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'installment_plans_space_id_source_transaction_id_fkey';
            columns: ['space_id', 'source_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
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
      transaction_tags: {
        Row: {
          space_id: string;
          tag_id: string;
          transaction_id: string;
        };
        ComputedFields: never;
        Insert: {
          space_id: string;
          tag_id: string;
          transaction_id: string;
        };
        Update: {
          space_id?: string;
          tag_id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transaction_tags_space_id_tag_id_fkey';
            columns: ['space_id', 'tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'transaction_tags_space_id_transaction_id_fkey';
            columns: ['space_id', 'transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transactions';
            referencedColumns: ['space_id', 'id'];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string;
          adjustment_direction: Database['public']['Enums']['adjustment_direction'] | null;
          amount: number;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          date: string;
          external_id: string | null;
          financing_plan_id: string | null;
          id: string;
          include_in_space: boolean;
          note: string | null;
          operation_id: string | null;
          source: Database['public']['Enums']['transaction_source'];
          space_id: string;
          status: Database['public']['Enums']['transaction_status'];
          to_account_id: string | null;
          to_amount: number | null;
          type: Database['public']['Enums']['transaction_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          adjustment_direction?: Database['public']['Enums']['adjustment_direction'] | null;
          amount: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          date: string;
          external_id?: string | null;
          financing_plan_id?: string | null;
          id?: string;
          include_in_space: boolean;
          note?: string | null;
          operation_id?: string | null;
          source?: Database['public']['Enums']['transaction_source'];
          space_id: string;
          status?: Database['public']['Enums']['transaction_status'];
          to_account_id?: string | null;
          to_amount?: number | null;
          type: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          adjustment_direction?: Database['public']['Enums']['adjustment_direction'] | null;
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          date?: string;
          external_id?: string | null;
          financing_plan_id?: string | null;
          id?: string;
          include_in_space?: boolean;
          note?: string | null;
          operation_id?: string | null;
          source?: Database['public']['Enums']['transaction_source'];
          space_id?: string;
          status?: Database['public']['Enums']['transaction_status'];
          to_account_id?: string | null;
          to_amount?: number | null;
          type?: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'transactions_financing_plan_fkey';
            columns: ['space_id', 'financing_plan_id'];
            isOneToOne: false;
            referencedRelation: 'installment_plans';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'transactions_space_id_account_id_fkey';
            columns: ['space_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'account_balances';
            referencedColumns: ['space_id', 'account_id'];
          },
          {
            foreignKeyName: 'transactions_space_id_account_id_fkey';
            columns: ['space_id', 'account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'transactions_space_id_category_id_fkey';
            columns: ['space_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['space_id', 'id'];
          },
          {
            foreignKeyName: 'transactions_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_space_id_to_account_id_fkey';
            columns: ['space_id', 'to_account_id'];
            isOneToOne: false;
            referencedRelation: 'account_balances';
            referencedColumns: ['space_id', 'account_id'];
          },
          {
            foreignKeyName: 'transactions_space_id_to_account_id_fkey';
            columns: ['space_id', 'to_account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['space_id', 'id'];
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
          balance: number | null;
          currency: string;
          initial_balance: number;
          movements_total: number | null;
          space_id: string;
        };
        ComputedFields: never;
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
      accounts_total: {
        Args: { on_date: string; target_space_id: string };
        Returns: {
          currency: string;
          missing_rate_currencies: string[];
          total: number;
        }[];
      };
      category_totals: {
        Args: {
          budget_months?: string[];
          from_date: string;
          target_space_id: string;
          to_date: string;
        };
        Returns: {
          amount: number;
          budget: number;
          category_id: string;
          kind: Database['public']['Enums']['category_kind'];
          missing_rate_currencies: string[];
          parent_id: string;
          remaining: number;
        }[];
      };
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
      save_exchange_rate: {
        Args: {
          base_currency: string;
          quote_currency: string;
          rate_date: string;
          rate_value: number;
          target_space_id: string;
        };
        Returns: undefined;
      };
      save_transaction: {
        Args: {
          entry_account_id: string;
          entry_adjustment_direction?: Database['public']['Enums']['adjustment_direction'];
          entry_amount: number;
          entry_category_id?: string;
          entry_date: string;
          entry_include_in_space?: boolean;
          entry_installments?: number;
          entry_monthly_rate?: number;
          entry_note?: string;
          entry_tag_ids?: string[];
          entry_to_account_id?: string;
          entry_to_amount?: number;
          entry_type: Database['public']['Enums']['transaction_type'];
          target_id: string;
          target_space_id: string;
        };
        Returns: string;
      };
      search_transactions: {
        Args: {
          filter_account_ids?: string[];
          filter_author_ids?: string[];
          filter_category_ids?: string[];
          filter_statuses?: Database['public']['Enums']['transaction_status'][];
          filter_tag_ids?: string[];
          filter_types?: Database['public']['Enums']['transaction_type'][];
          from_date?: string;
          search_amount?: number;
          search_terms?: string[];
          target_space_id: string;
          to_date?: string;
        };
        Returns: {
          account_id: string;
          adjustment_direction: Database['public']['Enums']['adjustment_direction'] | null;
          amount: number;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          date: string;
          external_id: string | null;
          financing_plan_id: string | null;
          id: string;
          include_in_space: boolean;
          note: string | null;
          operation_id: string | null;
          source: Database['public']['Enums']['transaction_source'];
          space_id: string;
          status: Database['public']['Enums']['transaction_status'];
          to_account_id: string | null;
          to_amount: number | null;
          type: Database['public']['Enums']['transaction_type'];
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'transactions';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_default_account: {
        Args: { target_account_id: string; target_space_id: string };
        Returns: undefined;
      };
      transaction_totals: {
        Args: {
          filter_account_ids?: string[];
          filter_author_ids?: string[];
          filter_category_ids?: string[];
          filter_statuses?: Database['public']['Enums']['transaction_status'][];
          filter_tag_ids?: string[];
          filter_types?: Database['public']['Enums']['transaction_type'][];
          from_date?: string;
          search_amount?: number;
          search_terms?: string[];
          target_space_id: string;
          to_date?: string;
        };
        Returns: {
          currency: string;
          expense: number;
          income: number;
          missing_rate_currencies: string[];
          net: number;
        }[];
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
      adjustment_direction: 'increase' | 'decrease';
      category_kind: 'expense' | 'income';
      exchange_rate_source: 'manual' | 'trm';
      home_screen: 'accounts' | 'categories' | 'transactions' | 'budget' | 'summary';
      installment_plan_kind: 'loan_schedule' | 'debt_plan' | 'card_deferral';
      member_role: 'owner' | 'editor' | 'viewer';
      number_format: 'comma_dot' | 'dot_comma' | 'space_comma';
      period_kind: 'day' | 'week' | 'month' | 'year' | 'all';
      theme_preference: 'system' | 'light' | 'dark';
      transaction_source: 'manual' | 'recurring' | 'email' | 'shortcut' | 'import';
      transaction_status: 'confirmed' | 'pending';
      transaction_type: 'expense' | 'income' | 'transfer' | 'adjustment';
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
      adjustment_direction: ['increase', 'decrease'],
      category_kind: ['expense', 'income'],
      exchange_rate_source: ['manual', 'trm'],
      home_screen: ['accounts', 'categories', 'transactions', 'budget', 'summary'],
      installment_plan_kind: ['loan_schedule', 'debt_plan', 'card_deferral'],
      member_role: ['owner', 'editor', 'viewer'],
      number_format: ['comma_dot', 'dot_comma', 'space_comma'],
      period_kind: ['day', 'week', 'month', 'year', 'all'],
      theme_preference: ['system', 'light', 'dark'],
      transaction_source: ['manual', 'recurring', 'email', 'shortcut', 'import'],
      transaction_status: ['confirmed', 'pending'],
      transaction_type: ['expense', 'income', 'transfer', 'adjustment'],
      weekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
  },
} as const;
