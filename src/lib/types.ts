export type FormType = "F" | "I" | "J" | "K";

export type EmployeeStatus = "active" | "exited" | "deceased";
export type EmploymentType = "FT" | "Contract" | "Intern";
export type DispatchStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "submitted"
  | "filed"
  | "overdue";
export type TriggerType = "auto" | "manual";

// ============================================================================
// EMPLOYEE — PII-free, matches 001_platform_schema.sql
// ============================================================================
export interface Employee {
  id: string;
  emp_id: string;
  email: string;
  first_name: string;
  last_name: string;
  nick_name: string | null;
  department: string;
  business_unit: string;
  designation: string;
  employment_type: EmploymentType;
  location: string;
  seating_location: string | null;
  reporting_manager_email: string | null;
  manager_id: string | null;
  date_of_joining: string;
  date_of_exit: string | null;
  onboarding_status: string | null;
  status: EmployeeStatus;
  slack_user_id: string | null;
  zoho_raw: Record<string, unknown>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function employeeName(e: Pick<Employee, "first_name" | "last_name">): string {
  return `${e.first_name} ${e.last_name}`.trim();
}

// ============================================================================
// ZOHO API RESPONSE — shape from the edge function
// PII fields are listed so the sync code knows what to strip.
// ============================================================================
export interface ZohoEmployee {
  email: string;
  first_name: string;
  last_name: string;
  emp_id: string;
  department: string;
  business_unit: string;
  designation: string;
  employment_type: string;
  reporting_manager_email: string;
  reporting_manager_raw: string;
  location: string;
  date_of_joining: string;
  date_of_exit: string;
  // Non-PII profile fields we keep in zoho_raw
  onboarding_status: string;
  nick_name: string;
  about_me: string;
  expertise: string;
  tags: string;
  seating_location: string;
  source_of_hire: string;
  total_experience: string;
  current_experience: string;
  gender: string;
  marital_status: string;
  // PII — stripped before writing to zoho_raw
  date_of_birth: string;
  work_phone: string;
  personal_mobile: string;
  personal_email: string;
  present_address: string;
  permanent_address: string;
  uan: string;
  pan: string;
  aadhaar: string;
}

export interface ZohoSyncResponse {
  total_active: number;
  fetched_at: string;
  employees: ZohoEmployee[];
}

// Keys stripped from zoho_raw before write. Keep in sync with sync route.
export const ZOHO_PII_KEYS: readonly (keyof ZohoEmployee)[] = [
  "date_of_birth",
  "work_phone",
  "personal_mobile",
  "personal_email",
  "present_address",
  "permanent_address",
  "uan",
  "pan",
  "aadhaar",
] as const;

// ============================================================================
// NOMINATIONS (Form F)
// ============================================================================
export interface Nominee {
  name: string;
  relation: string;
  share_pct: number;
  contact?: string;
  address?: string;
}

export interface Nomination {
  id: string;
  employee_id: string;
  is_active: boolean;
  nominees: Nominee[];
  submitted_at: string;
  form_file_url: string | null;
  created_at: string;
}

// ============================================================================
// FORM DISPATCHES
// ============================================================================
export interface FormDispatch {
  id: string;
  employee_id: string;
  automation_id: string;
  form_type: FormType;
  triggered_by: TriggerType;
  trigger_reason: string;
  sent_via: string;
  slack_message_ts: string | null;
  form_response_url: string | null;
  status: DispatchStatus;
  sent_at: string | null;
  acknowledged_at: string | null;
  submitted_at: string | null;
  filed_at: string | null;
  filed_by: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  next_reminder_at: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

// ============================================================================
// AUDIT EVENTS — cross-automation timeline
// ============================================================================
export interface AuditEvent {
  id: string;
  automation_id: string | null;
  action: string;
  actor_id: string | null;
  employee_id: string | null;
  dispatch_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// SYNC RESULT — returned by POST /api/sync/zoho and for GET status
// ============================================================================
export interface SyncResult {
  total_fetched: number;
  created: number;
  updated: number;
  exited: number;
  errors: number;
  synced_at: string;
}

export interface SyncStatusResponse {
  totalEmployees: number;
  lastSyncedAt: string | null;
}

// ============================================================================
// FORM CONFIGS
// ============================================================================
export interface FormConfig {
  type: FormType;
  name: string;
  fullName: string;
  description: string;
  trigger: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export const FORM_CONFIGS: Record<FormType, FormConfig> = {
  F: {
    type: "F",
    name: "Form F",
    fullName: "Nomination Form",
    description: "Employee nominates a family member to receive gratuity in case of death",
    trigger: "1-year service anniversary",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: "UserPlus",
  },
  I: {
    type: "I",
    name: "Form I",
    fullName: "Application for Payment by Employee",
    description: "Formal application by employee to claim gratuity amount",
    trigger: "Resignation/retirement after 5+ years",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: "FileText",
  },
  J: {
    type: "J",
    name: "Form J",
    fullName: "Application by Nominee",
    description: "Claim form used by the nominee if employee passes away in service",
    trigger: "Employee death (nomination exists)",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: "Users",
  },
  K: {
    type: "K",
    name: "Form K",
    fullName: "Application by Legal Heir",
    description: "Claim form for legal heir when no nomination exists",
    trigger: "Employee death (no nomination)",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    icon: "Scale",
  },
};

// ============================================================================
// GRATUITY — Form F dispatch workflow
// ============================================================================
export type GratuityFormType = "F" | "I" | "J" | "K";
export type GratuityTemplateKey =
  | "initial"
  | "reminder_1"
  | "reminder_2"
  | "reminder_3";
export type GratuityDispatchStatus = "pending" | "completed";

export interface GratuityDispatch {
  id: string;
  employee_id: string;
  form_type: GratuityFormType;
  status: GratuityDispatchStatus;
  completed_at: string | null;
  completed_by: string | null;
  completed_note: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  messages?: GratuityMessage[];
}

export interface GratuityMessageAttachment {
  slack_file_id?: string;
  url?: string;
  name: string;
  size?: number;
  mime_type?: string;
}

export interface GratuityMessage {
  id: string;
  dispatch_id: string;
  message_type: GratuityTemplateKey;
  sent_by: string | null;
  slack_channel: string | null;
  slack_ts: string | null;
  message_text: string;
  attachments: GratuityMessageAttachment[];
  error: string | null;
  sent_at: string;
  sender?: { id: string; name: string; email: string };
}

export interface TemplateAttachment {
  id: string;                // uuid
  name: string;              // original filename
  mime_type: string;
  size: number;              // bytes
  storage_path: string;      // path inside gratuity-template-attachments bucket
  uploaded_by: string | null;// user_profiles.id
  uploaded_at: string;
}

export interface GratuityTemplate {
  id: string;
  form_type: GratuityFormType;
  template_key: GratuityTemplateKey;
  body: string;
  default_attachments: TemplateAttachment[];
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface EligibleEmployee {
  id: string;
  emp_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  date_of_joining: string;
  service_years: number;        // floor(years since joining)
  dispatch_status: GratuityDispatchStatus | null; // null = no dispatch yet
  dispatch_id: string | null;
}

// ============================================================================
// PROFILE
// ============================================================================
export interface ProfilePayload {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  slack_bot_token_preview: string | null;
  slack_user_token_preview: string | null;
  slack_connected_as: { user_id: string; team_id: string; team: string } | null;
}

// ============================================================================
// DASHBOARD
// ============================================================================
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  formsPending: number;
  formsSent: number;
  formsCompleted: number;
  formsOverdue: number;
  upcomingAnniversaries: number;
}
