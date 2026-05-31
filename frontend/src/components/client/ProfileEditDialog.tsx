import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUpdateClientProfile } from '@/hooks/use-clients';
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
  const { toast } = useToast();
  const updateProfile = useUpdateClientProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    business_email: '',
    service_area: '',
  });

  // Reset form when dialog opens or client changes
  useEffect(() => {
    if (open && client) {
      setFormData({
        company_name: client.company_name || '',
        business_email: client.business_email || '',
        service_area: client.service_area || '',
      });
      setSubmitted(false);
    }
  }, [open, client]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client?.business_email) {
      toast({
        title: 'Error',
        description: 'Unable to submit update. Please try again.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if there are any changes
    const hasChanges = 
      formData.company_name !== client.company_name ||
      formData.business_email !== client.business_email ||
      formData.service_area !== (client.service_area || '');

    if (!hasChanges) {
      toast({
        title: 'No Changes',
        description: 'No changes to submit.',
      });
      return;
    }

    setIsSubmitting(true);

    updateProfile.mutate(
      {
        currentEmail: client.business_email,
        data: {
          email: formData.business_email !== client.business_email ? formData.business_email : undefined,
          company_name: formData.company_name !== client.company_name ? formData.company_name : undefined,
          service_area: formData.service_area !== (client.service_area || '') ? formData.service_area : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Profile Updated',
            description: 'Your profile has been updated successfully.',
          });
          setSubmitted(true);
          setTimeout(() => {
            onOpenChange(false);
            setSubmitted(false);
          }, 1500);
        },
        onError: (error) => {
          toast({
            title: 'Update Failed',
            description: error instanceof Error ? error.message : 'Failed to update profile.',
            variant: 'destructive',
          });
        },
        onSettled: () => {
          setIsSubmitting(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your company information and contact details.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <p className="font-medium">Profile Updated!</p>
            <p className="text-sm text-muted-foreground text-center">
              Your profile has been updated successfully.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
