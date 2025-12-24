# Rust ERP 系统 API 设计文档

## 1. API 设计原则

### 1.1 设计规范

- **RESTful 风格**：资源导向，使用标准 HTTP 方法
- **版本控制**：URL 路径包含版本号 `/api/v1/...`
- **统一响应格式**：成功和错误响应保持一致的结构
- **幂等性**：PUT/DELETE 操作保证幂等，POST 使用幂等键
- **分页**：列表接口统一使用 `page`、`page_size`、`total` 参数
- **过滤排序**：支持 `filter`、`sort`、`order` 查询参数
- **国际化**：支持多语言错误消息（Accept-Language header）

### 1.2 HTTP 状态码规范

| 状态码 | 含义 | 使用场景 |
|-------|------|---------|
| 200 OK | 成功 | GET、PUT、PATCH 成功 |
| 201 Created | 已创建 | POST 创建资源成功 |
| 202 Accepted | 已接受 | 异步任务已提交 |
| 204 No Content | 无内容 | DELETE 成功 |
| 400 Bad Request | 请求错误 | 参数验证失败 |
| 401 Unauthorized | 未认证 | JWT token 无效或过期 |
| 403 Forbidden | 禁止访问 | 权限不足 |
| 404 Not Found | 未找到 | 资源不存在 |
| 409 Conflict | 冲突 | 资源已存在或状态冲突 |
| 422 Unprocessable Entity | 无法处理 | 业务规则验证失败 |
| 429 Too Many Requests | 请求过多 | 触发限流 |
| 500 Internal Server Error | 服务器错误 | 系统内部错误 |
| 503 Service Unavailable | 服务不可用 | 服务降级或维护中 |

### 1.3 统一响应格式

```json
// 成功响应
{
  "success": true,
  "data": {
    // 实际数据
  },
  "metadata": {
    "timestamp": "2025-12-21T10:00:00Z",
    "request_id": "req-123456"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ACCOUNT_NOT_FOUND",
    "message": "Account 1000 not found",
    "details": [
      {
        "field": "account_number",
        "issue": "Account does not exist in the system"
      }
    ]
  },
  "metadata": {
    "timestamp": "2025-12-21T10:00:00Z",
    "request_id": "req-123456"
  }
}

// 分页响应
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 150,
      "total_pages": 8
    }
  },
  "metadata": {
    "timestamp": "2025-12-21T10:00:00Z",
    "request_id": "req-123456"
  }
}
```

---

## 2. 财务服务 API (Financial Service)

**Base URL**: `https://api.erp.example.com/financial/v1`

### 2.1 会计科目管理 (Accounts)

#### 2.1.1 创建会计科目

**接口**: `POST /accounts`

**描述**: 创建新的会计科目（总账科目）

**请求头**:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Idempotency-Key: uuid-12345  # 幂等键，防止重复创建
```

**请求体**:
```json
{
  "account_number": "1001",
  "account_name": "现金",
  "account_type": "ASSET",  // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  "currency": "CNY",
  "parent_account": null,  // 上级科目（可选）
  "is_leaf": true,  // 是否末级科目
  "balance_type": "DEBIT",  // DEBIT（借方）, CREDIT（贷方）
  "cost_center_required": false,  // 是否强制成本中心
  "profit_center_required": false,
  "description": "库存现金账户"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "account_id": "acc-550e8400-e29b-41d4-a716-446655440000",
    "account_number": "1001",
    "account_name": "现金",
    "account_type": "ASSET",
    "currency": "CNY",
    "current_balance": 0.00,
    "is_active": true,
    "created_at": "2025-12-21T10:00:00Z",
    "created_by": "user-123"
  },
  "metadata": {
    "timestamp": "2025-12-21T10:00:00Z",
    "request_id": "req-123456"
  }
}
```

**错误响应** (409 Conflict):
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_ALREADY_EXISTS",
    "message": "Account 1001 already exists",
    "details": []
  }
}
```

---

#### 2.1.2 获取科目详情

**接口**: `GET /accounts/{account_number}`

**描述**: 根据科目编号查询科目详细信息

**请求参数**:
- `account_number` (路径参数): 科目编号

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "account_id": "acc-550e8400-e29b-41d4-a716-446655440000",
    "account_number": "1001",
    "account_name": "现金",
    "account_type": "ASSET",
    "currency": "CNY",
    "current_balance": 150000.00,
    "debit_total": 200000.00,
    "credit_total": 50000.00,
    "is_active": true,
    "parent_account": null,
    "children_accounts": ["1001.01", "1001.02"],
    "created_at": "2025-12-21T10:00:00Z",
    "updated_at": "2025-12-21T15:30:00Z"
  }
}
```

---

#### 2.1.3 查询科目列表

**接口**: `GET /accounts`

**描述**: 分页查询科目列表，支持过滤和排序

**查询参数**:
- `page` (int, 默认 1): 页码
- `page_size` (int, 默认 20, 最大 100): 每页数量
- `account_type` (string, 可选): 科目类型过滤
- `currency` (string, 可选): 币种过滤
- `is_active` (boolean, 可选): 是否激活
- `search` (string, 可选): 科目编号或名称模糊搜索
- `sort` (string, 默认 "account_number"): 排序字段
- `order` (string, 默认 "asc"): 排序方向 (asc/desc)

**示例**: `GET /accounts?account_type=ASSET&currency=CNY&page=1&page_size=20`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "account_id": "acc-123",
        "account_number": "1001",
        "account_name": "现金",
        "account_type": "ASSET",
        "currency": "CNY",
        "current_balance": 150000.00,
        "is_active": true
      },
      {
        "account_id": "acc-124",
        "account_number": "1002",
        "account_name": "银行存款",
        "account_type": "ASSET",
        "currency": "CNY",
        "current_balance": 5000000.00,
        "is_active": true
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 150,
      "total_pages": 8
    }
  }
}
```

---

#### 2.1.4 更新科目信息

**接口**: `PATCH /accounts/{account_number}`

**描述**: 部分更新科目信息（不允许修改科目编号和类型）

**请求体**:
```json
{
  "account_name": "库存现金",
  "description": "更新后的描述",
  "is_active": true
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "account_id": "acc-123",
    "account_number": "1001",
    "account_name": "库存现金",
    "updated_at": "2025-12-21T16:00:00Z"
  }
}
```

---

#### 2.1.5 停用科目

**接口**: `DELETE /accounts/{account_number}`

**描述**: 停用科目（软删除，不允许物理删除）

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "account_number": "1001",
    "is_active": false,
    "deactivated_at": "2025-12-21T16:00:00Z"
  }
}
```

**错误响应** (422 Unprocessable Entity):
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_HAS_BALANCE",
    "message": "Cannot deactivate account with non-zero balance",
    "details": [
      {
        "field": "current_balance",
        "value": 150000.00,
        "issue": "Account balance must be zero before deactivation"
      }
    ]
  }
}
```

---

### 2.2 财务交易管理 (Transactions)

#### 2.2.1 创建财务凭证

**接口**: `POST /transactions`

**描述**: 创建财务凭证（记账凭证），包含多个分录

**请求体**:
```json
{
  "document_date": "2025-12-21",
  "posting_date": "2025-12-21",
  "document_type": "JE",  // JE=日记账分录, IV=发票, PY=付款
  "reference_number": "JV-2025-001",
  "description": "采购办公用品",
  "fiscal_year": 2025,
  "fiscal_period": 12,
  "currency": "CNY",
  "exchange_rate": 1.0,
  "entries": [
    {
      "line_number": 1,
      "account_number": "6601",  // 办公费用
      "debit_amount": 5000.00,
      "credit_amount": 0.00,
      "cost_center": "CC-001",
      "profit_center": null,
      "description": "购买打印纸"
    },
    {
      "line_number": 2,
      "account_number": "1002",  // 银行存款
      "debit_amount": 0.00,
      "credit_amount": 5000.00,
      "cost_center": null,
      "profit_center": null,
      "description": "银行转账支付"
    }
  ]
}
```

**业务规则校验**:
- 借贷必须平衡：`SUM(debit_amount) = SUM(credit_amount)`
- 至少包含 2 个分录
- 科目必须存在且激活
- 会计期间必须未关闭
- 如果科目要求成本中心/利润中心，分录必须提供

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx-550e8400-e29b-41d4-a716-446655440000",
    "document_number": "FI-2025-000123",  // 系统自动生成
    "document_date": "2025-12-21",
    "posting_date": "2025-12-21",
    "status": "POSTED",  // DRAFT（草稿）, POSTED（已过账）, REVERSED（已冲销）
    "total_amount": 5000.00,
    "currency": "CNY",
    "entries_count": 2,
    "created_at": "2025-12-21T10:00:00Z",
    "created_by": "user-123",
    "posted_at": "2025-12-21T10:00:00Z",
    "posted_by": "user-123"
  }
}
```

**错误响应** (422 Unprocessable Entity):
```json
{
  "success": false,
  "error": {
    "code": "UNBALANCED_TRANSACTION",
    "message": "Transaction is not balanced",
    "details": [
      {
        "field": "entries",
        "issue": "Debit total (5000.00) does not equal credit total (4500.00)"
      }
    ]
  }
}
```

---

#### 2.2.2 查询交易详情

**接口**: `GET /transactions/{transaction_id}`

**描述**: 获取财务凭证的完整信息，包括所有分录

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx-550e8400-e29b-41d4-a716-446655440000",
    "document_number": "FI-2025-000123",
    "document_date": "2025-12-21",
    "posting_date": "2025-12-21",
    "document_type": "JE",
    "status": "POSTED",
    "total_amount": 5000.00,
    "currency": "CNY",
    "description": "采购办公用品",
    "entries": [
      {
        "entry_id": "entry-001",
        "line_number": 1,
        "account_number": "6601",
        "account_name": "办公费用",
        "debit_amount": 5000.00,
        "credit_amount": 0.00,
        "cost_center": "CC-001",
        "cost_center_name": "行政部",
        "description": "购买打印纸"
      },
      {
        "entry_id": "entry-002",
        "line_number": 2,
        "account_number": "1002",
        "account_name": "银行存款",
        "debit_amount": 0.00,
        "credit_amount": 5000.00,
        "description": "银行转账支付"
      }
    ],
    "created_at": "2025-12-21T10:00:00Z",
    "created_by": "user-123",
    "created_by_name": "张三",
    "posted_at": "2025-12-21T10:00:00Z"
  }
}
```

---

#### 2.2.3 查询交易列表

**接口**: `GET /transactions`

**查询参数**:
- `page`, `page_size`: 分页参数
- `account_number` (可选): 按科目过滤
- `document_type` (可选): 凭证类型
- `status` (可选): 状态过滤
- `posting_date_from` (可选): 过账日期起始
- `posting_date_to` (可选): 过账日期结束
- `fiscal_year` (可选): 会计年度
- `fiscal_period` (可选): 会计期间
- `cost_center` (可选): 成本中心
- `created_by` (可选): 创建人

**示例**: `GET /transactions?account_number=1001&posting_date_from=2025-01-01&posting_date_to=2025-12-31&page=1`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "transaction_id": "tx-123",
        "document_number": "FI-2025-000123",
        "posting_date": "2025-12-21",
        "document_type": "JE",
        "status": "POSTED",
        "total_amount": 5000.00,
        "currency": "CNY",
        "description": "采购办公用品",
        "created_by_name": "张三",
        "created_at": "2025-12-21T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 500,
      "total_pages": 25
    }
  }
}
```

---

#### 2.2.4 冲销交易

**接口**: `POST /transactions/{transaction_id}/reverse`

**描述**: 生成反向凭证冲销原交易

**请求体**:
```json
{
  "reversal_date": "2025-12-22",
  "reason": "原凭证录入错误，需要冲销重做"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "original_transaction_id": "tx-123",
    "reversal_transaction_id": "tx-456",
    "reversal_document_number": "FI-2025-000456",
    "original_status": "REVERSED",
    "reversal_status": "POSTED",
    "reversed_at": "2025-12-22T10:00:00Z"
  }
}
```

---

### 2.3 账户余额查询 (Balances)

#### 2.3.1 查询科目余额

**接口**: `GET /accounts/{account_number}/balance`

**查询参数**:
- `as_of_date` (可选): 截止日期，默认当前日期
- `currency` (可选): 币种，默认科目主币种
- `cost_center` (可选): 成本中心维度
- `profit_center` (可选): 利润中心维度

**示例**: `GET /accounts/1001/balance?as_of_date=2025-12-21`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "account_number": "1001",
    "account_name": "现金",
    "currency": "CNY",
    "as_of_date": "2025-12-21",
    "opening_balance": 100000.00,  // 期初余额
    "debit_total": 200000.00,      // 借方发生额
    "credit_total": 50000.00,      // 贷方发生额
    "closing_balance": 250000.00,  // 期末余额
    "balance_type": "DEBIT",       // 余额方向
    "last_updated": "2025-12-21T15:30:00Z"
  }
}
```

---

#### 2.3.2 批量查询余额

**接口**: `POST /balances/batch`

**描述**: 批量查询多个科目的余额

**请求体**:
```json
{
  "account_numbers": ["1001", "1002", "2001", "2002"],
  "as_of_date": "2025-12-21",
  "currency": "CNY"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "as_of_date": "2025-12-21",
    "currency": "CNY",
    "balances": [
      {
        "account_number": "1001",
        "account_name": "现金",
        "closing_balance": 250000.00,
        "balance_type": "DEBIT"
      },
      {
        "account_number": "1002",
        "account_name": "银行存款",
        "closing_balance": 5000000.00,
        "balance_type": "DEBIT"
      }
    ]
  }
}
```

---

### 2.4 财务报表 (Reports)

#### 2.4.1 生成资产负债表

**接口**: `POST /reports/balance-sheet`

**描述**: 生成资产负债表（异步任务）

**请求体**:
```json
{
  "as_of_date": "2025-12-31",
  "currency": "CNY",
  "consolidation_level": "COMPANY",  // COMPANY, DIVISION, COST_CENTER
  "format": "PDF",  // PDF, EXCEL, JSON
  "language": "zh-CN"
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "task_id": "report-task-123",
    "status": "PROCESSING",
    "created_at": "2025-12-21T10:00:00Z",
    "estimated_completion": "2025-12-21T10:05:00Z",
    "status_url": "/tasks/report-task-123"
  }
}
```

**查询任务状态**: `GET /tasks/{task_id}`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "task_id": "report-task-123",
    "status": "COMPLETED",  // PROCESSING, COMPLETED, FAILED
    "progress": 100,
    "result": {
      "report_url": "https://storage.example.com/reports/balance-sheet-2025-12-31.pdf",
      "expires_at": "2025-12-28T10:00:00Z"
    },
    "created_at": "2025-12-21T10:00:00Z",
    "completed_at": "2025-12-21T10:03:00Z"
  }
}
```

---

#### 2.4.2 生成利润表

**接口**: `POST /reports/income-statement`

**请求体**:
```json
{
  "period_from": "2025-01-01",
  "period_to": "2025-12-31",
  "currency": "CNY",
  "comparison_period": "PREVIOUS_YEAR",  // NONE, PREVIOUS_YEAR, BUDGET
  "format": "EXCEL"
}
```

**响应**: 同资产负债表（异步任务）

---

#### 2.4.3 生成现金流量表

**接口**: `POST /reports/cash-flow-statement`

**请求体**:
```json
{
  "period_from": "2025-01-01",
  "period_to": "2025-12-31",
  "method": "INDIRECT",  // DIRECT（直接法）, INDIRECT（间接法）
  "currency": "CNY",
  "format": "PDF"
}
```

**响应**: 异步任务响应

---

### 2.5 会计期间管理 (Fiscal Periods)

#### 2.5.1 查询会计期间状态

**接口**: `GET /fiscal-periods/{year}/{period}`

**示例**: `GET /fiscal-periods/2025/12`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "fiscal_year": 2025,
    "fiscal_period": 12,
    "period_name": "2025年12月",
    "start_date": "2025-12-01",
    "end_date": "2025-12-31",
    "status": "OPEN",  // OPEN（开放）, CLOSED（关闭）, LOCKED（锁定）
    "is_current": true,
    "closed_at": null,
    "closed_by": null
  }
}
```

---

#### 2.5.2 关闭会计期间

**接口**: `POST /fiscal-periods/{year}/{period}/close`

**描述**: 关闭会计期间（不可逆操作）

**请求体**:
```json
{
  "closing_notes": "12月期间关账，所有凭证已审核"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "fiscal_year": 2025,
    "fiscal_period": 12,
    "status": "CLOSED",
    "closed_at": "2025-12-21T18:00:00Z",
    "closed_by": "user-123",
    "closing_notes": "12月期间关账，所有凭证已审核"
  }
}
```

---

## 3. 销售服务 API (Sales Service)

**Base URL**: `https://api.erp.example.com/sales/v1`

### 3.1 销售订单管理 (Sales Orders)

#### 3.1.1 创建销售订单

**接口**: `POST /orders`

**请求体**:
```json
{
  "customer_id": "cust-12345",
  "order_date": "2025-12-21",
  "requested_delivery_date": "2025-12-28",
  "sales_organization": "SO-001",
  "distribution_channel": "DC-01",
  "division": "DIV-01",
  "payment_terms": "NET30",  // 付款条款：30天内付款
  "incoterms": "FOB",         // 国际贸易术语
  "currency": "CNY",
  "items": [
    {
      "line_number": 10,
      "material_number": "MAT-001",
      "quantity": 100,
      "unit": "PC",  // 件
      "unit_price": 500.00,
      "discount_percent": 5.0,
      "tax_code": "VAT13",  // 增值税13%
      "delivery_date": "2025-12-28",
      "plant": "PLANT-01",  // 工厂
      "storage_location": "SL-01"
    },
    {
      "line_number": 20,
      "material_number": "MAT-002",
      "quantity": 50,
      "unit": "PC",
      "unit_price": 1000.00,
      "discount_percent": 0,
      "tax_code": "VAT13",
      "delivery_date": "2025-12-28",
      "plant": "PLANT-01",
      "storage_location": "SL-01"
    }
  ],
  "shipping_address": {
    "street": "张江高科技园区",
    "city": "上海",
    "postal_code": "201203",
    "country": "CN"
  }
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "order_id": "so-550e8400-e29b-41d4-a716-446655440000",
    "order_number": "SO-2025-001234",
    "customer_id": "cust-12345",
    "customer_name": "上海某某科技有限公司",
    "order_date": "2025-12-21",
    "status": "CREATED",  // CREATED, CONFIRMED, PARTIALLY_DELIVERED, DELIVERED, CANCELLED
    "total_net_value": 97500.00,  // (100*500*0.95 + 50*1000)
    "total_tax": 12675.00,        // 13% VAT
    "total_gross_value": 110175.00,
    "currency": "CNY",
    "items_count": 2,
    "created_at": "2025-12-21T10:00:00Z",
    "created_by": "user-123"
  }
}
```

---

#### 3.1.2 查询订单详情

**接口**: `GET /orders/{order_number}`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_id": "so-123",
    "order_number": "SO-2025-001234",
    "customer": {
      "customer_id": "cust-12345",
      "customer_number": "C-10001",
      "customer_name": "上海某某科技有限公司",
      "credit_limit": 1000000.00,
      "credit_exposure": 500000.00
    },
    "order_date": "2025-12-21",
    "status": "CONFIRMED",
    "total_net_value": 97500.00,
    "total_tax": 12675.00,
    "total_gross_value": 110175.00,
    "currency": "CNY",
    "payment_terms": "NET30",
    "items": [
      {
        "line_number": 10,
        "material_number": "MAT-001",
        "material_description": "产品A",
        "quantity": 100,
        "unit": "PC",
        "unit_price": 500.00,
        "discount_percent": 5.0,
        "net_value": 47500.00,
        "tax_amount": 6175.00,
        "gross_value": 53675.00,
        "delivery_status": "NOT_DELIVERED",
        "delivered_quantity": 0,
        "open_quantity": 100
      },
      {
        "line_number": 20,
        "material_number": "MAT-002",
        "material_description": "产品B",
        "quantity": 50,
        "unit": "PC",
        "unit_price": 1000.00,
        "discount_percent": 0,
        "net_value": 50000.00,
        "tax_amount": 6500.00,
        "gross_value": 56500.00,
        "delivery_status": "NOT_DELIVERED",
        "delivered_quantity": 0,
        "open_quantity": 50
      }
    ],
    "delivery_schedule": [
      {
        "item_number": 10,
        "schedule_line": 1,
        "quantity": 100,
        "requested_date": "2025-12-28",
        "confirmed_date": "2025-12-28"
      }
    ],
    "created_at": "2025-12-21T10:00:00Z",
    "confirmed_at": "2025-12-21T11:00:00Z"
  }
}
```

---

#### 3.1.3 查询订单列表

**接口**: `GET /orders`

**查询参数**:
- `customer_id`: 客户ID过滤
- `status`: 订单状态
- `order_date_from`, `order_date_to`: 日期范围
- `search`: 订单号或客户名称搜索
- `page`, `page_size`: 分页

**响应**: 分页列表格式

---

#### 3.1.4 确认订单

**接口**: `POST /orders/{order_number}/confirm`

**描述**: 确认订单（检查库存、信用额度）

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_number": "SO-2025-001234",
    "status": "CONFIRMED",
    "confirmed_at": "2025-12-21T11:00:00Z",
    "confirmed_by": "user-123",
    "availability_check": {
      "passed": true,
      "items": [
        {
          "line_number": 10,
          "available_quantity": 150,
          "requested_quantity": 100,
          "status": "AVAILABLE"
        }
      ]
    },
    "credit_check": {
      "passed": true,
      "credit_limit": 1000000.00,
      "current_exposure": 500000.00,
      "order_value": 110175.00,
      "new_exposure": 610175.00
    }
  }
}
```

---

#### 3.1.5 取消订单

**接口**: `POST /orders/{order_number}/cancel`

**请求体**:
```json
{
  "cancellation_reason": "客户取消订单",
  "notify_customer": true
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "order_number": "SO-2025-001234",
    "status": "CANCELLED",
    "cancelled_at": "2025-12-21T14:00:00Z",
    "cancellation_reason": "客户取消订单"
  }
}
```

---

### 3.2 发货管理 (Deliveries)

#### 3.2.1 创建发货单

**接口**: `POST /deliveries`

**请求体**:
```json
{
  "order_number": "SO-2025-001234",
  "delivery_date": "2025-12-28",
  "items": [
    {
      "order_item_number": 10,
      "quantity": 100,
      "picking_location": "SL-01"
    }
  ],
  "carrier": "顺丰速运",
  "tracking_number": "SF123456789"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "delivery_id": "del-123",
    "delivery_number": "DN-2025-005678",
    "order_number": "SO-2025-001234",
    "delivery_date": "2025-12-28",
    "status": "CREATED",  // CREATED, PICKED, PACKED, SHIPPED, DELIVERED
    "items_count": 1,
    "total_quantity": 100,
    "created_at": "2025-12-28T08:00:00Z"
  }
}
```

---

#### 3.2.2 过账发货（库存扣减）

**接口**: `POST /deliveries/{delivery_number}/post-goods-issue`

**描述**: 执行库存扣减，财务过账

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "delivery_number": "DN-2025-005678",
    "status": "SHIPPED",
    "goods_issue_posted": true,
    "goods_issue_date": "2025-12-28",
    "material_document": "MD-2025-789",  // 物料凭证号
    "accounting_document": "FI-2025-456", // 财务凭证号
    "posted_at": "2025-12-28T10:00:00Z"
  }
}
```

---

### 3.3 开票管理 (Billing)

#### 3.3.1 创建发票

**接口**: `POST /invoices`

**请求体**:
```json
{
  "order_number": "SO-2025-001234",
  "delivery_number": "DN-2025-005678",
  "invoice_date": "2025-12-28",
  "billing_type": "STANDARD",  // STANDARD, CREDIT_MEMO, DEBIT_MEMO
  "payment_terms": "NET30",
  "items": [
    {
      "order_item_number": 10,
      "quantity": 100,
      "unit_price": 500.00
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv-123",
    "invoice_number": "INV-2025-009876",
    "order_number": "SO-2025-001234",
    "customer_id": "cust-12345",
    "invoice_date": "2025-12-28",
    "due_date": "2026-01-27",  // NET30
    "total_net_value": 47500.00,
    "total_tax": 6175.00,
    "total_gross_value": 53675.00,
    "currency": "CNY",
    "status": "POSTED",
    "accounting_document": "FI-2025-457",
    "pdf_url": "https://storage.example.com/invoices/INV-2025-009876.pdf",
    "created_at": "2025-12-28T11:00:00Z"
  }
}
```

---

## 4. 物料服务 API (Materials Service)

**Base URL**: `https://api.erp.example.com/materials/v1`

### 4.1 物料主数据 (Materials)

#### 4.1.1 创建物料

**接口**: `POST /materials`

**请求体**:
```json
{
  "material_number": "MAT-001",  // 可选，系统自动生成
  "material_type": "FERT",  // ROH=原料, HALB=半成品, FERT=成品
  "industry_sector": "M",   // M=机械, C=化工, P=制药
  "basic_data": {
    "description": "产品A",
    "base_unit_of_measure": "PC",  // 基本单位
    "material_group": "MG-001",
    "division": "DIV-01",
    "gross_weight": 2.5,
    "net_weight": 2.0,
    "weight_unit": "KG",
    "volume": 0.01,
    "volume_unit": "M3"
  },
  "sales_data": {
    "sales_organization": "SO-001",
    "distribution_channel": "DC-01",
    "item_category_group": "NORM",
    "delivering_plant": "PLANT-01",
    "tax_classification": "VAT13"
  },
  "purchasing_data": {
    "purchasing_group": "PG-01",
    "material_group": "MG-001",
    "order_unit": "PC"
  },
  "mrp_data": {
    "mrp_type": "PD",  // PD=MRP, VB=消耗性
    "lot_size": "EX",  // EX=精确订单量
    "procurement_type": "E",  // E=自制, F=外购
    "planning_time_fence": 30,
    "safety_stock": 100,
    "reorder_point": 200,
    "maximum_stock_level": 1000
  },
  "accounting_data": {
    "valuation_class": "3000",
    "price_control": "S",  // S=标准价格, V=移动平均价
    "standard_price": 450.00,
    "currency": "CNY"
  }
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "material_id": "mat-550e8400-e29b-41d4-a716-446655440000",
    "material_number": "MAT-001",
    "description": "产品A",
    "material_type": "FERT",
    "base_unit": "PC",
    "created_at": "2025-12-21T10:00:00Z",
    "created_by": "user-123"
  }
}
```

---

#### 4.1.2 查询物料详情

**接口**: `GET /materials/{material_number}`

**响应**: 包含完整的物料主数据

---

### 4.2 库存管理 (Inventory)

#### 4.2.1 查询库存

**接口**: `GET /inventory`

**查询参数**:
- `material_number`: 物料编号
- `plant`: 工厂
- `storage_location`: 库位
- `batch`: 批次号（可选）
- `special_stock`: 特殊库存类型（可选）

**示例**: `GET /inventory?material_number=MAT-001&plant=PLANT-01`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "material_number": "MAT-001",
    "material_description": "产品A",
    "plant": "PLANT-01",
    "storage_locations": [
      {
        "storage_location": "SL-01",
        "unrestricted_stock": 500,  // 非限制使用库存
        "quality_inspection_stock": 50,  // 质检库存
        "blocked_stock": 10,  // 冻结库存
        "total_stock": 560,
        "unit": "PC",
        "value": 252000.00,  // 库存价值（560 * 450）
        "currency": "CNY",
        "last_updated": "2025-12-21T10:00:00Z"
      }
    ],
    "total_plant_stock": 560
  }
}
```

---

#### 4.2.2 创建收货单

**接口**: `POST /goods-receipts`

**描述**: 采购订单收货

**请求体**:
```json
{
  "purchase_order": "PO-2025-001",
  "receipt_date": "2025-12-21",
  "movement_type": "101",  // 101=采购订单收货
  "items": [
    {
      "po_item_number": 10,
      "material_number": "MAT-001",
      "quantity": 200,
      "unit": "PC",
      "plant": "PLANT-01",
      "storage_location": "SL-01",
      "batch": "BATCH-20251221",  // 可选
      "stock_type": "UNRESTRICTED"  // UNRESTRICTED, QUALITY, BLOCKED
    }
  ],
  "vendor_number": "V-10001",
  "delivery_note": "DN-VENDOR-123"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "material_document": "MD-2025-001234",
    "document_date": "2025-12-21",
    "posting_date": "2025-12-21",
    "movement_type": "101",
    "items_count": 1,
    "accounting_document": "FI-2025-789",  // 自动生成财务凭证
    "posted_at": "2025-12-21T10:00:00Z"
  }
}
```

---

#### 4.2.3 创建发货单（出库）

**接口**: `POST /goods-issues`

**请求体**:
```json
{
  "issue_date": "2025-12-21",
  "movement_type": "601",  // 601=销售订单发货
  "items": [
    {
      "material_number": "MAT-001",
      "quantity": 100,
      "unit": "PC",
      "plant": "PLANT-01",
      "storage_location": "SL-01",
      "sales_order": "SO-2025-001234",
      "sales_order_item": 10
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "material_document": "MD-2025-005678",
    "movement_type": "601",
    "posted_at": "2025-12-21T10:00:00Z"
  }
}
```

---

### 4.3 采购订单 (Purchase Orders)

#### 4.3.1 创建采购订单

**接口**: `POST /purchase-orders`

**请求体**:
```json
{
  "vendor_id": "V-10001",
  "purchasing_organization": "PO-01",
  "purchasing_group": "PG-01",
  "document_date": "2025-12-21",
  "payment_terms": "NET30",
  "incoterms": "FOB",
  "currency": "CNY",
  "items": [
    {
      "item_number": 10,
      "material_number": "MAT-RAW-001",
      "short_text": "原材料A",
      "quantity": 1000,
      "unit": "KG",
      "net_price": 50.00,
      "plant": "PLANT-01",
      "storage_location": "SL-01",
      "delivery_date": "2025-12-28",
      "tax_code": "VAT13",
      "account_assignment_category": "K",  // K=成本中心
      "cost_center": "CC-001"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "po_id": "po-123",
    "po_number": "PO-2025-004567",
    "vendor_id": "V-10001",
    "vendor_name": "供应商A",
    "document_date": "2025-12-21",
    "total_value": 50000.00,
    "currency": "CNY",
    "status": "CREATED",
    "items_count": 1,
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

## 5. gRPC 接口定义

### 5.1 财务服务 gRPC

```protobuf
syntax = "proto3";

package erp.financial.v1;

// 财务服务
service FinancialService {
  // 查询账户余额（同步调用）
  rpc GetAccountBalance(GetAccountBalanceRequest)
      returns (GetAccountBalanceResponse);

  // 批量查询余额
  rpc GetAccountBalances(GetAccountBalancesRequest)
      returns (GetAccountBalancesResponse);

  // 验证交易合法性
  rpc ValidateTransaction(ValidateTransactionRequest)
      returns (ValidateTransactionResponse);

  // 创建财务凭证
  rpc PostTransaction(PostTransactionRequest)
      returns (PostTransactionResponse);

  // 查询会计期间状态
  rpc GetFiscalPeriodStatus(GetFiscalPeriodStatusRequest)
      returns (GetFiscalPeriodStatusResponse);
}

// 查询余额请求
message GetAccountBalanceRequest {
  string account_number = 1;
  string currency = 2;
  string as_of_date = 3;  // ISO 8601: "2025-12-21"
  optional string cost_center = 4;
  optional string profit_center = 5;
}

// 余额响应
message GetAccountBalanceResponse {
  string account_number = 1;
  string account_name = 2;
  string currency = 3;
  double opening_balance = 4;
  double debit_total = 5;
  double credit_total = 6;
  double closing_balance = 7;
  string balance_type = 8;  // "DEBIT" or "CREDIT"
  int64 last_updated_timestamp = 9;
}

// 批量查询请求
message GetAccountBalancesRequest {
  repeated string account_numbers = 1;
  string currency = 2;
  string as_of_date = 3;
}

message GetAccountBalancesResponse {
  repeated GetAccountBalanceResponse balances = 1;
}

// 验证交易请求
message ValidateTransactionRequest {
  TransactionData transaction = 1;
}

message TransactionData {
  string posting_date = 1;
  int32 fiscal_year = 2;
  int32 fiscal_period = 3;
  string currency = 4;
  repeated JournalEntry entries = 5;
}

message JournalEntry {
  int32 line_number = 1;
  string account_number = 2;
  double debit_amount = 3;
  double credit_amount = 4;
  optional string cost_center = 5;
}

// 验证响应
message ValidateTransactionResponse {
  bool is_valid = 1;
  repeated ValidationError errors = 2;
}

message ValidationError {
  string error_code = 1;
  string error_message = 2;
  optional string field = 3;
}
```

---

## 6. WebSocket 实时通知 API

### 6.1 连接 WebSocket

**URL**: `wss://api.erp.example.com/ws/v1/notifications`

**认证**: 通过查询参数传递 JWT token
```
wss://api.erp.example.com/ws/v1/notifications?token=<JWT_TOKEN>
```

### 6.2 订阅主题

**客户端发送**:
```json
{
  "action": "subscribe",
  "topics": [
    "financial.transactions.posted",
    "sales.orders.confirmed",
    "inventory.low_stock_alert"
  ]
}
```

**服务端确认**:
```json
{
  "type": "subscription_confirmed",
  "topics": [
    "financial.transactions.posted",
    "sales.orders.confirmed",
    "inventory.low_stock_alert"
  ],
  "timestamp": "2025-12-21T10:00:00Z"
}
```

### 6.3 接收事件通知

**服务端推送**:
```json
{
  "type": "event",
  "topic": "sales.orders.confirmed",
  "data": {
    "order_number": "SO-2025-001234",
    "customer_name": "上海某某科技有限公司",
    "total_value": 110175.00,
    "currency": "CNY",
    "confirmed_at": "2025-12-21T11:00:00Z"
  },
  "timestamp": "2025-12-21T11:00:01Z",
  "event_id": "evt-123456"
}
```

---

## 7. 错误码表

### 7.1 通用错误码

| 错误码 | HTTP状态 | 说明 |
|-------|---------|------|
| INVALID_REQUEST | 400 | 请求参数格式错误 |
| UNAUTHORIZED | 401 | JWT token 无效或过期 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| ALREADY_EXISTS | 409 | 资源已存在（重复创建） |
| VALIDATION_FAILED | 422 | 业务规则验证失败 |
| RATE_LIMIT_EXCEEDED | 429 | 超过速率限制 |
| INTERNAL_ERROR | 500 | 系统内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |

### 7.2 财务服务错误码

| 错误码 | 说明 |
|-------|------|
| ACCOUNT_NOT_FOUND | 会计科目不存在 |
| ACCOUNT_ALREADY_EXISTS | 科目编号已存在 |
| ACCOUNT_HAS_BALANCE | 科目有余额，不能删除 |
| UNBALANCED_TRANSACTION | 交易借贷不平衡 |
| PERIOD_CLOSED | 会计期间已关闭 |
| INVALID_POSTING_DATE | 过账日期无效 |
| COST_CENTER_REQUIRED | 该科目需要成本中心 |
| INSUFFICIENT_BALANCE | 余额不足 |

### 7.3 销售服务错误码

| 错误码 | 说明 |
|-------|------|
| CUSTOMER_NOT_FOUND | 客户不存在 |
| CREDIT_LIMIT_EXCEEDED | 超过信用额度 |
| MATERIAL_NOT_AVAILABLE | 物料不可用 |
| ORDER_ALREADY_DELIVERED | 订单已发货，不能修改 |
| INVALID_QUANTITY | 数量无效 |

---

## 8. API 版本演进策略

### 8.1 版本控制

- **URL 版本**：`/api/v1/`, `/api/v2/`
- **向后兼容原则**：
  - 新增字段不算破坏性变更
  - 删除字段或修改字段类型需要新版本
  - 新版本至少保留 12 个月兼容期

### 8.2 废弃通知

**响应头**:
```http
Deprecation: true
Sunset: Sat, 21 Dec 2026 10:00:00 GMT
Link: </api/v2/accounts>; rel="alternate"
```

**响应体包含警告**:
```json
{
  "success": true,
  "data": {...},
  "warnings": [
    {
      "code": "DEPRECATED_API",
      "message": "This endpoint will be removed on 2026-12-21. Please migrate to /api/v2/accounts"
    }
  ]
}
```

---

## 9. 性能与限流

### 9.1 速率限制

```http
# 响应头
X-RateLimit-Limit: 1000         # 每小时限制
X-RateLimit-Remaining: 950      # 剩余次数
X-RateLimit-Reset: 1703145600   # 重置时间（Unix timestamp）
```

**限制策略**:
- 默认：1000 次/小时/用户
- 批量接口：100 次/小时
- 报表生成：10 次/小时

### 9.2 性能目标

| 接口类型 | P95 延迟 | P99 延迟 |
|---------|---------|---------|
| 查询单条记录 | < 50ms | < 100ms |
| 查询列表（20条） | < 100ms | < 200ms |
| 创建/更新操作 | < 200ms | < 500ms |
| 复杂计算（余额） | < 500ms | < 1s |
| 报表生成（异步） | < 5min | < 10min |

---

## 10. 安全最佳实践

### 10.1 API 密钥管理

- 使用 JWT Bearer Token
- Token 有效期：1 小时（访问令牌）
- Refresh Token 有效期：7 天

### 10.2 敏感数据脱敏

**响应示例**:
```json
{
  "bank_account": "6217 **** **** 1234",  // 银行卡号脱敏
  "id_card": "310***********0012",        // 身份证号脱敏
  "phone": "138****5678"                  // 手机号脱敏
}
```

### 10.3 审计日志

所有写操作自动记录：
- 操作人（user_id）
- 操作时间（timestamp）
- 操作类型（CREATE/UPDATE/DELETE）
- 请求ID（request_id）
- IP 地址
- 变更前后数据（diff）

---

## 11. 人力资本服务 API (HCM)

**Base URL**: `https://api.erp.example.com/hcm/v1`

### 11.1 员工档案 (PA/OM)

#### 11.1.1 创建员工

**接口**: `POST /employees`

**请求体**:
```json
{
  "employee_number": "E000123",  // 可选，系统可自动生成
  "first_name": "三",
  "last_name": "张",
  "display_name": "张三",
  "hire_date": "2025-12-21",
  "employment_type": "FULL_TIME",  // FULL_TIME, PART_TIME, CONTRACTOR, INTERN
  "job_code": "DEV-SENIOR",
  "position_id": "POS-001",
  "org_unit": "IT-DEV",
  "manager_id": "E000001",
  "location": "Beijing-HQ",
  "email": "zhang.san@example.com",
  "phone": "+86-13800000000",
  "cost_center": "CC-IT-01",
  "payroll_area": "CN-M",
  "work_schedule_rule": "WS-STD-40H"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
    "employee_number": "E000123",
    "display_name": "张三",
    "status": "ACTIVE",
    "hire_date": "2025-12-21",
    "job_code": "DEV-SENIOR",
    "org_unit": "IT-DEV",
    "manager_id": "E000001",
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

#### 11.1.2 查询员工详情

**接口**: `GET /employees/{employee_id}`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
    "employee_number": "E000123",
    "display_name": "张三",
    "employment_type": "FULL_TIME",
    "job_code": "DEV-SENIOR",
    "position_id": "POS-001",
    "org_unit": "IT-DEV",
    "manager_id": "E000001",
    "hire_date": "2025-12-21",
    "status": "ACTIVE",
    "cost_center": "CC-IT-01",
    "payroll_area": "CN-M",
    "location": "Beijing-HQ",
    "contact": {
      "email": "zhang.san@example.com",
      "phone": "+86-13800000000"
    },
    "created_at": "2025-12-21T10:00:00Z",
    "updated_at": "2025-12-21T15:00:00Z"
  }
}
```

---

### 11.2 工时与考勤 (Time Management)

#### 11.2.1 录入工时

**接口**: `POST /time-entries`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "work_date": "2025-12-21",
  "start_time": "09:00",
  "end_time": "18:00",
  "attendance_type": "WORK",  // WORK, OVERTIME, TRAVEL, REMOTE
  "project_code": "PRJ-ERP-01",
  "cost_center": "CC-IT-01",
  "remarks": "上线支持"
}
```

**业务规则校验**:
- `start_time` < `end_time`
- 同一员工一天内不可重复时间段
- OVERTIME 需要经理审批

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "time_entry_id": "te-123",
    "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
    "duration_hours": 9.0,
    "overtime_hours": 1.0,
    "status": "APPROVAL_PENDING"
  }
}
```

---

### 11.3 请假申请 (Absence)

#### 11.3.1 创建请假单

**接口**: `POST /leave-requests`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "leave_type": "ANNUAL",  // ANNUAL, SICK, UNPAID, MARRIAGE
  "start_date": "2025-12-28",
  "end_date": "2026-01-02",
  "reason": "家庭出行",
  "attachment_urls": []
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "leave_request_id": "lv-123",
    "status": "PENDING",
    "approver_id": "emp-0002",
    "submitted_at": "2025-12-21T12:00:00Z",
    "expected_decision_at": "2025-12-21T18:00:00Z"
  }
}
```

---

### 11.4 薪资模拟 (Payroll Simulation)

#### 11.4.1 计算单次工资

**接口**: `POST /payroll/simulations`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "period_start": "2025-12-01",
  "period_end": "2025-12-31",
  "currency": "CNY"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
    "gross_pay": 30000.00,
    "tax": 3500.00,
    "social_security": 2500.00,
    "net_pay": 24000.00,
    "pay_date": "2025-12-28",
    "currency": "CNY",
    "calculation_notes": "含2小时加班费"
  }
}
```

---

## 12. 客户服务与 CRM API (Service/CRM)

**Base URL**: `https://api.erp.example.com/crm/v1`

### 12.1 服务工单 (Service Tickets)

#### 12.1.1 创建服务工单

**接口**: `POST /service-tickets`

**请求体**:
```json
{
  "ticket_type": "INCIDENT",  // INCIDENT, RETURN, INSTALLATION
  "priority": "HIGH",         // LOW, MEDIUM, HIGH, URGENT
  "channel": "PHONE",         // PHONE, EMAIL, PORTAL, ONSITE
  "customer_id": "cust-12345",
  "contact_person": "王经理",
  "product_number": "MAT-001",
  "serial_number": "SN-2025-0001",
  "contract_number": "CTR-2025-01",
  "description": "设备噪音过大",
  "sla_hours": 8,
  "attachments": []
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "ticket_id": "svc-123",
    "ticket_number": "SVC-2025-000123",
    "status": "OPEN",
    "priority": "HIGH",
    "assigned_group": "FIELD-SVC-BJ",
    "sla_due_at": "2025-12-21T18:00:00Z"
  }
}
```

---

#### 12.1.2 分派工单

**接口**: `POST /service-tickets/{ticket_number}/assign`

**请求体**:
```json
{
  "assignee_id": "emp-0009",
  "skill_group": "ELECTRICAL",
  "expected_response_at": "2025-12-21T14:00:00Z"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "ticket_number": "SVC-2025-000123",
    "status": "IN_PROGRESS",
    "assignee_id": "emp-0009",
    "assigned_at": "2025-12-21T12:10:00Z"
  }
}
```

---

#### 12.1.3 结案与回访

**接口**: `POST /service-tickets/{ticket_number}/close`

**请求体**:
```json
{
  "resolution_code": "REPAIRED",  // REPAIRED, REPLACED, NO_FAULT_FOUND
  "resolution_notes": "更换轴承后噪音恢复正常",
  "used_parts": [
    {
      "material_number": "MAT-BEARING-6310-2RS",
      "quantity": 2,
      "unit": "EA"
    }
  ],
  "labor_hours": 3.5,
  "customer_signature": true
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "ticket_number": "SVC-2025-000123",
    "status": "CLOSED",
    "closed_at": "2025-12-21T16:30:00Z",
    "closed_by": "emp-0009",
    "customer_satisfaction_url": "https://survey.example.com/svc-2025-000123"
  }
}
```

---

## 13. 质量管理 API (QM)

**Base URL**: `https://api.erp.example.com/qm/v1`

### 13.1 检验批与使用决定

#### 13.1.1 创建检验批

**接口**: `POST /inspection-lots`

**请求体**:
```json
{
  "reference_type": "PURCHASE",  // PURCHASE, PRODUCTION, RETURN
  "reference_number": "PO-2025-004567",
  "material_number": "MAT-RAW-001",
  "plant": "PLANT-01",
  "storage_location": "SL-01",
  "batch": "BATCH-20251221",
  "inspection_type": "01",  // 来料检验
  "sample_size": 10
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "inspection_lot_number": "0400001234",
    "status": "RELEASED",
    "material_number": "MAT-RAW-001",
    "plant": "PLANT-01",
    "sample_size": 10,
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

#### 13.1.2 提交检验结果

**接口**: `POST /inspection-lots/{lot_number}/results`

**请求体**:
```json
{
  "inspector_id": "emp-0100",
  "characteristics": [
    {
      "char_code": "DIM-001",
      "result_value": 10.1,
      "unit": "MM",
      "status": "PASS"
    },
    {
      "char_code": "VIS-001",
      "status": "FAIL",
      "defect_code": "SCRATCH"
    }
  ],
  "remarks": "1件表面划伤"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "inspection_lot_number": "0400001234",
    "results_status": "RECORDED",
    "nonconforming_units": 1
  }
}
```

---

#### 13.1.3 质量通知 (QN)

**接口**: `POST /quality-notifications`

**请求体**:
```json
{
  "notification_type": "Q1",  // Q1=内部缺陷, Q2=客户投诉, Q3=供应商缺陷
  "reference_document": "PO-2025-004567",
  "material_number": "MAT-RAW-001",
  "defect_code": "SCRATCH",
  "priority": "MEDIUM",
  "description": "表面划伤影响外观",
  "reported_by": "emp-0100",
  "attachments": []
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "notification_number": "QN-2025-000789",
    "status": "OPEN",
    "assigned_group": "QA-PLANT-01",
    "created_at": "2025-12-21T10:30:00Z"
  }
}
```

---

#### 13.1.4 使用决定

**接口**: `POST /inspection-lots/{lot_number}/usage-decision`

**请求体**:
```json
{
  "decision_code": "ACCEPT_WITH_DEDUCTION",  // ACCEPT, REJECT, ACCEPT_WITH_DEDUCTION
  "accepted_quantity": 9,
  "rejected_quantity": 1,
  "follow_up_action": "RETURN_TO_VENDOR",  // SCRAP, REWORK, RETURN_TO_VENDOR
  "stock_posting": "UNRESTRICTED"          // UNRESTRICTED, BLOCKED, SCRAP
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "inspection_lot_number": "0400001234",
    "usage_decision": "ACCEPT_WITH_DEDUCTION",
    "stock_posted": true,
    "material_document": "MD-2025-009001"
  }
}
```

---

## 14. 设备维护 API (PM)

**Base URL**: `https://api.erp.example.com/pm/v1`

### 14.1 设备主数据 (Equipment)

#### 14.1.1 创建设备

**接口**: `POST /equipments`

**请求体**:
```json
{
  "equipment_number": null,  // 可选，系统自动分配
  "description": "空压机 GA90",
  "category": "MACHINE",
  "serial_number": "GA90-2020-001234",
  "functional_location": "PLANT-BJ-COMP-001",
  "manufacturer": "Atlas Copco",
  "model": "GA 90",
  "install_date": "2020-05-15",
  "cost_center": "CC-MFG-01",
  "main_work_center": "MECH-BJ-01"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "equipment_id": "eq-123",
    "equipment_number": "EQ-2025-000789",
    "functional_location": "PLANT-BJ-COMP-001",
    "status": "INSTALLED",
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

### 14.2 维护通知 (Notifications)

#### 14.2.1 创建维护通知

**接口**: `POST /maintenance-notifications`

**请求体**:
```json
{
  "equipment_number": "EQ-2025-000789",
  "priority": "HIGH",  // LOW, MEDIUM, HIGH, EMERGENCY
  "symptom_code": "NOISE",
  "description": "轴承异常噪音",
  "reported_by": "emp-0100",
  "required_start": "2025-12-21T18:00:00Z",
  "attachments": []
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "notification_number": "MN-2025-000456",
    "status": "OPEN",
    "equipment_number": "EQ-2025-000789",
    "created_at": "2025-12-21T12:00:00Z"
  }
}
```

---

### 14.3 维护工单 (Orders)

#### 14.3.1 创建维护工单

**接口**: `POST /maintenance-orders`

**请求体**:
```json
{
  "notification_number": "MN-2025-000456",
  "equipment_number": "EQ-2025-000789",
  "order_type": "PM02",  // PM01=纠正性, PM02=预防性
  "planning_plant": "PLANT-01",
  "main_work_center": "MECH-BJ-01",
  "planned_start": "2025-12-21T18:00:00Z",
  "planned_finish": "2025-12-21T22:00:00Z",
  "operations": [
    {
      "operation_number": 10,
      "work_center": "MECH-BJ-01",
      "activity_type": "MECH",
      "planned_hours": 4.0
    }
  ],
  "components": [
    {
      "material_number": "MAT-BEARING-6310-2RS",
      "quantity": 2,
      "unit": "EA",
      "storage_location": "SL-01"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "maintenance_order_number": "MO-2025-000321",
    "status": "RELEASED",
    "equipment_number": "EQ-2025-000789",
    "notification_number": "MN-2025-000456",
    "planned_cost": 1200.00,
    "currency": "CNY"
  }
}
```

---

#### 14.3.2 维护完工确认

**接口**: `POST /maintenance-orders/{order_number}/confirm`

**请求体**:
```json
{
  "actual_start": "2025-12-21T18:00:00Z",
  "actual_finish": "2025-12-21T22:00:00Z",
  "labor_hours": 3.5,
  "used_materials": [
    {
      "material_number": "MAT-BEARING-6310-2RS",
      "quantity": 2,
      "unit": "EA"
    }
  ],
  "technical_completion": true,
  "completion_notes": "更换轴承并校准传感器"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "maintenance_order_number": "MO-2025-000321",
    "status": "TECO",
    "actual_cost": 1180.00,
    "currency": "CNY",
    "confirmed_at": "2025-12-21T22:10:00Z"
  }
}
```

---

## 15. 仓储与运输 API (EWM/TM)

**Base URL**: `https://api.erp.example.com/logistics/v1`

### 15.1 仓储作业 (EWM)

#### 15.1.1 创建拣货任务

**接口**: `POST /warehouse-tasks/picking`

**请求体**:
```json
{
  "delivery_number": "DN-2025-005678",
  "wave_number": "WAVE-2025-001",
  "picker_id": "emp-0200",
  "items": [
    {
      "delivery_item": 10,
      "material_number": "MAT-001",
      "quantity": 100,
      "unit": "PC",
      "source_bin": "BIN-01-01-A",
      "destination_bin": "STAGE-01"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "warehouse_task_id": "wt-2025-000111",
    "status": "CREATED",
    "delivery_number": "DN-2025-005678",
    "assigned_to": "emp-0200"
  }
}
```

---

#### 15.1.2 确认仓储任务

**接口**: `POST /warehouse-tasks/{task_id}/confirm`

**请求体**:
```json
{
  "confirmed_quantity": 100,
  "exceptions": [],  // 如缺件可传 EXCEPTION 代码
  "confirmed_by": "emp-0200",
  "confirmation_time": "2025-12-21T10:30:00Z"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "warehouse_task_id": "wt-2025-000111",
    "status": "CONFIRMED",
    "material_document": "MD-2025-009100"
  }
}
```

---

### 15.2 运输计划与承运商协同 (TM)

#### 15.2.1 创建运输订单

**接口**: `POST /freight-orders`

**请求体**:
```json
{
  "shipment_type": "OUTBOUND",  // OUTBOUND, INBOUND
  "stops": [
    {
      "type": "PICKUP",
      "location": "PLANT-01",
      "planned_time": "2025-12-22T08:00:00Z"
    },
    {
      "type": "DROPOFF",
      "location": "CUSTOMER-SHANGHAI",
      "planned_time": "2025-12-23T14:00:00Z"
    }
  ],
  "vehicle_type": "TRUCK-10T",
  "carrier_id": "CARR-001",
  "related_documents": [
    {
      "type": "DELIVERY",
      "number": "DN-2025-005678"
    }
  ],
  "freight_charges_currency": "CNY"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "freight_order_number": "FO-2025-000123",
    "status": "PLANNED",
    "carrier_id": "CARR-001",
    "tender_status": "REQUESTED"
  }
}
```

---

#### 15.2.2 承运商回应

**接口**: `POST /freight-orders/{freight_order_number}/tender/confirm`

**请求体**:
```json
{
  "accepted": true,
  "carrier_reference": "CARR-001-FO-2025-000123",
  "accepted_by": "carrier.user",
  "accepted_at": "2025-12-21T13:00:00Z",
  "eta": "2025-12-22T08:00:00Z"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "freight_order_number": "FO-2025-000123",
    "tender_status": "ACCEPTED",
    "eta": "2025-12-22T08:00:00Z"
  }
}
```

---

## 16. 供应商协同与寻源 API (SRM/Ariba)

**Base URL**: `https://api.erp.example.com/procurement/v1`

### 16.1 询价/招标 (RFQ)

#### 16.1.1 创建询价单

**接口**: `POST /rfqs`

**请求体**:
```json
{
  "title": "原材料A 2025Q1采购",
  "category": "RAW_MATERIAL",
  "due_date": "2025-12-28T12:00:00Z",
  "currency": "CNY",
  "incoterms": "FOB",
  "payment_terms": "NET30",
  "items": [
    {
      "item_number": 10,
      "material_number": "MAT-RAW-001",
      "description": "原材料A",
      "quantity": 1000,
      "unit": "KG",
      "target_price": 50.00,
      "delivery_date": "2026-01-10"
    }
  ],
  "invited_suppliers": ["V-10001", "V-10002"]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "rfq_number": "RFQ-2025-000123",
    "status": "OPEN",
    "due_date": "2025-12-28T12:00:00Z",
    "items_count": 1,
    "invited_suppliers": 2,
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

#### 16.1.2 供应商报价

**接口**: `POST /rfqs/{rfq_number}/bids`

**请求体**:
```json
{
  "supplier_id": "V-10001",
  "valid_until": "2026-01-15",
  "currency": "CNY",
  "items": [
    {
      "item_number": 10,
      "quote_price": 48.50,
      "discount_percent": 2.0,
      "delivery_date": "2026-01-08"
    }
  ],
  "notes": "含运费，先到先得"
}
```

**业务规则校验**:
- 只能在 `due_date` 前提交或修改报价
- 报价币种需与RFQ一致

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "bid_id": "bid-2025-000999",
    "rfq_number": "RFQ-2025-000123",
    "supplier_id": "V-10001",
    "status": "SUBMITTED",
    "submitted_at": "2025-12-21T11:00:00Z"
  }
}
```

---

#### 16.1.3 评标与授标

**接口**: `POST /rfqs/{rfq_number}/award`

**请求体**:
```json
{
  "winning_bid_id": "bid-2025-000999",
  "justification": "最低总价且交期满足",
  "auto_create_po": true
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "rfq_number": "RFQ-2025-000123",
    "status": "AWARDED",
    "winning_bid_id": "bid-2025-000999",
    "po_number": "PO-2025-009999",
    "awarded_at": "2025-12-21T12:00:00Z"
  }
}
```

---

### 16.2 供应商主数据

#### 16.2.1 供应商准入/注册

**接口**: `POST /suppliers`

**请求体**:
```json
{
  "supplier_number": null,  // 可选，系统自动分配
  "name": "供应商A",
  "tax_id": "91310000XXXX",
  "contact": {
    "name": "李经理",
    "email": "li@supplier.com",
    "phone": "+86-13800001111"
  },
  "bank_account": {
    "bank_name": "ICBC",
    "account_number": "621700******1234",
    "currency": "CNY"
  },
  "categories": ["RAW_MATERIAL"],
  "payment_terms": "NET30",
  "incoterms": "FOB",
  "risk_score": 15
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "supplier_id": "sup-550e8400-e29b-41d4-a716-446655440000",
    "supplier_number": "V-10003",
    "name": "供应商A",
    "status": "APPROVED",
    "created_at": "2025-12-21T10:00:00Z"
  }
}
```

---

## 17. 主数据治理 API (MDG)

**Base URL**: `https://api.erp.example.com/mdg/v1`

### 17.1 变更请求 (Change Request)

#### 17.1.1 创建主数据变更请求

**接口**: `POST /change-requests`

**请求体**:
```json
{
  "entity_type": "SUPPLIER",  // CUSTOMER, SUPPLIER, MATERIAL
  "action": "CREATE",         // CREATE, UPDATE, DELETE
  "priority": "MEDIUM",       // LOW, MEDIUM, HIGH
  "initiator": "user-123",
  "reason": "新增海外供应商",
  "payload": {
    "supplier_number": null,
    "name": "供应商B",
    "country": "US",
    "tax_id": "99-9999999",
    "currency": "USD",
    "payment_terms": "NET45"
  }
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "change_request_number": "CR-2025-000456",
    "entity_type": "SUPPLIER",
    "action": "CREATE",
    "status": "SUBMITTED",
    "approver_group": "MDG-SUP",
    "sla_due_at": "2025-12-22T18:00:00Z",
    "created_at": "2025-12-21T11:00:00Z"
  }
}
```

---

#### 17.1.2 审批变更请求

**接口**: `POST /change-requests/{cr_number}/actions`

**请求体**:
```json
{
  "action": "APPROVE",  // APPROVE, REJECT
  "approver": "user-approver-01",
  "comments": "税号已验证"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "change_request_number": "CR-2025-000456",
    "status": "APPROVED",
    "approved_at": "2025-12-21T12:00:00Z",
    "replicated_to_core": true
  }
}
```

---

## 18. 供应链计划 API (IBP/PPDS)

**Base URL**: `https://api.erp.example.com/planning/v1`

### 18.1 需求计划 (Demand Planning)

#### 18.1.1 创建需求计划版本

**接口**: `POST /demand-plans`

**请求体**:
```json
{
  "plan_version": "FY2026-BUDGET",
  "currency": "CNY",
  "time_bucket": "MONTH",  // DAY, WEEK, MONTH
  "lines": [
    {
      "material_number": "MAT-001",
      "plant": "PLANT-01",
      "period": "2026-01",
      "forecast_quantity": 1200,
      "unit": "PC"
    },
    {
      "material_number": "MAT-001",
      "plant": "PLANT-01",
      "period": "2026-02",
      "forecast_quantity": 1500,
      "unit": "PC"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "plan_version": "FY2026-BUDGET",
    "lines_created": 2,
    "status": "ACTIVE",
    "created_at": "2025-12-21T10:30:00Z"
  }
}
```

---

### 18.2 MRP/供应计划运行

#### 18.2.1 触发MRP运行

**接口**: `POST /mrp/runs`

**请求体**:
```json
{
  "plants": ["PLANT-01"],
  "materials": ["MAT-001", "MAT-002"],
  "planning_horizon_days": 30,
  "use_latest_demand_plan": true,
  "lot_size_policy": "EX",  // EX=精确订单量
  "include_safety_stock": true
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "task_id": "mrp-task-2025-0001",
    "status": "PROCESSING",
    "status_url": "/tasks/mrp-task-2025-0001",
    "estimated_completion": "2025-12-21T10:45:00Z"
  }
}
```

**任务结果示例**: `GET /tasks/mrp-task-2025-0001`
```json
{
  "success": true,
  "data": {
    "task_id": "mrp-task-2025-0001",
    "status": "COMPLETED",
    "generated_planned_orders": 3,
    "generated_purchase_reqs": 2,
    "alerts": [
      {
        "material_number": "MAT-002",
        "type": "CAPACITY_CONSTRAINT",
        "message": "产能不足，建议分批生产"
      }
    ]
  }
}
```

---

## 19. 差旅与费用报销 API (Travel & Expense / Concur)

**Base URL**: `https://api.erp.example.com/expense/v1`

### 19.1 差旅申请

#### 19.1.1 创建差旅申请

**接口**: `POST /travel-requests`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "purpose": "客户会议与现场勘察",
  "start_date": "2026-01-10",
  "end_date": "2026-01-14",
  "destinations": ["Shanghai", "Suzhou"],
  "estimated_cost": 12000.00,
  "currency": "CNY",
  "cost_center": "CC-SALES-01",
  "project_code": "PRJ-CRM-01",
  "requires_booking": true
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "travel_request_number": "TR-2026-000123",
    "status": "PENDING",
    "approver_id": "emp-0002",
    "estimated_cost": 12000.00,
    "currency": "CNY",
    "created_at": "2025-12-22T10:00:00Z"
  }
}
```

---

#### 19.1.2 审批差旅申请

**接口**: `POST /travel-requests/{request_number}/approve`

**请求体**:
```json
{
  "approver_id": "emp-0002",
  "action": "APPROVE",  // APPROVE, REJECT
  "comments": "预算充足，同意出差"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "travel_request_number": "TR-2026-000123",
    "status": "APPROVED",
    "approved_at": "2025-12-22T12:00:00Z",
    "approved_by": "emp-0002"
  }
}
```

---

### 19.2 费用报销

#### 19.2.1 创建费用报销单

**接口**: `POST /expense-reports`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "travel_request_number": "TR-2026-000123",
  "report_date": "2026-01-15",
  "currency": "CNY",
  "lines": [
    {
      "line_number": 10,
      "expense_type": "AIRFARE",
      "amount": 4500.00,
      "currency": "CNY",
      "tax_code": "VAT13",
      "receipt_url": "https://files.example.com/receipts/air-123.pdf",
      "expense_date": "2026-01-10",
      "city": "Shanghai"
    },
    {
      "line_number": 20,
      "expense_type": "HOTEL",
      "amount": 3200.00,
      "currency": "CNY",
      "tax_code": "VAT6",
      "receipt_url": "https://files.example.com/receipts/hotel-456.pdf",
      "expense_date": "2026-01-11",
      "city": "Shanghai"
    }
  ]
}
```

**业务规则校验**:
- 必须关联已批准的差旅申请（如策略要求）
- 需要发票/凭证的行必须提供 `receipt_url`
- 金额超过阈值需二级审批

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "expense_report_number": "ER-2026-000555",
    "status": "DRAFT",
    "total_amount": 7700.00,
    "currency": "CNY",
    "lines_count": 2,
    "created_at": "2026-01-15T09:00:00Z"
  }
}
```

---

#### 19.2.2 提交/审核报销单

**接口**: `POST /expense-reports/{report_number}/submit`

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "expense_report_number": "ER-2026-000555",
    "status": "PENDING_APPROVAL",
    "approver_id": "emp-0002",
    "submitted_at": "2026-01-15T10:00:00Z"
  }
}
```

**审批接口**: `POST /expense-reports/{report_number}/approve`
```json
{
  "approver_id": "emp-0002",
  "action": "APPROVE",
  "comments": "发票齐全，金额合理"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "expense_report_number": "ER-2026-000555",
    "status": "APPROVED",
    "approved_at": "2026-01-15T12:00:00Z",
    "payment_run_date": "2026-01-20"
  }
}
```

---

## 20. 全球贸易与合规 API (GTS)

**Base URL**: `https://api.erp.example.com/gts/v1`

### 20.1 制裁名单与合规检查

**接口**: `POST /compliance-checks`

**请求体**:
```json
{
  "partner_type": "CUSTOMER",
  "name": "ACME Trading LLC",
  "country": "IR",
  "address": "Tehran, ...",
  "identifier": "ID-12345",
  "transaction_value": 50000,
  "currency": "USD"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "check_id": "gts-ck-0001",
    "result": "REJECT",  // PASS, REVIEW, REJECT
    "matched_lists": ["OFAC-SDN"],
    "risk_score": 95,
    "created_at": "2025-12-22T10:00:00Z"
  }
}
```

---

### 20.2 商品分类与出口管制

**接口**: `POST /product-classifications`

**请求体**:
```json
{
  "material_number": "MAT-001",
  "country": "US",
  "hs_code": "841480",
  "eccn": "2B999",
  "control_indicators": ["NLR"],
  "effective_from": "2025-12-22"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "classification_id": "cls-2025-0001",
    "material_number": "MAT-001",
    "country": "US",
    "hs_code": "841480",
    "eccn": "2B999",
    "created_at": "2025-12-22T11:00:00Z"
  }
}
```

---

### 20.3 报关申报

**接口**: `POST /customs-declarations`

**请求体**:
```json
{
  "declaration_type": "EXPORT",
  "commercial_invoice": "INV-2025-009876",
  "country_of_export": "CN",
  "country_of_import": "US",
  "line_items": [
    {
      "item_number": 10,
      "material_number": "MAT-001",
      "quantity": 100,
      "unit": "PC",
      "gross_weight": 250.0,
      "hs_code": "841480",
      "customs_value": 50000.00,
      "currency": "USD"
    }
  ],
  "forwarder": "DHL",
  "port_of_loading": "Shanghai",
  "port_of_discharge": "Los Angeles"
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "declaration_number": "CUS-2025-000888",
    "status": "SUBMITTED",
    "status_url": "/gts/v1/customs-declarations/CUS-2025-000888/status",
    "created_at": "2025-12-22T12:00:00Z"
  }
}
```

---

## 21. 治理、风险与合规 API (GRC AC/PC)

**Base URL**: `https://api.erp.example.com/grc/v1`

### 21.1 职责分离 (SoD) 风险分析

**接口**: `POST /sod-checks`

**请求体**:
```json
{
  "user_id": "user-123",
  "roles_to_assign": ["FIN_AP_CLERK", "FIN_PAYMENT_RUN"],
  "system": "ERP-PRD",
  "business_process": "FI"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "check_id": "sod-2025-0001",
    "result": "VIOLATION",
    "violations": [
      {
        "rule_id": "SOD-FI-001",
        "description": "创建供应商与执行付款不可同岗",
        "conflicting_roles": ["FIN_VENDOR_CREATE", "FIN_PAYMENT_RUN"],
        "mitigation_control": "PAYMENT_REVIEW_BY_CONTROLLER"
      }
    ],
    "created_at": "2025-12-22T10:30:00Z"
  }
}
```

---

### 21.2 访问申请与审批

**接口**: `POST /access-requests`

**请求体**:
```json
{
  "user_id": "user-123",
  "requested_roles": ["FIN_PAYMENT_RUN"],
  "justification": "需要执行月度付款批次",
  "valid_from": "2025-12-22",
  "valid_to": "2026-01-31",
  "approver_chain": ["mgr-001", "controller-001"]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "access_request_number": "AR-2025-000789",
    "status": "PENDING",
    "next_approver": "mgr-001",
    "sod_check_id": "sod-2025-0001",
    "created_at": "2025-12-22T11:00:00Z"
  }
}
```

---

### 21.3 控制测试记录

**接口**: `POST /controls/{control_id}/tests`

**请求体**:
```json
{
  "control_id": "PAYMENT_REVIEW_BY_CONTROLLER",
  "test_period": "2025-Q4",
  "tester": "audit-001",
  "evidence_links": ["https://files.example.com/audit/payments-q4.zip"],
  "result": "EFFECTIVE",
  "comments": "抽样10笔均有复核签字"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "control_test_id": "ct-2025-0005",
    "control_id": "PAYMENT_REVIEW_BY_CONTROLLER",
    "result": "EFFECTIVE",
    "tested_at": "2025-12-22T12:00:00Z"
  }
}
```

---

## 22. 扩展错误码与权限矩阵

### 22.1 错误码补充

| 范围 | 错误码 | HTTP | 说明 |
|------|--------|------|------|
| 差旅/报销 | TRAVEL_NOT_APPROVED | 422 | 差旅申请未批准，禁止报销关联 |
| 差旅/报销 | RECEIPT_REQUIRED | 422 | 未上传必须的发票/凭证 |
| 差旅/报销 | OVER_POLICY_LIMIT | 422 | 金额/天数超出公司差旅政策 |
| GTS | COMPLIANCE_REJECTED | 403 | 制裁名单命中，交易被拒 |
| GTS | EXPORT_CONTROL_BLOCK | 403 | 出口管制受限，需合规放行 |
| GTS | CLASSIFICATION_MISSING | 422 | 缺失HS/ECCN分类，无法申报 |
| GRC | SOD_VIOLATION | 409 | 职责分离冲突，需缓释或拒绝 |
| GRC | APPROVER_NOT_AUTHORIZED | 403 | 审批人不具备对应控制权限 |

### 22.2 权限矩阵（角色 → 关键接口）

| 角色 | 关键接口 | 说明 |
|------|---------|------|
| `EMPLOYEE` | 19.1 创建/查询差旅申请；19.2 创建/提交报销 | 仅可操作本人记录 |
| `MANAGER` | 19.1 审批差旅；19.2 审批报销 | 需与层级校验 |
| `FIN_AP_CLERK` | 19.2 报销复核；20.3 报关草稿创建 | 财务应付角色 |
| `GTS_OFFICER` | 20.1 合规检查；20.2 商品分类；20.3 报关提交 | 具备合规放行权限 |
| `GRC_ANALYST` | 21.1 SoD 检查；21.2 访问申请审批；21.3 控制测试 | 内控/审计 |
| `MDG_STEWARD` | 17.1 变更请求审批 | 主数据治理 |
| `PROCUREMENT` | 16.1 RFQ 创建/授标；16.2 供应商准入 | 采购角色 |

### 22.3 异步任务/回调约定

- 通用任务状态：`PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`
- 回调URL（可选）：在请求体中传 `callback_url`，服务完成后以 `POST` 回传：
```json
{
  "task_id": "mrp-task-2025-0001",
  "status": "COMPLETED",
  "result_ref": "https://storage.example.com/tasks/mrp-task-2025-0001/result.json",
  "completed_at": "2025-12-21T10:45:12Z"
}
```
- 典型异步接口：报表生成(2.4)、MRP运行(18.2)、报关申报(20.3)、大批量RFQ授标生成PO(16.1)。

### 22.4 枚举与主数据对齐说明

- 币种：ISO 4217 (`CNY`, `USD`...)
- HS编码：WCO HS 6位或本地扩展；ECCN：符合出口管制目录
- 港口/地点：UN/LOCODE
- 税码：与财务模块 2.2/3.1 保持一致 (`VAT13`, `VAT6` 等)
- 角色/权限：与 IAM/RBAC 目录一致，采用最小权限原则

---

**文档版本**: v1.4
**最后更新**: 2025-12-22
**维护者**: ERP 开发团队

## 23. 项目系统 API (PS)

**Base URL**: `https://api.erp.example.com/ps/v1`

### 23.1 项目与WBS

#### 23.1.1 创建项目定义

**接口**: `POST /projects`

**请求体**:
```json
{
  "project_code": "PRJ-2026-001",  // 可选，系统生成
  "description": "新工厂产线扩建",
  "start_date": "2026-02-01",
  "end_date": "2026-08-31",
  "responsible": "emp-0100",
  "company_code": "1000",
  "currency": "CNY"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "project_id": "ps-123",
    "project_code": "PRJ-2026-001",
    "status": "CREATED",
    "created_at": "2025-12-22T10:00:00Z"
  }
}
```

---

#### 23.1.2 创建WBS节点

**接口**: `POST /projects/{project_code}/wbs`

**请求体**:
```json
{
  "wbs_code": "PRJ-2026-001-01",
  "description": "土建施工",
  "parent_wbs": null,
  "start_date": "2026-02-01",
  "end_date": "2026-04-30",
  "responsible": "emp-0200",
  "budget": 3000000,
  "currency": "CNY"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "wbs_id": "wbs-001",
    "wbs_code": "PRJ-2026-001-01",
    "status": "RELEASED",
    "created_at": "2025-12-22T10:10:00Z"
  }
}
```

---

### 23.2 网络与作业

#### 23.2.1 创建网络及作业

**接口**: `POST /networks`

**请求体**:
```json
{
  "network_number": null,
  "project_code": "PRJ-2026-001",
  "wbs_code": "PRJ-2026-001-01",
  "activities": [
    {
      "activity_number": 10,
      "description": "基础施工",
      "work_center": "CIVIL-01",
      "planned_hours": 400,
      "planned_cost": 800000,
      "currency": "CNY",
      "start_date": "2026-02-01",
      "end_date": "2026-02-28"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "network_id": "ntw-001",
    "network_number": "NTW-2026-0001",
    "activities_count": 1,
    "status": "RELEASED"
  }
}
```

---

### 23.3 里程碑与进度

#### 23.3.1 完成里程碑

**接口**: `POST /projects/{project_code}/milestones/{milestone_code}/complete`

**请求体**:
```json
{
  "completion_date": "2026-02-28",
  "confirmed_by": "emp-0200",
  "notes": "土建基础验收完成"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "milestone_code": "MS-FOUNDATION",
    "status": "COMPLETED",
    "completed_at": "2026-02-28T18:00:00Z"
  }
}
```

---

### 23.4 成本/收入分配

#### 23.4.1 记录项目成本

**接口**: `POST /projects/{project_code}/costs`

**请求体**:
```json
{
  "posting_date": "2026-02-15",
  "wbs_code": "PRJ-2026-001-01",
  "amount": 500000,
  "currency": "CNY",
  "cost_element": "610000",
  "reference": "MIRO-2026-0001",
  "description": "土建进度款"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "project_code": "PRJ-2026-001",
    "wbs_code": "PRJ-2026-001-01",
    "cost_document": "PC-2026-0001",
    "amount": 500000,
    "currency": "CNY"
  }
}
```

---

## 24. 产品生命周期管理 API (PLM)

**Base URL**: `https://api.erp.example.com/plm/v1`

### 24.1 工程变更 (ECN)

#### 24.1.1 创建工程变更单

**接口**: `POST /engineering-changes`

**请求体**:
```json
{
  "change_number": null,
  "title": "产品A版本升级",
  "reason": "提升散热性能",
  "effective_from": "2026-03-01",
  "initiator": "eng-001",
  "affected_materials": ["MAT-001"],
  "attachments": []
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "change_number": "ECN-2026-0001",
    "status": "DRAFT",
    "created_at": "2025-12-22T11:00:00Z"
  }
}
```

---

### 24.2 BOM 与配方

#### 24.2.1 更新物料清单

**接口**: `POST /boms/{material_number}/revisions`

**请求体**:
```json
{
  "ecn_number": "ECN-2026-0001",
  "revision": "B",
  "valid_from": "2026-03-01",
  "components": [
    {
      "item_number": 10,
      "component_material": "MAT-PART-100",
      "quantity": 2,
      "unit": "EA"
    },
    {
      "item_number": 20,
      "component_material": "MAT-PART-200",
      "quantity": 1,
      "unit": "EA"
    }
  ]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "material_number": "MAT-001",
    "revision": "B",
    "ecn_number": "ECN-2026-0001",
    "status": "EFFECTIVE"
  }
}
```

---

### 24.3 文档与合规

#### 24.3.1 上传产品合规文件

**接口**: `POST /materials/{material_number}/compliance-docs`

**请求体**:
```json
{
  "doc_type": "ROHS",  // ROHS, REACH, MSDS
  "effective_from": "2026-03-01",
  "file_url": "https://files.example.com/compliance/rohsmat001.pdf"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "material_number": "MAT-001",
    "doc_type": "ROHS",
    "status": "ACTIVE"
  }
}
```

---

## 25. 供应链金融与资金管理 API (FSCM / TRM)

**Base URL**: `https://api.erp.example.com/finance-ext/v1`

### 25.1 信用管理

#### 25.1.1 信用额度检查

**接口**: `POST /credit-checks`

**请求体**:
```json
{
  "customer_id": "cust-12345",
  "order_gross_value": 110175.00,
  "currency": "CNY",
  "exposure_before": 500000.00
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "passed": true,
    "credit_limit": 1000000.00,
    "exposure_after": 610175.00,
    "decision_code": "AUTO_APPROVED"
  }
}
```

---

### 25.2 催收与争议

#### 25.2.1 发起催收案例

**接口**: `POST /collections`

**请求体**:
```json
{
  "customer_id": "cust-12345",
  "invoice_number": "INV-2025-009876",
  "overdue_days": 15,
  "amount_due": 53675.00,
  "currency": "CNY",
  "priority": "MEDIUM"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "collection_case_id": "col-2025-0001",
    "status": "OPEN",
    "next_action_due": "2025-12-27"
  }
}
```

---

#### 25.2.2 创建争议案例

**接口**: `POST /disputes`

**请求体**:
```json
{
  "invoice_number": "INV-2025-009876",
  "reason_code": "PRICE_DISCREPANCY",
  "disputed_amount": 1000.00,
  "currency": "CNY",
  "description": "折扣未按约定执行"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "dispute_id": "disp-2025-0001",
    "status": "OPEN",
    "assigned_to": "fin-collector-01"
  }
}
```

---

### 25.3 资金与现金管理 (TRM)

#### 25.3.1 现金流预测

**接口**: `POST /cash-forecasts`

**请求体**:
```json
{
  "forecast_horizon_days": 30,
  "company_code": "1000",
  "currency": "CNY",
  "include_ar": true,
  "include_ap": true,
  "include_payroll": true
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "forecast_id": "cf-2025-0001",
    "horizon_days": 30,
    "total_inflows": 12000000.00,
    "total_outflows": 8500000.00,
    "net_position": 3500000.00,
    "currency": "CNY",
    "generated_at": "2025-12-22T12:00:00Z"
  }
}
```

---

#### 25.3.2 资金交易登记

**接口**: `POST /treasury-deals`

**请求体**:
```json
{
  "deal_type": "FX_SPOT",  // FX_SPOT, FX_FORWARD, MM_DEPOSIT, MM_LOAN
  "counterparty": "BANK-ICBC",
  "trade_date": "2025-12-22",
  "value_date": "2025-12-24",
  "buy_currency": "USD",
  "sell_currency": "CNY",
  "buy_amount": 1000000.00,
  "fx_rate": 7.10
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "deal_id": "deal-2025-0001",
    "status": "CONFIRMED",
    "settlement_instructions": "STD-NOSTRO-ICBC"
  }
}
```

---

## 26. 外部劳务管理 API (Fieldglass)

**Base URL**: `https://api.erp.example.com/contingent/v1`

### 26.1 外包/临时工工单

#### 26.1.1 创建外包需求

**接口**: `POST /work-orders`

**请求体**:
```json
{
  "title": "DevOps 外包工程师",
  "business_unit": "IT",
  "location": "Beijing-HQ",
  "start_date": "2026-01-05",
  "end_date": "2026-06-30",
  "supplier_id": "V-EXT-001",
  "rate": 500.00,
  "rate_unit": "HOUR",
  "max_hours_per_week": 40,
  "cost_center": "CC-IT-OPS"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "work_order_id": "wo-2026-0001",
    "status": "OPEN",
    "supplier_id": "V-EXT-001",
    "created_at": "2025-12-22T13:00:00Z"
  }
}
```

---

### 26.2 外包人员与工时

#### 26.2.1 注册外包人员

**接口**: `POST /contingent-workers`

**请求体**:
```json
{
  "work_order_id": "wo-2026-0001",
  "name": "李四",
  "email": "li.si@vendor.com",
  "role": "DevOps Engineer",
  "badge_id": "BADGE-9001",
  "access_start": "2026-01-05",
  "access_end": "2026-06-30"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "contingent_worker_id": "cw-2026-0001",
    "status": "ACTIVE",
    "badge_id": "BADGE-9001"
  }
}
```

---

#### 26.2.2 外包工时提交

**接口**: `POST /contingent-time-entries`

**请求体**:
```json
{
  "contingent_worker_id": "cw-2026-0001",
  "work_date": "2026-01-10",
  "hours": 8.0,
  "project_code": "PRJ-ERP-01",
  "approver_id": "emp-0100"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "time_entry_id": "ct-2026-0001",
    "status": "PENDING_APPROVAL"
  }
}
```

---

## 27. SuccessFactors 云场景 API (绩效/入职/薪酬)

**Base URL**: `https://api.erp.example.com/sf/v1`

### 27.1 绩效与目标 (Performance & Goals)

#### 27.1.1 创建绩效目标

**接口**: `POST /performance/goals`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "goal_cycle": "2026-H1",
  "title": "提升客户满意度",
  "description": "NPS 提升 5 分",
  "weight": 0.3,
  "due_date": "2026-06-30"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "goal_id": "goal-2026-0001",
    "status": "ACTIVE",
    "created_at": "2025-12-22T14:00:00Z"
  }
}
```

---

### 27.2 入职 (Onboarding)

#### 27.2.1 触发入职流程

**接口**: `POST /onboarding/flows`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "start_date": "2026-01-05",
  "location": "Beijing-HQ",
  "tasks": ["UPLOAD_ID", "IT_ASSET_SETUP", "BANK_INFO"]
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "onboarding_flow_id": "onb-2026-0001",
    "status": "IN_PROGRESS",
    "tasks_total": 3
  }
}
```

---

### 27.3 薪酬 (Compensation)

#### 27.3.1 创建薪酬调整方案

**接口**: `POST /compensation/adjustments`

**请求体**:
```json
{
  "employee_id": "emp-550e8400-e29b-41d4-a716-446655440000",
  "plan_year": 2026,
  "currency": "CNY",
  "base_increase_percent": 5.0,
  "lump_sum": 10000.00,
  "reason": "年度绩效A档"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "comp_adjustment_id": "comp-2026-0001",
    "status": "APPROVAL_PENDING",
    "proposed_new_base": 630000.00
  }
}
```

---

## 28. 房地产管理 API (RE-FX)

**Base URL**: `https://api.erp.example.com/realestate/v1`

### 28.1 合同管理

#### 28.1.1 创建租赁合同

**接口**: `POST /lease-contracts`

**请求体**:
```json
{
  "contract_number": null,
  "property_id": "PROP-001",
  "tenant": "ACME Co.",
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "currency": "CNY",
  "base_rent": 50000.00,
  "billing_cycle": "MONTHLY",
  "payment_terms": "NET30"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "contract_id": "lc-2026-0001",
    "contract_number": "LC-2026-0001",
    "status": "ACTIVE"
  }
}
```

---

### 28.2 租金结算

**接口**: `POST /lease-contracts/{contract_number}/billing`

**请求体**:
```json
{
  "period": "2026-02",
  "service_charges": 3000.00,
  "tax_code": "VAT6"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "invoice_number": "RE-INV-2026-0001",
    "gross_amount": 56000.00,
    "currency": "CNY",
    "due_date": "2026-03-02"
  }
}
```

---

## 29. 车队管理 API (FM)

**Base URL**: `https://api.erp.example.com/fleet/v1`

### 29.1 车辆主数据

**接口**: `POST /vehicles`

**请求体**:
```json
{
  "vin": "LJ1234567890",
  "plate_number": "京A12345",
  "vehicle_type": "TRUCK",
  "purchase_date": "2024-05-01",
  "fuel_type": "DIESEL",
  "cost_center": "CC-LOG-01"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "vehicle_id": "veh-2025-0001",
    "status": "ACTIVE"
  }
}
```

---

### 29.2 维修与保养

**接口**: `POST /vehicles/{vehicle_id}/maintenance`

**请求体**:
```json
{
  "service_date": "2025-12-25",
  "service_type": "PREVENTIVE",  // PREVENTIVE, CORRECTIVE
  "odometer": 80000,
  "workshop": "WS-BJ-01",
  "cost": 2500.00,
  "currency": "CNY"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "maintenance_id": "vehm-2025-0001",
    "vehicle_id": "veh-2025-0001",
    "next_service_due_km": 90000
  }
}
```

---

### 29.3 油耗记录

**接口**: `POST /vehicles/{vehicle_id}/fuel-consumptions`

**请求体**:
```json
{
  "fill_date": "2025-12-20",
  "volume": 80,
  "unit": "L",
  "cost": 720.00,
  "currency": "CNY",
  "odometer": 79500
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "fuel_id": "fu-2025-0001",
    "avg_consumption_l_per_100km": 10.5
  }
}
```

---

## 30. 技术平台与集成附录

- **API Gateway/Fiori Launchpad**：统一网关前置认证、路由和流控；UI5/Fiori 前端通过 OData/REST 调用业务服务。
- **BI/BW 报表输出**：通过异步任务导出到对象存储，返回 `report_url` 与有效期；对接外部 BI 时提供预签名 URL。
- **事件/回调安全**：回调请求携带 `X-Signature` (HMAC-SHA256) 与 `timestamp`，服务端需验证防重放。

---

## 31. 新增模块错误码与权限补充

### 31.1 错误码补充

| 范围 | 错误码 | HTTP | 说明 |
|------|--------|------|------|
| PS | WBS_NOT_FOUND | 404 | WBS 不存在或未发布 |
| PS | BUDGET_EXCEEDED | 422 | 成本过账超预算 |
| PS | MILESTONE_NOT_FOUND | 404 | 里程碑不存在 |
| PLM | ECN_ALREADY_ACTIVE | 409 | 工程变更已生效或重复提交 |
| PLM | BOM_REVISION_CONFLICT | 409 | 同一版本号已存在 |
| PLM | COMPLIANCE_DOC_MISSING | 422 | 合规文件缺失 |
| FSCM | CREDIT_CHECK_FAILED | 403 | 信用检查失败 |
| FSCM | COLLECTION_CLOSED | 409 | 催收案例已关闭 |
| TRM | FX_RATE_MISSING | 422 | 缺少汇率或曲线 |
| TRM | DEAL_INCONSISTENT | 422 | 交易参数不一致（买卖币种/金额） |
| Fieldglass | WORK_ORDER_CLOSED | 409 | 工单已关闭，禁止新增人员/工时 |
| Fieldglass | HOURS_EXCEED_LIMIT | 422 | 工时超过上限或重复提交 |
| RE-FX | LEASE_OVERLAP | 422 | 合同期间与现有合同重叠 |
| RE-FX | PROPERTY_NOT_FOUND | 404 | 物业不存在 |
| FM | VEHICLE_NOT_FOUND | 404 | 车辆不存在 |
| FM | ODOMETER_ROLLBACK | 422 | 里程表回退，需人工校验 |
| SuccessFactors | GOAL_CYCLE_CLOSED | 409 | 目标周期已关闭 |
| SuccessFactors | COMP_APPROVAL_REQUIRED | 403 | 薪酬需审批后才能生效 |
| SuccessFactors | ONBOARDING_TASK_INVALID | 422 | 入职任务标识无效 |

### 31.2 权限矩阵增补

| 角色 | 关键接口 | 说明 |
|------|---------|------|
| `PROJECT_MANAGER` | 23.x 项目/WBS/里程碑 | 项目创建、WBS维护 |
| `PROJECT_CONTROLLER` | 23.4 成本过账 | 预算/成本控制 |
| `ENGINEERING` | 24.x ECN/BOM/文档 | 工程变更与BOM修订 |
| `PLM_CONTROLLER` | 24.x 审批 | 合规与版本发布 |
| `CREDIT_MANAGER` | 25.1 信用检查 | 额度审批 |
| `COLLECTION_AGENT` | 25.2 催收/争议 | 应收催收 |
| `TREASURY_USER` | 25.3 资金交易/预测 | 资金前台/中台 |
| `FIELDGLASS_MANAGER` | 26.x 工单/人员/工时 | 外包管理 |
| `REAL_ESTATE_MANAGER` | 28.x 合同/结算 | 房地产合同与结算 |
| `FLEET_MANAGER` | 29.x 车辆/维保/油耗 | 车队管理 |
| `HR_COMPENSATION` | 27.3 薪酬调整 | 薪酬方案审批 |

## 32. 回调签名与重放防护示例

- 请求头：
  - `X-Signature`: `HMAC-SHA256(secret, timestamp + "\n" + path + "\n" + body_sha256)`
  - `X-Timestamp`: Unix epoch (seconds)
  - `X-Request-Id`: 唯一请求ID
- 验证流程（伪代码）：
```text
assert abs(now - X-Timestamp) < 300s
body_hash = sha256(request_body)
expected = hmac_sha256(secret, f"{X-Timestamp}\n{request_path}\n{body_hash}")
assert hmac_compare(expected, X-Signature)
```
- 对支持回调的异步任务（报关申报、MRP、报表、RFQ授标、资金交易结算）均可启用；如失败应返回 5xx 让调用方重试。

---

## 33. 业务规划与合并 API (BPC)

**Base URL**: `https://api.erp.example.com/bpc/v1`

### 33.1 计划版本

**接口**: `POST /plan-versions`

**请求体**:
```json
{
  "plan_id": "PLAN-FY2026",
  "description": "FY2026 预算版本",
  "currency": "CNY",
  "time_bucket": "MONTH",
  "copy_from": "PLAN-FY2025-ACTUAL"  // 可选
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "plan_version": "PLAN-FY2026",
    "status": "OPEN",
    "created_at": "2025-12-22T15:00:00Z"
  }
}
```

---

### 33.2 提交预算数据

**接口**: `POST /plan-versions/{plan_version}/lines`

**请求体**:
```json
{
  "cost_center": "CC-IT-01",
  "account": "610000",
  "period": "2026-01",
  "amount": 200000,
  "currency": "CNY",
  "comment": "研发支出"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "plan_version": "PLAN-FY2026",
    "line_id": "bpc-line-001",
    "status": "SAVED"
  }
}
```

---

### 33.3 合并运行

**接口**: `POST /consolidations`

**请求体**:
```json
{
  "consol_id": "CONSOL-FY2026-Q1",
  "scope": ["COMPANY-1000", "COMPANY-2000"],
  "plan_version": "PLAN-FY2026",
  "currency": "CNY",
  "elimination_rules": ["INTERCO-SALES", "INTERCO-AR"],
  "callback_url": "https://hooks.example.com/bpc"
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "task_id": "bpc-task-0001",
    "status": "PROCESSING",
    "status_url": "/bpc/v1/tasks/bpc-task-0001"
  }
}
```

---

## 34. 分析与报表 API (SAC/BW)

**Base URL**: `https://api.erp.example.com/analytics/v1`

### 34.1 数据集导入

**接口**: `POST /datasets`

**请求体**:
```json
{
  "dataset_name": "sales_monthly",
  "description": "月度销售汇总",
  "schema": [
    {"name": "period", "type": "STRING"},
    {"name": "sales_org", "type": "STRING"},
    {"name": "gross_value", "type": "NUMBER"}
  ],
  "source": "sales-service",
  "callback_url": "https://hooks.example.com/analytics"
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "dataset_id": "ds-2025-0001",
    "upload_url": "https://storage.example.com/upload/ds-2025-0001",
    "status": "WAITING_UPLOAD"
  }
}
```

---

### 34.2 报表生成/导出

**接口**: `POST /reports`

**请求体**:
```json
{
  "report_name": "sales-pivot",
  "dataset_id": "ds-2025-0001",
  "format": "PDF",
  "filters": {
    "period_from": "2025-01",
    "period_to": "2025-12"
  }
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "task_id": "anl-task-0001",
    "status": "PROCESSING",
    "status_url": "/analytics/v1/tasks/anl-task-0001"
  }
}
```

---

## 35. 集成与中台 API (PI/PO/CPI)

**Base URL**: `https://api.erp.example.com/integration/v1`

### 35.1 注册接口

**接口**: `POST /interfaces`

**请求体**:
```json
{
  "name": "ARIBA-PO-INBOUND",
  "direction": "INBOUND",
  "protocol": "HTTPS",
  "mapping": "XSLT-PO-1.0",
  "target_service": "purchase-orders",
  "retry_policy": "EXPONENTIAL_BACKOFF"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "interface_id": "if-2025-0001",
    "status": "ACTIVE"
  }
}
```

---

### 35.2 发送消息（异步）

**接口**: `POST /messages`

**请求体**:
```json
{
  "interface_id": "if-2025-0001",
  "payload": "<PurchaseOrder>...</PurchaseOrder>",
  "content_type": "application/xml"
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "message_id": "msg-2025-0001",
    "status": "QUEUED"
  }
}
```

---

### 35.3 映射测试

**接口**: `POST /interfaces/{interface_id}/mappings/test`

**请求体**:
```json
{
  "payload": "<PurchaseOrder>...</PurchaseOrder>",
  "mapping": "XSLT-PO-1.0"
}
```

**响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "output_sample": "<MappedPO>...</MappedPO>",
    "warnings": []
  }
}
```

---

## 36. IoT 与资产智能 API (IoT/AIN)

**Base URL**: `https://api.erp.example.com/iot/v1`

### 36.1 设备注册

**接口**: `POST /devices`

**请求体**:
```json
{
  "device_id": "COMP-BJ-001",
  "type": "IndustrialCompressor",
  "location": {
    "latitude": 39.9042,
    "longitude": 116.4074
  },
  "thing_model": "IndustrialCompressor-v1"
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "device_id": "COMP-BJ-001",
    "status": "ACTIVE",
    "registration_token": "iot-token-123"
  }
}
```

---

### 36.2 遥测上报

**接口**: `POST /devices/{device_id}/telemetry`

**请求体**:
```json
{
  "timestamp": "2025-12-22T14:00:00Z",
  "metrics": {
    "outletTemperature": 88.0,
    "vibrationRms": 7.8,
    "dischargePressure": 7.9,
    "motorCurrent": 175.0
  }
}
```

**响应** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "ingest_id": "ing-2025-0001",
    "status": "QUEUED"
  }
}
```

---

### 36.3 告警创建

**接口**: `POST /alerts`

**请求体**:
```json
{
  "device_id": "COMP-BJ-001",
  "severity": "WARNING",
  "rule_code": "HIGH_TEMP",
  "message": "压缩机出口温度过高",
  "recommended_action": "检查冷却系统",
  "create_pm_order": true
}
```

**响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "alert_id": "alt-2025-0001",
    "status": "OPEN",
    "linked_pm_order": "MO-2025-000322"
  }
}
```

---

## 37. 新增模块错误码与权限补充（BPC/Analytics/Integration/IoT）

### 37.1 错误码补充

| 范围 | 错误码 | HTTP | 说明 |
|------|--------|------|------|
| BPC | PLAN_VERSION_LOCKED | 409 | 计划版本已锁定 |
| BPC | CONSOL_SCOPE_INVALID | 422 | 合并范围无效或缺实体 |
| Analytics | DATASET_SCHEMA_MISMATCH | 422 | 数据集模式不匹配 |
| Analytics | REPORT_TEMPLATE_NOT_FOUND | 404 | 报表模板不存在 |
| Integration | INTERFACE_INACTIVE | 409 | 接口未激活 |
| Integration | MAPPING_ERROR | 422 | 映射转换错误 |
| Integration | MESSAGE_RETRY_EXCEEDED | 429 | 消息重试超限 |
| IoT | DEVICE_NOT_FOUND | 404 | 设备未注册 |
| IoT | TELEMETRY_SCHEMA_MISMATCH | 422 | 遥测字段/类型不匹配 |
| IoT | ALERT_RULE_NOT_FOUND | 404 | 告警规则不存在 |

### 37.2 权限矩阵增补

| 角色 | 关键接口 | 说明 |
|------|---------|------|
| `BPC_PLANNER` | 33.x 计划/行提交 | 预算/计划录入 |
| `BPC_CONSOLIDATOR` | 33.3 合并运行 | 触发合并、查看结果 |
| `ANALYTICS_AUTHOR` | 34.x 数据集/报表 | 数据集创建、报表生成 |
| `INTEGRATION_ADMIN` | 35.x 接口注册/消息 | 接口生命周期与监控 |
| `IOT_OPERATOR` | 36.x 设备/遥测/告警 | IoT 运营管理 |

### 37.3 异步任务回调对齐

- BPC 合并、Analytics 报表、Integration 消息发送、IoT 遥测/告警的回调统一使用第 32 章签名规范。
- 建议对回调启用 5xx 重试与幂等校验（`Idempotency-Key`），防止重复处理。

---

**文档版本**: v1.9
**最后更新**: 2025-12-22
**维护者**: ERP 开发团队
