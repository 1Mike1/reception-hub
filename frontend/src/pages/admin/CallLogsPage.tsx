import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Phone, 
  Search,
  Download,
  Clock,
  MessageSquare,
  AlertTriangle,
  MoreHorizontal,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { mockCallLogs, mockClients } from '@/data/mockData';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConversations, useAgents } from '@/hooks/use-elevenlabs';
import { ELConversation, extractSummary, toISOTimestamp, BACKEND_URL } from '@/services/elevenLabsApi';
import { ConversationDetailDialog } from '@/components/client/ConversationDetailDialog';

const defaultColumnWidths = {
  status: 130,
  client: 160,
  caller: 140,
  issue: 120,
  summary: 250,
  time: 160,
  actions: 80,
};

export default function CallLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<typeof mockCallLogs[0] | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ELConversation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');
  const isMobile = useIsMobile();
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);

  // Fetch real data from backend
  const { data: conversations = [], isLoading: convsLoading } = useConversations();
  const { data: agents = [] } = useAgents();
  const useRealData = conversations.length > 0;

  const activeFiltersCount = [
    statusFilter !== 'all',
    clientFilter !== 'all',
    outcomeFilter !== 'all',
  ].filter(Boolean).length;

  // ── Real conversation filtering ───────────────────────────────────────────
  const filteredConversations = conversations.filter((conv) => {
    const summary = extractSummary(undefined, conv);
    const matchesSearch =
      summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.conversation_id.includes(searchQuery) ||
      (conv.agent_name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter ||
      (statusFilter === 'completed' && (conv.call_successful === 'success'));
    const matchesClient = clientFilter === 'all' || conv.agent_id === clientFilter;
    const matchesOutcome = outcomeFilter === 'all' || conv.call_successful === outcomeFilter;
    return matchesSearch && matchesStatus && matchesClient && matchesOutcome;
  }).sort((a, b) => {
    const tsA = a.start_time_unix_secs ?? (a.start_time ?? 0);
    const tsB = b.start_time_unix_secs ?? (b.start_time ?? 0);
    switch (sortBy) {
      case 'oldest': return tsA - tsB;
      case 'duration-desc': return (b.call_duration_secs ?? 0) - (a.call_duration_secs ?? 0);
      case 'duration-asc': return (a.call_duration_secs ?? 0) - (b.call_duration_secs ?? 0);
      case 'messages-desc': return (b.message_count ?? 0) - (a.message_count ?? 0);
      case 'messages-asc': return (a.message_count ?? 0) - (b.message_count ?? 0);
      case 'newest':
      default: return tsB - tsA;
    }
  });

  // ── Mock data filtering (fallback) ───────────────────────────────────────
  const filteredCalls = mockCallLogs.filter(call => {
    const matchesSearch = call.caller_phone.includes(searchQuery) ||
      call.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    const matchesClient = clientFilter === 'all' || call.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  }).sort((a, b) => {
    const tsA = new Date(a.timestamp).getTime();
    const tsB = new Date(b.timestamp).getTime();
    switch (sortBy) {
      case 'oldest': return tsA - tsB;
      case 'newest':
      default: return tsB - tsA;
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Phone className="w-3 h-3 text-success" />;
      case 'escalated': return <AlertTriangle className="w-3 h-3 text-warning" />;
      case 'missed':    return <Phone className="w-3 h-3 text-destructive" />;
      case 'blocked':   return <AlertTriangle className="w-3 h-3 text-destructive" />;
      default:          return null;
    }
  };

  // ── Export helpers ──────────────────────────────────────────────────────────
  const buildExportRows = () => {
    if (useRealData) {
      return filteredConversations.map((conv) => {
        const ts = conv.start_time_unix_secs ?? conv.start_time ?? 0;
        return {
          conversation_id: conv.conversation_id,
          agent: conv.agent_name ?? conv.agent_id,
          status: conv.status,
          outcome: conv.call_successful ?? '',
          summary: extractSummary(undefined, conv),
          duration_secs: conv.call_duration_secs ?? 0,
          messages: conv.message_count ?? 0,
          timestamp: ts ? format(new Date(ts * 1000), 'yyyy-MM-dd HH:mm:ss') : '',
        };
      });
    }
    return filteredCalls.map((call) => ({
      caller_phone: call.caller_phone,
      client: mockClients.find(c => c.id === call.client_id)?.name ?? call.client_id,
      status: call.status,
      outcome: '',
      summary: call.summary,
      duration_secs: 0,
      messages: 0,
      timestamp: format(new Date(call.timestamp), 'yyyy-MM-dd HH:mm:ss'),
    }));
  };

  const exportToCSV = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => {
          const val = String((r as Record<string, unknown>)[h] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `call-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openCallDetails = (call: typeof mockCallLogs[0]) => {
    setSelectedCall(call); setSelectedConversation(null); setDialogOpen(true);
  };
  const openConversationDetails = (conv: ELConversation) => {
    setSelectedConversation(conv); setSelectedCall(null); setDialogOpen(true);
  };

  const selectedClient = selectedCall ? mockClients.find(c => c.id === selectedCall.client_id) : null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Call Logs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and analyze all calls handled by AI receptionists.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={isMobile ? "sm" : "default"}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToCSV}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={exportToJSON}>Export as JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or summary..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px] shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="duration-desc">Longest Duration</SelectItem>
            <SelectItem value="duration-asc">Shortest Duration</SelectItem>
            <SelectItem value="messages-desc">Most Messages</SelectItem>
            <SelectItem value="messages-asc">Fewest Messages</SelectItem>
          </SelectContent>
        </Select>
        <CollapsibleFilters activeFiltersCount={activeFiltersCount} onReset={() => { setStatusFilter('all'); setClientFilter('all'); setOutcomeFilter('all'); }}>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.length > 0
                    ? agents.map(agent => (
                        <SelectItem key={agent.agent_id} value={agent.agent_id}>
                          {agent.name}
                        </SelectItem>
                      ))
                    : mockClients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Call Outcome</label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleFilters>
      </div>

      {/* Loading */}
      {convsLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading conversations from ElevenLabs…
        </div>
      )}

      {/* Calls - Mobile Card View */}
      {isMobile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 text-primary" />
            <span>
              {useRealData
                ? `All Conversations (${filteredConversations.length})`
                : `All Calls (${filteredCalls.length})`}
            </span>
          </div>
          {useRealData
            ? filteredConversations.map((conv) => {
                const ts = toISOTimestamp(conv);
                return (
                  <Card key={conv.conversation_id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={(conv.call_successful === 'success' || conv.call_successful === 'true') ? 'success' : 'secondary'} className="text-xs">
                            {(conv.call_successful === 'success' || conv.call_successful === 'true') ? 'successful' : conv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{conv.agent_name ?? conv.agent_id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{conv.call_duration_secs ?? 0}s · {conv.message_count ?? 0} msgs</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {format(new Date(ts), 'h:mm a')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(ts), 'MMM d')}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openConversationDetails(conv)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const link = document.createElement('a');
                              link.href = `${BACKEND_URL}/conversations/${conv.conversation_id}/audio`;
                              link.download = `conversation-${conv.conversation_id}.mp3`;
                              link.click();
                            }}>
                              <Download className="w-4 h-4 mr-2" />
                              Download Audio
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })
            : filteredCalls.map((call) => {
                const client = mockClients.find(c => c.id === call.client_id);
                return (
                  <Card key={call.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(call.status)}
                          <Badge variant={call.status === 'completed' ? 'success' : call.status === 'escalated' ? 'warning' : 'inactive'} className="text-xs">
                            {call.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">{client?.company_name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{call.caller_phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {format(new Date(call.timestamp), 'h:mm a')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(call.timestamp), 'MMM d')}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openCallDetails(call)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>
      ) : (
        /* Desktop Table View */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              {useRealData
                ? `All Conversations (${filteredConversations.length})`
                : `All Calls (${filteredCalls.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>Status</ResizableTableHeader>
                    <ResizableTableHeader columnKey="client" width={columnWidths.client} onResize={handleMouseDown}>Agent / Client</ResizableTableHeader>
                    <ResizableTableHeader columnKey="caller" width={columnWidths.caller} onResize={handleMouseDown}>
                      {useRealData ? 'Duration' : 'Caller'}
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="issue" width={columnWidths.issue} onResize={handleMouseDown}>
                      {useRealData ? 'Messages' : 'Issue'}
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="summary" width={columnWidths.summary} onResize={handleMouseDown}>Summary</ResizableTableHeader>
                    <ResizableTableHeader columnKey="time" width={columnWidths.time} onResize={handleMouseDown}>Time</ResizableTableHeader>
                    <ResizableTableHeader columnKey="actions" width={columnWidths.actions} onResize={handleMouseDown} isLast> </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {useRealData
                    ? filteredConversations.map((conv) => {
                        const ts = toISOTimestamp(conv);
                        const summaryText = extractSummary(undefined, conv);
                        return (
                          <tr key={conv.conversation_id} className="hover:bg-muted/50 transition-colors h-14">
                            <ResizableTableCell width={columnWidths.status}>
                              <Badge variant={(conv.call_successful === 'success' || conv.call_successful === 'true') ? 'success' : 'secondary'}>
                                {(conv.call_successful === 'success' || conv.call_successful === 'true') ? 'successful' : conv.status}
                              </Badge>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.client}>
                              <span className="font-medium text-sm truncate block max-w-full">{conv.agent_name ?? conv.agent_id}</span>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.caller} className="text-sm">
                              {conv.call_duration_secs ?? 0}s
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.issue}>
                              <span className="text-sm">{conv.message_count ?? 0}</span>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.summary}>
                              <span className="text-sm text-muted-foreground truncate block max-w-xs">
                                {summaryText || '—'}
                              </span>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.time}>
                              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">{format(new Date(ts), 'MMM d, h:mm a')}</span>
                              </div>
                            </ResizableTableCell>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openConversationDetails(conv)}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = `${BACKEND_URL}/conversations/${conv.conversation_id}/audio`;
                                    link.download = `conversation-${conv.conversation_id}.mp3`;
                                    link.click();
                                  }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Audio
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    : filteredCalls.map((call) => {
                        const client = mockClients.find(c => c.id === call.client_id);
                        return (
                          <tr key={call.id} className="hover:bg-muted/50 transition-colors h-14">
                            <ResizableTableCell width={columnWidths.status}>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(call.status)}
                                <Badge variant={call.status === 'completed' ? 'success' : call.status === 'escalated' ? 'warning' : 'inactive'}>
                                  {call.status}
                                </Badge>
                              </div>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.client}>
                              <span className="font-medium text-sm">{client?.company_name}</span>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.caller} className="font-mono text-sm">
                              {call.caller_phone}
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.issue}>
                              {call.pest_issue ? (
                                <Badge variant="outline" className="text-xs whitespace-nowrap">{call.pest_issue}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.summary}>
                              <span className="text-sm text-muted-foreground">{call.summary}</span>
                            </ResizableTableCell>
                            <ResizableTableCell width={columnWidths.time}>
                              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">{format(new Date(call.timestamp), 'MMM d, h:mm a')}</span>
                              </div>
                            </ResizableTableCell>
                            <td className="p-4">
                              <Button variant="ghost" size="sm" onClick={() => openCallDetails(call)}>
                                <MessageSquare className="w-4 h-4 mr-1" />View
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mock call details dialog */}
      <Dialog open={dialogOpen && !!selectedCall} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Call Details
              {selectedCall && (
                <Badge variant={selectedCall.status === 'completed' ? 'success' : selectedCall.status === 'escalated' ? 'warning' : 'inactive'}>
                  {selectedCall.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedCall && format(new Date(selectedCall.timestamp), 'MMMM d, yyyy at h:mm a')}
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Client</p><p className="font-medium">{selectedClient?.company_name}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Caller</p><p className="font-mono text-sm">{selectedCall.caller_phone}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Pest Issue</p><p>{selectedCall.pest_issue || 'Not identified'}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Call ID</p><p className="font-mono text-sm">{selectedCall.elevenlabs_call_id}</p></div>
              </div>
              <div className="space-y-2"><p className="text-sm text-muted-foreground">Summary</p><div className="p-3 rounded-md bg-muted border border-border"><p className="text-sm">{selectedCall.summary}</p></div></div>
              {selectedCall.transcript && (
                <div className="space-y-2"><p className="text-sm text-muted-foreground">Transcript</p>
                  <ScrollArea className="h-[200px] p-3 rounded-md bg-muted border border-border">
                    <p className="whitespace-pre-wrap text-sm">{selectedCall.transcript}</p>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Elegant real conversation details dialog */}
      <ConversationDetailDialog
        conv={selectedConversation}
        open={dialogOpen && !!selectedConversation}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
