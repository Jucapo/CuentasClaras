-- Tags and default tags: members read, owners and editors write; links never mix spaces.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Ana owns "Hogar" with Beto (editor) and Dani (viewer). Caro owns her own space.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000000', 'ana@example.com'),
  ('b0000000-0000-4000-8000-000000000000', 'beto@example.com'),
  ('c0000000-0000-4000-8000-000000000000', 'caro@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'dani@example.com');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.space', public.create_space('Hogar', 'COP', 1, 'monday')::text, true); end $$;
do $$
declare
  new_id uuid;
begin
  insert into public.categories (space_id, kind, name, icon, color)
  values (current_setting('t.space')::uuid, 'expense', 'Hogar', 'home', 'orange')
  returning id into new_id;
  perform set_config('t.home', new_id::text, true);

  insert into public.categories (space_id, parent_id, kind, name, icon)
  values (current_setting('t.space')::uuid, new_id, 'expense', 'Arriendo', 'key')
  returning id into new_id;
  perform set_config('t.rent', new_id::text, true);
end $$;

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
do $$ begin perform set_config('t.caro_space', public.create_space('Caro', 'COP', 1, 'monday')::text, true); end $$;
do $$
declare
  new_id uuid;
begin
  insert into public.tags (space_id, name, color)
  values (current_setting('t.caro_space')::uuid, 'Viajes', 'blue')
  returning id into new_id;
  perform set_config('t.caro_tag', new_id::text, true);
end $$;

reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.space')::uuid, 'b0000000-0000-4000-8000-000000000000', 'editor'),
  (current_setting('t.space')::uuid, 'd0000000-0000-4000-8000-00000000000d', 'viewer');

-- ── Editor ───────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select lives_ok(
  $q$do $$
    declare
      new_id uuid;
    begin
      insert into public.tags (space_id, name, color)
      values (current_setting('t.space')::uuid, 'Fijos', 'indigo')
      returning id into new_id;
      perform set_config('t.fixed', new_id::text, true);
    end $$$q$,
  'an editor creates a tag'
);
select throws_ok(
  format($$insert into public.tags (space_id, name, color) values (%L, 'fijos', 'red')$$, current_setting('t.space')),
  '23505',
  null,
  'active tag names are unique, ignoring case'
);
select isnt_empty(
  format($$update public.tags set color = 'teal' where id = %L returning 1$$, current_setting('t.fixed')),
  'an editor changes the color of a tag'
);
select lives_ok(
  format(
    'insert into public.category_default_tags (space_id, category_id, tag_id) values (%L, %L, %L)',
    current_setting('t.space'),
    current_setting('t.rent'),
    current_setting('t.fixed')
  ),
  'an editor gives a subcategory a default tag'
);
select throws_ok(
  format(
    'insert into public.category_default_tags (space_id, category_id, tag_id) values (%L, %L, %L)',
    current_setting('t.space'),
    current_setting('t.home'),
    current_setting('t.caro_tag')
  ),
  '23503',
  null,
  'a default tag cannot come from another space'
);
select throws_ok(
  format(
    'update public.category_default_tags set tag_id = %L where category_id = %L',
    current_setting('t.caro_tag'),
    current_setting('t.rent')
  ),
  '42501',
  null,
  'default tag links are added or removed, never edited'
);
select throws_ok(
  format('update public.tags set space_id = %L where id = %L', current_setting('t.caro_space'), current_setting('t.fixed')),
  '42501',
  null,
  'a tag cannot be moved to another space'
);

-- ── Viewer ───────────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-00000000000d"}';
select results_eq(
  'select t.name, d.category_id from public.category_default_tags d join public.tags t on t.id = d.tag_id',
  format($$values ('Fijos'::text, %L::uuid)$$, current_setting('t.rent')),
  'a viewer sees the tags and the default tags of the space'
);
select throws_ok(
  format($$insert into public.tags (space_id, name, color) values (%L, 'Lector', 'red')$$, current_setting('t.space')),
  '42501',
  null,
  'a viewer cannot create tags'
);
select is_empty(
  format($$update public.tags set name = 'Lector' where id = %L returning 1$$, current_setting('t.fixed')),
  'a viewer cannot edit tags'
);
select is_empty(
  format('delete from public.tags where id = %L returning 1', current_setting('t.fixed')),
  'a viewer cannot delete tags'
);
select throws_ok(
  format(
    'insert into public.category_default_tags (space_id, category_id, tag_id) values (%L, %L, %L)',
    current_setting('t.space'),
    current_setting('t.home'),
    current_setting('t.fixed')
  ),
  '42501',
  null,
  'a viewer cannot add default tags'
);
select is_empty(
  format('delete from public.category_default_tags where tag_id = %L returning 1', current_setting('t.fixed')),
  'a viewer cannot remove default tags'
);

-- ── Non-member ───────────────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000000"}';
select results_eq(
  'select name from public.tags',
  $$values ('Viajes')$$,
  'a non-member sees no tags of the space'
);
select is_empty(
  'select 1 from public.category_default_tags',
  'a non-member sees no default tags of the space'
);

-- ── Archive and delete ───────────────────────────────────────────────────────
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000000"}';
select isnt_empty(
  format('update public.tags set archived_at = now() where id = %L returning 1', current_setting('t.fixed')),
  'an editor archives a tag'
);
select lives_ok(
  format(
    $q$do $$
      declare
        new_id uuid;
      begin
        insert into public.tags (space_id, name, color)
        values (%L, 'Fijos', 'green')
        returning id into new_id;
        perform set_config('t.fixed_again', new_id::text, true);
      end $$$q$,
    current_setting('t.space')
  ),
  'an archived tag name can be used again'
);
select isnt_empty(
  format('delete from public.tags where id = %L returning 1', current_setting('t.fixed')),
  'an editor deletes a tag'
);
reset role;
select is_empty(
  format('select 1 from public.category_default_tags where category_id = %L', current_setting('t.rent')),
  'deleting a tag removes it from the default tags'
);
select isnt_empty(
  format('select 1 from public.tags where id = %L', current_setting('t.fixed_again')),
  'the other tags stay'
);

select * from finish();
rollback;
