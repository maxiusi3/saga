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

export default function ResourcesPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<ResourceWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call when wallet endpoint is available
      // const response = await api.wallet.get();
      // setWallet(response.data);
      
      // For now, return empty wallet as default
      setWallet({
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      });
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      // Set default empty wallet on error
      setWallet({
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchasePackage = () => {
    router.push('/dashboard/purchase');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Resources</h1>
        <p className="text-gray-600">
          Manage your available seats and purchase additional resources
        </p>
      </div>

      {/* Available Seats Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Seats</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Project Vouchers</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Create new Saga projects
                </p>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {wallet?.projectVouchers || 0}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                You have {wallet?.projectVouchers || 0} project voucher(s) available
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Facilitator Seats</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Invite co-facilitators (siblings)
                </p>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {wallet?.facilitatorSeats || 0}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                You have {wallet?.facilitatorSeats || 0} facilitator seat(s) available
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Storyteller Seats</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Invite family storytellers
                </p>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {wallet?.storytellerSeats || 0}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                You have {wallet?.storytellerSeats || 0} storyteller seat(s) available
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Purchase More Resources Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Purchase More Resources</h2>
        
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">The Saga Package</h3>
              <p className="text-gray-600 mb-4">
                Complete package with everything you need to start a new family story project
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 1 Project Voucher</li>
                <li>• 2 Facilitator Seats</li>
                <li>• 2 Storyteller Seats</li>
                <li>• 1 year of interactive service</li>
                <li>• Permanent archival access</li>
                <li>• Full data export capability</li>
              </ul>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 mb-2">$129</div>
              <Button 
                onClick={handlePurchasePackage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                Purchase Package
              </Button>
            </div>
          </div>
        </Card>

        {/* A La Carte Options (Future) */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Individual Seats</h3>
          <p className="text-gray-600 mb-4">
            A la carte pricing will be available soon. For now, purchase The Saga Package for the best value.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white rounded-lg p-4 opacity-50">
              <h4 className="font-medium text-gray-900">Additional Project</h4>
              <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              <div className="mt-2 text-lg font-semibold text-gray-400">$--</div>
            </div>
            <div className="bg-white rounded-lg p-4 opacity-50">
              <h4 className="font-medium text-gray-900">Facilitator Seat</h4>
              <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              <div className="mt-2 text-lg font-semibold text-gray-400">$--</div>
            </div>
            <div className="bg-white rounded-lg p-4 opacity-50">
              <h4 className="font-medium text-gray-900">Storyteller Seat</h4>
              <p className="text-sm text-gray-600 mt-1">Coming soon</p>
              <div className="mt-2 text-lg font-semibold text-gray-400">$--</div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage History (Future Enhancement) */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <Card className="p-6">
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-600">No recent activity</p>
            <p className="text-sm text-gray-500 mt-1">
              Your seat usage and purchase history will appear here
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}