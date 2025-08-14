# Saga 测试环境指南

本文档描述了 Saga 应用的测试环境配置、部署和使用方法。

## 概述

Saga 提供了多种测试环境选项：

1. **本地测试环境** - 使用 Docker Compose 在本地运行完整的测试环境
2. **云端测试环境** - 部署到 AWS 的独立测试环境
3. **演示模式** - 轻量级的演示服务器，用于快速原型验证

## 本地测试环境

### 快速启动

```bash
# 启动完整的测试环境
npm run test-env:start

# 或者使用 Docker Compose 直接启动
docker-compose -f docker-compose.test.yml up -d
```

### 环境配置

本地测试环境包含以下服务：

- **PostgreSQL** (端口 5433) - 测试数据库
- **Redis** (端口 6380) - 缓存和会话存储
- **Backend API** (端口 3002) - 后端服务
- **Frontend** (端口 3003) - 前端应用
- **Nginx** (端口 8080) - 反向代理

### 访问地址

- **应用入口**: http://localhost:8080
- **前端直接访问**: http://localhost:3003
- **后端API直接访问**: http://localhost:3002
- **健康检查**: http://localhost:8080/health

### 测试账号

```
邮箱: test@saga.app
密码: TestPassword123!
```

### 常用命令

```bash
# 启动测试环境
npm run test-env:start

# 停止测试环境
npm run test-env:stop

# 重启测试环境
npm run test-env:restart

# 查看日志
npm run test-env:logs

# 运行测试套件
npm run test-env:test

# 清理环境（删除数据）
npm run test-env:clean

# 健康检查
npm run test-env:health

# 显示环境信息
npm run test-env:info
```

### 数据库访问

```bash
# 连接到测试数据库
docker-compose -f docker-compose.test.yml exec postgres-test psql -U saga_test_user -d saga_test

# 或者使用外部工具连接
# Host: localhost
# Port: 5433
# Database: saga_test
# Username: saga_test_user
# Password: saga_test_password
```

## 云端测试环境

### 部署到 AWS

```bash
# 部署测试环境到 AWS
npm run deploy:test

# 验证部署
npm run deploy:test:validate

# 回滚部署
npm run deploy:test:rollback
```

### 环境配置

云端测试环境使用以下 AWS 服务：

- **ECS Fargate** - 容器运行环境
- **RDS PostgreSQL** - 托管数据库
- **ElastiCache Redis** - 托管缓存
- **Application Load Balancer** - 负载均衡
- **S3 + CloudFront** - 文件存储和CDN
- **WAF** - Web应用防火墙
- **Secrets Manager** - 密钥管理

### 自动部署

测试环境支持自动部署：

- **触发条件**: 推送到 `develop` 分支或创建 Pull Request
- **部署流程**: 
  1. 运行单元测试
  2. 构建 Docker 镜像
  3. 部署基础设施
  4. 更新服务
  5. 运行数据库迁移
  6. 执行部署验证
  7. 运行端到端测试
  8. 执行安全扫描

### CI/CD 工作流

```yaml
# .github/workflows/test-deployment.yml
# 自动触发测试环境部署和测试
```

## 演示模式

### 启动演示服务器

```bash
# 启动演示模式
npm run demo

# 或者直接运行
cd packages/backend
npm run demo
```

### 演示模式特点

- **轻量级**: 不需要数据库，使用内存存储
- **快速启动**: 几秒钟即可启动
- **预置数据**: 包含演示用户和项目数据
- **API兼容**: 与完整版API完全兼容

### 演示账号

```
邮箱: demo@saga.app
密码: 任意密码
```

## 测试策略

### 测试类型

1. **单元测试** - 测试单个组件和函数
2. **集成测试** - 测试服务间的集成
3. **端到端测试** - 测试完整的用户流程
4. **API测试** - 测试REST API端点
5. **安全测试** - 测试安全漏洞和配置
6. **性能测试** - 测试系统性能和负载

### 测试命令

```bash
# 运行所有测试
npm test

# 运行特定类型的测试
npm run test:backend
npm run test:web
npm run test:mobile
npm run test:e2e

# 运行API测试
npm run api:test

# 在测试环境中运行完整测试套件
npm run test-env:test
```

### 测试数据

测试环境使用独立的测试数据：

- **用户数据**: 预置的测试用户账号
- **项目数据**: 示例项目和故事
- **文件数据**: 模拟的音频和图片文件
- **配置数据**: 测试专用的配置参数

## 环境变量

### 本地测试环境变量

```bash
# packages/backend/.env.test
NODE_ENV=test
DATABASE_URL=postgresql://saga_test_user:saga_test_password@localhost:5433/saga_test
REDIS_URL=redis://localhost:6380
JWT_SECRET=test-jwt-secret-key-for-testing-only
CORS_ORIGIN=http://localhost:3000,http://localhost:3003,http://localhost:8080

# 测试用的API密钥（使用虚拟值）
OPENAI_API_KEY=test-openai-key
STRIPE_SECRET_KEY=sk_test_dummy_key
SENDGRID_API_KEY=test-sendgrid-key
AWS_ACCESS_KEY_ID=test-access-key
AWS_SECRET_ACCESS_KEY=test-secret-key
```

### 云端测试环境变量

云端环境的敏感配置存储在 AWS Secrets Manager 中：

- `saga-database-test` - 数据库凭据
- `saga-app-secrets-test` - 应用密钥

## 监控和日志

### 本地环境监控

```bash
# 查看所有服务日志
npm run test-env:logs

# 查看特定服务日志
docker-compose -f docker-compose.test.yml logs -f backend-test
docker-compose -f docker-compose.test.yml logs -f web-test
docker-compose -f docker-compose.test.yml logs -f postgres-test
```

### 云端环境监控

- **CloudWatch Logs** - 应用日志
- **CloudWatch Metrics** - 系统指标
- **Health Checks** - 服务健康状态
- **Sentry** - 错误跟踪（如果配置）

## 故障排除

### 常见问题

#### 端口冲突

```bash
# 检查端口占用
lsof -i :3002
lsof -i :3003
lsof -i :5433
lsof -i :6380
lsof -i :8080

# 停止占用端口的服务
npm run test-env:stop
```

#### 数据库连接问题

```bash
# 重启数据库
docker-compose -f docker-compose.test.yml restart postgres-test

# 检查数据库状态
docker-compose -f docker-compose.test.yml ps postgres-test

# 查看数据库日志
docker-compose -f docker-compose.test.yml logs postgres-test
```

#### 服务启动失败

```bash
# 查看服务状态
docker-compose -f docker-compose.test.yml ps

# 重新构建镜像
docker-compose -f docker-compose.test.yml build --no-cache

# 完全重置环境
npm run test-env:clean
npm run test-env:start
```

#### 云端部署问题

```bash
# 检查 AWS 凭据
aws sts get-caller-identity

# 查看 CloudFormation 堆栈状态
aws cloudformation describe-stacks --stack-name saga-test-stack

# 查看 ECS 服务状态
aws ecs describe-services --cluster saga-cluster-test --services saga-api-test saga-web-test
```

### 调试技巧

1. **使用健康检查端点**确认服务状态
2. **查看容器日志**了解错误详情
3. **检查网络连接**确保服务间通信正常
4. **验证环境变量**确保配置正确
5. **使用数据库客户端**直接检查数据

## 最佳实践

### 测试环境使用

1. **隔离性** - 测试环境与开发和生产环境完全隔离
2. **一致性** - 测试环境配置尽可能接近生产环境
3. **可重复性** - 可以随时重置和重建测试环境
4. **自动化** - 通过脚本和CI/CD自动管理测试环境

### 测试数据管理

1. **使用种子数据** - 预置一致的测试数据
2. **数据清理** - 测试后清理临时数据
3. **数据隔离** - 不同测试使用不同的数据集
4. **数据备份** - 重要测试数据的备份和恢复

### 安全考虑

1. **测试凭据** - 使用专门的测试凭据，不要使用生产凭据
2. **网络隔离** - 测试环境网络与生产环境隔离
3. **数据脱敏** - 测试数据不包含真实的敏感信息
4. **访问控制** - 限制测试环境的访问权限

## 下一步

设置好测试环境后，你可以：

1. **运行完整的测试套件**验证功能
2. **执行性能测试**评估系统性能
3. **进行安全测试**检查安全漏洞
4. **测试部署流程**验证CI/CD管道
5. **培训团队成员**使用测试环境

## 支持和反馈

如果在使用测试环境时遇到问题：

1. 查看本文档的故障排除部分
2. 检查 GitHub Issues 中的已知问题
3. 联系开发团队获取支持
4. 提交新的 Issue 报告问题

---

**最后更新**: 2024年2月
**版本**: 1.0
**维护者**: Saga 开发团队