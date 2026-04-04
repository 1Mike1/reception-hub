import { Check, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PlanTier } from '@/services/planApi';

interface PlanCardProps {
  tier: PlanTier;
  isCurrentPlan?: boolean;
  isPurchasing?: boolean;
  onSelect: (tierId: string) => void;
}

export function PlanCard({ tier, isCurrentPlan, isPurchasing, onSelect }: PlanCardProps) {
  const priceFormatted = `$${(tier.price_cents / 100).toFixed(2)}`;
  const isGrowth = tier.tier_id === 'growth';
  const tokensFormatted = tier.tokens >= 1000 ? `${(tier.tokens / 1000).toFixed(0)}K` : `${tier.tokens}`;

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-shadow',
        isGrowth && 'border-primary shadow-md',
        isCurrentPlan && 'opacity-70',
      )}
    >
      {isGrowth && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs px-3">
          Popular
        </Badge>
      )}
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg">{tier.name}</CardTitle>
        <p className="text-3xl font-bold mt-2">
          {priceFormatted}
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-4">
        <p className="text-sm text-muted-foreground text-center">{tier.description}</p>
        <ul className="space-y-2 text-sm flex-1">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>{tokensFormatted} LLM tokens</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>Call summaries & transcripts</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span>80% usage alerts</span>
          </li>
        </ul>
        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : isGrowth ? 'default' : 'outline'}
          disabled={isCurrentPlan || isPurchasing}
          onClick={() => onSelect(tier.tier_id)}
        >
          {isPurchasing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : (
            <>
              Upgrade <ExternalLink className="w-3 h-3 ml-1" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
