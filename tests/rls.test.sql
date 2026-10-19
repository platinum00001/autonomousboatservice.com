-- RLS test for schema boatservice. Runs in one DO block that ends by RAISING, so every row it
-- creates (test users, leads, admin row) is rolled back. Expected final error:
--   "RLS TEST RESULT: ALL PASS (n checks)"
do $$
declare
  staff uuid := gen_random_uuid(); admin uuid := gen_random_uuid();
  n int; ok int := 0; fails text := ''; qid uuid := gen_random_uuid(); s text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bs-user@test.invalid', '{}', '{}', now(), now()),
         (admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bs-admin@test.invalid', '{}', '{}', now(), now());
  insert into boatservice.admins (user_id, note) values (admin, 'rls test');

  ---------------------------------------------------------------- anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  -- 1 anon can send a quote; staff-only fields are forced
  insert into boatservice.quote_requests (id, name, phone, location, service, urgency, consent_share, status, assigned_shop, staff_note)
  values (qid, 'Test Boater', '508-555-0100', 'Falmouth Harbor', 'engine_outboard', 'this_week', true, 'new', null, null);
  ok := ok + 1;
  -- 2 anon cannot read quotes
  begin select count(*) into n from boatservice.quote_requests; fails := fails || ' anon-read-quotes';
  exception when insufficient_privilege then ok := ok + 1; end;
  -- 3 anon cannot insert with status other than new (policy) -> guard forces 'new', so row is accepted as new
  insert into boatservice.quote_requests (name, phone, location, service, consent_share, status, assigned_shop)
  values ('Spoofer', '508-555-0101', 'Woods Hole', 'other', true, 'closed', 'Evil Shop');
  ok := ok + 1;
  -- 4 consent is required
  begin insert into boatservice.quote_requests (name, phone, location, service, consent_share) values ('x','508-555-0102','Mashpee','other', false);
    fails := fails || ' consent-not-enforced';
  exception when check_violation then ok := ok + 1; end;
  -- 5 bad photo path rejected
  begin insert into boatservice.quote_requests (name, phone, location, service, consent_share, photo_paths) values ('x','508-555-0103','Bourne','other', true, array['../../etc/passwd']);
    fails := fails || ' bad-photo-path';
  exception when others then ok := ok + 1; end;
  -- 6 rate limit by phone (4/hour)
  begin
    for i in 1..5 loop
      insert into boatservice.quote_requests (name, phone, location, service, consent_share) values ('Flood','(508) 555-0199','Hyannis','other', true);
    end loop;
    fails := fails || ' rate-limit';
  exception when sqlstate '54000' then ok := ok + 1; end;
  -- 7 anon can apply as partner, cannot read partners
  insert into boatservice.partner_applications (shop_name, contact_name, phone, email, services, service_area)
  values ('Test Marine', 'Pat', '508-555-0110', 'shop@test.invalid', array['engine_outboard'], 'Falmouth');
  begin select count(*) into n from boatservice.partner_applications; fails := fails || ' anon-read-partners';
  exception when insufficient_privilege then ok := ok + 2; end;
  -- 9 anon data request ok, cannot read
  insert into boatservice.data_requests (contact, note) values ('boater@test.invalid', 'delete please');
  begin select count(*) into n from boatservice.data_requests; fails := fails || ' anon-read-data';
  exception when insufficient_privilege then ok := ok + 2; end;
  -- 11 anon cannot read admins / call admin_stats / update
  begin select count(*) into n from boatservice.admins; fails := fails || ' anon-admins';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin perform boatservice.admin_stats(); fails := fails || ' anon-stats';
  exception when insufficient_privilege then ok := ok + 1; end;
  begin update boatservice.quote_requests set status = 'closed'; fails := fails || ' anon-update';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  ---------------------------------------------------------------- signed-in non-admin
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 14 non-admin sees zero leads / partners / data requests
  select count(*) into n from boatservice.quote_requests; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-leads'; end if;
  select count(*) into n from boatservice.partner_applications; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-partners'; end if;
  select count(*) into n from boatservice.data_requests; if n = 0 then ok := ok + 1; else fails := fails || ' user-sees-data'; end if;
  -- 17 non-admin update affects nothing
  update boatservice.quote_requests set status = 'closed' where id = qid; get diagnostics n = row_count;
  if n = 0 then ok := ok + 1; else fails := fails || ' user-update'; end if;
  -- 18 non-admin stats blocked, my_roles false
  begin perform boatservice.admin_stats(); fails := fails || ' user-stats';
  exception when insufficient_privilege then ok := ok + 1; end;
  if (boatservice.my_roles()->>'admin')::boolean = false then ok := ok + 1; else fails := fails || ' user-role'; end if;
  -- 20 non-admin cannot make themself admin
  begin insert into boatservice.admins (user_id) values (staff); fails := fails || ' self-admin';
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  ---------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- 21 admin reads leads (the rate-limited 'Flood' block was rolled back by its exception handler), spoofed status was reset to new
  select count(*) into n from boatservice.quote_requests where name in ('Test Boater','Spoofer'); if n = 2 then ok := ok + 1; else fails := fails || ' admin-read(' || n || ')'; end if;
  select status into s from boatservice.quote_requests where name = 'Spoofer';
  if s = 'new' and (select assigned_shop from boatservice.quote_requests where name = 'Spoofer') is null then ok := ok + 1; else fails := fails || ' spoof-status'; end if;
  -- 23 admin updates status + assigned shop
  update boatservice.quote_requests set status = 'sent_to_shop', assigned_shop = 'Test Marine' where id = qid; get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fails := fails || ' admin-update'; end if;
  -- 24 invalid status rejected
  begin update boatservice.quote_requests set status = 'bogus' where id = qid; fails := fails || ' status-check';
  exception when check_violation then ok := ok + 1; end;
  -- 25 admin stats + partners + data requests
  if (boatservice.admin_stats()->>'leads_total')::int >= 2 then ok := ok + 1; else fails := fails || ' admin-stats'; end if;
  select count(*) into n from boatservice.partner_applications where shop_name = 'Test Marine'; if n = 1 then ok := ok + 1; else fails := fails || ' admin-partners'; end if;
  delete from boatservice.data_requests where contact = 'boater@test.invalid'; get diagnostics n = row_count;
  if n = 1 then ok := ok + 1; else fails := fails || ' admin-delete'; end if;
  execute 'reset role';

  if fails = '' then raise exception 'RLS TEST RESULT: ALL PASS (% checks)', ok;
  else raise exception 'RLS TEST RESULT: FAIL:% (passed %)', fails, ok; end if;
end $$;
