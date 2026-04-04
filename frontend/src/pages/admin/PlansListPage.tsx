import { Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ResizableTableHeader, ResizableTableCell } from '@/components/ui/resizable-table-header';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
import { useAllPlans, usePlanTiers } from '@/hooks/use-plans';
import { format } from 'date-fns';

const defaultColumnWidths = {
  company: 180,
  email: 200,
  plan: 110,
  usage: 220,
  status: 100,
  payment: 130,
  updated: 130,
};

const PlansListPage = () => {
  const { data: plans = [], isLoading } = useAllPlans();
  const { data: tiers = [] } = usePlanTiers();
  const { columnWidths, handleMouseDown } = useResizableColumns(defaultColumnWidths);

  const activePlans = plans.filter((p) => p.status === 'active');
  const totalRevenue = activePlans.reduce((sum, p) => {
    const tier = tiers.find((t) => t.tier_id === p.tier_id);
    return sum + (tier ? tier.price_cents / 100 : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Shield className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Plans & Usage</h1>
          <p className="text-sm text-muted-foreground">View all client plan subscriptions and usage</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Plans</p>
            <p className="text-3xl font-bold mt-1">{plans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active Plans</p>
            <p className="text-3xl font-bold mt-1 text-success">{activePlans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            <p className="text-3xl font-bold mt-1">${totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">All Client Plans</CardTitle>
          <CardDescription>Real-time plan assignments and usage data</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No client plans found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <ResizableTableHeader columnKey="company" width={columnWidths.company} onResize={handleMouseDown}>
                      Company
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="email" width={columnWidths.email} onResize={handleMouseDown}>
                      Email
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="plan" width={columnWidths.plan} onResize={handleMouseDown}>
                      Plan
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="usage" width={columnWidths.usage} onResize={handleMouseDown}>
                      Usage
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="status" width={columnWidths.status} onResize={handleMouseDown}>
                      Status
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="payment" width={columnWidths.payment} onResize={handleMouseDown}>
                      Payment
                    </ResizableTableHeader>
                    <ResizableTableHeader columnKey="updated" width={columnWidths.updated} onResize={handleMouseDown} isLast>
                      Updated
                    </ResizableTableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-muted/50 transition-colors h-14">
                      <ResizableTableCell width={columnWidths.company}>
                        <p className="font-medium text-foreground truncate">{plan.company_name || '—'}</p>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.email}>
                        <p className="text-sm text-muted-foreground truncate">{plan.client_email}</p>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.plan}>
                        <Badge variant="outline">{plan.tier_name}</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.usage}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{plan.used_tokens.toLocaleString()} / {plan.total_tokens.toLocaleString()} tokens</span>
                            <span className="font-medium">{plan.usage_percent}%</span>
                          </div>
                          <Progress value={Math.min(plan.usage_percent, 100)} className="h-1.5" />
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.status}>
                        <Badge variant={plan.status === 'active' ? 'active' : plan.status === 'expired' ? 'secondary' : 'inactive'}>
                          {plan.status}
                        </Badge>
                        {plan.alert_triggered && (
                          <Badge variant="destructive" className="ml-1 text-xs">80%+</Badge>
                        )}
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.payment}>
                        <span className="text-xs text-muted-foreground truncate block">
                          {plan.stripe_payment_id === 'free_signup' ? 'Free' : plan.stripe_payment_id ? 'Paid' : '—'}
                        </span>
                      </ResizableTableCell>
                      <ResizableTableCell width={columnWidths.updated}>
                        <span className="text-muted-foreground text-sm">
                          {format(new Date(plan.updated_at), 'MMM d, yyyy')}
                        </span>
                      </ResizableTableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlansListPage;
