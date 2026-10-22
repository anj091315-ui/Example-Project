-- =====================================================================
-- 원장님 MVP v2 · 01 스키마·인덱스·RLS
-- 기준: docs/PRD.md §11.1~§11.10 (DDL은 PRD 명세를 그대로 따른다)
-- 적용: Supabase Dashboard > SQL Editor (사용자 확인 후)
-- 결제(Toss) 관련 객체는 포함하지 않는다. (PRD 확정 #7, §14.2)
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 타입 (§11.3)
-- ---------------------------------------------------------------------
create type public.institution_type as enum ('tutoring_institute', 'study_room');
create type public.account_status   as enum ('active', 'inactive', 'suspended');
create type public.app_role         as enum ('member', 'admin');
create type public.match_mode       as enum ('single', 'multi');
create type public.request_status   as enum ('draft', 'open', 'closed_full', 'closed_manual', 'archived');
create type public.application_status as enum (
  'submitted', 'admin_approved', 'admin_rejected', 'owner_accepted',
  'owner_rejected', 'withdrawn', 'closed_capacity', 'closed_by_owner'
);
create type public.review_decision  as enum ('approved', 'rejected');
create type public.owner_decision   as enum ('accepted', 'rejected');
create type public.match_status     as enum ('active', 'completed', 'canceled');
create type public.followup_stage   as enum ('not_started', 'contacted', 'in_progress', 'completed', 'canceled');
create type public.followup_update_kind as enum ('note', 'stage_change', 'next_action_change', 'system');
create type public.contact_channel  as enum ('phone', 'email', 'messenger', 'other');

-- ---------------------------------------------------------------------
-- 2. 테이블 (§11.4)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 30),
  institution_type public.institution_type not null,
  institution_name text not null
    check (char_length(btrim(institution_name)) between 2 and 60),
  region_level1_code text not null
    check (char_length(region_level1_code) between 2 and 20),
  region_level2_code text not null
    check (char_length(region_level2_code) between 2 and 20),
  bio text not null
    check (char_length(btrim(bio)) between 20 and 500),
  status public.account_status not null default 'active',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.request_categories (
  code text primary key
    check (code ~ '^[a-z0-9_]{2,40}$'),
  label_ko text not null
    check (char_length(btrim(label_ko)) between 1 and 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  category_code text references public.request_categories(code) on delete restrict,
  other_category_text text,
  title text not null
    check (char_length(btrim(title)) between 1 and 80),
  description text,
  region_level1_code text,
  region_level2_code text,
  schedule_text text,
  requirements_text text,
  match_mode public.match_mode,
  capacity smallint,
  accepted_slots smallint not null default 0,
  status public.request_status not null default 'draft',
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint requests_capacity_nonnegative
    check (accepted_slots >= 0),
  constraint requests_mode_capacity_valid
    check (
      (match_mode is null and capacity is null and status = 'draft')
      or (match_mode = 'single' and capacity = 1)
      or (match_mode = 'multi' and capacity in (2, 3))
    ),
  constraint requests_accepted_within_capacity
    check (capacity is null or accepted_slots <= capacity),
  constraint requests_full_is_full
    check (status <> 'closed_full' or accepted_slots = capacity),
  constraint requests_other_category
    check (
      (category_code = 'other'
        and char_length(btrim(other_category_text)) between 2 and 40)
      or (category_code is distinct from 'other'
        and other_category_text is null)
      or (status = 'draft')
    ),
  constraint requests_published_fields
    check (
      status = 'draft'
      or (
        category_code is not null
        and char_length(btrim(title)) between 5 and 80
        and char_length(btrim(description)) between 30 and 3000
        and region_level1_code is not null
        and region_level2_code is not null
        and char_length(btrim(schedule_text)) between 5 and 500
        and char_length(btrim(requirements_text)) between 10 and 1500
        and match_mode is not null
        and capacity is not null
        and published_at is not null
      )
    )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.collaboration_requests(id) on delete restrict,
  applicant_id uuid not null
    references public.profiles(id) on delete restrict,
  message text not null
    check (char_length(btrim(message)) between 30 and 1500),
  status public.application_status not null default 'submitted',

  admin_decision public.review_decision,
  admin_reviewer_id uuid references auth.users(id) on delete set null,
  admin_reason_internal text,
  admin_message_public text,
  admin_reviewed_at timestamptz,

  owner_decision public.owner_decision,
  owner_message_public text,
  owner_decided_at timestamptz,

  withdrawn_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint applications_one_per_member
    unique (request_id, applicant_id),
  constraint applications_admin_reason_length
    check (
      admin_reason_internal is null
      or char_length(btrim(admin_reason_internal)) between 5 and 1000
    ),
  constraint applications_public_messages_length
    check (
      (admin_message_public is null or char_length(admin_message_public) <= 300)
      and (owner_message_public is null or char_length(owner_message_public) <= 300)
    ),
  constraint applications_admin_decision_complete
    check (
      admin_decision is null
      or (
        admin_reviewer_id is not null
        and admin_reason_internal is not null
        and admin_reviewed_at is not null
      )
    ),
  constraint applications_owner_decision_complete
    check (owner_decision is null or owner_decided_at is not null),
  constraint applications_status_decisions_consistent
    check (
      (status = 'submitted'
        and admin_decision is null and owner_decision is null)
      or (status = 'admin_approved'
        and admin_decision = 'approved' and owner_decision is null)
      or (status = 'admin_rejected'
        and admin_decision = 'rejected' and owner_decision is null)
      or (status = 'owner_accepted'
        and admin_decision = 'approved' and owner_decision = 'accepted')
      or (status = 'owner_rejected'
        and admin_decision = 'approved' and owner_decision = 'rejected')
      or (status in ('withdrawn', 'closed_capacity', 'closed_by_owner')
        and owner_decision is null
        and (admin_decision is null or admin_decision = 'approved'))
    )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.collaboration_requests(id) on delete restrict,
  application_id uuid not null unique
    references public.applications(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  applicant_id uuid not null references public.profiles(id) on delete restrict,
  status public.match_status not null default 'active',
  ended_reason text,
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint matches_different_parties
    check (owner_id <> applicant_id),
  constraint matches_end_fields
    check (
      (status = 'active' and ended_at is null)
      or (status in ('completed', 'canceled') and ended_at is not null)
    )
);

create table public.followup_cases (
  match_id uuid primary key references public.matches(id) on delete restrict,
  stage public.followup_stage not null default 'not_started',
  next_action text
    check (next_action is null or char_length(btrim(next_action)) between 1 and 200),
  next_action_at timestamptz,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.followup_updates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null
    references public.followup_cases(match_id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  kind public.followup_update_kind not null,
  note text,
  from_stage public.followup_stage,
  to_stage public.followup_stage,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),

  constraint followup_updates_unique_request
    unique (author_id, client_request_id),
  constraint followup_updates_payload
    check (
      (kind = 'note'
        and char_length(btrim(note)) between 1 and 1000
        and from_stage is null and to_stage is null)
      or (kind = 'stage_change'
        and from_stage is not null and to_stage is not null)
      or (kind = 'next_action_change')
      or (kind = 'system')
    )
);

create table public.match_contact_shares (
  match_id uuid not null references public.matches(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  channel public.contact_channel not null,
  contact_value text not null
    check (char_length(btrim(contact_value)) between 1 and 200),
  shared_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null
    references public.applications(id) on delete restrict,
  from_status public.application_status,
  to_status public.application_status not null,
  actor_id uuid references auth.users(id) on delete set null,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  client_request_id uuid not null,
  request_hash text not null,
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, client_request_id)
);

create table public.product_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  actor_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.collaboration_requests(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  client_request_id uuid,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create unique index product_events_dedupe_idx
  on public.product_events (
    event_name,
    coalesce(actor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(client_request_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where client_request_id is not null;

-- ---------------------------------------------------------------------
-- 3. 인덱스 (§11.5)
-- ---------------------------------------------------------------------
create index requests_open_published_idx
  on public.collaboration_requests (published_at desc, id desc) where status = 'open';
create index requests_owner_status_idx
  on public.collaboration_requests (owner_id, status, updated_at desc);
create index requests_filters_idx
  on public.collaboration_requests (category_code, region_level1_code, region_level2_code, match_mode)
  where status = 'open';
create index applications_admin_queue_idx
  on public.applications (created_at, id) where status = 'submitted';
create index applications_owner_queue_idx
  on public.applications (request_id, created_at) where status = 'admin_approved';
create index applications_applicant_idx
  on public.applications (applicant_id, updated_at desc);
create index matches_owner_idx
  on public.matches (owner_id, status, updated_at desc);
create index matches_applicant_idx
  on public.matches (applicant_id, status, updated_at desc);
create index followup_updates_timeline_idx
  on public.followup_updates (match_id, created_at, id);
create index application_history_timeline_idx
  on public.application_status_history (application_id, created_at, id);

-- ---------------------------------------------------------------------
-- 4. updated_at 트리거 (§11.6)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger requests_set_updated_at before update on public.collaboration_requests
  for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger matches_set_updated_at before update on public.matches
  for each row execute function public.set_updated_at();
create trigger followup_cases_set_updated_at before update on public.followup_cases
  for each row execute function public.set_updated_at();
create trigger match_contact_shares_set_updated_at before update on public.match_contact_shares
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. 가입 트리거: 모든 가입 경로(이메일, v3 Google OAuth)에 member 역할만 부여
--    (FR-AUTH-003, §11.4.2). 프로필은 온보딩 RPC에서 생성한다.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. RLS 헬퍼 (§11.8 + 정책 간 재귀 방지용 보조 함수)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = auth.uid()
      and p.status = 'active'
      and p.onboarding_completed_at is not null
      and ur.role = 'member'
  );
$$;

create or replace function public.is_match_party(p_match_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and auth.uid() in (m.owner_id, m.applicant_id)
  );
$$;

-- 요청 원장 본인 여부
create or replace function public.owns_request(p_request_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.collaboration_requests r
    where r.id = p_request_id and r.owner_id = auth.uid()
  );
$$;

-- 해당 요청에 지원한 적이 있는지 (보관된 요청도 지원자에게 보이도록)
create or replace function public.has_applied(p_request_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.applications a
    where a.request_id = p_request_id and a.applicant_id = auth.uid()
  );
$$;

-- 지원 행 조회 가능 여부: 지원자 본인, 관리자, 관리자 승인 이후의 요청 원장 (FR-APP-009/010)
create or replace function public.can_view_application(p_application_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.applications a
    join public.collaboration_requests r on r.id = a.request_id
    where a.id = p_application_id
      and (
        a.applicant_id = auth.uid()
        or public.is_admin()
        or (a.admin_decision = 'approved' and r.owner_id = auth.uid())
      )
  );
$$;

-- 공개 프로필 조회 가능 여부 (§11.10)
create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    p_profile_id = auth.uid()
    or public.is_admin()
    -- 게시된 요청의 원장 정보
    or exists (
      select 1 from public.collaboration_requests r
      where r.owner_id = p_profile_id
        and r.status in ('open', 'closed_full', 'closed_manual')
    )
    -- 관리자 승인 이후, 내 요청에 지원한 지원자
    or exists (
      select 1
      from public.applications a
      join public.collaboration_requests r on r.id = a.request_id
      where a.applicant_id = p_profile_id
        and a.admin_decision = 'approved'
        and r.owner_id = auth.uid()
    )
    -- 매칭 상대
    or exists (
      select 1 from public.matches m
      where (m.owner_id = auth.uid() and m.applicant_id = p_profile_id)
         or (m.applicant_id = auth.uid() and m.owner_id = p_profile_id)
    );
$$;

-- ---------------------------------------------------------------------
-- 7. 권한: 기본 거부 후 필요한 SELECT만 부여, 쓰기는 RPC 전용 (§11.9, FR-SEC-001)
--    Supabase는 public 테이블에 anon/authenticated 권한을 자동 부여하므로 먼저 회수한다.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.user_roles, public.request_categories,
  public.collaboration_requests, public.matches, public.followup_cases,
  public.followup_updates, public.match_contact_shares
  to authenticated;

-- 상태 이력: 관리자 검토자 식별자(actor_id)는 지원자·요청 원장에게 노출하지 않는다.
grant select (id, application_id, from_status, to_status, created_at)
  on public.application_status_history to authenticated;

-- applications: 관리자 내부 사유와 검토자 ID는 열 권한에서 제외 (FR-ADM-006, FR-SEC-007)
grant select (
  id, request_id, applicant_id, message, status,
  admin_decision, admin_message_public, admin_reviewed_at,
  owner_decision, owner_message_public, owner_decided_at,
  withdrawn_at, closed_at, created_at, updated_at
) on public.applications to authenticated;

grant execute on function
  public.is_admin(), public.is_active_member(), public.is_match_party(uuid),
  public.owns_request(uuid), public.has_applied(uuid),
  public.can_view_application(uuid), public.can_view_profile(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 8. RLS 활성화와 SELECT 정책 (INSERT/UPDATE/DELETE 정책 없음 = 직접 쓰기 거부)
-- ---------------------------------------------------------------------
alter table public.profiles                    enable row level security;
alter table public.user_roles                  enable row level security;
alter table public.request_categories          enable row level security;
alter table public.collaboration_requests      enable row level security;
alter table public.applications                enable row level security;
alter table public.matches                     enable row level security;
alter table public.followup_cases              enable row level security;
alter table public.followup_updates            enable row level security;
alter table public.match_contact_shares        enable row level security;
alter table public.application_status_history  enable row level security;
alter table public.audit_logs                  enable row level security;
alter table public.idempotency_keys            enable row level security;
alter table public.product_events              enable row level security;

create policy profiles_select_related on public.profiles
  for select to authenticated
  using (public.can_view_profile(id));

create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy categories_select_authenticated on public.request_categories
  for select to authenticated
  using (true);

create policy requests_select_published on public.collaboration_requests
  for select to authenticated
  using (status in ('open', 'closed_full', 'closed_manual'));

create policy requests_select_own on public.collaboration_requests
  for select to authenticated
  using (owner_id = auth.uid());

create policy requests_select_admin on public.collaboration_requests
  for select to authenticated
  using (public.is_admin());

create policy requests_select_applied on public.collaboration_requests
  for select to authenticated
  using (public.has_applied(id));

create policy applications_select_own on public.applications
  for select to authenticated
  using (applicant_id = auth.uid());

create policy applications_select_admin on public.applications
  for select to authenticated
  using (public.is_admin());

create policy applications_select_owner_after_approval on public.applications
  for select to authenticated
  using (admin_decision = 'approved' and public.owns_request(request_id));

create policy matches_select_parties on public.matches
  for select to authenticated
  using (auth.uid() in (owner_id, applicant_id));

create policy followup_cases_select_parties on public.followup_cases
  for select to authenticated
  using (public.is_match_party(match_id));

create policy followup_updates_select_parties on public.followup_updates
  for select to authenticated
  using (public.is_match_party(match_id));

-- 철회된 연락처는 상대에게 즉시 숨김 (§11.11)
create policy match_contacts_select_parties on public.match_contact_shares
  for select to authenticated
  using (
    public.is_match_party(match_id)
    and (revoked_at is null or user_id = auth.uid())
  );

create policy application_history_select_related on public.application_status_history
  for select to authenticated
  using (public.can_view_application(application_id));

-- audit_logs, idempotency_keys, product_events: 정책 없음 → 클라이언트 조회 불가

commit;
