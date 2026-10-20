import { Link, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AppShell } from "./components/AppShell";
import { useDemo } from "./state/DemoContext";
import { AdminQueuePage, AdminReviewDetailPage } from "./pages/AdminPages";
import {
  CreateRequestPage,
  MatchDetailPage,
  MatchesPage,
  MyApplicationsPage,
  MyRequestsPage,
  OwnerApplicationsPage,
  RequestDetailPage,
  RequestListPage,
} from "./pages/MemberPages";
import { DemoAccessPage, LandingPage } from "./pages/PublicPages";

function ProtectedArea() {
  const { currentUser } = useDemo();
  if (!currentUser) return <Navigate to="/sign-in" replace />;
  return <AppShell />;
}

function AdminOnly() {
  const { currentUser } = useDemo();
  if (currentUser?.role !== "admin") return <Navigate to="/requests" replace />;
  return <Outlet />;
}

function MemberOnly() {
  const { currentUser } = useDemo();
  if (currentUser?.role !== "member") return <Navigate to="/admin/applications" replace />;
  return <Outlet />;
}

function DemoOnboarding() {
  const { currentUser } = useDemo();
  const navigate = useNavigate();
  if (!currentUser) return <Navigate to="/sign-in" replace />;
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <span className="onboarding-icon"><UserRound size={22} /></span>
        <span className="eyebrow">PROFILE PREVIEW</span>
        <h1>프로필 미리보기</h1>
        <p>실제 개인정보 입력 없이 샘플 프로필로 화면을 둘러볼 수 있어요.</p>
        <div className="onboarding-profile">
          <strong>{currentUser.businessName}</strong>
          <span>{currentUser.operatingType} · {currentUser.region}</span>
          <p>{currentUser.introduction}</p>
        </div>
        <div className="demo-banner demo-banner--inline"><ShieldCheck size={17} />샘플 프로필은 서버로 전송되거나 저장되지 않습니다.</div>
        <button className="button button--primary button--full button--large" onClick={() => navigate("/requests")}>샘플 프로필로 둘러보기 <ArrowRight size={17} /></button>
        <Link className="onboarding-skip" to="/requests">나중에 둘러보기</Link>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="not-found-page">
      <span className="not-found-mark"><Sparkles size={22} /></span>
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>찾으시는 화면이 없어요.</h1>
      <p>주소가 바뀌었거나 아직 준비 중인 화면일 수 있어요.</p>
      <Link to="/" className="button button--primary">메인으로 돌아가기 <ArrowRight size={16} /></Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<DemoAccessPage />} />
      <Route path="/sign-up" element={<DemoAccessPage />} />
      <Route element={<ProtectedArea />}>
        <Route path="/requests" element={<RequestListPage />} />
        <Route path="/requests/:id" element={<RequestDetailPage />} />
        <Route element={<MemberOnly />}>
          <Route path="/onboarding" element={<DemoOnboarding />} />
          <Route path="/requests/new" element={<CreateRequestPage />} />
          <Route path="/me/requests" element={<MyRequestsPage />} />
          <Route path="/me/requests/:id/applications" element={<OwnerApplicationsPage />} />
          <Route path="/me/applications" element={<MyApplicationsPage />} />
          <Route path="/me/matches" element={<MatchesPage />} />
          <Route path="/me/matches/:id" element={<MatchDetailPage />} />
        </Route>
        <Route element={<AdminOnly />}>
          <Route path="/admin/applications" element={<AdminQueuePage />} />
          <Route path="/admin/applications/:id" element={<AdminReviewDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
