import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  Handshake,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  BusinessTypeIcon,
  EmptyState,
  PageHeading,
  RequestCard,
  StatusBadge,
} from "../components/Ui";
import { useDemo } from "../state/DemoContext";
import { demoUsers } from "../state/sampleData";
import type { FollowupStage } from "../types";

function getUser(id: string) {
  return demoUsers.find((user) => user.id === id) ?? demoUsers[0];
}

function formatDate(date: string) {
  if (!date) return "일정 미정";
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(parsed);
}

export function RequestListPage() {
  const { requests, applications, currentUser } = useDemo();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [type, setType] = useState("전체");
  const [openOnly, setOpenOnly] = useState(true);
  const categories = ["전체", ...new Set(requests.map((request) => request.category))];

  const visibleRequests = useMemo(() => requests.filter((request) => {
    const owner = getUser(request.ownerId);
    const matchesQuery = `${request.title} ${request.description} ${request.region} ${owner.businessName}`.toLowerCase().includes(query.toLowerCase());
    return (
      matchesQuery &&
      (category === "전체" || request.category === category) &&
      (type === "전체" || owner.operatingType === type) &&
      (!openOnly || request.status === "open")
    );
  }), [requests, query, category, type, openOnly]);

  const pendingCount = applications.filter((item) => item.applicantId === currentUser?.id && ["submitted", "admin_approved"].includes(item.status)).length;

  return (
    <>
      <div className="welcome-strip">
        <div className="welcome-strip__icon"><SparklesMini /></div>
        <div><strong>{currentUser?.name ?? "원장"}님, 오늘은 어떤 협업을 찾고 계세요?</strong><p>마음이 맞는 동료 원장님과 함께 새로운 가능성을 만들어보세요.</p></div>
        <Link to="/requests/new" className="welcome-strip__action">요청 만들기 <ArrowRight size={15} /></Link>
      </div>
      <PageHeading
        eyebrow="COLLABORATION BOARD"
        title="함께할 원장님을 찾아보세요"
        description="교습소와 공부방의 협업 요청을 둘러보고, 마음이 맞는 제안에 지원해 보세요."
        action={<Link to="/requests/new" className="button button--primary"><Plus size={17} /> 요청 만들기</Link>}
      />

      <div className="request-summary-row">
        <div className="request-summary-row__intro"><span className="summary-live"><i /> 지금 모집 중</span><strong>{requests.filter((item) => item.status === "open").length}<small>건</small></strong><span>새로운 협업 요청</span></div>
        <div className="request-summary-row__divider" />
        <div className="request-summary-row__item"><span className="summary-icon summary-icon--blue"><ClipboardList size={17} /></span><span><small>내 지원</small><strong>{pendingCount}<em>건 진행 중</em></strong></span></div>
        <div className="request-summary-row__item"><span className="summary-icon summary-icon--peach"><Handshake size={17} /></span><span><small>함께 만들어가는</small><strong>새로운 연결</strong></span></div>
        <div className="request-summary-row__shine"><span>NEW</span><strong>함께하는 성장</strong><small>오늘의 연결이 내일의 수업이 돼요.</small></div>
      </div>

      <div className="list-toolbar">
        <div><strong>최신 협업 요청</strong><span className="result-count">{visibleRequests.length}</span></div>
        <div className="list-toolbar__controls">
          <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="요청 제목, 지역 검색" aria-label="요청 검색" /></label>
          <select aria-label="운영 형태 필터" value={type} onChange={(event) => setType(event.target.value)}><option>전체</option><option>교습소</option><option>공부방</option></select>
          <label className="toggle-filter"><input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} /><span />모집 중만</label>
        </div>
      </div>

      <div className="filter-chips" aria-label="요청 카테고리">
        {categories.map((item) => <button key={item} className={`filter-chip${category === item ? " filter-chip--active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {visibleRequests.length === 0 ? (
        <EmptyState icon={<Filter size={22} />} title="조건에 맞는 요청이 없어요" description="검색어나 필터를 바꾸어 다시 살펴보세요." action={<button className="button button--secondary" onClick={() => { setQuery(""); setCategory("전체"); setType("전체"); setOpenOnly(false); }}>필터 초기화</button>} />
      ) : (
        <div className="request-grid">
          {visibleRequests.map((request) => (
            <RequestCard key={request.id} request={request} owner={getUser(request.ownerId)} own={request.ownerId === currentUser?.id} onClick={() => navigate(`/requests/${request.id}`)} />
          ))}
        </div>
      )}
      <div className="demo-data-note"><span>i</span> 이 목록은 화면 확인을 위한 샘플 요청이며 새로고침하면 원래 데이터로 돌아갑니다.</div>
    </>
  );
}

function SparklesMini() {
  return <span className="sparkles-mini">✦</span>;
}

export function CreateRequestPage() {
  const { createRequest } = useDemo();
  const navigate = useNavigate();
  const [matchMode, setMatchMode] = useState<"single" | "multi">("single");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const capacity = matchMode === "single" ? 1 : Number(formData.get("capacity"));
    if (matchMode === "multi" && capacity !== 2 && capacity !== 3) {
      setError("복수 매칭은 정원을 2명 또는 3명으로 선택해 주세요.");
      setSubmitting(false);
      return;
    }
    const id = createRequest({
      title: String(formData.get("title")).trim(),
      category: String(formData.get("category")),
      description: String(formData.get("description")).trim(),
      region: `${String(formData.get("city"))} ${String(formData.get("district"))}`,
      schedule: String(formData.get("schedule")).trim(),
      expectations: String(formData.get("expectations")).trim(),
      matchMode,
      capacity,
    });
    setSubmitting(false);
    if (id) navigate(`/requests/${id}`);
    else setError("회원 시연 계정에서 요청을 만들어 주세요.");
  }

  return (
    <>
      <Link to="/requests" className="back-link"><ArrowLeft size={16} /> 요청 목록</Link>
      <PageHeading eyebrow="NEW COLLABORATION" title="새로운 협업 요청" description="함께하고 싶은 일과 조건을 구체적으로 적어주세요." />
      <div className="form-layout">
        <form className="request-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="form-section__heading"><span>01</span><div><h2>요청 개요</h2><p>함께할 원장님께 보여질 기본 정보예요.</p></div></div>
            <label className="field"><span>요청 제목 <b>*</b></span><input name="title" minLength={5} maxLength={80} required placeholder="예: 초등 수학 놀이 활동 자료를 함께 만들어요" /><small>5~80자 이내로 작성해 주세요.</small></label>
            <label className="field"><span>협업 분야 <b>*</b></span><select name="category" required defaultValue=""><option value="" disabled>분야를 선택해 주세요</option><option>수업 자료 공동 제작</option><option>공동 프로그램 운영</option><option>운영 노하우 공유</option><option>공간·자원 공유</option><option>기타</option></select></label>
            <label className="field"><span>요청 설명 <b>*</b></span><textarea name="description" minLength={30} maxLength={3000} required rows={5} placeholder="어떤 협업을 원하는지 자유롭게 설명해 주세요." /><small>30~3,000자 · 개인정보나 연락처는 적지 말아 주세요.</small></label>
          </section>
          <section className="form-section">
            <div className="form-section__heading"><span>02</span><div><h2>지역과 일정</h2><p>어떤 방식으로 언제 만날지 알려주세요.</p></div></div>
            <div className="field-pair">
              <label className="field"><span>시/도 <b>*</b></span><select name="city" required defaultValue=""><option value="" disabled>선택</option><option>서울시</option><option>경기도</option><option>인천시</option><option>부산시</option></select></label>
              <label className="field"><span>시/군/구 <b>*</b></span><input name="district" minLength={2} required placeholder="예: 마포구" /></label>
            </div>
            <label className="field"><span>일정 또는 가능 시기 <b>*</b></span><textarea name="schedule" minLength={5} maxLength={500} required rows={2} placeholder="예: 11월 중 2회, 평일 오전 온라인 미팅 가능" /><small>5~500자</small></label>
          </section>
          <section className="form-section">
            <div className="form-section__heading"><span>03</span><div><h2>지원 조건</h2><p>함께할 분에게 기대하는 점을 알려주세요.</p></div></div>
            <label className="field"><span>기대하는 조건 <b>*</b></span><textarea name="expectations" minLength={10} maxLength={1500} required rows={3} placeholder="어떤 경험이나 마음가짐을 가진 분과 함께하고 싶으신가요?" /><small>10~1,500자</small></label>
          </section>
          <section className="form-section">
            <div className="form-section__heading"><span>04</span><div><h2>매칭 방식과 정원</h2><p>함께할 원장님 수를 선택해 주세요.</p></div></div>
            <div className="mode-options">
              <button type="button" onClick={() => setMatchMode("single")} className={`mode-option${matchMode === "single" ? " mode-option--selected" : ""}`}><span className="mode-option__radio" /><span><strong>단일 매칭</strong><small>한 분과 깊이 있게 협업해요.</small></span><b>1명</b></button>
              <button type="button" onClick={() => setMatchMode("multi")} className={`mode-option${matchMode === "multi" ? " mode-option--selected" : ""}`}><span className="mode-option__radio" /><span><strong>복수 매칭</strong><small>여러 분과 함께 아이디어를 나눠요.</small></span><b>2~3명</b></button>
            </div>
            {matchMode === "multi" && <label className="field capacity-field"><span>함께할 인원 <b>*</b></span><select name="capacity" defaultValue=""><option value="" disabled>정원을 선택해 주세요</option><option value="2">2명</option><option value="3">3명</option></select></label>}
          </section>
          {error && <div className="form-alert" role="alert"><CircleAlert size={17} />{error}</div>}
          <div className="form-actions"><Link to="/requests" className="button button--secondary">취소</Link><button className="button button--primary button--large" type="submit" disabled={submitting}>{submitting ? "게시 중..." : "요청 게시하기"} <ArrowRight size={17} /></button></div>
        </form>
        <aside className="form-aside">
          <div className="form-aside__card"><span className="aside-icon"><ShieldCheckMini /></span><h3>안심하고 시작하세요</h3><p>지원 내용은 관리자 검토 후 요청 원장님께 전달돼요. 이메일이나 상세 연락처는 공개되지 않습니다.</p></div>
          <div className="form-aside__card form-aside__card--soft"><span className="aside-icon aside-icon--warm"><Users size={17} /></span><h3>매칭 정원 안내</h3><p>단일은 1명, 복수는 2~3명까지 선택할 수 있어요. 첫 지원 이후에는 정원을 바꿀 수 없습니다.</p></div>
          <div className="form-aside__card form-aside__card--check"><span className="check-line"><Check size={15} /> 연락처나 개인정보를 적지 않았나요?</span><span className="check-line"><Check size={15} /> 함께할 활동과 일정을 구체적으로 적었나요?</span></div>
          <p className="form-demo-note"><i /> 데모 입력값은 현재 브라우저 메모리에서만 사용돼요.</p>
        </aside>
      </div>
    </>
  );
}

function ShieldCheckMini() {
  return <span className="shield-check-mini">✓</span>;
}

export function RequestDetailPage() {
  const { id } = useParams();
  const { requests, applications, currentUser, applyToRequest, closeRequest } = useDemo();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const request = requests.find((item) => item.id === id);
  if (!request) return <NotFoundInline />;
  const owner = getUser(request.ownerId);
  const isOwner = currentUser?.id === owner.id;
  const ownApplication = applications.find((item) => item.requestId === request.id && item.applicantId === currentUser?.id);
  const remaining = Math.max(0, request.capacity - request.acceptedSlots);
  const appliedCount = applications.filter((item) => item.requestId === request.id).length;

  function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = applyToRequest(request!.id, message.trim());
    if (result) setError(result);
    else {
      setSuccess(true);
      setMessage("");
    }
  }

  return (
    <>
      <Link to="/requests" className="back-link"><ArrowLeft size={16} /> 요청 목록</Link>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-topline"><span className="category-label">{request.category}</span><StatusBadge status={request.status} /><span className="detail-date"><CalendarDays size={15} /> {formatDate(request.createdAt)} 게시</span></div>
          <h1 className="detail-title">{request.title}</h1>
          <div className="detail-owner">
            <Avatar user={owner} />
            <span><strong>{owner.businessName}</strong><small>{owner.operatingType} 원장 · {owner.name}</small></span>
            <span className="verified-chip"><Check size={13} /> 프로필 확인</span>
          </div>
          <div className="detail-stats">
            <div><span>매칭 방식</span><strong>{request.matchMode === "single" ? "단일 매칭" : "복수 매칭"}</strong></div>
            <div><span>수락 현황</span><strong>{request.acceptedSlots} / {request.capacity}명</strong></div>
            <div><span>남은 정원</span><strong>{remaining}명</strong></div>
            <div><span>지원</span><strong>{appliedCount}건</strong></div>
          </div>
          <section className="detail-section"><h2><FileText size={18} /> 어떤 협업을 원하시나요?</h2><p className="detail-copy">{request.description}</p></section>
          <section className="detail-section detail-section--split">
            <div><h2><MapPin size={18} /> 지역</h2><p>{request.region}</p></div>
            <div><h2><CalendarDays size={18} /> 일정</h2><p>{request.schedule}</p></div>
          </section>
          <section className="detail-section"><h2><Users size={18} /> 이런 분과 함께하고 싶어요</h2><div className="expectation-box">{request.expectations}</div></section>
          <section className="privacy-reminder"><ShieldCheckMini /><p><strong>개인정보를 안전하게 지켜요.</strong><br />지원 메시지에 전화번호나 이메일 등 개인 연락처를 적지 말아 주세요. 매칭 후 필요한 경우 직접 공유할 수 있어요.</p></section>
        </article>
        <aside className="detail-aside">
          <div className="apply-card">
            <div className="apply-card__heading"><span className="apply-icon"><Handshake size={19} /></span><div><strong>{isOwner ? "내가 등록한 요청" : "이 협업에 함께할까요?"}</strong><small>{isOwner ? "함께할 원장님을 기다리고 있어요." : "지원은 관리자 검토 후 전달돼요."}</small></div></div>
            <div className="apply-capacity"><div><span>현재 참여 인원</span><b>{request.acceptedSlots}<small> / {request.capacity}명</small></b></div><div className="progress-track"><span style={{ width: `${Math.min(100, request.acceptedSlots / request.capacity * 100)}%` }} /></div><small>{remaining ? `${remaining}자리 남음` : "정원이 모두 찼어요"}</small></div>
            {isOwner ? (
              <div className="apply-actions"><Link className="button button--primary button--full" to={`/me/requests/${request.id}/applications`}>지원자 확인하기 <ArrowRight size={16} /></Link>{request.status === "open" && <button className="button button--quiet button--full" onClick={() => { if (window.confirm("모집을 종료할까요? 미결정 지원도 함께 종료됩니다.")) closeRequest(request.id); }}>요청 마감</button>}</div>
            ) : currentUser?.role === "admin" ? (
              <div className="closed-request-note"><span>i</span><strong>관리자 시연 계정</strong><p>회원 시연 계정으로 요청에 지원할 수 있어요.</p></div>
            ) : success ? (
              <div className="success-box"><span><Check size={18} /></span><strong>지원이 등록됐어요.</strong><p>관리자 검토 후 요청 원장님께 전달됩니다.</p><Link to="/me/applications">내 지원 확인하기 <ArrowRight size={14} /></Link></div>
            ) : ownApplication ? (
              <div className="application-exists"><StatusBadge status={ownApplication.status} type="application" /><p>이 요청에 이미 지원했어요.</p><Link to="/me/applications" className="button button--secondary button--full">내 지원 상태 보기 <ArrowRight size={16} /></Link></div>
            ) : request.status === "open" ? (
              <form className="apply-form" onSubmit={submitApplication}>
                <label className="field"><span>지원 메시지 <b>*</b></span><textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={30} maxLength={1500} required rows={5} placeholder="함께하고 싶은 이유와 나눌 수 있는 경험을 적어주세요." /><small>{message.length} / 1,500자 · 연락처는 적지 말아 주세요.</small></label>
                <div className="apply-review-note"><ShieldCheckMini /><span>지원 메시지는 관리자 검토 후 요청 원장님에게 전달돼요.</span></div>
                {error && <div className="form-alert" role="alert"><CircleAlert size={16} />{error}</div>}
                <button className="button button--primary button--full" type="submit">지원 제출하기 <ArrowRight size={16} /></button>
              </form>
            ) : <div className="closed-request-note"><span>!</span><strong>{request.status === "closed_full" ? "정원이 마감되었습니다" : "요청 원장님이 모집을 종료했습니다"}</strong><p>현재는 새 지원을 받고 있지 않아요.</p></div>}
          </div>
          <div className="detail-tip"><MessageCircle size={17} /><p>수락된 매칭마다 별도의 후속 업무 공간이 만들어져요. 진행 기록은 각 매칭에서 따로 관리합니다.</p></div>
        </aside>
      </div>
    </>
  );
}

export function MyRequestsPage() {
  const { requests, applications, currentUser, closeRequest } = useDemo();
  const [filter, setFilter] = useState("전체");
  const owned = requests.filter((request) => request.ownerId === currentUser?.id);
  const filtered = owned.filter((request) => filter === "전체" || (filter === "모집 중" && request.status === "open") || (filter === "마감" && request.status !== "open"));
  const tabs = ["전체", "모집 중", "마감"];
  return (
    <>
      <PageHeading eyebrow="MY REQUESTS" title="내 요청" description="직접 만든 협업 요청과 지원 현황을 한곳에서 관리해요." action={<Link to="/requests/new" className="button button--primary"><Plus size={17} /> 요청 만들기</Link>} />
      <div className="metric-grid metric-grid--three">
        <MiniMetric label="전체 요청" value={owned.length} note="내가 등록한 요청" />
        <MiniMetric label="모집 중" value={owned.filter((item) => item.status === "open").length} note="새로운 지원을 기다려요" />
        <MiniMetric label="지원자" value={applications.filter((item) => owned.some((request) => request.id === item.requestId)).length} note="검토 포함 전체 지원" />
      </div>
      <div className="tabs-row">{tabs.map((item) => <button key={item} className={`text-tab${filter === item ? " text-tab--active" : ""}`} onClick={() => setFilter(item)}>{item}<span>{item === "전체" ? owned.length : owned.filter((request) => item === "모집 중" ? request.status === "open" : request.status !== "open").length}</span></button>)}</div>
      {filtered.length === 0 ? <EmptyState icon={<BookOpen size={22} />} title="아직 등록한 요청이 없어요" description="함께할 원장님을 찾는 첫 요청을 만들어보세요." action={<Link to="/requests/new" className="button button--primary">요청 만들기 <ArrowRight size={16} /></Link>} /> : (
        <div className="my-request-list">
          {filtered.map((request) => {
            const apps = applications.filter((item) => item.requestId === request.id);
            const waiting = apps.filter((item) => item.status === "admin_approved").length;
            return <article className="my-request-card" key={request.id}>
              <div className="my-request-card__main"><div className="my-request-card__status"><StatusBadge status={request.status} /><span>{request.category}</span><time>{formatDate(request.createdAt)} 게시</time></div><Link to={`/requests/${request.id}`} className="my-request-card__title">{request.title}</Link><div className="my-request-card__meta"><span><Users size={15} />수락 {request.acceptedSlots}/{request.capacity}</span><span><ClipboardList size={15} />지원 {apps.length}건</span>{waiting > 0 && <span className="waiting-meta"><i />원장 결정 {waiting}건</span>}</div></div>
              <div className="my-request-card__actions"><Link className="button button--primary button--small" to={`/me/requests/${request.id}/applications`}>지원자 관리 {waiting > 0 && <span className="button-count">{waiting}</span>} <ChevronRight size={15} /></Link>{request.status === "open" && <button className="button button--quiet button--small" onClick={() => { if (window.confirm("요청을 마감하면 모집이 다시 열리지 않습니다. 종료할까요?")) closeRequest(request.id); }}>마감하기</button>}</div>
            </article>;
          })}
        </div>
      )}
    </>
  );
}

export function OwnerApplicationsPage() {
  const { id } = useParams();
  const { requests, applications, currentUser, updateApplication } = useDemo();
  const request = requests.find((item) => item.id === id);
  const [notice, setNotice] = useState("");
  if (!request || request.ownerId !== currentUser?.id) return <NotFoundInline message="이 요청의 지원자 목록을 볼 수 없습니다." />;
  const requestApplications = applications.filter((item) => item.requestId === request.id);
  const waiting = requestApplications.filter((item) => item.status === "admin_approved");
  const remaining = request.capacity - request.acceptedSlots;

  function decide(applicationId: string, decision: "owner_accepted" | "owner_rejected") {
    const result = updateApplication(applicationId, decision);
    setNotice(result ?? (decision === "owner_accepted" ? "지원자를 수락하고 매칭을 만들었어요." : "지원을 종료했어요."));
  }

  return (
    <>
      <Link to="/me/requests" className="back-link"><ArrowLeft size={16} /> 내 요청</Link>
      <PageHeading eyebrow="APPLICANT MANAGEMENT" title="지원자 관리" description={request.title} />
      <div className="owner-app-summary">
        <div><span>매칭 정원</span><strong>{request.acceptedSlots} / {request.capacity}</strong><small>{remaining > 0 ? `${remaining}자리 남음` : "정원 마감"}</small></div>
        <div><span>관리자 승인 · 결정 필요</span><strong>{waiting.length}<small>명</small></strong></div>
        <div className="owner-app-summary__notice"><ShieldCheckMini /><span>관리자 승인 후 전달된 지원만 이곳에 표시됩니다. 관리자 내부 검토 메모는 공개되지 않아요.</span></div>
      </div>
      {notice && <div className="toast-inline" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")}>닫기</button></div>}
      {requestApplications.length === 0 ? <EmptyState icon={<Users size={22} />} title="아직 지원자가 없어요" description="요청을 살펴본 원장님이 지원하면 이곳에서 확인할 수 있어요." /> : (
        <div className="applicant-list">
          {requestApplications.map((application) => {
            const applicant = getUser(application.applicantId);
            const canDecide = application.status === "admin_approved" && request.status === "open" && remaining > 0;
            return <article className="applicant-card" key={application.id}>
              <div className="applicant-card__top"><div className="applicant-person"><Avatar user={applicant} /><div><strong>{applicant.businessName}</strong><span>{applicant.name} · {applicant.operatingType} · {applicant.region}</span></div></div><StatusBadge status={application.status} type="application" /></div>
              <p className="applicant-card__message">“{application.message}”</p>
              <div className="applicant-card__bottom"><span><Clock3 size={14} /> {formatDate(application.submittedAt)} 지원</span>{canDecide ? <div className="applicant-card__actions"><button className="button button--quiet button--small" onClick={() => decide(application.id, "owner_rejected")}>이번에는 거절</button><button className="button button--primary button--small" onClick={() => decide(application.id, "owner_accepted")}>수락하고 매칭 만들기 <ArrowRight size={15} /></button></div> : <span className="muted-caption">{application.status === "submitted" ? "관리자 검토 중" : "결정이 완료된 지원"}</span>}</div>
            </article>;
          })}
        </div>
      )}
    </>
  );
}

export function MyApplicationsPage() {
  const { applications, requests, currentUser, updateApplication } = useDemo();
  const [filter, setFilter] = useState("전체");
  const [notice, setNotice] = useState("");
  const mine = applications.filter((item) => item.applicantId === currentUser?.id);
  const filtered = mine.filter((item) => {
    if (filter === "전체") return true;
    if (filter === "진행 중") return ["submitted", "admin_approved"].includes(item.status);
    if (filter === "매칭 성사") return item.status === "owner_accepted";
    return ["admin_rejected", "owner_rejected", "withdrawn", "closed_capacity", "closed_by_owner"].includes(item.status);
  });
  const tabs = ["전체", "진행 중", "매칭 성사", "종료"];

  return (
    <>
      <PageHeading eyebrow="MY APPLICATIONS" title="내 지원" description="지원 이후 진행 상태와 다음 단계를 확인할 수 있어요." />
      <div className="status-legend"><span><i className="legend-dot legend-dot--blue" /> 관리자 검토 대기</span><ArrowRight size={14} /><span><i className="legend-dot legend-dot--green" /> 요청 원장 결정 대기</span><ArrowRight size={14} /><span><i className="legend-dot legend-dot--ink" /> 매칭 성사</span></div>
      <div className="tabs-row">{tabs.map((item) => <button key={item} className={`text-tab${filter === item ? " text-tab--active" : ""}`} onClick={() => setFilter(item)}>{item}<span>{item === "전체" ? mine.length : mine.filter((app) => item === "진행 중" ? ["submitted", "admin_approved"].includes(app.status) : item === "매칭 성사" ? app.status === "owner_accepted" : ["admin_rejected", "owner_rejected", "withdrawn", "closed_capacity", "closed_by_owner"].includes(app.status)).length}</span></button>)}</div>
      {notice && <div className="toast-inline" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")}>닫기</button></div>}
      {filtered.length === 0 ? <EmptyState icon={<ClipboardList size={22} />} title="아직 지원 내역이 없어요" description="관심 있는 협업 요청을 찾아 함께할 의사를 전해보세요." action={<Link to="/requests" className="button button--primary">요청 둘러보기 <ArrowRight size={16} /></Link>} /> : (
        <div className="application-list">
          {filtered.map((application) => {
            const request = requests.find((item) => item.id === application.requestId);
            if (!request) return null;
            const owner = getUser(request.ownerId);
            return <article className="application-card" key={application.id}>
              <div className="application-card__head"><span className="category-label">{request.category}</span><StatusBadge status={application.status} type="application" /></div>
              <Link to={`/requests/${request.id}`} className="application-card__title">{request.title} <ArrowUpRight size={15} /></Link>
              <div className="application-card__owner"><Avatar user={owner} size="sm" /><span>{owner.businessName} · {owner.region}</span><time>{formatDate(application.submittedAt)}</time></div>
              <p className="application-card__message">{application.message}</p>
              <div className="application-timeline">
                <span className={`timeline-step${application.status !== "submitted" ? " timeline-step--done" : " timeline-step--current"}`}><i />관리자 검토</span>
                <span className={`timeline-step${["owner_accepted", "owner_rejected"].includes(application.status) ? " timeline-step--done" : application.status === "admin_approved" ? " timeline-step--current" : ""}`}><i />요청 원장 결정</span>
                <span className={`timeline-step${application.status === "owner_accepted" ? " timeline-step--done" : ""}`}><i />매칭</span>
              </div>
              <div className="application-card__footer">
                {application.status === "owner_accepted" ? <Link className="button button--primary button--small" to="/me/matches">매칭 진행 보기 <ArrowRight size={15} /></Link> : ["submitted", "admin_approved"].includes(application.status) ? <button className="button button--quiet button--small" onClick={() => { if (window.confirm("지원 철회 후에는 같은 요청에 다시 지원할 수 없어요. 철회할까요?")) { updateApplication(application.id, "withdrawn"); setNotice("지원을 철회했어요."); } }}>지원 철회</button> : <span className="muted-caption">이 지원은 종료되었습니다.</span>}
              </div>
            </article>;
          })}
        </div>
      )}
    </>
  );
}

export function MatchesPage() {
  const { matches, requests, currentUser, applications } = useDemo();
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "canceled">("all");
  const myMatches = matches.filter((match) => {
    const application = applications.find((item) => item.id === match.applicationId);
    const request = requests.find((item) => item.id === match.requestId);
    return application?.applicantId === currentUser?.id || request?.ownerId === currentUser?.id;
  }).filter((match) => filter === "all" || match.status === filter);
  const tabs = [{ id: "all", label: "전체" }, { id: "active", label: "진행 중" }, { id: "completed", label: "완료" }, { id: "canceled", label: "중단" }] as const;

  return (
    <>
      <PageHeading eyebrow="MY MATCHES" title="내 매칭" description="수락된 협업과 매칭별 다음 할 일을 관리해요." />
      <div className="match-intro-banner"><span><Handshake size={20} /></span><div><strong>매칭마다 별도의 진행 공간이 있어요.</strong><p>같은 요청에서 여러 명과 매칭되더라도 각 매칭의 메모와 다음 할 일은 서로 독립적으로 관리돼요.</p></div></div>
      <div className="tabs-row">{tabs.map((tab) => <button key={tab.id} className={`text-tab${filter === tab.id ? " text-tab--active" : ""}`} onClick={() => setFilter(tab.id)}>{tab.label}<span>{tab.id === "all" ? myMatches.length : myMatches.filter((match) => match.status === tab.id).length}</span></button>)}</div>
      {myMatches.length === 0 ? <EmptyState icon={<Handshake size={22} />} title="아직 성사된 매칭이 없어요" description="수락된 지원이 생기면 매칭별 후속 업무를 여기서 관리할 수 있어요." action={<Link to="/requests" className="button button--primary">요청 찾기 <ArrowRight size={16} /></Link>} /> : (
        <div className="match-grid">
          {myMatches.map((match) => {
            const request = requests.find((item) => item.id === match.requestId);
            const application = applications.find((item) => item.id === match.applicationId);
            if (!request || !application) return null;
            const other = getUser(request.ownerId === currentUser?.id ? application.applicantId : request.ownerId);
            return <Link className="match-card" to={`/me/matches/${match.id}`} key={match.id}>
              <div className="match-card__top"><StatusBadge status={match.stage} type="stage" /><span>{match.status === "active" ? "진행 중" : match.status === "completed" ? "완료" : "중단"}</span></div>
              <strong className="match-card__title">{request.title}</strong>
              <div className="match-card__person"><Avatar user={other} size="sm" /><span><b>{other.businessName}</b><small>{other.operatingType} · {other.name}</small></span><ArrowUpRight size={16} /></div>
              <div className="match-card__task"><span>다음 할 일</span><strong>{match.nextTask || "다음 할 일이 정해지지 않았어요."}</strong>{match.dueDate && <small><CalendarDays size={14} /> {formatDate(match.dueDate)}</small>}</div>
              <div className="match-card__footer"><span><Clock3 size={14} /> {formatDate(match.createdAt)} 매칭</span><span>자세히 보기 <ChevronRight size={15} /></span></div>
            </Link>;
          })}
        </div>
      )}
    </>
  );
}

export function MatchDetailPage() {
  const { id } = useParams();
  const { matches, requests, applications, currentUser, updateMatch, addMatchNote } = useDemo();
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const match = matches.find((item) => item.id === id);
  if (!match) return <NotFoundInline message="매칭 정보를 찾을 수 없습니다." />;
  const request = requests.find((item) => item.id === match.requestId);
  const application = applications.find((item) => item.id === match.applicationId);
  if (!request || !application) return <NotFoundInline message="연결된 요청 또는 지원 정보를 찾을 수 없습니다." />;
  const isOwner = request.ownerId === currentUser?.id;
  const other = getUser(isOwner ? application.applicantId : request.ownerId);
  const canManage = isOwner && match.status === "active";
  const stageOptions: { value: FollowupStage; label: string }[] = [
    { value: "not_started", label: "연락 전" },
    { value: "contacted", label: "연락 완료" },
    { value: "in_progress", label: "진행 중" },
    { value: "completed", label: "완료" },
    { value: "canceled", label: "중단" },
  ];

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    addMatchNote(match!.id, note.trim());
    setNote("");
    setNotice("활동 메모를 추가했어요.");
  }

  function changeStage(stage: FollowupStage) {
    if (["completed", "canceled"].includes(stage) && !window.confirm(`${stage === "completed" ? "이 매칭을 완료" : "이 매칭을 중단"}할까요? 이후 상태는 되돌릴 수 없습니다.`)) return;
    updateMatch(match!.id, { stage, status: stage === "completed" ? "completed" : stage === "canceled" ? "canceled" : "active" });
  }

  return (
    <>
      <Link to="/me/matches" className="back-link"><ArrowLeft size={16} /> 내 매칭</Link>
      <PageHeading eyebrow="MATCH WORKSPACE" title="함께하는 진행 기록" description="이 기록은 이 매칭 안에서만 관리돼요." action={<StatusBadge status={match.stage} type="stage" />} />
      <div className="match-detail-layout">
        <div className="match-detail-main">
          <section className="match-detail-card match-overview">
            <div className="match-overview__head"><div><span className="eyebrow">MATCH OVERVIEW</span><h2>{request.title}</h2></div><span className={`match-status-label match-status-label--${match.status}`}>{match.status === "active" ? "● 진행 중" : match.status === "completed" ? "✓ 완료" : "Ⅱ 중단"}</span></div>
            <div className="match-participant"><Avatar user={other} /><div><strong>{other.businessName}</strong><span>{other.name} · {other.operatingType} · {other.region}</span></div><BusinessTypeIcon type={other.operatingType} /></div>
            <Link to={`/requests/${request.id}`} className="original-request-link"><FileText size={16} /> 원 요청 내용 보기 <ArrowUpRight size={15} /></Link>
          </section>
          <section className="match-detail-card followup-card">
            <div className="section-title-row"><div><span className="eyebrow">FOLLOW-UP</span><h2>다음 할 일</h2></div>{canManage ? <select className="stage-select" value={match.stage} onChange={(event) => changeStage(event.target.value as FollowupStage)} aria-label="후속 단계 변경">{stageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <StatusBadge status={match.stage} type="stage" />}</div>
            {canManage ? <div className="task-edit">
              <label className="field"><span>할 일</span><input value={match.nextTask} onChange={(event) => updateMatch(match.id, { nextTask: event.target.value })} maxLength={200} placeholder="다음에 함께할 일을 적어주세요." /><small>입력한 내용은 이 데모 화면에서만 유지됩니다.</small></label>
              <label className="field"><span>예정일 <small>(선택)</small></span><input type="date" value={match.dueDate} onChange={(event) => updateMatch(match.id, { dueDate: event.target.value })} /></label>
            </div> : <div className="task-readonly"><span>다음 할 일</span><strong>{match.nextTask || "다음 할 일이 정해지지 않았어요."}</strong>{match.dueDate && <small><CalendarDays size={14} /> {formatDate(match.dueDate)}</small>}<p>시연 데모에서는 요청 원장만 진행 단계를 변경할 수 있어요.</p></div>}
            {match.status !== "active" && <div className="match-ended-note"><Check size={16} />이 매칭은 {match.status === "completed" ? "완료" : "중단"}되어 읽기 전용입니다. 원 요청은 자동으로 다시 열리지 않아요.</div>}
          </section>
          <section className="match-detail-card timeline-card">
            <div className="section-title-row"><div><span className="eyebrow">ACTIVITY</span><h2>활동 기록</h2></div><span className="timeline-count">{match.notes.length + 1}개 기록</span></div>
            <div className="timeline">
              <div className="timeline-item"><span className="timeline-item__dot timeline-item__dot--blue" /><div><strong>매칭이 시작됐어요</strong><p>{request.title}에서 새로운 협업이 연결됐습니다.</p><time>{formatDate(match.createdAt)} · 매칭 생성</time></div></div>
              {match.notes.map((item, index) => <div className="timeline-item" key={`${match.id}-note-${index}`}><span className="timeline-item__dot" /><div><strong>활동 메모</strong><p>{item}</p><time>시연 세션에서 작성</time></div></div>)}
              {match.stage !== "not_started" && <div className="timeline-item"><span className="timeline-item__dot timeline-item__dot--green" /><div><strong>현재 단계 · {stageOptions.find((option) => option.value === match.stage)?.label}</strong><p>후속 진행 상태가 업데이트되었습니다.</p><time>가장 최근 상태</time></div></div>}
            </div>
            {match.status === "active" && <form className="activity-form" onSubmit={saveNote}><label className="sr-only" htmlFor="activity-note">새 활동 메모</label><textarea id="activity-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} placeholder="함께 나눈 내용을 짧게 기록해보세요." /><button className="button button--primary" type="submit" disabled={!note.trim()}>메모 추가 <ArrowRight size={15} /></button></form>}
          </section>
          {notice && <div className="toast-inline" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")}>닫기</button></div>}
        </div>
        <aside className="match-detail-aside">
          <div className="match-detail-card contact-placeholder"><span className="contact-placeholder__icon"><ShieldCheckMini /></span><h3>연락처 공유</h3><p>시연 버전에서는 실제 이메일이나 전화번호를 입력·저장하지 않도록 연락처 공유 기능을 비활성화했어요.</p><span className="disabled-feature">데모에서는 사용할 수 없음</span></div>
          <div className="match-detail-card independence-card"><span className="independence-icon"><Users size={18} /></span><h3>매칭별로 독립된 기록</h3><p>이 협업의 메모와 할 일은 다른 매칭 기록과 섞이지 않아요.</p><div><span>연결된 요청</span><strong>{request.title}</strong></div></div>
          <div className="match-partner-card"><Avatar user={other} /><div><span>함께하는 원장님</span><strong>{other.businessName}</strong><small>{other.operatingType} · {other.region}</small></div></div>
        </aside>
      </div>
    </>
  );
}

function MiniMetric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="mini-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function NotFoundInline({ message = "요청한 화면을 찾을 수 없습니다." }: { message?: string }) {
  return <div className="not-found-inline"><span>404</span><h2>화면을 찾을 수 없어요</h2><p>{message}</p><Link to="/requests" className="button button--primary">요청 목록으로 <ArrowRight size={16} /></Link></div>;
}
