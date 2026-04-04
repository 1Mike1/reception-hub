import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon,
  Webhook,
  Shield,
  Bell
} from 'lucide-react';

export default function SettingsPage() {
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
        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              Webhook Configuration
            </CardTitle>
            <CardDescription>
              Configure the ElevenLabs webhook endpoint for receiving call data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">Webhook Endpoint</p>
              <code className="text-sm font-mono text-primary">
                POST /api/webhooks/elevenlabs/calls
              </code>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Webhook Status</p>
                <p className="text-sm text-muted-foreground">Ready to receive events</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>
              Security settings and access control.
            </CardDescription>
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
                <p className="font-medium">Webhook Signature Validation</p>
                <p className="text-sm text-muted-foreground">Verify incoming webhooks</p>
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
            <CardDescription>
              Configure system notifications and alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Escalation Alerts</p>
                <p className="text-sm text-muted-foreground">Notify when calls are escalated</p>
              </div>
              <Badge variant="success">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <p className="font-medium">Daily Summaries</p>
                <p className="text-sm text-muted-foreground">Email daily call reports</p>
              </div>
              <Badge variant="inactive">Disabled</Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              System Information
            </CardTitle>
            <CardDescription>
              Current system status and version info.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-mono">1.0.0</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Environment</p>
                <p className="font-mono">Development</p>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-1">Database</p>
              <p className="font-medium">Connected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Local database with mock data. Connect Supabase for production.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
