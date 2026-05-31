import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PEST_SERVICES, SUBSCRIPTION_PLANS, CONTACT_ROLES, PestService } from '@/types';

export default function AddClientPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Company Info
    company_name: '',
    business_email: '',
    service_area: '',
    subscription_plan: 'starter' as const,
    status: 'active' as const,
    // Contact
    contact_name: '',
    contact_role: 'owner' as const,
    contact_phone: '',
    contact_email: '',
    // Services
    services: [] as PestService[],
    other_services: '',
    // AI Connection
    agent_display_name: '',
    elevenlabs_agent_id: '',
    linked_phone_numbers: '',
    business_hours: '',
    escalation_notes: '',
    // Integrations
    webhook_enabled: false,
    webhook_secret: '',
    integration_notes: '',
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleService = (service: PestService) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.business_email || !formData.elevenlabs_agent_id) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in Company Name, Business Email, and ElevenLabs Agent ID.',
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
    navigate('/admin/clients');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Add New Client</h1>
        <p className="text-muted-foreground mt-1">
          Onboard a pest control company and connect them to their AI receptionist.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg">
        
        {/* Section 1: Company Information */}
        <div className="form-section px-8">
          <h2 className="section-header">Company Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name <span className="text-destructive">*</span></Label>
              <Input
                id="company_name"
                placeholder="Apex Pest Control"
                value={formData.company_name}
                onChange={(e) => updateFormData('company_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_email">Business Email <span className="text-destructive">*</span></Label>
              <Input
                id="business_email"
                type="email"
                placeholder="info@apexpest.com"
                value={formData.business_email}
                onChange={(e) => updateFormData('business_email', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3 mt-6">
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
              <Label>Subscription Plan</Label>
              <Select 
                value={formData.subscription_plan}
                onValueChange={(v) => updateFormData('subscription_plan', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map(plan => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
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
        </div>

        {/* Section 2: Primary Contact */}
        <div className="form-section px-8">
          <h2 className="section-header">Primary Contact</h2>
          <div className="grid gap-6 md:grid-cols-2">
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
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone Number</Label>
              <Input
                id="contact_phone"
                type="tel"
                placeholder="+1 (512) 555-0102"
                value={formData.contact_phone}
                onChange={(e) => updateFormData('contact_phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email Address</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="john@apexpest.com"
                value={formData.contact_email}
                onChange={(e) => updateFormData('contact_email', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Services Offered */}
        <div className="form-section px-8">
          <h2 className="section-header">Services Offered</h2>
          <div className="grid gap-3 md:grid-cols-4">
            {PEST_SERVICES.map((service) => (
              <label
                key={service.value}
                className="flex items-center gap-3 p-3 rounded-md border border-border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox 
                  checked={formData.services.includes(service.value)}
                  onCheckedChange={() => toggleService(service.value)}
                />
                <span className="text-sm font-medium">{service.label}</span>
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
        </div>

        {/* Section 4: AI Agent Mapping */}
        <div className="form-section px-8">
          <h2 className="section-header">AI Agent Mapping (ElevenLabs)</h2>
          <div className="p-4 rounded-md bg-muted/50 border border-border mb-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Important:</strong> The ElevenLabs Agent ID is used to map incoming webhook events to this client. 
              Make sure the ID matches the agent configured in your ElevenLabs dashboard.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent_display_name">AI Agent Display Name</Label>
              <Input
                id="agent_display_name"
                placeholder="Apex AI Receptionist"
                value={formData.agent_display_name}
                onChange={(e) => updateFormData('agent_display_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevenlabs_agent_id">ElevenLabs Agent ID <span className="text-destructive">*</span></Label>
              <Input
                id="elevenlabs_agent_id"
                placeholder="agent_abc123xyz"
                value={formData.elevenlabs_agent_id}
                onChange={(e) => updateFormData('elevenlabs_agent_id', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <div className="space-y-2">
              <Label htmlFor="linked_phone_numbers">Linked Phone Number(s)</Label>
              <Input
                id="linked_phone_numbers"
                placeholder="+1 (512) 555-0101, +1 (512) 555-0102"
                value={formData.linked_phone_numbers}
                onChange={(e) => updateFormData('linked_phone_numbers', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple numbers with commas</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_hours">Business Hours</Label>
              <Input
                id="business_hours"
                placeholder="Mon-Fri 8AM-6PM, Sat 9AM-2PM"
                value={formData.business_hours}
                onChange={(e) => updateFormData('business_hours', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 mt-6">
            <Label htmlFor="escalation_notes">Emergency Escalation Notes</Label>
            <Textarea
              id="escalation_notes"
              placeholder="Urgent calls should be transferred to the owner at +1 (512) 555-0102"
              value={formData.escalation_notes}
              onChange={(e) => updateFormData('escalation_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Section 5: Integrations & Webhooks */}
        <div className="form-section px-8">
          <h2 className="section-header">Integrations & Webhooks</h2>
          <div className="flex items-center justify-between p-4 rounded-md border border-border">
            <div>
              <p className="font-medium text-foreground">Enable ElevenLabs Webhooks</p>
              <p className="text-sm text-muted-foreground">Receive call events from ElevenLabs for this client</p>
            </div>
            <Switch
              checked={formData.webhook_enabled}
              onCheckedChange={(checked) => updateFormData('webhook_enabled', checked)}
            />
          </div>
          {formData.webhook_enabled && (
            <div className="space-y-2 mt-6">
              <Label htmlFor="webhook_secret">Webhook Secret / Token</Label>
              <Input
                id="webhook_secret"
                type="password"
                placeholder="Enter webhook secret for validation"
                value={formData.webhook_secret}
                onChange={(e) => updateFormData('webhook_secret', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used to validate incoming webhook requests</p>
            </div>
          )}
          <div className="space-y-2 mt-6">
            <Label htmlFor="integration_notes">Integration Notes</Label>
            <Textarea
              id="integration_notes"
              placeholder="Notes about CRM, calendar, or other integrations..."
              value={formData.integration_notes}
              onChange={(e) => updateFormData('integration_notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-8 py-6 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/clients')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Client
          </Button>
        </div>
      </form>
    </div>
  );
}