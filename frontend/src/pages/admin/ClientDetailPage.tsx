import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Phone, Mail, MapPin, Clock, AlertTriangle, User, Webhook, CreditCard, ChevronDown, ChevronRight, Check, Loader2, Play, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { PendingProfileUpdates } from '@/components/admin/PendingProfileUpdates';
import { mockClients, mockAgents, mockContacts, mockCallLogs, mockPlans, mockClientPlanAssignments } from '@/data/mockData';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ClientPlanAssignment } from '@/types';
import { useAgent, useConversations, useConversationDetails } from '@/hooks/use-elevenlabs';
import { ELConversation, extractSummary, toISOTimestamp, BACKEND_URL } from '@/services/elevenLabsApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const defaultColumnWidths = {
  date: 140,
  caller: 130,
  duration: 100,
  status: 100,
  summary: 200,
};

/** Conversation detail dialog — fetches messages on demand */
function ConversationDetailDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: ELConversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: details, isLoading: detailsLoading } = useConversationDetails(
    open ? conversation?.conversation_id : undefined,
  );

  const messages = details?.transcript ?? details?.messages ?? [];
  const summaryText = extractSummary(undefined, conversation ?? undefined, details);
  const audioSrc = conversation
    ? `${BACKEND_URL}/conversations/${conversation.conversation_id}/audio`
    : undefined;
  const isSuccessful = conversation?.call_successful === 'success' ||
    conversation?.call_successful === 'true' ||
    details?.analysis?.call_successful === 'success';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conversation Details</DialogTitle>
          <DialogDescription>
            {conversation
              ? format(new Date(toISOTimestamp(conversation)), 'MMMM d, yyyy \u0027at\u0027 h:mm a')
              : 'Call details'}
          </DialogDescription>
        </DialogHeader>

        {detailsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading conversation\u2026</span>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="font-semibold">{conversation?.call_duration_secs ?? 0}s</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <p className="font-semibold">{messages.length || (conversation?.message_count ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <Badge variant={isSuccessful ? 'success' : 'secondary'}>
                  {isSuccessful ? 'Successful' : (conversation?.status ?? 'unknown')}
                </Badge>
              </div>
            </div>

            {/* Summary */}
            {summaryText && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Summary</p>
                <div className="p-3 rounded-md bg-muted border border-border text-sm">
                  {summaryText}
                </div>
              </div>
            )}

            {/* Transcript */}
            {messages.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Transcript</p>
                <ScrollArea className="h-48 p-3 rounded-md bg-muted border border-border">
                  <div className="space-y-2 text-sm">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'agent' ? 'flex-row' : 'flex-row-reverse'}`}>
                        <span className={`font-semibold text-xs shrink-0 ${msg.role === 'agent' ? 'text-primary' : 'text-muted-foreground'}`}>
                          {msg.role === 'agent' ? 'Agent' : 'Caller'}
                        </span>
                        <p className="text-muted-foreground">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Audio — always attempt; browser will show error state if unavailable */}
            {audioSrc && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Audio Recording</p>
                <audio
                  controls
                  src={audioSrc}
                  className="w-full rounded-md"
                  onError={(e) => { (e.currentTarget.parentElement!).style.display = 'none'; }}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ClientDetailPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);
  const [selectedConversation, setSelectedConversation] = useState<ELConversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Real data from backend ──────────────────────────────────────────────────
  const { data: elAgent, isLoading: agentLoading } = useAgent(id);
  const { data: conversations = [], isLoading: convsLoading } = useConversations(id);

  // ── Fallback to mock data when backend returns nothing ──────────────────────
  const mockClient = mockClients.find(c => c.id === id);
  const mockAgent = mockAgents.find(a => a.client_id === id);
  const contact = mockContacts.find(c => c.client_id === id);
  const mockClientCalls = mockCallLogs.filter(c => c.client_id === id);

  // Resolved display values
  const clientName   = elAgent?.name ?? mockClient?.company_name ?? 'Unknown Client';
  const clientEmail  = (elAgent?.metadata?.['email'] as string) ?? mockClient?.business_email ?? '';
  const serviceArea  = (elAgent?.metadata?.['service_area'] as string) ?? mockClient?.service_area ?? '';
  const clientStatus = elAgent ? (elAgent.archived ? 'inactive' : 'active') : (mockClient?.status ?? 'active');
  const createdAt    = elAgent?.created_at_unix_secs
    ? new Date((elAgent.created_at_unix_secs as number) * 1000).toISOString()
    : (mockClient?.created_at ?? new Date().toISOString());
  const agentId      = elAgent?.agent_id ?? mockAgent?.elevenlabs_agent_id ?? '';

  // Use real conversations if available, else fall back to mock call logs
  const hasRealConversations = conversations.length > 0;


  // Plan assignment state
  const existingAssignment = id ? mockClientPlanAssignments[id] : undefined;
  const [planAssignment, setPlanAssignment] = useState<ClientPlanAssignment>(() => {
    if (existingAssignment) return { ...existingAssignment };
    return { planId: '', planStartDate: new Date().toISOString(), overridesEnabled: false };
  });
  const [planSectionOpen, setPlanSectionOpen] = useState(false);
  const selectedPlan = mockPlans.find(p => p.id === planAssignment.planId);

  const handleSavePlanAssignment = () => {
    toast({
      title: 'Plan Assignment Updated',
      description: `${clientName}'s plan configuration has been saved.`,
    });
  };

  // Loading skeleton
  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading client details…</span>
      </div>
    );
  }

  // Not found guard — show if neither real nor mock data exists
  if (!elAgent && !mockClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/clients">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Client Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              The client you're looking for doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conversation detail dialog */}
      <ConversationDetailDialog
        conversation={selectedConversation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/clients">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{clientName}</h1>
              <p className="text-muted-foreground">{serviceArea}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={clientStatus === 'active' ? 'active' : 'inactive'}>
            {clientStatus}
          </Badge>
          {mockClient && (
            <Badge variant="secondary" className="capitalize">
              {mockClient.subscription_plan}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{clientEmail || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Service Area</p>
                <p className="font-medium">{serviceArea || '—'}</p>
              </div>
            </div>
            {agentId && (
              <div className="flex items-center gap-3">
                <Webhook className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">ElevenLabs Agent ID</p>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">{agentId}</p>
                </div>
              </div>
            )}
            <Separator />
            <div className="text-sm text-muted-foreground">
              Created on {format(new Date(createdAt), 'MMMM d, yyyy')}
            </div>
          </CardContent>
        </Card>

        {/* Primary Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Primary Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contact ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{contact.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm">{contact.email}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No contact information available.</p>
            )}
          </CardContent>
        </Card>

        {/* AI Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Webhook className="w-4 h-4 text-primary" />
              AI Agent Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(elAgent || mockAgent) ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Display Name</p>
                  <p className="font-medium">{elAgent?.name ?? mockAgent?.display_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ElevenLabs Agent ID</p>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                    {agentId}
                  </p>
                </div>
                {elAgent && (
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={elAgent.archived ? 'inactive' : 'active'} className="capitalize">
                      {elAgent.archived ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                )}
                {mockAgent && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Linked Phone Numbers</p>
                        <p className="text-sm">{mockAgent.linked_phone_numbers.join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Business Hours</p>
                        <p className="text-sm">{mockAgent.business_hours}</p>
                      </div>
                    </div>
                    {mockAgent.escalation_notes && (
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Escalation Notes</p>
                          <p className="text-sm">{mockAgent.escalation_notes}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Badge variant={mockAgent.webhook_enabled ? 'active' : 'inactive'}>
                        {mockAgent.webhook_enabled ? 'Webhook Enabled' : 'Webhook Disabled'}
                      </Badge>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No AI agent connected to this client.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Call Statistics
              {convsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasRealConversations ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{conversations.length}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {conversations.filter(c => c.call_successful === 'true').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {conversations.reduce((sum, c) => sum + (c.call_duration_secs ?? 0), 0)}s
                  </p>
                  <p className="text-xs text-muted-foreground">Total Duration</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{mockClientCalls.length}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {mockClientCalls.filter(c => c.status === 'completed').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">
                    {mockClientCalls.filter(c => c.status === 'escalated').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Escalated</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Assignment Section */}
      <Card>
        <Collapsible open={planSectionOpen} onOpenChange={setPlanSectionOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                {planSectionOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Plan Assignment</span>
                {selectedPlan && (
                  <Badge variant="secondary" className="ml-2">{selectedPlan.name}</Badge>
                )}
              </div>
              {planAssignment.planId && (
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </div>
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <Separator />
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assigned Plan</Label>
                  <Select
                    value={planAssignment.planId}
                    onValueChange={(value) => setPlanAssignment({ ...planAssignment, planId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockPlans.filter(p => p.status === 'active').map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - ${plan.monthlyPrice}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan Start Date</Label>
                  <Input
                    type="date"
                    value={planAssignment.planStartDate ? planAssignment.planStartDate.split('T')[0] : ''}
                    onChange={(e) => setPlanAssignment({ 
                      ...planAssignment, 
                      planStartDate: new Date(e.target.value).toISOString() 
                    })}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Overrides Enabled</Label>
                  <p className="text-xs text-muted-foreground">Allow manual override of plan settings for this client</p>
                </div>
                <Switch
                  checked={planAssignment.overridesEnabled}
                  onCheckedChange={(checked) => setPlanAssignment({ 
                    ...planAssignment, 
                    overridesEnabled: checked,
                    overrides: checked ? planAssignment.overrides || {} : undefined
                  })}
                />
              </div>

              {planAssignment.overridesEnabled && (
                <>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span><strong className="text-foreground">Warning:</strong> Overrides differ from standard plan configuration.</span>
                    </p>
                  </div>

                  <div className="space-y-4 pl-4 border-l-2 border-border">
                    <div className="space-y-2">
                      <Label>Override: Included Minutes</Label>
                      <Input
                        type="number"
                        value={planAssignment.overrides?.includedMinutes || selectedPlan?.includedMinutes || ''}
                        onChange={(e) => setPlanAssignment({
                          ...planAssignment,
                          overrides: {
                            ...planAssignment.overrides,
                            includedMinutes: parseInt(e.target.value) || undefined
                          }
                        })}
                        placeholder={`Default: ${selectedPlan?.includedMinutes || 0} min`}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Override: Overage Allowed</Label>
                        <p className="text-xs text-muted-foreground">Default: {selectedPlan?.overageAllowed ? 'Yes' : 'No'}</p>
                      </div>
                      <Switch
                        checked={planAssignment.overrides?.usageLimits?.overageAllowed ?? selectedPlan?.overageAllowed ?? false}
                        onCheckedChange={(checked) => setPlanAssignment({
                          ...planAssignment,
                          overrides: {
                            ...planAssignment.overrides,
                            usageLimits: {
                              ...planAssignment.overrides?.usageLimits,
                              overageAllowed: checked
                            }
                          }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Override: Priority Processing</Label>
                        <p className="text-xs text-muted-foreground">Default: {selectedPlan?.features.priorityProcessing ? 'Yes' : 'No'}</p>
                      </div>
                      <Switch
                        checked={planAssignment.overrides?.features?.priorityProcessing ?? selectedPlan?.features.priorityProcessing ?? false}
                        onCheckedChange={(checked) => setPlanAssignment({
                          ...planAssignment,
                          overrides: {
                            ...planAssignment.overrides,
                            features: {
                              ...planAssignment.overrides?.features,
                              priorityProcessing: checked
                            }
                          }
                        })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePlanAssignment}>Save Plan Assignment</Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Pending Profile Updates */}
      <PendingProfileUpdates clientId={id} />

      {/* Recent Conversations / Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            {hasRealConversations ? 'Conversations' : 'Recent Calls'}
            {convsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hasRealConversations ? (
            /* ── Real conversations from ElevenLabs ── */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="date" width={columnWidths.date} onResize={handleMouseDown}>
                      Date
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="caller" width={columnWidths.caller} onResize={handleMouseDown}>
                      Duration
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="duration" width={columnWidths.duration} onResize={handleMouseDown}>
                      Messages
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>
                      Status
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="summary" width={columnWidths.summary} onResize={handleMouseDown} isLast>
                      Summary
                    </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {conversations.slice(0, 10).map((conv) => {
                    const ts = toISOTimestamp(conv);
                    const summaryText = extractSummary(conv.summary);
                    return (
                      <tr
                        key={conv.conversation_id}
                        className="hover:bg-muted/50 transition-colors h-14 cursor-pointer"
                        onClick={() => { setSelectedConversation(conv); setDialogOpen(true); }}
                      >
                        <ResizableTableCell width={columnWidths.date}>
                          <span className="text-sm">{format(new Date(ts), 'MMM d, h:mm a')}</span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.caller}>
                          <span className="text-sm font-mono">{conv.call_duration_secs ?? 0}s</span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.duration}>
                          <span className="text-sm">{conv.message_count ?? 0}</span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.status}>
                          <Badge variant={conv.call_successful === 'true' ? 'active' : 'secondary'}>
                            {conv.call_successful === 'true' ? 'Success' : conv.status}
                          </Badge>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.summary}>
                          <span className="text-sm text-muted-foreground truncate block max-w-xs">
                            {summaryText || '—'}
                          </span>
                        </ResizableTableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : mockClientCalls.length > 0 ? (
            /* ── Fallback: mock call logs ── */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="date" width={columnWidths.date} onResize={handleMouseDown}>
                      Date
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="caller" width={columnWidths.caller} onResize={handleMouseDown}>
                      Caller
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="duration" width={columnWidths.duration} onResize={handleMouseDown}>
                      Issue
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>
                      Status
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="summary" width={columnWidths.summary} onResize={handleMouseDown} isLast>
                      Summary
                    </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockClientCalls.slice(0, 5).map((call) => (
                    <tr key={call.id} className="hover:bg-muted/50 transition-colors h-14">
                      <ResizableTableCell width={columnWidths.date}>
                        <span className="text-sm">{format(new Date(call.timestamp), 'MMM d, h:mm a')}</span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.caller} className="font-mono text-sm">
                        {call.caller_phone}
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.duration}>
                        <Badge variant="secondary">{call.pest_issue || 'General'}</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.status}>
                        <Badge variant={call.status === 'completed' ? 'active' : call.status === 'escalated' ? 'warning' : 'inactive'}>
                          {call.status}
                        </Badge>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.summary}>
                        <span className="text-sm text-muted-foreground">{call.summary}</span>
                      </ResizableTableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              No calls recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDetailPage;
