# MVP页面流程对齐实施任务

## 任务概述

本任务列表将设计文档转化为具体的编码任务，按照优先级和依赖关系组织，确保系统能够逐步重构以符合MVP需求文档规范。

## 实施任务

- [x] 1. 核心架构和数据模型重构
  - 实现Resource Wallet系统的后端基础架构
  - 更新数据库模型以支持座位管理和Package系统
  - _需求: 1, 2, 4, 5_

- [x] 1.1 创建Resource Wallet数据模型和服务
  - 在`packages/shared/src/types/`中创建ResourceWallet和SeatTransaction类型定义
  - 在`packages/backend/src/models/`中创建resource-wallet.ts和seat-transaction.ts模型
  - 在`packages/backend/src/services/`中实现resource-wallet-service.ts，包含座位消费、预留、释放逻辑
  - 编写单元测试验证座位管理的原子性操作
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 1.2 创建Package管理系统
  - 在`packages/shared/src/types/`中创建Package类型定义
  - 在`packages/backend/src/models/`中创建package.ts模型
  - 在`packages/backend/src/services/`中实现package-service.ts，处理Package购买和资源分配
  - 创建数据库迁移文件添加packages表和相关索引
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.3 更新邀请系统支持座位预留
  - 修改`packages/backend/src/models/invitation.ts`添加seatReserved字段
  - 更新`packages/backend/src/services/invitation-service.ts`实现座位预留逻辑
  - 修改邀请接受流程，确保座位在接受时正式消费
  - 实现邀请过期时的座位释放机制
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 1.4 创建数据库迁移
  - 创建user_resource_wallets表的迁移文件
  - 创建seat_transactions表的迁移文件
  - 创建packages表的迁移文件
  - 更新invitations表添加seat_reserved字段
  - 添加必要的索引和外键约束
  - _需求: 1, 2, 5_

- [x] 2. 后端API端点实现
  - 创建Resource Wallet管理的API端点
  - 实现Package购买流程的API端点
  - 更新项目和邀请相关API以支持座位管理
  - _需求: 1, 2, 4, 5_

- [x] 2.1 实现Resource Wallet API端点
  - 在`packages/backend/src/routes/`中创建wallets.ts路由文件
  - 在`packages/backend/src/controllers/`中创建wallet-controller.ts
  - 实现GET /api/wallets/:userId获取钱包状态
  - 实现GET /api/wallets/:userId/transactions获取交易历史
  - 实现POST /api/wallets/:userId/consume消费资源端点
  - 编写API集成测试验证所有端点功能
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.2 实现Package购买API端点
  - 在`packages/backend/src/routes/`中创建packages.ts路由文件
  - 在`packages/backend/src/controllers/`中创建package-controller.ts
  - 实现GET /api/packages获取可用Package列表
  - 实现POST /api/packages/:id/purchase处理Package购买
  - 集成支付网关（Stripe）处理支付流程
  - 实现购买成功后的资源分配逻辑
  - _需求: 2.1, 2.2, 2.3, 2.4_

- [x] 2.3 更新项目管理API
  - 修改`packages/backend/src/controllers/project-controller.ts`
  - 在项目创建时检查并消费Project Voucher
  - 更新项目创建响应包含资源消费信息
  - 实现项目创建失败时的资源退还逻辑
  - 添加项目订阅状态查询端点
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.4 更新邀请管理API
  - 修改`packages/backend/src/controllers/invitation-controller.ts`
  - 在发送邀请时实现座位预留逻辑
  - 在邀请接受时实现座位正式消费
  - 在邀请过期/拒绝时实现座位释放
  - 添加邀请状态查询端点显示座位预留状态
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. 前端组件实现
  - 实现Resource Wallet前端组件
  - 实现Package购买界面
  - 更新项目创建和管理界面
  - 更新邀请管理界面
  - _需求: 1, 2, 3_

- [x] 3.1 实现Resource Wallet前端组件
  - 验证现有ResourceWalletSummary.tsx组件功能完整
  - 确认WalletStatus.tsx显示详细资源和交易历史
  - 验证资源状态的实时更新和错误处理
  - 确认PurchasePrompt.tsx提供"购买更多资源"的快速链接
  - 验证ResourceErrorAlert.tsx和resource-validation.ts库功能
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.2 实现Package购买界面
  - 验证现有购买页面`packages/web/src/app/dashboard/purchase/page.tsx`功能完整
  - 确认购买成功页面`packages/web/src/app/dashboard/purchase/success/page.tsx`正常工作
  - 验证Stripe支付组件集成和错误处理
  - 确认购买流程的用户体验优化已实现
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.3 更新项目创建和管理界面
  - 更新`packages/web/src/app/dashboard/projects/new/page.tsx`增强错误处理
  - 验证项目创建时的资源检查和消费确认
  - 确认资源不足时的详细错误信息显示
  - 验证项目管理页面显示订阅状态和成员信息
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3.4 更新邀请管理界面
  - 大幅增强`packages/web/src/app/dashboard/projects/[id]/invite/page.tsx`
  - 添加ResourceWalletSummary组件显示当前资源状态
  - 实现座位预留状态显示和邀请需求检查
  - 添加现有邀请列表显示座位预留信息
  - 实现邀请取消功能和座位释放
  - 优化多Facilitator协作的邀请界面
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. 测试和验证
  - 编写Resource Wallet集成测试
  - 编写Package购买流程测试
  - 编写项目创建流程测试
  - 编写邀请流程测试
  - _需求: 1, 2, 4, 5_

- [x] 4.1 编写Resource Wallet集成测试
  - 验证现有wallet-transaction-flows.test.ts测试覆盖完整
  - 确认resource-wallet-service.test.ts单元测试功能
  - 验证auth-wallet.test.ts集成测试场景
  - 确认所有Resource Wallet操作的测试覆盖
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4.2 编写Package购买流程测试
  - 创建package-purchase-integration.test.ts全面测试套件
  - 实现Package列表、详情、支付意图创建的测试
  - 添加Package购买完成和资源分配的测试
  - 实现购买历史和推荐系统的测试
  - 添加支付失败和错误处理的测试场景
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.3 编写项目创建流程测试
  - 验证现有project-creation-integration.test.ts测试完整性
  - 确认项目创建时Resource Wallet集成测试
  - 验证资源不足时的错误处理测试
  - 确认项目创建成功后的资源消费测试
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.4 编写邀请流程测试
  - 创建invitation-seat-reservation-integration.test.ts测试套件
  - 实现邀请创建时座位预留的测试
  - 添加邀请接受时座位消费的测试
  - 实现邀请取消和过期时座位释放的测试
  - 添加多邀请并发和跨角色管理的测试
  - 实现审计跟踪和事务日志的测试
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Storyteller专用界面开发
  - 创建老年人友好的Web界面
  - 实现浏览器录音功能
  - 优化无障碍设计和响应式布局
  - _需求: 7, 10_

- [x] 5.1 创建Storyteller Dashboard
  - 在`packages/web/src/components/storyteller/`中创建StorytellerDashboard.tsx
  - 实现大字体、高对比度的界面选项
  - 创建简化的导航和清晰的操作指引
  - 显示当前AI提示和录音入口
  - 添加家人反馈的清晰展示
  - _需求: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 5.2 实现Web录音组件
  - 在`packages/web/src/components/recording/`中创建WebAudioRecorder.tsx
  - 实现浏览器麦克风权限请求和处理
  - 创建大型录音按钮和清晰的状态指示
  - 实现录音回放和确认发送功能
  - 添加浏览器兼容性检查和降级方案
  - _需求: 10.1, 10.2, 10.5, 10.6_

- [x] 5.3 优化Storyteller用户体验
  - 实现"Review & Send"确认流程
  - 创建录音质量指示和重录选项
  - 添加简单的帮助说明和技术支持联系
  - 优化移动浏览器上的录音体验
  - 实现录音草稿恢复功能
  - _需求: 6.2, 10.1, 10.2, 10.4, 10.6_

- [x] 6. 响应式设计和无障碍优化
  - 实现全站响应式布局
  - 优化移动浏览器体验
  - 确保WCAG 2.1 AA合规性
  - _需求: 7, 10_

- [x] 6.1 实现响应式布局系统
  - 更新`packages/web/src/app/globals.css`添加响应式断点
  - 修改所有主要组件支持移动、平板、桌面布局
  - 优化触摸交互和按钮大小
  - 实现自适应导航和菜单系统
  - 测试各种设备和浏览器的兼容性
  - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 6.2 无障碍功能实现
  - 添加ARIA标签和语义化HTML结构
  - 实现键盘导航支持
  - 创建屏幕阅读器友好的内容结构
  - 添加焦点管理和跳转链接
  - 实现颜色对比度和字体大小选项
  - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. 页面流程和导航优化
  - 实现符合需求文档的用户旅程
  - 优化页面间的导航关系
  - 添加状态管理和错误处理
  - _需求: 6_

- [x] 7.1 实现新用户首次登录流程
  - 创建欢迎页面和Package介绍流程
  - 实现首次用户的引导和教程
  - 优化从注册到第一个项目创建的完整流程
  - 添加流程中断恢复和状态保存
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7.2 优化项目管理流程
  - 实现项目创建到邀请发送的完整流程
  - 优化项目设置和成员管理界面
  - 添加项目状态跟踪和订阅管理
  - 实现多Facilitator协作的界面优化
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7.3 实现核心交互循环
  - 优化Storyteller录音到Facilitator反馈的完整循环
  - 实现实时通知和状态更新
  - 添加交互历史和进度跟踪
  - 优化多用户协作的同步机制
  - _需求: 6.2, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. 数据导出和订阅管理
  - 实现符合需求的数据导出结构
  - 添加订阅状态管理和存档模式
  - 优化长期价值展示
  - _需求: 9, 11_

- [x] 8.1 实现数据导出功能
  - 修改`packages/backend/src/services/export-service.ts`
  - 实现符合需求文档的ZIP文件结构
  - 添加metadata.json和按日期组织的故事文件夹
  - 实现异步导出处理和邮件通知
  - 添加导出进度跟踪和错误处理
  - _需求: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 8.2 实现订阅和存档模式管理
  - 创建订阅状态跟踪和到期提醒系统
  - 实现存档模式的功能限制和界面提示
  - 添加续费流程和重新激活功能
  - 创建订阅管理界面显示状态和历史
  - _需求: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. 测试和质量保证
  - 编写全面的单元测试和集成测试
  - 实现端到端测试覆盖关键用户流程
  - 进行无障碍和性能测试
  - _需求: 所有需求_

- [x] 9.1 后端测试套件
  - 为所有新的服务类编写单元测试
  - 创建Resource Wallet操作的集成测试
  - 实现Package购买流程的端到端测试
  - 添加邀请和座位管理的测试用例
  - 测试数据库迁移和回滚流程
  - _需求: 1, 2, 4, 5_

- [x] 9.2 前端组件测试
  - 为所有新组件编写单元测试
  - 创建用户交互的集成测试
  - 实现响应式布局的视觉回归测试
  - 添加无障碍功能的自动化测试
  - 测试浏览器兼容性和录音功能
  - _需求: 3, 7, 10_

- [x] 9.3 端到端用户流程测试
  - 实现新用户注册到项目创建的完整测试
  - 创建Storyteller邀请接受和录音的测试流程
  - 测试多Facilitator协作场景
  - 验证数据导出和订阅管理功能
  - 添加错误场景和边界情况测试
  - _需求: 6, 8, 9, 11_

- [x] 10. 部署和监控
  - 准备生产环境部署
  - 实现监控和错误跟踪
  - 优化性能和安全性
  - _需求: 所有需求_

- [x] 10.1 生产环境准备
  - 配置生产数据库和迁移脚本
  - 设置支付网关的生产环境配置
  - 实现环境变量和密钥管理
  - 配置CDN和静态资源优化
  - 设置SSL证书和安全头配置
  - _需求: 所有需求_

- [x] 10.2 监控和日志系统
  - 实现应用性能监控（APM）
  - 添加错误跟踪和报警系统
  - 创建业务指标监控仪表板
  - 实现用户行为分析和转化跟踪
  - 设置系统健康检查和自动恢复
  - _需求: 所有需求_

- [x] 10.3 性能优化和安全加固
  - 实现代码分割和懒加载优化
  - 添加API速率限制和安全中间件
  - 优化数据库查询和索引
  - 实现缓存策略和CDN配置
  - 进行安全审计和渗透测试
  - _需求: 所有需求_