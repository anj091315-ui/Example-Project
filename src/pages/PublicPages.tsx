import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Handshake,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemo } from "../state/DemoContext";
import { demoUsers } from "../state/sampleData";
import { Avatar, Brand } from "../components/Ui";

export function LandingPage() {
  const { currentUser } = useDemo();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" aria-label="원장님 홈"><Brand /></Link>
        <nav aria-label="서비스 안내">
          <a href="#how-it-works">이용 방법</a>
          <a href="#for-who">누구를 위한 서비스인가요?</a>
        </nav>
        <div className="landing-header__actions">
          <Link className="button button--text" to={currentUser ? "/requests" : "/sign-in"}>{currentUser ? "워크스페이스" : "로그인"}</Link>
          <Link className="button button--primary button--small" to="/sign-up">무료로 둘러보기 <ArrowRight size={16} /></Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <span className="hero-kicker"><Sparkles size={15} /> 교습소 · 공부방 운영자를 위한 협업 연결</span>
            <h1>혼자 고민하던 일,<br /><span>함께라면 달라져요.</span></h1>
            <p>필요한 협업을 요청하고, 같은 마음으로 수업을 만드는 원장님과 연결돼요. 작은 아이디어부터 함께 시작해보세요.</p>
            <div className="landing-hero__actions">
              <Link className="button button--primary button--large" to="/sign-up">시연으로 시작하기 <ArrowRight size={18} /></Link>
              <Link className="button button--secondary button--large" to="/sign-in">로그인 <ArrowUpRight size={17} /></Link>
            </div>
            <div className="hero-assurance"><ShieldCheck size={16} /><span>무료 MVP 시연 · 결제 및 실계정 연결 없음</span></div>
            <div className="hero-social-proof">
              <div className="avatar-stack">
                {demoUsers.filter((user) => user.role === "member").slice(0, 3).map((user) => <Avatar key={user.id} user={user} size="sm" />)}
              </div>
              <span><strong>원장님들의 경험을 연결해요</strong><small>아직 검증된 성과나 이용자 수를 표시하지 않습니다.</small></span>
            </div>
          </div>
          <div className="landing-hero__visual" aria-label="협업 요청 예시">
            <div className="hero-orbit hero-orbit--one" />
            <div className="hero-orbit hero-orbit--two" />
            <div className="hero-note hero-note--top"><span className="hero-note__spark"><Sparkles size={17} /></span><span><strong>함께라서 가능한 일</strong><small>아이디어를 나누고, 연결해요</small></span></div>
            <div className="hero-dashboard-card">
              <div className="hero-dashboard-card__top"><span className="hero-mini-logo"><BookOpen size={16} /></span><span>모집 중인 협업 요청</span><span className="hero-live-dot" /></div>
              <h3>초등 수학 놀이 활동<br />자료를 함께 만들어봐요</h3>
              <div className="hero-card-owner"><span className="hero-card-avatar">다</span><span><strong>푸른나무 수학교습소</strong><small>교습소 · 서울 마포구</small></span></div>
              <div className="hero-capacity">
                <div className="hero-capacity__text"><span>함께할 원장님</span><strong>1 <small>/ 3명</small></strong></div>
                <div className="hero-capacity__bar"><span /></div>
                <small>2자리 남았어요</small>
              </div>
              <div className="hero-card-tags"><span>수업 자료 공동 제작</span><span>온라인 협업</span></div>
            </div>
            <div className="hero-note hero-note--bottom"><span className="hero-note__check"><Check size={16} /></span><span><strong>신뢰할 수 있는 연결</strong><small>관리자 검토 후 원장님이 결정</small></span></div>
            <div className="hero-decoration hero-decoration--sun" />
          </div>
          <a className="hero-scroll" href="#how-it-works"><span>서비스 알아보기</span><ArrowDown size={15} /></a>
        </section>

        <section className="landing-how section-container" id="how-it-works">
          <div className="section-intro">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>필요한 협업, 세 단계면 충분해요</h2>
            <p>원하는 협업을 올리고, 잘 맞는 원장님을 직접 선택해요.</p>
          </div>
          <div className="steps-grid">
            {[
              { n: "01", icon: <BookOpen size={22} />, title: "협업 요청 게시", text: "필요한 도움과 조건을 구체적으로 적어 함께할 원장님을 찾아요." },
              { n: "02", icon: <BadgeCheck size={22} />, title: "지원 검토", text: "관리자가 지원 내용을 먼저 확인해 요청 원장님께 전달해요." },
              { n: "03", icon: <Handshake size={22} />, title: "함께 시작하기", text: "요청 원장님이 직접 선택하고, 매칭별로 진행을 기록해요." },
            ].map((step) => (
              <article className="step-card" key={step.n}>
                <span className="step-card__number">{step.n}</span>
                <span className="step-card__icon">{step.icon}</span>
                <h3>{step.title}</h3><p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-audience" id="for-who">
          <div className="section-container audience-inner">
            <div><span className="eyebrow">FOR EDUCATORS</span><h2>좋은 수업을 만드는<br />원장님을 위한 공간</h2><p>혼자서는 막막했던 순간을 함께 나눌 수 있는 동료를 만나보세요.</p><Link className="button button--primary" to="/sign-up">데모 워크스페이스 둘러보기 <ArrowRight size={17} /></Link></div>
            <div className="audience-cards">
              <article><span className="audience-card__icon"><BookOpen size={20} /></span><div><strong>1인 교습소 원장님</strong><p>수업 자료와 경험을 나눌 파트너가 필요할 때</p></div><ChevronRight size={17} /></article>
              <article><span className="audience-card__icon audience-card__icon--warm"><UsersRound size={20} /></span><div><strong>공부방 운영자님</strong><p>동네에서 함께할 협업 동료를 찾고 싶을 때</p></div><ChevronRight size={17} /></article>
              <article><span className="audience-card__icon audience-card__icon--green"><CircleHelp size={20} /></span><div><strong>협업을 시작하는 누구나</strong><p>요청부터 진행까지 한 흐름으로 관리하고 싶을 때</p></div><ChevronRight size={17} /></article>
            </div>
          </div>
        </section>

        <section className="landing-bottom-cta">
          <span className="cta-decoration"><Sparkles size={19} /></span>
          <div><span className="eyebrow">YOUR NEXT COLLABORATION</span><h2>함께할 원장님을 만나보세요.</h2><p>샘플 데이터로 협업 요청과 운영 흐름을 둘러볼 수 있어요.</p></div>
          <Link className="button button--primary button--large" to="/sign-up">시연 시작하기 <ArrowRight size={18} /></Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand compact />
        <span>© 2026 원장님 MVP · 데모 서비스</span>
        <span className="footer-note"><LockKeyhole size={14} /> 개인정보 입력 없이 둘러볼 수 있어요.</span>
      </footer>
    </div>
  );
}

export function DemoAccessPage() {
  const [memberId, setMemberId] = useState("owner-1");
  const { signIn } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();

  const startDemo = (role: "member" | "admin", userId?: string) => {
    signIn(role, userId);
    navigate(role === "admin" ? "/admin/applications" : location.pathname === "/sign-up" ? "/onboarding" : "/requests");
  };

  return (
    <main className="access-page">
      <div className="access-top"><Link to="/"><Brand /></Link><span>원장님 MVP · 데모 버전</span></div>
      <div className="access-card">
        <div className="access-card__brand"><span className="access-card__icon"><BookOpen size={22} /></span><span className="eyebrow">WELCOME TO WONJANGNIM</span></div>
        <h1>시연 계정으로<br />워크스페이스를 둘러보세요.</h1>
        <p className="access-card__intro">가입 정보나 비밀번호 없이 역할을 선택해 주요 화면을 확인할 수 있어요.</p>
        <div className="access-safety"><ShieldCheck size={17} /><span>입력하신 정보를 저장하거나 서버로 전송하지 않습니다.</span></div>

        <div className="demo-account-picker">
          <label htmlFor="demo-member">회원 시연 계정</label>
          <div className="select-wrap">
            <select id="demo-member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              {demoUsers.filter((user) => user.role === "member").map((user) => (
                <option value={user.id} key={user.id}>{user.name} · {user.businessName}</option>
              ))}
            </select>
            <ChevronRight size={16} />
          </div>
          <button className="button button--primary button--full" onClick={() => startDemo("member", memberId)}>회원으로 둘러보기 <ArrowRight size={17} /></button>
        </div>

        <div className="access-divider"><span>또는</span></div>
        <button className="admin-demo-button" onClick={() => startDemo("admin")}><span><ShieldCheck size={18} /></span><span><strong>관리자 시연 계정</strong><small>지원 검토 대시보드로 이동</small></span><ArrowUpRight size={16} /></button>
        <div className="access-disclaimer"><LockKeyhole size={14} /><span>실제 로그인·회원가입·개인정보 처리는 구현되어 있지 않습니다.</span></div>
      </div>
      <Link to="/" className="back-home">← 메인으로 돌아가기</Link>
    </main>
  );
}
