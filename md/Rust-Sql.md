# Rust ERP 系统数据库设计文档

## 1. 数据库设计原则

### 1.1 设计理念

- **微服务独立数据库**：每个微服务拥有独立的数据库实例或 Schema
- **事件溯源**：所有状态变更通过事件记录，支持审计和回溯
- **CQRS 读写分离**：写模型标准化，读模型反规范化
- **数据一致性**：通过领域事件实现最终一致性
- **版本控制**：使用 Flyway/SQLx 管理数据库迁移脚本

### 1.2 命名规范

| 对象类型 | 命名规范 | 示例 |
|---------|---------|------|
| 表名 | snake_case 复数 | accounts, transactions |
| 列名 | snake_case | account_number, created_at |
| 主键 | {table}_id | account_id, transaction_id |
| 外键 | {referenced_table}_id | customer_id, material_id |
| 索引 | idx_{table}_{columns} | idx_accounts_number |
| 唯一约束 | uk_{table}_{columns} | uk_accounts_number |
| 检查约束 | ck_{table}_{condition} | ck_transactions_balance |

### 1.3 通用字段

所有业务表包含以下审计字段：

```sql
-- 审计字段（所有表必备）
created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by      UUID NOT NULL,  -- 创建人用户ID
updated_at      TIMESTAMP,
updated_by      UUID,
version         INTEGER NOT NULL DEFAULT 1,  -- 乐观锁版本号
is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,  -- 软删除标记
deleted_at      TIMESTAMP,
deleted_by      UUID
```

### 1.4 数据类型规范

| 数据类型 | 用途 | 示例 |
|---------|------|------|
| UUID | 主键、外键 | account_id |
| VARCHAR(n) | 短文本 | account_number VARCHAR(20) |
| TEXT | 长文本、JSON | description TEXT |
| DECIMAL(p,s) | 金额、数量 | amount DECIMAL(19,2) |
| DATE | 日期 | posting_date DATE |
| TIMESTAMP | 日期时间 | created_at TIMESTAMP |
| BOOLEAN | 布尔值 | is_active BOOLEAN |
| JSONB | 非结构化数据 | metadata JSONB |

---

## 2. 财务服务数据库 (financial_db)

### 2.1 会计科目表 (accounts)

**说明**：存储会计科目主数据（科目表）

```sql
CREATE TABLE accounts (
    -- 主键
    account_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    account_number          VARCHAR(20) NOT NULL,  -- 科目编号（如 1001）
    account_name            VARCHAR(200) NOT NULL, -- 科目名称
    account_type            VARCHAR(20) NOT NULL,  -- 科目类型：ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    account_group           VARCHAR(50),           -- 科目组（如 现金及现金等价物）
    parent_account_id       UUID,                  -- 上级科目ID（层级结构）
    is_leaf                 BOOLEAN NOT NULL DEFAULT TRUE,  -- 是否末级科目
    currency                VARCHAR(3) NOT NULL DEFAULT 'CNY',  -- 币种
    balance_type            VARCHAR(10) NOT NULL,  -- 余额方向：DEBIT, CREDIT

    -- 控制字段
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    is_posting_allowed      BOOLEAN NOT NULL DEFAULT TRUE,  -- 是否允许直接过账
    cost_center_required    BOOLEAN NOT NULL DEFAULT FALSE, -- 是否强制成本中心
    profit_center_required  BOOLEAN NOT NULL DEFAULT FALSE, -- 是否强制利润中心
    tax_category            VARCHAR(20),           -- 税务分类

    -- 描述字段
    description             TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    deleted_by              UUID,

    -- 约束
    CONSTRAINT uk_accounts_number UNIQUE (account_number),
    CONSTRAINT ck_accounts_type CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    CONSTRAINT ck_accounts_balance_type CHECK (balance_type IN ('DEBIT', 'CREDIT')),
    CONSTRAINT fk_accounts_parent FOREIGN KEY (parent_account_id) REFERENCES accounts(account_id)
);

-- 索引
CREATE INDEX idx_accounts_number ON accounts(account_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_type ON accounts(account_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id) WHERE parent_account_id IS NOT NULL;
CREATE INDEX idx_accounts_active ON accounts(is_active) WHERE is_deleted = FALSE;

-- 注释
COMMENT ON TABLE accounts IS '会计科目主数据表';
COMMENT ON COLUMN accounts.account_number IS '科目编号，唯一标识';
COMMENT ON COLUMN accounts.balance_type IS '余额方向：DEBIT=借方, CREDIT=贷方';
```

---

### 2.2 财务交易表 (transactions)

**说明**：存储财务凭证头信息

```sql
CREATE TABLE transactions (
    -- 主键
    transaction_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    document_number         VARCHAR(50) NOT NULL,  -- 凭证号（系统生成，如 FI-2025-000123）
    document_type           VARCHAR(10) NOT NULL,  -- 凭证类型：JE=日记账, IV=发票, PY=付款
    document_date           DATE NOT NULL,         -- 凭证日期
    posting_date            DATE NOT NULL,         -- 过账日期
    reference_number        VARCHAR(50),           -- 外部参考号

    -- 会计期间
    fiscal_year             INTEGER NOT NULL,      -- 会计年度
    fiscal_period           INTEGER NOT NULL,      -- 会计期间（1-12）

    -- 币种与汇率
    currency                VARCHAR(3) NOT NULL,   -- 凭证币种
    exchange_rate           DECIMAL(12,6) NOT NULL DEFAULT 1.0,  -- 汇率

    -- 状态
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT, POSTED, REVERSED

    -- 冲销信息
    reversal_indicator      BOOLEAN NOT NULL DEFAULT FALSE,  -- 是否冲销凭证
    reversed_transaction_id UUID,                   -- 被冲销的原凭证ID
    reversal_date           DATE,                   -- 冲销日期
    reversal_reason         TEXT,                   -- 冲销原因

    -- 描述字段
    description             TEXT,

    -- 业务来源
    source_system           VARCHAR(50),           -- 来源系统（SD, MM, PP等）
    source_document_type    VARCHAR(50),           -- 来源单据类型
    source_document_id      UUID,                  -- 来源单据ID

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    posted_at               TIMESTAMP,             -- 过账时间
    posted_by               UUID,                  -- 过账人
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    deleted_by              UUID,

    -- 约束
    CONSTRAINT uk_transactions_document_number UNIQUE (document_number),
    CONSTRAINT ck_transactions_status CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    CONSTRAINT ck_transactions_type CHECK (document_type IN ('JE', 'IV', 'PY', 'RC', 'CN', 'DN')),
    CONSTRAINT fk_transactions_reversed FOREIGN KEY (reversed_transaction_id) REFERENCES transactions(transaction_id)
);

-- 索引
CREATE INDEX idx_transactions_number ON transactions(document_number);
CREATE INDEX idx_transactions_posting_date ON transactions(posting_date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_fiscal ON transactions(fiscal_year, fiscal_period);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_source ON transactions(source_system, source_document_type, source_document_id);

-- 分区表（按年分区，提高查询性能）
-- ALTER TABLE transactions PARTITION BY RANGE (fiscal_year);
-- CREATE TABLE transactions_2025 PARTITION OF transactions FOR VALUES FROM (2025) TO (2026);
-- CREATE TABLE transactions_2026 PARTITION OF transactions FOR VALUES FROM (2026) TO (2027);

COMMENT ON TABLE transactions IS '财务凭证头表';
COMMENT ON COLUMN transactions.document_number IS '系统自动生成的唯一凭证号';
COMMENT ON COLUMN transactions.reversal_indicator IS 'TRUE表示这是一个冲销凭证';
```

---

### 2.3 会计分录表 (journal_entries)

**说明**：存储财务凭证明细（分录行）

```sql
CREATE TABLE journal_entries (
    -- 主键
    entry_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 外键
    transaction_id          UUID NOT NULL,         -- 所属凭证ID
    account_id              UUID NOT NULL,         -- 科目ID

    -- 业务字段
    line_number             INTEGER NOT NULL,      -- 行号（10, 20, 30...）
    debit_amount            DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 借方金额
    credit_amount           DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 贷方金额

    -- 本位币金额（自动计算）
    local_currency          VARCHAR(3) NOT NULL DEFAULT 'CNY',
    local_debit_amount      DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    local_credit_amount     DECIMAL(19,2) NOT NULL DEFAULT 0.00,

    -- 成本对象
    cost_center_id          UUID,                  -- 成本中心ID
    profit_center_id        UUID,                  -- 利润中心ID
    internal_order_id       UUID,                  -- 内部订单ID
    project_id              UUID,                  -- 项目ID

    -- 业务伙伴
    business_partner_id     UUID,                  -- 业务伙伴ID（客户/供应商）

    -- 税务信息
    tax_code                VARCHAR(10),           -- 税码
    tax_amount              DECIMAL(19,2),         -- 税额

    -- 描述字段
    description             TEXT,
    assignment              VARCHAR(100),          -- 分配（用于对账）

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- 约束
    CONSTRAINT fk_entries_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    CONSTRAINT fk_entries_account FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    CONSTRAINT ck_entries_amounts CHECK (
        (debit_amount >= 0 AND credit_amount >= 0) AND
        (debit_amount = 0 OR credit_amount = 0)  -- 借贷不能同时有值
    ),
    CONSTRAINT uk_entries_transaction_line UNIQUE (transaction_id, line_number)
);

-- 索引
CREATE INDEX idx_entries_transaction ON journal_entries(transaction_id);
CREATE INDEX idx_entries_account ON journal_entries(account_id);
CREATE INDEX idx_entries_cost_center ON journal_entries(cost_center_id) WHERE cost_center_id IS NOT NULL;
CREATE INDEX idx_entries_profit_center ON journal_entries(profit_center_id) WHERE profit_center_id IS NOT NULL;
CREATE INDEX idx_entries_business_partner ON journal_entries(business_partner_id) WHERE business_partner_id IS NOT NULL;

COMMENT ON TABLE journal_entries IS '会计分录明细表';
COMMENT ON COLUMN journal_entries.debit_amount IS '借方金额（原币）';
COMMENT ON COLUMN journal_entries.local_debit_amount IS '借方金额（本位币）';
```

---

### 2.4 科目余额表 (account_balances)

**说明**：存储科目每月余额快照（CQRS 读模型）

```sql
CREATE TABLE account_balances (
    -- 主键
    balance_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 维度字段
    account_id              UUID NOT NULL,
    fiscal_year             INTEGER NOT NULL,
    fiscal_period           INTEGER NOT NULL,
    currency                VARCHAR(3) NOT NULL,
    cost_center_id          UUID,
    profit_center_id        UUID,

    -- 余额字段
    opening_balance         DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 期初余额
    debit_total             DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 借方发生额
    credit_total            DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 贷方发生额
    closing_balance         DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 期末余额

    -- 计算时间
    calculated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 约束
    CONSTRAINT uk_balances_dimension UNIQUE (
        account_id, fiscal_year, fiscal_period, currency,
        COALESCE(cost_center_id, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(profit_center_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ),
    CONSTRAINT fk_balances_account FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- 索引
CREATE INDEX idx_balances_account ON account_balances(account_id, fiscal_year, fiscal_period);
CREATE INDEX idx_balances_fiscal ON account_balances(fiscal_year, fiscal_period);

COMMENT ON TABLE account_balances IS '科目余额快照表（读模型）';
COMMENT ON COLUMN account_balances.closing_balance IS '期末余额 = 期初余额 + 借方发生额 - 贷方发生额';
```

---

### 2.5 会计期间表 (fiscal_periods)

**说明**：会计期间主数据

```sql
CREATE TABLE fiscal_periods (
    -- 主键
    period_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    fiscal_year             INTEGER NOT NULL,
    fiscal_period           INTEGER NOT NULL,      -- 1-12（月份）
    period_name             VARCHAR(50) NOT NULL,  -- 如 "2025年12月"
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,

    -- 状态字段
    status                  VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN, CLOSED, LOCKED
    is_current              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 关账信息
    closed_at               TIMESTAMP,
    closed_by               UUID,
    closing_notes           TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- 约束
    CONSTRAINT uk_periods_year_period UNIQUE (fiscal_year, fiscal_period),
    CONSTRAINT ck_periods_status CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    CONSTRAINT ck_periods_period_range CHECK (fiscal_period BETWEEN 1 AND 12),
    CONSTRAINT ck_periods_dates CHECK (end_date > start_date)
);

-- 索引
CREATE INDEX idx_periods_year ON fiscal_periods(fiscal_year);
CREATE INDEX idx_periods_status ON fiscal_periods(status);
CREATE INDEX idx_periods_current ON fiscal_periods(is_current) WHERE is_current = TRUE;

COMMENT ON TABLE fiscal_periods IS '会计期间主数据表';
COMMENT ON COLUMN fiscal_periods.status IS 'OPEN=开放, CLOSED=关闭, LOCKED=锁定';
```

---

### 2.6 成本中心表 (cost_centers)

**说明**：成本中心主数据

```sql
CREATE TABLE cost_centers (
    -- 主键
    cost_center_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    cost_center_code        VARCHAR(20) NOT NULL,  -- 成本中心代码
    cost_center_name        VARCHAR(200) NOT NULL, -- 成本中心名称
    cost_center_type        VARCHAR(50),           -- 成本中心类型
    responsible_person_id   UUID,                  -- 责任人ID
    parent_cost_center_id   UUID,                  -- 上级成本中心

    -- 有效期
    valid_from              DATE NOT NULL,
    valid_to                DATE,

    -- 控制字段
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,

    -- 描述字段
    description             TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_cost_centers_code UNIQUE (cost_center_code),
    CONSTRAINT fk_cost_centers_parent FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(cost_center_id)
);

-- 索引
CREATE INDEX idx_cost_centers_code ON cost_centers(cost_center_code);
CREATE INDEX idx_cost_centers_active ON cost_centers(is_active);

COMMENT ON TABLE cost_centers IS '成本中心主数据表';
```

---

### 2.7 事件存储表 (events)

**说明**：事件溯源存储（所有服务通用模式）

```sql
CREATE TABLE events (
    -- 主键
    event_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 聚合信息
    aggregate_type          VARCHAR(100) NOT NULL,  -- 聚合类型：Account, Transaction
    aggregate_id            VARCHAR(200) NOT NULL,  -- 聚合ID
    aggregate_version       INTEGER NOT NULL,       -- 聚合版本号

    -- 事件信息
    event_type              VARCHAR(200) NOT NULL,  -- 事件类型：AccountCreated, TransactionPosted
    event_version           INTEGER NOT NULL DEFAULT 1,  -- 事件结构版本
    event_payload           JSONB NOT NULL,         -- 事件数据（JSON）

    -- 元数据
    event_metadata          JSONB,                  -- 元数据（用户、IP、时间戳等）
    correlation_id          UUID,                   -- 关联ID（追踪同一业务流程）
    causation_id            UUID,                   -- 因果ID（触发此事件的事件ID）

    -- 时间字段
    occurred_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 事件发生时间
    recorded_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 记录时间

    -- 全局顺序号
    sequence_number         BIGSERIAL NOT NULL,

    -- 约束
    CONSTRAINT uk_events_aggregate_version UNIQUE (aggregate_type, aggregate_id, aggregate_version)
);

-- 索引
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX idx_events_sequence ON events(sequence_number);
CREATE INDEX idx_events_correlation ON events(correlation_id) WHERE correlation_id IS NOT NULL;

COMMENT ON TABLE events IS '事件存储表（Event Sourcing）';
COMMENT ON COLUMN events.aggregate_version IS '聚合根版本号，用于乐观锁';
COMMENT ON COLUMN events.sequence_number IS '全局顺序号，保证事件顺序';

-- 示例事件数据
/*
INSERT INTO events (aggregate_type, aggregate_id, aggregate_version, event_type, event_payload, event_metadata)
VALUES (
    'Transaction',
    'tx-550e8400-e29b-41d4-a716-446655440000',
    1,
    'TransactionPosted',
    '{"transaction_id": "tx-550e8400-e29b-41d4-a716-446655440000", "document_number": "FI-2025-000123", "total_amount": 5000.00}'::jsonb,
    '{"user_id": "user-123", "ip_address": "192.168.1.100", "user_agent": "Mozilla/5.0"}'::jsonb
);
*/
```

---

## 3. 销售服务数据库 (sales_db)

### 3.1 客户主数据表 (customers)

```sql
CREATE TABLE customers (
    -- 主键
    customer_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    customer_number         VARCHAR(20) NOT NULL,  -- 客户编号
    customer_name           VARCHAR(200) NOT NULL, -- 客户名称
    customer_type           VARCHAR(20) NOT NULL,  -- 客户类型：INDIVIDUAL, CORPORATE

    -- 组织数据
    sales_organization      VARCHAR(20),           -- 销售组织
    distribution_channel    VARCHAR(20),           -- 分销渠道
    division                VARCHAR(20),           -- 产品组

    -- 联系信息
    tax_number              VARCHAR(50),           -- 税号
    phone                   VARCHAR(50),
    email                   VARCHAR(100),
    website                 VARCHAR(200),

    -- 地址信息（JSONB 存储多个地址）
    addresses               JSONB,                 -- [{"type": "billing", "street": "...", "city": "..."}, ...]

    -- 支付条款
    payment_terms           VARCHAR(20) DEFAULT 'NET30',  -- 付款条款
    incoterms               VARCHAR(10),           -- 国际贸易术语
    currency                VARCHAR(3) NOT NULL DEFAULT 'CNY',

    -- 信用控制
    credit_limit            DECIMAL(19,2),         -- 信用额度
    credit_exposure         DECIMAL(19,2) DEFAULT 0.00,  -- 当前风险敞口
    credit_block            BOOLEAN NOT NULL DEFAULT FALSE,  -- 信用冻结

    -- 状态字段
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMP,
    deleted_by              UUID,

    -- 约束
    CONSTRAINT uk_customers_number UNIQUE (customer_number),
    CONSTRAINT ck_customers_type CHECK (customer_type IN ('INDIVIDUAL', 'CORPORATE')),
    CONSTRAINT ck_customers_credit CHECK (credit_exposure <= credit_limit OR credit_limit IS NULL)
);

-- 索引
CREATE INDEX idx_customers_number ON customers(customer_number);
CREATE INDEX idx_customers_name ON customers(customer_name);
CREATE INDEX idx_customers_active ON customers(is_active);

COMMENT ON TABLE customers IS '客户主数据表';
COMMENT ON COLUMN customers.credit_exposure IS '当前风险敞口=未清应收账款';
```

---

### 3.2 销售订单头表 (sales_orders)

```sql
CREATE TABLE sales_orders (
    -- 主键
    order_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    order_number            VARCHAR(50) NOT NULL,  -- 订单号（系统生成）
    customer_id             UUID NOT NULL,         -- 客户ID
    order_type              VARCHAR(20) NOT NULL,  -- 订单类型：STANDARD, RUSH, CONSIGNMENT
    order_date              DATE NOT NULL,
    requested_delivery_date DATE,

    -- 组织数据
    sales_organization      VARCHAR(20) NOT NULL,
    distribution_channel    VARCHAR(20) NOT NULL,
    division                VARCHAR(20),
    sales_office            VARCHAR(20),
    sales_group             VARCHAR(20),

    -- 价格与币种
    currency                VARCHAR(3) NOT NULL,
    exchange_rate           DECIMAL(12,6) NOT NULL DEFAULT 1.0,

    -- 金额汇总
    total_net_value         DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 净值
    total_tax               DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 税额
    total_gross_value       DECIMAL(19,2) NOT NULL DEFAULT 0.00,  -- 含税总价

    -- 支付与交付
    payment_terms           VARCHAR(20),
    incoterms               VARCHAR(10),
    shipping_method         VARCHAR(50),

    -- 地址
    shipping_address        JSONB,                 -- 收货地址
    billing_address         JSONB,                 -- 开票地址

    -- 状态
    status                  VARCHAR(20) NOT NULL DEFAULT 'CREATED',  -- CREATED, CONFIRMED, PARTIALLY_DELIVERED, DELIVERED, CANCELLED
    delivery_status         VARCHAR(20) DEFAULT 'NOT_DELIVERED',
    billing_status          VARCHAR(20) DEFAULT 'NOT_BILLED',

    -- 审批
    approval_status         VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    approved_at             TIMESTAMP,
    approved_by             UUID,

    -- 参考信息
    customer_po_number      VARCHAR(50),           -- 客户采购订单号
    sales_person_id         UUID,                  -- 销售员

    -- 描述字段
    notes                   TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    confirmed_at            TIMESTAMP,
    confirmed_by            UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_sales_orders_number UNIQUE (order_number),
    CONSTRAINT fk_sales_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT ck_sales_orders_status CHECK (status IN ('CREATED', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT ck_sales_orders_delivery_status CHECK (delivery_status IN ('NOT_DELIVERED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED')),
    CONSTRAINT ck_sales_orders_billing_status CHECK (billing_status IN ('NOT_BILLED', 'PARTIALLY_BILLED', 'FULLY_BILLED'))
);

-- 索引
CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date DESC);
CREATE INDEX idx_sales_orders_created_at ON sales_orders(created_at DESC);

-- 分区表（按年分区）
-- ALTER TABLE sales_orders PARTITION BY RANGE (EXTRACT(YEAR FROM order_date));

COMMENT ON TABLE sales_orders IS '销售订单头表';
```

---

### 3.3 销售订单行项目表 (sales_order_items)

```sql
CREATE TABLE sales_order_items (
    -- 主键
    item_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 外键
    order_id                UUID NOT NULL,

    -- 业务字段
    line_number             INTEGER NOT NULL,      -- 行号（10, 20, 30...）
    material_number         VARCHAR(50) NOT NULL,  -- 物料编号
    material_description    VARCHAR(200),

    -- 数量与单位
    quantity                DECIMAL(15,3) NOT NULL,
    unit                    VARCHAR(10) NOT NULL,  -- 单位：PC, KG, L

    -- 价格
    unit_price              DECIMAL(19,2) NOT NULL,
    discount_percent        DECIMAL(5,2) DEFAULT 0.00,
    net_price               DECIMAL(19,2) NOT NULL,  -- 单价 * (1 - 折扣%)

    -- 金额
    net_value               DECIMAL(19,2) NOT NULL,  -- 数量 * 净价
    tax_code                VARCHAR(10),
    tax_rate                DECIMAL(5,2),
    tax_amount              DECIMAL(19,2),
    gross_value             DECIMAL(19,2) NOT NULL,  -- 净值 + 税额

    -- 交付信息
    requested_delivery_date DATE,
    confirmed_delivery_date DATE,
    plant                   VARCHAR(20),           -- 工厂
    storage_location        VARCHAR(20),           -- 库位

    -- 状态
    item_category           VARCHAR(20),           -- 项目类别
    delivery_status         VARCHAR(20) DEFAULT 'NOT_DELIVERED',
    billing_status          VARCHAR(20) DEFAULT 'NOT_BILLED',

    -- 数量跟踪
    delivered_quantity      DECIMAL(15,3) DEFAULT 0.00,
    billed_quantity         DECIMAL(15,3) DEFAULT 0.00,
    open_quantity           DECIMAL(15,3),         -- 未交货数量

    -- 描述字段
    notes                   TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- 约束
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES sales_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT uk_order_items_line UNIQUE (order_id, line_number),
    CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_order_items_open_qty CHECK (open_quantity >= 0)
);

-- 索引
CREATE INDEX idx_order_items_order ON sales_order_items(order_id);
CREATE INDEX idx_order_items_material ON sales_order_items(material_number);
CREATE INDEX idx_order_items_delivery_date ON sales_order_items(confirmed_delivery_date);

-- 触发器：自动计算 open_quantity
CREATE OR REPLACE FUNCTION update_open_quantity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.open_quantity := NEW.quantity - NEW.delivered_quantity;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_open_quantity
BEFORE INSERT OR UPDATE ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION update_open_quantity();

COMMENT ON TABLE sales_order_items IS '销售订单行项目表';
```

---

### 3.4 发货单表 (deliveries)

```sql
CREATE TABLE deliveries (
    -- 主键
    delivery_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    delivery_number         VARCHAR(50) NOT NULL,
    order_id                UUID NOT NULL,         -- 关联销售订单
    customer_id             UUID NOT NULL,

    -- 日期
    delivery_date           DATE NOT NULL,
    planned_goods_issue_date DATE,
    actual_goods_issue_date DATE,

    -- 物流信息
    carrier                 VARCHAR(100),          -- 承运商
    tracking_number         VARCHAR(100),          -- 运单号
    shipping_method         VARCHAR(50),

    -- 地址
    shipping_address        JSONB,

    -- 状态
    status                  VARCHAR(20) NOT NULL DEFAULT 'CREATED',  -- CREATED, PICKED, PACKED, SHIPPED, DELIVERED
    goods_issue_posted      BOOLEAN NOT NULL DEFAULT FALSE,  -- 是否已过账（库存扣减）

    -- 过账信息
    material_document       VARCHAR(50),           -- 物料凭证号
    accounting_document     VARCHAR(50),           -- 财务凭证号
    goods_issue_date        DATE,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    posted_at               TIMESTAMP,
    posted_by               UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_deliveries_number UNIQUE (delivery_number),
    CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES sales_orders(order_id),
    CONSTRAINT fk_deliveries_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT ck_deliveries_status CHECK (status IN ('CREATED', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED'))
);

-- 索引
CREATE INDEX idx_deliveries_number ON deliveries(delivery_number);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date DESC);
CREATE INDEX idx_deliveries_status ON deliveries(status);

COMMENT ON TABLE deliveries IS '发货单表';
```

---

### 3.5 发票表 (invoices)

```sql
CREATE TABLE invoices (
    -- 主键
    invoice_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    invoice_number          VARCHAR(50) NOT NULL,
    invoice_type            VARCHAR(20) NOT NULL,  -- STANDARD, CREDIT_MEMO, DEBIT_MEMO
    order_id                UUID,
    delivery_id             UUID,
    customer_id             UUID NOT NULL,

    -- 日期
    invoice_date            DATE NOT NULL,
    due_date                DATE NOT NULL,

    -- 金额
    currency                VARCHAR(3) NOT NULL,
    total_net_value         DECIMAL(19,2) NOT NULL,
    total_tax               DECIMAL(19,2) NOT NULL,
    total_gross_value       DECIMAL(19,2) NOT NULL,

    -- 支付信息
    payment_terms           VARCHAR(20),
    payment_status          VARCHAR(20) DEFAULT 'UNPAID',  -- UNPAID, PARTIALLY_PAID, PAID
    paid_amount             DECIMAL(19,2) DEFAULT 0.00,
    outstanding_amount      DECIMAL(19,2),

    -- 状态
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT, POSTED, CANCELLED

    -- 会计凭证
    accounting_document     VARCHAR(50),

    -- PDF文件
    pdf_url                 VARCHAR(500),

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    posted_at               TIMESTAMP,
    posted_by               UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number),
    CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES sales_orders(order_id),
    CONSTRAINT fk_invoices_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(delivery_id),
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT ck_invoices_type CHECK (invoice_type IN ('STANDARD', 'CREDIT_MEMO', 'DEBIT_MEMO')),
    CONSTRAINT ck_invoices_payment_status CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID'))
);

-- 索引
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);

-- 触发器：自动计算未清金额
CREATE OR REPLACE FUNCTION update_outstanding_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.outstanding_amount := NEW.total_gross_value - NEW.paid_amount;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_outstanding_amount
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_outstanding_amount();

COMMENT ON TABLE invoices IS '发票表';
```

---

## 4. 物料服务数据库 (materials_db)

### 4.1 物料主数据表 (materials)

```sql
CREATE TABLE materials (
    -- 主键
    material_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 基本数据
    material_number         VARCHAR(50) NOT NULL,
    material_type           VARCHAR(20) NOT NULL,  -- ROH=原料, HALB=半成品, FERT=成品
    industry_sector         VARCHAR(10),           -- M=机械, C=化工
    description             VARCHAR(200) NOT NULL,
    long_description        TEXT,

    -- 单位
    base_unit_of_measure    VARCHAR(10) NOT NULL,  -- 基本单位
    weight_unit             VARCHAR(10),
    volume_unit             VARCHAR(10),

    -- 物理属性
    gross_weight            DECIMAL(15,3),
    net_weight              DECIMAL(15,3),
    volume                  DECIMAL(15,3),

    -- 分类
    material_group          VARCHAR(50),
    division                VARCHAR(20),

    -- 状态
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_materials_number UNIQUE (material_number),
    CONSTRAINT ck_materials_type CHECK (material_type IN ('ROH', 'HALB', 'FERT', 'HAWA', 'VERP'))
);

-- 索引
CREATE INDEX idx_materials_number ON materials(material_number);
CREATE INDEX idx_materials_type ON materials(material_type);
CREATE INDEX idx_materials_group ON materials(material_group);

COMMENT ON TABLE materials IS '物料主数据表';
COMMENT ON COLUMN materials.material_type IS 'ROH=原料,HALB=半成品,FERT=成品,HAWA=贸易商品,VERP=包装';
```

---

### 4.2 库存表 (inventory)

```sql
CREATE TABLE inventory (
    -- 主键
    inventory_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 维度
    material_id             UUID NOT NULL,
    plant                   VARCHAR(20) NOT NULL,  -- 工厂
    storage_location        VARCHAR(20) NOT NULL,  -- 库位
    batch                   VARCHAR(50),           -- 批次号（可选）
    special_stock_type      VARCHAR(10),           -- 特殊库存类型

    -- 库存数量
    unrestricted_stock      DECIMAL(15,3) NOT NULL DEFAULT 0.00,  -- 非限制使用库存
    quality_inspection_stock DECIMAL(15,3) NOT NULL DEFAULT 0.00, -- 质检库存
    blocked_stock           DECIMAL(15,3) NOT NULL DEFAULT 0.00,  -- 冻结库存
    total_stock             DECIMAL(15,3) GENERATED ALWAYS AS (
        unrestricted_stock + quality_inspection_stock + blocked_stock
    ) STORED,

    -- 单位与价值
    unit                    VARCHAR(10) NOT NULL,
    unit_price              DECIMAL(19,2),         -- 单价
    total_value             DECIMAL(19,2),         -- 库存价值
    currency                VARCHAR(3) DEFAULT 'CNY',

    -- 时间戳
    last_goods_receipt_date DATE,
    last_goods_issue_date   DATE,
    last_updated            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 约束
    CONSTRAINT uk_inventory_dimension UNIQUE (
        material_id, plant, storage_location,
        COALESCE(batch, ''),
        COALESCE(special_stock_type, '')
    ),
    CONSTRAINT fk_inventory_material FOREIGN KEY (material_id) REFERENCES materials(material_id),
    CONSTRAINT ck_inventory_quantities CHECK (
        unrestricted_stock >= 0 AND
        quality_inspection_stock >= 0 AND
        blocked_stock >= 0
    )
);

-- 索引
CREATE INDEX idx_inventory_material ON inventory(material_id);
CREATE INDEX idx_inventory_plant ON inventory(plant, storage_location);
CREATE INDEX idx_inventory_batch ON inventory(batch) WHERE batch IS NOT NULL;

-- 触发器：自动计算库存价值
CREATE OR REPLACE FUNCTION update_inventory_value()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_value := NEW.total_stock * COALESCE(NEW.unit_price, 0);
    NEW.last_updated := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_inventory_value
BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_value();

COMMENT ON TABLE inventory IS '库存表';
COMMENT ON COLUMN inventory.unrestricted_stock IS '可用库存';
```

---

### 4.3 物料凭证表 (material_documents)

```sql
CREATE TABLE material_documents (
    -- 主键
    document_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 业务字段
    material_document       VARCHAR(50) NOT NULL,  -- 物料凭证号
    document_date           DATE NOT NULL,
    posting_date            DATE NOT NULL,
    movement_type           VARCHAR(10) NOT NULL,  -- 101=采购入库, 601=销售出库

    -- 参考凭证
    reference_document_type VARCHAR(20),           -- PO=采购订单, SO=销售订单
    reference_document_id   UUID,

    -- 业务伙伴
    vendor_id               UUID,
    customer_id             UUID,

    -- 会计凭证
    accounting_document     VARCHAR(50),

    -- 状态
    status                  VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    is_reversed             BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_document       VARCHAR(50),

    -- 描述
    header_text             TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    posted_at               TIMESTAMP,
    posted_by               UUID,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- 约束
    CONSTRAINT uk_material_documents_number UNIQUE (material_document),
    CONSTRAINT ck_material_documents_movement_type CHECK (movement_type ~ '^\d{3}$')  -- 3位数字
);

-- 索引
CREATE INDEX idx_material_documents_number ON material_documents(material_document);
CREATE INDEX idx_material_documents_posting_date ON material_documents(posting_date DESC);
CREATE INDEX idx_material_documents_movement_type ON material_documents(movement_type);

COMMENT ON TABLE material_documents IS '物料凭证头表';
COMMENT ON COLUMN material_documents.movement_type IS '101=PO收货,261=生产领料,601=销售发货';
```

---

### 4.4 物料凭证行项目表 (material_document_items)

```sql
CREATE TABLE material_document_items (
    -- 主键
    item_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 外键
    document_id             UUID NOT NULL,

    -- 业务字段
    line_number             INTEGER NOT NULL,
    material_id             UUID NOT NULL,

    -- 数量与单位
    quantity                DECIMAL(15,3) NOT NULL,
    unit                    VARCHAR(10) NOT NULL,

    -- 地点信息
    plant                   VARCHAR(20) NOT NULL,
    storage_location        VARCHAR(20) NOT NULL,
    batch                   VARCHAR(50),

    -- 库存类型
    stock_type              VARCHAR(20) NOT NULL DEFAULT 'UNRESTRICTED',  -- UNRESTRICTED, QUALITY, BLOCKED

    -- 金额
    amount                  DECIMAL(19,2),
    currency                VARCHAR(3),

    -- 参考
    purchase_order          VARCHAR(50),
    po_item_number          INTEGER,
    sales_order             VARCHAR(50),
    so_item_number          INTEGER,

    -- 成本中心
    cost_center             VARCHAR(20),

    -- 描述
    item_text               TEXT,

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,

    -- 约束
    CONSTRAINT fk_material_doc_items_doc FOREIGN KEY (document_id) REFERENCES material_documents(document_id) ON DELETE CASCADE,
    CONSTRAINT fk_material_doc_items_material FOREIGN KEY (material_id) REFERENCES materials(material_id),
    CONSTRAINT uk_material_doc_items_line UNIQUE (document_id, line_number),
    CONSTRAINT ck_material_doc_items_stock_type CHECK (stock_type IN ('UNRESTRICTED', 'QUALITY', 'BLOCKED'))
);

-- 索引
CREATE INDEX idx_material_doc_items_doc ON material_document_items(document_id);
CREATE INDEX idx_material_doc_items_material ON material_document_items(material_id);
CREATE INDEX idx_material_doc_items_plant ON material_document_items(plant, storage_location);

COMMENT ON TABLE material_document_items IS '物料凭证行项目表';
```

---

## 5. 人力资源服务数据库 (hr_db)

### 5.1 员工表 (employees)

```sql
CREATE TABLE employees (
    -- 主键
    employee_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 基本信息
    employee_number         VARCHAR(20) NOT NULL,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    full_name               VARCHAR(200) GENERATED ALWAYS AS (last_name || ' ' || first_name) STORED,
    gender                  VARCHAR(10),           -- MALE, FEMALE, OTHER
    date_of_birth           DATE,
    nationality             VARCHAR(50),

    -- 联系信息
    email                   VARCHAR(100),
    phone                   VARCHAR(50),
    personal_email          VARCHAR(100),
    address                 JSONB,

    -- 身份信息
    id_card_number          VARCHAR(50),           -- 身份证号
    passport_number         VARCHAR(50),
    social_security_number  VARCHAR(50),           -- 社保号

    -- 组织信息
    company_code            VARCHAR(20) NOT NULL,
    personnel_area          VARCHAR(20),           -- 人事范围
    personnel_subarea       VARCHAR(20),           -- 人事子范围
    department_id           UUID,                  -- 部门ID
    cost_center             VARCHAR(20),           -- 成本中心
    position_id             UUID,                  -- 职位ID

    -- 雇佣信息
    hire_date               DATE NOT NULL,
    employment_type         VARCHAR(20),           -- FULL_TIME, PART_TIME, CONTRACT
    employment_status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, ON_LEAVE, TERMINATED
    termination_date        DATE,

    -- 报告关系
    manager_id              UUID,                  -- 直接上级

    -- 薪资信息（加密存储）
    salary_encrypted        BYTEA,                 -- AES加密薪资
    salary_currency         VARCHAR(3),

    -- 审计字段
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL,
    updated_at              TIMESTAMP,
    updated_by              UUID,
    version                 INTEGER NOT NULL DEFAULT 1,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,

    -- 约束
    CONSTRAINT uk_employees_number UNIQUE (employee_number),
    CONSTRAINT uk_employees_email UNIQUE (email),
    CONSTRAINT ck_employees_gender CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    CONSTRAINT ck_employees_employment_type CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    CONSTRAINT ck_employees_status CHECK (employment_status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
);

-- 索引
CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_status ON employees(employment_status);

COMMENT ON TABLE employees IS '员工主数据表';
COMMENT ON COLUMN employees.salary_encrypted IS 'AES-256-GCM 加密存储';
```

---

## 6. 视图与物化视图

### 6.1 科目余额视图 (v_account_balances)

```sql
-- 实时余额视图（从事务表实时计算）
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
    a.account_id,
    a.account_number,
    a.account_name,
    a.currency,
    t.fiscal_year,
    t.fiscal_period,
    COALESCE(SUM(je.debit_amount), 0) AS total_debit,
    COALESCE(SUM(je.credit_amount), 0) AS total_credit,
    COALESCE(SUM(je.debit_amount), 0) - COALESCE(SUM(je.credit_amount), 0) AS balance,
    MAX(t.posting_date) AS last_posting_date,
    COUNT(DISTINCT t.transaction_id) AS transaction_count
FROM accounts a
LEFT JOIN journal_entries je ON a.account_id = je.account_id
LEFT JOIN transactions t ON je.transaction_id = t.transaction_id AND t.status = 'POSTED'
WHERE a.is_deleted = FALSE
GROUP BY a.account_id, a.account_number, a.account_name, a.currency, t.fiscal_year, t.fiscal_period;

COMMENT ON VIEW v_account_balances IS '科目余额实时视图';
```

---

### 6.2 订单履行状态视图 (v_order_fulfillment)

```sql
CREATE OR REPLACE VIEW v_order_fulfillment AS
SELECT
    so.order_id,
    so.order_number,
    so.customer_id,
    c.customer_name,
    so.order_date,
    so.status AS order_status,
    so.total_gross_value,
    so.currency,
    COUNT(soi.item_id) AS total_items,
    COALESCE(SUM(soi.quantity), 0) AS total_ordered_qty,
    COALESCE(SUM(soi.delivered_quantity), 0) AS total_delivered_qty,
    COALESCE(SUM(soi.open_quantity), 0) AS total_open_qty,
    CASE
        WHEN COALESCE(SUM(soi.open_quantity), 0) = 0 THEN 'FULLY_DELIVERED'
        WHEN COALESCE(SUM(soi.delivered_quantity), 0) > 0 THEN 'PARTIALLY_DELIVERED'
        ELSE 'NOT_DELIVERED'
    END AS delivery_status_calculated
FROM sales_orders so
JOIN customers c ON so.customer_id = c.customer_id
LEFT JOIN sales_order_items soi ON so.order_id = soi.order_id
WHERE so.is_deleted = FALSE
GROUP BY so.order_id, so.order_number, so.customer_id, c.customer_name,
         so.order_date, so.status, so.total_gross_value, so.currency;

COMMENT ON VIEW v_order_fulfillment IS '订单履行状态视图';
```

---

## 7. 数据库迁移脚本示例

### 7.1 初始化脚本 (001_init_financial.sql)

```sql
-- Migration: 001_init_financial
-- Description: 初始化财务服务数据库
-- Date: 2025-12-21

-- 创建 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建 accounts 表
-- （见上文 2.1）

-- 创建 transactions 表
-- （见上文 2.2）

-- 创建 journal_entries 表
-- （见上文 2.3）

-- 插入初始数据：科目表
INSERT INTO accounts (account_number, account_name, account_type, balance_type, currency, created_by)
VALUES
    ('1001', '现金', 'ASSET', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('1002', '银行存款', 'ASSET', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('2001', '应付账款', 'LIABILITY', 'CREDIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('4001', '主营业务收入', 'REVENUE', 'CREDIT', 'CNY', '00000000-0000-0000-0000-000000000001'),
    ('5001', '主营业务成本', 'EXPENSE', 'DEBIT', 'CNY', '00000000-0000-0000-0000-000000000001');

-- 插入会计期间
INSERT INTO fiscal_periods (fiscal_year, fiscal_period, period_name, start_date, end_date, status, created_by)
SELECT
    2025,
    month_num,
    '2025年' || month_num || '月',
    ('2025-' || LPAD(month_num::text, 2, '0') || '-01')::DATE,
    (DATE_TRUNC('month', ('2025-' || LPAD(month_num::text, 2, '0') || '-01')::DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    CASE WHEN month_num < 12 THEN 'OPEN' ELSE 'OPEN' END,
    '00000000-0000-0000-0000-000000000001'
FROM generate_series(1, 12) AS month_num;
```

---

## 8. 性能优化建议

### 8.1 分区策略

```sql
-- 按年分区交易表
CREATE TABLE transactions_partitioned (
    -- 所有字段同 transactions 表
) PARTITION BY RANGE (fiscal_year);

CREATE TABLE transactions_2024 PARTITION OF transactions_partitioned
    FOR VALUES FROM (2024) TO (2025);

CREATE TABLE transactions_2025 PARTITION OF transactions_partitioned
    FOR VALUES FROM (2025) TO (2026);

CREATE TABLE transactions_2026 PARTITION OF transactions_partitioned
    FOR VALUES FROM (2026) TO (2027);
```

### 8.2 索引优化

```sql
-- 复合索引（覆盖查询）
CREATE INDEX idx_journal_entries_account_posting_date
    ON journal_entries(account_id, transaction_id)
    INCLUDE (debit_amount, credit_amount);

-- 部分索引（仅索引活跃数据）
CREATE INDEX idx_orders_active_status
    ON sales_orders(status, order_date DESC)
    WHERE status IN ('CREATED', 'CONFIRMED') AND is_deleted = FALSE;
```

### 8.3 物化视图定时刷新

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW mv_monthly_sales_summary AS
SELECT
    DATE_TRUNC('month', so.order_date) AS month,
    c.customer_id,
    c.customer_name,
    COUNT(so.order_id) AS order_count,
    SUM(so.total_net_value) AS total_net_value,
    SUM(so.total_gross_value) AS total_gross_value
FROM sales_orders so
JOIN customers c ON so.customer_id = c.customer_id
WHERE so.status != 'CANCELLED'
GROUP BY DATE_TRUNC('month', so.order_date), c.customer_id, c.customer_name;

-- 创建唯一索引
CREATE UNIQUE INDEX idx_mv_monthly_sales_pk
    ON mv_monthly_sales_summary(month, customer_id);

-- 定时刷新（使用 pg_cron 或应用层调度）
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_sales_summary;
```

---

## 9. 备份与恢复

### 9.1 备份策略

```bash
# 全量备份
pg_dump -h localhost -U erp_user -d financial_db -F c -f /backup/financial_db_20251221.dump

# 仅数据备份（排除大表）
pg_dump -h localhost -U erp_user -d financial_db \
    --exclude-table=events \
    -F c -f /backup/financial_db_no_events_20251221.dump

# 恢复
pg_restore -h localhost -U erp_user -d financial_db_new /backup/financial_db_20251221.dump
```

---

**文档版本**: v1.0
**最后更新**: 2025-12-21
**维护者**: ERP 开发团队
