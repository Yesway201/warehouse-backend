import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  PackageCheck,
  ClipboardCheck,
  Settings,
  LogOut,
  ClipboardList,
  Radio,
  History,
  RefreshCw,
  Users,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { receivingSessions = [] } = useData();
  const location = useLocation();

  const pendingReviewCount = receivingSessions.filter((s) => s.status === 'pending-review').length;
  const activeReceivingCount = receivingSessions.filter((s) => s.status === 'in-progress').length;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['dock', 'office', 'admin'] },
    { name: 'Incoming Deliveries', href: '/incoming-deliveries', icon: ClipboardList, roles: ['office', 'admin'] },
    { name: 'Receive', href: '/receive', icon: PackageCheck, roles: ['dock', 'office', 'admin'] },
    { name: 'Live Receive Monitor', href: '/live-receive', icon: Radio, roles: ['office', 'admin'], badge: activeReceivingCount },
    { name: 'Review Queue', href: '/review-queue', icon: ClipboardCheck, roles: ['office', 'admin'], badge: pendingReviewCount },
    { name: 'Receiving History', href: '/history', icon: History, roles: ['office', 'admin'] },
    { name: 'Sync History', href: '/sync-history', icon: RefreshCw, roles: ['office', 'admin'] },
    { name: 'Customers', href: '/customers', icon: Users, roles: ['office', 'admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredNav = navigation.filter((item) => item.roles.includes(user?.role || 'dock'));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="https://mgx-backend-cdn.metadl.com/generate/images/881888/2026-01-04/52d0a8b6-f322-4cfd-a498-9fa0e8b2e79e.png"
                alt="Logo"
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold text-gray-900">3PL Warehouse</h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:inline">
                <span className="font-semibold capitalize">{user?.role}</span>
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarFallback className="bg-blue-600 text-white">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Side Navigation */}
      <div className="flex">
        <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge className="bg-orange-500 text-white">{item.badge}</Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16">
          {filteredNav.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full relative ${
                  isActive ? 'text-blue-700' : 'text-gray-600'
                }`}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs mt-1">{item.name.split(' ')[0]}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge className="absolute top-1 right-2 h-5 w-5 flex items-center justify-center p-0 bg-orange-500 text-white text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}