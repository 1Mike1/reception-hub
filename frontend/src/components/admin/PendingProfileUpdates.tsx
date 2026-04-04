import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, User, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ProfileUpdate {
  id: string;
  client_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  created_at: string;
}

interface PendingProfileUpdatesProps {
  clientId?: string; // Optional: filter by client
}

export function PendingProfileUpdates({ clientId }: PendingProfileUpdatesProps) {
  const [updates, setUpdates] = useState<ProfileUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchUpdates = async () => {
    try {
      let query = supabase
        .from('profile_updates')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Error fetching profile updates:', error);
      toast.error('Failed to load profile updates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('profile-updates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile_updates',
        },
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleApprove = async (update: ProfileUpdate) => {
    setProcessingIds(prev => new Set(prev).add(update.id));

    try {
      // Update the profile_updates status
      const { error: updateError } = await supabase
        .from('profile_updates')
        .update({ status: 'approved' })
        .eq('id', update.id);

      if (updateError) throw updateError;

      // Apply the change to the clients table
      const { error: clientError } = await supabase
        .from('clients')
        .update({ [update.field_name]: update.new_value })
        .eq('user_id', update.client_id);

      if (clientError) throw clientError;

      // Create notification for the client
      await supabase.from('notifications').insert({
        type: 'profile_update_approved',
        title: 'Profile Update Approved',
        message: `Your ${update.field_name.replace('_', ' ')} has been updated`,
        target_user_id: update.client_id,
        is_admin_notification: false,
      });

      toast.success('Profile update approved');
      setUpdates(prev => prev.filter(u => u.id !== update.id));
    } catch (error) {
      console.error('Error approving update:', error);
      toast.error('Failed to approve update');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(update.id);
        return next;
      });
    }
  };

  const handleReject = async (update: ProfileUpdate) => {
    setProcessingIds(prev => new Set(prev).add(update.id));

    try {
      const { error } = await supabase
        .from('profile_updates')
        .update({ status: 'rejected' })
        .eq('id', update.id);

      if (error) throw error;

      // Notify the client
      await supabase.from('notifications').insert({
        type: 'profile_update_rejected',
        title: 'Profile Update Rejected',
        message: `Your request to update ${update.field_name.replace('_', ' ')} was not approved`,
        target_user_id: update.client_id,
        is_admin_notification: false,
      });

      toast.success('Profile update rejected');
      setUpdates(prev => prev.filter(u => u.id !== update.id));
    } catch (error) {
      console.error('Error rejecting update:', error);
      toast.error('Failed to reject update');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(update.id);
        return next;
      });
    }
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Pending Profile Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending profile updates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Pending Profile Updates
          <Badge variant="secondary" className="ml-2">{updates.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {updates.map((update) => (
          <div
            key={update.id}
            className="p-4 rounded-lg border bg-muted/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Badge variant="outline">{formatFieldName(update.field_name)}</Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <div className="flex-1 p-2 rounded bg-destructive/10 text-destructive">
                <span className="text-xs text-muted-foreground block mb-1">Current</span>
                {update.old_value || '(empty)'}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 p-2 rounded bg-success/10 text-success">
                <span className="text-xs text-muted-foreground block mb-1">Requested</span>
                {update.new_value || '(empty)'}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleApprove(update)}
                disabled={processingIds.has(update.id)}
                className="gap-1"
              >
                {processingIds.has(update.id) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(update)}
                disabled={processingIds.has(update.id)}
                className="gap-1"
              >
                <X className="w-3 h-3" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
