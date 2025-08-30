# MVP页面流程对齐需求文档

## 介绍

当前产品实现与原始MVP需求文档（「saga」MVP.md V1.5）存在重大偏差，特别是在页面上下游关系、核心架构和用户流程方面。本需求文档旨在系统性地修正这些偏差，确保产品完全符合原始MVP规范。

**重要架构变更：** 基于产品上线时间考虑，当前版本将完全作为纯Web应用实现，不支持移动端。所有用户（Facilitator和Storyteller）都将通过Web浏览器使用产品。移动应用支持将在后续版本中考虑。这意味着需要特别注重Web端的响应式设计、无障碍功能和老年人友好界面，确保在各种设备的浏览器上都能良好运行。

## 需求

### 需求1：Resource Wallet系统实现

**用户故事：** 作为用户，我希望有一个统一的资源钱包系统来管理我的Project Vouchers、Facilitator Seats和Storyteller Seats，以便我能够灵活地创建项目和邀请家庭成员。

#### 验收标准
1. WHEN 用户登录后 THEN 系统应显示用户的Resource Wallet状态，包括可用的Project Vouchers、Facilitator Seats和Storyteller Seats数量
2. WHEN 用户创建新项目时 THEN 系统应消费一个Project Voucher
3. WHEN 用户邀请Facilitator时 THEN 系统应消费一个Facilitator Seat
4. WHEN 用户邀请Storyteller时 THEN 系统应消费一个Storyteller Seat
5. WHEN 用户资源不足时 THEN 系统应禁用相应功能并提示购买更多资源
6. IF 邀请链接过期或被拒绝 THEN 系统应退还消费的座位

### 需求2：Package Purchase流程重构

**用户故事：** 作为新用户，我希望能够购买"Saga Package"来获得创建家庭故事项目所需的资源，以便开始我的家庭传记项目。

#### 验收标准
1. WHEN 用户首次登录且没有资源时 THEN 系统应引导用户到Package Purchase页面
2. WHEN 用户查看Package详情时 THEN 系统应清楚显示包含的资源："包含[X]个项目创建凭证，[Y]个Facilitator座位，[Z]个Storyteller座位。每个项目包含一年完整交互服务，之后进入永久'存档模式'访问，以及一键完整数据导出。"
3. WHEN 用户成功购买Package时 THEN 系统应将相应资源添加到用户的Resource Wallet
4. WHEN 用户需要额外资源时 THEN 系统应提供"单点购买"选项
5. IF 用户尝试创建项目但没有Project Voucher THEN 系统应显示购买提示

### 需求3：Dashboard页面重构

**用户故事：** 作为Facilitator，我希望Dashboard能够清楚显示我的资源状态和项目概览，以便我能够有效管理我的家庭故事项目。

#### 验收标准
1. WHEN 用户进入Dashboard时 THEN 系统应显示Resource Wallet Summary，格式为"可用座位：1个项目，0个Facilitator，1个Storyteller"
2. WHEN 用户是首次用户且没有项目时 THEN 系统应显示欢迎界面和"创建新Saga"主要CTA按钮
3. WHEN 用户有项目时 THEN 系统应显示项目列表，每个项目卡片包含项目状态、成员信息和快速操作
4. WHEN 用户点击Resource Wallet Summary时 THEN 系统应导航到完整的资源管理页面
5. IF 用户没有Project Voucher THEN "创建新Saga"按钮应被禁用并显示购买提示

### 需求4：Project创建流程修正

**用户故事：** 作为Facilitator，我希望创建项目的流程能够正确消费我的Project Voucher，并引导我完成项目设置，以便开始收集家庭故事。

#### 验收标准
1. WHEN 用户点击"创建项目"时 THEN 系统应检查用户是否有可用的Project Voucher
2. WHEN 用户确认创建项目时 THEN 系统应消费一个Project Voucher并创建项目
3. WHEN 项目创建成功后 THEN 系统应导航到项目空状态页面，显示"邀请Storyteller"和"邀请Co-Facilitator"选项
4. WHEN 用户在项目设置中时 THEN 系统应显示当前项目的订阅状态和到期时间
5. IF 项目创建失败 THEN 系统应退还消费的Project Voucher

### 需求5：邀请系统座位消费

**用户故事：** 作为Facilitator，我希望邀请系统能够正确管理座位消费，确保只有在邀请被接受时才消费座位，以便有效管理我的资源。

#### 验收标准
1. WHEN 用户发送邀请时 THEN 系统应预留相应座位但不立即消费
2. WHEN 邀请被接受时 THEN 系统应正式消费预留的座位
3. WHEN 邀请过期或被拒绝时 THEN 系统应释放预留的座位
4. WHEN 用户没有足够座位时 THEN 邀请按钮应被禁用并显示"购买更多座位"提示
5. IF 多个邀请同时发送 THEN 系统应正确管理座位预留和消费

### 需求6：页面导航流程对齐

**用户故事：** 作为用户，我希望页面间的导航流程符合设计的用户旅程，以便获得流畅的用户体验。

#### 验收标准
1. WHEN 新用户首次登录时 THEN 系统应按照"Journey 1: Facilitator - From Download to Project Launch"流程导航
2. WHEN Storyteller接受邀请时 THEN 系统应按照"Journey 2: Storyteller - From Invitation to Ready-to-Record"流程导航
3. WHEN 用户进行核心交互时 THEN 系统应按照"Journey 3: The Core Interaction Loop"流程运行
4. WHEN 用户导出数据时 THEN 系统应按照"Journey 4: Facilitator - Data Export Flow"流程执行
5. WHEN 用户邀请Co-Facilitator时 THEN 系统应按照"Journey 5: Facilitator - Inviting a Co-Facilitator"流程操作

### 需求7：响应式Web设计实现

**用户故事：** 作为用户，我希望Web应用能够在不同设备和屏幕尺寸上良好运行，以便在桌面、平板和手机浏览器上都能正常使用产品功能。

#### 验收标准
1. WHEN 用户在不同设备上访问时 THEN Web应用应自动适配屏幕尺寸和触摸交互
2. WHEN 用户在移动浏览器上使用时 THEN 所有功能应保持完整可用性
3. WHEN 用户在平板上使用时 THEN 界面应优化触摸操作和显示布局
4. WHEN 用户在桌面浏览器上使用时 THEN 应充分利用大屏幕空间提供更好的体验
5. WHEN 网络连接不稳定时 THEN 系统应提供适当的离线提示和重试机制
6. IF 浏览器功能不支持 THEN 系统应提供功能降级和替代方案

### 需求8：多Facilitator协作支持

**用户故事：** 作为项目中的多个Facilitator（如兄弟姐妹），我们希望能够协作管理同一个家庭故事项目，以便共同参与家庭记忆的收集和整理。

#### 验收标准
1. WHEN 项目有多个Facilitator时 THEN 所有Facilitator应能看到彼此的交互和评论
2. WHEN Facilitator添加评论或问题时 THEN 系统应清楚标识作者（如"Alex问道："，"Beth评论："）
3. WHEN 新的交互发生时 THEN 系统应通知所有项目中的Facilitator
4. WHEN 查看项目成员时 THEN 系统应显示所有Facilitator和他们的角色
5. IF Facilitator离开项目 THEN 系统应正确处理权限和通知

### 需求9：存档模式和订阅管理

**用户故事：** 作为用户，我希望清楚了解项目的订阅状态和存档模式，以便做出续费决策并了解长期价值。

#### 验收标准
1. WHEN 项目接近一年期限时 THEN 系统应提前通知用户即将进入存档模式
2. WHEN 项目进入存档模式时 THEN 用户应仍能查看和导出所有内容，但无法添加新故事或交互
3. WHEN 用户想要重新激活项目时 THEN 系统应提供续费选项
4. WHEN 查看项目详情时 THEN 系统应清楚显示当前订阅状态和剩余时间
5. IF 用户在存档模式下尝试添加内容 THEN 系统应显示续费提示

### 需求10：Web端老年人友好界面设计

**用户故事：** 作为老年Storyteller用户，我希望Web端界面简洁易用、字体清晰、操作简单，以便我能够轻松使用浏览器完成录音和查看故事等任务。

#### 验收标准
1. WHEN Storyteller访问Web端时 THEN 系统应提供专门的老年人友好界面模式
2. WHEN Storyteller进行录音时 THEN 系统应提供大按钮、清晰指示和简单的"按住录音"Web交互
3. WHEN Storyteller查看内容时 THEN 系统应支持大字体（标准、大、特大）和高对比度模式
4. WHEN Storyteller需要帮助时 THEN 系统应提供简单的帮助说明和技术支持联系方式
5. WHEN 使用不同浏览器时 THEN 系统应确保在主流浏览器（Chrome、Safari、Firefox、Edge）上的兼容性
6. IF 浏览器不支持录音 THEN 系统应提供友好的错误提示和解决方案

### 需求11：数据导出结构优化

**用户故事：** 作为数据所有者，我希望导出的数据具有清晰的结构和完整的内容，以便长期保存和使用。

#### 验收标准
1. WHEN 用户请求数据导出时 THEN 系统应生成符合需求文档指定结构的ZIP文件
2. WHEN 导出完成时 THEN 系统应通过安全链接发送到用户邮箱
3. WHEN 查看导出文件时 THEN 应包含metadata.json和按日期组织的故事文件夹
4. WHEN 每个故事文件夹中时 THEN 应包含audio.mp3、transcript.txt、photo.jpg（如有）和interactions.json
5. IF 导出过程失败 THEN 系统应通知用户并提供重试选项