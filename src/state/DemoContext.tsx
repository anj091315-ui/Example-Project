import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  demoUsers,
  initialApplications,
  initialMatches,
  initialRequests,
} from "./sampleData";
import type {
  Application,
  ApplicationStatus,
  CollaborationRequest,
  DemoMatch,
  DemoRole,
} from "../types";

interface DemoContextValue {
  currentUser: (typeof demoUsers)[number] | null;
  requests: CollaborationRequest[];
  applications: Application[];
  matches: DemoMatch[];
  signIn: (role: DemoRole, userId?: string) => void;
  signOut: () => void;
  createRequest: (
    input: Omit<CollaborationRequest, "id" | "ownerId" | "createdAt" | "acceptedSlots" | "status">,
  ) => string;
  applyToRequest: (requestId: string, message: string) => string | null;
  updateApplication: (
    applicationId: string,
    status: Extract<ApplicationStatus, "admin_approved" | "admin_rejected" | "owner_accepted" | "owner_rejected" | "withdrawn">,
  ) => string | null;
  closeRequest: (requestId: string) => void;
  updateMatch: (matchId: string, update: Partial<Pick<DemoMatch, "stage" | "nextTask" | "dueDate" | "status">>) => void;
  addMatchNote: (matchId: string, note: string) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<(typeof demoUsers)[number] | null>(null);
  const [requests, setRequests] = useState(initialRequests);
  const [applications, setApplications] = useState(initialApplications);
  const [matches, setMatches] = useState(initialMatches);

  const signIn = useCallback((role: DemoRole, userId?: string) => {
    const user =
      role === "admin"
        ? demoUsers.find((candidate) => candidate.role === "admin")
        : demoUsers.find((candidate) => candidate.id === (userId ?? "owner-1"));
    setCurrentUser(user ?? null);
  }, []);

  const signOut = useCallback(() => setCurrentUser(null), []);

  const createRequest = useCallback(
    (
      input: Omit<
        CollaborationRequest,
        "id" | "ownerId" | "createdAt" | "acceptedSlots" | "status"
      >,
    ) => {
      if (!currentUser || currentUser.role !== "member") return "";
      const id = `request-${Date.now()}`;
      setRequests((existing) => [
        {
          ...input,
          id,
          ownerId: currentUser.id,
          createdAt: new Date().toISOString().slice(0, 10),
          acceptedSlots: 0,
          status: "open",
        },
        ...existing,
      ]);
      return id;
    },
    [currentUser],
  );

  const applyToRequest = useCallback(
    (requestId: string, message: string) => {
      if (!currentUser || currentUser.role !== "member") return "회원 시연 계정으로 이용해 주세요.";
      const request = requests.find((item) => item.id === requestId);
      if (!request || request.status !== "open") return "모집 중인 요청만 지원할 수 있습니다.";
      if (request.ownerId === currentUser.id) return "내 요청에는 지원할 수 없습니다.";
      if (applications.some((item) => item.requestId === requestId && item.applicantId === currentUser.id)) {
        return "이미 지원한 요청입니다.";
      }
      const application: Application = {
        id: `application-${Date.now()}`,
        requestId,
        applicantId: currentUser.id,
        message,
        status: "submitted",
        submittedAt: new Date().toISOString().slice(0, 10),
      };
      setApplications((existing) => [application, ...existing]);
      return null;
    },
    [applications, currentUser, requests],
  );

  const updateApplication = useCallback(
    (
      applicationId: string,
      status: Extract<
        ApplicationStatus,
        "admin_approved" | "admin_rejected" | "owner_accepted" | "owner_rejected" | "withdrawn"
      >,
    ) => {
      const application = applications.find((item) => item.id === applicationId);
      if (!application || !currentUser) return "지원 정보를 찾을 수 없습니다.";

      if (status === "admin_approved" || status === "admin_rejected") {
        if (currentUser.role !== "admin" || application.status !== "submitted") {
          return "관리자 검토가 가능한 지원이 아닙니다.";
        }
      }
      if (status === "owner_accepted" || status === "owner_rejected") {
        const request = requests.find((item) => item.id === application.requestId);
        if (
          currentUser.role !== "member" ||
          request?.ownerId !== currentUser.id ||
          application.status !== "admin_approved"
        ) {
          return "요청 원장이 결정할 수 있는 지원이 아닙니다.";
        }
        if (status === "owner_accepted" && request.acceptedSlots >= request.capacity) {
          return "남은 정원이 없습니다.";
        }
      }
      if (status === "withdrawn") {
        if (application.applicantId !== currentUser.id) return "본인의 지원만 철회할 수 있습니다.";
        if (!["submitted", "admin_approved"].includes(application.status)) {
          return "현재 상태에서는 지원을 철회할 수 없습니다.";
        }
      }

      setApplications((existing) =>
        existing.map((item) =>
          item.id === applicationId
            ? { ...item, status, ...(status === "admin_rejected" ? { reviewNote: "데모 운영팀 검토 결과" } : {}) }
            : item,
        ),
      );

      if (status === "owner_accepted") {
        const request = requests.find((item) => item.id === application.requestId);
        if (request) {
          const nextCount = request.acceptedSlots + 1;
          const full = nextCount >= request.capacity;
          setRequests((existing) =>
            existing.map((item) =>
              item.id === request.id
                ? { ...item, acceptedSlots: nextCount, status: full ? "closed_full" : item.status }
                : item,
            ),
          );
          if (full) {
            setApplications((existing) =>
              existing.map((item) =>
                item.requestId === request.id && item.id !== applicationId && item.status === "admin_approved"
                  ? { ...item, status: "closed_capacity" }
                  : item,
              ),
            );
          }
          setMatches((existing) => [
            {
              id: `match-${Date.now()}`,
              requestId: request.id,
              applicationId,
              status: "active",
              stage: "not_started",
              nextTask: "첫 연락 일정 정하기",
              dueDate: "",
              notes: [],
              createdAt: new Date().toISOString().slice(0, 10),
            },
            ...existing,
          ]);
        }
      }

      return null;
    },
    [applications, currentUser, requests],
  );

  const closeRequest = useCallback(
    (requestId: string) => {
      if (!currentUser) return;
      const request = requests.find((item) => item.id === requestId);
      if (!request || request.ownerId !== currentUser.id || request.status !== "open") return;
      setRequests((existing) =>
        existing.map((item) => (item.id === requestId ? { ...item, status: "closed_manual" } : item)),
      );
      setApplications((existing) =>
        existing.map((item) =>
          item.requestId === requestId && ["submitted", "admin_approved"].includes(item.status)
            ? { ...item, status: "closed_by_owner" }
            : item,
        ),
      );
    },
    [currentUser, requests],
  );

  const updateMatch = useCallback(
    (
      matchId: string,
      update: Partial<Pick<DemoMatch, "stage" | "nextTask" | "dueDate" | "status">>,
    ) => {
      setMatches((existing) =>
        existing.map((item) => (item.id === matchId ? { ...item, ...update } : item)),
      );
    },
    [],
  );

  const addMatchNote = useCallback((matchId: string, note: string) => {
    setMatches((existing) =>
      existing.map((item) =>
        item.id === matchId ? { ...item, notes: [...item.notes, note] } : item,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      requests,
      applications,
      matches,
      signIn,
      signOut,
      createRequest,
      applyToRequest,
      updateApplication,
      closeRequest,
      updateMatch,
      addMatchNote,
    }),
    [
      currentUser,
      requests,
      applications,
      matches,
      signIn,
      signOut,
      createRequest,
      applyToRequest,
      updateApplication,
      closeRequest,
      updateMatch,
      addMatchNote,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used within DemoProvider");
  return context;
}
