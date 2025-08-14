'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Calendar, 
  Mail, 
  Smartphone, 
  Clock,
  AlertTriangle,
  Bell,
  X,
  Edit,
  Eye
} from 'lucide-react';

export interface ScheduledReminder {
  id: string;
  type: 'expiry_warning' | 'renewal_reminder' | 'usage_reminder' | 'engagement_reminder';
  method: 'email' | 'push';
  projectId: string;
  projectName: string;
  scheduledFor: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  content: {
    subject: string;
    message: string;
    actionUrl?: string;
  };
  metadata?: Record<string, any>;
}

interface UpcomingRemindersProps {
  reminders: ScheduledReminder[];
  onCancel: (reminderId: string) => Promise<void>;
  onPreview: (reminder: ScheduledReminder) => void;
  onEdit: (reminder: ScheduledReminder) => void;
  loading?: boolean;
  className?: string;
}

export function UpcomingReminders({
  reminders,
  onCancel,
  onPreview,
  onEdit,
  loading = false,
  className = ''
}: UpcomingRemindersProps) {
  const getTypeConfig = (type: ScheduledReminder['type']) => {
    switch (type) {
      case 'expiry_warning':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Expiry Warning'
        };
      case 'renewal_reminder':
        return {
          icon: Calendar,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Renewal Reminder'
        };
      case 'usage_reminder':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Usage Reminder'
        };
      case 'engagement_reminder':
        return {
          icon: Bell,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          label: 'Engagement Reminder'
        };
      default:
        return {
          icon: Bell,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Reminder'
        };
    }
  };

  const getStatusBadge = (status: ScheduledReminder['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getMethodIcon = (method: 'email' | 'push') => {
    return method === 'email' 
      ? <Mail className="h-4 w-4 text-blue-600" />
      : <Smartphone className="h-4 w-4 text-green-600" />;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.abs(date.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } else if (diffInHours < 168) { // 7 days
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }
  };

  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 0) return 'Overdue';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  // Group reminders by date
  const groupedReminders = reminders.reduce((groups, reminder) => {
    const dateKey = reminder.scheduledFor.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(reminder);
    return groups;
  }, {} as Record<string, ScheduledReminder[]>);

  const sortedDateKeys = Object.keys(groupedReminders).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  if (reminders.length === 0) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Reminders</h3>
        <p className="text-gray-600">
          Your reminder settings will automatically schedule notifications based on your subscription status.
        </p>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Reminders</h3>
          <p className="text-gray-600">
            {reminders.filter(r => r.status === 'scheduled').length} scheduled reminders
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedDateKeys.map((dateKey) => {
          const dateReminders = groupedReminders[dateKey];
          const date = new Date(dateKey);
          const isToday = date.toDateString() === new Date().toDateString();
          const isTomorrow = date.toDateString() === new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
          
          let dateLabel = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          });
          
          if (isToday) dateLabel = 'Today';
          else if (isTomorrow) dateLabel = 'Tomorrow';

          return (
            <div key={dateKey}>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                {dateLabel}
              </h4>
              
              <div className="space-y-2">
                {dateReminders.map((reminder) => {
                  const config = getTypeConfig(reminder.type);
                  const Icon = config.icon;

                  return (
                    <Card
                      key={reminder.id}
                      className={`p-4 ${config.bgColor} ${config.borderColor} border`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="flex-shrink-0">
                            <Icon className={`h-5 w-5 ${config.color}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h5 className="font-medium text-gray-900">{config.label}</h5>
                              {getStatusBadge(reminder.status)}
                              <div className="flex items-center space-x-1">
                                {getMethodIcon(reminder.method)}
                                <span className="text-xs text-gray-600 capitalize">
                                  {reminder.method}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-700 mb-2">
                              {reminder.content.subject}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-600">
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(reminder.scheduledFor)}
                              </span>
                              <span>Project: {reminder.projectName}</span>
                              {reminder.status === 'scheduled' && (
                                <span className="font-medium text-blue-600">
                                  in {getTimeUntil(reminder.scheduledFor)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            onClick={() => onPreview(reminder)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {reminder.status === 'scheduled' && (
                            <>
                              <Button
                                onClick={() => onEdit(reminder)}
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                onClick={() => onCancel(reminder.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={loading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <Card className="p-4 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-blue-600">
              {reminders.filter(r => r.status === 'scheduled').length}
            </div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {reminders.filter(r => r.status === 'sent').length}
            </div>
            <div className="text-sm text-gray-600">Sent</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-600">
              {reminders.filter(r => r.status === 'failed').length}
            </div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-600">
              {reminders.filter(r => r.status === 'cancelled').length}
            </div>
            <div className="text-sm text-gray-600">Cancelled</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default UpcomingReminders;