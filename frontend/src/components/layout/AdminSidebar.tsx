import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { clearAdminSession } from '@/services/adminAuth';
import {
  LayoutDashboard,
  Building2,
  Plus,
  Phone,
  Settings,
  LogOut,
  Shield,
  PanelLeftClose,
  PanelLeft,
  History,
  MessageSquare,
  Key,
} from 'lucide-react';
import { AddClientDialog } from '@/components/admin/AddClientDialog';
import { ChangePasswordDialog } from '@/components/client/ChangePasswordDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Agents', href: '/admin/clients', icon: Building2, hasAddAction: true },
  { name: 'Call Logs', href: '/admin/calls', icon: Phone },
  { name: 'User Feedback', href: '/admin/feedback', icon: MessageSquare },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: History },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

// Super Admin only navigation items
const superAdminNavigation = [
  { name: 'Plans & Configuration', href: '/admin/plans', icon: Shield, badge: 'Internal' },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

interface ScrollingTextProps {
  text: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function ScrollingText({ text, isActive, isCollapsed }: ScrollingTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text, isCollapsed]);

  if (isCollapsed) return null;

  return (
    <div 
      ref={containerRef}
      className="overflow-hidden flex-1 min-w-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span 
        ref={textRef}
        className={cn(
          "inline-block whitespace-nowrap transition-transform duration-1000 ease-linear",
          isOverflowing && isHovered && "animate-scroll-text"
        )}
      >
        {text}
      </span>
    </div>
  );
}

export function AdminSidebar({ onNavigate, onExpandedChange }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleNavClick = () => {
    onNavigate?.();
  };

  const handleSignOut = () => {
    onNavigate?.();
    clearAdminSession();
    navigate('/', { replace: true });
  };

  const toggleSidebar = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "h-full bg-neutral-100 flex flex-col md:fixed md:inset-y-0 md:left-0 md:z-50 rounded-r-xl",
          "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isExpanded ? "w-60" : "w-[68px]"
        )}
      >
        {/* Logo & Toggle */}
        <div className={cn(
          "h-14 hidden md:flex items-center border-b border-neutral-200",
          isExpanded ? "px-4 justify-between" : "px-0 justify-center"
        )}>
          <div className={cn(
            "flex items-center gap-2.5 overflow-hidden",
            "transition-opacity duration-300",
            isExpanded ? "opacity-100" : "opacity-0 w-0"
          )}>
            <div className="w-7 h-7 rounded-md bg-neutral-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">SB</span>
            </div>
            <span className="text-sm font-semibold text-neutral-900 whitespace-nowrap">
              Sales Bot USA
            </span>
          </div>
          
          <button
            onClick={toggleSidebar}
            className={cn(
              "p-2 rounded-md text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors duration-200",
              !isExpanded && "mx-auto"
            )}
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden",
          isExpanded ? "px-3" : "px-2",
          "md:pt-3 pt-10" // Extra top padding on mobile to avoid close button overlap
        )}>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            
            const navLink = (
              <NavLink
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors duration-200',
                  isExpanded ? 'px-3 py-2' : 'px-3 py-2 justify-center',
                  item.hasAddAction && isExpanded ? 'pr-9' : '',
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className={cn(
                  "whitespace-nowrap transition-[opacity,width] duration-300",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                )}>
                  {isExpanded && <ScrollingText text={item.name} isActive={isActive} isCollapsed={!isExpanded} />}
                </span>
              </NavLink>
            );

            const content = (
              <div key={item.name} className="relative group">
                {navLink}
                {item.hasAddAction && isExpanded && (
                  <button
                    onClick={() => setAddClientOpen(true)}
                    className={cn(
                      'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-200',
                      isActive
                        ? 'text-white hover:bg-white/20'
                        : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 opacity-0 group-hover:opacity-100'
                    )}
                    title="Add new agent"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );

            if (!isExpanded) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    {content}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-neutral-900 text-white">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return content;
          })}

          {/* Super Admin Section */}
          <div className="pt-4 mt-4 border-t border-neutral-200">
            {isExpanded && (
              <p className="px-3 py-1 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Internal
              </p>
            )}
            {superAdminNavigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              
              const navLink = (
                <NavLink
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors duration-200 mt-0.5 group',
                    isExpanded ? 'px-3 py-2' : 'px-3 py-2 justify-center',
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {isExpanded && (
                    <span className="flex items-center gap-2 whitespace-nowrap min-w-0 flex-1">
                      <span className="truncate">{item.name}</span>
                      {item.badge && (
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 transition-colors',
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-neutral-200 text-neutral-600 group-hover:bg-neutral-300 group-hover:text-neutral-900'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </span>
                  )}
                </NavLink>
              );

              if (!isExpanded) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {navLink}
                    </TooltipTrigger>
                  <TooltipContent side="right" className="bg-neutral-900 text-white">
                    {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.name}>{navLink}</div>;
            })}
          </div>
        </nav>

        <div className={cn(
          "py-3 border-t border-neutral-200 space-y-0.5",
          isExpanded ? "px-3" : "px-2"
        )}>
          {/* Change Password */}
          {isExpanded ? (
            <button 
              onClick={() => setPasswordOpen(true)}
              className="flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors duration-200"
            >
              <Key className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Change Password</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setPasswordOpen(true)}
                  className="flex items-center justify-center px-3 py-2 w-full rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors duration-200"
                >
                  <Key className="w-4 h-4 flex-shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-900 text-white">
                Change Password
              </TooltipContent>
            </Tooltip>
          )}

          {/* Sign Out */}
          {isExpanded ? (
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors duration-200"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Sign Out</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center justify-center px-3 py-2 w-full rounded-md text-sm font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-900 text-white">
                Sign Out
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </TooltipProvider>
  );
}
