import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  return (
    <Button variant="ghost" size="icon" className="relative" disabled>
      <Bell className="w-5 h-5" />
    </Button>
  );
}
