import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Settings as SettingsIcon,
  Webhook,
  Shield,
  Bell,
  Database,
  Mail,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BACKEND_URL } from '@/services/elevenLabsApi';

interface SystemInfo {
  db_backend: 'json' | 'mongodb';
  email_configured: boolean;
  stripe_configured: boolean;
  elevenlabs_webhook_secret_set: boolean;
  call_poll_interval_seconds: number;
}

function StatusRow({
  icon: Icon,
  label,
  description,
  active,
  activeLabel = 'Configured',
  inactiveLabel = 'Not configured',
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-success' : 'text-muted-foreground'}`} />
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Badge variant={active ? 'success' : 'inactive'} className="shrink-0">
        {active ? activeLabel : inactiveLabel}
      </Badge>
    </div>
  );
}

export default function SettingsPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/system/info`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure system settings and integrations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Integrations status */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Integrations Status
            </CardTitle>
            <CardDescription>
              Live status of backend integrations. Set values in <code className="font-mono text-xs">backend/reception_labs/.env</code> and restart.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading status…
              </div>
            ) : !info ? (
              <p className="text-sm text-destructive">Could not reach backend at {BACKEND_URL}.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <StatusRow
                  icon={Database}
                  label="Database"
                  description={info.db_backend === 'mongodb' ? 'MongoDB' : 'JSON files (fallback)'}
                  active={info.db_backend === 'mongodb'}
                  activeLabel="MongoDB"
                  inactiveLabel="JSON"
                />
                <StatusRow
                  icon={Mail}
                  label="Email (SMTP)"
                  description="Sends post-call transcripts and plan alerts"
                  active={info.email_configured}
                />
                <StatusRow
                  icon={CreditCard}
                  label="Stripe Payments"
                  description={info.stripe_configured ? 'Live charges enabled' : 'Mock-payment mode active'}
                  active={info.stripe_configured}
                  inactiveLabel="Mock mode"
                />
                <StatusRow
                  icon={Webhook}
                  label="ElevenLabs Webhook"
                  description={`Poll interval: ${info.call_poll_interval_seconds}s${info.elevenlabs_webhook_secret_set ? ' · secret set' : ''}`}
                  active={info.elevenlabs_webhook_secret_set}
                  activeLabel="Secret set"
                  inactiveLabel="No secret"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              Webhook Configuration
            </CardTitle>
            <CardDescription>
              Configure the ElevenLabs webhook endpoint for post-call events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">Webhook Endpoint</p>
              <code className="text-sm font-mono text-primary break-all">
                POST {BACKEND_URL}/webhooks/elevenlabs
              </code>
            </div>
            <div className="p-4 rounded-lg border border-border">
              <p className="font-medium mb-1">Setup</p>
              <p className="text-sm text-muted-foreground">
                In the ElevenLabs dashboard, set this URL as your post-call webhook and configure
                <code className="font-mono mx-1 text-xs">ELEVENLABS_WEBHOOK_SECRET</code>
                in <code className="font-mono mx-1 text-xs">.env</code> to verify signatures.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Security and access control.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Role-Based Access</p>
                <p className="text-sm text-muted-foreground">Admin and Client roles enabled</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Password Hashing</p>
                <p className="text-sm text-muted-foreground">PBKDF2-HMAC-SHA256 · 100,000 iterations</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Mock-Payment Forgery Protection</p>
                <p className="text-sm text-muted-foreground">HMAC-signed session tokens</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>System notifications and alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Post-call Transcript Email</p>
                <p className="text-sm text-muted-foreground">Sent to client after each completed call</p>
              </div>
              <Badge variant={info?.email_configured ? 'success' : 'inactive'}>
                {info?.email_configured ? 'Active' : 'Needs SMTP'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Plan Usage Alerts (80%)</p>
                <p className="text-sm text-muted-foreground">Sent when client crosses usage threshold</p>
              </div>
              <Badge variant={info?.email_configured ? 'success' : 'inactive'}>
                {info?.email_configured ? 'Active' : 'Needs SMTP'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
