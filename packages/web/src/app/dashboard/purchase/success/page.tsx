'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PurchaseSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard/projects');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleCreateProject = () => {
    router.push('/dashboard/projects/new');
  };

  const handleViewResources = () => {
    router.push('/dashboard/resources');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Saga!
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Your purchase was successful
        </p>
        <p className="text-gray-500">
          You now have everything you need to start capturing your family's stories
        </p>
      </div>

      <Card className="p-8 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">What You Received</h2>
        
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">Project Vouchers</span>
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-900">Facilitator Seats</span>
              <span className="text-2xl font-bold text-green-600">2</span>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-900">Storyteller Seats</span>
              <span className="text-2xl font-bold text-purple-600">2</span>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-900">Service Period</span>
              <span className="text-lg font-bold text-yellow-600">1 Year</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Next Steps</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Create your first Saga project</li>
            <li>Invite a family member to be the storyteller</li>
            <li>Start recording and sharing stories</li>
            <li>Invite siblings to collaborate (optional)</li>
          </ol>
        </div>
      </Card>

      <div className="space-y-4">
        <Button 
          onClick={handleCreateProject}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium"
        >
          Create Your First Project
        </Button>
        
        <Button 
          onClick={handleViewResources}
          variant="outline"
          className="w-full py-3 text-lg font-medium"
        >
          View My Resources
        </Button>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-gray-500">
          Redirecting to projects in {countdown} seconds...
        </p>
        <button 
          onClick={() => router.push('/dashboard/projects')}
          className="text-sm text-blue-600 hover:underline mt-2"
        >
          Go now
        </button>
      </div>

      {/* Support Information */}
      <Card className="p-6 mt-8 bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-2">Need Help Getting Started?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Our team is here to help you make the most of your Saga experience.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            View Getting Started Guide
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            Contact Support
          </Button>
        </div>
      </Card>
    </div>
  );
}