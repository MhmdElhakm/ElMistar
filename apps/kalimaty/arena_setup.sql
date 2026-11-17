-- ============================================================
-- تحدي الصف الأونلاين: مواجهات حقيقية بين الطلاب (كلمات وجمل)
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- (الجدول profiles موجود مسبقًا من إعداد الحساب)
-- ============================================================
create table if not exists public.arena_presence (
  uid  uuid primary key references auth.users(id) on delete cascade,
  seen timestamptz not null default now()
);

create table if not exists public.arena_matches (
  id         uuid primary key default gen_random_uuid(),
  a          uuid not null references auth.users(id) on delete cascade,
  b          uuid references auth.users(id) on delete cascade,
  kind       text not null default 'mix' check (kind in ('words','sents','mix')),
  lv         text not null default 'e',
  stake      int  not null default 0 check (stake >= 0 and stake <= 1000),
  same_grade boolean not null default false,
  status     text not null default 'waiting' check (status in ('waiting','invited','ready','playing','done','cancelled')),
  qs         jsonb not null,
  n          int  not null,
  t          int  not null,
  a_ready    boolean not null default false,
  b_ready    boolean not null default false,
  a_grade    int,
  b_grade    int,
  ans        jsonb not null default '{}'::jsonb,
  a_score    int  not null default 0,
  b_score    int  not null default 0,
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arena_matches_q_idx on public.arena_matches (status, kind, lv, stake, created_at);
alter table public.arena_presence enable row level security;
alter table public.arena_matches  enable row level security;   -- بدون سياسات: الوصول عبر الدوال فقط

create or replace function public.ar_uid() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid(); begin if u is null then raise exception 'not_auth'; end if; return u; end $$;

create or replace function public.ar_ping() returns void language plpgsql security definer set search_path=public as $$
begin insert into arena_presence(uid,seen) values (ar_uid(),now()) on conflict (uid) do update set seen=now(); end $$;

create or replace function public.ar_online(p_grade int default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,
      'avatar',case when length(coalesce(pr.avatar,''))<30000 then pr.avatar end,
      'ago',extract(epoch from now()-p.seen)::int,
      'busy',exists(select 1 from arena_matches m where m.status in ('ready','playing') and (m.a=pr.id or m.b=pr.id))) x
    from arena_presence p join profiles pr on pr.id=p.uid
    where p.seen>now()-interval '7 days' and p.uid<>me
      and (p_grade is null or pr.grade=p_grade)
    order by (p.seen>now()-interval '45 seconds') desc, p.seen desc limit 40) s),'[]'::jsonb);
end $$;

-- إنشاء تحدٍّ: إمّا دعوة لطالب محدد أو طابور عشوائي (ينضم لخصم منتظر إن وُجد)
create or replace function public.ar_open(p_kind text, p_lv text, p_stake int, p_same boolean, p_target uuid, p_qs jsonb, p_n int, p_t int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); mg int; m arena_matches;
begin
  select grade into mg from profiles where id=me;
  update arena_matches set status='cancelled' where a=me and status in ('waiting','invited');
  if p_target is not null then
    if p_target=me then raise exception 'self'; end if;
    insert into arena_matches(a,b,kind,lv,stake,same_grade,status,qs,n,t,a_grade,b_grade)
      values (me,p_target,p_kind,p_lv,p_stake,p_same,'invited',p_qs,p_n,p_t,mg,(select grade from profiles where id=p_target))
      returning * into m;
    return ar_get(m.id);
  end if;
  select * into m from arena_matches
   where status='waiting' and a<>me and kind=p_kind and lv=p_lv and stake=p_stake and created_at>now()-interval '60 seconds'
     and (not (same_grade or p_same) or a_grade is not distinct from mg)
   order by created_at limit 1 for update skip locked;
  if found then
    update arena_matches set b=me,b_grade=mg,status='ready' where id=m.id;
    return ar_get(m.id);
  end if;
  insert into arena_matches(a,kind,lv,stake,same_grade,status,qs,n,t,a_grade)
    values (me,p_kind,p_lv,p_stake,p_same,'waiting',p_qs,p_n,p_t,mg) returning * into m;
  return ar_get(m.id);
end $$;

create or replace function public.ar_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches; side text; slot numeric; oppid uuid; opp jsonb; qj jsonb := '[]'::jsonb; q jsonb; i int; mine jsonb; theirs jsonb; ansj jsonb := '{}'::jsonb; endat timestamptz; done boolean;
begin
  select * into m from arena_matches where id=p_id for update;
  if not found or (m.a<>me and m.b is distinct from me) then raise exception 'not_found'; end if;
  -- تنظيف المهلات
  if m.status='waiting' and m.created_at<now()-interval '90 seconds' then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='invited' and m.created_at<now()-interval '70 seconds' then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='ready' and m.created_at<now()-interval '150 seconds' and not (m.a_ready and m.b_ready) then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='playing' then
    endat := m.started_at + (m.n*(m.t+3)+4) * interval '1 second';
    if now()>endat then update arena_matches set status='done' where id=m.id; m.status:='done'; end if;
  end if;
  side := case when m.a=me then 'a' else 'b' end;
  oppid := case when side='a' then m.b else m.a end;
  if oppid is not null then
    select jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,'avatar',pr.avatar,
       'online',coalesce((select seen>now()-interval '45 seconds' from arena_presence where uid=pr.id),false)) into opp from profiles pr where pr.id=oppid;
  end if;
  done := m.status='done';
  for i in 0..m.n-1 loop
    q := m.qs->i;
    mine := m.ans->(i::text)->side;
    theirs := m.ans->(i::text)->(case when side='a' then 'b' else 'a' end);
    if not (mine is not null or done) then q := q - 'a'; end if;
    qj := qj || jsonb_build_array(q);
    ansj := ansj || jsonb_build_object(i::text, jsonb_build_object('mine',mine,
        'oppAnswered',theirs is not null,
        'opp',case when mine is not null or done then theirs end));
  end loop;
  return jsonb_build_object('id',m.id,'status',m.status,'kind',m.kind,'lv',m.lv,'stake',m.stake,'n',m.n,'t',m.t,
    'side',side,'qs',qj,'ans',ansj,'opp',opp,'a_ready',m.a_ready,'b_ready',m.b_ready,
    'a_score',m.a_score,'b_score',m.b_score,
    'started_in',case when m.started_at is null then null else extract(epoch from (m.started_at-now())) end,
    'same_grade',m.same_grade);
end $$;

create or replace function public.ar_inbox() returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'lv',m.lv,'stake',m.stake,
      'from',jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,'avatar',case when length(coalesce(pr.avatar,''))<30000 then pr.avatar end)))
    from arena_matches m join profiles pr on pr.id=m.a
    where m.b=me and m.status='invited' and m.created_at>now()-interval '60 seconds'),'[]'::jsonb);
end $$;

create or replace function public.ar_accept(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  update arena_matches set status='ready' where id=p_id and b=me and status='invited' and created_at>now()-interval '70 seconds';
  if not found then raise exception 'expired'; end if;
  return ar_get(p_id);
end $$;

create or replace function public.ar_cancel(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  update arena_matches set status='cancelled' where id=p_id and (a=me or b=me) and status in ('waiting','invited','ready');
end $$;

create or replace function public.ar_ready(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches;
begin
  select * into m from arena_matches where id=p_id and (a=me or b=me) for update;
  if not found then raise exception 'not_found'; end if;
  if m.status='ready' then
    if m.a=me then m.a_ready:=true; else m.b_ready:=true; end if;
    update arena_matches set a_ready=m.a_ready,b_ready=m.b_ready,
      status=case when m.a_ready and m.b_ready then 'playing' else 'ready' end,
      started_at=case when m.a_ready and m.b_ready then now()+interval '4 seconds' else started_at end
    where id=m.id;
  end if;
  return ar_get(p_id);
end $$;

create or replace function public.ar_answer(p_id uuid, p_q int, p_pick int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches; side text; slot timestamptz; el numeric; ok boolean; sc int; cur jsonb;
begin
  select * into m from arena_matches where id=p_id and (a=me or b=me) for update;
  if not found then raise exception 'not_found'; end if;
  if m.status<>'playing' then raise exception 'closed'; end if;
  if p_q<0 or p_q>=m.n then raise exception 'bad_q'; end if;
  side := case when m.a=me then 'a' else 'b' end;
  slot := m.started_at + (p_q*(m.t+3)) * interval '1 second';
  el := extract(epoch from (now()-slot));
  if el < -0.5 or el > m.t+1.5 then raise exception 'late'; end if;
  if (m.ans->(p_q::text)->side) is not null then raise exception 'dup'; end if;
  ok := p_pick = (m.qs->p_q->>'a')::int;
  sc := case when ok then 100 + greatest(0, ceil((m.t - least(greatest(el,0),m.t)) * 5))::int else 0 end;
  cur := coalesce(m.ans->(p_q::text),'{}'::jsonb) || jsonb_build_object(side, jsonb_build_object('p',p_pick,'s',sc));
  update arena_matches set ans = jsonb_set(ans, array[p_q::text], cur, true),
    a_score = a_score + case when side='a' then sc else 0 end,
    b_score = b_score + case when side='b' then sc else 0 end
  where id=m.id;
  return jsonb_build_object('ok',ok,'score',sc,'a',(m.qs->p_q->>'a')::int);
end $$;

grant execute on function public.ar_ping(), public.ar_online(int), public.ar_open(text,text,int,boolean,uuid,jsonb,int,int),
  public.ar_get(uuid), public.ar_inbox(), public.ar_accept(uuid), public.ar_cancel(uuid), public.ar_ready(uuid), public.ar_answer(uuid,int,int) to authenticated;

-- ===== دردشة وملصقات داخل المباراة =====
create table if not exists public.arena_chat (
  id bigserial primary key,
  match_id uuid not null references public.arena_matches(id) on delete cascade,
  uid uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists arena_chat_m on public.arena_chat(match_id, id);
alter table public.arena_chat enable row level security;

create or replace function public.ar_say(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); b text := left(btrim(coalesce(p_body,'')),140);
begin
  if b = '' then return; end if;
  if not exists(select 1 from arena_matches m where m.id=p_id and (m.a=me or m.b=me)) then raise exception 'not_found'; end if;
  if exists(select 1 from arena_chat c where c.match_id=p_id and c.uid=me and c.created_at>now()-interval '600 milliseconds') then return; end if;
  insert into arena_chat(match_id,uid,body) values (p_id,me,b);
end $$;

create or replace function public.ar_chat(p_id uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  if not exists(select 1 from arena_matches m where m.id=p_id and (m.a=me or m.b=me)) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'mine',c.uid=me,'body',c.body) order by c.id)
    from (select * from arena_chat where match_id=p_id and id>p_after order by id limit 50) c),'[]'::jsonb);
end $$;
grant execute on function public.ar_say(uuid,text), public.ar_chat(uuid,bigint) to authenticated;


-- جدول أسئلة التحدي يُمزج من كلمات الطرفين: الطرف الثاني يضيف أسئلة من كلماته في الخانات الفردية
create or replace function public.ar_mix(p_id uuid, p_qs jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches; nq jsonb := '[]'::jsonb; i int;
begin
  select * into m from arena_matches where id=p_id and b=me and status in ('ready','invited') and not coalesce(b_ready,false) and not coalesce(a_ready,false) for update;
  if not found then return; end if;
  for i in 0..(jsonb_array_length(m.qs)-1) loop
    if i % 2 = 1 and p_qs->i is not null and jsonb_typeof(p_qs->i)='object' then nq := nq || jsonb_build_array(p_qs->i);
    else nq := nq || jsonb_build_array(m.qs->i); end if;
  end loop;
  update arena_matches set qs=nq where id=p_id;
end $$;
grant execute on function public.ar_mix(uuid,jsonb) to authenticated;
