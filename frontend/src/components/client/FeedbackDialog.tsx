import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Send, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  clientEmail: string;
}

export function FeedbackDialog({ open, onOpenChange, clientId, clientName, clientEmail }: FeedbackDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackType || !title || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    if (title.length > 50) {
      toast.error('Title must be 50 characters or less');
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert feedback into Supabase
      const { error: feedbackError } = await supabase
        .from('user_feedback')
        .insert({
          client_id: clientId,
          client_name: clientName,
          client_email: clientEmail,
          feedback_type: feedbackType,
          title: title,
          message: message,
          status: 'new',
        });

      if (feedbackError) throw feedbackError;

      // Create notification for admins
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'feedback',
          title: `[Client Feedback] ${title}`,
          message: `${clientName} submitted ${feedbackType} feedback`,
          link: '/admin/feedback',
          is_admin_notification: true,
          target_user_id: null,
        });

      if (notifError) throw notifError;

      setSubmitted(true);
      toast.success('Feedback submitted successfully!');

      // Reset after showing success
      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
        setFeedbackType('');
        setTitle('');
        setMessage('');
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Share your thoughts with us. Your feedback helps us improve our service.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium">Thank you for your feedback!</p>
            <p className="text-sm text-muted-foreground text-center">
              Our team will review it shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-type">Feedback Type</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger id="feedback-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="praise">Praise</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-muted-foreground text-xs">({title.length}/50)</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief title (4-5 words)"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Please share your detailed feedback here..."
                className="min-h-[120px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Feedback
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
