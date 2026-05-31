import { AlertTriangle } from 'lucide-react';
import type { UsageAlert } from '@/services/planApi';

interface UsageBannerProps {
  alert: UsageAlert;
}

export function UsageBanner({ alert }: UsageBannerProps) {
  if (!alert.alert) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
          Usage Alert — {alert.usage_percent}% used
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
          {alert.message}
        </p>
      </div>
    </div>
  );
}
