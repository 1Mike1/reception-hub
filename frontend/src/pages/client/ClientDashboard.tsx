import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Phone,
  Search,
  Clock,
  MessageSquare,
  TrendingUp,
  Waves,
  Loader2,
  Bot,
  ChevronRight,
  TimerIcon,
  Activity,
  LogOut,
  CreditCard,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { useConversations, useAgent } from '@/hooks/use-elevenlabs';
import { useClientPlan, useUsageAlert, usePlanTiers, useCreateCheckout, useConfirmPayment } from '@/hooks/use-plans';
import {
  ELConversation,
  extractSummary,
  toISOTimestamp,
} from '@/services/elevenLabsApi';
import { getClientSession, clearClientSession } from '@/services/clientAuth';
import { UsageBanner } from '@/components/client/UsageBanner';
import { PlanCard } from '@/components/client/PlanCard';
import { ConversationDetailDialog } from '@/components/client/ConversationDetailDialog';

// --- Main Dashboard ---

export default function ClientDashboard() {
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<ELConversation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [plansDialogOpen, setPlansDialogOpen] = useState(false);
  const [purchasingTier, setPurchasingTier] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clientSession = getClientSession();
  const agentId = clientSession?.agent_id ?? undefined;
  const clientId = clientSession?.id ?? undefined;
  const companyName = clientSession?.company_name ?? 'Dashboard';
  const clientEmail = clientSession?.email ?? '';

  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const { data: conversations = [], isLoading: convsLoading } = useConversations(agentId);
  const { data: clientPlan, isLoading: planLoading } = useClientPlan(clientId);
  const { data: usageAlert } = useUsageAlert(clientId);
  const { data: planTiers = [] } = usePlanTiers();
  const createCheckout = useCreateCheckout();
  const confirmPayment = useConfirmPayment();

  // Handle payment redirect back (supports both real Stripe and mock mode)
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (paymentStatus === 'success' && sessionId) {
      // Mock mode passes tier + client_id in URL; real Stripe stores them in session metadata
      const mockTier = searchParams.get('tier') ?? undefined;
      const mockClientId = searchParams.get('client_id') ?? undefined;
      confirmPayment.mutate({ sessionId, tierId: mockTier, clientId: mockClientId });
      // Clean URL params
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams]);

  const totalCalls = conversations.length;
  const totalDuration = conversations.reduce((sum, c) => sum + (c.call_duration_secs ?? 0), 0);
  const successfulCalls = conversations.filter(
    (c) => c.call_successful === 'success' || c.call_successful === 'true',
  ).length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  const agentStatus = agentLoading ? '...' : agent?.archived ? 'Archived' : 'Active';

  // Sort newest first
  const sortedConversations = [...conversations].sort((a, b) => {
    const ta = a.start_time_unix_secs ?? a.start_time ?? 0;
    const tb = b.start_time_unix_secs ?? b.start_time ?? 0;
    return tb - ta;
  });

  const filtered = sortedConversations.filter((c) => {
    const summary = extractSummary(undefined, c) ?? '';
    return (
      summary.toLowerCase().includes(search.toLowerCase()) ||
      c.conversation_id.includes(search)
    );
  });

  const handleSignOut = () => {
    clearClientSession();
    navigate('/', { replace: true });
  };

  const openDetail = (conv: ELConversation) => {
    setSelectedConv(conv);
    setDetailOpen(true);
  };

  const handlePlanPurchase = async (tierId: string) => {
    if (!clientId) return;
    setPurchasingTier(tierId);
    try {
      const { checkout_url } = await createCheckout.mutateAsync({ clientId, tierId });
      window.location.href = checkout_url;
    } catch {
      setPurchasingTier(null);
    }
  };

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const usageColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Waves className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">2nd Wave AI</p>
              <p className="text-xs text-muted-foreground">Client Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{companyName}</p>
              <p className="text-xs text-muted-foreground">{clientEmail}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <div className="rounded-xl bg-muted border border-border p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Welcome, {companyName}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {agent?.name ? `AI Agent: ${agent.name}` : agentId ? `Agent ID: ${agentId}` : 'No agent linked — contact your administrator.'}
            </p>
          </div>
        </div>

        {/* Usage Alert Banner */}
        {usageAlert && <UsageBanner alert={usageAlert} />}

        {/* Plan & Usage Card */}
        {clientPlan && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{clientPlan.tier_name} Plan</span>
                  <Badge variant={clientPlan.status === 'active' ? 'active' : 'secondary'} className="text-xs">
                    {clientPlan.status}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPlansDialogOpen(true)}>
                  <CreditCard className="w-3.5 h-3.5 mr-1" />
                  Upgrade
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {clientPlan.used_tokens.toLocaleString()} / {clientPlan.total_tokens.toLocaleString()} tokens used
                  </span>
                  <span className="font-medium">{clientPlan.usage_percent}%</span>
                </div>
                <Progress
                  value={Math.min(clientPlan.usage_percent, 100)}
                  className={`h-2.5 [&>div]:${usageColor(clientPlan.usage_percent)}`}
                />
                <p className="text-xs text-muted-foreground">
                  {clientPlan.remaining_tokens.toLocaleString()} tokens remaining
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {!clientPlan && !planLoading && clientId && (
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">No active plan. Choose a plan to get started.</p>
              <Button size="sm" onClick={() => setPlansDialogOpen(true)}>
                <CreditCard className="w-3.5 h-3.5 mr-1" />
                Choose Plan
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agent Status</p>
                <Badge variant={agentStatus === 'Active' ? 'active' : 'secondary'} className="mt-2 text-sm">
                  {agentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : agentStatus}
                </Badge>
              </div>
              <Activity className="w-8 h-8 text-primary/40" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-3xl font-bold mt-1">{convsLoading ? '…' : totalCalls}</p>
              </div>
              <Phone className="w-8 h-8 text-primary/40" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Duration</p>
                <p className="text-3xl font-bold mt-1">{convsLoading ? '…' : formatDuration(totalDuration)}</p>
              </div>
              <TimerIcon className="w-8 h-8 text-primary/40" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-3xl font-bold text-success mt-1">{convsLoading ? '…' : successfulCalls}</p>
                {!convsLoading && totalCalls > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{successRate}% success rate</p>
                )}
              </div>
              <TrendingUp className="w-8 h-8 text-success/40" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="w-4 h-4 text-primary" />
                Conversations
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 h-8 w-52 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {convsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {agentId ? 'No conversations found.' : 'No agent ID configured.'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((conv) => {
                  const ts = new Date(toISOTimestamp(conv));
                  const summary = extractSummary(undefined, conv);
                  const isSuccess = conv.call_successful === 'success' || conv.call_successful === 'true';
                  return (
                    <button
                      key={conv.conversation_id}
                      onClick={() => openDetail(conv)}
                      className="w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{format(ts, 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">{format(ts, 'h:mm a')}</p>
                          <Badge variant={isSuccess ? 'success' : 'secondary'} className="text-xs ml-auto">
                            {isSuccess ? 'Successful' : conv.status ?? 'unknown'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-muted-foreground truncate flex-1">
                            {conv.call_summary_title ?? summary ?? 'No summary available'}
                          </p>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {conv.call_duration_secs ?? 0}s
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <ConversationDetailDialog conv={selectedConv} open={detailOpen} onClose={() => setDetailOpen(false)} />

      {/* Plans Upgrade Dialog */}
      <Dialog open={plansDialogOpen} onOpenChange={setPlansDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Choose a Plan
            </DialogTitle>
            <DialogDescription>
              Select a plan that fits your business needs. You'll be redirected to our secure payment provider.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3 mt-2">
            {planTiers.map((tier) => (
              <PlanCard
                key={tier.tier_id}
                tier={tier}
                isCurrentPlan={clientPlan?.tier_id === tier.tier_id && clientPlan?.status === 'active'}
                isPurchasing={purchasingTier === tier.tier_id}
                onSelect={handlePlanPurchase}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
