// ============================================
// CORE ENTITIES
// ============================================

export interface Client {
  id: string;
  company_name: string;
  business_email: string;
  service_area: string;
  subscription_plan: 'starter' | 'growth' | 'pro';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  role: 'owner' | 'manager' | 'office_admin';
  phone: string;
  email: string;
}

// ============================================
// ELEVENLABS INTEGRATION
// Agent ID is the critical mapping key between
// ElevenLabs webhooks and our client records
// ============================================

export interface Agent {
  id: string;
  client_id: string;
  display_name: string;
  // CRITICAL: This is used to map incoming webhooks to clients
  elevenlabs_agent_id: string;
  linked_phone_numbers: string[];
  business_hours: string;
  escalation_notes: string;
  webhook_enabled: boolean;
  webhook_secret?: string;
  // Webhook connection status (set by backend)
  webhook_status: 'connected' | 'no_data' | 'error';
  last_webhook_received?: string;
  // Dynamic variables for ElevenLabs agent
  dynamic_variables?: Record<string, string>;
}

// ============================================
// CALL DATA (INGESTED VIA WEBHOOKS)
// All call data comes from ElevenLabs webhooks,
// NOT from direct API queries
// ============================================

export interface CallLog {
  id: string;
  client_id: string;
  agent_id: string;
  // Matches the call_id from ElevenLabs webhook
  elevenlabs_call_id: string;
  caller_phone: string;
  timestamp: string;
  // Duration in minutes (used for billing/usage)
  duration_minutes: number;
  transcript: string;
  summary: string;
  pest_issue?: string;
  status: 'completed' | 'escalated' | 'missed' | 'blocked';
  // Call outcome derived by backend
  call_outcome: 'appointment_scheduled' | 'info_provided' | 'escalated' | 'voicemail' | 'blocked_limit' | 'no_answer';
  // Metadata from webhook
  ingested_at: string;
}

// ============================================
// USERS & ROLES
// ============================================

export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'client';
  client_id?: string;
}

// Super admins: John and Altaf (founders)
export const SUPER_ADMIN_EMAILS = [
  'john@2ndwave.ai',
  'altaf@2ndwave.ai',
];

// ============================================
// SERVICE TYPES
// ============================================

export type PestService = 
  | 'ants'
  | 'termites'
  | 'roaches'
  | 'rodents'
  | 'mosquitoes'
  | 'bed_bugs'
  | 'wildlife'
  | 'other';

export const PEST_SERVICES: { value: PestService; label: string }[] = [
  { value: 'ants', label: 'Ants' },
  { value: 'termites', label: 'Termites' },
  { value: 'roaches', label: 'Roaches' },
  { value: 'rodents', label: 'Rodents' },
  { value: 'mosquitoes', label: 'Mosquitoes' },
  { value: 'bed_bugs', label: 'Bed Bugs' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'other', label: 'Other' },
];

export const SUBSCRIPTION_PLANS = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'pro', label: 'Pro' },
] as const;

export const CONTACT_ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'office_admin', label: 'Office Admin' },
] as const;

// ============================================
// PLAN & SUBSCRIPTION CONFIGURATION
// Plans are configured by Super Admins only
// ============================================

export interface PlanFeatures {
  // Core Features
  aiCallAnswering: boolean;
  callSummaries: boolean;
  callTranscripts: boolean;
  // Lead Handling
  newVsExistingDetection: boolean;
  leadTagging: boolean;
  emergencyEscalation: boolean;
  // Scheduling
  tentativeScheduling: boolean;
  calendarAvailabilityLookup: boolean;
  autoBookAppointments: boolean;
  // Infrastructure
  multiplePhoneNumbers: boolean;
  multipleAgentsPerClient: boolean;
  priorityProcessing: boolean;
}

export interface PlanVisibility {
  showUsageAndMinutes: boolean;
  showCallTranscripts: boolean;
  showLeadList: boolean;
  historicalDataDays: 30 | 90 | 'all';
  showEstimatedOverages: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  status: 'active' | 'inactive';
  // Usage Limits (enforced by backend)
  includedMinutes: number;
  overageAllowed: boolean;
  overageRate: number;
  hardLimit?: number;
  usageWarningThreshold: number;
  // Features
  features: PlanFeatures;
  // Visibility
  visibility: PlanVisibility;
  // Metadata
  createdAt: string;
  updatedAt: string;
  assignedClientsCount: number;
}

export interface ClientPlanAssignment {
  planId: string;
  planStartDate: string;
  overridesEnabled: boolean;
  overrides?: {
    includedMinutes?: number;
    features?: Partial<PlanFeatures>;
    usageLimits?: {
      overageAllowed?: boolean;
      overageRate?: number;
      hardLimit?: number;
    };
  };
}

// ============================================
// USAGE TRACKING (Backend Source of Truth)
// Backend tracks all usage and enforces limits
// UI only displays usage state
// ============================================

export interface ClientUsage {
  client_id: string;
  billing_period_start: string;
  billing_period_end: string;
  // Minutes tracked from ingested call data
  minutes_used: number;
  // Effective limits (plan + overrides applied)
  included_minutes: number;
  overage_allowed: boolean;
  hard_limit?: number;
  // Calculated by backend
  usage_percentage: number;
  overage_minutes: number;
  estimated_overage_cost: number;
  // Service state (controlled by backend)
  service_status: 'active' | 'warning' | 'limit_reached' | 'suspended';
  // When limit was reached (if applicable)
  limit_reached_at?: string;
  // Last updated by backend
  last_calculated_at: string;
}

// ============================================
// SERVICE STATUS
// Backend controls service availability
// ============================================

export type ServiceStatus = 'active' | 'warning' | 'limit_reached' | 'suspended';

export interface ClientServiceState {
  client_id: string;
  status: ServiceStatus;
  status_reason?: string;
  // Backend can temporarily override status
  manual_override?: {
    enabled_until: string;
    enabled_by: string;
    reason: string;
  };
  updated_at: string;
}

// ============================================
// AUDIT LOGS
// All admin actions are logged by backend
// Read-only in the UI
// ============================================

export type AuditAction = 
  | 'user_login'
  | 'user_logout'
  | 'client_created'
  | 'client_updated'
  | 'client_suspended'
  | 'client_reactivated'
  | 'plan_created'
  | 'plan_updated'
  | 'plan_assigned'
  | 'plan_changed'
  | 'override_applied'
  | 'override_removed'
  | 'agent_id_changed'
  | 'usage_limit_extended'
  | 'service_manually_enabled'
  | 'service_manually_suspended'
  | 'webhook_error_acknowledged';

export interface AuditLog {
  id: string;
  timestamp: string;
  // Who performed the action
  admin_id: string;
  admin_email: string;
  // What was affected
  entity_type: 'client' | 'plan' | 'agent' | 'usage' | 'user';
  entity_id: string;
  // The action taken
  action: AuditAction;
  // Short description of the action
  description: string;
  // IP address of the actor
  ip_address: string;
  // Details about the change
  details: {
    previous_value?: any;
    new_value?: any;
    reason?: string;
  };
}

// ============================================
// WEBHOOK PAYLOADS (from ElevenLabs)
// These are the expected webhook structures
// ============================================

export interface ElevenLabsWebhookPayload {
  event_type: 'call.completed' | 'call.started' | 'call.failed';
  agent_id: string;
  call_id: string;
  timestamp: string;
  data: {
    caller_phone?: string;
    duration_seconds?: number;
    transcript?: string;
    summary?: string;
    status?: string;
    metadata?: Record<string, any>;
  };
}

// Backend webhook handler response
export interface WebhookProcessingResult {
  success: boolean;
  client_id?: string;
  call_log_id?: string;
  error?: string;
  // Whether the call was blocked due to limits
  blocked_due_to_limit?: boolean;
}
