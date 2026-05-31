import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAllPlans, usePlanTiers } from '@/hooks/use-plans';

/**
 * Admin plan detail page — shows plan tiers with aggregated client counts.
 * Accessed from /admin/plans/:id (tier id).
 */
const PlanDetailPage = () => {
  const { data: plans = [], isLoading } = useAllPlans();
  const { data: tiers = [] } = usePlanTiers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/plans">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Plan Tiers Overview</h1>
            <p className="text-sm text-muted-foreground">Tier breakdown with client counts</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const tierPlans = plans.filter((p) => p.tier_id === tier.tier_id && p.status === 'active');
          const totalUsed = tierPlans.reduce((s, p) => s + p.used_tokens, 0);
          const totalAlloc = tierPlans.reduce((s, p) => s + p.total_tokens, 0);
          const avgUsage = totalAlloc > 0 ? Math.round((totalUsed / totalAlloc) * 100) : 0;

          return (
            <Card key={tier.tier_id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>{tier.name}</span>
                  <Badge variant="outline">${(tier.price_cents / 100).toFixed(2)}/mo</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{tier.description}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Active Clients</span>
                    <span className="font-medium">{tierPlans.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Usage</span>
                    <span className="font-medium">{avgUsage}%</span>
                  </div>
                  <Progress value={avgUsage} className="h-1.5 mt-2" />
                </div>
                {tierPlans.length > 0 && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Clients</p>
                    {tierPlans.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="truncate">{p.company_name || p.client_email}</span>
                        <span className="text-muted-foreground">{p.usage_percent}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PlanDetailPage;
