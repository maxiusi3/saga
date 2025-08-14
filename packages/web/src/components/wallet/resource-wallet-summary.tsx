'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ResourceWallet {
  projectVouchers: number;
  facilitatorSeats: number;
  storytellerSeats: number;
}

interface ResourceWalletSummaryProps {
  className?: string;
  showActions?: boolean;
}

export default function ResourceWalletSummary({ 
  className = '', 
  showActions = true 
}: ResourceWalletSummaryProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState<ResourceWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch actual wallet data from API
    // For now, using mock data
    setTimeout(() => {
      setWallet({
        projectVouchers: 1,
        facilitatorSeats: 0,
        storytellerSeats: 1
      });
      setLoading(false);
    }, 500);
  }, []);

  const handleViewDetails = () => {
    router.push('/dashboard/resources');
  };

  const handlePurchaseMore = () => {
    router.push('/dashboard/purchase');
  };

  if (loading) {
    return (
      <Card className={`p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-2/3"></div>
      </Card>
    );
  }

  const hasLowResources = (wallet?.projectVouchers || 0) === 0 && 
                          (wallet?.facilitatorSeats || 0) === 0 && 
                          (wallet?.storytellerSeats || 0) === 0;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Available Seats</h3>
          <div className="text-lg font-semibold text-gray-900">
            {wallet?.projectVouchers || 0} Project, {wallet?.facilitatorSeats || 0} Facilitator, {wallet?.storytellerSeats || 0} Storyteller
          </div>
          
          {hasLowResources && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Low on seats
              </span>
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex flex-col gap-2 ml-4">
            <Button
              onClick={handleViewDetails}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              View Details
            </Button>
            
            {hasLowResources && (
              <Button
                onClick={handlePurchaseMore}
                size="sm"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Purchase More
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions for Empty State */}
      {hasLowResources && showActions && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            You need seats to create projects and invite family members.
          </p>
          <Button
            onClick={handlePurchaseMore}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            Get The Saga Package
          </Button>
        </div>
      )}
    </Card>
  );
}