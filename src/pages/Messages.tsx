import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function Messages() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">Communication between office and dock staff</p>
        </div>
        <MessageSquare className="h-12 w-12 text-gray-400" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages - Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This section will provide real-time chat and messaging functionality
            between office staff and dock employees.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
