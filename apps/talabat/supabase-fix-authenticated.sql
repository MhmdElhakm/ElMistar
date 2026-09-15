-- ============================================================
-- إصلاح RLS policies: تغيير anon → authenticated
-- نفّذ هذا الملف في Supabase SQL Editor
-- ============================================================

-- حذف السياسات القديمة
drop policy if exists m_sel on members;
drop policy if exists m_ins on members;
drop policy if exists m_upd on members;
drop policy if exists fam_sel on homes;
drop policy if exists fam_ins on homes;
drop policy if exists fam_upd on homes;
drop policy if exists fam_all on orders;
drop policy if exists fam_all on users;
drop policy if exists anon_all on comedy_messages;
drop policy if exists anon_all on audio_items;
drop policy if exists anon_all on ads;

-- إنشاء السياسات الجديدة بـ authenticated role
create policy m_sel on members for select to authenticated using (device_uid = auth.uid());
create policy m_ins on members for insert to authenticated with check (device_uid = auth.uid());
create policy m_upd on members for update to authenticated
  using (device_uid = auth.uid()) with check (device_uid = auth.uid());

create policy fam_sel on homes for select to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));
create policy fam_ins on homes for insert to authenticated with check (true);
create policy fam_upd on homes for update to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));

create policy fam_all on orders for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code));

create policy fam_all on users for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code));

create policy anon_all on comedy_messages for all to authenticated using (true) with check (true);
create policy anon_all on audio_items for all to authenticated using (true) with check (true);
create policy anon_all on ads for all to authenticated using (true) with check (true);

-- تحديث صلاحيات الدوال
grant execute on function public.join_home(text, text, text) to authenticated;
grant execute on function public.ensure_membership(text) to authenticated;
