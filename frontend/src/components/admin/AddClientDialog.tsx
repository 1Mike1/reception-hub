import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Loader2, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { PEST_SERVICES, CONTACT_ROLES, PestService } from '@/types';
import { mockPlans } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Validation schema
const formSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100, 'Company name must be less than 100 characters'),
  business_email: z.string().min(1, 'Business email is required').email('Invalid email address'),
  service_area: z.string().optional(),
  assigned_plan_id: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  contact_name: z.string().optional(),
  contact_role: z.enum(['owner', 'manager', 'office_admin']),
  contact_phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-+()]*$/.test(val),
    'Invalid phone number format'
  ),
  contact_email: z.string().optional().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    'Invalid email address'
  ),
  services: z.array(z.string()),
  other_services: z.string().optional(),
  elevenlabs_agent_id: z.string().min(1, 'ElevenLabs Agent ID is required'),
  linked_phone_numbers: z.string().optional(),
  webhook_processing_enabled: z.boolean(),
  dynamic_variables: z.string().optional(),
  escalation_notes: z.string().optional(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

const initialFormData = {
  // Company Info
  company_name: '',
  business_email: '',
  service_area: '',
  assigned_plan_id: '',
  status: 'active' as const,
  // Contact
  contact_name: '',
  contact_role: 'owner' as const,
  contact_phone: '',
  contact_email: '',
  // Services
  services: [] as PestService[],
  other_services: '',
  // ElevenLabs Integration
  elevenlabs_agent_id: '',
  linked_phone_numbers: '',
  webhook_processing_enabled: true,
  // Advanced
  dynamic_variables: '',
  escalation_notes: '',
};

type SectionKey = 'company' | 'contact' | 'services' | 'elevenlabs' | 'advanced';

// Map fields to their sections
const fieldSectionMap: Record<string, SectionKey> = {
  company_name: 'company',
  business_email: 'company',
  service_area: 'company',
  assigned_plan_id: 'company',
  status: 'company',
  contact_name: 'contact',
  contact_role: 'contact',
  contact_phone: 'contact',
  contact_email: 'contact',
  services: 'services',
  other_services: 'services',
  elevenlabs_agent_id: 'elevenlabs',
  linked_phone_numbers: 'elevenlabs',
  webhook_processing_enabled: 'elevenlabs',
  dynamic_variables: 'advanced',
  escalation_notes: 'advanced',
};

export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState(initialFormData);
  const [openSections, setOpenSections] = useState<SectionKey[]>(['company']);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const activePlans = mockPlans.filter(p => p.status === 'active');

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
    // Real-time validation while typing
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleBlur = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  const toggleService = (service: PestService) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  // Get sections with errors
  const sectionsWithErrors = useMemo(() => {
    const sections = new Set<SectionKey>();
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
    contact: !!(formData.contact_name && formData.contact_phone && !errors.contact_phone && !errors.contact_email),
    services: formData.services.length > 0,
    elevenlabs: !!(formData.elevenlabs_agent_id && !errors.elevenlabs_agent_id),
    advanced: !!(formData.escalation_notes),
  }), [formData, errors]);

  const resetForm = () => {
    setFormData(initialFormData);
    setOpenSections(['company']);
    setErrors({});
    setTouchedFields(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate entire form
    const result = formSchema.safeParse(formData);
    
    if (!result.success) {
      const newErrors: FormErrors = {};
      const sectionsToOpen = new Set<SectionKey>();
      
      result.error.errors.forEach(err => {
        const field = err.path[0] as string;
        newErrors[field as keyof FormErrors] = err.message;
        const section = fieldSectionMap[field];
        if (section) sectionsToOpen.add(section);
      });
      
      setErrors(newErrors);
      // Auto-expand sections with errors
      setOpenSections(prev => [...new Set([...prev, ...sectionsToOpen])]);
      
      toast({
        title: 'Validation Error',
        description: 'Please fix the highlighted errors and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: 'Client Added',
      description: `${formData.company_name} has been created successfully.`,
    });
    
    setIsSubmitting(false);
    resetForm();
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Client</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Onboard a pest control company and connect them to their AI receptionist.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          
          {/* Section 1: Company Information */}
          <Collapsible open={openSections.includes('company')}>
            <SectionHeader section="company" title="Company Information" isOpen={openSections.includes('company')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="company_name"
                    placeholder="Apex Pest Control"
                    value={formData.company_name}
                    onChange={(e) => updateFormData('company_name', e.target.value)}
                    onBlur={() => handleBlur('company_name')}
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
                  <Label htmlFor="business_email">Business Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="business_email"
                    type="email"
                    placeholder="info@apexpest.com"
                    value={formData.business_email}
                    onChange={(e) => updateFormData('business_email', e.target.value)}
                    onBlur={() => handleBlur('business_email')}
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
              <div className="grid gap-4 md:grid-cols-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="service_area">Service Area</Label>
                  <Input
                    id="service_area"
                    placeholder="Austin, TX"
                    value={formData.service_area}
                    onChange={(e) => updateFormData('service_area', e.target.value)}
                  />
                </div>
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
                  <Label>Client Status</Label>
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
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2: Primary Contact */}
          <Collapsible open={openSections.includes('contact')}>
            <SectionHeader section="contact" title="Primary Contact" isOpen={openSections.includes('contact')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    placeholder="John Martinez"
                    value={formData.contact_name}
                    onChange={(e) => updateFormData('contact_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select 
                    value={formData.contact_role}
                    onValueChange={(v) => updateFormData('contact_role', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone Number</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    placeholder="+1 (512) 555-0102"
                    value={formData.contact_phone}
                    onChange={(e) => updateFormData('contact_phone', e.target.value)}
                    onBlur={() => handleBlur('contact_phone')}
                    className={cn(errors.contact_phone && "border-destructive focus-visible:ring-destructive")}
                  />
                  {errors.contact_phone && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.contact_phone}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email Address</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="john@apexpest.com"
                    value={formData.contact_email}
                    onChange={(e) => updateFormData('contact_email', e.target.value)}
                    onBlur={() => handleBlur('contact_email')}
                    className={cn(errors.contact_email && "border-destructive focus-visible:ring-destructive")}
                  />
                  {errors.contact_email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.contact_email}
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3: Services Offered */}
          <Collapsible open={openSections.includes('services')}>
            <SectionHeader section="services" title="Services Offered" isOpen={openSections.includes('services')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                {PEST_SERVICES.map((service) => (
                  <label
                    key={service.value}
                    className="flex items-center gap-2 p-2 rounded-md border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox 
                      checked={formData.services.includes(service.value)}
                      onCheckedChange={() => toggleService(service.value)}
                    />
                    <span className="text-sm">{service.label}</span>
                  </label>
                ))}
              </div>
              {formData.services.includes('other') && (
                <div className="space-y-2 mt-4">
                  <Label htmlFor="other_services">Other Services</Label>
                  <Input
                    id="other_services"
                    placeholder="Describe other services..."
                    value={formData.other_services}
                    onChange={(e) => updateFormData('other_services', e.target.value)}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Section 4: ElevenLabs Integration */}
          <Collapsible open={openSections.includes('elevenlabs')}>
            <SectionHeader section="elevenlabs" title="ElevenLabs Integration" isOpen={openSections.includes('elevenlabs')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="elevenlabs_agent_id">ElevenLabs Agent ID <span className="text-destructive">*</span></Label>
                  <Input
                    id="elevenlabs_agent_id"
                    placeholder="agent_abc123xyz"
                    value={formData.elevenlabs_agent_id}
                    onChange={(e) => updateFormData('elevenlabs_agent_id', e.target.value)}
                    onBlur={() => handleBlur('elevenlabs_agent_id')}
                    className={cn(errors.elevenlabs_agent_id && "border-destructive focus-visible:ring-destructive")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to link this client with call data, transcripts, and usage coming from ElevenLabs.
                  </p>
                  {errors.elevenlabs_agent_id && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.elevenlabs_agent_id}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linked_phone_numbers">Linked Phone Number(s)</Label>
                  <Input
                    id="linked_phone_numbers"
                    placeholder="+1 (512) 555-0101, +1 (512) 555-0102"
                    value={formData.linked_phone_numbers}
                    onChange={(e) => updateFormData('linked_phone_numbers', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Phone numbers routed to this agent in ElevenLabs.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-md border border-border mt-4">
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
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Webhook Status</Label>
                  <div className="h-10 px-3 py-2 rounded-md border border-border bg-muted/50 flex items-center">
                    <span className="text-sm text-muted-foreground">No Data</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Last Webhook Received</Label>
                  <div className="h-10 px-3 py-2 rounded-md border border-border bg-muted/50 flex items-center">
                    <span className="text-sm text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5: Advanced (Optional) */}
          <Collapsible open={openSections.includes('advanced')}>
            <SectionHeader section="advanced" title="Advanced (Optional)" isOpen={openSections.includes('advanced')} />
            <CollapsibleContent className="pt-4 px-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dynamic_variables">Dynamic Variables</Label>
                  <Textarea
                    id="dynamic_variables"
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
                  <Label htmlFor="escalation_notes">Escalation Notes</Label>
                  <Textarea
                    id="escalation_notes"
                    placeholder="Urgent calls should be transferred to the owner at +1 (512) 555-0102"
                    value={formData.escalation_notes}
                    onChange={(e) => updateFormData('escalation_notes', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Form Actions */}
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
              Add Client
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
