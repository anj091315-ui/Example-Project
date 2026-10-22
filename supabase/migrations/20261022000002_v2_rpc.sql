-- =====================================================================
-- 원장님 MVP v2 · 02 상태 전이 RPC
-- 기준: docs/PRD.md §7.4~§7.6, §9.3~§9.12, §11.7
-- 원칙
--   - 클라이언트는 상태 열을 직접 UPDATE하지 않고 아래 함수만 호출한다.
--   - 행위자는 항상 auth.uid()로 결정한다. (FR-SEC-002)
--   - 잠금 순서는 항상 "요청 → 지원"으로 고정해 교착을 피한다.
--   - 오류는 message에 PRD §9.12 도메인 오류 코드를 담아 raise 한다.
--   - 내부 헬퍼는 Data API에 노출되지 않는 private 스키마에 둔다.
-- =====================================================================

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 0. 내부 헬퍼 (클라이언트 실행 권한 없음)
-- ---------------------------------------------------------------------
create or replace function private._fail(p_code text, p_detail text default null)
returns void language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

-- 로그인 + 프로필 완료 + active 회원 (FR-PRO-001, FR-AUTH-007)
create or replace function private._require_member()
returns uuid language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.account_status;
  v_done timestamptz;
begin
  if v_uid is null then perform private._fail('AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'member') then
    perform private._fail('FORBIDDEN');
  end if;
  select status, onboarding_completed_at into v_status, v_done
  from public.profiles where id = v_uid;
  if not found or v_done is null then perform private._fail('PROFILE_REQUIRED'); end if;
  if v_status <> 'active' then perform private._fail('FORBIDDEN'); end if;
  return v_uid;
end;
$$;

create or replace function private._require_admin()
returns uuid language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then perform private._fail('AUTH_REQUIRED'); end if;
  if not public.is_admin() then perform private._fail('FORBIDDEN'); end if;
  return auth.uid();
end;
$$;

-- 멱등성 시작: 신규면 null, 같은 요청 재시도면 저장된 응답, 내용이 다르면 IDEMPOTENCY_CONFLICT
-- 동시 재시도는 PK 충돌 대기로 직렬화된다. (FR-DEC-011, FR-SYS-006)
create or replace function private._idem_begin(p_operation text, p_client_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := md5(p_payload::text);
  v_row public.idempotency_keys;
begin
  if p_client_request_id is null then perform private._fail('VALIDATION_ERROR', 'client_request_id'); end if;
  insert into public.idempotency_keys (actor_id, operation, client_request_id, request_hash)
  values (auth.uid(), p_operation, p_client_request_id, v_hash)
  on conflict do nothing;
  if found then return null; end if;

  select * into v_row from public.idempotency_keys
  where actor_id = auth.uid() and operation = p_operation and client_request_id = p_client_request_id;
  if v_row.request_hash <> v_hash then perform private._fail('IDEMPOTENCY_CONFLICT'); end if;
  return coalesce(v_row.response_body, '{}'::jsonb);
end;
$$;

create or replace function private._idem_finish(p_operation text, p_client_request_id uuid, p_response jsonb)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.idempotency_keys set response_body = p_response
  where actor_id = auth.uid() and operation = p_operation and client_request_id = p_client_request_id;
  return p_response;
end;
$$;

create or replace function private._log_application(
  p_application_id uuid, p_from public.application_status, p_to public.application_status, p_client_request_id uuid
) returns void language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.application_status_history (application_id, from_status, to_status, actor_id, client_request_id)
  values (p_application_id, p_from, p_to, auth.uid(), p_client_request_id);
$$;

-- 감사 metadata에 자유 입력 전문·연락처·토큰을 넣지 않는다. (§11.4.10)
create or replace function private._audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb, p_client_request_id uuid
) returns void language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata, client_request_id)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb), p_client_request_id);
$$;

-- 분석 이벤트는 확정된 변경 뒤 같은 트랜잭션에서 기록하고 중복은 무시한다. (FR-ANA-002, 006)
create or replace function private._event(
  p_name text, p_request_id uuid, p_application_id uuid, p_match_id uuid,
  p_client_request_id uuid, p_properties jsonb
) returns void language sql security definer
set search_path = public, pg_temp
as $$
  insert into public.product_events (event_name, actor_id, request_id, application_id, match_id, client_request_id, properties)
  values (p_name, auth.uid(), p_request_id, p_application_id, p_match_id, p_client_request_id, coalesce(p_properties, '{}'::jsonb))
  on conflict do nothing;
$$;

-- ---------------------------------------------------------------------
-- 1. 프로필 (온보딩·수정) — 이메일 가입과 v3 Google 가입 모두 이 함수로 프로필을 만든다.
-- ---------------------------------------------------------------------
create or replace function public.upsert_my_profile(
  p_display_name text,
  p_institution_type public.institution_type,
  p_institution_name text,
  p_region_level1_code text,
  p_region_level2_code text,
  p_bio text
) returns public.profiles
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then perform private._fail('AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.user_roles where user_id = v_uid and role = 'member') then
    perform private._fail('FORBIDDEN');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and status <> 'active') then
    perform private._fail('FORBIDDEN');
  end if;

  insert into public.profiles as p (
    id, display_name, institution_type, institution_name,
    region_level1_code, region_level2_code, bio, onboarding_completed_at
  ) values (
    v_uid, btrim(p_display_name), p_institution_type, btrim(p_institution_name),
    p_region_level1_code, p_region_level2_code, btrim(p_bio), now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    institution_type = excluded.institution_type,
    institution_name = excluded.institution_name,
    region_level1_code = excluded.region_level1_code,
    region_level2_code = excluded.region_level2_code,
    bio = excluded.bio,
    onboarding_completed_at = coalesce(p.onboarding_completed_at, now())
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 요청: 초안 저장·수정 / 게시 / 수동 마감 / 보관 / 복제
-- ---------------------------------------------------------------------
create or replace function public.save_request_draft(
  p_request_id uuid,               -- null이면 새 초안
  p_title text,
  p_category_code text default null,
  p_other_category_text text default null,
  p_description text default null,
  p_region_level1_code text default null,
  p_region_level2_code text default null,
  p_schedule_text text default null,
  p_requirements_text text default null,
  p_match_mode public.match_mode default null,
  p_capacity smallint default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_req public.collaboration_requests;
  v_id uuid;
begin
  if (p_match_mode is null) <> (p_capacity is null)
     or (p_match_mode = 'single' and p_capacity <> 1)
     or (p_match_mode = 'multi' and p_capacity not in (2, 3)) then
    perform private._fail('INVALID_CAPACITY');
  end if;

  if p_request_id is null then
    insert into public.collaboration_requests (
      owner_id, category_code, other_category_text, title, description,
      region_level1_code, region_level2_code, schedule_text, requirements_text,
      match_mode, capacity, status
    ) values (
      v_uid, p_category_code, nullif(btrim(p_other_category_text), ''), btrim(p_title), p_description,
      p_region_level1_code, p_region_level2_code, p_schedule_text, p_requirements_text,
      p_match_mode, p_capacity, 'draft'
    ) returning id into v_id;
    return v_id;
  end if;

  select * into v_req from public.collaboration_requests where id = p_request_id for update;
  if not found or v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_req.status not in ('draft', 'open') then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  -- 게시 후 지원이 1건 이상이면 핵심 조건 변경 차단 (FR-REQ-008, §7.2 게시 후 수정 규칙)
  if v_req.status = 'open'
     and exists (select 1 from public.applications where request_id = v_req.id)
     and (
       p_category_code is distinct from v_req.category_code
       or nullif(btrim(p_other_category_text), '') is distinct from v_req.other_category_text
       or p_description is distinct from v_req.description
       or p_region_level1_code is distinct from v_req.region_level1_code
       or p_region_level2_code is distinct from v_req.region_level2_code
       or p_schedule_text is distinct from v_req.schedule_text
       or p_requirements_text is distinct from v_req.requirements_text
       or p_match_mode is distinct from v_req.match_mode
       or p_capacity is distinct from v_req.capacity
     ) then
    perform private._fail('INVALID_STATE_TRANSITION', 'core_fields_locked');
  end if;

  update public.collaboration_requests set
    category_code = p_category_code,
    other_category_text = nullif(btrim(p_other_category_text), ''),
    title = btrim(p_title),
    description = p_description,
    region_level1_code = p_region_level1_code,
    region_level2_code = p_region_level2_code,
    schedule_text = p_schedule_text,
    requirements_text = p_requirements_text,
    match_mode = p_match_mode,
    capacity = p_capacity
  where id = v_req.id;
  return v_req.id;
end;
$$;

create or replace function public.publish_request(p_request_id uuid, p_client_request_id uuid)
returns public.collaboration_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_req public.collaboration_requests;
begin
  select * into v_req from public.collaboration_requests where id = p_request_id for update;
  if not found or v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_req.status <> 'draft' then perform private._fail('INVALID_STATE_TRANSITION'); end if;
  if v_req.match_mode is null or v_req.capacity is null then perform private._fail('INVALID_CAPACITY'); end if;
  -- 비활성 카테고리로는 게시할 수 없다. (ADR-04)
  if not exists (select 1 from public.request_categories where code = v_req.category_code and is_active) then
    perform private._fail('VALIDATION_ERROR', 'category_code');
  end if;

  -- 필수값 길이 검증은 requests_published_fields 제약이 강제한다. (FR-REQ-003, 005)
  update public.collaboration_requests
  set status = 'open', published_at = now()
  where id = v_req.id
  returning * into v_req;

  perform private._audit('request_published', 'collaboration_request', v_req.id, '{}'::jsonb, p_client_request_id);
  perform private._event('request_published', v_req.id, null, null, p_client_request_id,
    jsonb_build_object('match_mode', v_req.match_mode, 'capacity', v_req.capacity,
      'category_code', v_req.category_code, 'region_code', v_req.region_level2_code));
  return v_req;
end;
$$;

create or replace function public.close_request(p_request_id uuid, p_client_request_id uuid)
returns public.collaboration_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_req public.collaboration_requests;
  v_app record;
begin
  select * into v_req from public.collaboration_requests where id = p_request_id for update;
  if not found or v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_req.status <> 'open' then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  update public.collaboration_requests
  set status = 'closed_manual', closed_at = now()
  where id = v_req.id
  returning * into v_req;

  -- 미결정 지원 종료 (FR-REQ-010, FR-APP-011)
  for v_app in
    select id, status from public.applications
    where request_id = v_req.id and status in ('submitted', 'admin_approved')
    for update
  loop
    update public.applications set status = 'closed_by_owner', closed_at = now() where id = v_app.id;
    perform private._log_application(v_app.id, v_app.status, 'closed_by_owner', p_client_request_id);
  end loop;

  perform private._audit('request_closed_manual', 'collaboration_request', v_req.id, '{}'::jsonb, p_client_request_id);
  return v_req;
end;
$$;

create or replace function public.archive_request(p_request_id uuid, p_client_request_id uuid)
returns public.collaboration_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_req public.collaboration_requests;
begin
  select * into v_req from public.collaboration_requests where id = p_request_id for update;
  if not found or v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_req.status not in ('closed_full', 'closed_manual') then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  update public.collaboration_requests set status = 'archived' where id = v_req.id returning * into v_req;
  perform private._audit('request_archived', 'collaboration_request', v_req.id, '{}'::jsonb, p_client_request_id);
  return v_req;
end;
$$;

-- 마감 요청을 새 초안으로 복제 (FR-REQ-014, P1)
create or replace function public.clone_request(p_request_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_req public.collaboration_requests;
  v_id uuid;
begin
  select * into v_req from public.collaboration_requests where id = p_request_id;
  if not found or v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_req.status not in ('closed_full', 'closed_manual', 'archived') then
    perform private._fail('INVALID_STATE_TRANSITION');
  end if;

  insert into public.collaboration_requests (
    owner_id, category_code, other_category_text, title, description,
    region_level1_code, region_level2_code, schedule_text, requirements_text,
    match_mode, capacity, status
  ) values (
    v_uid, v_req.category_code, v_req.other_category_text, v_req.title, v_req.description,
    v_req.region_level1_code, v_req.region_level2_code, v_req.schedule_text, v_req.requirements_text,
    v_req.match_mode, v_req.capacity, 'draft'
  ) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 지원: 제출 / 철회
-- ---------------------------------------------------------------------
create or replace function public.submit_application(
  p_request_id uuid, p_message text, p_client_request_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_cached jsonb;
  v_req public.collaboration_requests;
  v_app_id uuid;
begin
  v_cached := private._idem_begin('submit_application', p_client_request_id,
    jsonb_build_object('request_id', p_request_id, 'message', p_message));
  if v_cached is not null then return v_cached; end if;

  -- 요청 잠금 후 재검사 (FR-APP-004)
  select * into v_req from public.collaboration_requests where id = p_request_id for update;
  if not found or v_req.status <> 'open' then perform private._fail('REQUEST_NOT_OPEN'); end if;
  if v_req.accepted_slots >= v_req.capacity then perform private._fail('MATCH_CAPACITY_REACHED'); end if;
  if v_req.owner_id = v_uid then perform private._fail('SELF_APPLICATION_NOT_ALLOWED'); end if;
  -- 철회 후 재지원도 금지 (FR-APP-002)
  if exists (select 1 from public.applications where request_id = v_req.id and applicant_id = v_uid) then
    perform private._fail('DUPLICATE_APPLICATION');
  end if;

  insert into public.applications (request_id, applicant_id, message)
  values (v_req.id, v_uid, btrim(p_message))
  returning id into v_app_id;

  perform private._log_application(v_app_id, null, 'submitted', p_client_request_id);
  perform private._event('application_submitted', v_req.id, v_app_id, null, p_client_request_id,
    jsonb_build_object('match_mode', v_req.match_mode, 'capacity', v_req.capacity, 'category_code', v_req.category_code));

  return private._idem_finish('submit_application', p_client_request_id,
    jsonb_build_object('application_id', v_app_id, 'status', 'submitted'));
end;
$$;

create or replace function public.withdraw_application(p_application_id uuid, p_client_request_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_request_id uuid;
  v_app public.applications;
begin
  select request_id into v_request_id from public.applications where id = p_application_id;
  if not found then perform private._fail('FORBIDDEN'); end if;
  perform 1 from public.collaboration_requests where id = v_request_id for update;
  select * into v_app from public.applications where id = p_application_id for update;

  if v_app.applicant_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  -- FR-APP-007, 008
  if v_app.status not in ('submitted', 'admin_approved') then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  update public.applications set status = 'withdrawn', withdrawn_at = now() where id = v_app.id;
  perform private._log_application(v_app.id, v_app.status, 'withdrawn', p_client_request_id);
  return jsonb_build_object('application_id', v_app.id, 'status', 'withdrawn');
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 관리자 검토 (FR-ADM-001~010)
-- ---------------------------------------------------------------------
create or replace function public.review_application(
  p_application_id uuid,
  p_decision public.review_decision,
  p_reason_internal text,
  p_message_public text,
  p_client_request_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_admin();
  v_cached jsonb;
  v_request_id uuid;
  v_req public.collaboration_requests;
  v_app public.applications;
  v_to public.application_status;
begin
  v_cached := private._idem_begin('review_application', p_client_request_id,
    jsonb_build_object('application_id', p_application_id, 'decision', p_decision,
      'reason', p_reason_internal, 'message', p_message_public));
  if v_cached is not null then return v_cached; end if;

  select request_id into v_request_id from public.applications where id = p_application_id;
  if not found then perform private._fail('APPLICATION_NOT_REVIEWABLE'); end if;
  select * into v_req from public.collaboration_requests where id = v_request_id for update;
  select * into v_app from public.applications where id = p_application_id for update;

  -- 이미 종료된 지원이면 최신 상태를 함께 반환 (FR-ADM-009)
  if v_app.status <> 'submitted' then
    perform private._fail('APPLICATION_NOT_REVIEWABLE', v_app.status::text);
  end if;
  if v_req.status <> 'open' then perform private._fail('REQUEST_NOT_OPEN', v_req.status::text); end if;

  v_to := case p_decision when 'approved' then 'admin_approved' else 'admin_rejected' end;

  -- 내부 사유 5~1000자는 applications_admin_reason_length 제약이 강제 (FR-ADM-005)
  update public.applications set
    status = v_to,
    admin_decision = p_decision,
    admin_reviewer_id = v_uid,
    admin_reason_internal = btrim(p_reason_internal),
    admin_message_public = nullif(btrim(p_message_public), ''),
    admin_reviewed_at = now()
  where id = v_app.id;

  perform private._log_application(v_app.id, 'submitted', v_to, p_client_request_id);
  perform private._audit('application_admin_reviewed', 'application', v_app.id,
    jsonb_build_object('decision', p_decision), p_client_request_id);
  perform private._event('application_admin_reviewed', v_req.id, v_app.id, null, p_client_request_id,
    jsonb_build_object('decision', p_decision));

  return private._idem_finish('review_application', p_client_request_id,
    jsonb_build_object('application_id', v_app.id, 'status', v_to));
end;
$$;

-- 관리자 전용: 내부 사유 조회 (일반 SELECT에서는 열 권한으로 차단됨)
create or replace function public.admin_get_review_note(p_application_id uuid)
returns table (admin_reason_internal text, admin_reviewer_id uuid, admin_reviewed_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform private._require_admin();
  return query
    select a.admin_reason_internal, a.admin_reviewer_id, a.admin_reviewed_at
    from public.applications a where a.id = p_application_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 요청 원장 결정: 수락·거절 + 정원 + 매칭·후속 업무 (§11.7, FR-DEC-001~012)
-- ---------------------------------------------------------------------
create or replace function public.decide_application(
  p_application_id uuid,
  p_decision public.owner_decision,
  p_message_public text,
  p_client_request_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_cached jsonb;
  v_request_id uuid;
  v_req public.collaboration_requests;
  v_app public.applications;
  v_match_id uuid;
  v_other record;
begin
  v_cached := private._idem_begin('decide_application', p_client_request_id,
    jsonb_build_object('application_id', p_application_id, 'decision', p_decision, 'message', p_message_public));
  if v_cached is not null then return v_cached; end if;

  -- 존재 여부를 노출하지 않도록 없는 지원도 FORBIDDEN으로 응답
  select request_id into v_request_id from public.applications where id = p_application_id;
  if not found then perform private._fail('FORBIDDEN'); end if;

  -- 요청 행 잠금 (FR-DEC-002) → 지원 행 잠금
  select * into v_req from public.collaboration_requests where id = v_request_id for update;
  select * into v_app from public.applications where id = p_application_id for update;

  if v_req.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_app.status <> 'admin_approved' then
    perform private._fail('APPLICATION_NOT_DECIDABLE', v_app.status::text);
  end if;

  if p_decision = 'rejected' then
    -- 거절은 accepted_slots를 바꾸지 않는다. (FR-DEC-010)
    update public.applications set
      status = 'owner_rejected', owner_decision = 'rejected',
      owner_message_public = nullif(btrim(p_message_public), ''), owner_decided_at = now()
    where id = v_app.id;
    perform private._log_application(v_app.id, 'admin_approved', 'owner_rejected', p_client_request_id);
    perform private._event('application_owner_decided', v_req.id, v_app.id, null, p_client_request_id,
      jsonb_build_object('decision', 'rejected'));
    return private._idem_finish('decide_application', p_client_request_id,
      jsonb_build_object('application_id', v_app.id, 'status', 'owner_rejected', 'request_status', v_req.status));
  end if;

  -- 수락 재검증 (FR-DEC-003, 009)
  if v_req.status = 'closed_full' or v_req.accepted_slots >= v_req.capacity then
    perform private._fail('MATCH_CAPACITY_REACHED');
  end if;
  if v_req.status <> 'open' then perform private._fail('REQUEST_NOT_OPEN', v_req.status::text); end if;

  update public.applications set
    status = 'owner_accepted', owner_decision = 'accepted',
    owner_message_public = nullif(btrim(p_message_public), ''), owner_decided_at = now()
  where id = v_app.id;
  perform private._log_application(v_app.id, 'admin_approved', 'owner_accepted', p_client_request_id);

  -- 정원 +1, 도달 시 즉시 마감 (FR-DEC-005, 007)
  update public.collaboration_requests set
    accepted_slots = accepted_slots + 1,
    status = case when accepted_slots + 1 = capacity then 'closed_full'::public.request_status else status end,
    closed_at = case when accepted_slots + 1 = capacity then now() else closed_at end
  where id = v_req.id
  returning * into v_req;

  -- 매칭 1건 + 후속 업무 1건 (FR-MAT-001, 003)
  insert into public.matches (request_id, application_id, owner_id, applicant_id)
  values (v_req.id, v_app.id, v_req.owner_id, v_app.applicant_id)
  returning id into v_match_id;
  insert into public.followup_cases (match_id, updated_by) values (v_match_id, v_uid);

  perform private._audit('application_owner_accepted', 'application', v_app.id,
    jsonb_build_object('match_id', v_match_id), p_client_request_id);
  perform private._event('application_owner_decided', v_req.id, v_app.id, v_match_id, p_client_request_id,
    jsonb_build_object('decision', 'accepted'));
  perform private._event('match_created', v_req.id, v_app.id, v_match_id, p_client_request_id,
    jsonb_build_object('match_mode', v_req.match_mode, 'capacity', v_req.capacity));

  -- 정원 마감 시 나머지 미결정 지원 종료 (FR-DEC-008)
  if v_req.status = 'closed_full' then
    for v_other in
      select id, status from public.applications
      where request_id = v_req.id and id <> v_app.id and status in ('submitted', 'admin_approved')
      for update
    loop
      update public.applications set status = 'closed_capacity', closed_at = now() where id = v_other.id;
      perform private._log_application(v_other.id, v_other.status, 'closed_capacity', p_client_request_id);
    end loop;
    perform private._event('request_closed_full', v_req.id, null, null, p_client_request_id,
      jsonb_build_object('match_mode', v_req.match_mode, 'capacity', v_req.capacity));
  end if;

  return private._idem_finish('decide_application', p_client_request_id,
    jsonb_build_object('application_id', v_app.id, 'status', 'owner_accepted',
      'match_id', v_match_id, 'request_status', v_req.status, 'accepted_slots', v_req.accepted_slots));
end;
$$;

-- ---------------------------------------------------------------------
-- 6. 매칭·후속 업무 (FR-MAT-005~012)
-- ---------------------------------------------------------------------
create or replace function public.update_followup(
  p_match_id uuid,
  p_stage public.followup_stage,
  p_next_action text,
  p_next_action_at timestamptz,
  p_client_request_id uuid
) returns public.followup_cases
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_match public.matches;
  v_case public.followup_cases;
  v_action_changed boolean;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_match.status <> 'active' then perform private._fail('INVALID_STATE_TRANSITION'); end if;
  -- 완료·중단은 end_match로만 처리 (매칭 상태와 동기화)
  if p_stage in ('completed', 'canceled') then perform private._fail('INVALID_STATE_TRANSITION', 'use_end_match'); end if;

  select * into v_case from public.followup_cases where match_id = p_match_id for update;

  -- 같은 client_request_id 재요청이면 변경 없이 현재 값 반환
  if exists (select 1 from public.followup_updates where author_id = v_uid and client_request_id = p_client_request_id) then
    return v_case;
  end if;

  v_action_changed := nullif(btrim(p_next_action), '') is distinct from v_case.next_action
                      or p_next_action_at is distinct from v_case.next_action_at;

  if p_stage is distinct from v_case.stage then
    insert into public.followup_updates (match_id, author_id, kind, from_stage, to_stage, client_request_id)
    values (p_match_id, v_uid, 'stage_change', v_case.stage, p_stage, p_client_request_id);
  end if;
  if v_action_changed then
    insert into public.followup_updates (match_id, author_id, kind, client_request_id)
    values (p_match_id, v_uid, 'next_action_change',
      case when p_stage is distinct from v_case.stage then gen_random_uuid() else p_client_request_id end);
  end if;

  update public.followup_cases set
    stage = p_stage,
    next_action = nullif(btrim(p_next_action), ''),
    next_action_at = p_next_action_at,
    updated_by = v_uid
  where match_id = p_match_id
  returning * into v_case;

  perform private._event('followup_updated', v_match.request_id, v_match.application_id, v_match.id,
    p_client_request_id, jsonb_build_object('stage', p_stage));
  return v_case;
end;
$$;

create or replace function public.add_followup_note(p_match_id uuid, p_note text, p_client_request_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_match public.matches;
  v_id uuid;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found or v_uid not in (v_match.owner_id, v_match.applicant_id) then perform private._fail('FORBIDDEN'); end if;
  if v_match.status <> 'active' then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  insert into public.followup_updates (match_id, author_id, kind, note, client_request_id)
  values (p_match_id, v_uid, 'note', btrim(p_note), p_client_request_id)
  on conflict (author_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.followup_updates
    where author_id = v_uid and client_request_id = p_client_request_id;
  else
    perform private._event('followup_updated', v_match.request_id, v_match.application_id, v_match.id,
      p_client_request_id, jsonb_build_object('kind', 'note'));
  end if;
  return v_id;
end;
$$;

-- 매칭 완료·중단: 요청 상태와 accepted_slots는 바꾸지 않는다. (FR-MAT-006~008, FR-REQ-013)
create or replace function public.end_match(
  p_match_id uuid, p_status public.match_status, p_reason text, p_client_request_id uuid
) returns public.matches
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_match public.matches;
  v_from public.followup_stage;
begin
  if p_status not in ('completed', 'canceled') then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found or v_match.owner_id <> v_uid then perform private._fail('FORBIDDEN'); end if;
  if v_match.status <> 'active' then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  update public.matches set
    status = p_status, ended_at = now(), ended_by = v_uid, ended_reason = nullif(btrim(p_reason), '')
  where id = v_match.id
  returning * into v_match;

  select stage into v_from from public.followup_cases where match_id = p_match_id for update;
  update public.followup_cases set stage = p_status::text::public.followup_stage, updated_by = v_uid
  where match_id = p_match_id;
  insert into public.followup_updates (match_id, author_id, kind, from_stage, to_stage, client_request_id)
  values (p_match_id, v_uid, 'stage_change', v_from, p_status::text::public.followup_stage, p_client_request_id)
  on conflict (author_id, client_request_id) do nothing;

  perform private._audit('match_ended', 'match', v_match.id, jsonb_build_object('status', p_status), p_client_request_id);
  perform private._event('followup_updated', v_match.request_id, v_match.application_id, v_match.id,
    p_client_request_id, jsonb_build_object('stage', p_status));
  return v_match;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. 매칭별 연락 수단 (FR-CON-001~006)
-- ---------------------------------------------------------------------
create or replace function public.upsert_match_contact(
  p_match_id uuid, p_channel public.contact_channel, p_contact_value text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found or v_uid not in (v_match.owner_id, v_match.applicant_id) then perform private._fail('FORBIDDEN'); end if;
  if v_match.status <> 'active' then perform private._fail('INVALID_STATE_TRANSITION'); end if;

  insert into public.match_contact_shares (match_id, user_id, channel, contact_value)
  values (p_match_id, v_uid, p_channel, btrim(p_contact_value))
  on conflict (match_id, user_id) do update set
    channel = excluded.channel, contact_value = excluded.contact_value,
    shared_at = now(), revoked_at = null;
  -- 감사·이벤트에 연락처 값은 남기지 않는다.
  perform private._audit('match_contact_shared', 'match', p_match_id, jsonb_build_object('channel', p_channel), null);
end;
$$;

create or replace function public.revoke_match_contact(p_match_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := private._require_member();
begin
  update public.match_contact_shares set revoked_at = now()
  where match_id = p_match_id and user_id = v_uid and revoked_at is null;
  if not found then perform private._fail('INVALID_STATE_TRANSITION'); end if;
  perform private._audit('match_contact_revoked', 'match', p_match_id, '{}'::jsonb, null);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. 관리자 역할 부여·회수 (FR-SEC-006)
--    - 이메일 문자열이 아니라 auth.users의 UUID로만 대상을 지정한다.
--    - private 스키마라 Data API로 호출할 수 없고, SQL Editor(postgres)에서만 실행한다.
--    - 이메일 인증이 끝난 계정만 대상이 되며 모든 변경을 감사 로그에 남긴다.
-- 사용 예: select private.grant_admin_role('<auth.users.id>', '운영 관리자 지정 사유');
-- ---------------------------------------------------------------------
create or replace function private.grant_admin_role(p_user_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'ADMIN_GRANT_NOTE_REQUIRED';
  end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null and u.deleted_at is null
  ) then
    raise exception 'ADMIN_GRANT_TARGET_INVALID';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, 'admin', null)
  on conflict (user_id, role) do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'admin_role_granted', 'user', p_user_id,
    jsonb_build_object('note', btrim(p_note), 'operator', session_user));
end;
$$;

create or replace function private.revoke_admin_role(p_user_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'ADMIN_GRANT_NOTE_REQUIRED';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = 'admin';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'admin_role_revoked', 'user', p_user_id,
    jsonb_build_object('note', btrim(p_note), 'operator', session_user));
end;
$$;

-- ---------------------------------------------------------------------
-- 9. 실행 권한: 내부 헬퍼는 차단, 공개 RPC만 authenticated에 부여 (FR-SEC-004)
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 이후 생성되는 함수도 기본으로 실행 권한을 주지 않는다. (함수는 RLS로 보호되지 않음)
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

grant execute on function
  public.is_admin(), public.is_active_member(), public.is_match_party(uuid),
  public.owns_request(uuid), public.has_applied(uuid),
  public.can_view_application(uuid), public.can_view_profile(uuid),
  public.upsert_my_profile(text, public.institution_type, text, text, text, text),
  public.save_request_draft(uuid, text, text, text, text, text, text, text, text, public.match_mode, smallint),
  public.publish_request(uuid, uuid),
  public.close_request(uuid, uuid),
  public.archive_request(uuid, uuid),
  public.clone_request(uuid),
  public.submit_application(uuid, text, uuid),
  public.withdraw_application(uuid, uuid),
  public.review_application(uuid, public.review_decision, text, text, uuid),
  public.admin_get_review_note(uuid),
  public.decide_application(uuid, public.owner_decision, text, uuid),
  public.update_followup(uuid, public.followup_stage, text, timestamptz, uuid),
  public.add_followup_note(uuid, text, uuid),
  public.end_match(uuid, public.match_status, text, uuid),
  public.upsert_match_contact(uuid, public.contact_channel, text),
  public.revoke_match_contact(uuid)
  to authenticated;

commit;
