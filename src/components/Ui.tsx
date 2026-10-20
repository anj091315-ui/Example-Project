import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import type {
  ApplicationStatus,
  CollaborationRequest,
  DemoUser,
  FollowupStage,
  RequestStatus,
} from "../types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " brand-lockup--compact" : ""}`}>
      <span className="brand-mark"><BookOpen size={19} strokeWidth={2.3} /></span>
      <span className="brand-name">원장님<span className="brand-dot">.</span></span>
    </span>
  );
}

export function Avatar({ user, size = "md" }: { user: DemoUser; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-label={user.name}>
      {user.name.slice(0, 1)}
    </span>
  );
}

const requestStatusLabel: Record<RequestStatus, string> = {
  open: "모집 중",
  closed_full: "정원 마감",
  closed_manual: "모집 종료",
};

const applicationStatusLabel: Record<ApplicationStatus, string> = {
  submitted: "관리자 검토 대기",
  admin_approved: "원장 결정 대기",
  admin_rejected: "관리자 검토 종료",
  owner_accepted: "매칭 성사",
  owner_rejected: "요청 원장 결정 종료",
  withdrawn: "지원 철회",
  closed_capacity: "정원 마감 종료",
  closed_by_owner: "요청 원장 마감",
};

const stageLabel: Record<FollowupStage, string> = {
  not_started: "연락 전",
  contacted: "연락 완료",
  in_progress: "진행 중",
  completed: "완료",
  canceled: "중단",
};

export function StatusBadge({
  status,
  type = "request",
}: {
  status: RequestStatus | ApplicationStatus | FollowupStage;
  type?: "request" | "application" | "stage";
}) {
  const label =
    type === "request"
      ? requestStatusLabel[status as RequestStatus]
      : type === "application"
        ? applicationStatusLabel[status as ApplicationStatus]
        : stageLabel[status as FollowupStage];
  const tone =
    status === "open" || status === "owner_accepted" || status === "completed"
      ? "success"
      : status === "submitted" || status === "admin_approved" || status === "in_progress" || status === "contacted"
        ? "info"
        : status === "closed_full" || status === "closed_manual" || status === "closed_capacity" || status === "closed_by_owner" || status === "canceled" || status === "admin_rejected" || status === "owner_rejected" || status === "withdrawn"
          ? "muted"
          : "neutral";
  return <span className={`status-badge status-badge--${tone}`}><span className="status-dot" />{label}</span>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading__action">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon ?? <BookOpen size={22} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function RequestCard({
  request,
  owner,
  own = false,
  onClick,
}: {
  request: CollaborationRequest;
  owner: DemoUser;
  own?: boolean;
  onClick: () => void;
}) {
  const remaining = Math.max(0, request.capacity - request.acceptedSlots);
  return (
    <button className="request-card" onClick={onClick} type="button">
      <div className="request-card__top">
        <span className="category-label">{request.category}</span>
        <StatusBadge status={request.status} />
      </div>
      <h3>{request.title}</h3>
      <p className="request-card__description">{request.description}</p>
      <div className="request-card__owner">
        <Avatar user={owner} size="sm" />
        <span><strong>{owner.businessName}</strong><small>{owner.operatingType} · {owner.name}</small></span>
        {own && <span className="own-label">내 요청</span>}
      </div>
      <div className="request-card__meta">
        <span><MapPin size={15} />{request.region}</span>
        <span><Clock3 size={15} />{request.schedule.split(",")[0]}</span>
      </div>
      <div className="request-card__footer">
        <span className="capacity-chip"><Users size={15} />수락 <b>{request.acceptedSlots} / {request.capacity}</b></span>
        <span className={`remaining${remaining === 0 ? " remaining--closed" : ""}`}>
          {remaining > 0 ? `${remaining}자리 남음` : "정원 마감"}
        </span>
        <span className="request-card__arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </div>
    </button>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
  featured = false,
  trend,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: ReactNode;
  featured?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <div className={`metric-card${featured ? " metric-card--featured" : ""}`}>
      <div className="metric-card__top"><span>{label}</span><span className="metric-card__icon">{icon}</span></div>
      <strong className="metric-card__value">{value}</strong>
      <span className="metric-card__caption">
        {trend === "up" ? <ArrowUpRight size={14} /> : trend === "down" ? <ArrowDownRight size={14} /> : <Check size={14} />}
        {caption}
      </span>
    </div>
  );
}

export function BusinessTypeIcon({ type }: { type: DemoUser["operatingType"] }) {
  return <span className="type-icon"><Building2 size={14} />{type}</span>;
}
