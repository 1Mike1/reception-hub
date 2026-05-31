import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/admin/NotificationBell';

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile hamburger header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-background/95 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="text-foreground border border-border rounded-md"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">2W</span>
              </div>
              <span className="text-sm font-semibold text-foreground">2nd Wave AI</span>
            </div>
          </div>
          <NotificationBell />
        </header>
      )}

      {/* Desktop sidebar */}
      {!isMobile && <AdminSidebar onExpandedChange={setSidebarExpanded} />}

      {/* Mobile sidebar sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 sidebar-gradient border-0">
          <AdminSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className={cn(
        "transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isMobile ? 'pt-14' : sidebarExpanded ? 'pl-60' : 'pl-[68px]'
      )}>
        <div className="p-6 md:p-8">
          {/* Desktop header with notification bell */}
          {!isMobile && (
            <div className="flex justify-end mb-6">
              <NotificationBell />
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
