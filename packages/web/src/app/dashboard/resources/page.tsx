'use client'

import { useState, useEffect } from 'react'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, Users, UserPlus, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface ResourceSeat {
  type: 'project' | 'facilitator' | 'storyteller'
  available: number
  used: number
  total: number
  price: number
  description: string
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceSeat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadResources = async () => {
      // Mock data - replace with actual Supabase queries
      const mockResources: ResourceSeat[] = [
        {
          type: 'project',
          available: 1,
          used: 1,
          total: 2,
          price: 15,
          description: 'Create new family story projects'
        },
        {
          type: 'facilitator',
          available: 0,
          used: 1,
          total: 1,
          price: 10,
          description: 'Invite co-facilitators to help manage projects'
        },
        {
          type: 'storyteller',
          available: 1,
          used: 1,
          total: 2,
          price: 5,
          description: 'Invite family members to share their stories'
        }
      ]

      setTimeout(() => {
        setResources(mockResources)
        setLoading(false)
      }, 1000)
    }

    loadResources()
  }, [])

  const getResourceIcon = (type: ResourceSeat['type']) => {
    switch (type) {
      case 'project':
        return <BookOpen className="h-6 w-6 text-furbridge-orange" />
      case 'facilitator':
        return <Users className="h-6 w-6 text-furbridge-teal" />
      case 'storyteller':
        return <UserPlus className="h-6 w-6 text-furbridge-warm-gray" />
    }
  }

  const getResourceTitle = (type: ResourceSeat['type']) => {
    switch (type) {
      case 'project':
        return 'Project Vouchers'
      case 'facilitator':
        return 'Facilitator Seats'
      case 'storyteller':
        return 'Storyteller Seats'
    }
  }

  const handlePurchase = (type: ResourceSeat['type']) => {
    // TODO: Implement individual seat purchase flow
    alert(`Purchase ${type} seat functionality coming soon`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Resources</h1>
          <p className="text-gray-600 mt-1">
            Manage your available seats and purchase additional resources
          </p>
        </div>
        
        <Link href="/dashboard/purchase">
          <FurbridgeButton variant="orange">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Buy More Seats
          </FurbridgeButton>
        </Link>
      </div>

      {/* Resource Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {resources.map((resource) => (
          <FurbridgeCard key={resource.type} className="p-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getResourceIcon(resource.type)}
                  <h3 className="font-semibold text-gray-900">
                    {getResourceTitle(resource.type)}
                  </h3>
                </div>
                <Badge 
                  variant={resource.available > 0 ? "default" : "secondary"}
                  className={resource.available > 0 ? "bg-furbridge-teal text-white" : ""}
                >
                  {resource.available} Available
                </Badge>
              </div>

              {/* Usage Stats */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Usage</span>
                  <span className="text-gray-900">
                    {resource.used} of {resource.total} used
                  </span>
                </div>
                <Progress 
                  value={(resource.used / resource.total) * 100} 
                  className="h-2"
                />
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600">
                {resource.description}
              </p>

              {/* Purchase Button */}
              <FurbridgeButton
                variant="outline"
                className="w-full"
                onClick={() => handlePurchase(resource.type)}
              >
                Buy More (${resource.price} each)
              </FurbridgeButton>
            </div>
          </FurbridgeCard>
        ))}
      </div>

      {/* Usage History */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-5 w-5 text-furbridge-orange" />
                <div>
                  <div className="font-medium text-gray-900">Created "Dad's Life Story"</div>
                  <div className="text-sm text-gray-600">Used 1 Project Voucher</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Jan 15, 2024
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <UserPlus className="h-5 w-5 text-furbridge-warm-gray" />
                <div>
                  <div className="font-medium text-gray-900">Invited John Doe as Storyteller</div>
                  <div className="text-sm text-gray-600">Used 1 Storyteller Seat</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Jan 16, 2024
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-furbridge-teal" />
                <div>
                  <div className="font-medium text-gray-900">Invited Beth Smith as Co-Facilitator</div>
                  <div className="text-sm text-gray-600">Used 1 Facilitator Seat</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Jan 18, 2024
              </div>
            </div>
          </div>
        </div>
      </FurbridgeCard>

      {/* Purchase Options */}
      <FurbridgeCard className="p-6">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Purchase Additional Seats</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-furbridge-orange" />
                  <span className="font-medium text-gray-900">Project Voucher</span>
                </div>
                <div className="text-2xl font-bold text-furbridge-orange">$15</div>
                <p className="text-sm text-gray-600">
                  Create one additional family story project
                </p>
                <FurbridgeButton variant="outline" size="sm" className="w-full">
                  Purchase
                </FurbridgeButton>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-furbridge-teal" />
                  <span className="font-medium text-gray-900">Facilitator Seat</span>
                </div>
                <div className="text-2xl font-bold text-furbridge-teal">$10</div>
                <p className="text-sm text-gray-600">
                  Invite one co-facilitator to help manage projects
                </p>
                <FurbridgeButton variant="outline" size="sm" className="w-full">
                  Purchase
                </FurbridgeButton>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <UserPlus className="h-5 w-5 text-furbridge-warm-gray" />
                  <span className="font-medium text-gray-900">Storyteller Seat</span>
                </div>
                <div className="text-2xl font-bold text-furbridge-warm-gray">$5</div>
                <p className="text-sm text-gray-600">
                  Invite one additional storyteller to your projects
                </p>
                <FurbridgeButton variant="outline" size="sm" className="w-full">
                  Purchase
                </FurbridgeButton>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Need multiple seats? Get better value with our complete package.
            </p>
            <Link href="/dashboard/purchase">
              <FurbridgeButton variant="orange">
                View Saga Package ($29)
              </FurbridgeButton>
            </Link>
          </div>
        </div>
      </FurbridgeCard>
    </div>
  )
}
