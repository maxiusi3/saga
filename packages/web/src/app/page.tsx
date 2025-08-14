import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Saga Family Biography
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            用AI技术记录和传承家庭故事，让每一个珍贵的回忆都得到完美保存。
          </p>
          
          <div className="space-x-4">
            <Link
              href="/auth/signin"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              开始使用
            </Link>
            <Link
              href="/auth/signup"
              className="inline-block border border-blue-600 text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              注册账户
            </Link>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-blue-600 text-xl">🎙️</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">语音录制</h3>
            <p className="text-gray-600">简单录制家庭故事，AI自动转换为文字</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-green-600 text-xl">👨‍👩‍👧‍👦</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">家庭协作</h3>
            <p className="text-gray-600">邀请家庭成员共同参与故事记录</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-purple-600 text-xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">永久保存</h3>
            <p className="text-gray-600">安全存储，支持多种格式导出</p>
          </div>
        </div>
      </div>
    </div>
  )
}
