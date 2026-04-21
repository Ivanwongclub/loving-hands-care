import type { Enums } from "@/integrations/supabase/types";

export type TaskType = Enums<"task_type">;
export type ICPStatus = Enums<"icp_status">;

export interface CareGoal {
  goal: string;
  target: string;
  review_date: string;
}

export interface RiskAssessment {
  area: string;
  level: "LOW" | "MEDIUM" | "HIGH";
  mitigation: string;
}

export interface TaskRule {
  type: TaskType;
  title: string;
  frequency: "DAILY" | "TWICE_DAILY" | "WEEKLY" | "AS_NEEDED";
  times: string[];
}

export interface ICPContent {
  care_goals: CareGoal[];
  risk_assessments: RiskAssessment[];
  task_rules: TaskRule[];
  special_instructions: string;
}

export const EMPTY_CONTENT: ICPContent = {
  care_goals: [],
  risk_assessments: [],
  task_rules: [],
  special_instructions: "",
};

export const ICP_STATUS_TONE: Record<ICPStatus, "neutral" | "warning" | "success" | "error"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  SUPERSEDED: "neutral",
  REJECTED: "error",
};
