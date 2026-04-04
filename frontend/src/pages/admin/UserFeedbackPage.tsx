import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, MessageSquare, Send, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface Feedback {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  feedback_type: string;
  title: string;
  message: string;
  status: string;
  admin_notes: string | null;
  clarity_request: string | null;
  clarity_response: string | null;
  created_at: string;
  updated_at: string;
}

const defaultColumnWidths = {
  date: 140,
  client: 180,
  type: 100,
  title: 200,
  status: 120,
  actions: 100,
};

const statusOptions = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'reviewing', label: 'Reviewing', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  { value: 'implemented', label: 'Implemented', color: 'bg-green-100 text-green-700' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-700' },
  { value: 'needs_clarity', label: 'Needs Clarity', color: 'bg-orange-100 text-orange-700' },
];

const typeLabels: Record<string, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug Report',
  question: 'Question',
  praise: 'Praise',
  other: 'Other',
};

export default function UserFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [clarityRequest, setClarityRequest] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('user_feedback_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_feedback' },
        () => {
          fetchFeedbacks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.admin_notes || '');
    setClarityRequest(feedback.clarity_request || '');
    setSheetOpen(true);
  };

  const handleStatusChange = async (feedbackId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', feedbackId);

      if (error) throw error;

      toast.success('Status updated');
      if (selectedFeedback) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedFeedback) return;

    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedFeedback.id);

      if (error) throw error;
      toast.success('Notes saved');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleRequestClarity = async () => {
    if (!selectedFeedback || !clarityRequest.trim()) return;

    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({
          clarity_request: clarityRequest,
          status: 'needs_clarity',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedFeedback.id);

      if (error) throw error;

      // Create notification for the client (in real app, this would trigger an email)
      await supabase.from('notifications').insert({
        type: 'clarity_request',
        title: 'Clarification Needed',
        message: `Admin requested clarification on your feedback: "${selectedFeedback.title}"`,
        link: '/dashboard',
        target_user_id: selectedFeedback.client_id,
        is_admin_notification: false,
      });

      toast.success('Clarity request sent');
      setSelectedFeedback({ ...selectedFeedback, clarity_request: clarityRequest, status: 'needs_clarity' });
    } catch (error) {
      console.error('Error requesting clarity:', error);
      toast.error('Failed to send clarity request');
    }
  };

  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

  const filteredFeedbacks = feedbacks.filter((feedback) => {
    const matchesSearch =
      feedback.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feedback.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feedback.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || feedback.status === statusFilter;
    const matchesType = typeFilter === 'all' || feedback.feedback_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find((s) => s.value === status);
    return (
      <Badge variant="outline" className={statusConfig?.color || ''}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Feedback</h1>
        <p className="text-muted-foreground">Review and manage feedback from clients</p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search feedback..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CollapsibleFilters activeFiltersCount={activeFiltersCount}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="praise">Praise</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleFilters>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            All Feedback ({filteredFeedbacks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading feedback...</p>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No feedback found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="date" width={columnWidths.date} onResize={handleMouseDown}>
                      Date
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="client" width={columnWidths.client} onResize={handleMouseDown}>
                      Client
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="type" width={columnWidths.type} onResize={handleMouseDown}>
                      Type
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="title" width={columnWidths.title} onResize={handleMouseDown}>
                      Title
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>
                      Status
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="actions" width={columnWidths.actions} onResize={handleMouseDown} isLast>
                      
                    </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFeedbacks.map((feedback) => (
                    <tr
                      key={feedback.id}
                      className="hover:bg-muted/50 transition-colors h-14 cursor-pointer"
                      onClick={() => handleOpenFeedback(feedback)}
                    >
                      <ResizableTableCell width={columnWidths.date}>
                        <span className="text-sm">
                          {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                        </span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.client}>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{feedback.client_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{feedback.client_email}</p>
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.type}>
                        <Badge variant="outline">{typeLabels[feedback.feedback_type] || feedback.feedback_type}</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.title}>
                        <span className="font-medium">{feedback.title}</span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.status}>
                        {getStatusBadge(feedback.status)}
                      </ResizableTableCell>
                      <td className="p-4">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenFeedback(feedback); }}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedFeedback && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedFeedback.title}</SheetTitle>
                <SheetDescription>
                  From {selectedFeedback.client_name} • {format(new Date(selectedFeedback.created_at), 'MMM d, yyyy h:mm a')}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={(value) => handleStatusChange(selectedFeedback.id, value)}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Feedback Type */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Badge variant="outline" className="text-sm">
                    {typeLabels[selectedFeedback.feedback_type] || selectedFeedback.feedback_type}
                  </Badge>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label>Message</Label>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.message}</p>
                  </div>
                </div>

                {/* Clarity Request/Response */}
                {selectedFeedback.clarity_response && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      Client Response
                    </Label>
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <p className="text-sm whitespace-pre-wrap">{selectedFeedback.clarity_response}</p>
                    </div>
                  </div>
                )}

                {/* Request Clarity */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Ask for Clarification
                  </Label>
                  <Textarea
                    placeholder="What additional information do you need?"
                    value={clarityRequest}
                    onChange={(e) => setClarityRequest(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRequestClarity}
                    disabled={!clarityRequest.trim()}
                    className="gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Request
                  </Button>
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label>Admin Notes</Label>
                  <Textarea
                    placeholder="Add internal notes about this feedback..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button size="sm" onClick={handleSaveNotes} className="gap-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Save Notes
                  </Button>
                </div>

                {/* Client Info */}
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-muted-foreground">Client Information</Label>
                  <div className="text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {selectedFeedback.client_name}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedFeedback.client_email}</p>
                    <p><span className="text-muted-foreground">Client ID:</span> {selectedFeedback.client_id}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
