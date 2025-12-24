# 附录B - 代码评审检查清单

**文档版本**: v1.0
**适用人员**: 全体开发人员（代码评审者必读）
**最后更新**: 2025-12-21

---

## 📋 使用说明

### 为什么需要检查清单？
- ✅ 确保评审质量一致性
- ✅ 避免遗漏重要检查项
- ✅ 新人快速掌握评审要点
- ✅ 减少返工和缺陷

### 如何使用本清单？
1. 打开 Pull Request
2. 逐项检查本清单
3. 在 PR 评论中标注检查结果
4. 所有 ❌ 项修复后再批准

### 评审原则
- **善意推定**: 假设作者做了最好的决策
- **具体建议**: 不只指出问题，还要提供解决方案
- **及时反馈**: 24小时内完成评审
- **持续学习**: 从每次评审中学习

---

## 一、形式检查（5分钟）

### ✅ PR 信息完整性

- [ ] **标题清晰**
  - 格式: `[模块] 简短描述 (#任务编号)`
  - 示例: `[Financial] 实现会计科目创建功能 (#FIN-001)`
  - ❌ 不好: "修复 bug"、"更新代码"

- [ ] **描述完整**
  - 变更内容说明（做了什么）
  - 变更原因说明（为什么这样做）
  - 测试覆盖情况
  - 截图/录屏（UI 变更）
  - 相关文档链接

- [ ] **关联任务**
  - Jira Ticket 已关联
  - Issue 已引用
  - 相关 PR 已链接

### ✅ 分支和提交

- [ ] **分支命名规范**
  - ✅ `feature/financial-account-creation-FIN-001`
  - ✅ `bugfix/fix-null-pointer-ISS-123`
  - ❌ `my-branch`、`test`、`temp`

- [ ] **提交信息规范**
  - 遵循 Conventional Commits
  - ✅ `feat: add account creation API`
  - ✅ `fix: resolve null pointer in balance calculation`
  - ✅ `refactor: extract validation logic to domain service`
  - ❌ "update"、"wip"、"临时提交"

- [ ] **提交粒度合理**
  - 每个提交是独立的逻辑单元
  - 避免巨大提交（> 1000 行）
  - 避免混合无关改动

### ✅ CI 检查通过

- [ ] **编译成功** (`cargo build`)
- [ ] **测试通过** (`cargo test`)
- [ ] **代码格式** (`cargo fmt --check`)
- [ ] **Clippy 无警告** (`cargo clippy`)
- [ ] **安全审计** (`cargo audit`)
- [ ] **代码覆盖率** (未降低)

---

## 二、代码质量检查（15分钟）

### ✅ 代码可读性

- [ ] **命名清晰**
  - 变量名见名知意
  - 函数名动词开头（`create_account`、`calculate_balance`）
  - 类型名名词（`Account`、`Transaction`）
  - 常量大写（`MAX_RETRY_COUNT`）
  - ❌ 避免: `a`、`tmp`、`data`、`handle`

- [ ] **函数长度适中**
  - 单个函数 < 50 行（理想 < 30 行）
  - 如超过，考虑拆分

- [ ] **注释恰当**
  - 复杂逻辑有注释说明
  - 公开 API 有文档注释（`///`）
  - 避免无用注释（不要重复代码）
  - ❌ 不好: `// 加 1`  `x = x + 1;`
  - ✅ 好: `// 重试次数加 1，最大重试 3 次`

- [ ] **代码结构清晰**
  - 逻辑分块，用空行分隔
  - 相关代码放在一起
  - 避免深度嵌套（> 4 层）

### ✅ Rust 代码规范

- [ ] **错误处理**
  - 禁止 `unwrap()` 和 `expect()`（除非有明确理由）
  - 使用 `Result` 和 `?` 操作符
  - 自定义错误类型（使用 `thiserror`）
  - ```rust
    // ❌ 不好
    let config = load_config().unwrap();

    // ✅ 好
    let config = load_config()
        .context("Failed to load configuration")?;
    ```

- [ ] **所有权和借用**
  - 避免不必要的 `.clone()`
  - 优先使用引用（`&T`）
  - 考虑使用 `Cow<T>` 优化克隆
  - ```rust
    // ❌ 不好
    fn process(data: String) { ... }

    // ✅ 好（如不需要所有权）
    fn process(data: &str) { ... }
    ```

- [ ] **生命周期**
  - 生命周期标注清晰
  - 避免不必要的 `'static`
  - 优先使用生命周期省略规则

- [ ] **并发安全**
  - 正确使用 `Arc` / `Mutex` / `RwLock`
  - 避免死锁（注意锁顺序）
  - 使用 `Send` + `Sync` trait 约束

- [ ] **类型系统**
  - 优先使用强类型（避免 `String` 滥用）
  - 使用 NewType 模式（如 `AccountId(Uuid)`）
  - 利用类型系统保证业务规则

### ✅ 性能考虑

- [ ] **避免不必要的分配**
  - 使用 `&str` 而非 `String`（当不需要所有权）
  - 使用 `Vec::with_capacity` 预分配
  - 避免循环中重复分配

- [ ] **数据库查询优化**
  - 避免 N+1 查询
  - 使用批量查询
  - 添加必要的索引
  - 查询只返回需要的字段

- [ ] **算法复杂度**
  - 时间复杂度合理（避免 O(n²) 以上）
  - 空间复杂度合理
  - 大数据量考虑分页

---

## 三、业务逻辑检查（15分钟）

### ✅ DDD 设计原则

- [ ] **领域层独立**
  - 领域层不依赖基础设施层
  - 领域层不包含框架代码（Axum、SQLx）
  - ```rust
    // ❌ 不好（领域层依赖 SQLx）
    impl Account {
        async fn save(&self, pool: &PgPool) { ... }
    }

    // ✅ 好（通过仓储接口）
    #[async_trait]
    trait AccountRepository {
        async fn save(&self, account: &Account) -> Result<()>;
    }
    ```

- [ ] **聚合根完整性**
  - 聚合根保证一致性边界
  - 外部只能通过聚合根修改内部实体
  - 聚合根方法返回领域事件
  - ```rust
    // ✅ 好
    impl Order {
        pub fn add_item(&mut self, item: OrderLine) -> Result<OrderItemAdded> {
            // 验证业务规则
            if self.status != OrderStatus::Pending {
                return Err(DomainError::CannotModifyConfirmedOrder);
            }
            // 修改状态
            self.items.push(item.clone());
            // 返回事件
            Ok(OrderItemAdded { order_id: self.id, item })
        }
    }
    ```

- [ ] **值对象不可变**
  - 值对象字段为 `pub` 或私有
  - 没有 `set_xxx` 方法
  - 通过构造函数创建新实例
  - ```rust
    // ✅ 好
    #[derive(Clone, Copy)]
    pub struct Money {
        amount: Decimal,
        currency: Currency,
    }

    impl Money {
        pub fn new(amount: Decimal, currency: Currency) -> Result<Self> {
            if amount < Decimal::ZERO {
                return Err(MoneyError::NegativeAmount);
            }
            Ok(Self { amount, currency })
        }
    }
    ```

### ✅ 业务规则验证

- [ ] **业务规则在领域层**
  - 不在 API 层或应用层验证复杂业务规则
  - 领域层方法包含所有业务逻辑
  - ```rust
    // ❌ 不好（业务规则在 API 层）
    async fn create_order_handler(payload: CreateOrderRequest) {
        if payload.items.is_empty() {
            return Err("订单必须有商品");
        }
        // ...
    }

    // ✅ 好（业务规则在领域层）
    impl Order {
        pub fn create(items: Vec<OrderLine>) -> Result<Self> {
            if items.is_empty() {
                return Err(DomainError::EmptyOrder);
            }
            // ...
        }
    }
    ```

- [ ] **数据一致性**
  - 金额计算无精度丢失（使用 `Decimal`）
  - 状态转换合法（状态机模式）
  - 外键关联完整

- [ ] **边界条件处理**
  - 空值、零值、负值
  - 最大值、最小值
  - 并发冲突

### ✅ CQRS 模式

- [ ] **命令和查询分离**
  - Command Handler 返回 `Result<(), Error>`（不返回数据）
  - Query Handler 返回 `Result<DTO, Error>`
  - ```rust
    // ✅ 命令（修改数据，不返回业务数据）
    pub async fn handle_create_account(
        cmd: CreateAccountCommand
    ) -> Result<(), ApplicationError> {
        // ...
        Ok(())
    }

    // ✅ 查询（只读，返回数据）
    pub async fn handle_get_account(
        query: GetAccountQuery
    ) -> Result<AccountDto, ApplicationError> {
        // ...
        Ok(dto)
    }
    ```

- [ ] **读写模型分离**
  - 写模型：标准化数据库表
  - 读模型：反规范化视图或缓存
  - 异步投影事件到读模型

---

## 四、安全性检查（10分钟）

### ✅ 输入验证

- [ ] **参数验证**
  - 所有外部输入已验证（使用 `validator` crate）
  - 字符串长度限制
  - 数值范围检查
  - 正则表达式匹配（邮箱、手机）

- [ ] **SQL 注入防护**
  - 使用参数化查询（SQLx 宏）
  - 禁止字符串拼接 SQL
  - ```rust
    // ❌ 不好
    let sql = format!("SELECT * FROM users WHERE name = '{}'", name);

    // ✅ 好
    let users = sqlx::query_as!(
        User,
        "SELECT * FROM users WHERE name = $1",
        name
    ).fetch_all(pool).await?;
    ```

- [ ] **XSS 防护**
  - 用户输入内容转义
  - 使用模板引擎自动转义

### ✅ 认证授权

- [ ] **权限检查**
  - 所有受保护接口验证 Token
  - 检查用户权限（RBAC）
  - 资源级权限（用户只能访问自己的数据）

- [ ] **敏感信息保护**
  - 密码已哈希（bcrypt）
  - 敏感字段加密存储
  - 日志不输出敏感信息
  - ```rust
    // ❌ 不好
    tracing::info!("User login: {}", password);

    // ✅ 好
    tracing::info!("User login attempt for: {}", username);
    ```

### ✅ 依赖安全

- [ ] **无已知漏洞**
  - `cargo audit` 通过
  - 依赖版本非过时版本
  - 定期更新依赖

---

## 五、测试检查（10分钟）

### ✅ 测试覆盖

- [ ] **单元测试充分**
  - 领域层 100% 覆盖
  - 应用层关键逻辑覆盖
  - 边界条件测试
  - 错误分支测试

- [ ] **测试命名清晰**
  - `test_<功能>_<场景>_<预期结果>`
  - 示例: `test_create_account_with_negative_balance_should_fail`

- [ ] **测试独立性**
  - 测试间无依赖
  - 每个测试清理数据
  - 可并行运行

- [ ] **集成测试**
  - 端到端业务流程测试
  - 数据库事务测试
  - 外部服务 Mock

### ✅ 测试质量

- [ ] **断言充分**
  - 不只验证无错误，还验证结果正确
  - ```rust
    // ❌ 不好
    assert!(result.is_ok());

    // ✅ 好
    let account = result.unwrap();
    assert_eq!(account.balance, expected_balance);
    assert_eq!(account.status, AccountStatus::Active);
    ```

- [ ] **Mock 合理**
  - 使用 `mockall` crate
  - Mock 外部依赖（数据库、HTTP 调用）
  - 不过度 Mock（避免测试失去意义）

---

## 六、文档检查（5分钟）

### ✅ 代码文档

- [ ] **公开 API 有文档**
  - 所有 `pub` 函数/结构体有 `///` 注释
  - 参数说明
  - 返回值说明
  - 示例代码（可选）
  - ```rust
    /// 创建新的会计科目
    ///
    /// # 参数
    /// - `account_number`: 科目编号（4-10位数字）
    /// - `name`: 科目名称
    /// - `account_type`: 科目类型（资产、负债、权益、收入、费用）
    ///
    /// # 返回
    /// - `Ok(Account)`: 创建成功的科目
    /// - `Err(DomainError)`: 业务规则验证失败
    ///
    /// # 示例
    /// ```rust
    /// let account = Account::create(
    ///     "1001",
    ///     "现金",
    ///     AccountType::Asset
    /// )?;
    /// ```
    pub fn create(...) -> Result<Self, DomainError> { ... }
    ```

- [ ] **复杂逻辑有注释**
  - 算法说明
  - 业务规则引用
  - 临时方案说明（TODO/FIXME）

### ✅ 相关文档更新

- [ ] **API 文档更新**（如有接口变更）
- [ ] **架构文档更新**（如有设计变更）
- [ ] **CHANGELOG 更新**
- [ ] **README 更新**（如有新功能）

---

## 七、其他检查（5分钟）

### ✅ 配置管理

- [ ] **无硬编码**
  - 配置通过环境变量或配置文件
  - 禁止硬编码 URL、密码、API Key
  - ```rust
    // ❌ 不好
    let db_url = "postgres://user:pass@localhost/db";

    // ✅ 好
    let db_url = env::var("DATABASE_URL")?;
    ```

- [ ] **默认值合理**
  - 配置有默认值（开发环境）
  - 生产环境必须显式配置

### ✅ 日志和监控

- [ ] **日志级别合理**
  - ERROR: 系统错误、业务异常
  - WARN: 潜在问题
  - INFO: 关键业务操作
  - DEBUG: 调试信息（生产环境关闭）

- [ ] **日志结构化**
  - 使用 `tracing` 宏
  - 包含上下文（trace_id、user_id 等）
  - ```rust
    tracing::info!(
        transaction_id = %tx_id,
        amount = %amount,
        user_id = %user_id,
        "Transaction posted successfully"
    );
    ```

- [ ] **指标埋点**
  - 关键操作埋点（Prometheus metrics）
  - 业务指标（交易量、金额）
  - 技术指标（延迟、错误率）

### ✅ 向后兼容性

- [ ] **API 兼容**
  - 不破坏现有 API（除非大版本升级）
  - 废弃功能标记 `#[deprecated]`
  - 提供迁移指南

- [ ] **数据库兼容**
  - 迁移脚本向后兼容
  - 不删除正在使用的列（先废弃再删除）
  - 提供回滚脚本

---

## 八、评审意见模板

### 批准 (Approve)
```markdown
✅ LGTM! (Looks Good To Me)

检查项:
- [x] 代码质量
- [x] 业务逻辑
- [x] 测试覆盖
- [x] 文档完整

优点:
- 代码清晰易懂
- DDD 分层合理
- 测试覆盖充分

建议（非阻塞）:
- 可以考虑使用 `Cow<str>` 优化第 123 行的性能

已批准合并 👍
```

### 请求修改 (Request Changes)
```markdown
❌ 发现一些问题，需要修改

**必须修改**:
1. [第 45 行] 使用了 `unwrap()`，应改为 `?` 操作符
2. [第 78 行] SQL 注入风险，应使用参数化查询
3. [缺失] 缺少 `create_account` 方法的单元测试

**建议优化**:
1. [第 123 行] 可以提取为独立函数，提高可读性
2. [第 156 行] 建议添加注释说明业务规则

修改后请再次提交评审。
```

### 评论 (Comment)
```markdown
💡 有一些疑问和建议

**疑问**:
1. [第 67 行] 为什么使用 `clone()` 而不是引用？性能考虑？
2. [第 89 行] `MAX_RETRY_COUNT` 为什么是 5？有业务依据吗？

**建议**:
1. 可以考虑使用 Builder 模式简化 `Account` 的构造
2. `calculate_balance` 方法建议添加缓存

期待你的回复 🙂
```

---

## 九、快速检查模式

**时间紧急时（< 10 分钟），重点检查**:

1. ⚠️ **安全问题**（SQL注入、XSS、权限）
2. ⚠️ **数据一致性**（金额计算、状态转换）
3. ⚠️ **严重 Bug**（空指针、数组越界、死锁）
4. ⚠️ **性能问题**（N+1查询、大循环）
5. ✅ **CI 通过**（编译、测试、Clippy）

其他细节可以后续 Follow-up Review。

---

## 十、评审者自检

评审完成后，问自己：

- [ ] 我理解这段代码在做什么吗？
- [ ] 我能在半年后维护这段代码吗？
- [ ] 如果我是作者，我会接受自己的评审意见吗？
- [ ] 我的评审意见是建设性的吗？
- [ ] 我学到了什么新东西吗？

---

**记住**: 代码评审不是找茬，而是团队共同提升代码质量的过程。保持友善、专业、有建设性！

**问题反馈**: 如对本清单有建议，请在 Slack `#development` 频道讨论。
