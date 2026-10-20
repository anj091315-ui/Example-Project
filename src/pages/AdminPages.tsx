import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, EmptyState, MetricCard, PageHeading, StatusBadge } from "../components/Ui";
import { useDemo } from "../state/DemoContext";
import { demoUsers } from "../state/sampleData";
import type { ApplicationStatus } from "../types";

function getUser(id: string) {
  return demoUsers.find((user) => user.id === id) ?? demoUsers[0];
}

function formatDate(date: string) {
  if (!date) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export function AdminQueuePage() {
  const { applications, requests } = useDemo();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("submitted");
  const filtered = useMemo(() => applications.filter((application) => {
    const request = requests.find((item) => item.id === application.requestId);
    const applicant = getUser(application.applicantId);
    const owner = request ? getUser(request.ownerId) : null;
    const text = `${request?.title ?? ""} ${applicant.businessName} ${owner?.businessName ?? ""}`.toLowerCase();
    return (filter === "all" || application.status === filter) && text.includes(query.toLowerCase());
  }), [applications, requests, filter, query]);
  const pending = applications.filter((application) => application.status === "submitted").length;
  const reviewed = applications.filter((application) => ["admin_approved", "admin_rejected"].includes(application.status)).length;

  return (
    <>
      <div className="admin-welcome"><span className="admin-welcome__icon"><ShieldCheck size={20} /></span><div><span>ADMIN WORKSPACE</span><strong>운영팀, 오늘의 검토를 시작해볼까요?</strong><small>지원 내용을 확인하고 요청 원장님께 전달할 지원을 검토해 주세요.</small></div><span className="admin-welcome__demo">시연 전용</span></div>
      <PageHeading eyebrow="REVIEW DASHBOARD" title="지원 검토" description="지원 내용을 확인하고 요청 원장에게 전달할 지원을 결정해요." action={<span className="admin-mode-chip"><ShieldCheck size={15} /> 관리자 모드</span>} />
      <div className="metric-grid admin-metrics">
        <MetricCard label="검토 대기" value={pending} caption="확인이 필요한 지원" icon={<Clock3 size={18} />} featured />
        <MetricCard label="오늘 처리" value="3" caption="시연 데이터 기준" icon={<BadgeCheck size={18} />} />
        <MetricCard label="누적 검토" value={reviewed} caption="승인 및 종료 처리" icon={<FileText size={18} />} />
        <MetricCard label="전체 지원" value={applications.length} caption="시연 데이터" icon={<Users size={18} />} />
      </div>
      <div className="admin-queue-note"><span><CircleAlert size={16} /></span><p><strong>관리자 검토는 요청 원장의 최종 선택과 달라요.</strong> 승인된 지원만 요청 원장에게 전달되며, 매칭 수락은 요청 원장만 할 수 있습니다.</p></div>

      <div className="admin-queue-panel">
        <div className="admin-queue-panel__head"><div><h2>지원 목록</h2><p>제출된 지원을 한 건씩 검토할 수 있어요.</p></div><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="요청·운영명 검색" /></label></div>
        <div className="admin-filter-tabs">
          {[["submitted", "검토 대기"], ["admin_approved", "승인"], ["admin_rejected", "종료"], ["all", "전체"]] .map(([value, label]) => <button key={value} className={filter === value ? "admin-filter-tabs__active" : ""} onClick={() => setFilter(value)}>{label}<span>{value === "all" ? applications.length : applications.filter((application) => application.status === value).length}</span></button>)}
        </div>
        {filtered.length === 0 ? <EmptyState icon={<FileText size={22} />} title="검토할 지원이 없어요" description="선택한 상태의 지원이 아직 없습니다." /> : (
          <div className="review-list">
            {filtered.map((application) => {
              const request = requests.find((item) => item.id === application.requestId);
              if (!request) return null;
              const owner = getUser(request.ownerId);
              const applicant = getUser(application.applicantId);
              const isPending = application.status === "submitted";
              return <button className="review-row" key={application.id} onClick={() => navigate(`/admin/applications/${application.id}`)}>
                <span className="review-row__status">{isPending ? <i /> : <Check size={15} />}</span>
                <span className="review-row__main"><strong>{request.title}</strong><small>{request.category} · {request.region}</small></span>
                <span className="review-row__people"><span><small>요청</small><b>{owner.businessName}</b></span><span><small>지원</small><b>{applicant.businessName}</b></span></span>
                <span className="review-row__capacity"><small>정원</small><b>{request.acceptedSlots}/{request.capacity}</b></span>
                <StatusBadge status={application.status} type="application" />
                <span className="review-row__date">{formatDate(application.submittedAt)}</span>
                <ChevronRight size={17} />
              </button>;
            })}
          </div>
        )}
      </div>
      <div className="admin-data-note"><span>i</span> 본 화면의 지원 및 처리 수는 시연용 샘플 데이터입니다. 실제 검토나 운영 처리는 수행되지 않습니다.</div>
    </>
  );
}

export function AdminReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { applications, requests, updateApplication } = useDemo();
  const [notice, setNotice] = useState("");
  const application = applications.find((item) => item.id === id);
  const request = application ? requests.find((item) => item.id === application.requestId) : undefined;
  if (!application || !request) return <div className="not-found-inline"><span>404</span><h2>지원 정보를 찾을 수 없어요</h2><Link to="/admin/applications" className="button button--primary">검토 목록으로</Link></div>;

  const applicant = getUser(application.applicantId);
  const owner = getUser(request.ownerId);
  const canReview = application.status === "submitted";

  function decide(status: Extract<ApplicationStatus, "admin_approved" | "admin_rejected">) {
    const result = updateApplication(application!.id, status);
    setNotice(result ?? (status === "admin_approved" ? "지원 검토를 승인했어요. 요청 원장에게 전달됩니다." : "이번 지원을 검토 종료했어요."));
  }

  return (
    <>
      <Link to="/admin/applications" className="back-link"><ArrowLeft size={16} /> 검토 목록</Link>
      <PageHeading eyebrow="APPLICATION REVIEW" title="지원 상세 검토" description={`지원 번호 ${application.id.slice(-6).toUpperCase()} · ${formatDate(application.submittedAt)} 접수`} action={<StatusBadge status={application.status} type="application" />} />
      {notice && <div className="toast-inline" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")}>닫기</button></div>}
      <div className="review-detail-grid">
        <div className="review-detail-main">
          <section className="review-detail-card request-review-card">
            <div className="review-card-label"><span><FileText size={17} /> 협업 요청</span><Link to={`/requests/${request.id}`}>요청 전체 보기 <ArrowUpRight size={14} /></Link></div>
            <h2>{request.title}</h2>
            <div className="request-review-meta"><span>{request.category}</span><span><MapPin size={14} />{request.region}</span><span><CalendarDays size={14} />{request.schedule}</span></div>
            <p>{request.description}</p>
            <div className="review-expectation"><strong>기대 조건</strong><span>{request.expectations}</span></div>
            <div className="review-capacity"><div><small>매칭 정원 현황</small><strong>{request.acceptedSlots} / {request.capacity}명</strong></div><span className={`remaining${request.status !== "open" ? " remaining--closed" : ""}`}>{request.status === "open" ? `남은 ${Math.max(0, request.capacity - request.acceptedSlots)}자리` : "신규 수락 불가"}</span></div>
          </section>
          <section className="review-detail-card applicant-review-card">
            <div className="review-card-label"><span><Users size={17} /> 지원자 공개 프로필</span><span className="verified-chip"><Check size={13} /> 공개 정보</span></div>
            <div className="review-applicant"><Avatar user={applicant} size="lg" /><div><h3>{applicant.businessName}</h3><span>{applicant.name} · {applicant.operatingType}</span><span><MapPin size={14} />{applicant.region}</span></div></div>
            <p className="review-profile-intro">{applicant.introduction}</p>
            <div className="privacy-rule"><ShieldCheck size={16} /><span>이메일과 상세 연락처 등 비공개 정보는 검토 화면에 표시하지 않습니다.</span></div>
          </section>
          <section className="review-detail-card application-message-card">
            <div className="review-card-label"><span><FileText size={17} /> 지원 메시지</span><span className="message-safe-label">개인 연락처 비포함</span></div>
            <blockquote>“{application.message}”</blockquote>
            <span className="message-time"><Clock3 size={14} /> {formatDate(application.submittedAt)} 제출</span>
          </section>
        </div>
        <aside className="review-decision">
          <div className="decision-panel">
            <div className="decision-panel__header"><span><ShieldCheck size={19} /></span><div><h2>검토 결정</h2><p>승인 시 요청 원장에게 전달됩니다.</p></div></div>
            {!canReview ? <div className="decision-completed"><span><Check size={19} /></span><strong>검토가 완료되었습니다.</strong><p>시연 상태: {application.status === "admin_approved" ? "요청 원장 결정 대기" : "관리자 검토에서 종료"}</p></div> : <>
              <div className="decision-explainer"><strong>관리자 검토와 원장 수락은 다른 단계예요.</strong><p>이 단계에서는 지원자를 요청 원장에게 전달할지 결정합니다. 매칭 최종 수락은 요청 원장이 진행합니다.</p></div>
              <div className="decision-choice">
                <button className="decision-choice__approve" onClick={() => decide("admin_approved")}><span><Check size={18} /></span><span><strong>검토 승인</strong><small>요청 원장에게 지원을 전달</small></span><ArrowRight size={17} /></button>
                <button className="decision-choice__reject" onClick={() => decide("admin_rejected")}><span><X size={18} /></span><span><strong>검토 종료</strong><small>이번 요청은 전달하지 않음</small></span><ChevronRight size={17} /></button>
              </div>
              <p className="decision-disclaimer">시연 모드에서는 결정이 이 브라우저 메모리에서만 반영됩니다. 실제 운영 기록은 생성되지 않아요.</p>
            </>}
          </div>
          <div className="request-owner-mini"><span className="eyebrow">REQUEST OWNER</span><div><Avatar user={owner} size="sm" /><span><strong>{owner.businessName}</strong><small>{owner.operatingType} · {owner.region}</small></span></div><p>관리자 검토가 끝나면 요청 원장님이 지원을 최종 결정합니다.</p></div>
          <button className="button button--secondary button--full" onClick={() => navigate("/admin/applications")}>검토 목록으로 돌아가기</button>
        </aside>
      </div>
    </>
  );
}
