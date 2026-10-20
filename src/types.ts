export type DemoRole = "member" | "admin";
export type OperatingType = "교습소" | "공부방";
export type MatchMode = "single" | "multi";
export type RequestStatus = "open" | "closed_full" | "closed_manual";
export type ApplicationStatus =
  | "submitted"
  | "admin_approved"
  | "admin_rejected"
  | "owner_accepted"
  | "owner_rejected"
  | "withdrawn"
  | "closed_capacity"
  | "closed_by_owner";
export type MatchStatus = "active" | "completed" | "canceled";
export type FollowupStage =
  | "not_started"
  | "contacted"
  | "in_progress"
  | "completed"
  | "canceled";

export interface DemoUser {
  id: string;
  name: string;
  operatingType: OperatingType;
  businessName: string;
  region: string;
  introduction: string;
  role: DemoRole;
}

export interface CollaborationRequest {
  id: string;
  title: string;
  category: string;
  description: string;
  region: string;
  schedule: string;
  expectations: string;
  ownerId: string;
  matchMode: MatchMode;
  capacity: number;
  acceptedSlots: number;
  status: RequestStatus;
  createdAt: string;
}

export interface Application {
  id: string;
  requestId: string;
  applicantId: string;
  message: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewNote?: string;
}

export interface DemoMatch {
  id: string;
  requestId: string;
  applicationId: string;
  status: MatchStatus;
  stage: FollowupStage;
  nextTask: string;
  dueDate: string;
  notes: string[];
  createdAt: string;
}
