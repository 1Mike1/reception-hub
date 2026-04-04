import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Plus, 
  Search,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddClientDialog } from '@/components/admin/AddClientDialog';
import { EditClientDialog } from '@/components/admin/EditClientDialog';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { mockClients } from '@/data/mockData';
import { Client } from '@/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAgents, useSetAgentArchived, useDeleteAgent } from '@/hooks/use-elevenlabs';
import { ELAgent } from '@/services/elevenLabsApi';
import { Loader2 } from 'lucide-react';
import { Archive, ArchiveRestore } from 'lucide-react';

/** Map an ElevenLabs agent to the Client shape expected by the UI */
function elAgentToClient(agent: ELAgent): Client {
  const meta = (agent.metadata ?? {}) as Record<string, unknown>;
  const createdAt = agent.created_at_unix_secs
    ? new Date(agent.created_at_unix_secs * 1000).toISOString()
    : new Date().toISOString();
  return {
    id: agent.agent_id,
    company_name: agent.name,
    business_email: (meta['email'] as string) ?? '',
    service_area: (meta['service_area'] as string) ?? '',
    subscription_plan: ((meta['subscription_plan'] as string) ?? 'starter') as Client['subscription_plan'],
    status: agent.archived ? 'inactive' : 'active',
    created_at: createdAt,
    updated_at: createdAt,
    avatar_url: (meta['avatar_url'] as string) ?? undefined,
  };
}

const defaultColumnWidths = {
  company: 200,
  service_area: 130,
  calls_7d: 90,
  last_call: 140,
  plan: 100,
  status: 100,
  created: 110,
  actions: 60,
};

export default function ClientsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const isMobile = useIsMobile();
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);

  // Fetch real agents from backend; fall back to mock data if unavailable
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const { mutate: setArchived, isPending: archivePending } = useSetAgentArchived();
  const { mutate: deleteAgentMutate, isPending: deletePending } = useDeleteAgent();
  const clients: Client[] = agentsData && agentsData.length > 0
    ? agentsData.map(elAgentToClient)
    : mockClients;

  const activeCount = clients.filter(c => c.status === 'active').length;
  const archivedCount = clients.filter(c => c.status !== 'active').length;

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.service_area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && client.status === 'active') ||
      (statusFilter === 'inactive' && client.status !== 'active');
    return matchesSearch && matchesStatus;
  });

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setEditClientOpen(true);
  };

  const handleDeleteAgent = (client: Client) => {
    if (window.confirm(`Are you sure you want to permanently delete "${client.company_name}"? This cannot be undone.`)) {
      deleteAgentMutate(client.id);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage all pest control companies using 2nd Wave AI.
          </p>
        </div>
        <Button onClick={() => setAddClientOpen(true)} size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search + Status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Status tab filter */}
        <div className="flex rounded-lg border border-border overflow-hidden h-10 shrink-0">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s === 'all' && `All (${clients.length})`}
              {s === 'active' && `Active (${activeCount})`}
              {s === 'inactive' && `Archived (${archivedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {agentsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading clients from ElevenLabs...</span>
        </div>
      )}

      {/* Clients - Mobile Card View */}
      {isMobile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            <span>All Clients ({filteredClients.length})</span>
          </div>
          {filteredClients.map((client) => {
            const elAgent = agentsData?.find(a => a.agent_id === client.id);
            const calls7d = elAgent?.last_7_day_call_count ?? 0;
            return (
            <Card key={client.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={client.avatar_url} alt={client.company_name} />
                    <AvatarFallback className="bg-primary/10 text-sm font-medium">
                      {client.company_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.service_area}{calls7d > 0 ? ` · ${calls7d} calls (7d)` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {client.subscription_plan}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/clients/${client.id}`}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditClient(client)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={archivePending}
                        onClick={() => setArchived({ agentId: client.id, archived: client.status === 'active' })}
                      >
                        {client.status === 'active'
                          ? <><Archive className="w-4 h-4 mr-2" />Archive</>
                          : <><ArchiveRestore className="w-4 h-4 mr-2" />Set Active</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive"
                        disabled={deletePending}
                        onClick={() => handleDeleteAgent(client)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
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
              <Building2 className="w-4 h-4 text-primary" />
            All Clients ({filteredClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="company" width={columnWidths.company} onResize={handleMouseDown}>
                      Company
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="service_area" width={columnWidths.service_area} onResize={handleMouseDown}>
                      Service Area
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="calls_7d" width={columnWidths.calls_7d} onResize={handleMouseDown}>
                      7d Calls
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="last_call" width={columnWidths.last_call} onResize={handleMouseDown}>
                      Last Call
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="plan" width={columnWidths.plan} onResize={handleMouseDown}>
                      Plan
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>
                      Status
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="created" width={columnWidths.created} onResize={handleMouseDown}>
                      Created
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="actions" width={columnWidths.actions} onResize={handleMouseDown} isLast>
                      
                    </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClients.map((client) => {
                    // Find matching EL agent for real data columns
                    const elAgent = agentsData?.find(a => a.agent_id === client.id);
                    const calls7d = elAgent?.last_7_day_call_count ?? 0;
                    const lastCallTs = elAgent?.last_call_time_unix_secs
                      ? new Date(elAgent.last_call_time_unix_secs * 1000)
                      : null;
                    return (
                      <tr key={client.id} className="hover:bg-muted/50 transition-colors h-14">
                        <ResizableTableCell width={columnWidths.company}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{client.company_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{client.business_email}</p>
                            </div>
                          </div>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.service_area}>
                          <span className="text-sm">{client.service_area}</span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.calls_7d}>
                          <span className="text-sm font-medium">{calls7d}</span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.last_call}>
                          <span className="text-sm text-muted-foreground">
                            {lastCallTs ? format(lastCallTs, 'MMM d, h:mm a') : '—'}
                          </span>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.plan}>
                          <Badge variant="secondary" className="capitalize text-xs whitespace-nowrap">
                            {client.subscription_plan}
                          </Badge>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.status}>
                          <Badge variant={client.status === 'active' ? 'active' : 'inactive'}>
                            {client.status === 'active' ? 'Active' : 'Archived'}
                          </Badge>
                        </ResizableTableCell>
                        <ResizableTableCell width={columnWidths.created}>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(client.created_at), 'MMM d, yyyy')}
                          </span>
                        </ResizableTableCell>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/clients/${client.id}`}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={archivePending}
                                onClick={() => setArchived({ agentId: client.id, archived: client.status === 'active' })}
                              >
                                {client.status === 'active'
                                  ? <><Archive className="w-4 h-4 mr-2" />Archive</>
                                  : <><ArchiveRestore className="w-4 h-4 mr-2" />Set Active</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive"
                                disabled={deletePending}
                                onClick={() => handleDeleteAgent(client)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      <EditClientDialog open={editClientOpen} onOpenChange={setEditClientOpen} client={selectedClient} />
    </div>
  );
}
