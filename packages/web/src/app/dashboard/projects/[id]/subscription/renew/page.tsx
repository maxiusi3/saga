'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function SubscriptionRenewPage() {
  const params = useParams()
  const [loading, setLoading] = useState(false)

  const handleRenew = async () => {
    setLoading(true)
    // 模拟续费处理
    setTimeout(() => {
      setLoading(false)
      alert('续费成功！')
    }, 2000)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            href={`/dashboard/projects/${params.id}/subscription`}
            className="text-blue-600 hover:text-blue-800"
          >
            ← 返回订阅管理
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">续费订阅</h1>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">续费您的订阅</h2>
        
        <div className="mb-6">
          <p className="text-gray-600">
            续费您的Saga订阅以继续享受完整功能。
          </p>
        </div>

        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">Saga Package</h3>
          <p className="text-gray-600 text-sm mb-2">包含所有核心功能</p>
          <p className="text-2xl font-bold text-gray-900">¥99/年</p>
        </div>

        <button
          onClick={handleRenew}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '处理中...' : '立即续费'}
        </button>
      </div>
    </div>
  )
}
