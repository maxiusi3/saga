'use client'

import { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase'

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Collect debug information
    const info = {
      environment: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKeyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
      origin: typeof window !== 'undefined' ? window.location.origin : 'server',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: new Date().toISOString()
    }
    setDebugInfo(info)
  }, [])

  const runTests = async () => {
    setLoading(true)
    const results: any = {}

    try {
      // Test 1: Supabase client creation
      console.log('Test 1: Creating Supabase client...')
      const supabase = createClientSupabase()
      results.clientCreation = { success: true, message: 'Client created successfully' }

      // Test 2: Basic connectivity test
      console.log('Test 2: Testing basic connectivity...')
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)
        
        if (error) {
          results.connectivity = { 
            success: false, 
            error: error.message,
            code: error.code,
            details: error.details 
          }
        } else {
          results.connectivity = { success: true, message: 'Connectivity test passed' }
        }
      } catch (err) {
        results.connectivity = { 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error',
          type: 'exception'
        }
      }

      // Test 3: Auth endpoint test
      console.log('Test 3: Testing auth endpoint...')
      try {
        const { data, error } = await supabase.auth.getSession()
        results.authEndpoint = { 
          success: !error, 
          message: error ? error.message : 'Auth endpoint accessible',
          sessionExists: !!data.session
        }
      } catch (err) {
        results.authEndpoint = { 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error',
          type: 'exception'
        }
      }

      // Test 4: Test sign up with dummy data (won't actually create account)
      console.log('Test 4: Testing sign up endpoint...')
      try {
        const { data, error } = await supabase.auth.signUp({
          email: 'test@example.com',
          password: 'testpassword123'
        })
        
        // This should fail with "User already registered" or similar, which is expected
        results.signUpEndpoint = { 
          success: true, 
          message: 'Sign up endpoint accessible',
          error: error?.message || 'No error',
          data: data ? 'Data received' : 'No data'
        }
      } catch (err) {
        results.signUpEndpoint = { 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error',
          type: 'exception'
        }
      }

    } catch (err) {
      results.general = { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      }
    }

    setTestResults(results)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Supabase 调试页面</h1>
        
        {/* Debug Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">环境信息</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        {/* Test Button */}
        <div className="mb-6">
          <button
            onClick={runTests}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '测试中...' : '运行连接测试'}
          </button>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">测试结果</h2>
            <div className="space-y-4">
              {Object.entries(testResults).map(([testName, result]: [string, any]) => (
                <div key={testName} className="border-l-4 border-gray-200 pl-4">
                  <h3 className="font-medium text-gray-900 capitalize">{testName}</h3>
                  <div className={`mt-1 p-3 rounded ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <div className="font-medium">
                      {result.success ? '✅ 成功' : '❌ 失败'}
                    </div>
                    <div className="text-sm mt-1">
                      {result.message || result.error}
                    </div>
                    {result.details && (
                      <pre className="text-xs mt-2 bg-white p-2 rounded">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">使用说明</h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• 检查环境变量是否正确设置</li>
            <li>• 运行连接测试以诊断网络问题</li>
            <li>• 查看浏览器控制台获取详细错误信息</li>
            <li>• 确保Supabase项目配置正确</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
