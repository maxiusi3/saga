'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Lightbulb,
  DollarSign,
  BarChart3,
  ArrowRight,
  Star,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export interface PlanRecommendation {
  recommendedPlan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingPeriod: 'monthly' | 'yearly';
  };
  reason: string;
  potentialSavings?: number;
  usageAnalysis: {
    currentUsage: Record<string, number>;
    projectedUsage: Record<string, number>;
    efficiency: number;
  };
}

interface PlanRecommendationsProps {
  recommendation: PlanRecommendation;
  onViewPlans: () => void;
  onUpgrade: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PlanRecommendations({
  recommendation,
  onViewPlans,
  onUpgrade,
  onDismiss,
  className = ''
}: PlanRecommendationsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: recommendation.recommendedPlan.currency.toUpperCase()
    }).format(amount);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyIcon = (efficiency: number) => {
    if (efficiency >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (efficiency >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <TrendingDown className="h-5 w-5 text-red-600" />;
  };

  const getRecommendationType = () => {
    if (recommendation.potentialSavings && recommendation.potentialSavings > 0) {
      return {
        type: 'savings',
        icon: DollarSign,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    } else if (recommendation.usageAnalysis.efficiency < 60) {
      return {
        type: 'optimization',
        icon: Target,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    } else {
      return {
        type: 'upgrade',
        icon: TrendingUp,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      };
    }
  };

  const recommendationType = getRecommendationType();
  const RecommendationIcon = recommendationType.icon;

  return (
    <Card className={`${recommendationType.bgColor} ${recommendationType.borderColor} border-2 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${recommendationType.bgColor}`}>
              <RecommendationIcon className={`h-6 w-6 ${recommendationType.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
                Plan Recommendation
              </h3>
              <p className="text-sm text-gray-600">Based on your usage patterns</p>
            </div>
          </div>
          
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </Button>
          )}
        </div>

        {/* Recommendation Details */}
        <div className="space-y-4">
          <div className={`p-4 bg-white rounded-lg border ${recommendationType.borderColor}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Recommended Plan</h4>
              <Badge className={`${recommendationType.color} bg-white`}>
                <Star className="h-3 w-3 mr-1" />
                Best Fit
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {recommendation.recommendedPlan.name}
                </div>
                <div className="text-sm text-gray-600">
                  {formatCurrency(recommendation.recommendedPlan.price)} 
                  /{recommendation.recommendedPlan.billingPeriod === 'yearly' ? 'year' : 'month'}
                </div>
              </div>
              
              {recommendation.potentialSavings && recommendation.potentialSavings > 0 && (
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    Save {formatCurrency(recommendation.potentialSavings)}
                  </div>
                  <div className="text-sm text-green-700">per year</div>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="p-4 bg-white rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Why This Plan?</h4>
            <p className="text-sm text-gray-700">{recommendation.reason}</p>
          </div>

          {/* Usage Analysis */}
          <div className="p-4 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 flex items-center">
                <BarChart3 className="h-4 w-4 mr-2 text-gray-600" />
                Usage Efficiency
              </h4>
              <div className="flex items-center space-x-2">
                {getEfficiencyIcon(recommendation.usageAnalysis.efficiency)}
                <span className={`font-medium ${getEfficiencyColor(recommendation.usageAnalysis.efficiency)}`}>
                  {recommendation.usageAnalysis.efficiency}%
                </span>
              </div>
            </div>
            
            <Progress 
              value={recommendation.usageAnalysis.efficiency} 
              className="h-3 mb-3"
              indicatorClassName={
                recommendation.usageAnalysis.efficiency >= 80 ? 'bg-green-500' :
                recommendation.usageAnalysis.efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }
            />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600 mb-2">Current Usage</div>
                <div className="space-y-1">
                  {Object.entries(recommendation.usageAnalysis.currentUsage).map(([feature, usage]) => (
                    <div key={feature} className="flex justify-between">
                      <span className="text-gray-700 capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="font-medium">{usage}%</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="text-gray-600 mb-2">Projected Usage</div>
                <div className="space-y-1">
                  {Object.entries(recommendation.usageAnalysis.projectedUsage).map(([feature, usage]) => (
                    <div key={feature} className="flex justify-between">
                      <span className="text-gray-700 capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="font-medium text-blue-600">{usage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onViewPlans}
              variant="outline"
              className="flex-1"
            >
              Compare All Plans
            </Button>
            <Button
              onClick={onUpgrade}
              className={`flex-1 ${
                recommendationType.type === 'savings' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : recommendationType.type === 'optimization'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {recommendationType.type === 'savings' ? 'Save Money' : 
               recommendationType.type === 'optimization' ? 'Optimize Plan' : 'Upgrade Now'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Additional Benefits */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-medium text-gray-900 mb-2">Additional Benefits</h5>
            <ul className="text-sm text-gray-700 space-y-1">
              {recommendationType.type === 'savings' && (
                <>
                  <li>• Reduce monthly costs while maintaining features</li>
                  <li>• Better alignment with your actual usage</li>
                  <li>• Optimize your subscription investment</li>
                </>
              )}
              {recommendationType.type === 'optimization' && (
                <>
                  <li>• Better match for your family's needs</li>
                  <li>• Improved feature utilization</li>
                  <li>• Enhanced storytelling experience</li>
                </>
              )}
              {recommendationType.type === 'upgrade' && (
                <>
                  <li>• Access to advanced features</li>
                  <li>• Increased capacity for growth</li>
                  <li>• Enhanced family collaboration tools</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default PlanRecommendations;