import { useState, useMemo, useCallback } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { cn } from '@/lib/utils';
import { useAuditLogs } from '@/hooks/use-elevenlabs';
import type { AuditLogEntry } from '@/services/elevenLabsApi';
import { AuditAction } from '@/types';
import { Search, CalendarIcon, Loader2 } from 'lucide-react';

const actionLabels: Record<AuditAction, string> = {
  user_login: 'User Login',
  user_logout: 'User Logout',
  client_created: 'Client Created',
  client_updated: 'Client Updated',
  client_suspended: 'Client Suspended',
  client_reactivated: 'Client Reactivated',
  plan_created: 'Plan Created',
  plan_updated: 'Plan Updated',
  plan_assigned: 'Plan Assigned',
  plan_changed: 'Plan Changed',
  override_applied: 'Override Applied',
  override_removed: 'Override Removed',
  agent_id_changed: 'Agent ID Changed',
  usage_limit_extended: 'Usage Limit Extended',
  service_manually_enabled: 'Service Enabled',
  service_manually_suspended: 'Service Suspended',
  webhook_error_acknowledged: 'Webhook Error Acknowledged',
};

const getActionVariant = (action: string): 'default' | 'destructive' | 'outline' | 'secondary' | 'success' => {
  if (['client_suspended', 'service_manually_suspended'].includes(action)) return 'destructive';
  if (['user_login', 'user_logout'].includes(action)) return 'secondary';
  if (['client_created', 'plan_created', 'client_reactivated', 'service_manually_enabled'].includes(action)) return 'success';
  return 'outline';
};

/** Get label for an action, falling back to the raw action string */
const getActionLabel = (action: string): string => {
  return actionLabels[action as AuditAction] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const defaultColumnWidths = {
  event: 180,
  actor: 200,
  timestamp: 260,
  description: 300,
  ip_address: 140,
};

const ROWS_PER_PAGE = 50;

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);

  // Fetch audit logs from backend
  const { data: auditData, isLoading } = useAuditLogs({
    page: currentPage,
    page_size: ROWS_PER_PAGE,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    search: searchQuery || undefined,
  });

  const allLogs = auditData?.logs ?? [];
  const totalEntries = auditData?.total ?? 0;
  const totalPages = auditData?.total_pages ?? 1;

  const activeFiltersCount = [
    actionFilter !== 'all',
    entityFilter !== 'all',
    dateFrom !== undefined,
    dateTo !== undefined,
  ].filter(Boolean).length;

  // Client-side date filtering (backend handles text/action/entity filters)
  const filteredLogs = useMemo(() => {
    if (!dateFrom && !dateTo) return allLogs;
    return allLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      if (dateFrom && dateTo) {
        return isWithinInterval(logDate, {
          start: startOfDay(dateFrom),
          end: endOfDay(dateTo),
        });
      } else if (dateFrom) {
        return logDate >= startOfDay(dateFrom);
      } else if (dateTo) {
        return logDate <= endOfDay(dateTo);
      }
      return true;
    });
  }, [allLogs, dateFrom, dateTo]);

  const paginatedLogs = filteredLogs;

  const handleFilterChange = useCallback((setter: (value: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const getEntityName = (entityType: string, entityId: string) => {
    if (entityType === 'client') {
      return `Client #${entityId.slice(0, 8)}`;
    }
    if (entityType === 'user') {
      return `User #${entityId.slice(0, 8)}`;
    }
    if (entityType === 'agent') {
      return `Agent #${entityId.slice(0, 8)}`;
    }
    return `${entityType} #${entityId.slice(0, 8)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toISOString().replace('Z', '+05:30').slice(0, -1);
  };

  const clearDateFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Event ID', 'Event', 'Actor', 'Timestamp', 'Description', 'IP Address', 'Entity Type', 'Entity ID', 'Reason', 'Previous Value', 'New Value'];
    const rows = filteredLogs.map(log => [
      log.id,
      actionLabels[log.action as AuditAction] || log.action,
      log.admin_email,
      formatTimestamp(log.timestamp),
      log.description,
      log.ip_address,
      log.entity_type,
      log.entity_id,
      log.details.reason || '',
      log.details.previous_value ? JSON.stringify(log.details.previous_value) : '',
      log.details.new_value ? JSON.stringify(log.details.new_value) : '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportToJSON = () => {
    const exportData = filteredLogs.map(log => ({
      id: log.id,
      event: actionLabels[log.action as AuditAction] || log.action,
      action: log.action,
      actor: log.admin_email,
      admin_id: log.admin_id,
      timestamp: formatTimestamp(log.timestamp),
      description: log.description,
      ip_address: log.ip_address,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: log.details,
    }));
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <Button
          key={i}
          variant={i === currentPage ? 'default' : 'outline'}
          size="sm"
          onClick={() => goToPage(i)}
          className="min-w-[40px]"
        >
          {i}
        </Button>
      );
    }
    
    return buttons;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            View all administrative actions and system events. Logs are read-only.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Read-only audit trail</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by admin email, description, or reason..."
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
            className="pl-10"
          />
        </div>
        <CollapsibleFilters activeFiltersCount={activeFiltersCount} onReset={() => {
          setActionFilter('all');
          setEntityFilter('all');
          setDateFrom(undefined);
          setDateTo(undefined);
          setCurrentPage(1);
        }}>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={actionFilter} onValueChange={(v) => handleFilterChange(setActionFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {Object.entries(actionLabels).map(([action, label]) => (
                    <SelectItem key={action} value={action}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityFilter} onValueChange={(v) => handleFilterChange(setEntityFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="plan">Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateFrom ? format(dateFrom, "PP") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => handleFilterChange(setDateFrom, d)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateTo ? format(dateTo, "PP") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => handleFilterChange(setDateTo, d)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={clearDateFilters} className="w-full">
                  Clear dates
                </Button>
              )}
            </div>
          </div>
        </CollapsibleFilters>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Loading audit logs...</span>
            </div>
          ) : (
          <>
          {/* Mobile View */}
          <div className="md:hidden divide-y divide-border">
            {paginatedLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No audit logs found matching your filters.
              </div>
            ) : (
              paginatedLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={getActionVariant(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground truncate">{log.admin_email}</p>
                    <p className="truncate">{log.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <ResizableTableHeader
                    columnKey="event"
                    width={columnWidths.event}
                    onResize={handleMouseDown}
                  >
                    Event
                  </ResizableTableHeader>
                  <ResizableTableHeader
                    columnKey="actor"
                    width={columnWidths.actor}
                    onResize={handleMouseDown}
                  >
                    Actor
                  </ResizableTableHeader>
                  <ResizableTableHeader
                    columnKey="timestamp"
                    width={columnWidths.timestamp}
                    onResize={handleMouseDown}
                  >
                    Timestamp
                  </ResizableTableHeader>
                  <ResizableTableHeader
                    columnKey="description"
                    width={columnWidths.description}
                    onResize={handleMouseDown}
                  >
                    Description
                  </ResizableTableHeader>
                  <ResizableTableHeader
                    columnKey="ip_address"
                    width={columnWidths.ip_address}
                    onResize={handleMouseDown}
                    isLast
                  >
                    IP Address
                  </ResizableTableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit logs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-muted/50 cursor-pointer transition-colors h-14"
                      onClick={() => setSelectedLog(log)}
                    >
                      <ResizableTableCell width={columnWidths.event}>
                        <Badge variant={getActionVariant(log.action)} className="whitespace-nowrap">
                          {getActionLabel(log.action)}
                        </Badge>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.actor}>
                        <span className="text-sm">{log.admin_email}</span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.timestamp} className="font-mono text-sm">
                        {formatTimestamp(log.timestamp)}
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.description}>
                        <span className="text-sm text-muted-foreground">
                          {log.description}
                        </span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.ip_address} className="font-mono text-sm">
                        {log.ip_address}
                      </ResizableTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} to {Math.min(currentPage * ROWS_PER_PAGE, totalEntries)} of {totalEntries} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {renderPaginationButtons()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {totalPages <= 1 && !isLoading && (
        <div className="text-sm text-muted-foreground text-center">
          {totalEntries === 0 ? 'No audit logs recorded yet. Actions will appear here as they occur.' : `Showing ${totalEntries} log entries`}
        </div>
      )}

      {/* Notion-style Detail Sidebar */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader className="space-y-4">
                <div>
                  <Badge variant={getActionVariant(selectedLog.action)} className="mb-2">
                    {getActionLabel(selectedLog.action)}
                  </Badge>
                  <SheetTitle className="text-xl">{selectedLog.description}</SheetTitle>
                </div>
                <SheetDescription className="font-mono text-xs">
                  {formatTimestamp(selectedLog.timestamp)}
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Event Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Event ID</span>
                      <span className="font-mono text-sm">{selectedLog.id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Action</span>
                      <span>{getActionLabel(selectedLog.action)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Entity Type</span>
                      <span className="capitalize">{selectedLog.entity_type}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Entity</span>
                      <span>{getEntityName(selectedLog.entity_type, selectedLog.entity_id)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Actor Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Admin Email</span>
                      <span className="text-sm">{selectedLog.admin_email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Admin ID</span>
                      <span className="font-mono text-sm">{selectedLog.admin_id}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">IP Address</span>
                      <span className="font-mono text-sm">{selectedLog.ip_address}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Change Details
                  </h3>
                  
                  {selectedLog.details.reason && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Reason</p>
                      <p className="text-sm text-muted-foreground">{selectedLog.details.reason}</p>
                    </div>
                  )}

                  {selectedLog.details.previous_value && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Previous Value</p>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedLog.details.previous_value, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.details.new_value && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">New Value</p>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedLog.details.new_value, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!selectedLog.details.reason && !selectedLog.details.previous_value && !selectedLog.details.new_value && (
                    <p className="text-sm text-muted-foreground">No additional details available.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
