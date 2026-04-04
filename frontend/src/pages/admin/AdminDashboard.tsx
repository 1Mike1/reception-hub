import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Phone, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Plus,
  Clock,
  ArrowRight,
  Activity,
  Timer,
  CheckCircle2,
  MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { AddClientDialog } from '@/components/admin/AddClientDialog';
import { PendingProfileUpdates } from '@/components/admin/PendingProfileUpdates';
import { useAgents, useConversations } from '@/hooks/use-elevenlabs';
import { ELConversation, extractSummary } from '@/services/elevenLabsApi';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  trendUp,
  description,
  compact = false
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  trend?: string;
  trendUp?: boolean;
  description?: string;
  compact?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
            </div>
            <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-semibold tracking-tight`}>{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs sm:text-sm ${trendUp ? 'text-success' : 'text-destructive'}`}>
                {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="font-medium">{trend}</span>
                {!compact && <span className="text-muted-foreground hidden sm:inline">vs last month</span>}
              </div>
            )}
            {description && !trend && !compact && (
              <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentQuickList({ compact = false }: { compact?: boolean }) {
  const { data: agents = [] } = useAgents();
  const activeAgents = agents.filter(a => !a.archived);
  const displayAgents = activeAgents.slice(0, 4);

  return (
    <Card>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="mb-3">
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold`}>{activeAgents.length} active</h3>
          {!compact && <p className="text-sm text-muted-foreground">Your AI receptionist agents</p>}
        </div>
        <div className="space-y-2 mb-3">
          {displayAgents.map((agent) => (
            <div key={agent.agent_id} className="flex items-center gap-2">
              <Avatar className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} shrink-0`}>
                <AvatarFallback className="bg-primary/10 text-xs font-medium">
                  {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{agent.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {agent.last_7_day_call_count ?? 0} calls (7d)
                </p>
              </div>
            </div>
          ))}
          {activeAgents.length > 4 && (
            <Link to="/admin/clients" className="text-xs text-primary hover:underline flex items-center gap-1">
              +{activeAgents.length - 4} more <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
        <Button variant="outline" className="w-full rounded-xl" size={compact ? "sm" : "default"} asChild>
          <Link to="/admin/clients">View all agents</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CallVolumeChart({ compact = false }: { compact?: boolean }) {
  const [period, setPeriod] = useState<'7d' | '14d' | '30d'>('7d');
  const { data: conversations = [] } = useConversations();

  const chartData = useMemo(() => {
    const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
    const now = new Date();
    const buckets: { label: string; calls: number; minutes: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = startOfDay(subDays(now, i - 1));
      const dayConvs = conversations.filter((c) => {
        const ts = c.start_time_unix_secs
          ? new Date(c.start_time_unix_secs * 1000)
          : c.start_time ? new Date(c.start_time * 1000) : c.created_at ? new Date(c.created_at) : null;
        return ts && isAfter(ts, dayStart) && !isAfter(ts, dayEnd);
      });
      buckets.push({
        label: format(day, days <= 7 ? 'EEE' : 'MMM d'),
        calls: dayConvs.length,
        minutes: Math.round(dayConvs.reduce((s, c) => s + (c.call_duration_secs ?? 0), 0) / 60),
      });
    }
    return buckets;
  }, [conversations, period]);

  const totalCalls = chartData.reduce((s, d) => s + d.calls, 0);
  const totalMinutes = chartData.reduce((s, d) => s + d.minutes, 0);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-lg">
          <p className="text-xs font-medium mb-1">{label}</p>
          {payload.map((item, index) => (
            <p key={index} className="text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="opacity-80">{item.dataKey === 'calls' ? 'Calls' : 'Min'}:</span>
              <span className="font-semibold">{item.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full w-full flex flex-col">
      <CardHeader className={`flex flex-row items-center justify-between ${compact ? 'pb-2' : 'pb-4'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Call Analytics</CardTitle>
          </div>
          <p className={`${compact ? 'text-xl' : 'text-2xl'} font-semibold`}>
            {totalCalls.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">calls</span>
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-20 rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="14d">14 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className={compact ? "h-32" : "h-52"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="minutes"
                stroke="hsl(142, 72%, 40%)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(142, 72%, 40%)', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`${compact ? 'mt-2 pt-2' : 'mt-4 pt-4'} border-t border-border flex gap-4`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-primary rounded-full" />
            <span className="text-xs text-muted-foreground">{totalCalls.toLocaleString()} calls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-success rounded-full" style={{ background: 'repeating-linear-gradient(90deg, hsl(142, 72%, 40%) 0, hsl(142, 72%, 40%) 3px, transparent 3px, transparent 6px)' }} />
            <span className="text-xs text-muted-foreground">{totalMinutes.toLocaleString()} min</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CallMetricsCard({ compact = false }: { compact?: boolean }) {
  const { data: conversations = [] } = useConversations();
  const { data: agents = [] } = useAgents();

  const totalMinutes = Math.round(
    conversations.reduce((s, c) => s + (c.call_duration_secs ?? 0), 0) / 60,
  );
  const avgDuration =
    conversations.length > 0
      ? Math.round(
          conversations.reduce((s, c) => s + (c.call_duration_secs ?? 0), 0) / conversations.length,
        )
      : 0;
  const successCount = conversations.filter(
    (c) => c.call_successful === 'success',
  ).length;
  const successRate =
    conversations.length > 0
      ? Math.round((successCount / conversations.length) * 100)
      : 0;
  const total7dCalls = agents.reduce(
    (s, a) => s + (a.last_7_day_call_count ?? 0),
    0,
  );

  return (
    <Card>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Call Metrics</p>
        </div>
        <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-semibold tracking-tight`}>
          {totalMinutes.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">min</span>
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Avg duration</span>
            <span className="font-medium">{avgDuration}s</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Success rate</span>
            <span className="font-medium text-success">{successRate}%</span>
          </div>
          {!compact && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">7-day calls</span>
              <span className="font-medium">{total7dCalls}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Bar chart showing 7-day call distribution across agents */
function AgentCallsBreakdown() {
  const { data: agents = [] } = useAgents();

  const chartData = useMemo(() => {
    return agents
      .filter((a) => !a.archived && (a.last_7_day_call_count ?? 0) > 0)
      .sort((a, b) => (b.last_7_day_call_count ?? 0) - (a.last_7_day_call_count ?? 0))
      .slice(0, 8)
      .map((a) => ({
        name: a.name.length > 14 ? `${a.name.slice(0, 12)}…` : a.name,
        calls: a.last_7_day_call_count ?? 0,
      }));
  }, [agents]);

  const COLORS = [
    'hsl(var(--primary))',
    'hsl(142, 72%, 40%)',
    'hsl(200, 80%, 50%)',
    'hsl(280, 60%, 55%)',
    'hsl(30, 90%, 55%)',
    'hsl(350, 70%, 55%)',
    'hsl(170, 60%, 45%)',
    'hsl(50, 90%, 50%)',
  ];

  if (chartData.length === 0) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Calls by Agent (7d)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Calls']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="calls" radius={[0, 4, 4, 0]} barSize={16}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [addClientOpen, setAddClientOpen] = useState(false);
  const isMobile = useIsMobile();

  // Real data from ElevenLabs via backend
  const { data: agents = [] } = useAgents();
  const { data: conversations = [] } = useConversations();

  const activeAgents = agents.filter(a => !a.archived).length;
  const archivedAgents = agents.filter(a => a.archived).length;

  const todayCalls = conversations.filter(c => {
    const ts = c.start_time_unix_secs
      ? new Date(c.start_time_unix_secs * 1000)
      : c.start_time ? new Date(c.start_time * 1000) : c.created_at ? new Date(c.created_at) : null;
    return ts && ts.toDateString() === new Date().toDateString();
  }).length;

  const totalCalls = conversations.length;

  const successfulCalls = conversations.filter(c => c.call_successful === 'success').length;
  const failedCalls = conversations.filter(c => c.call_successful !== 'success' && c.call_successful !== undefined).length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Overview of your AI receptionists
            </p>
          </div>
          <Button onClick={() => setAddClientOpen(true)} className="rounded-lg" size={isMobile ? "sm" : "default"}>
            <Plus className="w-4 h-4" />
            {!isMobile && <span className="ml-2">Add Client</span>}
          </Button>
        </div>

        {/* Stats Grid - 2x3 on mobile, 6 cols on desktop */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Active Agents"
            value={activeAgents}
            icon={Users}
            compact={isMobile}
          />
          <StatCard
            title="Archived"
            value={archivedAgents}
            icon={AlertTriangle}
            description="Inactive agents"
            compact={isMobile}
          />
          <StatCard
            title="Calls Today"
            value={todayCalls}
            icon={Phone}
            description="Real-time"
            compact={isMobile}
          />
          <StatCard
            title="Total Calls"
            value={totalCalls}
            icon={TrendingUp}
            compact={isMobile}
          />
          <StatCard
            title="Success Rate"
            value={`${successRate}%`}
            icon={CheckCircle2}
            trendUp={successRate >= 70}
            compact={isMobile}
          />
          <StatCard
            title="Failed / Unknown"
            value={failedCalls}
            icon={AlertTriangle}
            description="Needs attention"
            compact={isMobile}
          />
        </div>

        {/* Main Content Grid */}
        {isMobile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <CallMetricsCard compact />
              <AgentQuickList compact />
            </div>
            <CallVolumeChart compact />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 flex">
              <CallVolumeChart />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <CallMetricsCard />
              <AgentQuickList />
            </div>
            <div className="lg:col-span-3">
              <AgentCallsBreakdown />
            </div>
          </div>
        )}

        {/* Pending Actions */}
        {!isMobile && (
          <div className="grid gap-6 lg:grid-cols-3">
            <PendingProfileUpdates />
          </div>
        )}

        {/* Recent Activity */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Recent Calls */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">Recent Calls</CardTitle>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" asChild>
                <Link to="/admin/calls">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-3">
              {conversations.slice(0, isMobile ? 3 : 5).map((conv) => {
                const ts = conv.start_time_unix_secs
                  ? new Date(conv.start_time_unix_secs * 1000)
                  : conv.start_time ? new Date(conv.start_time * 1000)
                  : conv.created_at ? new Date(conv.created_at) : new Date();
                return (
                  <div
                    key={conv.conversation_id}
                    className="flex items-center justify-between p-3 md:p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <Avatar className="w-8 h-8 md:w-10 md:h-10 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">
                          {(conv.agent_name ?? conv.agent_id).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium truncate">
                          {conv.agent_name ?? conv.agent_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conv.call_duration_secs ?? 0}s · {conv.message_count ?? 0} msgs
                          {conv.call_summary_title && ` · ${conv.call_summary_title}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <Badge variant={conv.call_successful === 'success' ? 'success' : 'secondary'} className="text-xs">
                          {conv.call_successful === 'success' ? 'successful' : conv.call_successful ?? conv.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {format(ts, 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No conversations yet</p>
              )}
            </CardContent>
          </Card>

          {/* Agent List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">All Agents</CardTitle>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" asChild>
                <Link to="/admin/clients">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 md:space-y-3">
              {agents.slice(0, isMobile ? 3 : 5).map((agent) => {
                const lastCall = agent.last_call_time_unix_secs
                  ? format(new Date(agent.last_call_time_unix_secs * 1000), 'MMM d, h:mm a')
                  : 'No calls yet';
                return (
                  <Link
                    key={agent.agent_id}
                    to={`/admin/clients/${agent.agent_id}`}
                    className="flex items-center justify-between p-3 md:p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <Avatar className="w-8 h-8 md:w-10 md:h-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-medium">
                          {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.last_7_day_call_count ?? 0} calls (7d) · {lastCall}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 hidden sm:block">
                      <Badge variant={agent.archived ? 'inactive' : 'active'} className="text-xs">
                        {agent.archived ? 'Archived' : 'Active'}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
              {agents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No agents found</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
    </>
  );
}
