# Rust ERP 系统架构设计文档

## 1. 系统概述

### 1.1 项目背景
本项目旨在使用 Rust 语言和微服务架构，从零开发一套完整的 ERP 系统，用于替代传统的 KILLER 系统。系统采用领域驱动设计（DDD）、CQRS 模式和事件溯源（Event Sourcing）等现代架构模式。

### 1.2 设计目标
- **高性能**：利用 Rust 的零成本抽象和内存安全特性，实现高性能低延迟
- **可扩展性**：微服务架构支持水平扩展和独立部署
- **业务完整性**：覆盖 KILLER 全部核心模块功能
- **可维护性**：DDD 分层架构确保代码清晰、职责分离
- **数据一致性**：事件溯源保证数据完整性和可追溯性

### 1.3 技术栈选型

| 技术领域 | 选型 | 版本 | 选型理由 |
|---------|------|------|---------|
| 编程语言 | Rust | 2021 Edition | 内存安全、高性能、并发友好 |
| Web 框架 | Axum | 0.7 | 基于 Tokio、类型安全、生态完善 |
| 数据库 | PostgreSQL | 16 | ACID、JSON支持、成熟稳定 |
| 缓存 | Redis | 7 | 高性能、支持多种数据结构 |
| 消息队列 | Apache Kafka | 3.x | 高吞吐、持久化、事件溯源基础 |
| RPC 框架 | gRPC (Tonic) | 0.11 | 高性能、类型安全、双向流 |
| ORM | SQLx | 0.7 | 编译时 SQL 检查、异步支持 |
| 容器编排 | Kubernetes | 1.28+ | 服务发现、自动扩缩容、健康检查 |
| 监控 | Prometheus + Grafana | - | 指标采集、可视化、告警 |
| 日志 | Loki + Vector | - | 日志聚合、查询分析 |
| 链路追踪 | Jaeger | - | 分布式追踪、性能分析 |

---

## 2. 整体架构设计

### 2.1 架构风格

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端层 (Clients)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Web UI  │  │ Mobile   │  │  Desktop │  │ 3rd API  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS/HTTP2
┌─────────────────────────────────────────────────────────────────┐
│                      API 网关层 (API Gateway)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Kong / Nginx + 认证 + 限流 + 路由 + 负载均衡              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ gRPC/REST
┌─────────────────────────────────────────────────────────────────┐
│                      微服务层 (Microservices)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   财务   │ │   销售   │ │   采购   │ │   生产   │  ...      │
│  │ Financial│ │  Sales   │ │Materials │ │Production│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│       ↓              ↓              ↓              ↓             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              共享服务 (Shared Services)                 │     │
│  │  认证服务 │ 事件总线 │ 配置中心 │ 服务发现              │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │PostgreSQL│ │  Redis   │ │  Kafka   │ │  S3/OSS  │           │
│  │  主数据  │ │   缓存   │ │ 事件存储 │ │ 文件存储 │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   基础设施层 (Infrastructure)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Kubernetes + Docker + Prometheus + Grafana + Jaeger     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 微服务划分（对应 KILLER 模块）

| 微服务名称 | KILLER 模块 | 核心职责 | 数据库 |
|-----------|---------|---------|-------|
| financial-service | FI (财务会计) | 总账、应收应付、资产管理、银行管理 | financial_db |
| controlling-service | CO (管理会计) | 成本中心、成本要素、内部订单、获利分析 | controlling_db |
| materials-service | MM (物料管理) | 采购、库存、供应商管理、物料主数据 | materials_db |
| sales-service | SD (销售与分销) | 销售订单、定价、发货、开票 | sales_db |
| production-service | PP (生产计划) | 生产订单、MRP、工艺路线、BOM | production_db |
| hr-service | HR (人力资源) | 组织管理、薪资、考勤、招聘培训 | hr_db |
| quality-service | QM (质量管理) | 质检计划、检验批次、质量通知 | quality_db |
| maintenance-service | PM (设备维护) | 设备主数据、维护计划、工单管理 | maintenance_db |
| crm-service | CRM (客户关系) | 客户主数据、营销活动、服务管理 | crm_db |
| project-service | PS (项目管理) | 项目结构、WBS、预算控制 | project_db |
| scm-service | SCM (供应链) | 需求计划、高级计划、供应商协同 | scm_db |
| treasury-service | TR (财务管理) | 现金管理、资金预测、风险管理 | treasury_db |
| warehouse-service | WM/EWM (仓储) | 库位管理、入出库、移库、盘点 | warehouse_db |
| transport-service | TM (运输管理) | 运输计划、承运商管理、运费计算 | transport_db |
| analytics-service | BW/BI (商业智能) | 数据仓库、报表、分析、Dashboard | analytics_db |

---

## 3. DDD 分层架构设计

### 3.1 四层架构说明

每个微服务严格遵循 DDD 四层架构，从外到内依次为：

```
┌──────────────────────────────────────────────────────────┐
│                     API 层 (API Layer)                    │
│  职责：HTTP/gRPC 接口暴露、请求验证、响应序列化           │
│  依赖：Application 层                                     │
│  技术：Axum Router、Tonic gRPC、Validator                │
└──────────────────────────────────────────────────────────┘
                          ↓ 调用
┌──────────────────────────────────────────────────────────┐
│                 应用层 (Application Layer)                │
│  职责：用例编排、CQRS 命令/查询处理、事务管理             │
│  依赖：Domain 层                                          │
│  技术：Command/Query Handler、DTO、应用服务               │
└──────────────────────────────────────────────────────────┘
                          ↓ 调用
┌──────────────────────────────────────────────────────────┐
│                  领域层 (Domain Layer)                    │
│  职责：业务逻辑、聚合根、实体、值对象、领域事件            │
│  依赖：无（纯业务逻辑）                                   │
│  技术：Aggregate、Entity、ValueObject、DomainEvent        │
└──────────────────────────────────────────────────────────┘
                          ↑ 依赖倒置
┌──────────────────────────────────────────────────────────┐
│              基础设施层 (Infrastructure Layer)             │
│  职责：数据持久化、外部服务集成、事件发布                 │
│  依赖：Domain 层接口                                      │
│  技术：PostgreSQL、Redis、Kafka、gRPC Client              │
└──────────────────────────────────────────────────────────┘
```

### 3.2 各层详细设计

#### 3.2.1 API 层 (api/)

```rust
// 结构说明
api/
├── http/              // HTTP REST API 端点
│   ├── routes.rs      // 路由定义和分组
│   ├── handlers/      // HTTP 请求处理器
│   │   ├── account.rs       // 会计科目相关接口
│   │   ├── transaction.rs   // 交易相关接口
│   │   └── report.rs        // 报表相关接口
│   ├── middleware/    // 中间件
│   │   ├── auth.rs          // JWT 认证中间件
│   │   ├── logging.rs       // 请求日志中间件
│   │   └── cors.rs          // CORS 跨域处理
│   └── validators/    // 请求参数验证器
│       └── account_validator.rs
├── grpc/              // gRPC 服务端点
│   ├── proto/         // Protobuf 定义文件
│   │   └── financial.proto
│   ├── services/      // gRPC 服务实现
│   │   └── financial_service.rs
│   └── interceptors/ // gRPC 拦截器
│       └── auth.rs
└── dto/              // 数据传输对象
    ├── requests/     // 请求 DTO
    │   ├── create_account_request.rs
    │   └── post_transaction_request.rs
    └── responses/    // 响应 DTO
        ├── account_response.rs
        └── transaction_response.rs
```

**关键职责**：
- 接收外部请求（HTTP/gRPC）
- 参数验证（格式、业务规则前置检查）
- 调用 Application 层处理业务逻辑
- 序列化响应数据返回给客户端
- 不包含业务逻辑，仅做数据转换和路由

#### 3.2.2 应用层 (application/)

```rust
// 结构说明
application/
├── commands/          // 写操作命令（CQRS-C）
│   ├── create_account.rs      // 创建科目命令及处理器
│   ├── post_transaction.rs    // 过账交易命令及处理器
│   └── close_period.rs        // 结账命令及处理器
├── queries/           // 读操作查询（CQRS-Q）
│   ├── get_account.rs         // 查询科目详情
│   ├── list_transactions.rs   // 查询交易列表
│   └── generate_report.rs     // 生成财务报表
├── services/          // 应用服务（用例编排）
│   ├── account_service.rs     // 科目管理服务
│   ├── transaction_service.rs // 交易处理服务
│   └── reporting_service.rs   // 报表服务
└── dto/              // 应用层数据传输对象
    ├── account_dto.rs
    └── transaction_dto.rs
```

**关键职责**：
- 实现具体业务用例（Use Case）
- CQRS 模式：分离命令（Command）和查询（Query）
- 调用 Domain 层的聚合根执行业务逻辑
- 事务管理和异常处理
- 发布领域事件到消息队列

**CQRS 模式说明**：
- **Command（命令）**：修改数据的操作，返回成功/失败，触发领域事件
- **Query（查询）**：只读操作，可以直接查询数据库视图，不经过领域模型
- **优势**：读写分离、性能优化、独立扩展

#### 3.2.3 领域层 (domain/)

```rust
// 结构说明
domain/
├── aggregates/        // 聚合根（Aggregate Root）
│   ├── account/       // 会计科目聚合
│   │   ├── account.rs         // 科目聚合根
│   │   ├── account_type.rs    // 科目类型实体
│   │   └── balance.rs         // 余额值对象
│   └── transaction/   // 交易聚合
│       ├── transaction.rs     // 交易聚合根
│       ├── journal_entry.rs   // 分录实体
│       └── posting.rs         // 过账记录实体
├── entities/          // 实体（Entity）
│   ├── cost_center.rs         // 成本中心实体
│   └── profit_center.rs       // 利润中心实体
├── value_objects/     // 值对象（Value Object）
│   ├── amount.rs              // 金额值对象（带币种）
│   ├── account_number.rs      // 科目编号值对象
│   └── fiscal_period.rs       // 会计期间值对象
├── events/            // 领域事件（Domain Event）
│   ├── account_created.rs     // 科目创建事件
│   ├── transaction_posted.rs  // 交易过账事件
│   └── period_closed.rs       // 期间关闭事件
├── services/          // 领域服务（Domain Service）
│   ├── balance_calculator.rs  // 余额计算服务
│   └── exchange_rate.rs       // 汇率转换服务
└── repositories/      // 仓储接口（trait）
    ├── account_repository.rs      // 科目仓储接口
    └── transaction_repository.rs  // 交易仓储接口
```

**关键职责**：
- **聚合根（Aggregate Root）**：
  - 业务逻辑的核心，保证数据一致性边界
  - 对外提供业务方法（如 `post_transaction()`）
  - 产生领域事件（如 `TransactionPosted`）
  - 示例：`Account`、`Transaction`

- **实体（Entity）**：
  - 有唯一标识的领域对象
  - 生命周期内状态可变
  - 示例：`JournalEntry`（分录）

- **值对象（Value Object）**：
  - 无唯一标识，由属性值定义
  - 不可变（immutable）
  - 示例：`Amount`（金额+币种）、`AccountNumber`

- **领域事件（Domain Event）**：
  - 业务操作产生的事实记录
  - 不可变，带时间戳
  - 用于事件溯源和跨服务通信
  - 示例：`AccountCreated`、`TransactionPosted`

- **领域服务（Domain Service）**：
  - 不属于单个实体的业务逻辑
  - 示例：复杂的余额计算、汇率转换

- **仓储接口（Repository Trait）**：
  - 定义数据持久化抽象接口
  - 实现在 Infrastructure 层（依赖倒置原则）

#### 3.2.4 基础设施层 (infrastructure/)

```rust
// 结构说明
infrastructure/
├── persistence/       // 数据持久化
│   ├── postgres/      // PostgreSQL 实现
│   │   ├── account_repo_impl.rs   // 科目仓储实现
│   │   ├── transaction_repo_impl.rs
│   │   ├── models.rs              // 数据库模型（ORM）
│   │   └── migrations/            // SQL 迁移脚本
│   │       └── 001_init.sql
│   └── redis/         // Redis 缓存实现
│       └── cache.rs
├── messaging/         // 消息中间件
│   ├── kafka/         // Kafka 实现
│   │   ├── producer.rs            // 事件发布
│   │   └── consumer.rs            // 事件订阅
│   └── event_store.rs             // 事件存储实现
├── external/          // 外部服务集成
│   ├── sales_client.rs            // 销售服务 gRPC 客户端
│   ├── materials_client.rs        // 物料服务 gRPC 客户端
│   └── auth_client.rs             // 认证服务客户端
└── config/            // 配置管理
    ├── database.rs                // 数据库配置
    └── kafka.rs                   // Kafka 配置
```

**关键职责**：
- 实现 Domain 层定义的仓储接口（Repository Trait）
- 数据库访问（PostgreSQL/Redis）
- 消息队列集成（Kafka 生产者/消费者）
- 外部服务调用（gRPC Client）
- 配置管理和环境变量加载

---

## 4. CQRS 与事件溯源架构

### 4.1 CQRS 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端请求                            │
└─────────────────────────────────────────────────────────────┘
                    ↓                    ↓
        ┌───────────────────┐   ┌──────────────────┐
        │   命令端 (Write)   │   │  查询端 (Read)    │
        │  Command Side     │   │  Query Side      │
        └───────────────────┘   └──────────────────┘
                    ↓                    ↓
        ┌───────────────────┐   ┌──────────────────┐
        │  Command Handler  │   │  Query Handler   │
        │  调用聚合根        │   │  直接查询视图     │
        └───────────────────┘   └──────────────────┘
                    ↓                    ↓
        ┌───────────────────┐   ┌──────────────────┐
        │  领域模型 (DDD)    │   │  读模型 (DTO)     │
        │  Aggregate Root   │   │  Materialized    │
        └───────────────────┘   │  View / Cache    │
                    ↓            └──────────────────┘
        ┌───────────────────┐            ↑
        │  事件存储 (Kafka)  │────────────┘
        │  Event Store      │   事件投影 (Projection)
        └───────────────────┘
                    ↓
        ┌───────────────────┐
        │  写数据库 (PG)     │
        │  Write DB         │
        └───────────────────┘
```

### 4.2 事件溯源流程

```rust
// 事件溯源示例流程

// 1. 客户端发起命令
POST /api/accounts/{id}/post-transaction
{
  "debit_account": "1000",
  "credit_account": "2000",
  "amount": 10000,
  "currency": "CNY"
}

// 2. Command Handler 处理
let command = PostTransactionCommand { ... };
let aggregate = transaction_repo.get(id).await?;  // 加载聚合根
aggregate.post(command)?;                         // 执行业务逻辑
transaction_repo.save(aggregate).await?;          // 保存

// 3. 聚合根产生领域事件
TransactionPosted {
  transaction_id: "TX-001",
  debit_account: "1000",
  credit_account: "2000",
  amount: 10000,
  currency: "CNY",
  posted_at: "2025-12-21T10:00:00Z"
}

// 4. 事件持久化到 Kafka
kafka_producer.send("financial.transaction.posted", event).await?;

// 5. 事件存储到数据库
INSERT INTO events (aggregate_id, event_type, payload, version)
VALUES ('TX-001', 'TransactionPosted', '{"amount":10000,...}', 1);

// 6. 投影到读模型（异步）
// Kafka Consumer 监听事件，更新 Redis 缓存和查询表
ZADD account:1000:transactions TX-001  // Redis 有序集合
INSERT INTO transaction_view ...       // PostgreSQL 查询视图

// 7. 查询端直接读取视图
GET /api/accounts/1000/transactions
→ 从 Redis 或 transaction_view 表读取，无需重建聚合
```

### 4.3 事件版本控制

```rust
// 事件版本化示例
#[derive(Serialize, Deserialize)]
#[serde(tag = "version")]
pub enum TransactionPostedEvent {
    #[serde(rename = "v1")]
    V1(TransactionPostedV1),

    #[serde(rename = "v2")]
    V2(TransactionPostedV2),  // 新增字段：cost_center
}

// 事件升级器（Upcaster）
impl From<TransactionPostedV1> for TransactionPostedV2 {
    fn from(v1: TransactionPostedV1) -> Self {
        TransactionPostedV2 {
            cost_center: None,  // 兼容旧版本
            ..v1
        }
    }
}
```

---

## 5. 服务间通信设计

### 5.1 同步通信：gRPC

```protobuf
// financial.proto
syntax = "proto3";

service FinancialService {
  // 查询账户余额（同步调用）
  rpc GetAccountBalance(GetAccountBalanceRequest)
      returns (GetAccountBalanceResponse);

  // 验证交易合法性（同步调用）
  rpc ValidateTransaction(ValidateTransactionRequest)
      returns (ValidateTransactionResponse);
}

message GetAccountBalanceRequest {
  string account_number = 1;
  string currency = 2;
  string as_of_date = 3;  // 可选，查询历史余额
}

message GetAccountBalanceResponse {
  string account_number = 1;
  double balance = 2;
  string currency = 3;
  int64 timestamp = 4;
}
```

**使用场景**：
- 需要即时响应的操作（如验证库存是否充足）
- 跨服务查询（如销售服务查询财务科目余额）
- 服务健康检查

### 5.2 异步通信：Kafka 事件

```rust
// Kafka 主题命名规范：<domain>.<aggregate>.<event>
// 示例主题：
- financial.account.created
- financial.transaction.posted
- sales.order.created
- materials.goods_received.completed

// 事件消息格式（CloudEvents 规范）
{
  "specversion": "1.0",
  "type": "com.erp.financial.transaction.posted",
  "source": "/financial-service",
  "id": "TX-001-20250621",
  "time": "2025-12-21T10:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "transaction_id": "TX-001",
    "amount": 10000,
    "currency": "CNY",
    ...
  }
}
```

**使用场景**：
- 领域事件发布/订阅（如交易过账后通知成本中心）
- 跨服务数据同步（如客户主数据变更同步到销售/财务）
- 审计日志和事件溯源

### 5.3 服务依赖图

```
财务服务 (Financial)
  ↓ gRPC 调用（查询科目）
销售服务 (Sales) ──→ 发布事件：OrderCreated
  ↓ 订阅
财务服务 (Financial) ──→ 自动创建应收账款凭证

物料服务 (Materials) ──→ 发布事件：GoodsReceivedCompleted
  ↓ 订阅
财务服务 (Financial) ──→ 自动创建库存凭证
```

---

## 6. 数据库设计原则

### 6.1 每服务独立数据库

```
financial-service    → financial_db (PostgreSQL)
sales-service        → sales_db (PostgreSQL)
materials-service    → materials_db (PostgreSQL)
...

原则：
- 每个微服务拥有独立的数据库实例或 Schema
- 禁止跨服务直接访问数据库
- 数据共享通过 API 或事件实现
```

### 6.2 事件存储表设计

```sql
-- 事件存储表（每个服务都有）
CREATE TABLE events (
    event_id         UUID PRIMARY KEY,
    aggregate_type   VARCHAR(100) NOT NULL,  -- 聚合类型：Account/Transaction
    aggregate_id     VARCHAR(100) NOT NULL,  -- 聚合ID
    event_type       VARCHAR(200) NOT NULL,  -- 事件类型
    event_version    INT NOT NULL,           -- 事件版本号
    payload          JSONB NOT NULL,         -- 事件数据
    metadata         JSONB,                  -- 元数据（用户、IP等）
    created_at       TIMESTAMP NOT NULL,
    sequence_number  BIGSERIAL                -- 全局顺序号
);

CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_sequence ON events(sequence_number);
```

### 6.3 CQRS 读写分离

```sql
-- 写模型（标准化）
CREATE TABLE accounts (
    account_id       UUID PRIMARY KEY,
    account_number   VARCHAR(20) UNIQUE NOT NULL,
    account_type     VARCHAR(50) NOT NULL,
    currency         VARCHAR(3) NOT NULL,
    created_at       TIMESTAMP NOT NULL
);

CREATE TABLE transactions (
    transaction_id   UUID PRIMARY KEY,
    posting_date     DATE NOT NULL,
    document_number  VARCHAR(50),
    created_at       TIMESTAMP NOT NULL
);

CREATE TABLE journal_entries (
    entry_id         UUID PRIMARY KEY,
    transaction_id   UUID REFERENCES transactions(transaction_id),
    account_id       UUID REFERENCES accounts(account_id),
    debit_amount     DECIMAL(19,2),
    credit_amount    DECIMAL(19,2)
);

-- 读模型（反规范化，查询优化）
CREATE MATERIALIZED VIEW account_balance_view AS
SELECT
    a.account_id,
    a.account_number,
    a.account_type,
    COALESCE(SUM(je.debit_amount), 0) - COALESCE(SUM(je.credit_amount), 0) AS balance,
    MAX(t.posting_date) AS last_posting_date
FROM accounts a
LEFT JOIN journal_entries je ON a.account_id = je.account_id
LEFT JOIN transactions t ON je.transaction_id = t.transaction_id
GROUP BY a.account_id, a.account_number, a.account_type;

-- 定时刷新物化视图
CREATE INDEX idx_account_balance_account_number ON account_balance_view(account_number);
```

---

## 7. 可观测性设计

### 7.1 监控指标（Prometheus）

```rust
// Prometheus 指标定义
use prometheus::{Counter, Histogram, Gauge};

// 业务指标
- financial_transactions_total (Counter)           // 交易总数
- financial_transaction_amount_total (Counter)     // 交易总金额
- financial_account_balance (Gauge)                // 账户余额

// 技术指标
- http_requests_total (Counter)                    // HTTP 请求总数
- http_request_duration_seconds (Histogram)        // 请求延迟
- grpc_requests_total (Counter)                    // gRPC 请求总数
- db_query_duration_seconds (Histogram)            // 数据库查询延迟
- kafka_messages_published_total (Counter)         // Kafka 消息发布数
- kafka_messages_consumed_total (Counter)          // Kafka 消息消费数
```

### 7.2 日志规范（结构化日志）

```rust
// 使用 tracing 库
use tracing::{info, warn, error, debug};

// 日志字段规范
info!(
    transaction_id = %tx_id,
    account_number = %account_no,
    amount = %amount,
    user_id = %user_id,
    trace_id = %trace_id,  // 链路追踪ID
    "Transaction posted successfully"
);

// 日志级别：
// ERROR: 系统错误、业务异常
// WARN:  潜在问题、降级操作
// INFO:  关键业务操作（交易过账、订单创建）
// DEBUG: 调试信息（开发环境）
```

### 7.3 分布式追踪（Jaeger）

```rust
// OpenTelemetry 集成
use opentelemetry::trace::{Tracer, Span};

// Trace 传播：
HTTP Header: traceparent: 00-{trace-id}-{span-id}-01
gRPC Metadata: grpc-trace-bin

// Span 命名规范：
- HTTP: "POST /api/transactions"
- gRPC: "FinancialService/PostTransaction"
- DB:   "SELECT accounts WHERE account_number = ?"
- Kafka: "Publish financial.transaction.posted"
```

---

## 8. 安全设计

### 8.1 认证与授权

```
┌──────────────────────────────────────────────────────────┐
│  认证流程：JWT (JSON Web Token)                           │
└──────────────────────────────────────────────────────────┘

1. 客户端 → Auth Service: POST /auth/login (username, password)
2. Auth Service 验证 → 返回 JWT Token
3. 客户端携带 Token → API Gateway: Authorization: Bearer <JWT>
4. API Gateway 验证签名 → 转发到微服务
5. 微服务验证 Token → 提取用户信息（user_id, roles）

JWT Payload 示例：
{
  "sub": "user-123",                    // 用户ID
  "username": "john.doe",
  "roles": ["财务主管", "会计"],        // 角色
  "permissions": ["account:read", "transaction:write"],  // 权限
  "exp": 1703145600                     // 过期时间
}
```

### 8.2 权限控制（RBAC）

```rust
// 基于角色的访问控制（Role-Based Access Control）

// 角色定义
enum Role {
    FinanceManager,       // 财务主管
    Accountant,           // 会计
    SalesManager,         // 销售主管
    WarehouseKeeper,      // 仓库管理员
    SystemAdmin,          // 系统管理员
}

// 权限检查中间件
#[derive(Debug)]
struct RequirePermission(&'static str);

// 使用示例
async fn post_transaction(
    Extension(user): Extension<User>,
    _: RequirePermission("transaction:write"),  // 权限检查
    Json(payload): Json<PostTransactionRequest>
) -> Result<Json<TransactionResponse>, Error> {
    // 业务逻辑
}
```

### 8.3 数据加密

```rust
// 敏感数据加密存储
- 密码：bcrypt hash（不可逆）
- 银行账号：AES-256-GCM 加密
- 个人信息：字段级加密（column-level encryption）

// 传输加密
- HTTPS/TLS 1.3（外部通信）
- mTLS（服务间 gRPC 通信）

// 密钥管理
- 使用 Vault 或 AWS KMS 管理密钥
- 密钥轮换策略（每90天）
```

---

## 9. 部署架构

### 9.1 Kubernetes 部署拓扑

```yaml
# 命名空间划分
namespaces:
  - erp-prod           # 生产环境
  - erp-staging        # 预发布环境
  - erp-dev            # 开发环境
  - erp-infra          # 基础设施（Kafka, PostgreSQL）

# 每个微服务的 Kubernetes 资源
financial-service/
├── deployment.yaml        # Deployment（3副本）
├── service.yaml           # Service（ClusterIP）
├── ingress.yaml           # Ingress（外部访问）
├── hpa.yaml               # HorizontalPodAutoscaler（自动扩缩容）
├── configmap.yaml         # 配置（非敏感）
└── secret.yaml            # 密钥（数据库密码、JWT密钥）

# HPA 配置示例
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # CPU 70% 触发扩容
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"      # 每秒1000请求触发扩容
```

### 9.2 服务网格（Istio）

```yaml
# 使用 Istio 实现：
- 服务发现
- 负载均衡（Round Robin / Least Conn）
- 熔断器（Circuit Breaker）
- 重试和超时
- mTLS 加密
- 流量管理（金丝雀发布、蓝绿部署）

# VirtualService 示例（金丝雀发布）
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: financial-service
spec:
  hosts:
    - financial-service
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: financial-service
            subset: v2
          weight: 100
    - route:
        - destination:
            host: financial-service
            subset: v1
          weight: 90        # 90% 流量到 v1
        - destination:
            host: financial-service
            subset: v2
          weight: 10        # 10% 流量到 v2（新版本）
```

### 9.3 CI/CD 流程

```yaml
# GitHub Actions 工作流
name: Build and Deploy Financial Service

on:
  push:
    branches: [main]
    paths:
      - 'services/financial-service/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: cargo test --workspace
      - run: cargo clippy -- -D warnings
      - run: cargo fmt -- --check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v4
        with:
          context: ./services/financial-service
          push: true
          tags: |
            registry.example.com/financial-service:${{ github.sha }}
            registry.example.com/financial-service:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: kubectl set image deployment/financial-service \
              financial-service=registry.example.com/financial-service:${{ github.sha }}
      - run: kubectl rollout status deployment/financial-service
```

---

## 10. 性能优化策略

### 10.1 缓存策略

```rust
// 三级缓存架构
1. 应用内缓存（Process Cache）
   - 使用 moka 或 cached crate
   - 缓存不变数据：科目表、汇率表
   - TTL: 5-15分钟

2. 分布式缓存（Redis）
   - 缓存热数据：用户Session、常用查询结果
   - 使用 Redis Cluster（主从复制 + 哨兵）
   - TTL: 1-24小时
   - 缓存失效策略：Write-Through / Cache-Aside

3. CDN 缓存
   - 缓存静态资源（前端、文档）
   - TTL: 7-30天

// Redis 缓存示例
cache_key: "account:balance:{account_number}:{currency}:{date}"
cache_value: { "balance": 100000.00, "updated_at": "2025-12-21T10:00:00Z" }
TTL: 3600 seconds (1小时)
```

### 10.2 数据库优化

```sql
-- 索引策略
CREATE INDEX CONCURRENTLY idx_transactions_posting_date
    ON transactions(posting_date DESC);  -- 按日期查询优化

CREATE INDEX CONCURRENTLY idx_journal_entries_account_id_posting_date
    ON journal_entries(account_id, posting_date DESC);  -- 复合索引

-- 分区表（按月分区）
CREATE TABLE transactions (
    transaction_id UUID,
    posting_date DATE NOT NULL,
    ...
) PARTITION BY RANGE (posting_date);

CREATE TABLE transactions_2025_01 PARTITION OF transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE transactions_2025_02 PARTITION OF transactions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 读写分离
- 主库（Master）：处理写操作（INSERT/UPDATE/DELETE）
- 从库（Slave）：处理读操作（SELECT）
- 使用 PgBouncer 连接池
```

### 10.3 异步处理

```rust
// 使用消息队列异步处理耗时任务

// 同步流程（慢）
POST /api/reports/generate-balance-sheet
→ 计算所有科目余额（5分钟）
→ 生成 PDF（2分钟）
→ 返回下载链接

// 异步流程（快）
POST /api/reports/generate-balance-sheet
→ 创建任务记录（Task ID: RPT-001）
→ 发送 Kafka 消息到 report.generation.requested
→ 立即返回 202 Accepted { task_id: "RPT-001" }

后台 Worker 监听 Kafka：
→ 生成报表
→ 上传到 S3
→ 发送通知到用户

用户轮询或 WebSocket 接收完成通知：
GET /api/tasks/RPT-001
→ { status: "completed", download_url: "..." }
```

---

## 11. 灾难恢复与高可用

### 11.1 备份策略

```bash
# PostgreSQL 备份
- 每日全量备份（pg_dump）
- 每小时增量备份（WAL归档）
- 保留30天历史备份
- 跨区域复制（异地容灾）

# 备份脚本示例
0 2 * * * pg_dump financial_db | gzip > /backup/financial_db_$(date +\%Y\%m\%d).sql.gz
```

### 11.2 高可用架构

```
┌────────────────────────────────────────────────┐
│         负载均衡器 (Load Balancer)              │
│              Nginx / HAProxy                   │
└────────────────────────────────────────────────┘
                    ↓ 健康检查
    ┌───────────────┬───────────────┬──────────────┐
    │  Pod 1        │  Pod 2        │  Pod 3       │
    │  (Zone A)     │  (Zone B)     │  (Zone C)    │  多可用区部署
    └───────────────┴───────────────┴──────────────┘
                    ↓
    ┌───────────────────────────────────────────┐
    │  PostgreSQL 主从复制 (Patroni + etcd)      │
    │  Master (Zone A) → Slave (Zone B, C)      │
    └───────────────────────────────────────────┘

- RTO（恢复时间目标）：< 5分钟
- RPO（恢复点目标）：< 1分钟（数据丢失容忍度）
```

---

## 12. 开发规范

### 12.1 代码规范

```rust
// 1. 命名规范
- 文件名：snake_case（account_service.rs）
- 结构体/枚举：PascalCase（AccountAggregate）
- 函数/变量：snake_case（create_account）
- 常量：SCREAMING_SNAKE_CASE（MAX_RETRY_COUNT）

// 2. 错误处理
- 使用 thiserror 定义领域错误
- 使用 anyhow 处理基础设施错误
- 禁止 unwrap()/expect()（除测试代码）

#[derive(Debug, thiserror::Error)]
pub enum AccountError {
    #[error("Account {0} not found")]
    NotFound(String),

    #[error("Insufficient balance: required {required}, available {available}")]
    InsufficientBalance { required: Decimal, available: Decimal },
}

// 3. 测试覆盖率
- 单元测试：70%+（领域层必须100%）
- 集成测试：核心业务流程全覆盖
- 使用 cargo-tarpaulin 检查覆盖率

// 4. 文档注释
/// 过账交易到总账
///
/// # 参数
/// - `transaction`: 待过账的交易
///
/// # 返回
/// - `Ok(JournalEntry)`: 成功生成的分录
/// - `Err(AccountError)`: 业务校验失败
///
/// # 示例
/// ```rust
/// let entry = post_transaction(tx).await?;
/// ```
pub async fn post_transaction(transaction: Transaction) -> Result<JournalEntry, AccountError>
```

### 12.2 Git 工作流

```bash
# 分支策略（GitFlow）
main              # 生产分支（受保护）
├── develop       # 开发主分支
│   ├── feature/add-account-api      # 功能分支
│   ├── feature/impl-cqrs            # 功能分支
│   └── bugfix/fix-balance-calc      # 缺陷修复分支
└── release/v1.0.0                   # 发布分支

# Commit 规范（Conventional Commits）
feat: 添加会计科目创建API
fix: 修复余额计算精度问题
docs: 更新架构设计文档
refactor: 重构事件发布逻辑
test: 添加交易过账集成测试
chore: 升级 Axum 到 0.7.5
```

---

## 13. 附录：术语表

| 术语 | 英文 | 说明 |
|-----|------|-----|
| 聚合根 | Aggregate Root | DDD 中的核心概念，保证一致性边界 |
| 值对象 | Value Object | 无唯一标识，由属性值定义的不可变对象 |
| 领域事件 | Domain Event | 业务操作产生的事实记录 |
| 仓储 | Repository | 领域对象持久化抽象接口 |
| CQRS | Command Query Responsibility Segregation | 命令查询职责分离模式 |
| 事件溯源 | Event Sourcing | 通过事件序列重建状态的模式 |
| 幂等性 | Idempotency | 多次执行相同操作结果一致 |
| 最终一致性 | Eventual Consistency | 分布式系统中数据最终达成一致 |
| 限界上下文 | Bounded Context | DDD 中明确的模型边界 |
| 熔断器 | Circuit Breaker | 防止级联故障的保护机制 |

---


**文档版本**: v1.0
**最后更新**: 2025-12-21
**维护者**: ERP 开发团队
