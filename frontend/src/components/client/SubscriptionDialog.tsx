import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SUBSCRIPTION_PLANS } from '@/types';

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentPlan: string;
}

export function SubscriptionDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentPlan,
}: SubscriptionDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (selectedPlan === currentPlan) {
      toast.info('Please select a different plan');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create subscription change request
      const { error: requestError } = await supabase
        .from('subscription_change_requests')
        .insert({
          client_id: clientId,
          client_name: clientName,
          current_plan: currentPlan,
          requested_plan: selectedPlan,
          status: 'pending',
        });

      if (requestError) throw requestError;

      // Create notification for admin
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'subscription_change',
          title: 'Subscription Change Request',
          message: `${clientName} requested to change from ${currentPlan} to ${selectedPlan} plan`,
          link: `/admin/clients/${clientId}`,
          is_admin_notification: true,
          target_user_id: null,
        });

      if (notifError) throw notifError;

      setSubmitted(true);
      toast.success('Subscription change request submitted');

      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
        setSelectedPlan(currentPlan);
      }, 2000);
    } catch (error) {
      console.error('Error submitting subscription change:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPlanLabel = SUBSCRIPTION_PLANS.find(p => p.value === currentPlan)?.label || currentPlan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscription</DialogTitle>
          <DialogDescription>
            Manage your subscription plan
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium">Request Submitted!</p>
            <p className="text-sm text-muted-foreground text-center">
              Your subscription change request has been submitted.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="font-semibold text-lg">{currentPlanLabel}</p>
              </div>
              <Badge variant="active">Active</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-plan">Change to</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger id="new-plan">
                  <SelectValue placeholder="Select plan..." />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                      {plan.value === currentPlan && ' (Current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Subscription changes may take up to 24 hours to process, though most changes are effective within minutes.
              </AlertDescription>
            </Alert>

            {selectedPlan !== currentPlan && selectedPlan && (
              <Alert variant="default" className="border-warning/50 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  Changing your plan may affect your included minutes and features.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedPlan === currentPlan}
              >
                {isSubmitting ? 'Submitting...' : 'Request Change'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
