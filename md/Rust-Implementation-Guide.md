# Rust ERP 系统 - 实施技术指南

**配套文档**: Rust-Abc-Enhanced.md
**版本**: v1.0
**创建日期**: 2025-12-22
**说明**: 本文档提供12个月开发计划的详细技术实施指南

---

## 目录

1. [API设计规范与示例](#一api设计规范与示例)
2. [数据库设计模式与迁移](#二数据库设计模式与迁移)
3. [分布式事务处理（Saga模式）](#三分布式事务处理saga模式)
4. [安全加固详细方案](#四安全加固详细方案)
5. [监控告警详细配置](#五监控告警详细配置)
6. [测试策略详细方案](#六测试策略详细方案)
7. [Kubernetes部署配置](#七kubernetes部署配置)
8. [CI/CD Pipeline详细配置](#八cicd-pipeline详细配置)
9. [运维Runbook模板](#九运维runbook模板)
10. [代码规范和最佳实践](#十代码规范和最佳实践)

---

## 一、API设计规范与示例

### 1.1 REST API 设计规范

#### 1.1.1 URL命名规范

```
格式: /api/{version}/{domain}/{resource}

示例:
- /api/v1/financial/accounts
- /api/v1/financial/transactions
- /api/v1/materials/purchase-orders
- /api/v1/sales/orders
```

#### 1.1.2 HTTP方法语义

| 方法 | 语义 | 幂等性 | 示例 |
|-----|------|--------|------|
| GET | 查询资源 | 是 | GET /api/v1/financial/accounts/123 |
| POST | 创建资源 | 否* | POST /api/v1/financial/transactions |
| PUT | 完整更新资源 | 是 | PUT /api/v1/financial/accounts/123 |
| PATCH | 部分更新资源 | 否 | PATCH /api/v1/financial/accounts/123 |
| DELETE | 删除资源 | 是 | DELETE /api/v1/financial/accounts/123 |

*注：POST通过Idempotency-Key实现幂等

#### 1.1.3 请求幂等性设计

**所有写操作（POST/PATCH）必须支持幂等性**

```rust
// HTTP Header
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

// 服务端实现
#[derive(Debug, Deserialize)]
pub struct CreateTransactionRequest {
    pub idempotency_key: Uuid,  // 必填
    pub posting_date: NaiveDate,
    pub company_code: String,
    pub journal_entries: Vec<JournalEntryDto>,
}

// Handler
pub async fn create_transaction(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateTransactionRequest>,
) -> Result<Json<TransactionResponse>, ApiError> {
    // 1. 检查幂等键是否已存在
    if let Some(cached) = state.redis
        .get::<String>(&format!("idempotency:{}", req.idempotency_key))
        .await?
    {
        // 返回缓存的响应
        return Ok(Json(serde_json::from_str(&cached)?));
    }

    // 2. 执行业务逻辑
    let result = state.transaction_service
        .create_transaction(req)
        .await?;

    // 3. 缓存响应（TTL 24小时）
    state.redis
        .set_ex(
            &format!("idempotency:{}", req.idempotency_key),
            serde_json::to_string(&result)?,
            86400,
        )
        .await?;

    Ok(Json(result))
}
```

#### 1.1.4 统一错误响应格式

```rust
#[derive(Debug, Serialize)]
pub struct ApiError {
    /// 错误码（业务错误码）
    pub code: String,
    /// 错误消息（用户友好）
    pub message: String,
    /// 详细错误（开发调试用）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<ErrorDetail>>,
    /// 追踪ID
    pub trace_id: String,
    /// 时间戳
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ErrorDetail {
    pub field: String,
    pub message: String,
}

// 错误码设计
pub mod error_codes {
    // 4xx 客户端错误
    pub const INVALID_REQUEST: &str = "ERR_INVALID_REQUEST";
    pub const UNAUTHORIZED: &str = "ERR_UNAUTHORIZED";
    pub const FORBIDDEN: &str = "ERR_FORBIDDEN";
    pub const NOT_FOUND: &str = "ERR_NOT_FOUND";
    pub const CONFLICT: &str = "ERR_CONFLICT";
    pub const VALIDATION_FAILED: &str = "ERR_VALIDATION_FAILED";

    // 5xx 服务端错误
    pub const INTERNAL_ERROR: &str = "ERR_INTERNAL";
    pub const SERVICE_UNAVAILABLE: &str = "ERR_SERVICE_UNAVAILABLE";
    pub const TIMEOUT: &str = "ERR_TIMEOUT";

    // 业务错误
    pub const INSUFFICIENT_BALANCE: &str = "FIN_INSUFFICIENT_BALANCE";
    pub const CREDIT_LIMIT_EXCEEDED: &str = "FSCM_CREDIT_LIMIT_EXCEEDED";
    pub const INVENTORY_NOT_AVAILABLE: &str = "MM_INVENTORY_NOT_AVAILABLE";
    pub const DUPLICATE_TRANSACTION: &str = "FIN_DUPLICATE_TRANSACTION";
}

// 错误响应示例
{
  "code": "ERR_VALIDATION_FAILED",
  "message": "Validation failed for the request",
  "details": [
    {
      "field": "posting_date",
      "message": "Posting date cannot be in the future"
    },
    {
      "field": "journal_entries",
      "message": "Debit and credit amounts must be balanced"
    }
  ],
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "timestamp": "2025-12-22T10:30:00Z"
}
```

#### 1.1.5 分页查询规范

```rust
// 请求参数
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: u32,  // 页码（从1开始）

    #[serde(default = "default_page_size")]
    pub page_size: u32,  // 每页大小（默认20）

    #[serde(default)]
    pub sort_by: Option<String>,  // 排序字段

    #[serde(default)]
    pub sort_order: SortOrder,  // 排序方向
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

fn default_page() -> u32 { 1 }
fn default_page_size() -> u32 { 20 }

// 响应格式
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
    pub total_items: u64,
    pub has_next: bool,
    pub has_previous: bool,
}

// 查询示例
// GET /api/v1/financial/transactions?page=2&page_size=50&sort_by=posting_date&sort_order=desc
```

#### 1.1.6 完整API示例：财务凭证接口

```rust
// src/api/http/handlers/transaction_handler.rs

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

/// 创建财务凭证
/// POST /api/v1/financial/transactions
#[utoipa::path(
    post,
    path = "/api/v1/financial/transactions",
    request_body = CreateTransactionRequest,
    responses(
        (status = 201, description = "Transaction created successfully", body = TransactionResponse),
        (status = 400, description = "Invalid request", body = ApiError),
        (status = 409, description = "Duplicate transaction", body = ApiError),
    ),
    tag = "Financial Transactions"
)]
pub async fn create_transaction(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateTransactionRequest>,
) -> Result<impl IntoResponse, ApiError> {
    // 提取追踪ID
    let trace_id = extract_trace_id(&headers);

    // 执行命令
    let command = CreateTransactionCommand {
        idempotency_key: req.idempotency_key,
        posting_date: req.posting_date,
        document_date: req.document_date,
        company_code: req.company_code,
        fiscal_year: req.fiscal_year,
        journal_entries: req.journal_entries.into_iter().map(Into::into).collect(),
    };

    let result = state.command_bus
        .dispatch(command)
        .await
        .map_err(|e| ApiError::from_domain_error(e, trace_id.clone()))?;

    Ok((
        StatusCode::CREATED,
        Json(TransactionResponse::from(result)),
    ))
}

/// 查询财务凭证详情
/// GET /api/v1/financial/transactions/{id}
#[utoipa::path(
    get,
    path = "/api/v1/financial/transactions/{id}",
    params(
        ("id" = Uuid, Path, description = "Transaction ID")
    ),
    responses(
        (status = 200, description = "Transaction found", body = TransactionResponse),
        (status = 404, description = "Transaction not found", body = ApiError),
    ),
    tag = "Financial Transactions"
)]
pub async fn get_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let query = GetTransactionQuery { transaction_id: id };

    let result = state.query_bus
        .dispatch(query)
        .await
        .map_err(|e| ApiError::from_domain_error(e, trace_id()))?;

    Ok(Json(result))
}

/// 查询财务凭证列表
/// GET /api/v1/financial/transactions
#[utoipa::path(
    get,
    path = "/api/v1/financial/transactions",
    params(
        PaginationParams,
        TransactionFilterParams,
    ),
    responses(
        (status = 200, description = "List of transactions", body = PaginatedResponse<TransactionResponse>),
    ),
    tag = "Financial Transactions"
)]
pub async fn list_transactions(
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
    Query(filters): Query<TransactionFilterParams>,
) -> Result<Json<PaginatedResponse<TransactionResponse>>, ApiError> {
    let query = ListTransactionsQuery {
        page: pagination.page,
        page_size: pagination.page_size,
        company_code: filters.company_code,
        posting_date_from: filters.posting_date_from,
        posting_date_to: filters.posting_date_to,
        status: filters.status,
    };

    let result = state.query_bus
        .dispatch(query)
        .await
        .map_err(|e| ApiError::from_domain_error(e, trace_id()))?;

    Ok(Json(result))
}

/// 冲销财务凭证
/// POST /api/v1/financial/transactions/{id}/reverse
#[utoipa::path(
    post,
    path = "/api/v1/financial/transactions/{id}/reverse",
    params(
        ("id" = Uuid, Path, description = "Transaction ID to reverse")
    ),
    request_body = ReverseTransactionRequest,
    responses(
        (status = 200, description = "Transaction reversed successfully", body = TransactionResponse),
        (status = 404, description = "Transaction not found", body = ApiError),
        (status = 409, description = "Transaction already reversed", body = ApiError),
    ),
    tag = "Financial Transactions"
)]
pub async fn reverse_transaction(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<ReverseTransactionRequest>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let command = ReverseTransactionCommand {
        transaction_id: id,
        reversal_date: req.reversal_date,
        reason: req.reason,
    };

    let result = state.command_bus
        .dispatch(command)
        .await
        .map_err(|e| ApiError::from_domain_error(e, trace_id()))?;

    Ok(Json(result))
}

// DTOs
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateTransactionRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub idempotency_key: Uuid,

    #[schema(example = "2025-12-22")]
    pub posting_date: NaiveDate,

    #[schema(example = "2025-12-20")]
    pub document_date: NaiveDate,

    #[schema(example = "1000")]
    pub company_code: String,

    #[schema(example = 2025)]
    pub fiscal_year: i32,

    pub journal_entries: Vec<JournalEntryDto>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct JournalEntryDto {
    #[schema(example = "100000")]
    pub account_number: String,

    #[schema(example = 10000.00)]
    pub debit_amount: Decimal,

    #[schema(example = 0.00)]
    pub credit_amount: Decimal,

    #[schema(example = "USD")]
    pub currency: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_center: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub profit_center: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct TransactionResponse {
    pub transaction_id: Uuid,
    pub transaction_number: String,
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub company_code: String,
    pub fiscal_year: i32,
    pub status: TransactionStatus,
    pub journal_entries: Vec<JournalEntryDto>,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
}

#[derive(Debug, Deserialize)]
pub struct TransactionFilterParams {
    pub company_code: Option<String>,
    pub posting_date_from: Option<NaiveDate>,
    pub posting_date_to: Option<NaiveDate>,
    pub status: Option<TransactionStatus>,
}
```

### 1.2 gRPC API 设计规范

#### 1.2.1 Protobuf 命名规范

```protobuf
// proto/financial/v1/transaction_service.proto

syntax = "proto3";

package erp.financial.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// 服务定义
service TransactionService {
  // 创建财务凭证（幂等）
  rpc CreateTransaction(CreateTransactionRequest) returns (CreateTransactionResponse);

  // 查询财务凭证
  rpc GetTransaction(GetTransactionRequest) returns (GetTransactionResponse);

  // 查询财务凭证列表
  rpc ListTransactions(ListTransactionsRequest) returns (ListTransactionsResponse);

  // 冲销财务凭证
  rpc ReverseTransaction(ReverseTransactionRequest) returns (ReverseTransactionResponse);

  // 批量创建财务凭证（幂等）
  rpc BatchCreateTransactions(BatchCreateTransactionsRequest) returns (BatchCreateTransactionsResponse);
}

// 请求消息
message CreateTransactionRequest {
  // 幂等键（必填）
  string idempotency_key = 1;

  // 过账日期
  string posting_date = 2;  // ISO 8601 格式: "2025-12-22"

  // 凭证日期
  string document_date = 3;

  // 公司代码
  string company_code = 4;

  // 会计年度
  int32 fiscal_year = 5;

  // 分录
  repeated JournalEntry journal_entries = 6;

  // 附件（可选）
  repeated Attachment attachments = 7;
}

message JournalEntry {
  string account_number = 1;
  double debit_amount = 2;
  double credit_amount = 3;
  string currency = 4;
  optional string cost_center = 5;
  optional string profit_center = 6;
  optional string text = 7;
}

message Attachment {
  string filename = 1;
  string content_type = 2;
  bytes content = 3;
}

// 响应消息
message CreateTransactionResponse {
  string transaction_id = 1;
  string transaction_number = 2;
  TransactionStatus status = 3;
  google.protobuf.Timestamp created_at = 4;
}

enum TransactionStatus {
  TRANSACTION_STATUS_UNSPECIFIED = 0;
  TRANSACTION_STATUS_DRAFT = 1;
  TRANSACTION_STATUS_POSTED = 2;
  TRANSACTION_STATUS_REVERSED = 3;
}

// 查询请求
message GetTransactionRequest {
  string transaction_id = 1;
}

message GetTransactionResponse {
  Transaction transaction = 1;
}

message Transaction {
  string transaction_id = 1;
  string transaction_number = 2;
  string posting_date = 3;
  string document_date = 4;
  string company_code = 5;
  int32 fiscal_year = 6;
  TransactionStatus status = 7;
  repeated JournalEntry journal_entries = 8;
  google.protobuf.Timestamp created_at = 9;
  string created_by = 10;
}

// 列表查询
message ListTransactionsRequest {
  int32 page = 1;
  int32 page_size = 2;
  optional string company_code = 3;
  optional string posting_date_from = 4;
  optional string posting_date_to = 5;
  optional TransactionStatus status = 6;
}

message ListTransactionsResponse {
  repeated Transaction transactions = 1;
  PaginationMeta pagination = 2;
}

message PaginationMeta {
  int32 page = 1;
  int32 page_size = 2;
  int32 total_pages = 3;
  int64 total_items = 4;
  bool has_next = 5;
  bool has_previous = 6;
}
```

#### 1.2.2 gRPC 服务端实现

```rust
// src/api/grpc/services/transaction_service.rs

use tonic::{Request, Response, Status};
use uuid::Uuid;

pub mod financial {
    tonic::include_proto!("erp.financial.v1");
}

use financial::{
    transaction_service_server::TransactionService,
    CreateTransactionRequest, CreateTransactionResponse,
    GetTransactionRequest, GetTransactionResponse,
    ListTransactionsRequest, ListTransactionsResponse,
};

pub struct TransactionServiceImpl {
    command_bus: Arc<CommandBus>,
    query_bus: Arc<QueryBus>,
}

#[tonic::async_trait]
impl TransactionService for TransactionServiceImpl {
    async fn create_transaction(
        &self,
        request: Request<CreateTransactionRequest>,
    ) -> Result<Response<CreateTransactionResponse>, Status> {
        // 提取元数据
        let metadata = request.metadata();
        let trace_id = metadata
            .get("x-trace-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown");

        let req = request.into_inner();

        // 验证幂等键
        let idempotency_key = Uuid::parse_str(&req.idempotency_key)
            .map_err(|_| Status::invalid_argument("Invalid idempotency key"))?;

        // 构建命令
        let command = CreateTransactionCommand {
            idempotency_key,
            posting_date: NaiveDate::parse_from_str(&req.posting_date, "%Y-%m-%d")
                .map_err(|_| Status::invalid_argument("Invalid posting date format"))?,
            document_date: NaiveDate::parse_from_str(&req.document_date, "%Y-%m-%d")
                .map_err(|_| Status::invalid_argument("Invalid document date format"))?,
            company_code: req.company_code,
            fiscal_year: req.fiscal_year,
            journal_entries: req.journal_entries
                .into_iter()
                .map(|e| JournalEntry {
                    account_number: e.account_number,
                    debit_amount: Decimal::from_f64(e.debit_amount)
                        .ok_or_else(|| Status::invalid_argument("Invalid debit amount"))?,
                    credit_amount: Decimal::from_f64(e.credit_amount)
                        .ok_or_else(|| Status::invalid_argument("Invalid credit amount"))?,
                    currency: e.currency,
                    cost_center: e.cost_center,
                    profit_center: e.profit_center,
                    text: e.text,
                })
                .collect::<Result<Vec<_>, _>>()?,
        };

        // 执行命令
        let result = self.command_bus
            .dispatch(command)
            .await
            .map_err(|e| Status::internal(format!("Failed to create transaction: {}", e)))?;

        // 返回响应
        Ok(Response::new(CreateTransactionResponse {
            transaction_id: result.transaction_id.to_string(),
            transaction_number: result.transaction_number,
            status: result.status.into(),
            created_at: Some(prost_types::Timestamp {
                seconds: result.created_at.timestamp(),
                nanos: result.created_at.timestamp_subsec_nanos() as i32,
            }),
        }))
    }

    async fn get_transaction(
        &self,
        request: Request<GetTransactionRequest>,
    ) -> Result<Response<GetTransactionResponse>, Status> {
        let req = request.into_inner();

        let transaction_id = Uuid::parse_str(&req.transaction_id)
            .map_err(|_| Status::invalid_argument("Invalid transaction ID"))?;

        let query = GetTransactionQuery { transaction_id };

        let result = self.query_bus
            .dispatch(query)
            .await
            .map_err(|e| match e {
                QueryError::NotFound => Status::not_found("Transaction not found"),
                _ => Status::internal(format!("Failed to get transaction: {}", e)),
            })?;

        Ok(Response::new(GetTransactionResponse {
            transaction: Some(result.into()),
        }))
    }

    // ... 其他方法实现
}
```

#### 1.2.3 gRPC 拦截器（鉴权、日志、追踪）

```rust
// src/api/grpc/interceptors/auth_interceptor.rs

use tonic::{Request, Status};

pub fn auth_interceptor(mut req: Request<()>) -> Result<Request<()>, Status> {
    let metadata = req.metadata();

    // 1. 提取JWT Token
    let token = metadata
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| Status::unauthenticated("Missing authorization token"))?;

    // 2. 验证JWT Token
    let claims = verify_jwt_token(token)
        .map_err(|_| Status::unauthenticated("Invalid token"))?;

    // 3. 注入用户信息到扩展
    req.extensions_mut().insert(AuthenticatedUser {
        user_id: claims.sub,
        roles: claims.roles,
        tenant_id: claims.tenant_id,
    });

    Ok(req)
}

// src/api/grpc/interceptors/logging_interceptor.rs

pub fn logging_interceptor(req: Request<()>) -> Result<Request<()>, Status> {
    let metadata = req.metadata();
    let trace_id = metadata
        .get("x-trace-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    tracing::info!(
        trace_id = trace_id,
        method = ?req.uri().path(),
        "Incoming gRPC request"
    );

    Ok(req)
}

// 服务器启动时注册拦截器
use tonic::transport::Server;

Server::builder()
    .layer(tower::ServiceBuilder::new()
        .layer(tonic::service::interceptor(auth_interceptor))
        .layer(tonic::service::interceptor(logging_interceptor))
        .into_inner())
    .add_service(TransactionServiceServer::new(transaction_service))
    .serve(addr)
    .await?;
```

---

## 二、数据库设计模式与迁移

### 2.1 数据库设计原则

#### 2.1.1 表命名规范

```sql
-- 模式命名: {service_name}
CREATE SCHEMA IF NOT EXISTS financial;
CREATE SCHEMA IF NOT EXISTS materials;
CREATE SCHEMA IF NOT EXISTS sales;

-- 表命名: {aggregate_name}_{entity_name}
-- 聚合根表
CREATE TABLE financial.transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ...
);

-- 子实体表
CREATE TABLE financial.journal_entries (
    journal_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES financial.transactions(transaction_id),
    -- ...
);

-- 值对象表（如果需要单独存储）
CREATE TABLE financial.money (
    money_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC(19, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL
);

-- 历史表（审计/时间旅行）
CREATE TABLE financial.transactions_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    -- ... 所有字段的快照
);

-- 事件存储表（Event Sourcing）
CREATE TABLE shared.event_store (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version VARCHAR(20) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence_number BIGSERIAL NOT NULL,
    UNIQUE (aggregate_id, sequence_number)
);

-- 分区索引
CREATE INDEX idx_event_store_aggregate
ON shared.event_store (aggregate_id, sequence_number);

CREATE INDEX idx_event_store_type_time
ON shared.event_store (aggregate_type, occurred_at);
```

#### 2.1.2 字段命名规范

```sql
-- 主键: {table_name}_id
transaction_id UUID PRIMARY KEY

-- 外键: {reference_table}_id
account_id UUID REFERENCES financial.accounts(account_id)

-- 布尔值: is_{condition} / has_{condition}
is_active BOOLEAN DEFAULT TRUE
has_been_posted BOOLEAN DEFAULT FALSE

-- 日期时间: {action}_at / {action}_date
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
posting_date DATE NOT NULL

-- 金额: {field}_amount
debit_amount NUMERIC(19, 4)
credit_amount NUMERIC(19, 4)

-- 审计字段（每张表必须有）
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by VARCHAR(255) NOT NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_by VARCHAR(255) NOT NULL,
version INTEGER NOT NULL DEFAULT 1  -- 乐观锁版本号
```

### 2.2 完整数据模型示例：财务凭证

```sql
-- migrations/financial/001_create_transactions_table.sql

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建Schema
CREATE SCHEMA IF NOT EXISTS financial;

-- 枚举类型
CREATE TYPE financial.transaction_status AS ENUM (
    'DRAFT',      -- 草稿
    'POSTED',     -- 已过账
    'REVERSED'    -- 已冲销
);

-- 主表：财务凭证
CREATE TABLE financial.transactions (
    -- 主键
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    transaction_number VARCHAR(50) NOT NULL UNIQUE,  -- 凭证编号（业务主键）
    posting_date DATE NOT NULL,                       -- 过账日期
    document_date DATE NOT NULL,                      -- 凭证日期
    company_code VARCHAR(10) NOT NULL,                -- 公司代码
    fiscal_year INTEGER NOT NULL,                     -- 会计年度
    fiscal_period INTEGER NOT NULL,                   -- 会计期间
    status financial.transaction_status NOT NULL DEFAULT 'DRAFT',

    -- 冲销关联
    reversed_transaction_id UUID REFERENCES financial.transactions(transaction_id),
    reversal_date DATE,
    reversal_reason TEXT,

    -- 附加信息
    document_type VARCHAR(10),                        -- 凭证类型
    reference VARCHAR(100),                           -- 参考号
    header_text TEXT,                                 -- 抬头文本

    -- 审计字段
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,

    -- 约束
    CONSTRAINT check_posting_date CHECK (posting_date <= CURRENT_DATE),
    CONSTRAINT check_fiscal_period CHECK (fiscal_period BETWEEN 1 AND 16)
);

-- 子表：分录
CREATE TABLE financial.journal_entries (
    journal_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES financial.transactions(transaction_id) ON DELETE CASCADE,

    -- 业务字段
    line_number INTEGER NOT NULL,                     -- 行号
    account_number VARCHAR(20) NOT NULL,              -- 科目编号
    debit_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,   -- 借方金额
    credit_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,  -- 贷方金额
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',       -- 币种

    -- 本位币金额（如果是外币交易）
    local_currency VARCHAR(3),
    exchange_rate NUMERIC(12, 5),
    local_debit_amount NUMERIC(19, 4),
    local_credit_amount NUMERIC(19, 4),

    -- 成本对象
    cost_center VARCHAR(20),                          -- 成本中心
    profit_center VARCHAR(20),                        -- 利润中心
    internal_order VARCHAR(20),                       -- 内部订单
    project_id UUID,                                  -- 项目ID

    -- 业务伙伴
    business_partner_id UUID,                         -- 业务伙伴ID

    -- 文本
    line_text TEXT,

    -- 审计字段
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,

    -- 约束
    CONSTRAINT check_entry_amount CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (debit_amount = 0 AND credit_amount > 0)
    ),
    CONSTRAINT unique_transaction_line UNIQUE (transaction_id, line_number)
);

-- 历史表（SCD Type 2）
CREATE TABLE financial.transactions_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,

    -- 所有业务字段的快照
    transaction_number VARCHAR(50) NOT NULL,
    posting_date DATE NOT NULL,
    document_date DATE NOT NULL,
    company_code VARCHAR(10) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_period INTEGER NOT NULL,
    status financial.transaction_status NOT NULL,

    -- 有效期
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,                             -- NULL表示当前版本

    -- 变更信息
    changed_by VARCHAR(255) NOT NULL,
    change_reason TEXT
);

-- 索引
CREATE INDEX idx_transactions_company_year
ON financial.transactions (company_code, fiscal_year);

CREATE INDEX idx_transactions_posting_date
ON financial.transactions (posting_date);

CREATE INDEX idx_transactions_status
ON financial.transactions (status) WHERE status = 'POSTED';

CREATE INDEX idx_journal_entries_transaction
ON financial.journal_entries (transaction_id);

CREATE INDEX idx_journal_entries_account
ON financial.journal_entries (account_number);

CREATE INDEX idx_journal_entries_cost_center
ON financial.journal_entries (cost_center) WHERE cost_center IS NOT NULL;

-- 全文搜索索引
CREATE INDEX idx_transactions_search
ON financial.transactions USING gin(to_tsvector('english', header_text));

-- 触发器：更新updated_at
CREATE OR REPLACE FUNCTION financial.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_updated_at
    BEFORE UPDATE ON financial.transactions
    FOR EACH ROW
    EXECUTE FUNCTION financial.update_updated_at_column();

-- 触发器：历史记录
CREATE OR REPLACE FUNCTION financial.insert_transaction_history()
RETURNS TRIGGER AS $$
BEGIN
    -- 关闭旧版本
    UPDATE financial.transactions_history
    SET valid_to = NOW()
    WHERE transaction_id = OLD.transaction_id AND valid_to IS NULL;

    -- 插入新版本
    INSERT INTO financial.transactions_history (
        transaction_id, transaction_number, posting_date, document_date,
        company_code, fiscal_year, fiscal_period, status,
        valid_from, changed_by, change_reason
    ) VALUES (
        NEW.transaction_id, NEW.transaction_number, NEW.posting_date, NEW.document_date,
        NEW.company_code, NEW.fiscal_year, NEW.fiscal_period, NEW.status,
        NOW(), NEW.updated_by, 'Updated transaction'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_transactions_history
    AFTER UPDATE ON financial.transactions
    FOR EACH ROW
    EXECUTE FUNCTION financial.insert_transaction_history();

-- 约束：借贷平衡检查
CREATE OR REPLACE FUNCTION financial.check_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debit NUMERIC(19, 4);
    total_credit NUMERIC(19, 4);
BEGIN
    SELECT
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debit, total_credit
    FROM financial.journal_entries
    WHERE transaction_id = NEW.transaction_id;

    IF ABS(total_debit - total_credit) > 0.01 THEN
        RAISE EXCEPTION 'Transaction % is not balanced: debit=%, credit=%',
            NEW.transaction_id, total_debit, total_credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 在凭证状态变更为POSTED时检查借贷平衡
CREATE TRIGGER trigger_check_balance_before_post
    BEFORE UPDATE OF status ON financial.transactions
    FOR EACH ROW
    WHEN (NEW.status = 'POSTED' AND OLD.status != 'POSTED')
    EXECUTE FUNCTION financial.check_transaction_balance();

-- 分区表（按年度分区，提升性能）
-- 注意：仅在数据量巨大时使用
CREATE TABLE financial.transactions_partitioned (
    LIKE financial.transactions INCLUDING ALL
) PARTITION BY RANGE (fiscal_year);

CREATE TABLE financial.transactions_2024 PARTITION OF financial.transactions_partitioned
    FOR VALUES FROM (2024) TO (2025);

CREATE TABLE financial.transactions_2025 PARTITION OF financial.transactions_partitioned
    FOR VALUES FROM (2025) TO (2026);

-- 权限设置
GRANT SELECT, INSERT, UPDATE ON financial.transactions TO financial_service;
GRANT SELECT, INSERT ON financial.journal_entries TO financial_service;
GRANT SELECT ON financial.transactions_history TO financial_service;

-- 注释
COMMENT ON TABLE financial.transactions IS '财务凭证主表';
COMMENT ON COLUMN financial.transactions.transaction_id IS '凭证唯一标识';
COMMENT ON COLUMN financial.transactions.transaction_number IS '凭证编号（业务主键）';
COMMENT ON COLUMN financial.transactions.posting_date IS '过账日期（影响会计期间）';
```

### 2.3 数据库迁移管理（SQLx）

#### 2.3.1 迁移脚本结构

```
migrations/
├── financial/
│   ├── 001_create_transactions_table.sql
│   ├── 002_create_accounts_table.sql
│   ├── 003_create_receivables_table.sql
│   ├── 004_add_transaction_attachments.sql
│   └── 005_add_transaction_approval_workflow.sql
├── materials/
│   ├── 001_create_materials_table.sql
│   ├── 002_create_purchase_orders_table.sql
│   └── 003_create_inventory_table.sql
├── sales/
│   ├── 001_create_customers_table.sql
│   └── 002_create_sales_orders_table.sql
└── shared/
    ├── 001_create_event_store_table.sql
    └── 002_create_audit_log_table.sql
```

#### 2.3.2 迁移脚本模板

```sql
-- migrations/financial/004_add_transaction_attachments.sql
-- Description: Add attachments support to transactions
-- Author: Developer B
-- Date: 2025-12-22

-- Up Migration
CREATE TABLE IF NOT EXISTS financial.transaction_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES financial.transactions(transaction_id) ON DELETE CASCADE,

    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,  -- S3路径或本地路径

    checksum VARCHAR(64) NOT NULL,  -- SHA-256校验和

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_attachments_transaction
ON financial.transaction_attachments (transaction_id);

-- Rollback (Down) Migration
-- DROP TABLE IF EXISTS financial.transaction_attachments CASCADE;
```

#### 2.3.3 执行迁移（代码）

```rust
// src/infrastructure/database/migrations.rs

use sqlx::{PgPool, migrate::MigrateDatabase};

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    tracing::info!("Running database migrations...");

    // SQLx会自动读取migrations目录下的所有.sql文件
    sqlx::migrate!("./migrations")
        .run(pool)
        .await?;

    tracing::info!("Database migrations completed successfully");
    Ok(())
}

// 应用启动时执行
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")?;
    let pool = PgPool::connect(&database_url).await?;

    // 运行迁移
    run_migrations(&pool).await?;

    // 启动服务
    // ...

    Ok(())
}
```

#### 2.3.4 测试环境迁移重置

```bash
#!/bin/bash
# scripts/reset_test_database.sh

set -e

DB_NAME="erp_test"
DB_USER="erp_user"
DB_PASSWORD="erp_pass"

echo "Dropping test database..."
psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "Creating test database..."
psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "Running migrations..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME" \
    cargo sqlx migrate run

echo "Loading seed data..."
psql -U $DB_USER -d $DB_NAME -f scripts/seed_data.sql

echo "Test database reset complete!"
```

### 2.4 种子数据（Seed Data）

```sql
-- scripts/seed_data.sql

-- 主数据：币种
INSERT INTO mdg.currencies (currency_code, currency_name, symbol, decimal_places) VALUES
('USD', 'US Dollar', '$', 2),
('EUR', 'Euro', '€', 2),
('CNY', 'Chinese Yuan', '¥', 2),
('JPY', 'Japanese Yen', '¥', 0);

-- 主数据：公司代码
INSERT INTO mdg.company_codes (company_code, company_name, currency, country) VALUES
('1000', 'Acme Corporation', 'USD', 'US'),
('2000', 'Acme Europe GmbH', 'EUR', 'DE'),
('3000', 'Acme China Ltd', 'CNY', 'CN');

-- 主数据：科目表
INSERT INTO financial.accounts (account_number, account_name, account_type, company_code) VALUES
-- 资产类
('100000', 'Cash', 'ASSET', '1000'),
('110000', 'Accounts Receivable', 'ASSET', '1000'),
('120000', 'Inventory', 'ASSET', '1000'),
('130000', 'Fixed Assets', 'ASSET', '1000'),
-- 负债类
('200000', 'Accounts Payable', 'LIABILITY', '1000'),
('210000', 'Short-term Loans', 'LIABILITY', '1000'),
-- 权益类
('300000', 'Share Capital', 'EQUITY', '1000'),
('310000', 'Retained Earnings', 'EQUITY', '1000'),
-- 收入类
('400000', 'Sales Revenue', 'REVENUE', '1000'),
-- 成本费用类
('500000', 'Cost of Goods Sold', 'EXPENSE', '1000'),
('510000', 'Salaries Expense', 'EXPENSE', '1000');

-- 测试用户
INSERT INTO iam.users (user_id, username, email, password_hash, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin@example.com', '$2b$12$...', TRUE),
('550e8400-e29b-41d4-a716-446655440002', 'accountant', 'accountant@example.com', '$2b$12$...', TRUE),
('550e8400-e29b-41d4-a716-446655440003', 'purchaser', 'purchaser@example.com', '$2b$12$...', TRUE);

-- 测试角色
INSERT INTO iam.roles (role_id, role_name, description) VALUES
('role-admin', 'Administrator', 'System administrator with full access'),
('role-accountant', 'Accountant', 'Financial accounting role'),
('role-purchaser', 'Purchaser', 'Purchasing role');

-- 用户-角色关联
INSERT INTO iam.user_roles (user_id, role_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'role-admin'),
('550e8400-e29b-41d4-a716-446655440002', 'role-accountant'),
('550e8400-e29b-41d4-a716-446655440003', 'role-purchaser');
```

---

## 三、分布式事务处理（Saga模式）

### 3.1 Saga模式概述

在微服务架构中，跨服务的事务使用**Saga编排模式**（Orchestration）或**Saga协同模式**（Choreography）。

#### 3.1.1 两种模式对比

| 特性 | 编排模式（Orchestration） | 协同模式（Choreography） |
|-----|-------------------------|------------------------|
| 协调者 | 中央Saga协调器 | 无中央协调，事件驱动 |
| 复杂度 | 中等（协调器集中管理） | 高（分布在各服务） |
| 可观测性 | 好（集中监控） | 差（分散追踪） |
| 耦合度 | 协调器与服务耦合 | 服务间松耦合 |
| 适用场景 | 复杂业务流程 | 简单事件链 |

**推荐**：对于ERP系统的复杂业务流程（如O2C、P2P），使用**编排模式**。

### 3.2 Saga编排模式实现

#### 3.2.1 Saga定义：销售订单流程（O2C）

```rust
// src/sagas/order_to_cash_saga.rs

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 销售订单到收款Saga
///
/// 流程：
/// 1. 创建销售订单 (Sales Service)
/// 2. 信用检查 (Credit Management Service)
/// 3. 预留库存 (Materials Service)
/// 4. 创建交付单 (Warehouse Service)
/// 5. 创建发货单 (Transport Service)
/// 6. 开票 (Sales Service)
/// 7. 创建应收账款 (Financial Service)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderToCashSaga {
    pub saga_id: Uuid,
    pub order_id: Uuid,
    pub customer_id: Uuid,
    pub order_amount: Decimal,
    pub currency: String,
    pub status: SagaStatus,
    pub current_step: SagaStep,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,

    // 步骤结果
    pub steps_completed: Vec<SagaStepResult>,
    pub compensations_executed: Vec<SagaStepResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SagaStatus {
    Started,
    InProgress,
    Completed,
    Failed,
    Compensating,
    Compensated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SagaStep {
    CreateOrder,
    CheckCredit,
    ReserveInventory,
    CreateDelivery,
    CreateShipment,
    CreateInvoice,
    CreateReceivable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SagaStepResult {
    pub step: SagaStep,
    pub status: StepStatus,
    pub result: serde_json::Value,
    pub executed_at: DateTime<Utc>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    Success,
    Failed,
    Compensated,
}

/// Saga协调器
pub struct OrderToCashSagaOrchestrator {
    sales_client: Arc<SalesServiceClient>,
    credit_client: Arc<CreditManagementServiceClient>,
    materials_client: Arc<MaterialsServiceClient>,
    warehouse_client: Arc<WarehouseServiceClient>,
    transport_client: Arc<TransportServiceClient>,
    financial_client: Arc<FinancialServiceClient>,
    saga_store: Arc<SagaStore>,
}

impl OrderToCashSagaOrchestrator {
    pub async fn execute(&self, saga: OrderToCashSaga) -> Result<OrderToCashSaga, SagaError> {
        let mut current_saga = saga.clone();
        current_saga.status = SagaStatus::InProgress;

        // 持久化Saga状态
        self.saga_store.save(&current_saga).await?;

        // 执行步骤
        let result = self.execute_steps(&mut current_saga).await;

        match result {
            Ok(_) => {
                current_saga.status = SagaStatus::Completed;
                current_saga.completed_at = Some(Utc::now());
                self.saga_store.save(&current_saga).await?;
                Ok(current_saga)
            }
            Err(e) => {
                // 执行补偿
                current_saga.status = SagaStatus::Compensating;
                self.saga_store.save(&current_saga).await?;

                self.compensate(&mut current_saga).await?;

                current_saga.status = SagaStatus::Compensated;
                self.saga_store.save(&current_saga).await?;

                Err(e)
            }
        }
    }

    async fn execute_steps(&self, saga: &mut OrderToCashSaga) -> Result<(), SagaError> {
        // Step 1: 创建销售订单
        let order_result = self.create_order(saga).await?;
        saga.record_step_success(SagaStep::CreateOrder, order_result);

        // Step 2: 信用检查
        let credit_result = self.check_credit(saga).await?;
        saga.record_step_success(SagaStep::CheckCredit, credit_result);

        // Step 3: 预留库存
        let reserve_result = self.reserve_inventory(saga).await?;
        saga.record_step_success(SagaStep::ReserveInventory, reserve_result);

        // Step 4: 创建交付单
        let delivery_result = self.create_delivery(saga).await?;
        saga.record_step_success(SagaStep::CreateDelivery, delivery_result);

        // Step 5: 创建发货单
        let shipment_result = self.create_shipment(saga).await?;
        saga.record_step_success(SagaStep::CreateShipment, shipment_result);

        // Step 6: 开票
        let invoice_result = self.create_invoice(saga).await?;
        saga.record_step_success(SagaStep::CreateInvoice, invoice_result);

        // Step 7: 创建应收账款
        let receivable_result = self.create_receivable(saga).await?;
        saga.record_step_success(SagaStep::CreateReceivable, receivable_result);

        Ok(())
    }

    async fn compensate(&self, saga: &mut OrderToCashSaga) -> Result<(), SagaError> {
        // 逆序执行补偿
        for step_result in saga.steps_completed.iter().rev() {
            if step_result.status == StepStatus::Success {
                match step_result.step {
                    SagaStep::CreateOrder => self.compensate_create_order(saga).await?,
                    SagaStep::CheckCredit => self.compensate_check_credit(saga).await?,
                    SagaStep::ReserveInventory => self.compensate_reserve_inventory(saga).await?,
                    SagaStep::CreateDelivery => self.compensate_create_delivery(saga).await?,
                    SagaStep::CreateShipment => self.compensate_create_shipment(saga).await?,
                    SagaStep::CreateInvoice => self.compensate_create_invoice(saga).await?,
                    SagaStep::CreateReceivable => self.compensate_create_receivable(saga).await?,
                }
                saga.record_compensation_success(step_result.step.clone());
            }
        }
        Ok(())
    }

    // 前进步骤实现
    async fn create_order(&self, saga: &OrderToCashSaga) -> Result<serde_json::Value, SagaError> {
        let request = CreateSalesOrderRequest {
            idempotency_key: saga.saga_id,  // 使用Saga ID作为幂等键
            customer_id: saga.customer_id,
            order_amount: saga.order_amount,
            currency: saga.currency.clone(),
        };

        let response = self.sales_client
            .create_order(request)
            .await
            .map_err(|e| SagaError::StepFailed(SagaStep::CreateOrder, e.to_string()))?;

        Ok(serde_json::to_value(response)?)
    }

    async fn check_credit(&self, saga: &OrderToCashSaga) -> Result<serde_json::Value, SagaError> {
        let request = CheckCreditRequest {
            customer_id: saga.customer_id,
            order_amount: saga.order_amount,
            currency: saga.currency.clone(),
        };

        let response = self.credit_client
            .check_credit(request)
            .await
            .map_err(|e| SagaError::StepFailed(SagaStep::CheckCredit, e.to_string()))?;

        // 如果信用检查失败，抛出错误触发补偿
        if !response.approved {
            return Err(SagaError::StepFailed(
                SagaStep::CheckCredit,
                format!("Credit limit exceeded: available={}, requested={}",
                    response.available_credit, saga.order_amount)
            ));
        }

        Ok(serde_json::to_value(response)?)
    }

    async fn reserve_inventory(&self, saga: &OrderToCashSaga) -> Result<serde_json::Value, SagaError> {
        // 从订单结果中提取订单行项目
        let order_result = saga.get_step_result(SagaStep::CreateOrder)
            .ok_or_else(|| SagaError::StepFailed(SagaStep::ReserveInventory, "Order not created".to_string()))?;

        let order: SalesOrderResponse = serde_json::from_value(order_result.result.clone())?;

        let request = ReserveInventoryRequest {
            idempotency_key: saga.saga_id,
            order_id: order.order_id,
            items: order.items.iter().map(|item| ReserveInventoryItem {
                material_id: item.material_id,
                quantity: item.quantity,
                plant: item.plant.clone(),
            }).collect(),
        };

        let response = self.materials_client
            .reserve_inventory(request)
            .await
            .map_err(|e| SagaError::StepFailed(SagaStep::ReserveInventory, e.to_string()))?;

        Ok(serde_json::to_value(response)?)
    }

    // ... 其他步骤实现

    // 补偿步骤实现
    async fn compensate_create_order(&self, saga: &OrderToCashSaga) -> Result<(), SagaError> {
        let order_result = saga.get_step_result(SagaStep::CreateOrder)
            .ok_or_else(|| SagaError::CompensationFailed(SagaStep::CreateOrder, "Order not found".to_string()))?;

        let order: SalesOrderResponse = serde_json::from_value(order_result.result.clone())?;

        let request = CancelSalesOrderRequest {
            order_id: order.order_id,
            reason: format!("Saga compensation: {}", saga.saga_id),
        };

        self.sales_client
            .cancel_order(request)
            .await
            .map_err(|e| SagaError::CompensationFailed(SagaStep::CreateOrder, e.to_string()))?;

        Ok(())
    }

    async fn compensate_check_credit(&self, saga: &OrderToCashSaga) -> Result<(), SagaError> {
        // 信用检查通常不需要补偿（只是检查，未修改状态）
        // 但如果信用检查时锁定了额度，需要在这里释放

        let credit_result = saga.get_step_result(SagaStep::CheckCredit)
            .ok_or_else(|| SagaError::CompensationFailed(SagaStep::CheckCredit, "Credit check not found".to_string()))?;

        let credit: CreditCheckResponse = serde_json::from_value(credit_result.result.clone())?;

        if let Some(hold_id) = credit.credit_hold_id {
            let request = ReleaseCreditHoldRequest {
                hold_id,
                reason: format!("Saga compensation: {}", saga.saga_id),
            };

            self.credit_client
                .release_credit_hold(request)
                .await
                .map_err(|e| SagaError::CompensationFailed(SagaStep::CheckCredit, e.to_string()))?;
        }

        Ok(())
    }

    async fn compensate_reserve_inventory(&self, saga: &OrderToCashSaga) -> Result<(), SagaError> {
        let reserve_result = saga.get_step_result(SagaStep::ReserveInventory)
            .ok_or_else(|| SagaError::CompensationFailed(SagaStep::ReserveInventory, "Reservation not found".to_string()))?;

        let reservation: ReserveInventoryResponse = serde_json::from_value(reserve_result.result.clone())?;

        let request = CancelInventoryReservationRequest {
            reservation_id: reservation.reservation_id,
            reason: format!("Saga compensation: {}", saga.saga_id),
        };

        self.materials_client
            .cancel_reservation(request)
            .await
            .map_err(|e| SagaError::CompensationFailed(SagaStep::ReserveInventory, e.to_string()))?;

        Ok(())
    }

    // ... 其他补偿步骤实现
}

impl OrderToCashSaga {
    fn record_step_success(&mut self, step: SagaStep, result: serde_json::Value) {
        self.steps_completed.push(SagaStepResult {
            step: step.clone(),
            status: StepStatus::Success,
            result,
            executed_at: Utc::now(),
            error: None,
        });
        self.current_step = step;
    }

    fn record_compensation_success(&mut self, step: SagaStep) {
        self.compensations_executed.push(SagaStepResult {
            step,
            status: StepStatus::Compensated,
            result: serde_json::Value::Null,
            executed_at: Utc::now(),
            error: None,
        });
    }

    fn get_step_result(&self, step: SagaStep) -> Option<&SagaStepResult> {
        self.steps_completed.iter().find(|r| r.step == step)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SagaError {
    #[error("Saga step {0:?} failed: {1}")]
    StepFailed(SagaStep, String),

    #[error("Saga compensation for step {0:?} failed: {1}")]
    CompensationFailed(SagaStep, String),

    #[error("Saga persistence failed: {0}")]
    PersistenceFailed(String),
}
```

#### 3.2.2 Saga状态持久化

```rust
// src/sagas/saga_store.rs

use sqlx::PgPool;

pub struct SagaStore {
    pool: PgPool,
}

impl SagaStore {
    pub async fn save(&self, saga: &OrderToCashSaga) -> Result<(), SagaError> {
        sqlx::query!(
            r#"
            INSERT INTO shared.saga_instances (
                saga_id, saga_type, status, current_step, payload, started_at, completed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (saga_id) DO UPDATE SET
                status = EXCLUDED.status,
                current_step = EXCLUDED.current_step,
                payload = EXCLUDED.payload,
                completed_at = EXCLUDED.completed_at,
                updated_at = NOW()
            "#,
            saga.saga_id,
            "OrderToCash",
            serde_json::to_value(&saga.status)?,
            serde_json::to_value(&saga.current_step)?,
            serde_json::to_value(saga)?,
            saga.started_at,
            saga.completed_at,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| SagaError::PersistenceFailed(e.to_string()))?;

        Ok(())
    }

    pub async fn load(&self, saga_id: Uuid) -> Result<OrderToCashSaga, SagaError> {
        let row = sqlx::query!(
            r#"
            SELECT payload FROM shared.saga_instances WHERE saga_id = $1
            "#,
            saga_id
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| SagaError::PersistenceFailed(e.to_string()))?;

        let saga: OrderToCashSaga = serde_json::from_value(row.payload)?;
        Ok(saga)
    }

    pub async fn list_pending_sagas(&self) -> Result<Vec<OrderToCashSaga>, SagaError> {
        let rows = sqlx::query!(
            r#"
            SELECT payload FROM shared.saga_instances
            WHERE status IN ('Started', 'InProgress', 'Compensating')
            AND started_at < NOW() - INTERVAL '5 minutes'
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| SagaError::PersistenceFailed(e.to_string()))?;

        let sagas = rows.into_iter()
            .filter_map(|row| serde_json::from_value(row.payload).ok())
            .collect();

        Ok(sagas)
    }
}

// 数据库表
CREATE TABLE IF NOT EXISTS shared.saga_instances (
    saga_id UUID PRIMARY KEY,
    saga_type VARCHAR(100) NOT NULL,
    status JSONB NOT NULL,
    current_step JSONB NOT NULL,
    payload JSONB NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    INDEX idx_saga_status (saga_type, status, started_at)
);
```

#### 3.2.3 Saga恢复机制（处理崩溃）

```rust
// src/sagas/saga_recovery.rs

/// Saga恢复服务
/// 定期扫描未完成的Saga并恢复执行
pub struct SagaRecoveryService {
    saga_store: Arc<SagaStore>,
    orchestrator: Arc<OrderToCashSagaOrchestrator>,
}

impl SagaRecoveryService {
    pub async fn start(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(60));

        loop {
            interval.tick().await;

            if let Err(e) = self.recover_pending_sagas().await {
                tracing::error!("Failed to recover pending sagas: {}", e);
            }
        }
    }

    async fn recover_pending_sagas(&self) -> Result<(), SagaError> {
        let pending_sagas = self.saga_store.list_pending_sagas().await?;

        tracing::info!("Found {} pending sagas to recover", pending_sagas.len());

        for saga in pending_sagas {
            tracing::info!("Recovering saga {}", saga.saga_id);

            match saga.status {
                SagaStatus::Started | SagaStatus::InProgress => {
                    // 继续执行
                    if let Err(e) = self.orchestrator.execute(saga.clone()).await {
                        tracing::error!("Failed to recover saga {}: {}", saga.saga_id, e);
                    }
                }
                SagaStatus::Compensating => {
                    // 继续补偿
                    let mut saga_mut = saga.clone();
                    if let Err(e) = self.orchestrator.compensate(&mut saga_mut).await {
                        tracing::error!("Failed to compensate saga {}: {}", saga.saga_id, e);
                    } else {
                        saga_mut.status = SagaStatus::Compensated;
                        self.saga_store.save(&saga_mut).await?;
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }
}
```

### 3.3 Saga超时与重试策略

```rust
// src/sagas/saga_config.rs

pub struct SagaConfig {
    /// 单个步骤超时时间
    pub step_timeout: Duration,

    /// 重试次数
    pub max_retries: u32,

    /// 重试退避策略
    pub retry_backoff: RetryBackoff,

    /// Saga整体超时时间
    pub saga_timeout: Duration,
}

impl Default for SagaConfig {
    fn default() -> Self {
        Self {
            step_timeout: Duration::from_secs(30),
            max_retries: 3,
            retry_backoff: RetryBackoff::Exponential {
                initial_delay: Duration::from_secs(1),
                max_delay: Duration::from_secs(60),
                multiplier: 2.0,
            },
            saga_timeout: Duration::from_secs(300),  // 5分钟
        }
    }
}

pub enum RetryBackoff {
    Fixed(Duration),
    Exponential {
        initial_delay: Duration,
        max_delay: Duration,
        multiplier: f64,
    },
}

// 在协调器中应用重试
impl OrderToCashSagaOrchestrator {
    async fn execute_with_retry<F, T>(
        &self,
        step: SagaStep,
        f: F,
    ) -> Result<T, SagaError>
    where
        F: Fn() -> BoxFuture<'static, Result<T, SagaError>>,
    {
        let mut retries = 0;
        let mut backoff = self.config.retry_backoff.initial_delay();

        loop {
            match tokio::time::timeout(self.config.step_timeout, f()).await {
                Ok(Ok(result)) => return Ok(result),
                Ok(Err(e)) if retries < self.config.max_retries => {
                    tracing::warn!(
                        "Saga step {:?} failed (attempt {}/{}): {}. Retrying in {:?}",
                        step, retries + 1, self.config.max_retries, e, backoff
                    );

                    tokio::time::sleep(backoff).await;

                    retries += 1;
                    backoff = self.config.retry_backoff.next_delay(backoff);
                }
                Ok(Err(e)) => {
                    tracing::error!("Saga step {:?} failed after {} retries: {}", step, retries, e);
                    return Err(e);
                }
                Err(_) => {
                    tracing::error!("Saga step {:?} timed out after {:?}", step, self.config.step_timeout);
                    return Err(SagaError::StepFailed(step, "Timeout".to_string()));
                }
            }
        }
    }
}
```

---

## 四、安全加固详细方案

### 4.1 身份认证与授权

#### 4.1.1 JWT Token 实现

```rust
// src/infrastructure/auth/jwt.rs

use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use chrono::{Duration, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (用户ID)
    pub sub: String,

    /// Issued at (签发时间)
    pub iat: i64,

    /// Expiration time (过期时间)
    pub exp: i64,

    /// Issuer (签发者)
    pub iss: String,

    /// Audience (受众)
    pub aud: String,

    /// 用户角色
    pub roles: Vec<String>,

    /// 租户ID（多租户）
    pub tenant_id: Option<String>,

    /// 额外声明
    pub permissions: Vec<String>,
}

pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    issuer: String,
    audience: String,
    access_token_expiry: Duration,
    refresh_token_expiry: Duration,
}

impl JwtManager {
    pub fn new(secret: &str, issuer: String, audience: String) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            issuer,
            audience,
            access_token_expiry: Duration::minutes(15),  // Access Token 15分钟
            refresh_token_expiry: Duration::days(7),     // Refresh Token 7天
        }
    }

    /// 生成 Access Token
    pub fn generate_access_token(&self, user_id: &str, roles: Vec<String>, tenant_id: Option<String>) -> Result<String, AuthError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            iat: now.timestamp(),
            exp: (now + self.access_token_expiry).timestamp(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
            roles,
            tenant_id,
            permissions: vec![],  // 可从数据库加载
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::TokenGenerationFailed(e.to_string()))
    }

    /// 生成 Refresh Token
    pub fn generate_refresh_token(&self, user_id: &str) -> Result<String, AuthError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            iat: now.timestamp(),
            exp: (now + self.refresh_token_expiry).timestamp(),
            iss: self.issuer.clone(),
            aud: format!("{}-refresh", self.audience),
            roles: vec![],
            tenant_id: None,
            permissions: vec![],
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::TokenGenerationFailed(e.to_string()))
    }

    /// 验证 Token
    pub fn validate_token(&self, token: &str) -> Result<Claims, AuthError> {
        let validation = Validation::default();

        decode::<Claims>(token, &self.decoding_key, &validation)
            .map(|data| data.claims)
            .map_err(|e| AuthError::InvalidToken(e.to_string()))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Token generation failed: {0}")]
    TokenGenerationFailed(String),

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,
}
```

#### 4.1.2 RBAC 授权中间件

```rust
// src/api/http/middleware/auth_middleware.rs

use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};

pub async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. 提取 Token
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 2. 验证 Token
    let claims = state.jwt_manager
        .validate_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // 3. 检查 Token 是否在黑名单中（Redis）
    let is_blacklisted = state.redis
        .exists::<bool>(&format!("token:blacklist:{}", token))
        .await
        .unwrap_or(false);

    if is_blacklisted {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 4. 将用户信息注入到请求扩展中
    request.extensions_mut().insert(AuthenticatedUser {
        user_id: claims.sub,
        roles: claims.roles,
        tenant_id: claims.tenant_id,
        permissions: claims.permissions,
    });

    Ok(next.run(request).await)
}

/// 权限检查中间件（装饰器模式）
pub fn require_permission(permission: &'static str) -> impl Fn(Request, Next) -> BoxFuture<'static, Result<Response, StatusCode>> + Clone {
    move |request: Request, next: Next| {
        Box::pin(async move {
            let user = request
                .extensions()
                .get::<AuthenticatedUser>()
                .ok_or(StatusCode::UNAUTHORIZED)?;

            if !user.has_permission(permission) {
                return Err(StatusCode::FORBIDDEN);
            }

            Ok(next.run(request).await)
        })
    }
}

#[derive(Clone, Debug)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub roles: Vec<String>,
    pub tenant_id: Option<String>,
    pub permissions: Vec<String>,
}

impl AuthenticatedUser {
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.iter().any(|p| p == permission)
    }

    pub fn has_any_permission(&self, permissions: &[&str]) -> bool {
        permissions.iter().any(|p| self.has_permission(p))
    }
}

// 使用示例
use axum::Router;

let app = Router::new()
    .route("/api/v1/financial/transactions", post(create_transaction))
    .layer(axum::middleware::from_fn_with_state(
        state.clone(),
        auth_middleware,
    ))
    .layer(axum::middleware::from_fn(
        require_permission("financial:transaction:create"),
    ));
```

#### 4.1.3 职责分离（SoD）检查

```rust
// src/domain/services/sod_check_service.rs

/// 职责分离规则
#[derive(Debug, Clone)]
pub struct SoDRule {
    pub rule_id: String,
    pub name: String,
    pub conflicting_permissions: Vec<String>,
    pub severity: SoDSeverity,
}

#[derive(Debug, Clone)]
pub enum SoDSeverity {
    Critical,  // 严重冲突，禁止
    High,      // 高风险，需要审批
    Medium,    // 中风险，记录告警
}

pub struct SoDCheckService {
    rules: Vec<SoDRule>,
}

impl SoDCheckService {
    pub fn new() -> Self {
        Self {
            rules: vec![
                // 财务职责分离规则
                SoDRule {
                    rule_id: "FIN-SOD-001".to_string(),
                    name: "采购订单创建者不能审批".to_string(),
                    conflicting_permissions: vec![
                        "purchasing:po:create".to_string(),
                        "purchasing:po:approve".to_string(),
                    ],
                    severity: SoDSeverity::Critical,
                },
                SoDRule {
                    rule_id: "FIN-SOD-002".to_string(),
                    name: "出纳不能记账".to_string(),
                    conflicting_permissions: vec![
                        "financial:payment:execute".to_string(),
                        "financial:transaction:post".to_string(),
                    ],
                    severity: SoDSeverity::Critical,
                },
                SoDRule {
                    rule_id: "FIN-SOD-003".to_string(),
                    name: "主数据创建者不能审批".to_string(),
                    conflicting_permissions: vec![
                        "mdg:vendor:create".to_string(),
                        "mdg:vendor:approve".to_string(),
                    ],
                    severity: SoDSeverity::Critical,
                },
                // 库存职责分离规则
                SoDRule {
                    rule_id: "INV-SOD-001".to_string(),
                    name: "收货人不能进行发票校验".to_string(),
                    conflicting_permissions: vec![
                        "materials:goods_receipt:post".to_string(),
                        "materials:invoice:verify".to_string(),
                    ],
                    severity: SoDSeverity::High,
                },
            ],
        }
    }

    /// 检查用户权限是否违反 SoD 规则
    pub fn check_user_permissions(&self, permissions: &[String]) -> Vec<SoDViolation> {
        let mut violations = Vec::new();

        for rule in &self.rules {
            let has_conflicts: Vec<_> = rule.conflicting_permissions
                .iter()
                .filter(|p| permissions.contains(p))
                .collect();

            if has_conflicts.len() > 1 {
                violations.push(SoDViolation {
                    rule_id: rule.rule_id.clone(),
                    rule_name: rule.name.clone(),
                    conflicting_permissions: has_conflicts.into_iter().cloned().collect(),
                    severity: rule.severity.clone(),
                });
            }
        }

        violations
    }

    /// 检查角色分配是否违反 SoD 规则
    pub async fn check_role_assignment(
        &self,
        user_id: &str,
        new_role: &str,
        existing_roles: &[String],
    ) -> Result<(), SoDViolation> {
        // 获取新角色的权限
        let new_permissions = self.get_role_permissions(new_role).await?;

        // 获取现有角色的权限
        let mut all_permissions: Vec<String> = Vec::new();
        for role in existing_roles {
            let perms = self.get_role_permissions(role).await?;
            all_permissions.extend(perms);
        }
        all_permissions.extend(new_permissions);

        // 检查冲突
        let violations = self.check_user_permissions(&all_permissions);

        if let Some(critical) = violations.iter().find(|v| matches!(v.severity, SoDSeverity::Critical)) {
            return Err(critical.clone());
        }

        Ok(())
    }

    async fn get_role_permissions(&self, role: &str) -> Result<Vec<String>, SoDError> {
        // 从数据库查询角色权限
        // 这里简化处理
        Ok(vec![])
    }
}

#[derive(Debug, Clone)]
pub struct SoDViolation {
    pub rule_id: String,
    pub rule_name: String,
    pub conflicting_permissions: Vec<String>,
    pub severity: SoDSeverity,
}
```

### 4.2 数据加密

#### 4.2.1 字段级加密（敏感数据）

```rust
// src/infrastructure/encryption/field_encryption.rs

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{Engine as _, engine::general_purpose};

pub struct FieldEncryption {
    cipher: Aes256Gcm,
}

impl FieldEncryption {
    pub fn new(key: &[u8; 32]) -> Self {
        let cipher = Aes256Gcm::new(key.into());
        Self { cipher }
    }

    /// 加密字段
    pub fn encrypt(&self, plaintext: &str) -> Result<String, EncryptionError> {
        let nonce = Nonce::from_slice(b"unique nonce");  // 实际应用中应使用随机nonce

        let ciphertext = self.cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // Base64编码
        Ok(general_purpose::STANDARD.encode(ciphertext))
    }

    /// 解密字段
    pub fn decrypt(&self, ciphertext: &str) -> Result<String, EncryptionError> {
        let nonce = Nonce::from_slice(b"unique nonce");

        // Base64解码
        let ciphertext_bytes = general_purpose::STANDARD
            .decode(ciphertext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        let plaintext = self.cipher
            .decrypt(nonce, ciphertext_bytes.as_ref())
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        String::from_utf8(plaintext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))
    }
}

// 数据库存储示例
#[derive(Debug)]
pub struct Employee {
    pub employee_id: Uuid,
    pub name: String,
    pub email: String,

    // 敏感字段（加密存储）
    pub ssn: String,              // 社会保障号（加密）
    pub bank_account: String,     // 银行账号（加密）
    pub salary: Decimal,          // 薪资（加密）
}

impl Employee {
    pub fn encrypt_sensitive_fields(&mut self, encryption: &FieldEncryption) -> Result<(), EncryptionError> {
        self.ssn = encryption.encrypt(&self.ssn)?;
        self.bank_account = encryption.encrypt(&self.bank_account)?;
        self.salary = encryption.encrypt(&self.salary.to_string())?.parse().unwrap();
        Ok(())
    }

    pub fn decrypt_sensitive_fields(&mut self, encryption: &FieldEncryption) -> Result<(), EncryptionError> {
        self.ssn = encryption.decrypt(&self.ssn)?;
        self.bank_account = encryption.decrypt(&self.bank_account)?;
        self.salary = encryption.decrypt(&self.salary.to_string())?.parse().unwrap();
        Ok(())
    }
}
```

#### 4.2.2 密钥管理（HashiCorp Vault 集成）

```rust
// src/infrastructure/vault/vault_client.rs

use vaultrs::{client::VaultClient, kv2};

pub struct VaultManager {
    client: VaultClient,
    mount: String,
}

impl VaultManager {
    pub async fn new(vault_addr: &str, token: &str, mount: String) -> Result<Self, VaultError> {
        let client = VaultClient::new(
            VaultClientSettingsBuilder::default()
                .address(vault_addr)
                .token(token)
                .build()?,
        )?;

        Ok(Self { client, mount })
    }

    /// 获取加密密钥
    pub async fn get_encryption_key(&self, key_name: &str) -> Result<Vec<u8>, VaultError> {
        let secret: HashMap<String, String> = kv2::read(&self.client, &self.mount, key_name).await?;

        let key_base64 = secret
            .get("key")
            .ok_or_else(|| VaultError::KeyNotFound(key_name.to_string()))?;

        general_purpose::STANDARD
            .decode(key_base64)
            .map_err(|e| VaultError::InvalidKey(e.to_string()))
    }

    /// 获取数据库凭证
    pub async fn get_database_credentials(&self, db_name: &str) -> Result<DatabaseCredentials, VaultError> {
        let secret: HashMap<String, String> = kv2::read(&self.client, &self.mount, &format!("database/{}", db_name)).await?;

        Ok(DatabaseCredentials {
            username: secret.get("username").cloned().ok_or_else(|| VaultError::MissingField("username"))?,
            password: secret.get("password").cloned().ok_or_else(|| VaultError::MissingField("password"))?,
            host: secret.get("host").cloned().ok_or_else(|| VaultError::MissingField("host"))?,
            port: secret.get("port").and_then(|p| p.parse().ok()).ok_or_else(|| VaultError::MissingField("port"))?,
        })
    }

    /// 轮换密钥
    pub async fn rotate_encryption_key(&self, key_name: &str) -> Result<Vec<u8>, VaultError> {
        // 生成新密钥
        let new_key = Self::generate_random_key();

        // 存储到 Vault
        let mut data = HashMap::new();
        data.insert("key", general_purpose::STANDARD.encode(&new_key));

        kv2::set(&self.client, &self.mount, key_name, &data).await?;

        Ok(new_key)
    }

    fn generate_random_key() -> Vec<u8> {
        use rand::RngCore;
        let mut key = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        key
    }
}

pub struct DatabaseCredentials {
    pub username: String,
    pub password: String,
    pub host: String,
    pub port: u16,
}
```

### 4.3 API 安全

#### 4.3.1 限流（Rate Limiting）

```rust
// src/api/http/middleware/rate_limit_middleware.rs

use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DashMapStateStore};
use std::num::NonZeroU32;

pub struct RateLimitMiddleware {
    limiter: RateLimiter<String, DashMapStateStore<String>, DefaultClock>,
}

impl RateLimitMiddleware {
    pub fn new(requests_per_minute: u32) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(requests_per_minute).unwrap());
        let limiter = RateLimiter::keyed(quota);

        Self { limiter }
    }

    pub async fn check(&self, key: &str) -> Result<(), RateLimitError> {
        self.limiter
            .check_key(&key.to_string())
            .map_err(|_| RateLimitError::TooManyRequests)?;

        Ok(())
    }
}

// Axum 中间件
pub async fn rate_limit_middleware(
    State(limiter): State<Arc<RateLimitMiddleware>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 从请求中提取限流键（用户ID、IP地址等）
    let user = request.extensions().get::<AuthenticatedUser>();
    let key = user
        .map(|u| u.user_id.clone())
        .unwrap_or_else(|| {
            // 未认证用户使用IP地址
            request
                .headers()
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("unknown")
                .to_string()
        });

    limiter
        .check(&key)
        .await
        .map_err(|_| StatusCode::TOO_MANY_REQUESTS)?;

    Ok(next.run(request).await)
}

// 分层限流策略
pub struct TieredRateLimiter {
    anonymous: RateLimitMiddleware,      // 匿名用户：10 req/min
    authenticated: RateLimitMiddleware,  // 认证用户：100 req/min
    premium: RateLimitMiddleware,        // 高级用户：1000 req/min
}

impl TieredRateLimiter {
    pub fn new() -> Self {
        Self {
            anonymous: RateLimitMiddleware::new(10),
            authenticated: RateLimitMiddleware::new(100),
            premium: RateLimitMiddleware::new(1000),
        }
    }

    pub async fn check(&self, user: Option<&AuthenticatedUser>, key: &str) -> Result<(), RateLimitError> {
        match user {
            None => self.anonymous.check(key).await,
            Some(u) if u.has_role("premium") => self.premium.check(key).await,
            Some(_) => self.authenticated.check(key).await,
        }
    }
}
```

#### 4.3.2 CSRF 防护

```rust
// src/api/http/middleware/csrf_middleware.rs

use axum::http::header::SET_COOKIE;

pub struct CsrfMiddleware {
    secret: String,
}

impl CsrfMiddleware {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    /// 生成 CSRF Token
    pub fn generate_token(&self, session_id: &str) -> String {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        type HmacSha256 = Hmac<Sha256>;

        let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(session_id.as_bytes());

        let result = mac.finalize();
        general_purpose::STANDARD.encode(result.into_bytes())
    }

    /// 验证 CSRF Token
    pub fn validate_token(&self, session_id: &str, token: &str) -> bool {
        let expected = self.generate_token(session_id);
        // 常量时间比较，防止时序攻击
        expected == token
    }
}

pub async fn csrf_middleware(
    State(csrf): State<Arc<CsrfMiddleware>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 对于非GET/HEAD/OPTIONS请求，验证CSRF Token
    if !matches!(request.method(), &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        let token = headers
            .get("X-CSRF-Token")
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::FORBIDDEN)?;

        let session_id = request
            .extensions()
            .get::<AuthenticatedUser>()
            .map(|u| u.user_id.clone())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if !csrf.validate_token(&session_id, token) {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    Ok(next.run(request).await)
}
```

#### 4.3.3 SQL 注入防护

所有数据库操作使用 **参数化查询**，永不拼接 SQL：

```rust
// ❌ 错误示例（SQL注入风险）
let sql = format!("SELECT * FROM users WHERE username = '{}'", username);

// ✅ 正确示例（参数化查询）
sqlx::query_as!(
    User,
    "SELECT * FROM users WHERE username = $1",
    username
)
.fetch_one(&pool)
.await?;
```

#### 4.3.4 XSS 防护

```rust
// 输出编码（使用 askama 模板引擎自动转义）
// templates/invoice.html
<div>
    <p>Customer Name: {{ customer_name }}</p>  <!-- 自动HTML转义 -->
</div>

// API 响应设置安全头
pub async fn security_headers_middleware(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;

    response.headers_mut().insert(
        "X-Content-Type-Options",
        "nosniff".parse().unwrap(),
    );
    response.headers_mut().insert(
        "X-Frame-Options",
        "DENY".parse().unwrap(),
    );
    response.headers_mut().insert(
        "X-XSS-Protection",
        "1; mode=block".parse().unwrap(),
    );
    response.headers_mut().insert(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'".parse().unwrap(),
    );

    response
}
```

### 4.4 审计日志

#### 4.4.1 审计日志记录

```rust
// src/infrastructure/audit/audit_logger.rs

#[derive(Debug, Serialize)]
pub struct AuditLog {
    pub audit_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: String,
    pub tenant_id: Option<String>,
    pub action: AuditAction,
    pub resource_type: String,
    pub resource_id: String,
    pub before_state: Option<serde_json::Value>,
    pub after_state: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub result: AuditResult,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
    Approve,
    Reject,
    Login,
    Logout,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum AuditResult {
    Success,
    Failure,
}

pub struct AuditLogger {
    pool: PgPool,
}

impl AuditLogger {
    pub async fn log(&self, log: AuditLog) -> Result<(), AuditError> {
        sqlx::query!(
            r#"
            INSERT INTO shared.audit_logs (
                audit_id, timestamp, user_id, tenant_id, action, resource_type, resource_id,
                before_state, after_state, ip_address, user_agent, result, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            log.audit_id,
            log.timestamp,
            log.user_id,
            log.tenant_id,
            serde_json::to_value(&log.action)?,
            log.resource_type,
            log.resource_id,
            log.before_state,
            log.after_state,
            log.ip_address,
            log.user_agent,
            serde_json::to_value(&log.result)?,
            log.error_message,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

// 审计日志表
CREATE TABLE shared.audit_logs (
    audit_id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255),
    action JSONB NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    result JSONB NOT NULL,
    error_message TEXT
) PARTITION BY RANGE (timestamp);

-- 按月分区
CREATE TABLE shared.audit_logs_2025_01 PARTITION OF shared.audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- 索引
CREATE INDEX idx_audit_logs_user ON shared.audit_logs (user_id, timestamp);
CREATE INDEX idx_audit_logs_resource ON shared.audit_logs (resource_type, resource_id);
```

---

## 五、监控告警详细配置

### 5.1 Prometheus 指标暴露

#### 5.1.1 业务指标定义

```rust
// src/infrastructure/observability/metrics.rs

use prometheus::{
    Counter, Histogram, HistogramOpts, IntCounter, IntGauge, Opts, Registry,
    labels, histogram_opts, register_counter, register_histogram, register_int_counter, register_int_gauge,
};
use once_cell::sync::Lazy;

// 全局 Registry
pub static REGISTRY: Lazy<Registry> = Lazy::new(Registry::new);

// HTTP 请求指标
pub static HTTP_REQUESTS_TOTAL: Lazy<Counter> = Lazy::new(|| {
    let opts = Opts::new("http_requests_total", "Total number of HTTP requests")
        .namespace("erp")
        .subsystem("api");
    register_counter!(opts, REGISTRY).unwrap()
});

pub static HTTP_REQUEST_DURATION_SECONDS: Lazy<Histogram> = Lazy::new(|| {
    let opts = histogram_opts!(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
    )
    .namespace("erp")
    .subsystem("api");
    register_histogram!(opts, REGISTRY).unwrap()
});

// 业务指标
pub static TRANSACTIONS_POSTED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let opts = Opts::new("transactions_posted_total", "Total number of posted transactions")
        .namespace("erp")
        .subsystem("financial");
    register_int_counter!(opts, REGISTRY).unwrap()
});

pub static SALES_ORDERS_CREATED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let opts = Opts::new("sales_orders_created_total", "Total number of sales orders created")
        .namespace("erp")
        .subsystem("sales");
    register_int_counter!(opts, REGISTRY).unwrap()
});

pub static INVENTORY_LEVEL: Lazy<IntGauge> = Lazy::new(|| {
    let opts = Opts::new("inventory_level", "Current inventory level")
        .namespace("erp")
        .subsystem("materials");
    register_int_gauge!(opts, REGISTRY).unwrap()
});

// Kafka 消费指标
pub static KAFKA_MESSAGES_CONSUMED_TOTAL: Lazy<Counter> = Lazy::new(|| {
    let opts = Opts::new("kafka_messages_consumed_total", "Total number of Kafka messages consumed")
        .namespace("erp")
        .subsystem("messaging");
    register_counter!(opts, REGISTRY).unwrap()
});

pub static KAFKA_CONSUMER_LAG: Lazy<IntGauge> = Lazy::new(|| {
    let opts = Opts::new("kafka_consumer_lag", "Kafka consumer lag")
        .namespace("erp")
        .subsystem("messaging");
    register_int_gauge!(opts, REGISTRY).unwrap()
});

// 数据库连接池指标
pub static DB_CONNECTIONS_ACTIVE: Lazy<IntGauge> = Lazy::new(|| {
    let opts = Opts::new("db_connections_active", "Number of active database connections")
        .namespace("erp")
        .subsystem("database");
    register_int_gauge!(opts, REGISTRY).unwrap()
});

pub static DB_QUERY_DURATION_SECONDS: Lazy<Histogram> = Lazy::new(|| {
    let opts = histogram_opts!(
        "db_query_duration_seconds",
        "Database query latency in seconds",
        vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
    )
    .namespace("erp")
    .subsystem("database");
    register_histogram!(opts, REGISTRY).unwrap()
});

// Saga 指标
pub static SAGA_EXECUTIONS_TOTAL: Lazy<Counter> = Lazy::new(|| {
    let opts = Opts::new("saga_executions_total", "Total number of saga executions")
        .namespace("erp")
        .subsystem("saga");
    register_counter!(opts, REGISTRY).unwrap()
});

pub static SAGA_COMPENSATIONS_TOTAL: Lazy<Counter> = Lazy::new(|| {
    let opts = Opts::new("saga_compensations_total", "Total number of saga compensations")
        .namespace("erp")
        .subsystem("saga");
    register_counter!(opts, REGISTRY).unwrap()
});
```

#### 5.1.2 指标收集中间件

```rust
// src/api/http/middleware/metrics_middleware.rs

pub async fn metrics_middleware(
    request: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    // 增加请求计数
    HTTP_REQUESTS_TOTAL.inc();

    // 执行请求
    let response = next.run(request).await;

    // 记录延迟
    let duration = start.elapsed().as_secs_f64();
    HTTP_REQUEST_DURATION_SECONDS
        .with_label_values(&[method.as_str(), &path, response.status().as_str()])
        .observe(duration);

    response
}

// 暴露 Prometheus 指标端点
pub async fn metrics_handler() -> impl IntoResponse {
    use prometheus::Encoder;

    let encoder = prometheus::TextEncoder::new();
    let metric_families = REGISTRY.gather();

    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", encoder.format_type())
        .body(buffer.into())
        .unwrap()
}

// 路由注册
let app = Router::new()
    .route("/metrics", get(metrics_handler))
    .layer(axum::middleware::from_fn(metrics_middleware));
```

### 5.2 Grafana Dashboard 配置

#### 5.2.1 财务服务 Dashboard（JSON）

```json
{
  "dashboard": {
    "title": "Financial Service Dashboard",
    "panels": [
      {
        "title": "Transaction Posting Rate",
        "targets": [
          {
            "expr": "rate(erp_financial_transactions_posted_total[5m])",
            "legendFormat": "Transactions/sec"
          }
        ],
        "type": "graph"
      },
      {
        "title": "API Latency (P99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(erp_api_http_request_duration_seconds_bucket{job=\"financial-service\"}[5m]))",
            "legendFormat": "P99 Latency"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(erp_api_http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx Errors/sec"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### 5.3 告警规则配置

#### 5.3.1 Prometheus 告警规则

```yaml
# prometheus/alerts/financial-service.yml

groups:
  - name: financial_service_alerts
    interval: 30s
    rules:
      # API 延迟告警
      - alert: HighAPILatency
        expr: histogram_quantile(0.99, rate(erp_api_http_request_duration_seconds_bucket{job="financial-service"}[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
          service: financial-service
        annotations:
          summary: "High API latency on {{ $labels.instance }}"
          description: "P99 latency is {{ $value }}s (threshold: 0.5s)"

      # 错误率告警
      - alert: HighErrorRate
        expr: rate(erp_api_http_requests_total{status=~"5..",job="financial-service"}[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
          service: financial-service
        annotations:
          summary: "High error rate on {{ $labels.instance }}"
          description: "Error rate is {{ $value }} req/s"

      # 数据库连接池耗尽
      - alert: DatabaseConnectionPoolExhausted
        expr: erp_database_db_connections_active / erp_database_db_connections_max > 0.9
        for: 1m
        labels:
          severity: warning
          service: financial-service
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections in use"

      # Kafka 消费延迟
      - alert: KafkaConsumerLag
        expr: erp_messaging_kafka_consumer_lag > 1000
        for: 5m
        labels:
          severity: warning
          service: financial-service
        annotations:
          summary: "Kafka consumer lag is high"
          description: "Lag is {{ $value }} messages"

      # Saga 补偿率过高
      - alert: HighSagaCompensationRate
        expr: rate(erp_saga_saga_compensations_total[5m]) / rate(erp_saga_saga_executions_total[5m]) > 0.1
        for: 10m
        labels:
          severity: critical
          service: financial-service
        annotations:
          summary: "High saga compensation rate"
          description: "{{ $value | humanizePercentage }} of sagas are being compensated"
```

#### 5.3.2 AlertManager 配置

```yaml
# alertmanager/config.yml

global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/xxx'

route:
  group_by: ['alertname', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'

  routes:
    # 严重告警发送到 PagerDuty
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true

    # 所有告警发送到 Slack
    - receiver: 'slack'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#erp-alerts'
        title: 'ERP Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'xxx'
        description: '{{ .CommonAnnotations.summary }}'

  - name: 'slack'
    slack_configs:
      - channel: '#erp-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}'
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
```

### 5.4 分布式追踪（Jaeger）

#### 5.4.1 OpenTelemetry 集成

```rust
// src/infrastructure/observability/tracing.rs

use opentelemetry::{
    global,
    sdk::{
        export::trace::stdout,
        propagation::TraceContextPropagator,
        trace::{self, RandomIdGenerator, Sampler},
        Resource,
    },
    KeyValue,
};
use opentelemetry_jaeger::new_agent_pipeline;
use tracing_subscriber::{layer::SubscriberExt, Registry};

pub fn init_tracing(service_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    global::set_text_map_propagator(TraceContextPropagator::new());

    let tracer = new_agent_pipeline()
        .with_service_name(service_name)
        .with_auto_split_batch(true)
        .with_max_packet_size(65000)
        .install_batch(opentelemetry::runtime::Tokio)?;

    let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);

    let subscriber = Registry::default()
        .with(telemetry)
        .with(tracing_subscriber::fmt::layer());

    tracing::subscriber::set_global_default(subscriber)?;

    Ok(())
}

// 在服务启动时初始化
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing("financial-service")?;

    // ... 启动服务

    Ok(())
}
```

#### 5.4.2 自定义 Span

```rust
use tracing::{info, instrument, Span};

#[instrument(skip(pool))]
pub async fn create_transaction(
    pool: &PgPool,
    command: CreateTransactionCommand,
) -> Result<Transaction, DomainError> {
    let span = Span::current();

    span.record("transaction.company_code", &command.company_code.as_str());
    span.record("transaction.fiscal_year", &command.fiscal_year);

    info!("Creating transaction");

    // 业务逻辑
    let transaction = Transaction::create(command)?;

    // 持久化
    let saved = save_transaction(pool, &transaction).await?;

    span.record("transaction.id", &saved.id.to_string().as_str());
    info!("Transaction created successfully");

    Ok(saved)
}
```

---

## 六、测试策略详细方案

### 6.1 单元测试

#### 6.1.1 领域层单元测试示例

```rust
// src/domain/aggregates/transaction.rs

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal_macros::dec;

    #[test]
    fn test_create_transaction_success() {
        // Arrange
        let command = CreateTransactionCommand {
            idempotency_key: Uuid::new_v4(),
            posting_date: NaiveDate::from_ymd_opt(2025, 12, 22).unwrap(),
            document_date: NaiveDate::from_ymd_opt(2025, 12, 20).unwrap(),
            company_code: "1000".to_string(),
            fiscal_year: 2025,
            journal_entries: vec![
                JournalEntry {
                    account_number: "100000".to_string(),
                    debit_amount: dec!(10000.00),
                    credit_amount: dec!(0.00),
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
                JournalEntry {
                    account_number: "200000".to_string(),
                    debit_amount: dec!(0.00),
                    credit_amount: dec!(10000.00),
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
            ],
        };

        // Act
        let result = Transaction::create(command);

        // Assert
        assert!(result.is_ok());
        let transaction = result.unwrap();
        assert_eq!(transaction.status, TransactionStatus::Draft);
        assert_eq!(transaction.journal_entries.len(), 2);
    }

    #[test]
    fn test_create_transaction_unbalanced_fails() {
        // Arrange
        let command = CreateTransactionCommand {
            idempotency_key: Uuid::new_v4(),
            posting_date: NaiveDate::from_ymd_opt(2025, 12, 22).unwrap(),
            document_date: NaiveDate::from_ymd_opt(2025, 12, 20).unwrap(),
            company_code: "1000".to_string(),
            fiscal_year: 2025,
            journal_entries: vec![
                JournalEntry {
                    account_number: "100000".to_string(),
                    debit_amount: dec!(10000.00),
                    credit_amount: dec!(0.00),
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
                JournalEntry {
                    account_number: "200000".to_string(),
                    debit_amount: dec!(0.00),
                    credit_amount: dec!(5000.00),  // 不平衡!
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
            ],
        };

        // Act
        let result = Transaction::create(command);

        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DomainError::TransactionUnbalanced { .. }));
    }

    #[test]
    fn test_post_transaction_success() {
        // Arrange
        let mut transaction = create_test_transaction();

        // Act
        let result = transaction.post();

        // Assert
        assert!(result.is_ok());
        assert_eq!(transaction.status, TransactionStatus::Posted);
        assert!(transaction.posted_at.is_some());
    }

    fn create_test_transaction() -> Transaction {
        Transaction {
            transaction_id: Uuid::new_v4(),
            transaction_number: "FI-2025-0001".to_string(),
            posting_date: NaiveDate::from_ymd_opt(2025, 12, 22).unwrap(),
            document_date: NaiveDate::from_ymd_opt(2025, 12, 20).unwrap(),
            company_code: "1000".to_string(),
            fiscal_year: 2025,
            status: TransactionStatus::Draft,
            journal_entries: vec![
                JournalEntry {
                    account_number: "100000".to_string(),
                    debit_amount: dec!(10000.00),
                    credit_amount: dec!(0.00),
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
                JournalEntry {
                    account_number: "200000".to_string(),
                    debit_amount: dec!(0.00),
                    credit_amount: dec!(10000.00),
                    currency: "USD".to_string(),
                    cost_center: None,
                    profit_center: None,
                },
            ],
            created_at: Utc::now(),
            created_by: "test_user".to_string(),
            posted_at: None,
        }
    }
}
```

### 6.2 集成测试

#### 6.2.1 数据库集成测试

```rust
// tests/integration/financial/transaction_repository_test.rs

use sqlx::PgPool;
use testcontainers::*;

#[tokio::test]
async fn test_save_and_load_transaction() {
    // 启动测试容器
    let docker = clients::Cli::default();
    let postgres = docker.run(images::postgres::Postgres::default());
    let connection_string = format!(
        "postgresql://postgres:postgres@localhost:{}/postgres",
        postgres.get_host_port_ipv4(5432)
    );

    // 创建连接池
    let pool = PgPool::connect(&connection_string).await.unwrap();

    // 运行迁移
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .unwrap();

    // 创建仓储
    let repo = TransactionRepository::new(pool.clone());

    // 测试数据
    let transaction = create_test_transaction();

    // Act: 保存
    repo.save(&transaction).await.unwrap();

    // Act: 加载
    let loaded = repo.find_by_id(transaction.transaction_id).await.unwrap();

    // Assert
    assert_eq!(loaded.transaction_number, transaction.transaction_number);
    assert_eq!(loaded.journal_entries.len(), transaction.journal_entries.len());
}
```

### 6.3 契约测试（Pact）

```rust
// tests/contract/sales_to_materials_contract_test.rs

use pact_consumer::prelude::*;
use pact_consumer::*;

#[tokio::test]
async fn test_reserve_inventory_contract() {
    // 定义契约
    let pact = PactBuilder::new("sales-service", "materials-service")
        .interaction("reserve inventory", |mut i| {
            i.request
                .post()
                .path("/api/v1/materials/reservations")
                .header("Content-Type", "application/json")
                .json_body(json_pattern!({
                    "idempotency_key": like!("550e8400-e29b-41d4-a716-446655440000"),
                    "order_id": like!("660e8400-e29b-41d4-a716-446655440000"),
                    "items": each_like!({
                        "material_id": like!("770e8400-e29b-41d4-a716-446655440000"),
                        "quantity": like!(10),
                        "plant": like!("1000")
                    })
                }));

            i.response
                .status(201)
                .header("Content-Type", "application/json")
                .json_body(json_pattern!({
                    "reservation_id": like!("880e8400-e29b-41d4-a716-446655440000"),
                    "status": like!("RESERVED")
                }));
        })
        .build();

    // 启动 Mock Server
    let mock_server = pact.start_mock_server(None);

    // 调用客户端
    let client = MaterialsServiceClient::new(mock_server.url().as_str());
    let response = client
        .reserve_inventory(ReserveInventoryRequest {
            idempotency_key: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            order_id: Uuid::parse_str("660e8400-e29b-41d4-a716-446655440000").unwrap(),
            items: vec![ReserveInventoryItem {
                material_id: Uuid::parse_str("770e8400-e29b-41d4-a716-446655440000").unwrap(),
                quantity: 10,
                plant: "1000".to_string(),
            }],
        })
        .await
        .unwrap();

    // 断言
    assert_eq!(response.status, "RESERVED");

    // 验证契约
    mock_server.verify().unwrap();
}
```

### 6.4 端到端测试

```rust
// tests/e2e/order_to_cash_e2e_test.rs

#[tokio::test]
async fn test_complete_order_to_cash_flow() {
    // Setup: 启动所有服务（或使用Docker Compose）
    let services = start_all_services().await;

    // Step 1: 创建销售订单
    let order_response = services.sales_client
        .create_order(CreateSalesOrderRequest {
            customer_id: test_customer_id(),
            items: vec![
                OrderItem {
                    material_id: test_material_id(),
                    quantity: 10,
                    unit_price: dec!(100.00),
                }
            ],
        })
        .await
        .expect("Failed to create sales order");

    assert_eq!(order_response.status, "CREATED");

    // Step 2: 验证信用检查通过
    tokio::time::sleep(Duration::from_secs(1)).await;  // 等待异步处理
    let credit_check = services.credit_client
        .get_credit_check_status(order_response.order_id)
        .await
        .expect("Failed to get credit check status");

    assert_eq!(credit_check.status, "APPROVED");

    // Step 3: 验证库存预留
    let reservation = services.materials_client
        .get_reservation_by_order(order_response.order_id)
        .await
        .expect("Failed to get reservation");

    assert_eq!(reservation.status, "RESERVED");

    // Step 4: 创建交付
    let delivery_response = services.warehouse_client
        .create_delivery(CreateDeliveryRequest {
            order_id: order_response.order_id,
        })
        .await
        .expect("Failed to create delivery");

    // Step 5: 创建发货
    let shipment_response = services.transport_client
        .create_shipment(CreateShipmentRequest {
            delivery_id: delivery_response.delivery_id,
        })
        .await
        .expect("Failed to create shipment");

    // Step 6: 创建发票
    let invoice_response = services.sales_client
        .create_invoice(CreateInvoiceRequest {
            order_id: order_response.order_id,
        })
        .await
        .expect("Failed to create invoice");

    // Step 7: 验证应收账款创建
    tokio::time::sleep(Duration::from_secs(1)).await;
    let receivable = services.financial_client
        .get_receivable_by_invoice(invoice_response.invoice_id)
        .await
        .expect("Failed to get receivable");

    assert_eq!(receivable.status, "OPEN");
    assert_eq!(receivable.amount, dec!(1000.00));  // 10 * 100

    // Cleanup
    cleanup_test_data().await;
}
```

---

继续补充剩余章节（第7-10章）？
## 七、Kubernetes部署配置

### 7.1 服务 Deployment 配置

#### 7.1.1 Financial Service Deployment

```yaml
# kubernetes/deployments/financial-service.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: financial-service
  namespace: erp
  labels:
    app: financial-service
    version: v1.0.0
spec:
  replicas: 3
  revisionHistoryLimit: 10
  selector:
    matchLabels:
      app: financial-service
  template:
    metadata:
      labels:
        app: financial-service
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: financial-service
      containers:
      - name: financial-service
        image: ghcr.io/erp/financial-service:v1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        - name: grpc
          containerPort: 50051
          protocol: TCP
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: financial-db-credentials
              key: connection_string
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        - name: KAFKA_BROKERS
          value: "kafka-0.kafka:9092,kafka-1.kafka:9092,kafka-2.kafka:9092"
        - name: RUST_LOG
          value: "info,financial_service=debug"
        - name: JAEGER_AGENT_HOST
          value: "jaeger-agent.observability"
        - name: JAEGER_AGENT_PORT
          value: "6831"
        - name: VAULT_ADDR
          value: "http://vault.vault:8200"
        - name: VAULT_TOKEN
          valueFrom:
            secretKeyRef:
              name: vault-token
              key: token
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /etc/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: financial-service-config
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
                  - financial-service
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: financial-service
  namespace: erp
  labels:
    app: financial-service
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: grpc
    port: 50051
    targetPort: 50051
    protocol: TCP
  selector:
    app: financial-service

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: financial-service-hpa
  namespace: erp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: financial-service
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
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

### 7.2 ConfigMap 和 Secret

#### 7.2.1 ConfigMap

```yaml
# kubernetes/configmaps/financial-service-config.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: financial-service-config
  namespace: erp
data:
  config.yaml: |
    server:
      host: "0.0.0.0"
      port: 8080
      grpc_port: 50051
    
    database:
      max_connections: 20
      min_connections: 5
      connection_timeout: 30
    
    redis:
      pool_size: 10
      connection_timeout: 5
    
    kafka:
      consumer_group_id: "financial-service-consumer"
      auto_offset_reset: "earliest"
      enable_auto_commit: false
    
    observability:
      metrics_enabled: true
      tracing_enabled: true
      logging_level: "info"
```

#### 7.2.2 Secret

```yaml
# kubernetes/secrets/financial-db-credentials.yaml

apiVersion: v1
kind: Secret
metadata:
  name: financial-db-credentials
  namespace: erp
type: Opaque
stringData:
  connection_string: "postgresql://erp_user:CHANGE_ME@postgres-primary.database:5432/erp_financial"
  username: "erp_user"
  password: "CHANGE_ME"
```

### 7.3 StatefulSet（PostgreSQL、Redis、Kafka）

#### 7.3.1 PostgreSQL StatefulSet

```yaml
# kubernetes/statefulsets/postgres.yaml

apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: database
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16
        env:
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: password
        - name: PGDATA
          value: "/var/lib/postgresql/data/pgdata"
        ports:
        - name: postgres
          containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - postgres
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 100Gi

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: database
spec:
  clusterIP: None
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgres

---
apiVersion: v1
kind: Service
metadata:
  name: postgres-primary
  namespace: database
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: postgres
    role: primary
```

### 7.4 Istio 配置（Service Mesh）

#### 7.4.1 VirtualService

```yaml
# kubernetes/istio/financial-service-virtualservice.yaml

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: financial-service
  namespace: erp
spec:
  hosts:
  - financial-service
  http:
  - match:
    - headers:
        x-api-version:
          exact: v2
    route:
    - destination:
        host: financial-service
        subset: v2
      weight: 100
  - route:
    - destination:
        host: financial-service
        subset: v1
      weight: 90
    - destination:
        host: financial-service
        subset: v2
      weight: 10
    retries:
      attempts: 3
      perTryTimeout: 2s
      retryOn: 5xx,reset,connect-failure,refused-stream
    timeout: 10s

---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: financial-service
  namespace: erp
spec:
  host: financial-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
        maxRequestsPerConnection: 2
    loadBalancer:
      simple: LEAST_REQUEST
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 40
  subsets:
  - name: v1
    labels:
      version: v1.0.0
  - name: v2
    labels:
      version: v2.0.0
```

#### 7.4.2 Circuit Breaker

```yaml
# kubernetes/istio/financial-service-circuit-breaker.yaml

apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: financial-service-circuit-breaker
  namespace: erp
spec:
  host: financial-service
  trafficPolicy:
    outlierDetection:
      consecutiveGatewayErrors: 5
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

---

## 八、CI/CD Pipeline详细配置

### 8.1 GitHub Actions Workflow

#### 8.1.1 完整 CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches:
      - main
      - develop
    tags:
      - 'v*'
  pull_request:
    branches:
      - main
      - develop

env:
  CARGO_TERM_COLOR: always
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache Cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Format Check
        run: cargo fmt -- --check

      - name: Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings

  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
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
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run Database Migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
        run: |
          cargo install sqlx-cli --no-default-features --features postgres
          sqlx database create
          sqlx migrate run

      - name: Run Tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379
        run: cargo test --all-features --workspace

      - name: Code Coverage
        run: |
          cargo install cargo-tarpaulin
          cargo tarpaulin --all-features --workspace --timeout 300 --out Xml

      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./cobertura.xml
          fail_ci_if_error: false

  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cargo Audit
        run: |
          cargo install cargo-audit
          cargo audit

      - name: Dependency Check
        run: |
          cargo install cargo-deny
          cargo deny check

  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [lint, test, security-audit]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./services/financial-service/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.erp.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG_STAGING }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/financial-service \
            financial-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop \
            -n erp

          kubectl rollout status deployment/financial-service -n erp --timeout=5m

      - name: Run Smoke Tests
        run: |
          kubectl run smoke-test --rm -i --restart=Never --image=curlimages/curl -- \
            curl -f http://financial-service.erp/health/ready

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    environment:
      name: production
      url: https://erp.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG_PRODUCTION }}

      - name: Blue-Green Deployment
        run: |
          # 部署绿色环境
          kubectl apply -f kubernetes/deployments/financial-service-green.yaml

          # 等待绿色环境就绪
          kubectl rollout status deployment/financial-service-green -n erp --timeout=10m

          # 切换流量
          kubectl patch service financial-service -n erp -p \
            '{"spec":{"selector":{"version":"green"}}}'

          # 等待5分钟观察
          sleep 300

          # 检查错误率
          ERROR_RATE=$(kubectl exec -n observability prometheus-0 -- \
            promtool query instant 'rate(erp_api_http_requests_total{status=~"5..",job="financial-service"}[5m])')

          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate too high, rolling back..."
            kubectl patch service financial-service -n erp -p \
              '{"spec":{"selector":{"version":"blue"}}}'
            exit 1
          fi

          # 删除蓝色环境
          kubectl delete deployment financial-service-blue -n erp
```

### 8.2 Multi-stage Dockerfile

```dockerfile
# services/financial-service/Dockerfile

# Stage 1: Build
FROM rust:1.75-slim as builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./
COPY shared/ ./shared/
COPY services/financial-service/ ./services/financial-service/

# Build dependencies (cached layer)
RUN cargo build --release --package financial-service

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/financial-service /app/financial-service

# Copy migrations
COPY services/financial-service/migrations ./migrations

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080 50051

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health/ready || exit 1

CMD ["./financial-service"]
```

### 8.3 Helm Chart

```yaml
# helm/financial-service/Chart.yaml

apiVersion: v2
name: financial-service
description: Financial Service for ERP System
type: application
version: 1.0.0
appVersion: "1.0.0"
```

```yaml
# helm/financial-service/values.yaml

replicaCount: 3

image:
  repository: ghcr.io/erp/financial-service
  pullPolicy: IfNotPresent
  tag: "v1.0.0"

service:
  type: ClusterIP
  httpPort: 80
  grpcPort: 50051

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"

env:
  DATABASE_URL: "postgresql://erp_user:password@postgres:5432/erp_financial"
  REDIS_URL: "redis://redis:6379"
  KAFKA_BROKERS: "kafka-0:9092,kafka-1:9092,kafka-2:9092"
  RUST_LOG: "info"

configMap:
  data:
    config.yaml: |
      server:
        host: "0.0.0.0"
        port: 8080

istio:
  enabled: true
  virtualService:
    enabled: true
    gateways: []
    hosts:
      - financial-service
```

---

## 九、运维Runbook模板

### 9.1 故障排查手册

#### 9.1.1 服务不可用

```markdown
# Runbook: Financial Service 不可用

## 症状
- 健康检查失败
- HTTP 503 Service Unavailable
- Prometheus 告警：HighErrorRate

## 诊断步骤

### 1. 检查 Pod 状态
kubectl get pods -n erp -l app=financial-service

### 2. 查看 Pod 日志
kubectl logs -n erp deployment/financial-service --tail=100 --follow

### 3. 检查资源使用
kubectl top pods -n erp -l app=financial-service

### 4. 检查数据库连接
kubectl exec -it -n erp deployment/financial-service -- \
  psql $DATABASE_URL -c "SELECT 1"

### 5. 检查 Kafka 连接
kubectl exec -it -n erp deployment/financial-service -- \
  kafka-console-consumer --bootstrap-server $KAFKA_BROKERS --topic erp.financial.transactions --max-messages 1

## 常见原因与解决方案

### 原因 1: 数据库连接池耗尽
**症状**: 日志显示 "connection pool timeout"

**解决方案**:
# 临时扩容 Pod
kubectl scale deployment/financial-service -n erp --replicas=5

# 或增加数据库连接池大小（需要重新部署）
kubectl set env deployment/financial-service -n erp \
  DATABASE_MAX_CONNECTIONS=50

### 原因 2: 内存泄漏
**症状**: Pod 内存使用持续增长，最终 OOMKilled

**解决方案**:
# 重启 Pod
kubectl rollout restart deployment/financial-service -n erp

# 收集堆转储（如果可能）
kubectl exec -it -n erp deployment/financial-service -- \
  kill -USR1 $(pgrep financial-service)

### 原因 3: Kafka 消费者延迟
**症状**: Kafka 消费者滞后告警

**解决方案**:
# 检查消费者滞后
kubectl exec -it -n erp kafka-0 -- \
  kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group financial-service-consumer --describe

# 临时增加消费者副本
kubectl scale deployment/financial-service -n erp --replicas=6

## 升级路径
如果以上步骤无法解决，升级到 L2 支持：
- Slack: #erp-oncall
- PagerDuty: Financial Service 组
- 联系人: 开发者B (财务模块负责人)
```

### 9.2 数据库维护手册

```markdown
# Runbook: PostgreSQL 数据库维护

## 定期维护任务

### 每日任务（自动化）

#### 1. 备份数据库
# 通过 CronJob 自动执行
kubectl get cronjob -n database postgres-backup

# 手动触发备份
kubectl create job -n database --from=cronjob/postgres-backup manual-backup-$(date +%s)

#### 2. 检查备份状态
kubectl logs -n database job/postgres-backup-xxx

### 每周任务

#### 1. VACUUM ANALYZE
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "VACUUM ANALYZE;"

#### 2. 检查慢查询
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "
SELECT 
  query, 
  calls, 
  mean_exec_time, 
  max_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;"

#### 3. 检查表膨胀
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -f /scripts/check_bloat.sql

### 每月任务

#### 1. 分区表维护
# 创建下月分区
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "
CREATE TABLE financial.transactions_2025_02 
PARTITION OF financial.transactions 
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');"

# 删除过期分区（6个月前）
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "
DROP TABLE IF EXISTS financial.transactions_2024_07;"

#### 2. 索引维护
# 重建索引
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "REINDEX DATABASE erp_financial;"

## 应急操作

### 数据库恢复
# 从备份恢复
kubectl exec -it -n database postgres-0 -- \
  pg_restore -U postgres -d erp_financial /backups/erp_financial_2025-12-22.dump

### 主从切换
# 提升从库为主库
kubectl exec -it -n database postgres-1 -- \
  pg_ctl promote -D /var/lib/postgresql/data

# 更新服务指向新主库
kubectl label pod postgres-1 -n database role=primary --overwrite
kubectl label pod postgres-0 -n database role=replica --overwrite
```

### 9.3 性能调优手册

```markdown
# Runbook: 性能调优

## API 延迟优化

### 诊断步骤

#### 1. 确认延迟位置
# 检查 Jaeger 追踪
https://jaeger.erp.example.com/search?service=financial-service

#### 2. 分析慢查询
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC 
LIMIT 10;"

#### 3. 检查缓存命中率
# Redis 缓存命中率
kubectl exec -it -n erp deployment/financial-service -- \
  redis-cli --stat | grep hit_rate

### 优化措施

#### 1. 添加数据库索引
kubectl exec -it -n database postgres-0 -- \
  psql -U postgres -d erp_financial -c "
CREATE INDEX CONCURRENTLY idx_transactions_posting_date_company 
ON financial.transactions (posting_date, company_code);"

#### 2. 增加 Redis 缓存 TTL
kubectl set env deployment/financial-service -n erp \
  CACHE_TTL=3600

#### 3. 启用查询缓存
kubectl set env deployment/financial-service -n erp \
  ENABLE_QUERY_CACHE=true

## 吞吐量优化

### 水平扩容
kubectl scale deployment/financial-service -n erp --replicas=10

### 垂直扩容
kubectl set resources deployment/financial-service -n erp \
  --requests=cpu=1000m,memory=1Gi \
  --limits=cpu=4000m,memory=8Gi

### 数据库连接池调优
kubectl set env deployment/financial-service -n erp \
  DATABASE_MAX_CONNECTIONS=50 \
  DATABASE_MIN_CONNECTIONS=10
```

---

## 十、代码规范和最佳实践

### 10.1 Rust 代码规范

#### 10.1.1 命名规范

```rust
// 类型名称：大驼峰（PascalCase）
pub struct Transaction {}
pub enum TransactionStatus {}
pub trait Repository {}

// 函数和变量：小写下划线（snake_case）
pub fn create_transaction() {}
let transaction_id = Uuid::new_v4();

// 常量：大写下划线（SCREAMING_SNAKE_CASE）
const MAX_RETRY_ATTEMPTS: u32 = 3;
const DEFAULT_PAGE_SIZE: usize = 20;

// 模块：小写下划线（snake_case）
mod transaction_repository;
mod value_objects;

// Trait 实现：避免孤儿规则
// ✅ 好的做法：在本地类型上实现外部 Trait
impl Display for Transaction {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        write!(f, "Transaction({})", self.transaction_number)
    }
}

// ❌ 坏的做法：在外部类型上实现外部 Trait（孤儿规则）
// impl Display for Uuid {}  // 编译错误!
```

#### 10.1.2 错误处理

```rust
// 使用 thiserror 定义错误类型
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Transaction is not balanced: debit={debit}, credit={credit}")]
    TransactionUnbalanced {
        debit: Decimal,
        credit: Decimal,
    },

    #[error("Account not found: {account_number}")]
    AccountNotFound {
        account_number: String,
    },

    #[error("Invalid fiscal period: {period}")]
    InvalidFiscalPeriod {
        period: i32,
    },

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

// 使用 Result 传播错误
pub fn post_transaction(transaction: &mut Transaction) -> Result<(), DomainError> {
    // 验证业务规则
    if !transaction.is_balanced() {
        return Err(DomainError::TransactionUnbalanced {
            debit: transaction.total_debit(),
            credit: transaction.total_credit(),
        });
    }

    // 更新状态
    transaction.status = TransactionStatus::Posted;
    transaction.posted_at = Some(Utc::now());

    Ok(())
}

// 使用 ? 操作符简化错误传播
pub async fn save_transaction(
    pool: &PgPool,
    transaction: &Transaction,
) -> Result<(), DomainError> {
    sqlx::query!(
        "INSERT INTO transactions (...) VALUES (...)",
        // ...
    )
    .execute(pool)
    .await?;  // 自动转换为 DomainError::DatabaseError

    Ok(())
}
```

#### 10.1.3 文档注释

```rust
/// 财务凭证聚合根
///
/// 代表一个完整的财务交易，包含多个分录。
/// 凭证必须满足借贷平衡原则。
///
/// # 示例
///
/// ```rust
/// use financial_service::domain::Transaction;
///
/// let mut transaction = Transaction::create(command)?;
/// transaction.post()?;
/// ```
pub struct Transaction {
    /// 凭证唯一标识
    pub transaction_id: Uuid,

    /// 凭证编号（业务主键）
    ///
    /// 格式: FI-{年度}-{序号}
    /// 示例: FI-2025-0001234
    pub transaction_number: String,

    // ...
}

impl Transaction {
    /// 创建新的财务凭证
    ///
    /// # 参数
    ///
    /// * `command` - 创建凭证命令
    ///
    /// # 返回
    ///
    /// * `Ok(Transaction)` - 创建成功
    /// * `Err(DomainError)` - 创建失败（借贷不平衡、无效数据等）
    ///
    /// # 示例
    ///
    /// ```rust
    /// let command = CreateTransactionCommand {
    ///     posting_date: NaiveDate::from_ymd(2025, 12, 22),
    ///     // ...
    /// };
    /// let transaction = Transaction::create(command)?;
    /// ```
    pub fn create(command: CreateTransactionCommand) -> Result<Self, DomainError> {
        // 实现...
    }
}
```

### 10.2 DDD 最佳实践

#### 10.2.1 聚合根设计

```rust
// 聚合根：封装业务逻辑，维护不变量
pub struct Transaction {
    // 私有字段，只能通过方法访问
    transaction_id: Uuid,
    transaction_number: String,
    status: TransactionStatus,
    journal_entries: Vec<JournalEntry>,
    // ...

    // 领域事件
    uncommitted_events: Vec<DomainEvent>,
}

impl Transaction {
    // 工厂方法：创建聚合根
    pub fn create(command: CreateTransactionCommand) -> Result<Self, DomainError> {
        // 验证业务规则
        Self::validate_balance(&command.journal_entries)?;

        let transaction = Self {
            transaction_id: Uuid::new_v4(),
            transaction_number: Self::generate_transaction_number(),
            status: TransactionStatus::Draft,
            journal_entries: command.journal_entries,
            uncommitted_events: vec![],
        };

        // 发布领域事件
        transaction.add_event(TransactionCreated {
            transaction_id: transaction.transaction_id,
            transaction_number: transaction.transaction_number.clone(),
        });

        Ok(transaction)
    }

    // 命令方法：改变状态
    pub fn post(&mut self) -> Result<(), DomainError> {
        // 验证前置条件
        if self.status != TransactionStatus::Draft {
            return Err(DomainError::InvalidStatus);
        }

        // 再次验证业务规则
        Self::validate_balance(&self.journal_entries)?;

        // 改变状态
        self.status = TransactionStatus::Posted;
        self.posted_at = Some(Utc::now());

        // 发布领域事件
        self.add_event(TransactionPosted {
            transaction_id: self.transaction_id,
        });

        Ok(())
    }

    // 查询方法：不改变状态
    pub fn is_balanced(&self) -> bool {
        let total_debit: Decimal = self.journal_entries.iter()
            .map(|e| e.debit_amount)
            .sum();
        let total_credit: Decimal = self.journal_entries.iter()
            .map(|e| e.credit_amount)
            .sum();

        (total_debit - total_credit).abs() < Decimal::new(1, 2)  // 0.01
    }

    // 私有方法：封装业务规则
    fn validate_balance(entries: &[JournalEntry]) -> Result<(), DomainError> {
        // 实现...
    }

    fn generate_transaction_number() -> String {
        // 实现...
    }

    fn add_event(&mut self, event: impl Into<DomainEvent>) {
        self.uncommitted_events.push(event.into());
    }

    // 获取未提交的事件（用于事件发布）
    pub fn take_uncommitted_events(&mut self) -> Vec<DomainEvent> {
        std::mem::take(&mut self.uncommitted_events)
    }
}
```

#### 10.2.2 值对象设计

```rust
// 值对象：不可变、无标识、可替换
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Money {
    amount: Decimal,
    currency: String,
}

impl Money {
    // 构造函数：验证不变量
    pub fn new(amount: Decimal, currency: impl Into<String>) -> Result<Self, DomainError> {
        let currency = currency.into();

        // 验证货币代码
        if !Self::is_valid_currency(&currency) {
            return Err(DomainError::InvalidCurrency { currency });
        }

        Ok(Self { amount, currency })
    }

    // 值对象的操作返回新实例（不可变）
    pub fn add(&self, other: &Money) -> Result<Money, DomainError> {
        if self.currency != other.currency {
            return Err(DomainError::CurrencyMismatch {
                left: self.currency.clone(),
                right: other.currency.clone(),
            });
        }

        Ok(Money {
            amount: self.amount + other.amount,
            currency: self.currency.clone(),
        })
    }

    pub fn multiply(&self, factor: Decimal) -> Money {
        Money {
            amount: self.amount * factor,
            currency: self.currency.clone(),
        }
    }

    // 访问器
    pub fn amount(&self) -> Decimal {
        self.amount
    }

    pub fn currency(&self) -> &str {
        &self.currency
    }

    fn is_valid_currency(currency: &str) -> bool {
        matches!(currency, "USD" | "EUR" | "CNY" | "JPY")
    }
}

// 实现 Display
impl std::fmt::Display for Money {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{} {}", self.amount, self.currency)
    }
}
```

### 10.3 性能优化技巧

```rust
// 1. 使用 Cow 避免不必要的克隆
use std::borrow::Cow;

pub fn process_transaction(data: Cow<str>) -> Result<(), Error> {
    // 如果 data 不需要修改，不会发生克隆
    println!("Processing: {}", data);
    Ok(())
}

// 调用方
process_transaction(Cow::Borrowed("existing_data"))?;  // 无克隆
process_transaction(Cow::Owned(new_data))?;            // 已拥有

// 2. 使用 Arc 共享不可变数据
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,  // 多个副本共享同一份配置
    pub pool: PgPool,
}

// 3. 避免不必要的分配
// ❌ 差：每次调用都分配
pub fn get_status(&self) -> String {
    match self.status {
        TransactionStatus::Draft => "Draft".to_string(),
        TransactionStatus::Posted => "Posted".to_string(),
    }
}

// ✅ 好：返回引用
pub fn get_status(&self) -> &'static str {
    match self.status {
        TransactionStatus::Draft => "Draft",
        TransactionStatus::Posted => "Posted",
    }
}

// 4. 使用 SmallVec 优化小集合
use smallvec::SmallVec;

// 大多数交易少于10个分录，避免堆分配
pub struct Transaction {
    pub journal_entries: SmallVec<[JournalEntry; 10]>,
}

// 5. 批量操作
// ❌ 差：逐个插入
for entry in entries {
    sqlx::query!("INSERT INTO ...").execute(&pool).await?;
}

// ✅ 好：批量插入
let mut query_builder = QueryBuilder::new("INSERT INTO journal_entries (...) ");
query_builder.push_values(entries, |mut b, entry| {
    b.push_bind(entry.account_number)
     .push_bind(entry.debit_amount)
     .push_bind(entry.credit_amount);
});
query_builder.build().execute(&pool).await?;
```

---

**文档完成！**

本实施技术指南涵盖了：
1. API设计规范与示例
2. 数据库设计模式与迁移
3. 分布式事务处理（Saga模式）
4. 安全加固详细方案
5. 监控告警详细配置
6. 测试策略详细方案
7. Kubernetes部署配置
8. CI/CD Pipeline详细配置
9. 运维Runbook模板
10. 代码规范和最佳实践

配合《Rust-Abc-Enhanced.md》使用，提供12个月开发计划的完整技术实施细节。

