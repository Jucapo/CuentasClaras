import { Enums, Tables, TablesInsert, TablesUpdate } from '../supabase/database.types';

/** Expense or income (spec §4.3). */
export type CategoryKind = Enums<'category_kind'>;

/** A category or subcategory, with the ids of its default tags. */
export type Category = Tables<'categories'> & {
  readonly default_tag_ids: readonly string[];
};

/** Columns a client sets when creating a category; the database appends it to its siblings. */
export type NewCategory = Omit<
  TablesInsert<'categories'>,
  'id' | 'created_at' | 'archived_at' | 'sort_order'
>;

/** Columns a client may change on a category; its kind and space never change. */
export type CategoryPatch = Omit<
  TablesUpdate<'categories'>,
  'id' | 'space_id' | 'kind' | 'created_at'
>;

/** A tag of the space (spec §4.4). */
export type Tag = Tables<'tags'>;

/** Columns a client sets when creating a tag. */
export type NewTag = Pick<TablesInsert<'tags'>, 'space_id' | 'name' | 'color'>;

/** Columns a client may change on a tag. */
export type TagPatch = Pick<TablesUpdate<'tags'>, 'name' | 'color' | 'archived_at'>;
