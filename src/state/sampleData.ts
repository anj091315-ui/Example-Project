import type {
  Application,
  CollaborationRequest,
  DemoMatch,
  DemoUser,
} from "../types";

export const demoUsers: DemoUser[] = [
  {
    id: "owner-1",
    name: "다은 원장",
    operatingType: "교습소",
    businessName: "푸른나무 수학교습소",
    region: "서울시 마포구",
    introduction: "아이들의 속도에 맞춘 초등 수학 수업을 운영하고 있어요.",
    role: "member",
  },
  {
    id: "owner-2",
    name: "민준 원장",
    operatingType: "공부방",
    businessName: "한걸음 공부방",
    region: "서울시 서대문구",
    introduction: "초등 저학년 독서와 글쓰기 수업을 함께 나눠요.",
    role: "member",
  },
  {
    id: "owner-3",
    name: "서연 원장",
    operatingType: "교습소",
    businessName: "봄빛 영어교습소",
    region: "경기도 고양시",
    introduction: "즐겁게 말하고 자신 있게 표현하는 영어 수업을 만듭니다.",
    role: "member",
  },
  {
    id: "owner-4",
    name: "지호 원장",
    operatingType: "공부방",
    businessName: "차근차근 배움터",
    region: "서울시 은평구",
    introduction: "작은 공부방의 경험과 자료를 나누고 싶습니다.",
    role: "member",
  },
  {
    id: "admin-1",
    name: "운영팀",
    operatingType: "교습소",
    businessName: "원장님 운영팀",
    region: "전국",
    introduction: "협업 연결을 안전하게 돕는 운영 관리자입니다.",
    role: "admin",
  },
];

export const initialRequests: CollaborationRequest[] = [
  {
    id: "request-1",
    title: "초등 수학 놀이 활동 자료를 함께 만들어봐요",
    category: "수업 자료 공동 제작",
    description:
      "초등 1~3학년이 수 개념을 자연스럽게 익힐 수 있는 놀이형 활동 자료를 함께 기획하고 싶어요. 각자 수업에서 사용해 본 아이디어를 나누고, 작은 자료집으로 정리해보면 좋겠습니다.",
    region: "서울시 마포구",
    schedule: "11월 중 2회 온라인 미팅, 평일 오전 조율 가능",
    expectations: "초등 수학 수업 경험이 있고 아이디어를 편하게 나눌 수 있는 분",
    ownerId: "owner-1",
    matchMode: "multi",
    capacity: 3,
    acceptedSlots: 1,
    status: "open",
    createdAt: "2026-10-19",
  },
  {
    id: "request-2",
    title: "동네 독서 모임을 함께 운영할 원장님을 찾아요",
    category: "공동 프로그램 운영",
    description:
      "초등학생을 위한 월 1회 독서 모임을 동네에서 열어보려 합니다. 책 선정과 활동 진행을 함께 나누고, 각 공간에서 번갈아 모임을 진행할 파트너를 찾고 있어요.",
    region: "서울시 서대문구",
    schedule: "11월 첫째 주 시작 희망, 월 1회 토요일 오전",
    expectations: "아이들과 책 이야기를 즐기고 작은 모임을 함께 준비할 수 있는 분",
    ownerId: "owner-2",
    matchMode: "single",
    capacity: 1,
    acceptedSlots: 0,
    status: "open",
    createdAt: "2026-10-18",
  },
  {
    id: "request-3",
    title: "영어 그림책 수업 아이디어를 나눠요",
    category: "수업 자료 공동 제작",
    description:
      "영어 그림책 한 권으로 여러 차시 수업을 구성해보려 해요. 읽기 전·중·후 활동과 간단한 만들기 아이디어를 서로 나누고, 수업 후기도 함께 정리할 분을 기다립니다.",
    region: "경기도 고양시",
    schedule: "온라인으로 격주 수요일 저녁",
    expectations: "초등 영어 그림책 수업 경험 또는 관심이 있는 분",
    ownerId: "owner-3",
    matchMode: "multi",
    capacity: 2,
    acceptedSlots: 0,
    status: "open",
    createdAt: "2026-10-17",
  },
  {
    id: "request-4",
    title: "공부방 운영 노하우 소모임 (정원 마감)",
    category: "운영 노하우 공유",
    description:
      "작은 공부방을 운영하며 쌓은 수업 준비와 학부모 소통 경험을 나누는 모임입니다. 이번 모임의 참여 인원이 모두 정해졌습니다.",
    region: "서울시 은평구",
    schedule: "11월 둘째 주 금요일 오후",
    expectations: "소규모 학습 공간 운영 경험을 나눌 수 있는 원장님",
    ownerId: "owner-4",
    matchMode: "multi",
    capacity: 2,
    acceptedSlots: 2,
    status: "closed_full",
    createdAt: "2026-10-16",
  },
];

export const initialApplications: Application[] = [
  {
    id: "application-1",
    requestId: "request-1",
    applicantId: "owner-2",
    message:
      "저도 초등 저학년 수업에서 교구를 자주 활용해요. 아이들이 즐거워했던 활동들을 함께 나누고 싶습니다.",
    status: "owner_accepted",
    submittedAt: "2026-10-19",
  },
  {
    id: "application-2",
    requestId: "request-1",
    applicantId: "owner-3",
    message:
      "수학 그림책을 활용한 활동에 관심이 많아요. 준비와 기록을 꼼꼼히 함께하겠습니다.",
    status: "admin_approved",
    submittedAt: "2026-10-20",
  },
  {
    id: "application-3",
    requestId: "request-2",
    applicantId: "owner-1",
    message:
      "아이들과 그림책 읽는 시간을 운영하고 있습니다. 즐거운 모임을 같이 만들고 싶어요.",
    status: "submitted",
    submittedAt: "2026-10-20",
  },
  {
    id: "application-4",
    requestId: "request-3",
    applicantId: "owner-4",
    message:
      "영어 그림책 수업을 시작하는 단계라 다양한 관점을 배우고 자료도 보태고 싶습니다.",
    status: "admin_rejected",
    submittedAt: "2026-10-18",
    reviewNote: "이번 요청의 수업 일정과 맞는 지원을 먼저 연결해 드렸습니다.",
  },
];

export const initialMatches: DemoMatch[] = [
  {
    id: "match-1",
    requestId: "request-1",
    applicationId: "application-1",
    status: "active",
    stage: "contacted",
    nextTask: "활동 자료 주제 3가지씩 준비하기",
    dueDate: "2026-10-28",
    notes: ["첫 온라인 미팅 일정을 조율하기로 했어요."],
    createdAt: "2026-10-19",
  },
];
