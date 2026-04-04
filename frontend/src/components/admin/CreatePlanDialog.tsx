import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePlanDialog({ open, onOpenChange }: CreatePlanDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monthlyPrice: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Plan name is required.',
        variant: 'destructive',
      });
      return;
    }

    // In a real app, this would create the plan and return an ID
    const newPlanId = `plan_${formData.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    toast({
      title: 'Plan Created',
      description: `${formData.name} has been created. Configure its details now.`,
    });

    onOpenChange(false);
    setFormData({ name: '', description: '', monthlyPrice: '' });
    
    // Navigate to the plan detail page for full configuration
    navigate(`/admin/plans/${newPlanId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Plan</DialogTitle>
          <DialogDescription>
            Create a new subscription plan. You'll configure all details on the next screen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Enterprise"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Internal)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief internal description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
            <Input
              id="monthlyPrice"
              type="number"
              value={formData.monthlyPrice}
              onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create & Configure
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
