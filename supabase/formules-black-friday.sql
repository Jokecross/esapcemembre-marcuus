-- =====================================================================
--  Espace membre Marcuus : les 3 formules et leurs modules (11/11/2026)
--  À coller dans Supabase → SQL Editor → Run. Rejouable.
--
--                                              Builder   Starter   Builder
--                                              mensuel   annuel    annuel
--  Masterclass Black Friday (vidéo 50 min)        x         x         x
--  Module Copify 1 : trouver le bon produit       x         x         x
--  Bonus : liste de micro-influenceurs            -         x         x
--  Bonus : replays des 21 lives avec Ibra         -         x         x
--  Module Copify 2 : produit + site Shopify       -         -         x
--
--  L'outil (workshop, Cockpit) et le coach sont ouverts à tous, comme avant.
--  Copify 1, Copify 2 et la liste de micro-influenceurs n'ont pas encore de
--  contenu : ils s'affichent « Bientôt disponible » jusqu'à leur première
--  vidéo ou leur premier fichier, ajoutés depuis le back-office (Contenu).
--  Les codes « mensuel » et « annuel » ne changent pas : les élèves et les
--  invitations déjà créés gardent leur formule.
-- =====================================================================

-- 1. Les formules.
update public.plans set label = 'Builder mensuel', rank = 1 where code = 'mensuel';
update public.plans set label = 'Starter annuel',  rank = 2 where code = 'annuel';
insert into public.plans (code, label, rank) values ('builder_annuel', 'Builder annuel', 3)
on conflict (code) do update set label = excluded.label, rank = excluded.rank;

-- 2. Les modules, dans l'ordre du tableau.
do $$
declare
  m_master int; m_copify1 int; m_micro int; m_lives int; m_copify2 int;
begin
  select id into m_master from public.modules where title = 'Masterclass Black Friday';
  if m_master is null then
    insert into public.modules (position, title, description, is_intro, is_bonus)
    values ((select coalesce(max(position), 0) + 1 from public.modules), 'Masterclass Black Friday', 'La vidéo de la masterclass Black Friday de Marcuus (50 min).', false, false)
    returning id into m_master;
  end if;
  if not exists (select 1 from public.lessons where module_id = m_master) then
    insert into public.lessons (module_id, position, title, vimeo_url)
    values (m_master, 1, 'Masterclass Black Friday 2026',
            'https://drive.google.com/file/d/1chVhGAZoJ6POM4gG5yWsR-uKVww40qQZ/preview');
  end if;

  select id into m_copify1 from public.modules where title like 'Module Copify 1%';
  if m_copify1 is null then
    insert into public.modules (position, title, description, is_intro, is_bonus)
    values ((select coalesce(max(position), 0) + 1 from public.modules), 'Module Copify 1 : trouver le bon produit Black Friday', 'Trouver le bon produit à vendre pour le Black Friday.', false, false)
    returning id into m_copify1;
  end if;

  select id into m_micro from public.modules where title like 'Bonus : liste de micro-influenceurs%';
  if m_micro is null then
    insert into public.modules (position, title, description, is_intro, is_bonus)
    values ((select coalesce(max(position), 0) + 1 from public.modules), 'Bonus : liste de micro-influenceurs', 'Une liste de micro-influenceurs à contacter pour ton produit.', false, false)
    returning id into m_micro;
  end if;

  -- Le module des lives existe déjà (module 1) : il prend le nom du tableau.
  select id into m_lives from public.modules where title in ('Lives Ibrahim', 'Bonus : replays des 21 lives du défi avec Ibra');
  update public.modules set title = 'Bonus : replays des 21 lives du défi avec Ibra' where id = m_lives;

  select id into m_copify2 from public.modules where title like 'Module Copify 2%';
  if m_copify2 is null then
    insert into public.modules (position, title, description, is_intro, is_bonus)
    values ((select coalesce(max(position), 0) + 1 from public.modules), 'Module Copify 2 : lancer un produit et générer le site Shopify', 'Lancer ton produit et générer ton site Shopify.', false, false)
    returning id into m_copify2;
  end if;

  -- L'ordre du tableau. Chaque position est unique : on passe d'abord par des
  -- positions libres, pour ne jamais en prendre une déjà occupée.
  update public.modules set position = 1000 + case id
      when m_master then 1 when m_copify1 then 2 when m_micro then 3 when m_lives then 4 when m_copify2 then 5 end
   where id in (m_master, m_copify1, m_micro, m_lives, m_copify2);
  update public.modules set position = position + 1000 where position between 1 and 5 and id not in (m_master, m_copify1, m_micro, m_lives, m_copify2);
  update public.modules set position = position - 1000 where id in (m_master, m_copify1, m_micro, m_lives, m_copify2);

  -- 3. Qui voit quoi : on repart du tableau, formule par formule.
  delete from public.plan_modules where module_id in (m_master, m_copify1, m_micro, m_lives, m_copify2);
  insert into public.plan_modules (plan_code, module_id) values
    ('mensuel', m_master), ('annuel', m_master), ('builder_annuel', m_master),
    ('mensuel', m_copify1), ('annuel', m_copify1), ('builder_annuel', m_copify1),
    ('annuel', m_micro), ('builder_annuel', m_micro),
    ('annuel', m_lives), ('builder_annuel', m_lives),
    ('builder_annuel', m_copify2);
end $$;

-- Vérification : 5 modules, et les formules qui les ouvrent.
select m.position, m.title,
       string_agg(p.label, ' · ' order by p.rank) as formules,
       (select count(*) from public.lessons l where l.module_id = m.id) as contenus
  from public.modules m
  left join public.plan_modules pm on pm.module_id = m.id
  left join public.plans p on p.code = pm.plan_code
 group by m.id, m.position, m.title
 order by m.position;
