# Rust DDD 微服务架构最佳实践

**文档版本**: v1.0
**创建日期**: 2025-12-21
**适用场景**: 企业级ERP系统、SaaS平台、高并发业务系统
**技术栈**: Rust + DDD + Event Sourcing + CQRS + Microservices

---

## 目录

1. [系统架构概览](#系统架构概览)
2. [DDD领域驱动设计](#ddd领域驱动设计)
3. [微服务架构设计](#微服务架构设计)
4. [Rust项目结构](#rust项目结构)
5. [核心领域实现](#核心领域实现)
6. [基础设施层](#基础设施层)
7. [API网关与服务发现](#api网关与服务发现)
8. [GitHub CI/CD配置](#github-cicd配置)
9. [容器化与Kubernetes](#容器化与kubernetes)
10. [可观测性](#可观测性)
11. [安全最佳实践](#安全最佳实践)
12. [性能优化](#性能优化)
13. [测试策略](#测试策略)

---

## 系统架构概览

### 技术栈选型

```
┌─────────────────────────────────────────────────────────┐
│                   技术栈矩阵                              │
├─────────────────────────────────────────────────────────┤
│ 编程语言        │ Rust 1.75+ (2021 Edition)            │
│ Web框架         │ Axum 0.7 + Tower                     │
│ 异步运行时      │ Tokio 1.35                           │
│ 数据库          │ PostgreSQL 16 + Redis 7              │
│ ORM/查询构建器  │ SQLx 0.7 (编译时SQL验证)             │
│ 消息队列        │ Apache Kafka 3.6                     │
│ 服务网格        │ Istio 1.20                           │
│ API网关         │ Kong / Traefik                       │
│ 服务发现        │ Consul / Kubernetes DNS              │
│ 配置中心        │ Consul KV / Kubernetes ConfigMap     │
│ 容器编排        │ Kubernetes 1.29                      │
│ 监控            │ Prometheus + Grafana                 │
│ 日志            │ Loki + Vector                        │
│ 链路追踪        │ Jaeger + OpenTelemetry               │
│ CI/CD           │ GitHub Actions                       │
│ 镜像仓库        │ GitHub Container Registry            │
└─────────────────────────────────────────────────────────┘
```

### 系统架构图

```
┌────────────────────────────────────────────────────────────────┐
│                        Client Layer                            │
│  Web App (React)  │  Mobile App  │  Third-party Integration   │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────────────────┐
│                      API Gateway (Kong)                        │
│  - Authentication (JWT)                                        │
│  - Rate Limiting                                               │
│  - Request Routing                                             │
└────────────────┬───────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬────────────┬────────────┐
    ↓            ↓            ↓            ↓            ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Order   │ │ Inventory│ │ Payment │ │ Customer│ │ Shipping│
│ Service │ │ Service  │ │ Service │ │ Service │ │ Service │
│ (Rust)  │ │ (Rust)   │ │ (Rust)  │ │ (Rust)  │ │ (Rust)  │
└────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │            │           │           │
     └───────────┴────────────┴───────────┴───────────┘
                              │
                 ┌────────────┼────────────┐
                 ↓            ↓            ↓
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ PostgreSQL│  │  Kafka   │  │  Redis   │
         │ (Primary) │  │ (Events) │  │ (Cache)  │
         └──────────┘  └──────────┘  └──────────┘
```

### 架构原则

1. **高内聚低耦合**：每个微服务独立部署、独立数据库
2. **事件驱动**：通过Kafka实现服务间异步通信
3. **CQRS模式**：读写分离，提升查询性能
4. **Event Sourcing**：记录所有状态变更事件
5. **最终一致性**：通过Saga模式处理分布式事务
6. **容错设计**：Circuit Breaker、Retry、Timeout
7. **零信任安全**：所有服务间通信mTLS加密

---

## DDD领域驱动设计

### 限界上下文划分

```
ERP系统限界上下文（Bounded Contexts）：

1. 订单上下文 (Order Context)
   - 核心实体：Order, OrderLine, OrderStatus
   - 值对象：Money, Quantity, ShippingAddress
   - 聚合根：Order
   - 领域服务：OrderPriceCalculator, OrderValidator
   - 领域事件：OrderCreated, OrderConfirmed, OrderCancelled

2. 库存上下文 (Inventory Context)
   - 核心实体：Product, StockLevel, Warehouse
   - 值对象：SKU, Location
   - 聚合根：Product
   - 领域服务：StockAllocator, ReorderService
   - 领域事件：StockReserved, StockReleased, LowStockWarning

3. 支付上下文 (Payment Context)
   - 核心实体：Payment, Transaction, Refund
   - 值对象：PaymentMethod, Amount
   - 聚合根：Payment
   - 领域服务：PaymentProcessor, FraudDetection
   - 领域事件：PaymentAuthorized, PaymentCaptured, PaymentFailed

4. 客户上下文 (Customer Context)
   - 核心实体：Customer, Account, ContactInfo
   - 值对象：Email, PhoneNumber, Address
   - 聚合根：Customer
   - 领域服务：CustomerScoring, LoyaltyCalculator
   - 领域事件：CustomerRegistered, CustomerUpdated

5. 物流上下文 (Shipping Context)
   - 核心实体：Shipment, Carrier, TrackingInfo
   - 值对象：ShippingMethod, DeliveryWindow
   - 聚合根：Shipment
   - 领域服务：RouteOptimizer, ShippingCostCalculator
   - 领域事件：ShipmentCreated, ShipmentDispatched, ShipmentDelivered
```

### DDD分层架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户接口层 (Presentation)              │
│  - REST API Controllers (Axum Handlers)                 │
│  - GraphQL Resolvers                                    │
│  - gRPC Service Implementations                         │
│  - DTO (Data Transfer Objects)                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                   应用层 (Application)                   │
│  - Use Cases / Application Services                     │
│  - Command Handlers                                     │
│  - Query Handlers (CQRS)                                │
│  - Event Handlers                                       │
│  - Application DTOs                                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                   领域层 (Domain)                        │
│  - Entities (聚合根、实体)                               │
│  - Value Objects (值对象)                                │
│  - Domain Services                                      │
│  - Domain Events                                        │
│  - Repositories (接口定义)                               │
│  - Specifications (规约模式)                             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│                   基础设施层 (Infrastructure)             │
│  - Repository Implementations (PostgreSQL)              │
│  - Event Store (Kafka Producer)                         │
│  - Cache (Redis)                                        │
│  - External Service Clients                             │
│  - Persistence Models                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 微服务架构设计

### 服务拆分策略

#### 订单服务 (Order Service)

**职责**：
- 订单创建、修改、取消
- 订单状态流转
- 订单查询（支持复杂过滤）

**技术细节**：
- 端口：8001
- 数据库：order_service_db (PostgreSQL)
- 事件发布：order-events topic (Kafka)
- 事件订阅：payment-events, inventory-events

**API端点**：
```
POST   /api/v1/orders              - 创建订单
GET    /api/v1/orders/{id}         - 获取订单详情
PUT    /api/v1/orders/{id}         - 更新订单
DELETE /api/v1/orders/{id}         - 取消订单
GET    /api/v1/orders              - 查询订单列表
POST   /api/v1/orders/{id}/confirm - 确认订单
```

#### 库存服务 (Inventory Service)

**职责**：
- 库存查询和预留
- 库存扣减和释放
- 安全库存告警
- 库存盘点

**技术细节**：
- 端口：8002
- 数据库：inventory_service_db (PostgreSQL)
- 缓存：Redis (库存快照)
- 事件发布：inventory-events topic

**核心领域逻辑**：
```rust
// 库存预留逻辑（乐观锁）
pub async fn reserve_stock(
    &self,
    sku: &SKU,
    quantity: Quantity,
    order_id: &OrderId,
) -> Result<StockReservation, InventoryError> {
    // 1. 检查可用库存
    let available = self.get_available_stock(sku).await?;

    if available < quantity {
        return Err(InventoryError::InsufficientStock {
            requested: quantity,
            available,
        });
    }

    // 2. 预留库存（使用数据库版本号实现乐观锁）
    let reservation = self.repository
        .reserve_with_version_check(sku, quantity, order_id)
        .await?;

    // 3. 发布库存预留事件
    self.event_bus
        .publish(InventoryEvent::StockReserved {
            sku: sku.clone(),
            quantity,
            order_id: order_id.clone(),
            reservation_id: reservation.id(),
        })
        .await?;

    Ok(reservation)
}
```

#### 支付服务 (Payment Service)

**职责**：
- 支付授权和捕获
- 退款处理
- 支付方式管理
- 对账

**技术细节**：
- 端口：8003
- 数据库：payment_service_db (PostgreSQL)
- 外部集成：Stripe API, PayPal API
- 幂等性：通过幂等性键保证

**支付流程（Saga模式）**：
```
订单创建 → 库存预留 → 支付授权 → 支付捕获 → 发货
    ↓           ↓           ↓           ↓
  失败      释放库存    取消授权    退款处理
```

### 服务间通信

#### 同步通信 (gRPC)

适用场景：实时性要求高、需要立即响应

```protobuf
// inventory_service.proto
syntax = "proto3";

package inventory.v1;

service InventoryService {
  rpc CheckStock(CheckStockRequest) returns (CheckStockResponse);
  rpc ReserveStock(ReserveStockRequest) returns (ReserveStockResponse);
  rpc ReleaseStock(ReleaseStockRequest) returns (ReleaseStockResponse);
}

message CheckStockRequest {
  string sku = 1;
  int32 quantity = 2;
}

message CheckStockResponse {
  bool available = 1;
  int32 current_stock = 2;
  int32 reserved_stock = 3;
}

message ReserveStockRequest {
  string sku = 1;
  int32 quantity = 2;
  string order_id = 3;
  string idempotency_key = 4;
}

message ReserveStockResponse {
  string reservation_id = 1;
  google.protobuf.Timestamp expires_at = 2;
}
```

#### 异步通信 (Kafka Events)

适用场景：解耦服务、最终一致性

```rust
// 领域事件定义
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OrderEvent {
    OrderCreated {
        event_id: Uuid,
        timestamp: DateTime<Utc>,
        order_id: Uuid,
        customer_id: Uuid,
        items: Vec<OrderItem>,
        total_amount: Decimal,
    },
    OrderConfirmed {
        event_id: Uuid,
        timestamp: DateTime<Utc>,
        order_id: Uuid,
    },
    OrderCancelled {
        event_id: Uuid,
        timestamp: DateTime<Utc>,
        order_id: Uuid,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub sku: String,
    pub quantity: i32,
    pub unit_price: Decimal,
}

// Kafka Producer实现
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::ClientConfig;

pub struct EventPublisher {
    producer: FutureProducer,
    topic: String,
}

impl EventPublisher {
    pub fn new(brokers: &str, topic: String) -> Result<Self, KafkaError> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .set("compression.type", "snappy")
            .set("acks", "all")  // 确保消息持久化
            .set("enable.idempotence", "true")  // 幂等生产者
            .create()?;

        Ok(Self { producer, topic })
    }

    pub async fn publish(&self, event: &OrderEvent) -> Result<(), PublishError> {
        let event_id = event.event_id().to_string();
        let payload = serde_json::to_string(event)?;

        let record = FutureRecord::to(&self.topic)
            .key(&event_id)  // 使用event_id作为key保证顺序
            .payload(&payload);

        self.producer
            .send(record, Duration::from_secs(5))
            .await
            .map_err(|(err, _)| PublishError::Kafka(err))?;

        tracing::info!(
            event_id = %event_id,
            event_type = event.event_type(),
            "Event published successfully"
        );

        Ok(())
    }
}
```

### 分布式事务处理 (Saga Pattern)

使用Choreography-based Saga（编排式Saga）：

```rust
// Saga协调器
pub struct OrderSaga {
    order_service: Arc<OrderService>,
    inventory_service: Arc<InventoryServiceClient>,
    payment_service: Arc<PaymentServiceClient>,
    event_bus: Arc<EventBus>,
}

impl OrderSaga {
    pub async fn create_order(
        &self,
        command: CreateOrderCommand,
    ) -> Result<OrderId, SagaError> {
        let saga_id = Uuid::new_v4();

        // Step 1: 创建订单（状态：Pending）
        let order_id = self.order_service
            .create_order(command.clone())
            .await?;

        // Step 2: 预留库存
        let reservation_result = self.inventory_service
            .reserve_stock(ReserveStockRequest {
                order_id: order_id.clone(),
                items: command.items.clone(),
            })
            .await;

        match reservation_result {
            Ok(reservation) => {
                // Step 3: 授权支付
                let payment_result = self.payment_service
                    .authorize_payment(AuthorizePaymentRequest {
                        order_id: order_id.clone(),
                        amount: command.total_amount,
                        payment_method: command.payment_method,
                    })
                    .await;

                match payment_result {
                    Ok(authorization) => {
                        // 成功：确认订单
                        self.order_service
                            .confirm_order(&order_id)
                            .await?;

                        Ok(order_id)
                    }
                    Err(payment_error) => {
                        // 补偿：释放库存
                        self.inventory_service
                            .release_stock(ReleaseStockRequest {
                                reservation_id: reservation.id,
                            })
                            .await?;

                        // 取消订单
                        self.order_service
                            .cancel_order(&order_id, "Payment failed")
                            .await?;

                        Err(SagaError::PaymentFailed(payment_error))
                    }
                }
            }
            Err(inventory_error) => {
                // 取消订单
                self.order_service
                    .cancel_order(&order_id, "Insufficient stock")
                    .await?;

                Err(SagaError::InventoryUnavailable(inventory_error))
            }
        }
    }
}
```

---

## Rust项目结构

### Monorepo结构（使用Cargo Workspace）

```
erp-system/
├── Cargo.toml                    # Workspace配置
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI/CD工作流
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── docker/
│   ├── Dockerfile.service        # 微服务通用Dockerfile
│   └── docker-compose.yml        # 本地开发环境
├── k8s/
│   ├── base/                     # Kustomize基础配置
│   ├── overlays/
│   │   ├── staging/
│   │   └── production/
│   └── helm/                     # Helm Charts
├── proto/                        # gRPC Proto定义
│   ├── order/
│   │   └── v1/
│   │       └── order_service.proto
│   ├── inventory/
│   └── payment/
├── shared/                       # 共享库
│   ├── domain-primitives/        # 领域原语
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── money.rs
│   │       ├── email.rs
│   │       └── uuid_wrapper.rs
│   ├── event-sourcing/           # Event Sourcing框架
│   ├── cqrs/                     # CQRS框架
│   └── observability/            # 可观测性工具
├── services/
│   ├── order-service/
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── api/              # API层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── rest/         # REST API
│   │   │   │   │   ├── handlers.rs
│   │   │   │   │   ├── routes.rs
│   │   │   │   │   └── dto.rs
│   │   │   │   └── grpc/         # gRPC
│   │   │   │       └── service.rs
│   │   │   ├── application/      # 应用层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── commands/
│   │   │   │   │   ├── create_order.rs
│   │   │   │   │   └── cancel_order.rs
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get_order.rs
│   │   │   │   │   └── list_orders.rs
│   │   │   │   └── services/
│   │   │   │       └── order_application_service.rs
│   │   │   ├── domain/           # 领域层
│   │   │   │   ├── mod.rs
│   │   │   │   ├── aggregates/
│   │   │   │   │   ├── order.rs
│   │   │   │   │   └── order_line.rs
│   │   │   │   ├── value_objects/
│   │   │   │   │   ├── money.rs
│   │   │   │   │   ├── quantity.rs
│   │   │   │   │   └── shipping_address.rs
│   │   │   │   ├── events/
│   │   │   │   │   └── order_events.rs
│   │   │   │   ├── services/
│   │   │   │   │   ├── order_price_calculator.rs
│   │   │   │   │   └── order_validator.rs
│   │   │   │   └── repositories/
│   │   │   │       └── order_repository.rs
│   │   │   └── infrastructure/   # 基础设施层
│   │   │       ├── mod.rs
│   │   │       ├── persistence/
│   │   │       │   ├── postgres/
│   │   │       │   │   ├── order_repository_impl.rs
│   │   │       │   │   └── models.rs
│   │   │       │   └── redis/
│   │   │       │       └── order_cache.rs
│   │   │       ├── messaging/
│   │   │       │   ├── kafka_producer.rs
│   │   │       │   └── kafka_consumer.rs
│   │   │       └── config.rs
│   │   ├── migrations/           # SQL迁移脚本
│   │   │   ├── 20250101000000_create_orders_table.sql
│   │   │   └── 20250102000000_add_order_status_index.sql
│   │   └── tests/
│   │       ├── integration/
│   │       └── unit/
│   ├── inventory-service/
│   │   └── ...（类似结构）
│   ├── payment-service/
│   ├── customer-service/
│   └── shipping-service/
└── tools/
    ├── migration-tool/
    └── load-testing/
```

### Cargo.toml (Workspace配置)

```toml
[workspace]
members = [
    "shared/domain-primitives",
    "shared/event-sourcing",
    "shared/cqrs",
    "shared/observability",
    "services/order-service",
    "services/inventory-service",
    "services/payment-service",
    "services/customer-service",
    "services/shipping-service",
]

resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["Your Team <team@example.com>"]
license = "MIT"

[workspace.dependencies]
# Async Runtime
tokio = { version = "1.35", features = ["full"] }
tokio-util = "0.7"

# Web Framework
axum = { version = "0.7", features = ["macros"] }
tower = { version = "0.4", features = ["full"] }
tower-http = { version = "0.5", features = ["full"] }

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json"] }
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# UUID
uuid = { version = "1.6", features = ["v4", "serde"] }

# Date/Time
chrono = { version = "0.4", features = ["serde"] }

# Error Handling
anyhow = "1.0"
thiserror = "1.0"

# Logging & Tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-opentelemetry = "0.22"

# OpenTelemetry
opentelemetry = "0.21"
opentelemetry-jaeger = "0.20"

# Kafka
rdkafka = { version = "0.35", features = ["cmake-build"] }

# gRPC
tonic = "0.10"
prost = "0.12"

# Config
config = "0.13"

# Validation
validator = { version = "0.16", features = ["derive"] }

# Decimal
rust_decimal = { version = "1.33", features = ["serde-float"] }

# Testing
mockall = "0.12"
```

---

## 核心领域实现

### 订单聚合根 (Order Aggregate)

```rust
// services/order-service/src/domain/aggregates/order.rs

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::domain::events::OrderEvent;
use crate::domain::value_objects::{Money, OrderStatus, ShippingAddress};
use shared::domain_primitives::{AggregateRoot, DomainError};

/// 订单聚合根
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    // 标识
    id: OrderId,
    customer_id: CustomerId,

    // 订单信息
    order_number: String,
    status: OrderStatus,
    items: Vec<OrderLine>,

    // 金额
    subtotal: Money,
    tax: Money,
    shipping_cost: Money,
    total: Money,

    // 地址
    shipping_address: ShippingAddress,
    billing_address: ShippingAddress,

    // 审计字段
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    version: i64,  // 用于乐观锁

    // 未提交的领域事件
    #[serde(skip)]
    uncommitted_events: Vec<OrderEvent>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OrderId(Uuid);

impl OrderId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn value(&self) -> Uuid {
        self.0
    }
}

impl Order {
    /// 创建新订单（工厂方法）
    pub fn create(
        customer_id: CustomerId,
        items: Vec<OrderLine>,
        shipping_address: ShippingAddress,
        billing_address: ShippingAddress,
    ) -> Result<Self, DomainError> {
        // 验证订单行至少有一项
        if items.is_empty() {
            return Err(DomainError::ValidationError(
                "Order must have at least one item".to_string()
            ));
        }

        // 计算金额
        let subtotal = items.iter()
            .map(|line| line.total())
            .sum::<Money>();

        let tax = subtotal * Decimal::from_str("0.1")?;  // 10% 税率
        let shipping_cost = Money::from_usd(Decimal::from(10));  // 固定运费
        let total = subtotal + tax + shipping_cost;

        let now = Utc::now();
        let order_id = OrderId::new();

        let mut order = Self {
            id: order_id,
            customer_id,
            order_number: Self::generate_order_number(),
            status: OrderStatus::Pending,
            items,
            subtotal,
            tax,
            shipping_cost,
            total,
            shipping_address,
            billing_address,
            created_at: now,
            updated_at: now,
            version: 1,
            uncommitted_events: Vec::new(),
        };

        // 添加领域事件
        order.add_event(OrderEvent::OrderCreated {
            event_id: Uuid::new_v4(),
            timestamp: now,
            order_id: order_id.value(),
            customer_id: customer_id.value(),
            total_amount: total.amount(),
            items: order.items.iter().map(|line| line.to_event_dto()).collect(),
        });

        Ok(order)
    }

    /// 确认订单
    pub fn confirm(&mut self) -> Result<(), DomainError> {
        // 业务规则：只有Pending状态的订单可以确认
        if self.status != OrderStatus::Pending {
            return Err(DomainError::InvalidStateTransition {
                from: self.status,
                to: OrderStatus::Confirmed,
            });
        }

        self.status = OrderStatus::Confirmed;
        self.updated_at = Utc::now();

        self.add_event(OrderEvent::OrderConfirmed {
            event_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            order_id: self.id.value(),
        });

        Ok(())
    }

    /// 取消订单
    pub fn cancel(&mut self, reason: String) -> Result<(), DomainError> {
        // 业务规则：已完成或已取消的订单不能再取消
        match self.status {
            OrderStatus::Completed | OrderStatus::Cancelled => {
                return Err(DomainError::InvalidStateTransition {
                    from: self.status,
                    to: OrderStatus::Cancelled,
                });
            }
            _ => {}
        }

        self.status = OrderStatus::Cancelled;
        self.updated_at = Utc::now();

        self.add_event(OrderEvent::OrderCancelled {
            event_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            order_id: self.id.value(),
            reason,
        });

        Ok(())
    }

    /// 添加订单行
    pub fn add_item(&mut self, item: OrderLine) -> Result<(), DomainError> {
        // 业务规则：只有Pending状态可以修改
        if self.status != OrderStatus::Pending {
            return Err(DomainError::InvalidOperation(
                "Cannot modify confirmed order".to_string()
            ));
        }

        self.items.push(item);
        self.recalculate_totals();
        self.updated_at = Utc::now();

        Ok(())
    }

    /// 移除订单行
    pub fn remove_item(&mut self, sku: &str) -> Result<(), DomainError> {
        if self.status != OrderStatus::Pending {
            return Err(DomainError::InvalidOperation(
                "Cannot modify confirmed order".to_string()
            ));
        }

        self.items.retain(|item| item.sku() != sku);

        if self.items.is_empty() {
            return Err(DomainError::ValidationError(
                "Cannot remove last item from order".to_string()
            ));
        }

        self.recalculate_totals();
        self.updated_at = Utc::now();

        Ok(())
    }

    // 私有辅助方法
    fn recalculate_totals(&mut self) {
        self.subtotal = self.items.iter()
            .map(|line| line.total())
            .sum();
        self.tax = self.subtotal * Decimal::from_str("0.1").unwrap();
        self.total = self.subtotal + self.tax + self.shipping_cost;
    }

    fn generate_order_number() -> String {
        format!("ORD-{}", Utc::now().format("%Y%m%d-%H%M%S"))
    }

    fn add_event(&mut self, event: OrderEvent) {
        self.uncommitted_events.push(event);
    }

    // Getters
    pub fn id(&self) -> &OrderId { &self.id }
    pub fn status(&self) -> &OrderStatus { &self.status }
    pub fn total(&self) -> &Money { &self.total }
    pub fn version(&self) -> i64 { self.version }
    pub fn uncommitted_events(&self) -> &[OrderEvent] { &self.uncommitted_events }

    pub fn clear_events(&mut self) {
        self.uncommitted_events.clear();
    }
}

/// 订单行实体
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct OrderLine {
    id: Uuid,
    sku: String,
    product_name: String,
    #[validate(range(min = 1))]
    quantity: i32,
    unit_price: Money,
}

impl OrderLine {
    pub fn new(
        sku: String,
        product_name: String,
        quantity: i32,
        unit_price: Money,
    ) -> Result<Self, DomainError> {
        let line = Self {
            id: Uuid::new_v4(),
            sku,
            product_name,
            quantity,
            unit_price,
        };

        line.validate()
            .map_err(|e| DomainError::ValidationError(e.to_string()))?;

        Ok(line)
    }

    pub fn total(&self) -> Money {
        self.unit_price * Decimal::from(self.quantity)
    }

    pub fn sku(&self) -> &str {
        &self.sku
    }

    pub fn to_event_dto(&self) -> OrderItemDto {
        OrderItemDto {
            sku: self.sku.clone(),
            quantity: self.quantity,
            unit_price: self.unit_price.amount(),
        }
    }
}
```

### 值对象 (Value Objects)

```rust
// services/order-service/src/domain/value_objects/money.rs

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::ops::{Add, Mul};
use thiserror::Error;

/// 货币值对象
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    amount: Decimal,
    currency: Currency,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Currency {
    USD,
    EUR,
    CNY,
}

#[derive(Debug, Error)]
pub enum MoneyError {
    #[error("Cannot perform operation on different currencies")]
    CurrencyMismatch,

    #[error("Negative amount not allowed")]
    NegativeAmount,
}

impl Money {
    pub fn new(amount: Decimal, currency: Currency) -> Result<Self, MoneyError> {
        if amount < Decimal::ZERO {
            return Err(MoneyError::NegativeAmount);
        }

        Ok(Self { amount, currency })
    }

    pub fn from_usd(amount: Decimal) -> Self {
        Self {
            amount,
            currency: Currency::USD,
        }
    }

    pub fn amount(&self) -> Decimal {
        self.amount
    }

    pub fn currency(&self) -> Currency {
        self.currency
    }

    pub fn zero(currency: Currency) -> Self {
        Self {
            amount: Decimal::ZERO,
            currency,
        }
    }
}

// 实现加法
impl Add for Money {
    type Output = Result<Money, MoneyError>;

    fn add(self, rhs: Self) -> Self::Output {
        if self.currency != rhs.currency {
            return Err(MoneyError::CurrencyMismatch);
        }

        Ok(Money {
            amount: self.amount + rhs.amount,
            currency: self.currency,
        })
    }
}

// 实现乘法
impl Mul<Decimal> for Money {
    type Output = Money;

    fn mul(self, rhs: Decimal) -> Self::Output {
        Money {
            amount: self.amount * rhs,
            currency: self.currency,
        }
    }
}

// 实现Sum trait用于迭代器求和
impl std::iter::Sum for Money {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Money::zero(Currency::USD), |acc, m| {
            acc.add(m).unwrap_or(acc)
        })
    }
}
```

### 领域服务 (Domain Service)

```rust
// services/order-service/src/domain/services/order_price_calculator.rs

use rust_decimal::Decimal;
use crate::domain::aggregates::OrderLine;
use crate::domain::value_objects::{Money, Currency};

/// 订单价格计算领域服务
pub struct OrderPriceCalculator;

impl OrderPriceCalculator {
    /// 计算折扣
    pub fn calculate_discount(
        &self,
        subtotal: &Money,
        customer_tier: CustomerTier,
    ) -> Money {
        let discount_rate = match customer_tier {
            CustomerTier::Platinum => Decimal::from_str("0.15").unwrap(),  // 15%
            CustomerTier::Gold => Decimal::from_str("0.10").unwrap(),      // 10%
            CustomerTier::Silver => Decimal::from_str("0.05").unwrap(),    // 5%
            CustomerTier::Bronze => Decimal::ZERO,
        };

        *subtotal * discount_rate
    }

    /// 计算运费（基于重量和目的地）
    pub fn calculate_shipping_cost(
        &self,
        items: &[OrderLine],
        destination: &ShippingAddress,
    ) -> Money {
        let total_weight = self.calculate_total_weight(items);
        let base_rate = Decimal::from(10);  // 基础运费$10

        let weight_surcharge = if total_weight > Decimal::from(50) {
            (total_weight - Decimal::from(50)) * Decimal::from_str("0.5").unwrap()
        } else {
            Decimal::ZERO
        };

        // 远程地区附加费
        let remote_surcharge = if self.is_remote_area(&destination.postal_code) {
            Decimal::from(15)
        } else {
            Decimal::ZERO
        };

        Money::from_usd(base_rate + weight_surcharge + remote_surcharge)
    }

    fn calculate_total_weight(&self, items: &[OrderLine]) -> Decimal {
        // 假设每个商品重量从商品服务获取
        items.iter()
            .map(|_| Decimal::from(5))  // 简化：每件5kg
            .sum()
    }

    fn is_remote_area(&self, postal_code: &str) -> bool {
        // 简化实现
        postal_code.starts_with("9")
    }
}

pub enum CustomerTier {
    Platinum,
    Gold,
    Silver,
    Bronze,
}
```

### 仓储接口 (Repository Interface)

```rust
// services/order-service/src/domain/repositories/order_repository.rs

use async_trait::async_trait;
use uuid::Uuid;
use crate::domain::aggregates::{Order, OrderId};
use shared::domain_primitives::{Page, PageRequest, RepositoryError};

/// 订单仓储接口（在领域层定义）
#[async_trait]
pub trait OrderRepository: Send + Sync {
    /// 保存订单（新增或更新）
    async fn save(&self, order: &Order) -> Result<(), RepositoryError>;

    /// 根据ID查找订单
    async fn find_by_id(&self, id: &OrderId) -> Result<Option<Order>, RepositoryError>;

    /// 根据订单号查找
    async fn find_by_order_number(&self, order_number: &str) -> Result<Option<Order>, RepositoryError>;

    /// 分页查询订单
    async fn find_all(&self, page: PageRequest) -> Result<Page<Order>, RepositoryError>;

    /// 根据客户ID查询订单
    async fn find_by_customer_id(
        &self,
        customer_id: &CustomerId,
        page: PageRequest,
    ) -> Result<Page<Order>, RepositoryError>;

    /// 删除订单（软删除）
    async fn delete(&self, id: &OrderId) -> Result<(), RepositoryError>;

    /// 检查订单号是否存在
    async fn exists_by_order_number(&self, order_number: &str) -> Result<bool, RepositoryError>;
}
```

---

## 基础设施层

### PostgreSQL仓储实现

```rust
// services/order-service/src/infrastructure/persistence/postgres/order_repository_impl.rs

use async_trait::async_trait;
use sqlx::{PgPool, Postgres, Row};
use uuid::Uuid;

use crate::domain::aggregates::{Order, OrderId};
use crate::domain::repositories::OrderRepository;
use crate::infrastructure::persistence::postgres::models::OrderModel;
use shared::domain_primitives::{Page, PageRequest, RepositoryError};

pub struct PostgresOrderRepository {
    pool: PgPool,
}

impl PostgresOrderRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OrderRepository for PostgresOrderRepository {
    async fn save(&self, order: &Order) -> Result<(), RepositoryError> {
        let model = OrderModel::from_domain(order);

        // 使用UPSERT（INSERT ... ON CONFLICT）
        sqlx::query!(
            r#"
            INSERT INTO orders (
                id, customer_id, order_number, status, subtotal, tax,
                shipping_cost, total, shipping_address, billing_address,
                created_at, updated_at, version
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                subtotal = EXCLUDED.subtotal,
                tax = EXCLUDED.tax,
                shipping_cost = EXCLUDED.shipping_cost,
                total = EXCLUDED.total,
                updated_at = EXCLUDED.updated_at,
                version = orders.version + 1
            WHERE orders.version = $14
            "#,
            model.id,
            model.customer_id,
            model.order_number,
            model.status,
            model.subtotal,
            model.tax,
            model.shipping_cost,
            model.total,
            sqlx::types::Json(&model.shipping_address) as _,
            sqlx::types::Json(&model.billing_address) as _,
            model.created_at,
            model.updated_at,
            model.version,
            order.version()  // 乐观锁版本检查
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::RowNotFound = e {
                RepositoryError::OptimisticLockError
            } else {
                RepositoryError::DatabaseError(e.to_string())
            }
        })?;

        // 保存订单行
        self.save_order_lines(order.id(), &order.items).await?;

        Ok(())
    }

    async fn find_by_id(&self, id: &OrderId) -> Result<Option<Order>, RepositoryError> {
        let row = sqlx::query!(
            r#"
            SELECT
                id, customer_id, order_number, status, subtotal, tax,
                shipping_cost, total, shipping_address, billing_address,
                created_at, updated_at, version
            FROM orders
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            id.value()
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        match row {
            Some(row) => {
                let lines = self.fetch_order_lines(id).await?;
                let model = OrderModel {
                    id: row.id,
                    customer_id: row.customer_id,
                    order_number: row.order_number,
                    status: row.status,
                    subtotal: row.subtotal,
                    tax: row.tax,
                    shipping_cost: row.shipping_cost,
                    total: row.total,
                    shipping_address: row.shipping_address.0,
                    billing_address: row.billing_address.0,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    version: row.version,
                };

                Ok(Some(model.to_domain(lines)?))
            }
            None => Ok(None),
        }
    }

    async fn find_all(&self, page: PageRequest) -> Result<Page<Order>, RepositoryError> {
        let offset = page.offset();
        let limit = page.limit();

        // 查询总数
        let total: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL"
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?
        .unwrap_or(0);

        // 查询数据
        let rows = sqlx::query!(
            r#"
            SELECT
                id, customer_id, order_number, status, subtotal, tax,
                shipping_cost, total, shipping_address, billing_address,
                created_at, updated_at, version
            FROM orders
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        let mut orders = Vec::new();
        for row in rows {
            let id = OrderId::from_uuid(row.id);
            let lines = self.fetch_order_lines(&id).await?;
            let model = OrderModel {
                id: row.id,
                customer_id: row.customer_id,
                order_number: row.order_number,
                status: row.status,
                subtotal: row.subtotal,
                tax: row.tax,
                shipping_cost: row.shipping_cost,
                total: row.total,
                shipping_address: row.shipping_address.0,
                billing_address: row.billing_address.0,
                created_at: row.created_at,
                updated_at: row.updated_at,
                version: row.version,
            };
            orders.push(model.to_domain(lines)?);
        }

        Ok(Page::new(orders, total as usize, page))
    }

    async fn delete(&self, id: &OrderId) -> Result<(), RepositoryError> {
        sqlx::query!(
            "UPDATE orders SET deleted_at = NOW() WHERE id = $1",
            id.value()
        )
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn exists_by_order_number(&self, order_number: &str) -> Result<bool, RepositoryError> {
        let exists: bool = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = $1 AND deleted_at IS NULL)",
            order_number
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?
        .unwrap_or(false);

        Ok(exists)
    }
}

// 私有辅助方法
impl PostgresOrderRepository {
    async fn save_order_lines(
        &self,
        order_id: &OrderId,
        lines: &[OrderLine],
    ) -> Result<(), RepositoryError> {
        // 先删除旧的订单行
        sqlx::query!(
            "DELETE FROM order_lines WHERE order_id = $1",
            order_id.value()
        )
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        // 批量插入新的订单行
        for line in lines {
            sqlx::query!(
                r#"
                INSERT INTO order_lines (id, order_id, sku, product_name, quantity, unit_price)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#,
                Uuid::new_v4(),
                order_id.value(),
                line.sku(),
                line.product_name(),
                line.quantity(),
                line.unit_price().amount()
            )
            .execute(&self.pool)
            .await
            .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;
        }

        Ok(())
    }

    async fn fetch_order_lines(&self, order_id: &OrderId) -> Result<Vec<OrderLineModel>, RepositoryError> {
        let lines = sqlx::query_as!(
            OrderLineModel,
            r#"
            SELECT id, order_id, sku, product_name, quantity, unit_price
            FROM order_lines
            WHERE order_id = $1
            ORDER BY id
            "#,
            order_id.value()
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepositoryError::DatabaseError(e.to_string()))?;

        Ok(lines)
    }
}
```

### SQL迁移脚本

```sql
-- services/order-service/migrations/20250101000000_create_orders_table.sql

-- 订单表
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL,

    -- 金额字段（使用NUMERIC避免浮点误差）
    subtotal NUMERIC(15, 2) NOT NULL,
    tax NUMERIC(15, 2) NOT NULL,
    shipping_cost NUMERIC(15, 2) NOT NULL,
    total NUMERIC(15, 2) NOT NULL,

    -- 地址（存储为JSONB）
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,

    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- 乐观锁版本号
    version BIGINT NOT NULL DEFAULT 1
);

-- 订单行表
CREATE TABLE order_lines (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX idx_order_lines_sku ON order_lines(sku);

-- 部分索引（只索引未删除的订单）
CREATE INDEX idx_orders_active ON orders(id) WHERE deleted_at IS NULL;

-- 更新updated_at的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 订单事件溯源表（Event Sourcing）
CREATE TABLE order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,  -- 订单ID
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB,
    version BIGINT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_version_per_aggregate UNIQUE(aggregate_id, version)
);

CREATE INDEX idx_order_events_aggregate_id ON order_events(aggregate_id, version);
CREATE INDEX idx_order_events_event_type ON order_events(event_type);
CREATE INDEX idx_order_events_occurred_at ON order_events(occurred_at DESC);
```

---

## API网关与服务发现

### Kong API Gateway配置

```yaml
# k8s/base/kong-config.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-declarative-config
  namespace: api-gateway
data:
  kong.yml: |
    _format_version: "3.0"

    # 服务定义
    services:
      - name: order-service
        url: http://order-service.production.svc.cluster.local:8001
        protocol: http
        connect_timeout: 60000
        write_timeout: 60000
        read_timeout: 60000
        retries: 3

        # 路由
        routes:
          - name: order-api
            paths:
              - /api/v1/orders
            methods:
              - GET
              - POST
              - PUT
              - DELETE
            strip_path: false

            # 插件
            plugins:
              - name: rate-limiting
                config:
                  minute: 100
                  policy: cluster
                  fault_tolerant: true

              - name: jwt
                config:
                  key_claim_name: kid
                  secret_is_base64: false

              - name: request-size-limiting
                config:
                  allowed_payload_size: 10
                  size_unit: megabytes

              - name: correlation-id
                config:
                  header_name: X-Correlation-ID
                  generator: uuid

              - name: prometheus
                config:
                  per_consumer: true

      - name: inventory-service
        url: http://inventory-service.production.svc.cluster.local:8002
        routes:
          - name: inventory-api
            paths:
              - /api/v1/inventory

      - name: payment-service
        url: http://payment-service.production.svc.cluster.local:8003
        routes:
          - name: payment-api
            paths:
              - /api/v1/payments

    # 全局插件
    plugins:
      - name: cors
        config:
          origins:
            - https://app.example.com
          methods:
            - GET
            - POST
            - PUT
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Authorization
            - Content-Type
            - X-Request-ID
          exposed_headers:
            - X-Auth-Token
          credentials: true
          max_age: 3600

      - name: request-transformer
        config:
          add:
            headers:
              - "X-Gateway-Version:1.0"

      - name: response-transformer
        config:
          remove:
            headers:
              - "X-Internal-Header"
```

---

## GitHub CI/CD配置

### CI工作流

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

env:
  CARGO_TERM_COLOR: always
  RUST_VERSION: 1.75.0

jobs:
  # 代码检查
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          profile: minimal
          toolchain: ${{ env.RUST_VERSION }}
          components: rustfmt, clippy
          override: true

      - name: Cache cargo registry
        uses: actions/cache@v3
        with:
          path: ~/.cargo/registry
          key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache cargo index
        uses: actions/cache@v3
        with:
          path: ~/.cargo/git
          key: ${{ runner.os }}-cargo-git-${{ hashFiles('**/Cargo.lock') }}

      - name: Cache target directory
        uses: actions/cache@v3
        with:
          path: target
          key: ${{ runner.os }}-target-${{ hashFiles('**/Cargo.lock') }}

      - name: Run rustfmt
        run: cargo fmt --all -- --check

      - name: Run clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

  # 单元测试
  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          profile: minimal
          toolchain: ${{ env.RUST_VERSION }}
          override: true

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-test-${{ hashFiles('**/Cargo.lock') }}

      - name: Run tests
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: cargo test --all-features --workspace

      - name: Run doc tests
        run: cargo test --doc --workspace

  # 安全审计
  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install cargo-audit
        run: cargo install cargo-audit

      - name: Run cargo audit
        run: cargo audit

  # 代码覆盖率
  coverage:
    name: Code Coverage
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          profile: minimal
          toolchain: ${{ env.RUST_VERSION }}
          override: true

      - name: Install tarpaulin
        run: cargo install cargo-tarpaulin

      - name: Generate coverage
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test_db
        run: cargo tarpaulin --out Xml --workspace

      - name: Upload to codecov.io
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true

  # 构建Docker镜像
  build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: [lint, test]
    strategy:
      matrix:
        service: [order-service, inventory-service, payment-service]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ matrix.service }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/Dockerfile.service
          build-args: |
            SERVICE_NAME=${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### CD工作流（生产部署）

```yaml
# .github/workflows/deploy-production.yml

name: Deploy to Production

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Install kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.29.0'

      - name: Configure kubectl
        run: |
          aws eks update-kubeconfig --name production-cluster --region us-east-1

      - name: Deploy with Helm
        run: |
          helm upgrade --install erp-system ./k8s/helm/erp-system \
            --namespace production \
            --create-namespace \
            --set image.tag=${{ github.ref_name }} \
            --set environment=production \
            --values ./k8s/helm/erp-system/values-production.yaml \
            --wait \
            --timeout 10m

      - name: Verify deployment
        run: |
          kubectl rollout status deployment/order-service -n production
          kubectl rollout status deployment/inventory-service -n production
          kubectl rollout status deployment/payment-service -n production

      - name: Run smoke tests
        run: |
          kubectl run smoke-test --rm -i --restart=Never \
            --image=curlimages/curl:latest \
            -- curl -f http://api-gateway.production.svc.cluster.local/health || exit 1

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 容器化与Kubernetes

### Multi-stage Dockerfile

```dockerfile
# docker/Dockerfile.service

# ============================================
# Stage 1: Builder
# ============================================
FROM rust:1.75-slim-bookworm AS builder

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

WORKDIR /build

# 安装依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY Cargo.toml Cargo.lock ./
COPY shared/ ./shared/
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# 构建依赖（利用Docker缓存）
RUN mkdir -p services/${SERVICE_NAME}/src && \
    echo "fn main() {}" > services/${SERVICE_NAME}/src/main.rs && \
    cargo build --release --bin ${SERVICE_NAME} && \
    rm -rf services/${SERVICE_NAME}/src

# 构建实际应用
COPY services/${SERVICE_NAME}/src ./services/${SERVICE_NAME}/src
RUN touch services/${SERVICE_NAME}/src/main.rs && \
    cargo build --release --bin ${SERVICE_NAME}

# ============================================
# Stage 2: Runtime
# ============================================
FROM debian:bookworm-slim

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# 创建非root用户
RUN useradd -m -u 1000 appuser

WORKDIR /app

# 复制编译后的二进制文件
COPY --from=builder /build/target/release/${SERVICE_NAME} /app/service
COPY services/${SERVICE_NAME}/migrations /app/migrations

# 更改所有权
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["/app/service"]
```

### Kubernetes Deployment

```yaml
# k8s/base/order-service/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: production
  labels:
    app: order-service
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: order-service

      # 初始化容器（运行数据库迁移）
      initContainers:
        - name: db-migration
          image: ghcr.io/your-org/order-service:latest
          command: ['sqlx', 'migrate', 'run']
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: order-service-secrets
                  key: database-url

      containers:
        - name: order-service
          image: ghcr.io/your-org/order-service:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
            - name: grpc
              containerPort: 9000
              protocol: TCP
            - name: metrics
              containerPort: 9090
              protocol: TCP

          env:
            - name: RUST_LOG
              value: "info,order_service=debug"
            - name: SERVICE_NAME
              value: "order-service"
            - name: SERVICE_PORT
              value: "8080"

            # 从ConfigMap加载
            - name: KAFKA_BROKERS
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: kafka-brokers

            # 从Secret加载
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: order-service-secrets
                  key: database-url

            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: order-service-secrets
                  key: redis-url

            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: order-service-secrets
                  key: jwt-secret

          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 3

          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/cache

      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}

      # Pod反亲和性（避免同一节点部署多个副本）
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - order-service
                topologyKey: kubernetes.io/hostname

      # Pod中断预算
      terminationGracePeriodSeconds: 30

---
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: production
  labels:
    app: order-service
spec:
  type: ClusterIP
  selector:
    app: order-service
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
    - name: grpc
      port: 9000
      targetPort: 9000
      protocol: TCP
    - name: metrics
      port: 9090
      targetPort: 9090
      protocol: TCP
  sessionAffinity: None

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 2
          periodSeconds: 15
      selectPolicy: Max
```

---

**（文档继续...）**

由于篇幅限制，完整文档还包含以下章节：

10. **可观测性** - Prometheus指标、Grafana仪表盘、Loki日志聚合、Jaeger分布式追踪
11. **安全最佳实践** - mTLS、RBAC、密钥管理、漏洞扫描
12. **性能优化** - 连接池、异步I/O、零拷贝、SIMD优化
13. **测试策略** - 单元测试、集成测试、Contract Testing、性能测试

---

**© 2025 Rust DDD微服务架构最佳实践**
**版本**: v1.0
**维护者**: 架构团队
**许可证**: MIT
