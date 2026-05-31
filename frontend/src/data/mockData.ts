import { 
  Client, 
  CallLog, 
  Agent, 
  Contact, 
  Plan, 
  ClientPlanAssignment,
  ClientUsage,
  ClientServiceState,
  AuditLog 
} from '@/types';

// ============================================
// MOCK DATA - FOR DEMO PURPOSES
// In production, all data comes from backend database
// ============================================

export const mockClients: Client[] = [
  {
    id: '1',
    company_name: 'Apex Pest Control',
    business_email: 'info@apexpest.com',
    service_area: 'Austin, TX',
    subscription_plan: 'pro',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: '2',
    company_name: 'BugBusters LLC',
    business_email: 'contact@bugbusters.com',
    service_area: 'Dallas, TX',
    subscription_plan: 'growth',
    status: 'active',
    created_at: '2024-02-20T14:30:00Z',
    updated_at: '2024-02-20T14:30:00Z',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: '3',
    company_name: 'Green Shield Exterminators',
    business_email: 'hello@greenshield.com',
    service_area: 'Houston, TX',
    subscription_plan: 'starter',
    status: 'suspended',
    created_at: '2024-03-01T09:15:00Z',
    updated_at: '2024-03-10T11:00:00Z',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: '4',
    company_name: 'SafeHome Pest Solutions',
    business_email: 'info@safehome.com',
    service_area: 'San Antonio, TX',
    subscription_plan: 'pro',
    status: 'active',
    created_at: '2024-03-15T11:00:00Z',
    updated_at: '2024-03-15T11:00:00Z',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: '5',
    company_name: 'Elite Exterminators',
    business_email: 'contact@elite.com',
    service_area: 'Fort Worth, TX',
    subscription_plan: 'growth',
    status: 'active',
    created_at: '2024-04-01T08:00:00Z',
    updated_at: '2024-04-01T08:00:00Z',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
  },
];

// ============================================
// AGENT MAPPING (Critical for webhook routing)
// elevenlabs_agent_id → client_id mapping
// ============================================

export const mockAgents: Agent[] = [
  {
    id: '1',
    client_id: '1',
    display_name: 'Apex AI Receptionist',
    elevenlabs_agent_id: 'agent_abc123',
    linked_phone_numbers: ['+1 (512) 555-0101'],
    business_hours: 'Mon-Fri 8AM-6PM, Sat 9AM-2PM',
    escalation_notes: 'Urgent calls to owner at +1 (512) 555-0102',
    webhook_enabled: true,
    webhook_status: 'connected',
    last_webhook_received: '2025-01-15T09:30:00Z',
    dynamic_variables: {
      company_name: 'Apex Pest Control',
      service_area: 'Austin metro area',
    },
  },
  {
    id: '2',
    client_id: '2',
    display_name: 'BugBusters Virtual Receptionist',
    elevenlabs_agent_id: 'agent_def456',
    linked_phone_numbers: ['+1 (214) 555-0201'],
    business_hours: 'Mon-Sat 7AM-7PM',
    escalation_notes: 'After hours: voicemail only',
    webhook_enabled: true,
    webhook_status: 'connected',
    last_webhook_received: '2025-01-15T14:00:00Z',
    dynamic_variables: {
      company_name: 'BugBusters LLC',
    },
  },
  {
    id: '3',
    client_id: '3',
    display_name: 'Green Shield Receptionist',
    elevenlabs_agent_id: 'agent_ghi789',
    linked_phone_numbers: ['+1 (713) 555-0301'],
    business_hours: 'Mon-Fri 9AM-5PM',
    escalation_notes: '',
    webhook_enabled: true,
    webhook_status: 'error',
    last_webhook_received: '2025-01-10T11:00:00Z',
  },
  {
    id: '4',
    client_id: '4',
    display_name: 'SafeHome AI Agent',
    elevenlabs_agent_id: 'agent_jkl012',
    linked_phone_numbers: ['+1 (210) 555-0401', '+1 (210) 555-0402'],
    business_hours: '24/7',
    escalation_notes: 'Emergency line: +1 (210) 555-0499',
    webhook_enabled: true,
    webhook_status: 'connected',
    last_webhook_received: '2025-01-15T16:45:00Z',
  },
  {
    id: '5',
    client_id: '5',
    display_name: 'Elite AI Receptionist',
    elevenlabs_agent_id: 'agent_mno345',
    linked_phone_numbers: ['+1 (817) 555-0501'],
    business_hours: 'Mon-Fri 8AM-6PM',
    escalation_notes: '',
    webhook_enabled: true,
    webhook_status: 'no_data',
  },
];

// Helper function to map agent_id to client_id (simulates backend logic)
export function mapAgentToClient(elevenlabs_agent_id: string): string | null {
  const agent = mockAgents.find(a => a.elevenlabs_agent_id === elevenlabs_agent_id);
  return agent?.client_id ?? null;
}

export const mockContacts: Contact[] = [
  {
    id: '1',
    client_id: '1',
    name: 'John Martinez',
    role: 'owner',
    phone: '+1 (512) 555-0102',
    email: 'john@apexpest.com',
  },
  {
    id: '2',
    client_id: '2',
    name: 'Sarah Chen',
    role: 'manager',
    phone: '+1 (214) 555-0202',
    email: 'sarah@bugbusters.com',
  },
];

// ============================================
// CALL LOGS (Ingested from ElevenLabs webhooks)
// All call data comes via webhooks, NOT direct API calls
// ============================================

export const mockCallLogs: CallLog[] = [
  {
    id: '1',
    client_id: '1',
    agent_id: '1',
    elevenlabs_call_id: 'call_001',
    caller_phone: '+1 (512) 555-1234',
    timestamp: '2025-01-15T09:30:00Z',
    duration_minutes: 4.5,
    transcript: 'Customer: Hi, I have a problem with ants in my kitchen. AI: I understand, that can be frustrating. Let me help you schedule a service appointment...',
    summary: 'Customer reported ant infestation in kitchen. Scheduled service for tomorrow at 2 PM.',
    pest_issue: 'Ants',
    status: 'completed',
    call_outcome: 'appointment_scheduled',
    ingested_at: '2025-01-15T09:35:00Z',
  },
  {
    id: '2',
    client_id: '1',
    agent_id: '1',
    elevenlabs_call_id: 'call_002',
    caller_phone: '+1 (512) 555-5678',
    timestamp: '2025-01-15T11:15:00Z',
    duration_minutes: 2.8,
    transcript: 'Customer: We have termites! This is urgent! AI: I understand the urgency. Let me connect you with our emergency service line...',
    summary: 'Emergency termite report. Customer was escalated to owner for immediate response.',
    pest_issue: 'Termites',
    status: 'escalated',
    call_outcome: 'escalated',
    ingested_at: '2025-01-15T11:20:00Z',
  },
  {
    id: '3',
    client_id: '2',
    agent_id: '2',
    elevenlabs_call_id: 'call_003',
    caller_phone: '+1 (214) 555-9876',
    timestamp: '2025-01-15T14:00:00Z',
    duration_minutes: 5.2,
    transcript: 'Customer: I think I saw a mouse in my garage. AI: Thank you for calling. I can help you schedule a rodent inspection...',
    summary: 'Rodent sighting in garage. Inspection scheduled for next week.',
    pest_issue: 'Rodents',
    status: 'completed',
    call_outcome: 'appointment_scheduled',
    ingested_at: '2025-01-15T14:08:00Z',
  },
  {
    id: '4',
    client_id: '1',
    agent_id: '1',
    elevenlabs_call_id: 'call_004',
    caller_phone: '+1 (512) 555-4321',
    timestamp: '2025-01-14T16:45:00Z',
    duration_minutes: 0.5,
    transcript: '',
    summary: 'Missed call - no voicemail left.',
    status: 'missed',
    call_outcome: 'no_answer',
    ingested_at: '2025-01-14T16:46:00Z',
  },
  {
    id: '5',
    client_id: '3',
    agent_id: '3',
    elevenlabs_call_id: 'call_005',
    caller_phone: '+1 (713) 555-1111',
    timestamp: '2025-01-10T10:00:00Z',
    duration_minutes: 0,
    transcript: '',
    summary: 'Call blocked - usage limit reached.',
    status: 'blocked',
    call_outcome: 'blocked_limit',
    ingested_at: '2025-01-10T10:00:00Z',
  },
];

// ============================================
// USAGE TRACKING (Calculated by backend)
// Backend is source of truth for all usage data
// ============================================

export const mockClientUsage: Record<string, ClientUsage> = {
  '1': {
    client_id: '1',
    billing_period_start: '2025-01-01T00:00:00Z',
    billing_period_end: '2025-01-31T23:59:59Z',
    minutes_used: 245.5,
    included_minutes: 1000,
    overage_allowed: true,
    usage_percentage: 24.55,
    overage_minutes: 0,
    estimated_overage_cost: 0,
    service_status: 'active',
    last_calculated_at: '2025-01-15T12:00:00Z',
  },
  '2': {
    client_id: '2',
    billing_period_start: '2025-01-01T00:00:00Z',
    billing_period_end: '2025-01-31T23:59:59Z',
    minutes_used: 320.8,
    included_minutes: 400, // Override applied
    overage_allowed: true,
    usage_percentage: 80.2,
    overage_minutes: 0,
    estimated_overage_cost: 0,
    service_status: 'warning',
    last_calculated_at: '2025-01-15T12:00:00Z',
  },
  '3': {
    client_id: '3',
    billing_period_start: '2025-01-01T00:00:00Z',
    billing_period_end: '2025-01-31T23:59:59Z',
    minutes_used: 100,
    included_minutes: 100,
    overage_allowed: false,
    hard_limit: 100,
    usage_percentage: 100,
    overage_minutes: 0,
    estimated_overage_cost: 0,
    service_status: 'limit_reached',
    limit_reached_at: '2025-01-10T10:00:00Z',
    last_calculated_at: '2025-01-15T12:00:00Z',
  },
  '4': {
    client_id: '4',
    billing_period_start: '2025-01-01T00:00:00Z',
    billing_period_end: '2025-01-31T23:59:59Z',
    minutes_used: 580.2,
    included_minutes: 1000,
    overage_allowed: true,
    usage_percentage: 58.02,
    overage_minutes: 0,
    estimated_overage_cost: 0,
    service_status: 'active',
    last_calculated_at: '2025-01-15T12:00:00Z',
  },
  '5': {
    client_id: '5',
    billing_period_start: '2025-01-01T00:00:00Z',
    billing_period_end: '2025-01-31T23:59:59Z',
    minutes_used: 0,
    included_minutes: 300,
    overage_allowed: true,
    usage_percentage: 0,
    overage_minutes: 0,
    estimated_overage_cost: 0,
    service_status: 'active',
    last_calculated_at: '2025-01-15T12:00:00Z',
  },
};

// ============================================
// SERVICE STATE (Backend controls availability)
// ============================================

export const mockClientServiceState: Record<string, ClientServiceState> = {
  '1': {
    client_id: '1',
    status: 'active',
    updated_at: '2025-01-15T12:00:00Z',
  },
  '2': {
    client_id: '2',
    status: 'warning',
    status_reason: 'Usage at 80% of included minutes',
    updated_at: '2025-01-15T12:00:00Z',
  },
  '3': {
    client_id: '3',
    status: 'limit_reached',
    status_reason: 'Monthly usage limit reached. New calls are being blocked.',
    updated_at: '2025-01-10T10:00:00Z',
  },
  '4': {
    client_id: '4',
    status: 'active',
    updated_at: '2025-01-15T12:00:00Z',
  },
  '5': {
    client_id: '5',
    status: 'active',
    updated_at: '2025-01-15T12:00:00Z',
  },
};

// ============================================
// AUDIT LOGS (Read-only in UI)
// All admin actions logged by backend
// ============================================

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit_001',
    timestamp: '2025-01-20T09:15:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'user',
    entity_id: 'admin_1',
    action: 'user_login',
    description: 'User logged into the admin portal',
    ip_address: '192.168.1.100',
    details: {
      reason: 'Successful authentication via email/password',
    },
  },
  {
    id: 'audit_002',
    timestamp: '2025-01-19T18:30:00Z',
    admin_id: 'admin_2',
    admin_email: 'altaf@2ndwave.ai',
    entity_type: 'user',
    entity_id: 'admin_2',
    action: 'user_logout',
    description: 'User logged out of the admin portal',
    ip_address: '10.0.0.55',
    details: {
      reason: 'Session ended normally',
    },
  },
  {
    id: 'audit_003',
    timestamp: '2025-01-19T14:00:00Z',
    admin_id: 'admin_2',
    admin_email: 'altaf@2ndwave.ai',
    entity_type: 'user',
    entity_id: 'admin_2',
    action: 'user_login',
    description: 'User logged into the admin portal',
    ip_address: '10.0.0.55',
    details: {
      reason: 'Successful authentication via email/password',
    },
  },
  {
    id: 'audit_004',
    timestamp: '2025-01-18T16:45:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'client',
    entity_id: '5',
    action: 'client_created',
    description: 'Created new client: Elite Exterminators',
    ip_address: '192.168.1.100',
    details: {
      new_value: { company_name: 'Elite Exterminators' },
      reason: 'New client onboarded',
    },
  },
  {
    id: 'audit_005',
    timestamp: '2025-01-15T10:30:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'client',
    entity_id: '2',
    action: 'override_applied',
    description: 'Applied usage override for BugBusters LLC',
    ip_address: '192.168.1.100',
    details: {
      previous_value: { includedMinutes: 300 },
      new_value: { includedMinutes: 400 },
      reason: 'Customer requested temporary increase for busy season',
    },
  },
  {
    id: 'audit_006',
    timestamp: '2025-01-10T10:05:00Z',
    admin_id: 'system',
    admin_email: 'system@2ndwave.ai',
    entity_type: 'usage',
    entity_id: '3',
    action: 'usage_limit_extended',
    description: 'Usage limit reached for Green Shield Exterminators',
    ip_address: '127.0.0.1',
    details: {
      previous_value: { service_status: 'active' },
      new_value: { service_status: 'limit_reached' },
      reason: 'Automatic: Monthly limit reached',
    },
  },
  {
    id: 'audit_007',
    timestamp: '2025-01-08T14:00:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'agent',
    entity_id: '1',
    action: 'agent_id_changed',
    description: 'Updated ElevenLabs agent ID for Apex Pest Control',
    ip_address: '192.168.1.100',
    details: {
      previous_value: { elevenlabs_agent_id: 'agent_old123' },
      new_value: { elevenlabs_agent_id: 'agent_abc123' },
      reason: 'Updated to new ElevenLabs agent',
    },
  },
  {
    id: 'audit_008',
    timestamp: '2025-01-05T09:00:00Z',
    admin_id: 'admin_2',
    admin_email: 'altaf@2ndwave.ai',
    entity_type: 'plan',
    entity_id: '2',
    action: 'plan_changed',
    description: 'Changed subscription plan from Starter to Growth',
    ip_address: '10.0.0.55',
    details: {
      previous_value: { planId: 'plan_starter' },
      new_value: { planId: 'plan_growth' },
      reason: 'Customer upgraded',
    },
  },
  {
    id: 'audit_009',
    timestamp: '2025-01-03T11:20:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'client',
    entity_id: '3',
    action: 'client_suspended',
    description: 'Suspended client: Green Shield Exterminators',
    ip_address: '192.168.1.100',
    details: {
      previous_value: { status: 'active' },
      new_value: { status: 'suspended' },
      reason: 'Non-payment after 30 days',
    },
  },
  {
    id: 'audit_010',
    timestamp: '2025-01-02T08:00:00Z',
    admin_id: 'admin_1',
    admin_email: 'john@2ndwave.ai',
    entity_type: 'user',
    entity_id: 'admin_1',
    action: 'user_login',
    description: 'User logged into the admin portal',
    ip_address: '192.168.1.100',
    details: {
      reason: 'Successful authentication via email/password',
    },
  },
];

// Call volume data for charts
export const mockCallVolumeData = {
  weekly: [
    { label: 'Mon', calls: 12, minutes: 145 },
    { label: 'Tue', calls: 19, minutes: 230 },
    { label: 'Wed', calls: 15, minutes: 178 },
    { label: 'Thu', calls: 24, minutes: 290 },
    { label: 'Fri', calls: 31, minutes: 375 },
    { label: 'Sat', calls: 18, minutes: 210 },
    { label: 'Sun', calls: 8, minutes: 95 },
  ],
  monthly: [
    { label: 'Week 1', calls: 85, minutes: 1020 },
    { label: 'Week 2', calls: 102, minutes: 1225 },
    { label: 'Week 3', calls: 95, minutes: 1140 },
    { label: 'Week 4', calls: 118, minutes: 1415 },
  ],
  quarterly: [
    { label: 'Jan', calls: 320, minutes: 3840 },
    { label: 'Feb', calls: 380, minutes: 4560 },
    { label: 'Mar', calls: 420, minutes: 5040 },
  ],
  yearly: [
    { label: 'Q1', calls: 1120, minutes: 13440 },
    { label: 'Q2', calls: 1350, minutes: 16200 },
    { label: 'Q3', calls: 1580, minutes: 18960 },
    { label: 'Q4', calls: 1820, minutes: 21840 },
  ],
};

// Monthly revenue data
export const mockRevenueData = [
  { month: 'Jan', revenue: 4500 },
  { month: 'Feb', revenue: 5200 },
  { month: 'Mar', revenue: 4800 },
  { month: 'Apr', revenue: 6100 },
  { month: 'May', revenue: 7200 },
  { month: 'Jun', revenue: 8500 },
];

// ============================================
// SUBSCRIPTION PLANS (Configured by Super Admins)
// ============================================

export const mockPlans: Plan[] = [
  {
    id: 'plan_starter',
    name: 'Starter',
    description: 'Basic plan for small pest control businesses starting with AI reception.',
    monthlyPrice: 99,
    status: 'active',
    includedMinutes: 100,
    overageAllowed: false,
    overageRate: 0,
    hardLimit: 100,
    usageWarningThreshold: 80,
    features: {
      aiCallAnswering: true,
      callSummaries: true,
      callTranscripts: false,
      newVsExistingDetection: false,
      leadTagging: false,
      emergencyEscalation: true,
      tentativeScheduling: true,
      calendarAvailabilityLookup: false,
      autoBookAppointments: false,
      multiplePhoneNumbers: false,
      multipleAgentsPerClient: false,
      priorityProcessing: false,
    },
    visibility: {
      showUsageAndMinutes: true,
      showCallTranscripts: false,
      showLeadList: false,
      historicalDataDays: 30,
      showEstimatedOverages: false,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-11-15T10:30:00Z',
    assignedClientsCount: 1,
  },
  {
    id: 'plan_growth',
    name: 'Growth',
    description: 'For growing businesses that need more features and capacity.',
    monthlyPrice: 249,
    status: 'active',
    includedMinutes: 300,
    overageAllowed: true,
    overageRate: 0.50,
    hardLimit: 500,
    usageWarningThreshold: 75,
    features: {
      aiCallAnswering: true,
      callSummaries: true,
      callTranscripts: true,
      newVsExistingDetection: true,
      leadTagging: true,
      emergencyEscalation: true,
      tentativeScheduling: true,
      calendarAvailabilityLookup: true,
      autoBookAppointments: false,
      multiplePhoneNumbers: true,
      multipleAgentsPerClient: false,
      priorityProcessing: false,
    },
    visibility: {
      showUsageAndMinutes: true,
      showCallTranscripts: true,
      showLeadList: true,
      historicalDataDays: 90,
      showEstimatedOverages: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-01T14:00:00Z',
    assignedClientsCount: 2,
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    description: 'Enterprise-grade features for established pest control operations.',
    monthlyPrice: 499,
    status: 'active',
    includedMinutes: 1000,
    overageAllowed: true,
    overageRate: 0.35,
    usageWarningThreshold: 70,
    features: {
      aiCallAnswering: true,
      callSummaries: true,
      callTranscripts: true,
      newVsExistingDetection: true,
      leadTagging: true,
      emergencyEscalation: true,
      tentativeScheduling: true,
      calendarAvailabilityLookup: true,
      autoBookAppointments: false,
      multiplePhoneNumbers: true,
      multipleAgentsPerClient: true,
      priorityProcessing: true,
    },
    visibility: {
      showUsageAndMinutes: true,
      showCallTranscripts: true,
      showLeadList: true,
      historicalDataDays: 'all',
      showEstimatedOverages: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-12-20T09:00:00Z',
    assignedClientsCount: 2,
  },
];

// ============================================
// CLIENT PLAN ASSIGNMENTS
// ============================================

export const mockClientPlanAssignments: Record<string, ClientPlanAssignment> = {
  '1': {
    planId: 'plan_pro',
    planStartDate: '2024-01-15T00:00:00Z',
    overridesEnabled: false,
  },
  '2': {
    planId: 'plan_growth',
    planStartDate: '2024-02-20T00:00:00Z',
    overridesEnabled: true,
    overrides: {
      includedMinutes: 400,
      features: {
        priorityProcessing: true,
      },
    },
  },
  '3': {
    planId: 'plan_starter',
    planStartDate: '2024-03-01T00:00:00Z',
    overridesEnabled: false,
  },
  '4': {
    planId: 'plan_pro',
    planStartDate: '2024-03-15T00:00:00Z',
    overridesEnabled: false,
  },
  '5': {
    planId: 'plan_growth',
    planStartDate: '2024-04-01T00:00:00Z',
    overridesEnabled: false,
  },
};
