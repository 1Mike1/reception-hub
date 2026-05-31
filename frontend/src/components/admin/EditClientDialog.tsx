import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useUpdateClient } from '@/hooks/use-clients';
import { Loader2, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Client } from '@/types';
import { mockPlans, mockAgents, mockClientPlanAssignments } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

// Validation schema
const formSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100, 'Company name must be less than 100 characters'),
  business_email: z.string().min(1, 'Business email is required').email('Invalid email address'),
  service_area: z.string().optional(),
  assigned_plan_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  elevenlabs_agent_id: z.string().optional(),
  linked_phone_numbers: z.string().optional(),
  webhook_processing_enabled: z.boolean(),
  dynamic_variables: z.string().optional(),
  escalation_notes: z.string().optional(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

type SectionKey = 'company' | 'elevenlabs' | 'advanced';

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const updateClient = useUpdateClient();
  const [openSections, setOpenSections] = useState<SectionKey[]>(['company']);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState({
    company_name: '',
    business_email: '',
    service_area: '',
    assigned_plan_id: '',
    status: 'active' as 'active' | 'inactive' | 'suspended',
    elevenlabs_agent_id: '',
    linked_phone_numbers: '',
    webhook_processing_enabled: true,
    webhook_status: 'No Data' as 'Connected' | 'No Data' | 'Error',
    last_webhook_received: '',
    dynamic_variables: '',
    escalation_notes: '',
  });

  const activePlans = mockPlans.filter(p => p.status === 'active');

  useEffect(() => {
    if (client) {
      setFormData({
        company_name: client.company_name,
        business_email: client.business_email,
        service_area: client.service_area || '',
        assigned_plan_id: '',
        status: client.status,
        elevenlabs_agent_id: (client as any).agent_id || '',
        linked_phone_numbers: '',
        webhook_processing_enabled: true,
        webhook_status: 'No Data',
        last_webhook_received: '',
        dynamic_variables: '',
        escalation_notes: '',
      });
      setOpenSections(['company']);
      setErrors({});
    }
  }, [client]);

  const validateField = (field: string, value: any): string | undefined => {
    const fieldSchema = formSchema.shape[field as keyof typeof formSchema.shape];
    if (!fieldSchema) return undefined;
    const result = fieldSchema.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message;
    }
    return undefined;
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const sectionsWithErrors = useMemo(() => {
    const sections = new Set<SectionKey>();
    const fieldSectionMap: Record<string, SectionKey> = {
      company_name: 'company',
      business_email: 'company',
      service_area: 'company',
      assigned_plan_id: 'company',
      status: 'company',
      elevenlabs_agent_id: 'elevenlabs',
      linked_phone_numbers: 'elevenlabs',
      webhook_processing_enabled: 'elevenlabs',
      dynamic_variables: 'advanced',
      escalation_notes: 'advanced',
    };
    Object.keys(errors).forEach(field => {
      if (errors[field as keyof FormErrors]) {
        const section = fieldSectionMap[field];
        if (section) sections.add(section);
      }
    });
    return sections;
  }, [errors]);

  const sectionCompletion = useMemo(() => ({
    company: !!(formData.company_name && formData.business_email && !errors.company_name && !errors.business_email),
    elevenlabs: !!formData.elevenlabs_agent_id,
    advanced: !!(formData.escalation_notes),
  }), [formData, errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = formSchema.safeParse(formData);
    
    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as string;
        newErrors[field as keyof FormErrors] = err.message;
      });
      setErrors(newErrors);
      toast({
        title: 'Validation Error',
        description: 'Please fix the highlighted errors and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!client) return;

    setIsSubmitting(true);
    
    updateClient.mutate(
      {
        id: client.id,
        data: {
          email: formData.business_email,
          company_name: formData.company_name,
          agent_id: formData.elevenlabs_agent_id,
          service_area: formData.service_area,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Client Updated',
            description: `${formData.company_name} has been updated successfully.`,
          });
          setIsSubmitting(false);
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: 'Update Failed',
            description: error instanceof Error ? error.message : 'Failed to update client',
            variant: 'destructive',
          });
          setIsSubmitting(false);
        },
      }
    );
  };

  const SectionHeader = ({ 
    section, 
    title, 
    isOpen 
  }: { 
    section: SectionKey; 
    title: string; 
    isOpen: boolean; 
  }) => {
    const hasError = sectionsWithErrors.has(section);
    const isComplete = sectionCompletion[section];
    
    return (
      <CollapsibleTrigger 
        onClick={() => toggleSection(section)}
        className={cn(
          "flex items-center justify-between w-full py-3 px-4 rounded-lg transition-colors",
          hasError 
            ? "bg-destructive/10 border border-destructive/30 hover:bg-destructive/15" 
            : "bg-muted/50 hover:bg-muted"
        )}
      >
        <div className="flex items-center gap-3">
          {hasError ? (
            <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-white" />
            </div>
          ) : isComplete ? (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
    );
  };

  const formatWebhookStatus = (status: string) => {
    switch (status) {
      case 'Connected':
        return <span className="text-sm font-medium text-primary">Connected</span>;
      case 'Error':
        return <span className="text-sm font-medium text-destructive">Error</span>;
      default:
        return <span className="text-sm text-muted-foreground">No Data</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Client</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Update client information and ElevenLabs integration settings.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          {/* Section 1: Company Information */}
          <Collapsible open={openSections.includes('company')}>
            <SectionHeader section="company" title="Company Information" isOpen={openSections.includes('company')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit_company_name">Company Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="edit_company_name"
                      placeholder="Company name"
                      value={formData.company_name}
                      onChange={(e) => updateFormData('company_name', e.target.value)}
                      className={cn(errors.company_name && "border-destructive focus-visible:ring-destructive")}
                    />
                    {errors.company_name && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.company_name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_business_email">Business Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="edit_business_email"
                      type="email"
                      placeholder="info@company.com"
                      value={formData.business_email}
                      onChange={(e) => updateFormData('business_email', e.target.value)}
                      className={cn(errors.business_email && "border-destructive focus-visible:ring-destructive")}
                    />
                    {errors.business_email && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.business_email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_service_area">Service Area</Label>
                  <Input
                    id="edit_service_area"
                    placeholder="Austin, TX"
                    value={formData.service_area}
                    onChange={(e) => updateFormData('service_area', e.target.value)}
                  />
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Assigned Plan</Label>
                    <Select 
                      value={formData.assigned_plan_id}
                      onValueChange={(v) => updateFormData('assigned_plan_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {activePlans.map(plan => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ${plan.monthlyPrice}/mo
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={formData.status}
                      onValueChange={(v) => updateFormData('status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2: ElevenLabs Integration */}
          <Collapsible open={openSections.includes('elevenlabs')}>
            <SectionHeader section="elevenlabs" title="ElevenLabs Integration" isOpen={openSections.includes('elevenlabs')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit_elevenlabs_agent_id">ElevenLabs Agent ID</Label>
                    <Input
                      id="edit_elevenlabs_agent_id"
                      placeholder="agent_abc123xyz"
                      value={formData.elevenlabs_agent_id}
                      onChange={(e) => updateFormData('elevenlabs_agent_id', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to link this client with call data, transcripts, and usage coming from ElevenLabs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_linked_phone_numbers">Linked Phone Number(s)</Label>
                    <Input
                      id="edit_linked_phone_numbers"
                      placeholder="+1 (512) 555-0101, +1 (512) 555-0102"
                      value={formData.linked_phone_numbers}
                      onChange={(e) => updateFormData('linked_phone_numbers', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Phone numbers routed to this agent in ElevenLabs.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div>
                    <p className="font-medium text-foreground text-sm">Webhook Processing Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Controls whether our system processes incoming ElevenLabs webhook events for this client. This does not enable or disable webhooks in ElevenLabs.
                    </p>
                  </div>
                  <Switch
                    checked={formData.webhook_processing_enabled}
                    onCheckedChange={(checked) => updateFormData('webhook_processing_enabled', checked)}
                  />
                </div>

                {/* Read-only webhook status fields */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Webhook Status</Label>
                    <div className="h-10 px-3 py-2 rounded-md border border-border bg-muted/50 flex items-center">
                      {formatWebhookStatus(formData.webhook_status)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Last Webhook Received</Label>
                    <div className="h-10 px-3 py-2 rounded-md border border-border bg-muted/50 flex items-center">
                      <span className="text-sm text-muted-foreground">
                        {formData.last_webhook_received 
                          ? new Date(formData.last_webhook_received).toLocaleString() 
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3: Advanced (Optional) */}
          <Collapsible open={openSections.includes('advanced')}>
            <SectionHeader section="advanced" title="Advanced (Optional)" isOpen={openSections.includes('advanced')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_dynamic_variables">Dynamic Variables</Label>
                  <Textarea
                    id="edit_dynamic_variables"
                    placeholder='{"company_name": "Apex Pest", "greeting": "Thank you for calling"}'
                    value={formData.dynamic_variables}
                    onChange={(e) => updateFormData('dynamic_variables', e.target.value)}
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Key-value pairs in JSON format for dynamic agent configuration.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_escalation_notes">Escalation Notes</Label>
                  <Textarea
                    id="edit_escalation_notes"
                    placeholder="Urgent calls should be transferred to the owner at +1 (512) 555-0102"
                    value={formData.escalation_notes}
                    onChange={(e) => updateFormData('escalation_notes', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
