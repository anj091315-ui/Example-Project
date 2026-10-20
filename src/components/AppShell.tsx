import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  Compass,
  DoorOpen,
  Menu,
  Plus,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDemo } from "../state/DemoContext";
import { demoUsers } from "../state/sampleData";
import { Avatar, Brand } from "./Ui";

const memberLinks = [
  { to: "/requests", label: "요청 찾기", icon: Compass, end: true },
  { to: "/me/requests", label: "내 요청", icon: BookOpen },
  { to: "/me/applications", label: "내 지원", icon: ClipboardCheck },
  { to: "/me/matches", label: "내 매칭", icon: UsersRound },
];

export function AppShell() {
  const { currentUser, signOut, signIn, applications } = useDemo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  if (!currentUser) return null;

  const pendingReviews = applications.filter((application) => application.status === "submitted").length;
  const showNav = () => setMobileOpen(false);
  const endDemo = () => {
    signOut();
    window.location.assign("/");
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar${mobileOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <Brand />
          <button className="icon-button sidebar__close" onClick={showNav} aria-label="메뉴 닫기"><X size={19} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar"><BookOpen size={17} /></span>
          <span><strong>원장님 커뮤니티</strong><small>운영자 협업 공간</small></span>
          <ChevronDown size={15} />
        </div>
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <span className="sidebar-nav__label">WORKSPACE</span>
          {memberLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={showNav} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {to === "/me/applications" && <span className="nav-link__count">{applications.filter((item) => item.applicantId === currentUser.id && ["submitted", "admin_approved"].includes(item.status)).length}</span>}
            </NavLink>
          ))}
          {currentUser.role === "admin" && (
            <>
              <span className="sidebar-nav__label sidebar-nav__label--spaced">ADMIN</span>
              <NavLink to="/admin/applications" onClick={showNav} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
                <ShieldCheck size={18} strokeWidth={1.9} />
                <span>지원 검토</span>
                {pendingReviews > 0 && <span className="nav-link__count nav-link__count--accent">{pendingReviews}</span>}
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar__bottom">
          <div className="sidebar-help">
            <span className="sidebar-help__icon"><BriefcaseBusiness size={18} /></span>
            <strong>함께 만드는 동네의 연결</strong>
            <p>필요한 협업을 찾고, 작은 아이디어부터 나눠보세요.</p>
            <a href="/#how-it-works" onClick={showNav}>서비스 둘러보기 <ArrowUpRight size={14} /></a>
          </div>
          <button className="sidebar-logout" onClick={endDemo}>
            <DoorOpen size={17} /> 시연 종료
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-scrim" aria-label="메뉴 닫기" onClick={showNav} />}

      <div className="main-frame">
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div className="breadcrumb"><span>원장님</span><span className="breadcrumb__slash">/</span><strong>운영 워크스페이스</strong></div>
          <div className="topbar__right">
            <span className="demo-pill"><span /> DEMO MODE</span>
            <button className="icon-button topbar__notification" aria-label="알림 (데모)">
              <Bell size={18} /><i />
            </button>
            <div className="profile-switch">
              <Avatar user={currentUser} size="sm" />
              <label className="profile-switch__select">
                <span className="sr-only">시연 계정 선택</span>
                <select value={currentUser.id} onChange={(event) => {
                  const user = demoUsers.find((candidate) => candidate.id === event.target.value);
                  if (user) signIn(user.role, user.id);
                }}>
                  <optgroup label="회원 시연 계정">
                    {demoUsers.filter((user) => user.role === "member").map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </optgroup>
                  {demoUsers.filter((user) => user.role === "admin").map((user) => (
                    <option key={user.id} value={user.id}>{user.name} · 관리자</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <button className="topbar__logout" onClick={endDemo}>나가기</button>
          </div>
        </header>
        <div className="demo-banner">
          <span className="demo-banner__mark">i</span>
          <span><strong>시연 환경</strong> · 샘플 데이터만 사용합니다. 실제 계정·개인정보·결제·데이터베이스는 연결되어 있지 않습니다.</span>
          <button onClick={endDemo}>시연 종료</button>
        </div>
        <main className="main-content"><Outlet /></main>
        <nav className="mobile-tabs" aria-label="모바일 메뉴">
          {memberLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={showNav} className={({ isActive }) => `mobile-tabs__link${isActive ? " mobile-tabs__link--active" : ""}`}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="mobile-create" onClick={() => navigate("/requests/new")} aria-label="요청 만들기"><Plus size={22} /></button>
      </div>
    </div>
  );
}
