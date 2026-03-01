import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  FileText,
  ClipboardList,
  PackageCheck,
  Monitor,
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deliveries = [], slipRequests = [], asns = [], receivingSessions = [] } = useData();

  const arrivedDeliveries = deliveries.filter((d) => ['arrived', 'unloaded'].includes(d.status)).length;
  const pendingSlips = slipRequests.filter((s) => s.status === 'pending-customer').length;
  const activeASNs = asns.filter((a) => a.status === 'active').length;
  const inProgressReceiving = receivingSessions.filter((r) => r.status === 'in-progress').length;
  const underReview = receivingSessions.filter((r) => r.status === 'under-review').length;

  const dashboardCards = [
    {
      title: 'Incoming Deliveries',
      value: deliveries.length,
      subtitle: `${arrivedDeliveries} arrived`,
      icon: Truck,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/incoming',
      roles: ['dock', 'office', 'admin'],
    },
    {
      title: 'Packing Slips',
      value: slipRequests.length,
      subtitle: `${pendingSlips} pending`,
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      href: '/slips',
      roles: ['office', 'admin'],
    },
    {
      title: 'Active ASNs',
      value: activeASNs,
      subtitle: `${asns.length} total`,
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: '/asn',
      roles: ['office', 'admin'],
    },
    {
      title: 'Receive',
      value: arrivedDeliveries,
      subtitle: `${inProgressReceiving} in progress`,
      icon: PackageCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/receive',
      roles: ['dock', 'office', 'admin'],
    },
    {
      title: 'Office Review',
      value: underReview,
      subtitle: 'Awaiting review',
      icon: Monitor,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      href: '/office',
      roles: ['office', 'admin'],
    },
    {
      title: 'Settings',
      value: '',
      subtitle: 'System configuration',
      icon: Settings,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      href: '/settings',
      roles: ['admin'],
    },
  ];

  const filteredCards = dashboardCards.filter((card) => card.roles.includes(user?.role || 'dock'));

  const recentActivity = receivingSessions.slice(-5).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}!</p>
      </div>

      {/* Hero Image */}
      <div className="relative h-48 rounded-lg overflow-hidden">
        <img
          src="https://mgx-backend-cdn.metadl.com/generate/images/881888/2026-01-04/48840b68-e92b-488a-ad9a-f8ae5d04ccd4.png"
          alt="Warehouse Operations"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent flex items-center px-8">
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-2">Warehouse Operations</h2>
            <p className="text-blue-100">Streamlined receiving and management</p>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(card.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Receiving Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((session) => (
                <div key={session.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{session.customerName}</div>
                    <div className="text-sm text-gray-500">
                      Container: {session.containerNumber} • {session.items.length} items
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Started by {session.startedBy} on {new Date(session.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={
                      session.status === 'completed'
                        ? 'default'
                        : session.status === 'in-progress'
                        ? 'secondary'
                        : 'outline'
                    }
                    className={
                      session.status === 'completed'
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : session.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                        : session.status === 'under-review'
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        : ''
                    }
                  >
                    {session.status === 'in-progress' ? (
                      <Clock className="h-3 w-3 mr-1" />
                    ) : session.status === 'completed' ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1" />
                    )}
                    {session.status.replace('-', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}