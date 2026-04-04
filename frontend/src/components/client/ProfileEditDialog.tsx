import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ClientProfile } from '@/hooks/use-client-profile';

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientProfile | null;
}

export function ProfileEditDialog({
  open,
  onOpenChange,
  client,
}: ProfileEditDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    business_email: '',
    service_area: '',
    avatar_url: '',
  });

  // Reset form when dialog opens or client changes
  useEffect(() => {
    if (open && client) {
      setFormData({
        company_name: client.company_name || '',
        business_email: client.business_email || '',
        service_area: client.service_area || '',
        avatar_url: client.avatar_url || '',
      });
      setSubmitted(false);
    }
  }, [open, client]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id || !client) {
      toast.error('Unable to submit update. Please try again.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const changes = [];
      
      if (formData.company_name !== client.company_name) {
        changes.push({
          client_id: user.id, // Use auth user ID for RLS
          field_name: 'company_name',
          old_value: client.company_name || '',
          new_value: formData.company_name,
          status: 'pending',
        });
      }
      if (formData.business_email !== client.business_email) {
        changes.push({
          client_id: user.id,
          field_name: 'business_email',
          old_value: client.business_email || '',
          new_value: formData.business_email,
          status: 'pending',
        });
      }
      if (formData.service_area !== (client.service_area || '')) {
        changes.push({
          client_id: user.id,
          field_name: 'service_area',
          old_value: client.service_area || '',
          new_value: formData.service_area,
          status: 'pending',
        });
      }

      if (changes.length === 0) {
        toast.info('No changes to submit');
        setIsSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('profile_updates')
        .insert(changes);

      if (updateError) throw updateError;

      // Create notification for admins
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'profile_update',
          title: 'Profile Update Request',
          message: `${client.company_name} requested profile changes`,
          link: `/admin/clients/${client.id}`,
          is_admin_notification: true,
          target_user_id: null,
        });

      if (notifError) console.error('Failed to create notification:', notifError);

      setSubmitted(true);
      toast.success('Profile update request submitted');

      setTimeout(() => {
        onOpenChange(false);
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting profile update:', error);
      toast.error('Failed to submit update. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = client?.company_name
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Changes will be reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium">Update Requested!</p>
            <p className="text-sm text-muted-foreground text-center">
              Your profile changes are pending review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={formData.avatar_url} alt={formData.company_name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => toast.info('Avatar upload coming soon')}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_email">Business Email</Label>
              <Input
                id="business_email"
                type="email"
                value={formData.business_email}
                onChange={(e) => handleChange('business_email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_area">Service Area</Label>
              <Input
                id="service_area"
                value={formData.service_area}
                onChange={(e) => handleChange('service_area', e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
