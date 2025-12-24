# Rust ERP 系统 - 领域规格说明书
## Domain Specifications for KILLER Replacement System

本文档提供每个业务领域的详细技术规格，包括数据模型、API接口、领域事件、业务规则和集成点。

---

## 第一部分：财务会计模块 (FI - Financial Accounting)

### 1.1 数据模型

#### 1.1.1 会计凭证 (Accounting Document)

```rust
// Domain Entity
pub struct AccountingDocument {
    // Identity
    pub document_id: Uuid,
    pub document_number: String,          // Format: FI-2025-000001
    pub company_code: CompanyCode,
    pub fiscal_year: FiscalYear,
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,

    // Classification
    pub document_type: DocumentType,      // SA-Standard, KR-Credit Memo, KG-Vendor Invoice
    pub document_category: DocumentCategory, // AR, AP, GL, AA
    pub reference_document: Option<String>,
    pub header_text: Option<String>,

    // Financial Data
    pub currency: Currency,
    pub exchange_rate: Option<ExchangeRate>,
    pub local_currency_amount: Money,     // Company code currency
    pub document_currency_amount: Money,

    // Items
    pub line_items: Vec<LineItem>,

    // Status & Control
    pub status: DocumentStatus,           // Draft, Posted, Parked, Reversed
    pub posting_period: Period,
    pub reversal_reason: Option<ReversalReason>,
    pub reversed_document_id: Option<Uuid>,

    // Audit Trail
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub posted_at: Option<DateTime<Utc>>,
    pub posted_by: Option<UserId>,
    pub last_modified_at: DateTime<Utc>,
    pub last_modified_by: UserId,
    pub version: i64,                     // Optimistic locking
}

pub struct LineItem {
    pub line_item_id: Uuid,
    pub line_number: u16,                 // 001, 002, 003...

    // Account Assignment
    pub gl_account: GlAccount,
    pub cost_center: Option<CostCenter>,
    pub profit_center: Option<ProfitCenter>,
    pub internal_order: Option<InternalOrder>,
    pub wbs_element: Option<WbsElement>,
    pub segment: Option<Segment>,

    // Amounts
    pub debit_amount: Money,
    pub credit_amount: Money,
    pub local_debit_amount: Money,        // Converted to company code currency
    pub local_credit_amount: Money,
    pub tax_code: Option<TaxCode>,
    pub tax_amount: Money,

    // Business Partner
    pub business_partner_id: Option<Uuid>,
    pub business_partner_type: Option<BpType>, // Customer, Vendor, Employee

    // Payment Terms
    pub payment_terms: Option<PaymentTerms>,
    pub due_date: Option<NaiveDate>,
    pub discount_date1: Option<NaiveDate>,
    pub discount_percent1: Option<Decimal>,
    pub discount_date2: Option<NaiveDate>,
    pub discount_percent2: Option<Decimal>,

    // Additional Info
    pub line_text: Option<String>,
    pub reference: Option<String>,
    pub assignment: Option<String>,        // Sorting key for open items
    pub value_date: Option<NaiveDate>,     // Cash management
}

// Value Objects
pub struct CompanyCode(String);           // 4-digit code
pub struct FiscalYear(u16);
pub struct Period(u8);                    // 1-16 (including special periods 13-16)

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DocumentType {
    SA,  // Standard Document
    AB,  // Accounting Document
    KR,  // Vendor Invoice
    KG,  // Vendor Credit Memo
    DR,  // Customer Invoice
    DG,  // Customer Credit Memo
    KZ,  // Vendor Payment
    DZ,  // Customer Payment
    ZP,  // Payment Posting
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DocumentStatus {
    Draft,
    Parked,      // Saved but not posted
    Posted,      // Posted to ledgers
    Reversed,    // Cancelled by reversal document
    Cleared,     // Open item cleared
}

pub struct GlAccount {
    pub account_number: String,           // 10-digit: 1000000 - Assets, 2000000 - Liabilities
    pub account_group: AccountGroup,
    pub account_type: AccountType,        // Balance Sheet, P&L
}

pub struct TaxCode {
    pub tax_code: String,                 // V1 - Input VAT 13%, A1 - Output VAT 13%
    pub tax_type: TaxType,                // VAT, Sales Tax, Withholding Tax
    pub tax_rate: Decimal,
    pub tax_jurisdiction: String,
}
```

#### 1.1.2 总账科目主数据 (GL Account Master Data)

```rust
pub struct GlAccountMaster {
    pub account_id: Uuid,
    pub account_number: String,           // 1000000 - 9999999

    // Classification
    pub account_group: AccountGroup,      // Assets, Liabilities, Equity, Revenue, Expense
    pub account_type: AccountType,        // Balance Sheet, P&L
    pub financial_statement_item: FsItem, // For financial reporting

    // Control Parameters
    pub company_code: CompanyCode,
    pub chart_of_accounts: ChartOfAccounts,
    pub account_currency: Option<Currency>, // If blank, all currencies allowed
    pub only_balances_in_local_currency: bool,

    // Posting Control
    pub line_item_display: bool,          // Store line items or balances only
    pub open_item_management: bool,       // Manage clearing of open items
    pub sort_key: Option<SortKey>,        // Default assignment field
    pub field_status_group: FieldStatusGroup, // Control required/optional fields

    // Tax
    pub tax_category: Option<TaxCategory>,
    pub posting_without_tax_allowed: bool,

    // Cost Accounting
    pub cost_element: Option<CostElement>,
    pub cost_element_category: Option<CostElementCategory>,

    // Planning & Budgeting
    pub planning_level: Option<PlanningLevel>,
    pub relevant_to_cash_flow: bool,

    // Descriptions
    pub short_text: String,
    pub long_text: String,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub blocked_for_posting: bool,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AccountGroup {
    Assets,
    Liabilities,
    Equity,
    Revenue,
    Expense,
}

pub struct FieldStatusGroup {
    pub group_code: String,
    pub field_controls: HashMap<FieldName, FieldStatus>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FieldStatus {
    Suppress,      // Hide field
    Required,      // Mandatory entry
    Optional,      // Optional entry
    Display,       // Display only, no entry
}
```

#### 1.1.3 客商主数据 (Business Partner Master)

```rust
pub struct BusinessPartner {
    pub bp_id: Uuid,
    pub bp_number: String,                // Format: C-100001 (Customer), V-200001 (Vendor)
    pub bp_type: BusinessPartnerType,
    pub bp_role: Vec<BpRole>,             // Customer, Vendor, Employee

    // General Data
    pub name1: String,
    pub name2: Option<String>,
    pub search_term: String,
    pub legal_form: Option<LegalForm>,
    pub industry_sector: Option<IndustrySector>,
    pub tax_number1: Option<String>,      // VAT Registration Number
    pub tax_number2: Option<String>,      // Tax Identification Number

    // Address
    pub addresses: Vec<BpAddress>,
    pub primary_address_id: Uuid,

    // Contact Information
    pub contacts: Vec<BpContact>,
    pub primary_contact_id: Option<Uuid>,

    // Bank Details
    pub bank_accounts: Vec<BpBankAccount>,
    pub primary_bank_account_id: Option<Uuid>,

    // Status
    pub status: BpStatus,                 // Active, Blocked, Deleted
    pub blocked_for_posting: bool,
    pub deletion_flag: bool,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct CustomerData {
    pub bp_id: Uuid,
    pub company_code: CompanyCode,
    pub customer_account_group: CustomerAccountGroup,

    // Reconciliation Account
    pub reconciliation_account: GlAccount, // Link to GL account (e.g., 1100000 - AR)
    pub sort_key: Option<SortKey>,

    // Payment Terms
    pub payment_terms: PaymentTerms,       // e.g., Net 30 days
    pub payment_methods: Vec<PaymentMethod>,
    pub tolerance_group: Option<ToleranceGroup>,

    // Dunning
    pub dunning_procedure: Option<DunningProcedure>,
    pub dunning_recipient: Option<String>,
    pub dunning_block: bool,

    // Credit Management
    pub credit_control_area: CreditControlArea,
    pub credit_limit: Money,
    pub credit_exposure: Money,            // Calculated: AR + SO + Deliveries
    pub risk_category: RiskCategory,

    // Withholding Tax
    pub withholding_tax_country: Option<Country>,
    pub withholding_tax_code: Option<WithholdingTaxCode>,

    // Interest Calculation
    pub interest_indicator: Option<InterestIndicator>,
    pub last_interest_run_date: Option<NaiveDate>,
}

pub struct VendorData {
    pub bp_id: Uuid,
    pub company_code: CompanyCode,
    pub vendor_account_group: VendorAccountGroup,

    // Reconciliation Account
    pub reconciliation_account: GlAccount, // Link to GL account (e.g., 2100000 - AP)
    pub sort_key: Option<SortKey>,

    // Payment Terms
    pub payment_terms: PaymentTerms,       // e.g., 2%10 Net 30
    pub payment_methods: Vec<PaymentMethod>,
    pub payment_block: bool,
    pub house_bank: Option<HouseBank>,     // Default house bank for payment

    // Tax
    pub tax_number: Option<String>,
    pub tax_liable: bool,

    // Evaluation
    pub vendor_evaluation_score: Option<Decimal>,
    pub abc_indicator: Option<AbcIndicator>, // A, B, C classification
}

pub struct PaymentTerms {
    pub terms_code: String,               // Z001, Z030, Z045
    pub description: String,              // "Net 30 days", "2%10 Net 30"
    pub baseline_date: BaselineDate,      // Document date, posting date, entry date
    pub net_payment_terms: u16,           // Days until payment is due
    pub discount_terms: Vec<DiscountTerm>,
}

pub struct DiscountTerm {
    pub discount_days: u16,               // Days from baseline date
    pub discount_percent: Decimal,        // Discount percentage
}
```

### 1.2 API 规格

#### 1.2.1 会计凭证 API

```rust
// POST /api/v1/financial/documents
#[derive(Debug, Deserialize, Validate)]
pub struct CreateDocumentRequest {
    #[validate(length(min = 1))]
    pub idempotency_key: String,

    pub company_code: String,
    #[validate(custom = "validate_posting_date")]
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub document_type: String,
    pub reference: Option<String>,
    pub header_text: Option<String>,
    pub currency: String,

    #[validate(length(min = 2))]
    #[validate(custom = "validate_balanced_entries")]
    pub line_items: Vec<LineItemRequest>,
}

pub struct LineItemRequest {
    pub gl_account: String,
    pub debit_amount: Option<Decimal>,
    pub credit_amount: Option<Decimal>,
    pub cost_center: Option<String>,
    pub profit_center: Option<String>,
    pub business_partner_id: Option<Uuid>,
    pub tax_code: Option<String>,
    pub line_text: Option<String>,
    pub payment_terms: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateDocumentResponse {
    pub document_id: Uuid,
    pub document_number: String,
    pub status: String,
    pub posting_date: NaiveDate,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub validation_messages: Vec<ValidationMessage>,
}

// POST /api/v1/financial/documents/{document_id}/post
pub struct PostDocumentRequest {
    pub posting_date: Option<NaiveDate>,  // Override if needed
    pub posting_period: Option<u8>,
    pub force_post: bool,                  // Skip warnings
}

pub struct PostDocumentResponse {
    pub document_id: Uuid,
    pub document_number: String,
    pub status: String,
    pub posted_at: DateTime<Utc>,
    pub posted_by: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
}

// POST /api/v1/financial/documents/{document_id}/reverse
pub struct ReverseDocumentRequest {
    pub reversal_reason: String,
    pub reversal_date: NaiveDate,
    pub reversal_posting_period: Option<u8>,
}

pub struct ReverseDocumentResponse {
    pub original_document_id: Uuid,
    pub reversal_document_id: Uuid,
    pub reversal_document_number: String,
    pub reversed_at: DateTime<Utc>,
}

// GET /api/v1/financial/documents
pub struct ListDocumentsQuery {
    pub company_code: Option<String>,
    pub fiscal_year: Option<u16>,
    pub posting_date_from: Option<NaiveDate>,
    pub posting_date_to: Option<NaiveDate>,
    pub document_type: Option<String>,
    pub status: Option<String>,
    pub created_by: Option<String>,
    pub gl_account: Option<String>,
    pub business_partner_id: Option<Uuid>,
    pub cost_center: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub sort_by: Option<String>,          // posting_date, document_number, created_at
    pub sort_order: Option<SortOrder>,    // asc, desc
}

pub struct ListDocumentsResponse {
    pub documents: Vec<DocumentSummary>,
    pub total_count: u64,
    pub page: u32,
    pub page_size: u32,
    pub has_more: bool,
}

pub struct DocumentSummary {
    pub document_id: Uuid,
    pub document_number: String,
    pub company_code: String,
    pub posting_date: NaiveDate,
    pub document_type: String,
    pub currency: String,
    pub total_amount: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
}

// GET /api/v1/financial/documents/{document_id}
pub struct GetDocumentResponse {
    pub document: AccountingDocumentDto,
    pub line_items: Vec<LineItemDto>,
    pub audit_trail: Vec<AuditEntry>,
    pub related_documents: Vec<RelatedDocument>,
}
```

#### 1.2.2 科目余额查询 API

```rust
// GET /api/v1/financial/balances/gl-accounts
pub struct GetGlBalancesQuery {
    pub company_code: String,
    pub fiscal_year: u16,
    pub account_from: Option<String>,
    pub account_to: Option<String>,
    pub account_group: Option<String>,
    pub cost_center: Option<String>,
    pub profit_center: Option<String>,
    pub period_from: Option<u8>,
    pub period_to: Option<u8>,
    pub currency: Option<String>,
}

pub struct GetGlBalancesResponse {
    pub balances: Vec<GlAccountBalance>,
    pub summary: BalanceSummary,
}

pub struct GlAccountBalance {
    pub account_number: String,
    pub account_name: String,
    pub account_type: String,
    pub opening_balance_debit: Decimal,
    pub opening_balance_credit: Decimal,
    pub period_debit: Decimal,
    pub period_credit: Decimal,
    pub cumulative_debit: Decimal,
    pub cumulative_credit: Decimal,
    pub closing_balance_debit: Decimal,
    pub closing_balance_credit: Decimal,
    pub currency: String,
}

// GET /api/v1/financial/balances/business-partners/{bp_id}
pub struct GetBpBalanceQuery {
    pub company_code: String,
    pub fiscal_year: Option<u16>,
    pub as_of_date: Option<NaiveDate>,
    pub include_open_items: bool,
}

pub struct GetBpBalanceResponse {
    pub bp_id: Uuid,
    pub bp_number: String,
    pub bp_name: String,
    pub reconciliation_account: String,
    pub current_balance: Decimal,
    pub overdue_balance: Decimal,
    pub currency: String,
    pub open_items: Option<Vec<OpenItem>>,
    pub last_payment_date: Option<NaiveDate>,
    pub last_payment_amount: Option<Decimal>,
}

pub struct OpenItem {
    pub document_id: Uuid,
    pub document_number: String,
    pub line_item_number: u16,
    pub posting_date: NaiveDate,
    pub due_date: NaiveDate,
    pub amount: Decimal,
    pub currency: String,
    pub days_overdue: i32,
    pub payment_terms: String,
}
```

#### 1.2.3 期末关账 API

```rust
// POST /api/v1/financial/period-close/prepare
pub struct PreparePeriodCloseRequest {
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
}

pub struct PreparePeriodCloseResponse {
    pub close_task_id: Uuid,
    pub status: String,
    pub pre_close_checks: Vec<PreCloseCheck>,
    pub warnings: Vec<String>,
    pub estimated_duration: u64,          // seconds
}

pub struct PreCloseCheck {
    pub check_id: String,
    pub check_name: String,
    pub status: CheckStatus,              // Passed, Failed, Warning
    pub message: String,
    pub details: Option<serde_json::Value>,
}

// Examples of pre-close checks:
// - All documents posted to correct period
// - No unbalanced transactions
// - Bank reconciliation completed
// - Fixed assets depreciation posted
// - Accruals and deferrals posted
// - Foreign currency revaluation completed
// - Tax calculation and posting completed
// - Cost allocations completed

// POST /api/v1/financial/period-close/execute
pub struct ExecutePeriodCloseRequest {
    pub close_task_id: Uuid,
    pub force_close: bool,                // Close even with warnings
    pub close_note: Option<String>,
}

pub struct ExecutePeriodCloseResponse {
    pub close_task_id: Uuid,
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
    pub status: String,                   // Closed
    pub closed_at: DateTime<Utc>,
    pub closed_by: String,
    pub close_duration: u64,              // seconds
    pub post_close_summary: CloseSummary,
}

pub struct CloseSummary {
    pub total_documents_posted: u64,
    pub total_debit_amount: Decimal,
    pub total_credit_amount: Decimal,
    pub period_end_balances: Vec<AccountBalance>,
}

// POST /api/v1/financial/period-close/reopen
pub struct ReopenPeriodRequest {
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
    pub reopen_reason: String,
    pub require_approval: bool,
}

pub struct ReopenPeriodResponse {
    pub status: String,                   // Reopened, PendingApproval
    pub reopened_at: DateTime<Utc>,
    pub reopened_by: String,
    pub approval_required_from: Option<Vec<String>>, // User IDs
}
```

### 1.3 领域事件

```rust
// Financial domain events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FinancialDomainEvent {
    DocumentCreated(DocumentCreated),
    DocumentPosted(DocumentPosted),
    DocumentParked(DocumentParked),
    DocumentReversed(DocumentReversed),
    LineItemCleared(LineItemCleared),
    PaymentReceived(PaymentReceived),
    PaymentMade(PaymentMade),
    PeriodClosed(PeriodClosed),
    PeriodReopened(PeriodReopened),
    GlAccountBalanceUpdated(GlAccountBalanceUpdated),
    BusinessPartnerBalanceUpdated(BusinessPartnerBalanceUpdated),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentPosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub document_id: Uuid,
    pub document_number: String,
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
    pub posting_date: NaiveDate,
    pub document_type: String,
    pub currency: String,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub line_items: Vec<PostedLineItem>,
    pub posted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostedLineItem {
    pub line_number: u16,
    pub gl_account: String,
    pub cost_center: Option<String>,
    pub profit_center: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub business_partner_id: Option<Uuid>,
    pub tax_code: Option<String>,
    pub tax_amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentReceived {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub payment_id: Uuid,
    pub payment_document_id: Uuid,
    pub payment_document_number: String,
    pub company_code: String,
    pub customer_id: Uuid,
    pub customer_number: String,
    pub payment_amount: Decimal,
    pub currency: String,
    pub payment_date: NaiveDate,
    pub payment_method: String,
    pub bank_account: String,
    pub reference: Option<String>,
    pub cleared_items: Vec<ClearedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearedItem {
    pub document_id: Uuid,
    pub document_number: String,
    pub line_item_number: u16,
    pub invoice_amount: Decimal,
    pub cleared_amount: Decimal,
    pub discount_amount: Decimal,
    pub remaining_amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeriodClosed {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
    pub closed_by: String,
    pub period_end_date: NaiveDate,
    pub total_documents: u64,
    pub total_debit: Decimal,
    pub total_credit: Decimal,
    pub close_duration_seconds: u64,
}
```

### 1.4 业务规则引擎

```rust
pub struct FinancialBusinessRules {
    pub rule_engine: Arc<RuleEngine>,
}

impl FinancialBusinessRules {
    // Validation rule: Transaction must be balanced
    pub fn validate_balanced_transaction(
        &self,
        line_items: &[LineItem],
    ) -> Result<(), DomainError> {
        let total_debit: Decimal = line_items.iter()
            .map(|item| item.debit_amount)
            .sum();
        let total_credit: Decimal = line_items.iter()
            .map(|item| item.credit_amount)
            .sum();

        if (total_debit - total_credit).abs() > Decimal::new(1, 2) { // 0.01 tolerance
            return Err(DomainError::TransactionUnbalanced {
                total_debit,
                total_credit,
                difference: total_debit - total_credit,
            });
        }
        Ok(())
    }

    // Validation rule: Posting date must be in open period
    pub async fn validate_posting_period(
        &self,
        company_code: &CompanyCode,
        posting_date: NaiveDate,
    ) -> Result<Period, DomainError> {
        let fiscal_year = self.derive_fiscal_year(company_code, posting_date).await?;
        let period = self.derive_posting_period(company_code, fiscal_year, posting_date).await?;

        let period_status = self.get_period_status(company_code, fiscal_year, period).await?;

        match period_status {
            PeriodStatus::Open => Ok(period),
            PeriodStatus::Closed => Err(DomainError::PeriodClosed {
                company_code: company_code.clone(),
                fiscal_year,
                period,
            }),
            PeriodStatus::NotOpened => Err(DomainError::PeriodNotOpened {
                company_code: company_code.clone(),
                fiscal_year,
                period,
            }),
        }
    }

    // Authorization rule: Check user posting authorization
    pub async fn check_posting_authorization(
        &self,
        user_id: &UserId,
        company_code: &CompanyCode,
        document_type: &DocumentType,
        amount: &Money,
    ) -> Result<(), DomainError> {
        let user_authorizations = self.get_user_authorizations(user_id).await?;

        let has_auth = user_authorizations.iter().any(|auth| {
            auth.company_code == *company_code
                && auth.document_types.contains(document_type)
                && amount.amount <= auth.amount_limit
        });

        if !has_auth {
            return Err(DomainError::InsufficientAuthorization {
                user_id: user_id.clone(),
                required_permission: format!("post_{}_{}", company_code.0, document_type),
                required_amount_limit: amount.amount,
            });
        }
        Ok(())
    }

    // Business rule: Calculate payment due date
    pub fn calculate_due_date(
        &self,
        baseline_date: NaiveDate,
        payment_terms: &PaymentTerms,
    ) -> NaiveDate {
        baseline_date + Duration::days(payment_terms.net_payment_terms as i64)
    }

    // Business rule: Calculate discount amounts
    pub fn calculate_discount(
        &self,
        invoice_amount: Decimal,
        payment_date: NaiveDate,
        baseline_date: NaiveDate,
        payment_terms: &PaymentTerms,
    ) -> Decimal {
        let days_from_baseline = (payment_date - baseline_date).num_days();

        for discount_term in &payment_terms.discount_terms {
            if days_from_baseline <= discount_term.discount_days as i64 {
                return invoice_amount * discount_term.discount_percent / Decimal::from(100);
            }
        }

        Decimal::ZERO
    }

    // Business rule: Foreign currency valuation
    pub async fn valuate_foreign_currency(
        &self,
        company_code: &CompanyCode,
        foreign_currency: &Currency,
        foreign_amount: Decimal,
        valuation_date: NaiveDate,
    ) -> Result<Decimal, DomainError> {
        let exchange_rate = self.get_exchange_rate(
            company_code,
            foreign_currency,
            valuation_date,
        ).await?;

        Ok(foreign_amount * exchange_rate.rate)
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PeriodStatus {
    NotOpened,
    Open,
    Closed,
}

pub struct UserAuthorization {
    pub authorization_id: Uuid,
    pub user_id: UserId,
    pub company_code: CompanyCode,
    pub document_types: Vec<DocumentType>,
    pub amount_limit: Decimal,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
}
```

### 1.5 集成点

```rust
// Financial module integration interfaces

// 1. Integration with Controlling (CO)
pub trait ControllingIntegration {
    // Post cost center/profit center actual data
    async fn post_actual_costs(
        &self,
        document_id: Uuid,
        cost_postings: Vec<CostPosting>,
    ) -> Result<(), IntegrationError>;

    // Validate cost object (cost center, internal order, WBS)
    async fn validate_cost_object(
        &self,
        cost_object_type: CostObjectType,
        cost_object_id: String,
        validity_date: NaiveDate,
    ) -> Result<CostObjectValidation, IntegrationError>;
}

pub struct CostPosting {
    pub cost_element: String,            // From GL account mapping
    pub cost_center: Option<String>,
    pub profit_center: Option<String>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,
    pub amount: Decimal,
    pub quantity: Option<Decimal>,
    pub unit: Option<String>,
}

// 2. Integration with Materials Management (MM)
pub trait MaterialsIntegration {
    // Post invoice verification
    async fn post_invoice_verification(
        &self,
        document_id: Uuid,
        invoice_data: InvoiceVerificationData,
    ) -> Result<(), IntegrationError>;

    // Get purchase order details for 3-way match
    async fn get_purchase_order(
        &self,
        po_number: String,
    ) -> Result<PurchaseOrderDetails, IntegrationError>;
}

// 3. Integration with Sales & Distribution (SD)
pub trait SalesIntegration {
    // Create customer invoice from billing document
    async fn create_customer_invoice(
        &self,
        billing_document_id: Uuid,
    ) -> Result<Uuid, IntegrationError>;

    // Update billing document with accounting document reference
    async fn update_billing_document_reference(
        &self,
        billing_document_id: Uuid,
        accounting_document_id: Uuid,
    ) -> Result<(), IntegrationError>;
}

// 4. Integration with Asset Accounting (AA)
pub trait AssetAccountingIntegration {
    // Post asset acquisition
    async fn post_asset_acquisition(
        &self,
        document_id: Uuid,
        asset_postings: Vec<AssetPosting>,
    ) -> Result<(), IntegrationError>;

    // Post depreciation
    async fn post_depreciation(
        &self,
        company_code: CompanyCode,
        fiscal_year: FiscalYear,
        period: Period,
        depreciation_run_id: Uuid,
    ) -> Result<Uuid, IntegrationError>;
}

// 5. Integration with Treasury (TR)
pub trait TreasuryIntegration {
    // Post payment document to cash management
    async fn post_cash_transaction(
        &self,
        document_id: Uuid,
        payment_data: CashTransactionData,
    ) -> Result<(), IntegrationError>;

    // Update liquidity forecast
    async fn update_liquidity_forecast(
        &self,
        company_code: CompanyCode,
        value_date: NaiveDate,
        amount: Decimal,
        currency: Currency,
    ) -> Result<(), IntegrationError>;
}

// 6. Integration with Tax Engine
pub trait TaxEngineIntegration {
    // Calculate tax
    async fn calculate_tax(
        &self,
        tax_calculation_request: TaxCalculationRequest,
    ) -> Result<TaxCalculationResult, IntegrationError>;

    // Validate tax code
    async fn validate_tax_code(
        &self,
        company_code: CompanyCode,
        tax_code: String,
        transaction_date: NaiveDate,
    ) -> Result<TaxCodeValidation, IntegrationError>;
}

pub struct TaxCalculationRequest {
    pub company_code: CompanyCode,
    pub tax_code: String,
    pub base_amount: Decimal,
    pub transaction_date: NaiveDate,
    pub business_place: Option<String>,
    pub tax_classification: Option<String>,
}

pub struct TaxCalculationResult {
    pub tax_amount: Decimal,
    pub tax_base_amount: Decimal,
    pub tax_rate: Decimal,
    pub tax_jurisdiction: String,
    pub tax_account: String,
}
```

---

## 第二部分：成本控制模块 (CO - Controlling)

### 2.1 数据模型

#### 2.1.1 成本中心 (Cost Center)

```rust
pub struct CostCenter {
    pub cost_center_id: Uuid,
    pub cost_center_code: String,         // 10-digit: CC-1000, CC-2000
    pub controlling_area: ControllingArea,
    pub company_code: Option<CompanyCode>,

    // Hierarchy
    pub cost_center_group: Option<CostCenterGroup>,
    pub parent_cost_center: Option<String>,
    pub hierarchy_level: u8,

    // Classification
    pub cost_center_category: CostCenterCategory,
    pub cost_center_type: CostCenterType, // Production, Service, Admin, Sales
    pub activity_type: Option<ActivityType>,

    // Organizational Assignment
    pub business_area: Option<BusinessArea>,
    pub functional_area: Option<FunctionalArea>,
    pub department: Option<Department>,
    pub responsible_person: Option<UserId>,

    // Control Parameters
    pub currency: Currency,
    pub profit_center: Option<ProfitCenter>,
    pub lock_indicator: bool,             // Lock for actual postings
    pub statistical_cost_center: bool,    // Only for statistical postings

    // Descriptions
    pub name: String,
    pub description: Option<String>,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CostCenterCategory {
    Production,      // Direct production activities
    Service,         // Service providing (e.g., maintenance, IT)
    Administration,  // Administrative functions
    Sales,          // Sales and marketing
    Research,       // R&D activities
}

pub struct ControllingArea {
    pub controlling_area_code: String,    // 4-digit code
    pub name: String,
    pub currency: Currency,
    pub fiscal_year_variant: FiscalYearVariant,
    pub chart_of_accounts: ChartOfAccounts,
    pub company_codes: Vec<CompanyCode>,  // Assigned company codes
}
```

#### 2.1.2 成本要素 (Cost Element)

```rust
pub struct CostElement {
    pub cost_element_id: Uuid,
    pub cost_element_code: String,        // Matches GL account number
    pub controlling_area: ControllingArea,

    // Classification
    pub cost_element_category: CostElementCategory,
    pub cost_element_group: Option<CostElementGroup>,

    // Attributes
    pub name: String,
    pub description: Option<String>,

    // Control
    pub attribute_group: Option<AttributeGroup>,
    pub default_cost_center: Option<String>,
    pub default_activity_type: Option<ActivityType>,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CostElementCategory {
    Primary,         // Category 1: Primary costs from FI
    Secondary,       // Category 2: Internal allocations
    Revenue,         // Category 11: Revenue posting
    SalesDeduction,  // Category 12: Sales deductions
    ExternalSettlement, // Category 31: Settlement to FI
    InternalSettlement, // Category 42: Settlement within CO
}

pub struct CostElementGroup {
    pub group_code: String,
    pub group_name: String,
    pub cost_elements: Vec<String>,
    pub hierarchy_level: u8,
}
```

#### 2.1.3 内部订单 (Internal Order)

```rust
pub struct InternalOrder {
    pub order_id: Uuid,
    pub order_number: String,             // Format: IO-2025-000001
    pub controlling_area: ControllingArea,
    pub company_code: CompanyCode,

    // Classification
    pub order_type: OrderType,
    pub order_category: OrderCategory,    // Overhead, Investment, Accrual

    // Organizational Assignment
    pub cost_center: Option<String>,
    pub profit_center: Option<ProfitCenter>,
    pub business_area: Option<BusinessArea>,
    pub responsible_person: UserId,

    // Planning
    pub planning_profile: Option<PlanningProfile>,
    pub planned_costs: Decimal,
    pub planned_revenue: Option<Decimal>,

    // Budget Control
    pub budget_profile: Option<BudgetProfile>,
    pub original_budget: Decimal,
    pub current_budget: Decimal,          // After supplements/returns
    pub available_budget: Decimal,        // Budget - commitments - actuals
    pub budget_status: BudgetStatus,

    // Actual Data
    pub actual_costs: Decimal,
    pub actual_revenue: Decimal,
    pub commitment_value: Decimal,        // From purchase requisitions/orders

    // Settlement
    pub settlement_profile: Option<SettlementProfile>,
    pub settlement_receiver: Option<SettlementReceiver>,
    pub settlement_rule: Option<SettlementRule>,

    // Status
    pub system_status: SystemStatus,
    pub user_status: Option<UserStatus>,

    // Descriptions
    pub description: String,
    pub long_text: Option<String>,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OrderCategory {
    Overhead,        // Overhead orders for indirect costs
    Investment,      // Capital investment orders
    Accrual,         // Accrual/deferral orders
    Revenue,         // Revenue-earning orders
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SystemStatus {
    Created,         // CRTD
    Released,        // REL
    TechnicallyCompleted, // TECO
    Closed,          // CLSD
    Deleted,         // DLT
}

pub struct SettlementRule {
    pub settlement_rule_id: Uuid,
    pub order_id: Uuid,
    pub receivers: Vec<SettlementReceiver>,
    pub settlement_type: SettlementType, // Full, Percentage, Equivalence numbers
}

pub struct SettlementReceiver {
    pub receiver_type: ReceiverType,
    pub receiver_id: String,
    pub settlement_percentage: Option<Decimal>,
    pub settlement_amount: Option<Decimal>,
    pub equivalence_number: Option<Decimal>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReceiverType {
    CostCenter,
    InternalOrder,
    WbsElement,
    FixedAsset,
    Material,
    ProfitCenter,
    GlAccount,
}
```

#### 2.1.4 作业类型 (Activity Type)

```rust
pub struct ActivityType {
    pub activity_type_id: Uuid,
    pub activity_type_code: String,       // Format: ACT-LABOR, ACT-MACHINE
    pub controlling_area: ControllingArea,

    // Classification
    pub activity_type_group: Option<ActivityTypeGroup>,
    pub activity_category: ActivityCategory,

    // Unit of Measure
    pub activity_unit: Unit,              // Hour, KWH, KM, etc.

    // Planning
    pub plan_activity_price: Option<Decimal>,
    pub plan_capacity: Option<Decimal>,

    // Actual
    pub actual_activity_price: Option<Decimal>,
    pub actual_activity_quantity: Decimal,

    // Allocation
    pub allocation_method: AllocationMethod,
    pub allocation_structure: Option<AllocationStructure>,

    // Descriptions
    pub name: String,
    pub description: Option<String>,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActivityCategory {
    ManualEntry,     // Category 1: Manual activity allocation
    IndirectAllocation, // Category 2: Indirect activity allocation
    Automatic,       // Category 3: Automatic allocation
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AllocationMethod {
    DirectAllocation,
    AssessmentAllocation,
    DistributionAllocation,
    TemplateAllocation,
}
```

### 2.2 API 规格

#### 2.2.1 成本中心计划 API

```rust
// POST /api/v1/controlling/cost-centers/{cost_center}/plans
pub struct CreateCostCenterPlanRequest {
    pub cost_center: String,
    pub fiscal_year: u16,
    pub version: String,                  // Plan version: 0 (original), 1, 2, ...
    pub plan_profile: String,

    pub cost_element_plans: Vec<CostElementPlan>,
    pub activity_type_plans: Option<Vec<ActivityTypePlan>>,
}

pub struct CostElementPlan {
    pub cost_element: String,
    pub period_values: Vec<PeriodValue>,  // 12 or 16 periods
    pub total_annual_value: Decimal,
    pub quantity: Option<Decimal>,
    pub unit: Option<String>,
}

pub struct PeriodValue {
    pub period: u8,
    pub value: Decimal,
}

pub struct ActivityTypePlan {
    pub activity_type: String,
    pub plan_capacity: Decimal,           // Available capacity
    pub plan_activity_price: Decimal,     // Price per unit
    pub period_distribution: Vec<PeriodValue>,
}

pub struct CreateCostCenterPlanResponse {
    pub plan_id: Uuid,
    pub cost_center: String,
    pub fiscal_year: u16,
    pub version: String,
    pub total_plan_costs: Decimal,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// GET /api/v1/controlling/cost-centers/{cost_center}/plans
pub struct GetCostCenterPlanQuery {
    pub fiscal_year: u16,
    pub version: Option<String>,
    pub include_actuals: bool,
    pub include_commitments: bool,
}

pub struct GetCostCenterPlanResponse {
    pub cost_center: String,
    pub cost_center_name: String,
    pub fiscal_year: u16,
    pub version: String,
    pub currency: String,
    pub plan_data: Vec<CostElementPlanData>,
    pub actual_data: Option<Vec<CostElementActualData>>,
    pub variance_data: Option<Vec<VarianceData>>,
}

pub struct CostElementPlanData {
    pub cost_element: String,
    pub cost_element_name: String,
    pub cost_element_category: String,
    pub period_values: Vec<PeriodValue>,
    pub annual_total: Decimal,
}

pub struct VarianceData {
    pub cost_element: String,
    pub plan_value: Decimal,
    pub actual_value: Decimal,
    pub absolute_variance: Decimal,
    pub percentage_variance: Decimal,
}
```

#### 2.2.2 内部订单 API

```rust
// POST /api/v1/controlling/internal-orders
pub struct CreateInternalOrderRequest {
    pub order_type: String,
    pub company_code: String,
    pub order_category: String,
    pub description: String,
    pub responsible_person: Uuid,
    pub cost_center: Option<String>,
    pub profit_center: Option<String>,
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,
    pub budget: Option<Decimal>,
    pub settlement_rule: Option<CreateSettlementRuleRequest>,
}

pub struct CreateSettlementRuleRequest {
    pub settlement_profile: String,
    pub receivers: Vec<SettlementReceiverRequest>,
}

pub struct SettlementReceiverRequest {
    pub receiver_type: String,            // CostCenter, WbsElement, Asset, etc.
    pub receiver_id: String,
    pub settlement_percentage: Option<Decimal>,
}

pub struct CreateInternalOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/controlling/internal-orders/{order_id}/budget
pub struct UpdateBudgetRequest {
    pub budget_type: String,              // Original, Supplement, Return
    pub amount: Decimal,
    pub reason: String,
    pub approval_id: Option<Uuid>,
}

pub struct UpdateBudgetResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub original_budget: Decimal,
    pub current_budget: Decimal,
    pub available_budget: Decimal,
    pub updated_at: DateTime<Utc>,
}

// POST /api/v1/controlling/internal-orders/{order_id}/settle
pub struct SettleInternalOrderRequest {
    pub settlement_period: u8,
    pub fiscal_year: u16,
    pub settlement_type: String,          // Full, Partial
    pub settlement_percentage: Option<Decimal>,
    pub test_run: bool,
}

pub struct SettleInternalOrderResponse {
    pub settlement_id: Uuid,
    pub settlement_document_id: Option<Uuid>,
    pub order_id: Uuid,
    pub order_number: String,
    pub settled_amount: Decimal,
    pub settlement_receivers: Vec<SettlementReceiverResult>,
    pub status: String,
    pub settled_at: DateTime<Utc>,
}

pub struct SettlementReceiverResult {
    pub receiver_type: String,
    pub receiver_id: String,
    pub settled_amount: Decimal,
    pub percentage: Decimal,
}

// GET /api/v1/controlling/internal-orders/{order_id}/actual-costs
pub struct GetOrderActualCostsQuery {
    pub fiscal_year: u16,
    pub period_from: Option<u8>,
    pub period_to: Option<u8>,
    pub cost_element: Option<String>,
    pub include_commitments: bool,
}

pub struct GetOrderActualCostsResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub description: String,
    pub fiscal_year: u16,
    pub currency: String,
    pub actual_line_items: Vec<ActualLineItem>,
    pub summary: ActualCostsSummary,
}

pub struct ActualLineItem {
    pub posting_date: NaiveDate,
    pub posting_period: u8,
    pub document_number: String,
    pub cost_element: String,
    pub cost_element_name: String,
    pub amount: Decimal,
    pub quantity: Option<Decimal>,
    pub unit: Option<String>,
    pub partner_object_type: Option<String>,
    pub partner_object_id: Option<String>,
}

pub struct ActualCostsSummary {
    pub total_actual_costs: Decimal,
    pub total_commitments: Decimal,
    pub current_budget: Decimal,
    pub available_budget: Decimal,
    pub budget_utilization_percentage: Decimal,
}
```

#### 2.2.3 成本分摊/分配 API

```rust
// POST /api/v1/controlling/allocations/assessment
pub struct CreateAssessmentRequest {
    pub cycle_name: String,
    pub fiscal_year: u16,
    pub period: u8,
    pub sender_cost_centers: Vec<String>,
    pub assessment_cost_element: String,
    pub allocation_base: AllocationBase,
    pub receivers: Vec<AllocationReceiver>,
    pub test_run: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum AllocationBase {
    FixedAmount,
    FixedPercentage,
    Variable { tracing_factor: String },  // e.g., "NUMBER_OF_EMPLOYEES"
    ActivityBased { activity_type: String },
}

pub struct AllocationReceiver {
    pub cost_center: String,
    pub percentage: Option<Decimal>,
    pub fixed_amount: Option<Decimal>,
    pub tracing_factor_value: Option<Decimal>,
}

pub struct CreateAssessmentResponse {
    pub assessment_id: Uuid,
    pub cycle_name: String,
    pub total_allocated_amount: Decimal,
    pub allocation_lines: Vec<AllocationLine>,
    pub status: String,
    pub executed_at: DateTime<Utc>,
}

pub struct AllocationLine {
    pub sender_cost_center: String,
    pub receiver_cost_center: String,
    pub allocated_amount: Decimal,
    pub allocation_percentage: Decimal,
    pub cost_element: String,
}

// POST /api/v1/controlling/allocations/distribution
pub struct CreateDistributionRequest {
    pub cycle_name: String,
    pub fiscal_year: u16,
    pub period: u8,
    pub sender_cost_centers: Vec<String>,
    pub original_cost_elements: Vec<String>, // Cost elements to distribute
    pub allocation_base: AllocationBase,
    pub receivers: Vec<AllocationReceiver>,
    pub test_run: bool,
}

// Distribution maintains original cost element, unlike assessment

// POST /api/v1/controlling/allocations/activity
pub struct CreateActivityAllocationRequest {
    pub cycle_name: String,
    pub fiscal_year: u16,
    pub period: u8,
    pub sending_cost_center: String,
    pub activity_type: String,
    pub activity_price: Decimal,
    pub allocations: Vec<ActivityAllocation>,
    pub test_run: bool,
}

pub struct ActivityAllocation {
    pub receiver_type: String,            // CostCenter, InternalOrder, WbsElement
    pub receiver_id: String,
    pub activity_quantity: Decimal,
    pub activity_unit: String,
}

pub struct CreateActivityAllocationResponse {
    pub allocation_id: Uuid,
    pub sending_cost_center: String,
    pub activity_type: String,
    pub total_activity_quantity: Decimal,
    pub activity_price: Decimal,
    pub total_allocated_amount: Decimal,
    pub allocation_lines: Vec<ActivityAllocationLine>,
    pub status: String,
}

pub struct ActivityAllocationLine {
    pub receiver_type: String,
    pub receiver_id: String,
    pub activity_quantity: Decimal,
    pub allocated_amount: Decimal,
}
```

### 2.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ControllingDomainEvent {
    CostCenterCreated(CostCenterCreated),
    CostCenterPlanCreated(CostCenterPlanCreated),
    InternalOrderCreated(InternalOrderCreated),
    InternalOrderBudgetUpdated(InternalOrderBudgetUpdated),
    InternalOrderSettled(InternalOrderSettled),
    ActualCostsPosted(ActualCostsPosted),
    AssessmentCycleExecuted(AssessmentCycleExecuted),
    DistributionCycleExecuted(DistributionCycleExecuted),
    ActivityAllocationPosted(ActivityAllocationPosted),
    PeriodEndClosingExecuted(PeriodEndClosingExecuted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActualCostsPosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub document_id: Uuid,
    pub company_code: String,
    pub fiscal_year: u16,
    pub posting_period: u8,
    pub postings: Vec<CostPosting>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostPosting {
    pub cost_element: String,
    pub cost_object_type: String,         // CostCenter, InternalOrder, WbsElement
    pub cost_object_id: String,
    pub debit_credit_indicator: String,   // S - Debit, H - Credit
    pub amount: Decimal,
    pub quantity: Option<Decimal>,
    pub unit: Option<String>,
    pub partner_object_type: Option<String>,
    pub partner_object_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InternalOrderSettled {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub settlement_id: Uuid,
    pub settlement_document_id: Uuid,
    pub order_id: Uuid,
    pub order_number: String,
    pub fiscal_year: u16,
    pub settlement_period: u8,
    pub settlement_type: String,
    pub settled_amount: Decimal,
    pub receivers: Vec<SettlementReceiverData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementReceiverData {
    pub receiver_type: String,
    pub receiver_id: String,
    pub settled_amount: Decimal,
    pub settlement_cost_element: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentCycleExecuted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub assessment_id: Uuid,
    pub cycle_name: String,
    pub fiscal_year: u16,
    pub period: u8,
    pub assessment_cost_element: String,
    pub total_allocated_amount: Decimal,
    pub allocations: Vec<AllocationData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllocationData {
    pub sender_cost_center: String,
    pub receiver_cost_center: String,
    pub allocated_amount: Decimal,
    pub allocation_base_value: Option<Decimal>,
}
```

---

## 第三部分：物料管理模块 (MM - Materials Management)

### 3.1 数据模型

#### 3.1.1 物料主数据 (Material Master)

```rust
pub struct MaterialMaster {
    pub material_id: Uuid,
    pub material_number: String,          // Format: MAT-000001 or intelligent numbering
    pub material_type: MaterialType,
    pub industry_sector: IndustrySector,

    // Basic Data
    pub basic_data: MaterialBasicData,

    // Classification
    pub material_group: MaterialGroup,
    pub product_hierarchy: Option<ProductHierarchy>,
    pub division: Option<Division>,

    // Purchasing Data (per purchasing organization)
    pub purchasing_data: HashMap<PurchasingOrg, PurchasingData>,

    // Sales Data (per sales organization)
    pub sales_data: HashMap<SalesOrg, SalesData>,

    // Storage Data (per plant)
    pub plant_data: HashMap<Plant, PlantData>,

    // Storage Location Data (per plant/storage location)
    pub storage_location_data: HashMap<(Plant, StorageLocation), StorageLocationData>,

    // Accounting Data (per valuation area)
    pub accounting_data: HashMap<ValuationArea, AccountingData>,

    // Quality Management
    pub quality_data: Option<QualityData>,

    // Status
    pub material_status: MaterialStatus,
    pub deletion_flag: bool,
    pub deletion_date: Option<NaiveDate>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct MaterialBasicData {
    pub description: String,
    pub old_material_number: Option<String>,
    pub base_unit_of_measure: Unit,
    pub material_group: String,
    pub gross_weight: Option<Decimal>,
    pub net_weight: Option<Decimal>,
    pub weight_unit: Option<Unit>,
    pub volume: Option<Decimal>,
    pub volume_unit: Option<Unit>,
    pub size_dimensions: Option<String>,
    pub ean_upc: Option<String>,            // Barcode
    pub manufacturer_part_number: Option<String>,
    pub external_material_group: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MaterialType {
    ROH,     // Raw material
    HALB,    // Semi-finished product
    FERT,    // Finished product
    HAWA,    // Trading goods
    VERP,    // Packaging material
    UNBW,    // Non-valuated material
    DIEN,    // Services
    NLAG,    // Non-stock material
}

pub struct PurchasingData {
    pub purchasing_org: PurchasingOrg,
    pub purchasing_group: Option<PurchasingGroup>,
    pub plant: Option<Plant>,

    // Procurement
    pub automatic_po: bool,
    pub source_list_required: bool,
    pub mrp_type: Option<MrpType>,
    pub reorder_point: Option<Decimal>,
    pub maximum_stock_level: Option<Decimal>,
    pub fixed_lot_size: Option<Decimal>,
    pub procurement_type: ProcurementType, // External, In-house, Both

    // Pricing
    pub standard_price: Option<Money>,
    pub price_unit: Option<Decimal>,
    pub price_control: Option<PriceControl>,
    pub moving_average_price: Option<Money>,

    // Lead Time
    pub planned_delivery_time: u16,        // Days
    pub gr_processing_time: u16,           // Days for goods receipt

    // Vendor
    pub regular_vendor: Option<Uuid>,
    pub minimum_order_quantity: Option<Decimal>,
    pub standard_order_quantity: Option<Decimal>,
    pub maximum_order_quantity: Option<Decimal>,

    // Quality
    pub quality_inspection: bool,
    pub certificate_type: Option<CertificateType>,

    // Batch Management
    pub batch_management_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProcurementType {
    External,     // E - Purchase from vendor
    InHouse,      // F - In-house production
    Both,         // X - Both procurement types
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PriceControl {
    Standard,     // S - Standard price
    MovingAverage, // V - Moving average price
}

pub struct PlantData {
    pub plant: Plant,

    // MRP (Material Requirements Planning)
    pub mrp_controller: Option<MrpController>,
    pub mrp_type: MrpType,
    pub lot_size_procedure: LotSizeProcedure,
    pub minimum_lot_size: Option<Decimal>,
    pub maximum_lot_size: Option<Decimal>,
    pub lot_size_rounding: Option<Decimal>,

    // Stock levels
    pub safety_stock: Option<Decimal>,
    pub reorder_point: Option<Decimal>,
    pub maximum_stock_level: Option<Decimal>,

    // Lead times
    pub in_house_production_time: Option<u16>, // Days
    pub gr_processing_time: u16,
    pub planned_delivery_time: u16,

    // Availability
    pub availability_check: bool,
    pub checking_group: Option<CheckingGroup>,

    // Serialization
    pub serial_number_profile: Option<SerialNumberProfile>,

    // Production
    pub production_supervisor: Option<UserId>,
    pub production_scheduler: Option<UserId>,
    pub backflush: bool,                   // Automatic goods issue in production

    // Warehouse Management
    pub storage_conditions: Option<StorageConditions>,
    pub temperature_conditions: Option<TemperatureConditions>,
    pub hazardous_material: bool,
    pub hazmat_number: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MrpType {
    PD,      // MRP based on consumption
    VB,      // Manual reorder point planning
    VM,      // Automatic reorder point planning
    VV,      // Forecast-based planning
    ND,      // No planning
}

pub struct AccountingData {
    pub valuation_area: ValuationArea,    // Typically plant or company code
    pub valuation_class: ValuationClass,
    pub price_control: PriceControl,
    pub moving_price: Money,
    pub standard_price: Money,
    pub price_unit: Decimal,
    pub currency: Currency,

    // Accounts
    pub valuation_category: Option<ValuationCategory>,
    pub valuation_type: Option<ValuationType>,

    // Costing
    pub cost_estimate: Option<CostEstimate>,
    pub with_quantity_structure: bool,
    pub material_origin: Option<MaterialOrigin>,
    pub overhead_group: Option<OverheadGroup>,
}

pub struct CostEstimate {
    pub cost_estimate_id: Uuid,
    pub costing_date: NaiveDate,
    pub costing_version: String,
    pub costing_lot_size: Decimal,
    pub total_cost: Money,
    pub cost_components: Vec<CostComponent>,
}

pub struct CostComponent {
    pub cost_element: String,
    pub cost_amount: Money,
    pub cost_percentage: Decimal,
}
```

#### 3.1.2 采购申请 (Purchase Requisition)

```rust
pub struct PurchaseRequisition {
    pub requisition_id: Uuid,
    pub requisition_number: String,       // Format: PR-2025-000001
    pub requisition_type: RequisitionType,
    pub company_code: CompanyCode,
    pub purchasing_org: PurchasingOrg,
    pub purchasing_group: PurchasingGroup,

    // Requester
    pub requester: UserId,
    pub cost_center: Option<CostCenter>,
    pub gl_account: Option<String>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,

    // Items
    pub items: Vec<PurchaseRequisitionItem>,

    // Approval
    pub approval_status: ApprovalStatus,
    pub approval_workflow_id: Option<Uuid>,
    pub approvers: Vec<ApprovalStep>,

    // Source Determination
    pub source_determination_done: bool,

    // Status
    pub overall_status: RequisitionStatus,
    pub deletion_indicator: bool,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct PurchaseRequisitionItem {
    pub item_number: u16,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub short_text: String,
    pub quantity: Decimal,
    pub unit: Unit,
    pub delivery_date: NaiveDate,
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,

    // Valuation
    pub valuation_price: Option<Money>,
    pub currency: Currency,
    pub estimated_value: Money,

    // Account Assignment
    pub account_assignment_category: AccountAssignmentCategory,
    pub cost_center: Option<CostCenter>,
    pub gl_account: Option<String>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,
    pub asset: Option<String>,

    // Source
    pub fixed_vendor: Option<Uuid>,
    pub source_of_supply: Option<SourceOfSupply>,
    pub purchasing_info_record: Option<Uuid>,
    pub contract: Option<String>,
    pub contract_item: Option<u16>,

    // Status
    pub item_status: RequisitionItemStatus,
    pub assigned_to_po: Option<PurchaseOrderReference>,
    pub goods_receipt_qty: Decimal,
    pub invoice_receipt_qty: Decimal,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AccountAssignmentCategory {
    K,       // Cost center
    A,       // Asset
    P,       // Project (WBS element)
    F,       // Order (Internal order)
    U,       // Unknown (no account assignment)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RequisitionStatus {
    Created,
    PendingApproval,
    Approved,
    Rejected,
    Assigned,                             // Assigned to PO
    PartiallyAssigned,
    Closed,
}

pub struct ApprovalStep {
    pub step_number: u8,
    pub approver: UserId,
    pub approval_required_by: DateTime<Utc>,
    pub approval_status: ApprovalStepStatus,
    pub approved_at: Option<DateTime<Utc>>,
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ApprovalStepStatus {
    Pending,
    Approved,
    Rejected,
    Skipped,
}
```

#### 3.1.3 采购订单 (Purchase Order)

```rust
pub struct PurchaseOrder {
    pub po_id: Uuid,
    pub po_number: String,                // Format: PO-2025-000001
    pub po_type: PurchaseOrderType,
    pub company_code: CompanyCode,
    pub purchasing_org: PurchasingOrg,
    pub purchasing_group: PurchasingGroup,

    // Vendor
    pub vendor_id: Uuid,
    pub vendor_number: String,
    pub vendor_name: String,

    // Header Data
    pub document_date: NaiveDate,
    pub currency: Currency,
    pub exchange_rate: Option<ExchangeRate>,
    pub payment_terms: PaymentTerms,
    pub incoterms: Option<Incoterms>,
    pub incoterms_location: Option<String>,

    // Delivery
    pub collective_number: Option<String>,
    pub shipping_conditions: Option<ShippingConditions>,

    // Items
    pub items: Vec<PurchaseOrderItem>,

    // Pricing
    pub net_order_value: Money,
    pub gross_order_value: Money,
    pub tax_amount: Money,

    // Status
    pub overall_status: PurchaseOrderStatus,
    pub approval_status: ApprovalStatus,
    pub deletion_indicator: bool,

    // References
    pub requisition_numbers: Vec<String>,
    pub quotation_number: Option<String>,
    pub contract_number: Option<String>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct PurchaseOrderItem {
    pub item_number: u16,
    pub item_category: ItemCategory,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub short_text: String,

    // Quantity & Delivery
    pub order_quantity: Decimal,
    pub unit: Unit,
    pub delivery_date: NaiveDate,
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,

    // Pricing
    pub net_price: Money,
    pub price_unit: Decimal,
    pub gross_price: Money,
    pub discount_percentage: Option<Decimal>,
    pub discount_amount: Option<Money>,
    pub net_value: Money,
    pub tax_code: Option<TaxCode>,
    pub tax_amount: Money,
    pub gross_value: Money,

    // Account Assignment
    pub account_assignment_category: AccountAssignmentCategory,
    pub gl_account: Option<String>,
    pub cost_center: Option<CostCenter>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,
    pub asset: Option<String>,

    // Goods Receipt
    pub goods_receipt_indicator: bool,
    pub goods_receipt_qty: Decimal,
    pub open_qty: Decimal,

    // Invoice Receipt
    pub invoice_receipt_indicator: bool,
    pub evaluated_receipt_settlement: bool, // ERS - auto invoice creation
    pub invoiced_qty: Decimal,

    // Quality
    pub quality_inspection_required: bool,
    pub certificate_type: Option<CertificateType>,

    // Status
    pub item_status: PurchaseOrderItemStatus,
    pub confirmation_control: Option<ConfirmationControl>,
    pub over_delivery_tolerance: Decimal, // Percentage
    pub under_delivery_tolerance: Decimal,
    pub unlimited_over_delivery: bool,

    // References
    pub requisition_number: Option<String>,
    pub requisition_item: Option<u16>,
    pub quotation_number: Option<String>,
    pub quotation_item: Option<u16>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PurchaseOrderType {
    Standard,       // NB - Standard PO
    Subcontracting, // ZUB - Subcontracting
    Consignment,    // ZKO - Consignment
    StockTransfer,  // ZUL - Stock transfer
    Service,        // ZSE - Service PO
    Framework,      // ZFO - Framework order
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PurchaseOrderStatus {
    Created,
    Released,
    PartiallyDelivered,
    FullyDelivered,
    PartiallyInvoiced,
    FullyInvoiced,
    Closed,
    Cancelled,
}

pub struct Incoterms {
    pub incoterm_code: String,            // EXW, FOB, CIF, DDP, etc.
    pub incoterm_location: String,
    pub incoterm_version: String,         // Incoterms 2020, etc.
}
```

#### 3.1.4 收货单 (Goods Receipt)

```rust
pub struct GoodsReceipt {
    pub gr_id: Uuid,
    pub material_document_number: String, // Format: GR-2025-000001
    pub material_document_year: u16,
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub movement_type: MovementType,

    // Header
    pub company_code: CompanyCode,
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,
    pub vendor_id: Option<Uuid>,
    pub header_text: Option<String>,

    // Items
    pub items: Vec<GoodsReceiptItem>,

    // Status
    pub status: GoodsReceiptStatus,
    pub reversed: bool,
    pub reversal_document: Option<String>,

    // Accounting Document
    pub accounting_document_id: Option<Uuid>,
    pub accounting_document_number: Option<String>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct GoodsReceiptItem {
    pub item_number: u16,
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,

    // Quantity
    pub quantity: Decimal,
    pub unit: Unit,
    pub entry_unit: Option<Unit>,          // Different from base unit

    // Location
    pub plant: Plant,
    pub storage_location: StorageLocation,
    pub storage_bin: Option<StorageBin>,
    pub batch: Option<Batch>,
    pub serial_numbers: Vec<SerialNumber>,

    // Valuation
    pub valuation_type: Option<ValuationType>,
    pub amount_in_local_currency: Money,
    pub amount_in_document_currency: Option<Money>,
    pub price_per_unit: Money,

    // Reference
    pub purchase_order_number: Option<String>,
    pub po_item_number: Option<u16>,
    pub delivery_note_number: Option<String>,
    pub delivery_note_item: Option<u16>,

    // Quality
    pub quality_inspection_required: bool,
    pub inspection_lot_number: Option<String>,
    pub stock_type: StockType,             // Unrestricted, Quality Inspection, Blocked

    // Account Assignment
    pub gl_account: Option<String>,
    pub cost_center: Option<CostCenter>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,

    // Status
    pub item_status: GoodsReceiptItemStatus,
    pub reason_for_movement: Option<ReasonForMovement>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MovementType {
    _101,    // GR for PO into warehouse
    _102,    // GR reversal for PO
    _103,    // GR for PO into blocked stock
    _105,    // GR from blocked to unrestricted
    _122,    // Return delivery to vendor
    _161,    // GR for free goods
    _201,    // GR from storage location to consumption
    _261,    // GR from production order
    _262,    // Reversal of 261
    _301,    // Transfer posting from plant to plant
    _311,    // Transfer posting from storage location to storage location
    _551,    // Scrapping from warehouse
    _561,    // Initial entry of stock balances
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StockType {
    Unrestricted,            // Available for use
    QualityInspection,       // Pending QC
    Blocked,                 // Blocked for use
    Returns,                 // Returns stock
    InTransit,               // In transit between plants
}
```

### 3.2 API 规格

#### 3.2.1 物料主数据 API

```rust
// POST /api/v1/materials/materials
pub struct CreateMaterialRequest {
    pub material_type: String,
    pub industry_sector: String,
    pub basic_data: MaterialBasicDataRequest,
    pub organizational_levels: OrganizationalLevelsRequest,
}

pub struct MaterialBasicDataRequest {
    pub description: String,
    pub base_unit_of_measure: String,
    pub material_group: String,
    pub gross_weight: Option<Decimal>,
    pub weight_unit: Option<String>,
}

pub struct OrganizationalLevelsRequest {
    pub plants: Vec<String>,
    pub storage_locations: Option<Vec<(String, String)>>, // (plant, sloc)
    pub purchasing_orgs: Vec<String>,
    pub sales_orgs: Option<Vec<String>>,
}

pub struct CreateMaterialResponse {
    pub material_id: Uuid,
    pub material_number: String,
    pub created_at: DateTime<Utc>,
}

// PUT /api/v1/materials/materials/{material_id}/purchasing-data
pub struct UpdatePurchasingDataRequest {
    pub purchasing_org: String,
    pub plant: Option<String>,
    pub purchasing_group: Option<String>,
    pub automatic_po: bool,
    pub planned_delivery_time: u16,
    pub regular_vendor: Option<Uuid>,
    pub minimum_order_quantity: Option<Decimal>,
    pub standard_price: Option<Decimal>,
    pub price_unit: Option<Decimal>,
}

// GET /api/v1/materials/materials
pub struct ListMaterialsQuery {
    pub material_type: Option<String>,
    pub material_group: Option<String>,
    pub plant: Option<String>,
    pub search_term: Option<String>,        // Search in description
    pub purchasing_org: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

pub struct ListMaterialsResponse {
    pub materials: Vec<MaterialSummary>,
    pub total_count: u64,
    pub page: u32,
    pub page_size: u32,
}

// GET /api/v1/materials/materials/{material_id}/stock
pub struct GetMaterialStockQuery {
    pub plant: Option<String>,
    pub storage_location: Option<String>,
    pub batch: Option<String>,
    pub stock_type: Option<String>,
    pub valuation_type: Option<String>,
}

pub struct GetMaterialStockResponse {
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,
    pub base_unit: String,
    pub stock_overview: Vec<StockLevel>,
    pub total_stock: Decimal,
}

pub struct StockLevel {
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub stock_type: String,
    pub unrestricted_stock: Decimal,
    pub quality_inspection_stock: Decimal,
    pub blocked_stock: Decimal,
    pub in_transit_stock: Decimal,
    pub reserved_stock: Decimal,
    pub available_stock: Decimal,
}
```

#### 3.2.2 采购申请 API

```rust
// POST /api/v1/materials/purchase-requisitions
pub struct CreatePurchaseRequisitionRequest {
    pub requisition_type: String,
    pub company_code: String,
    pub purchasing_org: String,
    pub purchasing_group: String,
    pub items: Vec<CreatePRItemRequest>,
}

pub struct CreatePRItemRequest {
    pub material_id: Option<Uuid>,
    pub short_text: String,
    pub quantity: Decimal,
    pub unit: String,
    pub delivery_date: NaiveDate,
    pub plant: String,
    pub storage_location: Option<String>,
    pub account_assignment_category: String,
    pub cost_center: Option<String>,
    pub gl_account: Option<String>,
    pub internal_order: Option<String>,
    pub fixed_vendor: Option<Uuid>,
    pub estimated_price: Option<Decimal>,
}

pub struct CreatePurchaseRequisitionResponse {
    pub requisition_id: Uuid,
    pub requisition_number: String,
    pub items: Vec<PRItemSummary>,
    pub approval_required: bool,
    pub approval_workflow_id: Option<Uuid>,
}

// POST /api/v1/materials/purchase-requisitions/{requisition_id}/approve
pub struct ApprovePurchaseRequisitionRequest {
    pub approver_comment: Option<String>,
}

// POST /api/v1/materials/purchase-requisitions/{requisition_id}/reject
pub struct RejectPurchaseRequisitionRequest {
    pub rejection_reason: String,
}

// POST /api/v1/materials/purchase-requisitions/{requisition_id}/assign-source
pub struct AssignSourceRequest {
    pub item_assignments: Vec<ItemSourceAssignment>,
}

pub struct ItemSourceAssignment {
    pub item_number: u16,
    pub vendor_id: Uuid,
    pub quotation_number: Option<String>,
    pub contract_number: Option<String>,
    pub contract_item: Option<u16>,
    pub price: Decimal,
}
```

#### 3.2.3 采购订单 API

```rust
// POST /api/v1/materials/purchase-orders
pub struct CreatePurchaseOrderRequest {
    pub po_type: String,
    pub company_code: String,
    pub purchasing_org: String,
    pub purchasing_group: String,
    pub vendor_id: Uuid,
    pub currency: String,
    pub payment_terms: String,
    pub incoterms: Option<IncotermsRequest>,
    pub items: Vec<CreatePOItemRequest>,
    pub reference_requisitions: Option<Vec<String>>,
}

pub struct CreatePOItemRequest {
    pub material_id: Option<Uuid>,
    pub short_text: String,
    pub order_quantity: Decimal,
    pub unit: String,
    pub delivery_date: NaiveDate,
    pub plant: String,
    pub storage_location: Option<String>,
    pub net_price: Decimal,
    pub price_unit: Option<Decimal>,
    pub tax_code: Option<String>,
    pub account_assignment_category: Option<String>,
    pub gl_account: Option<String>,
    pub cost_center: Option<String>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,
    pub goods_receipt_required: bool,
    pub invoice_receipt_required: bool,
    pub requisition_number: Option<String>,
    pub requisition_item: Option<u16>,
}

pub struct CreatePurchaseOrderResponse {
    pub po_id: Uuid,
    pub po_number: String,
    pub vendor_number: String,
    pub vendor_name: String,
    pub net_order_value: Decimal,
    pub currency: String,
    pub items: Vec<POItemSummary>,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/materials/purchase-orders/{po_id}/release
pub struct ReleasePurchaseOrderRequest {
    pub release_code: Option<String>,
    pub release_note: Option<String>,
}

// GET /api/v1/materials/purchase-orders/{po_id}
pub struct GetPurchaseOrderResponse {
    pub purchase_order: PurchaseOrderDto,
    pub items: Vec<PurchaseOrderItemDto>,
    pub vendor: VendorSummary,
    pub delivery_status: DeliveryStatus,
    pub invoice_status: InvoiceStatus,
    pub history: Vec<POHistoryEntry>,
}

pub struct DeliveryStatus {
    pub overall_status: String,
    pub items_delivery_status: Vec<ItemDeliveryStatus>,
}

pub struct ItemDeliveryStatus {
    pub item_number: u16,
    pub ordered_quantity: Decimal,
    pub delivered_quantity: Decimal,
    pub open_quantity: Decimal,
    pub delivery_completion: Decimal,      // Percentage
}

// GET /api/v1/materials/purchase-orders
pub struct ListPurchaseOrdersQuery {
    pub company_code: Option<String>,
    pub purchasing_org: Option<String>,
    pub purchasing_group: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub material_id: Option<Uuid>,
    pub po_date_from: Option<NaiveDate>,
    pub po_date_to: Option<NaiveDate>,
    pub delivery_date_from: Option<NaiveDate>,
    pub delivery_date_to: Option<NaiveDate>,
    pub status: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
```

#### 3.2.4 收货 API

```rust
// POST /api/v1/materials/goods-receipts
pub struct CreateGoodsReceiptRequest {
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub company_code: String,
    pub header_text: Option<String>,
    pub items: Vec<CreateGRItemRequest>,
}

pub struct CreateGRItemRequest {
    pub movement_type: String,
    pub material_id: Option<Uuid>,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub storage_bin: Option<String>,
    pub batch: Option<String>,
    pub purchase_order_number: Option<String>,
    pub po_item_number: Option<u16>,
    pub delivery_note_number: Option<String>,
    pub stock_type: Option<String>,
    pub cost_center: Option<String>,
    pub gl_account: Option<String>,
    pub reason_for_movement: Option<String>,
}

pub struct CreateGoodsReceiptResponse {
    pub gr_id: Uuid,
    pub material_document_number: String,
    pub material_document_year: u16,
    pub posting_date: NaiveDate,
    pub items: Vec<GRItemResult>,
    pub accounting_document_number: Option<String>,
    pub posted_at: DateTime<Utc>,
}

pub struct GRItemResult {
    pub item_number: u16,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub amount: Decimal,
    pub currency: String,
}

// POST /api/v1/materials/goods-receipts/{gr_id}/reverse
pub struct ReverseGoodsReceiptRequest {
    pub reversal_reason: String,
    pub posting_date: Option<NaiveDate>,
}

// GET /api/v1/materials/goods-receipts
pub struct ListGoodsReceiptsQuery {
    pub company_code: Option<String>,
    pub plant: Option<String>,
    pub material_id: Option<Uuid>,
    pub posting_date_from: Option<NaiveDate>,
    pub posting_date_to: Option<NaiveDate>,
    pub po_number: Option<String>,
    pub vendor_id: Option<Uuid>,
    pub movement_type: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

// POST /api/v1/materials/goods-issues
pub struct CreateGoodsIssueRequest {
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub company_code: String,
    pub items: Vec<CreateGIItemRequest>,
}

pub struct CreateGIItemRequest {
    pub movement_type: String,            // 201, 261, etc.
    pub material_id: Uuid,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub cost_center: Option<String>,
    pub production_order: Option<String>,
    pub sales_order: Option<String>,
    pub sales_order_item: Option<u16>,
    pub reason_for_movement: Option<String>,
}

// POST /api/v1/materials/stock-transfers
pub struct CreateStockTransferRequest {
    pub posting_date: NaiveDate,
    pub document_date: NaiveDate,
    pub company_code: String,
    pub items: Vec<StockTransferItemRequest>,
}

pub struct StockTransferItemRequest {
    pub material_id: Uuid,
    pub quantity: Decimal,
    pub unit: String,
    pub from_plant: String,
    pub from_storage_location: String,
    pub from_batch: Option<String>,
    pub to_plant: String,
    pub to_storage_location: String,
    pub to_batch: Option<String>,
    pub movement_type: String,            // 301, 311, etc.
}
```

### 3.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaterialsDomainEvent {
    MaterialCreated(MaterialCreated),
    MaterialChanged(MaterialChanged),
    PurchaseRequisitionCreated(PurchaseRequisitionCreated),
    PurchaseRequisitionApproved(PurchaseRequisitionApproved),
    PurchaseRequisitionRejected(PurchaseRequisitionRejected),
    PurchaseOrderCreated(PurchaseOrderCreated),
    PurchaseOrderChanged(PurchaseOrderChanged),
    PurchaseOrderReleased(PurchaseOrderReleased),
    GoodsReceiptPosted(GoodsReceiptPosted),
    GoodsReceiptReversed(GoodsReceiptReversed),
    GoodsIssuePosted(GoodsIssuePosted),
    StockTransferred(StockTransferred),
    InventoryCountCompleted(InventoryCountCompleted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrderCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub po_id: Uuid,
    pub po_number: String,
    pub po_type: String,
    pub company_code: String,
    pub purchasing_org: String,
    pub purchasing_group: String,
    pub vendor_id: Uuid,
    pub vendor_number: String,
    pub currency: String,
    pub net_order_value: Decimal,
    pub items: Vec<POItemCreated>,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct POItemCreated {
    pub item_number: u16,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub short_text: String,
    pub order_quantity: Decimal,
    pub unit: String,
    pub delivery_date: NaiveDate,
    pub plant: String,
    pub net_price: Decimal,
    pub net_value: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoodsReceiptPosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub gr_id: Uuid,
    pub material_document_number: String,
    pub material_document_year: u16,
    pub posting_date: NaiveDate,
    pub company_code: String,
    pub vendor_id: Option<Uuid>,
    pub items: Vec<GRItemPosted>,
    pub accounting_document_id: Option<Uuid>,
    pub posted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GRItemPosted {
    pub item_number: u16,
    pub movement_type: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub stock_type: String,
    pub amount: Decimal,
    pub currency: String,
    pub purchase_order_number: Option<String>,
    pub po_item_number: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockTransferred {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub material_document_number: String,
    pub posting_date: NaiveDate,
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub from_plant: String,
    pub from_storage_location: String,
    pub to_plant: String,
    pub to_storage_location: String,
    pub movement_type: String,
}
```

---

本文档将继续添加以下模块的详细规格：
- SD (Sales & Distribution)
- PP (Production Planning)
- WM/EWM (Warehouse Management)
- QM (Quality Management)
- PM (Plant Maintenance)
- 以及其他模块...

由于内容较长，建议分批补充。

## 第四部分：销售与分销模块 (SD - Sales & Distribution)

### 4.1 数据模型

#### 4.1.1 客户主数据 (Customer Master Data)

```rust
pub struct Customer {
    pub customer_id: Uuid,
    pub customer_number: String,          // Format: C-100001
    pub account_group: CustomerAccountGroup,

    // General Data
    pub general_data: CustomerGeneralData,

    // Sales Area Data (per sales organization + distribution channel + division)
    pub sales_area_data: HashMap<SalesArea, SalesAreaData>,

    // Company Code Data (for FI integration)
    pub company_code_data: HashMap<CompanyCode, CustomerCompanyCodeData>,

    // Contact Persons
    pub contacts: Vec<ContactPerson>,

    // Partner Functions
    pub partner_functions: Vec<PartnerFunction>,

    // Status
    pub central_deletion_flag: bool,
    pub central_blocking: bool,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct CustomerGeneralData {
    pub name1: String,
    pub name2: Option<String>,
    pub search_term: String,
    pub addresses: Vec<CustomerAddress>,
    pub primary_address_id: Uuid,
    pub communication: CustomerCommunication,
    pub tax_classifications: Vec<TaxClassification>,
    pub industry_code: Option<IndustryCode>,
    pub nielsen_id: Option<String>,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct SalesArea {
    pub sales_organization: SalesOrganization,
    pub distribution_channel: DistributionChannel,
    pub division: Division,
}

pub struct SalesAreaData {
    pub sales_area: SalesArea,

    // Sales
    pub sales_office: Option<SalesOffice>,
    pub sales_group: Option<SalesGroup>,
    pub customer_group: CustomerGroup,
    pub customer_classification: CustomerClassification,
    pub abc_classification: Option<AbcClassification>,

    // Shipping
    pub shipping_conditions: ShippingConditions,
    pub delivery_priority: DeliveryPriority,
    pub complete_delivery_required: bool,
    pub partial_delivery_per_item: bool,
    pub max_number_of_partial_deliveries: Option<u8>,
    pub delivery_plant: Option<Plant>,

    // Billing
    pub billing_block: Option<BillingBlock>,
    pub pricing_procedure: PricingProcedure,
    pub customer_pricing_group: Option<CustomerPricingGroup>,
    pub incoterms: Option<Incoterms>,
    pub currency: Currency,
    pub payment_terms: PaymentTerms,
    pub account_assignment_group: Option<AccountAssignmentGroup>,

    // Taxes
    pub tax_classification: HashMap<TaxCategory, TaxClassification>,

    // Credit Management
    pub credit_control_area: Option<CreditControlArea>,
    pub credit_limit: Money,
    pub credit_exposure: Money,
    pub risk_category: RiskCategory,

    // Documents
    pub order_combination: bool,
    pub order_probability: Option<Decimal>,      // Percentage

    // Status
    pub sales_block: Option<SalesBlock>,
    pub deletion_flag: bool,
}

pub struct CustomerCompanyCodeData {
    pub company_code: CompanyCode,
    pub reconciliation_account: GlAccount,
    pub payment_terms: PaymentTerms,
    pub payment_methods: Vec<PaymentMethod>,
    pub payment_history_record: bool,
    pub clearing_with_customer: Option<Uuid>,    // Customer for offsetting
    pub tolerance_group: Option<ToleranceGroup>,
}

pub struct ContactPerson {
    pub contact_id: Uuid,
    pub contact_number: String,
    pub first_name: String,
    pub last_name: String,
    pub title: Option<String>,
    pub function: Option<String>,
    pub department: Option<String>,
    pub phone: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub vip: bool,
}

pub struct PartnerFunction {
    pub partner_function: PartnerFunctionType,
    pub partner_number: String,                   // Customer/Vendor/Contact number
    pub default_partner: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PartnerFunctionType {
    SoldTo,        // AG - Sold-to party
    ShipTo,        // WE - Ship-to party
    BillTo,        // RE - Bill-to party
    Payer,         // RG - Payer
    SalesPartner,  // VK - Sales partner
    Forwarding,    // SP - Forwarding agent
}
```

#### 4.1.2 销售订单 (Sales Order)

```rust
pub struct SalesOrder {
    pub order_id: Uuid,
    pub order_number: String,             // Format: SO-2025-000001
    pub order_type: SalesOrderType,
    pub sales_organization: SalesOrganization,
    pub distribution_channel: DistributionChannel,
    pub division: Division,

    // Header Data
    pub document_date: NaiveDate,
    pub pricing_date: NaiveDate,
    pub requested_delivery_date: NaiveDate,
    pub purchase_order_number: Option<String>, // Customer PO number
    pub purchase_order_date: Option<NaiveDate>,
    pub currency: Currency,

    // Partners
    pub sold_to_party: Uuid,
    pub ship_to_party: Uuid,
    pub bill_to_party: Uuid,
    pub payer: Uuid,
    pub partners: Vec<OrderPartner>,

    // Sales Data
    pub sales_office: Option<SalesOffice>,
    pub sales_group: Option<SalesGroup>,
    pub sales_employee: Option<UserId>,

    // Pricing
    pub pricing_procedure: PricingProcedure,
    pub customer_pricing_group: Option<CustomerPricingGroup>,
    pub pricing_date: NaiveDate,

    // Shipping
    pub shipping_conditions: ShippingConditions,
    pub shipping_type: Option<ShippingType>,
    pub delivery_block: Option<DeliveryBlock>,
    pub complete_delivery: bool,
    pub incoterms: Option<Incoterms>,
    pub route: Option<Route>,

    // Payment
    pub payment_terms: PaymentTerms,
    pub payment_method: Option<PaymentMethod>,
    pub payment_card_info: Option<PaymentCardInfo>,

    // Billing
    pub billing_block: Option<BillingBlock>,
    pub billing_type: BillingType,
    pub billing_plan: Option<BillingPlan>,

    // Items
    pub items: Vec<SalesOrderItem>,

    // Totals
    pub net_value: Money,
    pub tax_amount: Money,
    pub gross_value: Money,

    // Status
    pub overall_status: SalesOrderStatus,
    pub delivery_status: DeliveryStatus,
    pub billing_status: BillingStatus,
    pub credit_status: CreditStatus,
    pub rejection_reason: Option<RejectionReason>,

    // References
    pub quotation_number: Option<String>,
    pub contract_number: Option<String>,
    pub project_number: Option<String>,

    // Header Text
    pub header_notes: Vec<TextElement>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct SalesOrderItem {
    pub item_number: u16,
    pub item_category: ItemCategory,
    pub higher_level_item: Option<u16>,   // For BOM structures

    // Material
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub material_description: String,
    pub material_group: Option<MaterialGroup>,
    pub product_hierarchy: Option<ProductHierarchy>,

    // Quantity & UoM
    pub order_quantity: Decimal,
    pub sales_unit: Unit,
    pub target_quantity: Option<Decimal>, // In base unit
    pub base_unit: Unit,

    // Dates
    pub requested_delivery_date: NaiveDate,
    pub confirmed_delivery_date: Option<NaiveDate>,

    // Plant & Shipping Point
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,
    pub shipping_point: Option<ShippingPoint>,

    // Pricing
    pub pricing_conditions: Vec<PricingCondition>,
    pub net_price: Money,
    pub net_value: Money,
    pub tax_amount: Money,
    pub cost: Option<Money>,              // COGS
    pub margin: Option<Money>,

    // Availability
    pub availability_date: Option<NaiveDate>,
    pub confirmed_quantity: Decimal,
    pub atp_check: AtpCheckResult,

    // Batch & Serial Number
    pub batch_required: bool,
    pub batch_number: Option<String>,
    pub serial_numbers: Vec<String>,

    // Schedule Lines
    pub schedule_lines: Vec<ScheduleLine>,

    // Status
    pub item_status: SalesOrderItemStatus,
    pub delivery_status: ItemDeliveryStatus,
    pub delivery_qty: Decimal,
    pub open_delivery_qty: Decimal,
    pub billing_status: ItemBillingStatus,
    pub billed_qty: Decimal,
    pub open_billing_qty: Decimal,
    pub rejection_reason: Option<RejectionReason>,

    // Item Notes
    pub item_notes: Vec<TextElement>,

    // Business Data
    pub cost_center: Option<CostCenter>,
    pub profit_center: Option<ProfitCenter>,
    pub wbs_element: Option<WbsElement>,
}

pub struct ScheduleLine {
    pub schedule_line_number: u16,
    pub confirmed_quantity: Decimal,
    pub confirmed_date: NaiveDate,
    pub delivery_date: NaiveDate,
}

pub struct PricingCondition {
    pub condition_type: ConditionType,
    pub condition_description: String,
    pub calculation_type: CalculationType,
    pub condition_value: Decimal,
    pub condition_unit: Option<Unit>,
    pub condition_amount: Money,
    pub condition_base_value: Decimal,
    pub statistical: bool,                // Non-value affecting (e.g., cost)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConditionType {
    PR00,    // Price
    K004,    // Material pricing group discount
    K005,    // Customer discount
    K007,    // Customer/material pricing group
    MWST,    // VAT/Sales tax
    SKTO,    // Cash discount
    ZB00,    // Rebate
    VPRS,    // Cost (statistical)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SalesOrderType {
    OR,      // Standard order
    RE,      // Returns
    KE,      // Consignment issue
    KA,      // Consignment pickup
    CR,      // Credit memo request
    DR,      // Debit memo request
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SalesOrderStatus {
    Created,
    InProcess,
    BeingDelivered,
    Delivered,
    PartiallyBilled,
    Billed,
    Completed,
    Cancelled,
}

pub struct AtpCheckResult {
    pub check_executed: bool,
    pub available_quantity: Decimal,
    pub shortage_quantity: Decimal,
    pub earliest_available_date: Option<NaiveDate>,
}
```

#### 4.1.3 交货单 (Delivery Document)

```rust
pub struct Delivery {
    pub delivery_id: Uuid,
    pub delivery_number: String,          // Format: DL-2025-000001
    pub delivery_type: DeliveryType,
    pub shipping_point: ShippingPoint,
    pub delivery_date: NaiveDate,
    pub planned_goods_movement_date: NaiveDate,
    pub actual_goods_movement_date: Option<NaiveDate>,

    // Ship-to Party
    pub ship_to_party: Uuid,
    pub ship_to_address: Address,

    // Shipping
    pub shipping_conditions: ShippingConditions,
    pub shipping_type: Option<ShippingType>,
    pub route: Option<Route>,
    pub means_of_transport: Option<MeansOfTransport>,
    pub forwarding_agent: Option<Uuid>,
    pub incoterms: Option<Incoterms>,

    // Weight & Volume
    pub total_weight: Decimal,
    pub weight_unit: Unit,
    pub total_volume: Decimal,
    pub volume_unit: Unit,
    pub number_of_packages: u32,

    // Items
    pub items: Vec<DeliveryItem>,

    // Picking
    pub picking_status: PickingStatus,
    pub picked_at: Option<DateTime<Utc>>,
    pub picked_by: Option<UserId>,

    // Packing
    pub packing_status: PackingStatus,
    pub handling_units: Vec<HandlingUnit>,

    // Goods Issue
    pub goods_issue_status: GoodsIssueStatus,
    pub goods_issue_date: Option<NaiveDate>,
    pub material_document_number: Option<String>,

    // Shipment
    pub shipment_number: Option<String>,
    pub tracking_number: Option<String>,
    pub carrier: Option<String>,

    // Status
    pub overall_status: DeliveryStatus,
    pub billing_status: BillingStatus,
    pub billing_block: Option<BillingBlock>,

    // References
    pub sales_orders: Vec<String>,
    pub purchase_order_number: Option<String>,

    // Documents
    pub delivery_notes: Vec<TextElement>,
    pub packing_list: Option<String>,
    pub bill_of_lading: Option<String>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub goods_issue_posted_by: Option<UserId>,
}

pub struct DeliveryItem {
    pub item_number: u16,
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,

    // Quantity
    pub delivery_quantity: Decimal,
    pub sales_unit: Unit,
    pub base_unit: Unit,
    pub picked_quantity: Decimal,
    pub confirmed_quantity: Decimal,

    // Storage
    pub plant: Plant,
    pub storage_location: StorageLocation,
    pub batch: Option<String>,
    pub serial_numbers: Vec<String>,

    // Reference
    pub sales_order_number: String,
    pub sales_order_item: u16,
    pub sales_order_schedule_line: Option<u16>,

    // Picking
    pub picking_status: ItemPickingStatus,
    pub pick_quantity: Decimal,
    pub stock_removal_location: Option<StorageBin>,

    // Status
    pub goods_issue_status: ItemGoodsIssueStatus,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DeliveryType {
    LF,      // Outbound delivery
    LR,      // Returns delivery
    NL,      // Replenishment delivery
}

pub struct HandlingUnit {
    pub handling_unit_id: Uuid,
    pub handling_unit_number: String,
    pub packaging_material: String,
    pub packaging_material_description: String,
    pub gross_weight: Decimal,
    pub net_weight: Decimal,
    pub weight_unit: Unit,
    pub volume: Decimal,
    pub volume_unit: Unit,
    pub contents: Vec<HandlingUnitContent>,
}

pub struct HandlingUnitContent {
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: Unit,
    pub batch: Option<String>,
}
```

#### 4.1.4 开票单据 (Billing Document)

```rust
pub struct BillingDocument {
    pub billing_id: Uuid,
    pub billing_number: String,           // Format: INV-2025-000001
    pub billing_type: BillingType,
    pub billing_category: BillingCategory,
    pub billing_date: NaiveDate,
    pub accounting_date: NaiveDate,

    // Partners
    pub sold_to_party: Uuid,
    pub bill_to_party: Uuid,
    pub payer: Uuid,

    // Sales Organization
    pub sales_organization: SalesOrganization,
    pub distribution_channel: DistributionChannel,
    pub division: Division,

    // Payment
    pub payment_terms: PaymentTerms,
    pub payment_method: Option<PaymentMethod>,
    pub due_date: NaiveDate,
    pub cash_discount_date1: Option<NaiveDate>,
    pub cash_discount_percent1: Option<Decimal>,

    // Currency
    pub document_currency: Currency,
    pub local_currency: Currency,
    pub exchange_rate: Option<ExchangeRate>,

    // Items
    pub items: Vec<BillingItem>,

    // Pricing Summary
    pub net_value: Money,
    pub tax_amount: Money,
    pub gross_value: Money,
    pub cash_discount_base: Money,

    // Accounting
    pub accounting_document_id: Option<Uuid>,
    pub accounting_document_number: Option<String>,
    pub revenue_recognized: bool,
    pub revenue_recognition_date: Option<NaiveDate>,

    // Status
    pub billing_status: BillingDocumentStatus,
    pub cancellation_document: Option<String>,
    pub cancelled: bool,
    pub payment_status: PaymentStatus,

    // References
    pub reference_documents: Vec<ReferenceDocument>,
    pub customer_po_number: Option<String>,
    pub external_invoice_number: Option<String>,

    // Tax
    pub tax_jurisdiction_code: Option<String>,
    pub tax_summary: Vec<TaxSummary>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct BillingItem {
    pub item_number: u16,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub material_description: String,
    pub material_group: Option<MaterialGroup>,

    // Quantity
    pub billing_quantity: Decimal,
    pub sales_unit: Unit,

    // Pricing
    pub pricing_conditions: Vec<PricingCondition>,
    pub net_price: Money,
    pub net_value: Money,
    pub tax_code: TaxCode,
    pub tax_amount: Money,
    pub cost: Option<Money>,
    pub margin: Option<Money>,

    // Revenue Recognition
    pub revenue_element: RevenueElement,
    pub revenue_account: String,

    // Account Assignment
    pub cost_center: Option<CostCenter>,
    pub profit_center: Option<ProfitCenter>,
    pub wbs_element: Option<WbsElement>,

    // Reference
    pub sales_order_number: Option<String>,
    pub sales_order_item: Option<u16>,
    pub delivery_number: Option<String>,
    pub delivery_item: Option<u16>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BillingType {
    F2,      // Invoice
    G2,      // Credit memo
    L2,      // Debit memo
    IV,      // Pro forma invoice
    RE,      // Invoice cancellation
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BillingCategory {
    Invoice,
    CreditMemo,
    DebitMemo,
    ProForma,
    Cancellation,
}

pub struct ReferenceDocument {
    pub document_type: String,
    pub document_number: String,
    pub document_item: Option<u16>,
}

pub struct TaxSummary {
    pub tax_code: String,
    pub tax_type: String,
    pub tax_rate: Decimal,
    pub tax_base_amount: Money,
    pub tax_amount: Money,
    pub tax_jurisdiction: Option<String>,
}
```

### 4.2 API 规格

#### 4.2.1 销售订单 API

```rust
// POST /api/v1/sales/orders
pub struct CreateSalesOrderRequest {
    pub order_type: String,
    pub sales_organization: String,
    pub distribution_channel: String,
    pub division: String,
    pub sold_to_party: Uuid,
    pub ship_to_party: Option<Uuid>,
    pub bill_to_party: Option<Uuid>,
    pub payer: Option<Uuid>,
    pub purchase_order_number: Option<String>,
    pub requested_delivery_date: NaiveDate,
    pub items: Vec<CreateSalesOrderItemRequest>,
}

pub struct CreateSalesOrderItemRequest {
    pub material_id: Option<Uuid>,
    pub material_description: Option<String>,
    pub order_quantity: Decimal,
    pub sales_unit: String,
    pub requested_delivery_date: Option<NaiveDate>,
    pub plant: Option<String>,
    pub pricing_date: Option<NaiveDate>,
    pub batch: Option<String>,
    pub manual_price_override: Option<Decimal>,
}

pub struct CreateSalesOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub order_type: String,
    pub sold_to_party: String,
    pub net_value: Decimal,
    pub currency: String,
    pub items: Vec<SalesOrderItemSummary>,
    pub incomplete_data_log: Vec<String>,
    pub credit_check_result: CreditCheckResult,
    pub created_at: DateTime<Utc>,
}

pub struct SalesOrderItemSummary {
    pub item_number: u16,
    pub material_number: Option<String>,
    pub material_description: String,
    pub order_quantity: Decimal,
    pub confirmed_quantity: Decimal,
    pub net_price: Decimal,
    pub net_value: Decimal,
    pub requested_delivery_date: NaiveDate,
    pub confirmed_delivery_date: Option<NaiveDate>,
}

pub struct CreditCheckResult {
    pub credit_check_performed: bool,
    pub credit_status: String,
    pub credit_limit: Option<Decimal>,
    pub credit_exposure: Option<Decimal>,
    pub available_credit: Option<Decimal>,
    pub delivery_block: Option<String>,
}

// PUT /api/v1/sales/orders/{order_id}
pub struct UpdateSalesOrderRequest {
    pub requested_delivery_date: Option<NaiveDate>,
    pub purchase_order_number: Option<String>,
    pub items: Vec<UpdateSalesOrderItemRequest>,
}

pub struct UpdateSalesOrderItemRequest {
    pub item_number: u16,
    pub action: ItemUpdateAction,
    pub order_quantity: Option<Decimal>,
    pub requested_delivery_date: Option<NaiveDate>,
    pub reason_for_rejection: Option<String>,
}

#[derive(Debug, Deserialize)]
pub enum ItemUpdateAction {
    Update,
    Delete,
    Add,
}

// POST /api/v1/sales/orders/{order_id}/availability-check
pub struct AvailabilityCheckRequest {
    pub check_rule: String,
    pub items: Option<Vec<u16>>,          // Specific items, or all if None
}

pub struct AvailabilityCheckResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub check_timestamp: DateTime<Utc>,
    pub items: Vec<ItemAvailabilityResult>,
}

pub struct ItemAvailabilityResult {
    pub item_number: u16,
    pub material_number: String,
    pub requested_quantity: Decimal,
    pub available_quantity: Decimal,
    pub shortage_quantity: Decimal,
    pub confirmed_quantity: Decimal,
    pub confirmed_date: Option<NaiveDate>,
    pub alternative_materials: Vec<AlternativeMaterial>,
}

pub struct AlternativeMaterial {
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,
    pub available_quantity: Decimal,
    pub available_date: NaiveDate,
}

// GET /api/v1/sales/orders/{order_id}
pub struct GetSalesOrderResponse {
    pub order: SalesOrderDto,
    pub items: Vec<SalesOrderItemDto>,
    pub partners: Vec<OrderPartnerDto>,
    pub pricing_summary: PricingSummary,
    pub delivery_status: OrderDeliveryStatus,
    pub billing_status: OrderBillingStatus,
    pub documents: Vec<RelatedDocumentDto>,
    pub incompletion_log: Vec<IncompletionItem>,
}

pub struct OrderDeliveryStatus {
    pub overall_status: String,
    pub items: Vec<ItemDeliveryStatusDto>,
}

pub struct ItemDeliveryStatusDto {
    pub item_number: u16,
    pub order_quantity: Decimal,
    pub delivered_quantity: Decimal,
    pub open_quantity: Decimal,
    pub delivery_completion_percentage: Decimal,
}

// GET /api/v1/sales/orders
pub struct ListSalesOrdersQuery {
    pub sales_organization: Option<String>,
    pub distribution_channel: Option<String>,
    pub sold_to_party: Option<Uuid>,
    pub material_id: Option<Uuid>,
    pub order_date_from: Option<NaiveDate>,
    pub order_date_to: Option<NaiveDate>,
    pub delivery_date_from: Option<NaiveDate>,
    pub delivery_date_to: Option<NaiveDate>,
    pub order_status: Option<String>,
    pub created_by: Option<String>,
    pub customer_po_number: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
```

#### 4.2.2 交货 API

```rust
// POST /api/v1/sales/deliveries
pub struct CreateDeliveryRequest {
    pub delivery_type: String,
    pub shipping_point: String,
    pub delivery_date: NaiveDate,
    pub planned_goods_movement_date: NaiveDate,
    pub ship_to_party: Uuid,
    pub sales_orders: Vec<DeliverySourceOrder>,
    pub complete_delivery: bool,
}

pub struct DeliverySourceOrder {
    pub sales_order_id: Uuid,
    pub items: Vec<DeliverySourceItem>,
}

pub struct DeliverySourceItem {
    pub sales_order_item: u16,
    pub delivery_quantity: Decimal,
}

pub struct CreateDeliveryResponse {
    pub delivery_id: Uuid,
    pub delivery_number: String,
    pub shipping_point: String,
    pub delivery_date: NaiveDate,
    pub ship_to_party: String,
    pub items: Vec<DeliveryItemSummary>,
    pub total_weight: Decimal,
    pub total_volume: Decimal,
    pub created_at: DateTime<Utc>,
}

pub struct DeliveryItemSummary {
    pub item_number: u16,
    pub material_number: String,
    pub delivery_quantity: Decimal,
    pub sales_order_reference: String,
}

// POST /api/v1/sales/deliveries/{delivery_id}/pick
pub struct PickDeliveryRequest {
    pub items: Vec<PickItemRequest>,
}

pub struct PickItemRequest {
    pub item_number: u16,
    pub picked_quantity: Decimal,
    pub storage_location: String,
    pub batch: Option<String>,
    pub storage_bin: Option<String>,
    pub serial_numbers: Option<Vec<String>>,
}

pub struct PickDeliveryResponse {
    pub delivery_id: Uuid,
    pub delivery_number: String,
    pub picking_status: String,
    pub picked_at: DateTime<Utc>,
    pub picked_by: String,
    pub items: Vec<PickedItemResult>,
}

// POST /api/v1/sales/deliveries/{delivery_id}/pack
pub struct PackDeliveryRequest {
    pub handling_units: Vec<CreateHandlingUnitRequest>,
}

pub struct CreateHandlingUnitRequest {
    pub packaging_material: String,
    pub contents: Vec<HandlingUnitContentRequest>,
}

pub struct HandlingUnitContentRequest {
    pub delivery_item: u16,
    pub quantity: Decimal,
}

pub struct PackDeliveryResponse {
    pub delivery_id: Uuid,
    pub packing_status: String,
    pub handling_units: Vec<HandlingUnitDto>,
}

// POST /api/v1/sales/deliveries/{delivery_id}/post-goods-issue
pub struct PostGoodsIssueRequest {
    pub goods_issue_date: NaiveDate,
    pub actual_goods_movement_date: Option<NaiveDate>,
}

pub struct PostGoodsIssueResponse {
    pub delivery_id: Uuid,
    pub delivery_number: String,
    pub goods_issue_date: NaiveDate,
    pub material_document_number: String,
    pub goods_issue_status: String,
    pub posted_at: DateTime<Utc>,
}

// GET /api/v1/sales/deliveries/{delivery_id}
pub struct GetDeliveryResponse {
    pub delivery: DeliveryDto,
    pub items: Vec<DeliveryItemDto>,
    pub handling_units: Vec<HandlingUnitDto>,
    pub shipment: Option<ShipmentDto>,
    pub related_sales_orders: Vec<String>,
}
```

#### 4.2.3 开票 API

```rust
// POST /api/v1/sales/billing-documents
pub struct CreateBillingDocumentRequest {
    pub billing_type: String,
    pub billing_date: NaiveDate,
    pub source_documents: Vec<BillingSource>,
    pub billing_block: Option<String>,
}

pub struct BillingSource {
    pub source_type: String,              // SalesOrder, Delivery
    pub source_id: Uuid,
    pub items: Option<Vec<u16>>,          // Specific items to bill
}

pub struct CreateBillingDocumentResponse {
    pub billing_id: Uuid,
    pub billing_number: String,
    pub billing_type: String,
    pub billing_date: NaiveDate,
    pub bill_to_party: String,
    pub net_value: Decimal,
    pub tax_amount: Decimal,
    pub gross_value: Decimal,
    pub currency: String,
    pub items: Vec<BillingItemSummary>,
    pub accounting_document_number: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub struct BillingItemSummary {
    pub item_number: u16,
    pub material_number: Option<String>,
    pub billing_quantity: Decimal,
    pub net_value: Decimal,
    pub tax_amount: Decimal,
}

// POST /api/v1/sales/billing-documents/{billing_id}/cancel
pub struct CancelBillingDocumentRequest {
    pub cancellation_reason: String,
    pub cancellation_date: Option<NaiveDate>,
}

pub struct CancelBillingDocumentResponse {
    pub original_billing_id: Uuid,
    pub cancellation_document_id: Uuid,
    pub cancellation_document_number: String,
    pub cancelled_at: DateTime<Utc>,
}

// GET /api/v1/sales/billing-documents
pub struct ListBillingDocumentsQuery {
    pub sales_organization: Option<String>,
    pub billing_type: Option<String>,
    pub bill_to_party: Option<Uuid>,
    pub billing_date_from: Option<NaiveDate>,
    pub billing_date_to: Option<NaiveDate>,
    pub payment_status: Option<String>,
    pub sales_order_number: Option<String>,
    pub delivery_number: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

// POST /api/v1/sales/billing-run
pub struct CreateBillingRunRequest {
    pub billing_date: NaiveDate,
    pub sales_organizations: Vec<String>,
    pub distribution_channels: Option<Vec<String>>,
    pub billing_types: Vec<String>,
    pub due_list_variant: Option<String>,
    pub selection_criteria: BillingSelectionCriteria,
    pub test_run: bool,
}

pub struct BillingSelectionCriteria {
    pub sold_to_parties: Option<Vec<Uuid>>,
    pub delivery_date_from: Option<NaiveDate>,
    pub delivery_date_to: Option<NaiveDate>,
    pub billing_block: Option<String>,     // Only process specific billing blocks
}

pub struct CreateBillingRunResponse {
    pub billing_run_id: Uuid,
    pub billing_date: NaiveDate,
    pub test_run: bool,
    pub created_documents: Vec<BillingDocumentSummary>,
    pub errors: Vec<BillingError>,
    pub statistics: BillingRunStatistics,
    pub executed_at: DateTime<Utc>,
}

pub struct BillingRunStatistics {
    pub total_documents_processed: u64,
    pub successful_billings: u64,
    pub failed_billings: u64,
    pub total_billed_value: Decimal,
    pub currency: String,
}
```

### 4.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SalesDomainEvent {
    SalesOrderCreated(SalesOrderCreated),
    SalesOrderChanged(SalesOrderChanged),
    SalesOrderCancelled(SalesOrderCancelled),
    AvailabilityConfirmed(AvailabilityConfirmed),
    CreditCheckPerformed(CreditCheckPerformed),
    DeliveryCreated(DeliveryCreated),
    DeliveryPicked(DeliveryPicked),
    DeliveryPacked(DeliveryPacked),
    GoodsIssuePosted(GoodsIssuePosted),
    BillingDocumentCreated(BillingDocumentCreated),
    BillingDocumentCancelled(BillingDocumentCancelled),
    CustomerInvoicePosted(CustomerInvoicePosted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesOrderCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub order_id: Uuid,
    pub order_number: String,
    pub order_type: String,
    pub sales_organization: String,
    pub distribution_channel: String,
    pub division: String,
    pub sold_to_party: Uuid,
    pub ship_to_party: Uuid,
    pub bill_to_party: Uuid,
    pub payer: Uuid,
    pub requested_delivery_date: NaiveDate,
    pub currency: String,
    pub net_value: Decimal,
    pub items: Vec<SalesOrderItemCreated>,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesOrderItemCreated {
    pub item_number: u16,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub order_quantity: Decimal,
    pub sales_unit: String,
    pub confirmed_quantity: Decimal,
    pub requested_delivery_date: NaiveDate,
    pub confirmed_delivery_date: Option<NaiveDate>,
    pub plant: String,
    pub net_price: Decimal,
    pub net_value: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoodsIssuePosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub delivery_id: Uuid,
    pub delivery_number: String,
    pub material_document_number: String,
    pub goods_issue_date: NaiveDate,
    pub ship_to_party: Uuid,
    pub items: Vec<GoodsIssueItem>,
    pub posted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoodsIssueItem {
    pub item_number: u16,
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub sales_order_number: String,
    pub sales_order_item: u16,
    pub value: Decimal,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerInvoicePosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub billing_id: Uuid,
    pub billing_number: String,
    pub billing_type: String,
    pub billing_date: NaiveDate,
    pub bill_to_party: Uuid,
    pub payer: Uuid,
    pub net_value: Decimal,
    pub tax_amount: Decimal,
    pub gross_value: Decimal,
    pub currency: String,
    pub payment_terms: String,
    pub due_date: NaiveDate,
    pub accounting_document_id: Uuid,
    pub accounting_document_number: String,
    pub items: Vec<BillingItemPosted>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingItemPosted {
    pub item_number: u16,
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub billing_quantity: Decimal,
    pub net_value: Decimal,
    pub tax_amount: Decimal,
    pub revenue_account: String,
    pub cost_of_sales_amount: Option<Decimal>,
    pub profit_center: Option<String>,
}
```

---

## 第五部分：生产计划模块 (PP - Production Planning)

### 5.1 数据模型

#### 5.1.1 物料清单 (Bill of Materials - BOM)

```rust
pub struct Bom {
    pub bom_id: Uuid,
    pub bom_number: String,
    pub material_id: Uuid,                // Header material
    pub material_number: String,
    pub plant: Plant,
    pub bom_usage: BomUsage,
    pub bom_status: BomStatus,
    pub alternative_bom: String,          // 01, 02, 03...

    // Valid From/To
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Quantities
    pub base_quantity: Decimal,
    pub base_unit: Unit,

    // Header Data
    pub bom_text: Option<String>,
    pub lot_size_from: Option<Decimal>,
    pub lot_size_to: Option<Decimal>,

    // Items
    pub items: Vec<BomItem>,

    // Change Management
    pub engineering_change_number: Option<String>,
    pub revision_level: String,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct BomItem {
    pub item_number: String,              // 0010, 0020, 0030...
    pub item_category: BomItemCategory,
    pub component_material_id: Uuid,
    pub component_material_number: String,
    pub component_description: String,

    // Quantity
    pub component_quantity: Decimal,
    pub component_unit: Unit,
    pub component_scrap: Decimal,         // Percentage
    pub net_quantity: Decimal,            // Quantity + scrap

    // Item Control
    pub item_type: ItemType,              // Stock item, non-stock item, variable size
    pub procurement_type: ProcurementType,
    pub special_procurement_type: Option<SpecialProcurementType>,

    // Assembly Data
    pub assembly: Option<String>,         // Sub-assembly identifier
    pub installation_point: Option<String>,

    // MRP Data
    pub mrp_indicator: Option<MrpIndicator>,
    pub bulk_material: bool,

    // Costing
    pub costing_relevancy: CostingRelevancy,
    pub cost_element: Option<String>,

    // Operations
    pub operation_number: Option<String>, // Link to routing operation
    pub operation_lead_time_offset: Option<i32>, // Days offset

    // Classification
    pub item_text: Option<String>,
    pub purchasing_group: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BomUsage {
    Production,      // 1 - Production
    Engineering,     // 2 - Engineering/design
    Universal,       // 3 - Universal
    Maintenance,     // 4 - Maintenance
    Sales,          // 5 - Sales and distribution
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BomItemCategory {
    StockItem,       // L - Stock item
    NonStockItem,    // N - Non-stock item
    VariableSize,    // V - Variable-size item
    Document,        // D - Document item
    TextItem,        // T - Text item
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SpecialProcurementType {
    Phantom,         // 50 - Phantom assembly
    DirectProcurement, // 30 - Direct procurement from external vendor
    WithdrawalFromSubcontractor, // 40 - Subcontracting
}
```

#### 5.1.2 工艺路线 (Routing)

```rust
pub struct Routing {
    pub routing_id: Uuid,
    pub routing_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub plant: Plant,
    pub routing_usage: RoutingUsage,
    pub routing_status: RoutingStatus,
    pub alternative_routing: String,      // 01, 02, 03...

    // Valid From/To
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Lot Size
    pub lot_size_from: Decimal,
    pub lot_size_to: Decimal,

    // Operations
    pub operations: Vec<RoutingOperation>,

    // Sequences (Alternative operation sequences)
    pub sequences: Vec<RoutingSequence>,

    // Change Management
    pub engineering_change_number: Option<String>,
    pub revision_level: String,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

pub struct RoutingOperation {
    pub operation_id: Uuid,
    pub operation_number: String,         // 0010, 0020, 0030...
    pub control_key: ControlKey,
    pub work_center_id: Uuid,
    pub work_center: String,
    pub operation_description: String,

    // Standard Values
    pub base_quantity: Decimal,
    pub setup_time: Duration,
    pub machine_time: Duration,
    pub labor_time: Duration,
    pub setup_time_unit: TimeUnit,
    pub machine_time_unit: TimeUnit,
    pub labor_time_unit: TimeUnit,

    // Formulas (for calculating actual times)
    pub setup_formula: Option<String>,
    pub machine_formula: Option<String>,
    pub labor_formula: Option<String>,

    // Number of Capacities
    pub number_of_splits: u16,            // Parallel processing
    pub number_of_time_tickets: u16,

    // Lead Time
    pub lead_time_offset: i32,            // Days

    // Inspection
    pub inspection_required: bool,
    pub inspection_characteristics: Vec<String>,

    // Costing
    pub activity_type: Option<String>,
    pub costing_relevancy: CostingRelevancy,

    // Operation Text
    pub operation_text: Option<String>,
    pub operation_notes: Vec<TextElement>,

    // Components (BOM items consumed in this operation)
    pub components: Vec<OperationComponent>,
}

pub struct OperationComponent {
    pub bom_item_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: Unit,
    pub backflush: bool,                  // Auto goods issue on confirmation
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ControlKey {
    PP01,    // Internal processing with external processing
    PP02,    // Internal processing
    PP03,    // External processing (subcontracting)
    PP04,    // Inspection
}

pub struct RoutingSequence {
    pub sequence_number: String,
    pub sequence_description: String,
    pub operations: Vec<String>,          // Operation numbers in sequence
    pub standard: bool,                    // Is this the standard sequence?
}
```

#### 5.1.3 生产订单 (Production Order)

```rust
pub struct ProductionOrder {
    pub order_id: Uuid,
    pub order_number: String,             // Format: PRO-2025-000001
    pub order_type: ProductionOrderType,
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,
    pub plant: Plant,

    // Quantities
    pub target_quantity: Decimal,
    pub confirmed_yield: Decimal,
    pub scrap_quantity: Decimal,
    pub unit_of_measure: Unit,

    // Dates
    pub order_start_date: NaiveDate,
    pub order_finish_date: NaiveDate,
    pub scheduled_start_date: NaiveDate,
    pub scheduled_finish_date: NaiveDate,
    pub actual_start_date: Option<NaiveDate>,
    pub actual_finish_date: Option<NaiveDate>,

    // Production Version
    pub production_version: Option<String>,
    pub bom_id: Uuid,
    pub routing_id: Uuid,

    // Scheduling
    pub scheduling_type: SchedulingType,
    pub lead_time: Duration,
    pub float_before_production: Duration,
    pub float_after_production: Duration,

    // Storage Location
    pub production_storage_location: Option<StorageLocation>,
    pub goods_recipient: Option<String>,

    // Account Assignment
    pub cost_center: Option<CostCenter>,
    pub profit_center: Option<ProfitCenter>,
    pub wbs_element: Option<WbsElement>,
    pub sales_order: Option<String>,
    pub sales_order_item: Option<u16>,

    // Settlement
    pub settlement_rule: Option<SettlementRule>,
    pub settlement_receiver: Option<SettlementReceiver>,

    // Operations
    pub operations: Vec<ProductionOrderOperation>,

    // Components
    pub components: Vec<ProductionOrderComponent>,

    // Status
    pub system_status: ProductionOrderStatus,
    pub user_status: Option<UserStatus>,
    pub deletion_flag: bool,

    // Costs
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub variance: Decimal,
    pub cost_estimate_id: Option<Uuid>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub released_at: Option<DateTime<Utc>>,
    pub released_by: Option<UserId>,
}

pub struct ProductionOrderOperation {
    pub operation_id: Uuid,
    pub operation_number: String,
    pub control_key: ControlKey,
    pub work_center_id: Uuid,
    pub work_center: String,
    pub operation_description: String,

    // Planned Times
    pub planned_setup_time: Duration,
    pub planned_machine_time: Duration,
    pub planned_labor_time: Duration,
    pub planned_start_date: NaiveDateTime,
    pub planned_finish_date: NaiveDateTime,

    // Actual Times
    pub actual_setup_time: Duration,
    pub actual_machine_time: Duration,
    pub actual_labor_time: Duration,
    pub actual_start_date: Option<NaiveDateTime>,
    pub actual_finish_date: Option<NaiveDateTime>,

    // Confirmation
    pub confirmations: Vec<OperationConfirmation>,
    pub confirmed_yield: Decimal,
    pub confirmed_scrap: Decimal,

    // Capacity
    pub capacity_requirements: Vec<CapacityRequirement>,

    // Status
    pub operation_status: OperationStatus,
}

pub struct OperationConfirmation {
    pub confirmation_id: Uuid,
    pub confirmation_number: String,
    pub confirmation_date: NaiveDate,
    pub confirmation_time: NaiveTime,
    pub confirmer: UserId,
    pub yield_quantity: Decimal,
    pub scrap_quantity: Decimal,
    pub scrap_reason: Option<ScrapReason>,
    pub actual_setup_time: Duration,
    pub actual_machine_time: Duration,
    pub actual_labor_time: Duration,
    pub final_confirmation: bool,
}

pub struct ProductionOrderComponent {
    pub component_id: Uuid,
    pub item_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,

    // Requirement
    pub required_quantity: Decimal,
    pub withdrawn_quantity: Decimal,
    pub open_quantity: Decimal,
    pub unit: Unit,

    // Location
    pub plant: Plant,
    pub storage_location: StorageLocation,
    pub batch: Option<String>,

    // BOM Reference
    pub bom_item_number: Option<String>,

    // Operation Assignment
    pub operation_number: Option<String>,

    // Backflush
    pub backflush_indicator: bool,

    // Reservation
    pub reservation_number: Option<String>,

    // Status
    pub goods_issue_status: GoodsIssueStatus,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProductionOrderType {
    PP01,    // Standard production order
    PP02,    // Process order
    PP03,    // Rework order
    PP04,    // Refurbishment order
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProductionOrderStatus {
    Created,         // CRTD
    Released,        // REL
    PartiallyReleased, // PREL
    PartiallyConfirmed, // PCNF
    Confirmed,       // CNF
    PartiallyDelivered, // PDLV
    Delivered,       // DLV
    TechnicallyCompleted, // TECO
    Closed,          // CLSD
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SchedulingType {
    Forward,         // Schedule from start date
    Backward,        // Schedule from finish date
    OnlyCapacity,    // Only capacity requirements
    MidpointScheduling, // Schedule around midpoint
}
```

#### 5.1.4 工作中心 (Work Center)

```rust
pub struct WorkCenter {
    pub work_center_id: Uuid,
    pub work_center_code: String,
    pub work_center_category: WorkCenterCategory,
    pub plant: Plant,

    // Description
    pub description: String,
    pub long_text: Option<String>,

    // Person Responsible
    pub responsible_person: UserId,
    pub cost_center: CostCenter,

    // Capacity
    pub capacity_category: CapacityCategory,
    pub available_capacity: Decimal,
    pub capacity_unit: Unit,
    pub number_of_individual_capacities: u16,
    pub operating_time: OperatingTime,

    // Standard Values
    pub standard_value_key: Option<StandardValueKey>,
    pub activity_types: Vec<ActivityType>,

    // Formulas
    pub setup_formula_key: Option<String>,
    pub machine_formula_key: Option<String>,
    pub labor_formula_key: Option<String>,

    // Control
    pub usage: WorkCenterUsage,
    pub task_list_usage: TaskListUsage,

    // Location
    pub location: Option<String>,
    pub room: Option<String>,

    // Status
    pub work_center_status: WorkCenterStatus,

    // Validity
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WorkCenterCategory {
    Machine,         // 0001 - Machine
    ProductionLine,  // 0002 - Production line
    WorkStation,     // 0003 - Workstation
    LaborGroup,      // 0004 - Labor group
    Mixed,          // 0005 - Mixed work center
}

pub struct OperatingTime {
    pub factory_calendar: String,
    pub capacity_utilization: Decimal,    // Percentage
    pub shifts: Vec<Shift>,
}

pub struct Shift {
    pub shift_number: u8,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub break_duration: Duration,
}

pub struct CapacityRequirement {
    pub requirement_id: Uuid,
    pub work_center_id: Uuid,
    pub start_date: NaiveDateTime,
    pub end_date: NaiveDateTime,
    pub required_capacity: Decimal,
    pub capacity_unit: Unit,
    pub production_order: Option<String>,
    pub operation_number: Option<String>,
}
```

### 5.2 API 规格

#### 5.2.1 生产订单 API

```rust
// POST /api/v1/production/orders
pub struct CreateProductionOrderRequest {
    pub order_type: String,
    pub material_id: Uuid,
    pub plant: String,
    pub target_quantity: Decimal,
    pub unit_of_measure: String,
    pub order_start_date: NaiveDate,
    pub order_finish_date: NaiveDate,
    pub production_version: Option<String>,
    pub sales_order: Option<String>,
    pub sales_order_item: Option<u16>,
    pub wbs_element: Option<String>,
    pub scheduling_type: String,
}

pub struct CreateProductionOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub material_number: String,
    pub target_quantity: Decimal,
    pub scheduled_start_date: NaiveDate,
    pub scheduled_finish_date: NaiveDate,
    pub operations: Vec<OperationSummary>,
    pub components: Vec<ComponentRequirement>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

pub struct OperationSummary {
    pub operation_number: String,
    pub work_center: String,
    pub description: String,
    pub planned_start_date: NaiveDateTime,
    pub planned_finish_date: NaiveDateTime,
    pub setup_time: String,
    pub machine_time: String,
}

pub struct ComponentRequirement {
    pub item_number: String,
    pub material_number: String,
    pub required_quantity: Decimal,
    pub unit: String,
    pub storage_location: String,
    pub backflush: bool,
}

// POST /api/v1/production/orders/{order_id}/release
pub struct ReleaseProductionOrderRequest {
    pub release_type: String,             // Full, Operations, Components
    pub operations: Option<Vec<String>>,  // Specific operations to release
}

pub struct ReleaseProductionOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub status: String,
    pub released_operations: Vec<String>,
    pub reservation_number: Option<String>,
    pub released_at: DateTime<Utc>,
}

// POST /api/v1/production/orders/{order_id}/operations/{operation_id}/confirm
pub struct ConfirmOperationRequest {
    pub confirmation_date: NaiveDate,
    pub confirmation_time: NaiveTime,
    pub yield_quantity: Decimal,
    pub scrap_quantity: Option<Decimal>,
    pub scrap_reason: Option<String>,
    pub actual_setup_time: Option<String>,  // Duration string
    pub actual_machine_time: Option<String>,
    pub actual_labor_time: Option<String>,
    pub final_confirmation: bool,
    pub backflush_components: bool,
}

pub struct ConfirmOperationResponse {
    pub confirmation_id: Uuid,
    pub confirmation_number: String,
    pub order_number: String,
    pub operation_number: String,
    pub yield_quantity: Decimal,
    pub goods_movements: Vec<GoodsMovementSummary>,
    pub confirmed_at: DateTime<Utc>,
}

pub struct GoodsMovementSummary {
    pub movement_type: String,
    pub material_number: String,
    pub quantity: Decimal,
    pub material_document_number: String,
}

// POST /api/v1/production/orders/{order_id}/goods-receipt
pub struct ProductionGoodsReceiptRequest {
    pub posting_date: NaiveDate,
    pub quantity: Decimal,
    pub storage_location: String,
    pub movement_type: String,            // 101 - GR to warehouse, 131 - GR to stock in quality inspection
}

pub struct ProductionGoodsReceiptResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub material_document_number: String,
    pub quantity: Decimal,
    pub posted_at: DateTime<Utc>,
}

// GET /api/v1/production/orders/{order_id}
pub struct GetProductionOrderResponse {
    pub order: ProductionOrderDto,
    pub operations: Vec<ProductionOrderOperationDto>,
    pub components: Vec<ProductionOrderComponentDto>,
    pub confirmations: Vec<OperationConfirmationDto>,
    pub costs: ProductionOrderCosts,
    pub status_details: StatusDetails,
}

pub struct ProductionOrderCosts {
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub variance: Decimal,
    pub cost_breakdown: Vec<CostComponent>,
}

pub struct StatusDetails {
    pub overall_status: String,
    pub operations_completed: u16,
    pub operations_total: u16,
    pub components_issued: u16,
    pub components_total: u16,
    pub quantity_confirmed: Decimal,
    pub quantity_delivered: Decimal,
}

// GET /api/v1/production/orders
pub struct ListProductionOrdersQuery {
    pub plant: Option<String>,
    pub material_id: Option<Uuid>,
    pub order_type: Option<String>,
    pub start_date_from: Option<NaiveDate>,
    pub start_date_to: Option<NaiveDate>,
    pub status: Option<String>,
    pub work_center: Option<String>,
    pub sales_order: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
```

#### 5.2.2 能力需求计划 API

```rust
// GET /api/v1/production/capacity-requirements
pub struct GetCapacityRequirementsQuery {
    pub plant: String,
    pub work_centers: Option<Vec<String>>,
    pub date_from: NaiveDate,
    pub date_to: NaiveDate,
    pub requirement_source: Option<String>, // PlannedOrder, ProductionOrder, Both
}

pub struct GetCapacityRequirementsResponse {
    pub work_centers: Vec<WorkCenterCapacity>,
    pub total_requirements: Decimal,
    pub total_available: Decimal,
    pub utilization_percentage: Decimal,
}

pub struct WorkCenterCapacity {
    pub work_center_id: Uuid,
    pub work_center_code: String,
    pub work_center_description: String,
    pub period_data: Vec<CapacityPeriod>,
    pub overload_periods: Vec<OverloadPeriod>,
}

pub struct CapacityPeriod {
    pub date: NaiveDate,
    pub available_capacity: Decimal,
    pub required_capacity: Decimal,
    pub remaining_capacity: Decimal,
    pub utilization_percentage: Decimal,
    pub requirements: Vec<CapacityRequirementDetail>,
}

pub struct CapacityRequirementDetail {
    pub requirement_id: Uuid,
    pub order_number: String,
    pub order_type: String,
    pub operation_number: String,
    pub material_number: String,
    pub required_capacity: Decimal,
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
}

pub struct OverloadPeriod {
    pub date: NaiveDate,
    pub overload_capacity: Decimal,
    pub overload_percentage: Decimal,
}

// POST /api/v1/production/capacity-leveling
pub struct CapacityLevelingRequest {
    pub plant: String,
    pub work_centers: Vec<String>,
    pub date_from: NaiveDate,
    pub date_to: NaiveDate,
    pub leveling_strategy: LevelingStrategy,
    pub max_move_days: u16,
    pub simulation_mode: bool,
}

#[derive(Debug, Deserialize)]
pub enum LevelingStrategy {
    MoveForward,     // Move overloaded operations forward
    MoveBackward,    // Move overloaded operations backward
    Optimize,        // Optimize across all work centers
}

pub struct CapacityLevelingResponse {
    pub leveling_id: Uuid,
    pub simulation_mode: bool,
    pub moves: Vec<CapacityMove>,
    pub before_utilization: Decimal,
    pub after_utilization: Decimal,
    pub applied_at: Option<DateTime<Utc>>,
}

pub struct CapacityMove {
    pub order_number: String,
    pub operation_number: String,
    pub work_center: String,
    pub original_start_date: NaiveDateTime,
    pub new_start_date: NaiveDateTime,
    pub days_moved: i32,
}
```

### 5.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProductionDomainEvent {
    ProductionOrderCreated(ProductionOrderCreated),
    ProductionOrderReleased(ProductionOrderReleased),
    OperationConfirmed(OperationConfirmed),
    ProductionGoodsReceiptPosted(ProductionGoodsReceiptPosted),
    ProductionOrderCompleted(ProductionOrderCompleted),
    ProductionOrderSettled(ProductionOrderSettled),
    ComponentWithdrawn(ComponentWithdrawn),
    ScrapPosted(ScrapPosted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOrderCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub order_id: Uuid,
    pub order_number: String,
    pub order_type: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub plant: String,
    pub target_quantity: Decimal,
    pub unit: String,
    pub order_start_date: NaiveDate,
    pub order_finish_date: NaiveDate,
    pub operations: Vec<OrderOperationCreated>,
    pub components: Vec<OrderComponentCreated>,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderOperationCreated {
    pub operation_number: String,
    pub work_center: String,
    pub planned_start_date: NaiveDateTime,
    pub planned_finish_date: NaiveDateTime,
    pub setup_time: String,
    pub machine_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderComponentCreated {
    pub item_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub required_quantity: Decimal,
    pub unit: String,
    pub storage_location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationConfirmed {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub confirmation_id: Uuid,
    pub confirmation_number: String,
    pub order_id: Uuid,
    pub order_number: String,
    pub operation_number: String,
    pub work_center: String,
    pub yield_quantity: Decimal,
    pub scrap_quantity: Decimal,
    pub actual_setup_time: String,
    pub actual_machine_time: String,
    pub final_confirmation: bool,
    pub backflushed_components: Vec<BackflushedComponent>,
    pub confirmed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackflushedComponent {
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub storage_location: String,
    pub batch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionGoodsReceiptPosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub order_id: Uuid,
    pub order_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub plant: String,
    pub storage_location: String,
    pub batch: Option<String>,
    pub material_document_number: String,
    pub posted_by: String,
}
```

---

本文档继续补充中... 下一步将添加:
- WM/EWM (Warehouse Management) - 仓库管理
- QM (Quality Management) - 质量管理
- PM (Plant Maintenance) - 设备维护
- PS (Project System) - 项目系统
- HCM (Human Capital Management) - 人力资源

## 第六部分：仓库管理模块 (WM/EWM - Warehouse Management)

### 6.1 数据模型

#### 6.1.1 仓库结构 (Warehouse Structure)

```rust
pub struct Warehouse {
    pub warehouse_id: Uuid,
    pub warehouse_number: String,         // 001, 002, 003...
    pub warehouse_type: WarehouseType,
    pub plant: Plant,
    pub company_code: CompanyCode,

    // Description
    pub description: String,
    pub address: Address,

    // Organizational Data
    pub warehouse_manager: UserId,
    pub storage_sections: Vec<StorageSection>,

    // Control Parameters
    pub lean_warehouse: bool,
    pub warehouse_management_active: bool,
    pub yard_management: bool,

    // Physical Inventory
    pub physical_inventory_method: PhysicalInventoryMethod,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct StorageSection {
    pub section_id: Uuid,
    pub section_code: String,             // A01, B01, C01...
    pub description: String,
    pub storage_type: StorageType,
    pub storage_bins: Vec<StorageBin>,
    pub capacity: StorageCapacity,
}

pub struct StorageBin {
    pub bin_id: Uuid,
    pub bin_location: String,             // A01-01-01 (Aisle-Row-Level)
    pub storage_section_id: Uuid,
    pub bin_type: BinType,

    // Dimensions
    pub length: Option<Decimal>,
    pub width: Option<Decimal>,
    pub height: Option<Decimal>,
    pub dimension_unit: Option<Unit>,
    pub volume: Option<Decimal>,
    pub volume_unit: Option<Unit>,

    // Capacity
    pub maximum_weight: Option<Decimal>,
    pub weight_unit: Option<Unit>,
    pub maximum_quantity: Option<Decimal>,

    // Control
    pub mixed_storage: bool,              // Allow multiple materials
    pub addition_to_stock_blocked: bool,
    pub removal_from_stock_blocked: bool,

    // Stock
    pub current_stock: Vec<BinStock>,

    // Status
    pub bin_status: BinStatus,
}

pub struct BinStock {
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub quantity: Decimal,
    pub unit: Unit,
    pub stock_type: StockType,
    pub special_stock_indicator: Option<SpecialStockIndicator>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WarehouseType {
    StandardWarehouse,
    DistributionCenter,
    TransitWarehouse,
    ProductionWarehouse,
    ReturnWarehouse,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StorageType {
    HighRackStorage,
    BlockStorage,
    ShelfStorage,
    OpenStorage,
    BulkStorage,
    HazardousGoodsStorage,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinType {
    FixedBin,                             // Fixed location for material
    RandomBin,                            // Random storage
    ReceivingArea,
    ShippingArea,
    QualityInspectionArea,
    BlockedArea,
}
```

#### 6.1.2 仓库任务 (Warehouse Task)

```rust
pub struct WarehouseTask {
    pub task_id: Uuid,
    pub task_number: String,
    pub task_type: WarehouseTaskType,
    pub warehouse_number: String,
    pub priority: TaskPriority,

    // Source
    pub source_storage_type: Option<String>,
    pub source_bin: Option<String>,
    pub source_handling_unit: Option<String>,

    // Destination
    pub destination_storage_type: String,
    pub destination_bin: Option<String>,
    pub destination_handling_unit: Option<String>,

    // Material
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,
    pub batch: Option<String>,
    pub serial_numbers: Vec<String>,

    // Quantity
    pub source_quantity: Decimal,
    pub destination_quantity: Decimal,
    pub unit: Unit,

    // Stock Type
    pub stock_type: StockType,
    pub special_stock_indicator: Option<SpecialStockIndicator>,

    // Assignment
    pub assigned_to: Option<UserId>,
    pub resource: Option<Resource>,        // Forklift, person, etc.
    pub assigned_at: Option<DateTime<Utc>>,

    // Timing
    pub earliest_start: Option<DateTime<Utc>>,
    pub latest_finish: Option<DateTime<Utc>>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_finish: Option<DateTime<Utc>>,

    // Status
    pub task_status: WarehouseTaskStatus,
    pub confirmation: Option<TaskConfirmation>,

    // Reference
    pub reference_document_type: Option<String>,
    pub reference_document_number: Option<String>,
    pub reference_item: Option<String>,

    // Created
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WarehouseTaskType {
    PutAway,         // Goods receipt putaway
    PickItem,        // Outbound delivery picking
    Replenishment,   // Replenish picking bins
    Relocation,      // Stock relocation
    Counting,        // Physical inventory count
    Scrapping,       // Scrap posting
    Loading,         // Load onto vehicle
    Unloading,       // Unload from vehicle
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TaskPriority {
    Low,
    Normal,
    High,
    Urgent,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WarehouseTaskStatus {
    Created,
    Released,
    Assigned,
    InProgress,
    Confirmed,
    Cancelled,
}

pub struct TaskConfirmation {
    pub confirmed_at: DateTime<Utc>,
    pub confirmed_by: UserId,
    pub confirmed_quantity: Decimal,
    pub actual_source_bin: Option<String>,
    pub actual_destination_bin: String,
    pub deviation_reason: Option<String>,
}
```

#### 6.1.3 搬运单元 (Handling Unit)

```rust
pub struct HandlingUnit {
    pub hu_id: Uuid,
    pub hu_number: String,                // HU-2025-000001
    pub hu_type: HandlingUnitType,
    pub packaging_material_id: Uuid,
    pub packaging_material_number: String,

    // Location
    pub warehouse_number: Option<String>,
    pub storage_type: Option<String>,
    pub storage_bin: Option<String>,
    pub plant: Option<Plant>,
    pub storage_location: Option<StorageLocation>,

    // Identification
    pub sscc: Option<String>,             // Serial Shipping Container Code
    pub barcode: Option<String>,
    pub rfid_tag: Option<String>,

    // Physical Attributes
    pub gross_weight: Decimal,
    pub net_weight: Decimal,
    pub tare_weight: Decimal,
    pub weight_unit: Unit,
    pub volume: Decimal,
    pub volume_unit: Unit,

    // Contents
    pub contents: Vec<HandlingUnitContent>,
    pub nested_handling_units: Vec<String>, // HU numbers of nested HUs

    // Hierarchy
    pub higher_level_hu: Option<String>,  // Parent HU
    pub top_level_hu: String,             // Top of hierarchy

    // Status
    pub hu_status: HandlingUnitStatus,
    pub restricted_use: bool,
    pub quarantine: bool,

    // Assignment
    pub shipment_number: Option<String>,
    pub delivery_number: Option<String>,
    pub warehouse_order: Option<String>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
}

pub struct HandlingUnitContent {
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: Unit,
    pub batch: Option<String>,
    pub serial_numbers: Vec<String>,
    pub stock_type: StockType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HandlingUnitType {
    Pallet,
    Carton,
    Container,
    Cage,
    Drum,
    Bag,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HandlingUnitStatus {
    Empty,
    Loaded,
    InTransit,
    AtDestination,
    Unpacked,
}
```

#### 6.1.4 库存盘点 (Physical Inventory)

```rust
pub struct PhysicalInventory {
    pub inventory_id: Uuid,
    pub inventory_number: String,
    pub inventory_type: PhysicalInventoryType,
    pub warehouse_number: Option<String>,
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,

    // Planning
    pub planned_date: NaiveDate,
    pub freeze_book_inventory: bool,
    pub block_goods_movements: bool,

    // Scope
    pub inventory_scope: InventoryScope,
    pub materials: Vec<Uuid>,
    pub storage_bins: Vec<String>,

    // Count Documents
    pub count_documents: Vec<CountDocument>,

    // Status
    pub status: PhysicalInventoryStatus,
    pub posted: bool,

    // Results
    pub differences: Vec<InventoryDifference>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub counted_at: Option<DateTime<Utc>>,
    pub posted_at: Option<DateTime<Utc>>,
}

pub struct CountDocument {
    pub document_id: Uuid,
    pub document_number: String,
    pub counter: UserId,
    pub count_date: NaiveDate,
    pub items: Vec<CountItem>,
    pub status: CountDocumentStatus,
}

pub struct CountItem {
    pub item_number: u16,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub storage_bin: Option<String>,
    pub book_inventory_quantity: Decimal,
    pub counted_quantity: Decimal,
    pub unit: Unit,
    pub count_status: CountStatus,
    pub recount_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PhysicalInventoryType {
    CycleCount,      // Regular cycle counting
    AnnualInventory, // Year-end full inventory
    SpotCheck,       // Random spot checks
    EventDriven,     // Triggered by specific events
}

pub struct InventoryScope {
    pub scope_type: ScopeType,
    pub include_zero_stock: bool,
    pub include_negative_stock: bool,
    pub stock_types: Vec<StockType>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ScopeType {
    FullInventory,
    MaterialSelection,
    StorageBinSelection,
    ABCClassification,
}

pub struct InventoryDifference {
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub storage_bin: Option<String>,
    pub book_quantity: Decimal,
    pub counted_quantity: Decimal,
    pub difference_quantity: Decimal,
    pub difference_value: Money,
    pub reason_code: Option<ReasonCode>,
    pub approved_for_posting: bool,
}
```

### 6.2 API 规格

#### 6.2.1 仓库任务 API

```rust
// POST /api/v1/warehouse/tasks
pub struct CreateWarehouseTaskRequest {
    pub task_type: String,
    pub warehouse_number: String,
    pub material_id: Uuid,
    pub quantity: Decimal,
    pub unit: String,
    pub source_bin: Option<String>,
    pub destination_bin: Option<String>,
    pub batch: Option<String>,
    pub priority: Option<String>,
    pub reference_document_type: Option<String>,
    pub reference_document_number: Option<String>,
}

pub struct CreateWarehouseTaskResponse {
    pub task_id: Uuid,
    pub task_number: String,
    pub task_type: String,
    pub material_number: String,
    pub quantity: Decimal,
    pub source_bin: Option<String>,
    pub destination_bin: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/warehouse/tasks/{task_id}/assign
pub struct AssignWarehouseTaskRequest {
    pub assignee: Uuid,
    pub resource: Option<String>,         // Resource ID (forklift, etc.)
}

// POST /api/v1/warehouse/tasks/{task_id}/confirm
pub struct ConfirmWarehouseTaskRequest {
    pub confirmed_quantity: Decimal,
    pub actual_source_bin: Option<String>,
    pub actual_destination_bin: String,
    pub deviation_reason: Option<String>,
}

pub struct ConfirmWarehouseTaskResponse {
    pub task_id: Uuid,
    pub task_number: String,
    pub status: String,
    pub confirmed_at: DateTime<Utc>,
    pub confirmed_by: String,
}

// GET /api/v1/warehouse/tasks
pub struct ListWarehouseTasksQuery {
    pub warehouse_number: Option<String>,
    pub task_type: Option<String>,
    pub status: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub material_id: Option<Uuid>,
    pub priority: Option<String>,
    pub created_date_from: Option<NaiveDate>,
    pub created_date_to: Option<NaiveDate>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

// POST /api/v1/warehouse/wave-picking
pub struct CreateWavePickingRequest {
    pub warehouse_number: String,
    pub wave_name: String,
    pub deliveries: Vec<String>,          // Delivery numbers to include
    pub picking_strategy: PickingStrategy,
    pub grouping_criteria: Vec<GroupingCriterion>,
}

#[derive(Debug, Deserialize)]
pub enum PickingStrategy {
    SingleOrder,     // Pick one order at a time
    BatchPicking,    // Pick multiple orders together
    ZonePicking,     // Pick by warehouse zone
    ClusterPicking,  // Pick to multiple orders simultaneously
}

#[derive(Debug, Deserialize)]
pub enum GroupingCriterion {
    ShipToParty,
    Route,
    ShippingPoint,
    Priority,
}

pub struct CreateWavePickingResponse {
    pub wave_id: Uuid,
    pub wave_number: String,
    pub tasks_created: u32,
    pub deliveries_included: Vec<String>,
    pub created_at: DateTime<Utc>,
}
```

#### 6.2.2 搬运单元 API

```rust
// POST /api/v1/warehouse/handling-units
pub struct CreateHandlingUnitRequest {
    pub hu_type: String,
    pub packaging_material_id: Uuid,
    pub contents: Vec<HUContentRequest>,
    pub warehouse_number: Option<String>,
    pub storage_bin: Option<String>,
    pub generate_sscc: bool,
}

pub struct HUContentRequest {
    pub material_id: Uuid,
    pub quantity: Decimal,
    pub unit: String,
    pub batch: Option<String>,
}

pub struct CreateHandlingUnitResponse {
    pub hu_id: Uuid,
    pub hu_number: String,
    pub sscc: Option<String>,
    pub barcode: String,
    pub gross_weight: Decimal,
    pub volume: Decimal,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/warehouse/handling-units/{hu_id}/pack
pub struct PackHandlingUnitRequest {
    pub items: Vec<PackItemRequest>,
}

pub struct PackItemRequest {
    pub material_id: Uuid,
    pub quantity: Decimal,
    pub unit: String,
    pub batch: Option<String>,
    pub serial_numbers: Option<Vec<String>>,
}

// POST /api/v1/warehouse/handling-units/{hu_id}/unpack
pub struct UnpackHandlingUnitRequest {
    pub reason: String,
}

pub struct UnpackHandlingUnitResponse {
    pub hu_id: Uuid,
    pub hu_number: String,
    pub unpacked_contents: Vec<UnpackedContent>,
    pub unpacked_at: DateTime<Utc>,
}

pub struct UnpackedContent {
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub destination_bin: Option<String>,
}

// PUT /api/v1/warehouse/handling-units/{hu_id}/location
pub struct UpdateHULocationRequest {
    pub warehouse_number: Option<String>,
    pub storage_bin: Option<String>,
    pub movement_type: String,
}

// GET /api/v1/warehouse/handling-units/{hu_id}
pub struct GetHandlingUnitResponse {
    pub handling_unit: HandlingUnitDto,
    pub contents: Vec<HUContentDto>,
    pub nested_hus: Vec<NestedHUDto>,
    pub location_history: Vec<LocationHistoryEntry>,
}
```

#### 6.2.3 库存盘点 API

```rust
// POST /api/v1/warehouse/physical-inventories
pub struct CreatePhysicalInventoryRequest {
    pub inventory_type: String,
    pub warehouse_number: Option<String>,
    pub plant: String,
    pub storage_location: Option<String>,
    pub planned_date: NaiveDate,
    pub inventory_scope: InventoryScopeRequest,
    pub freeze_book_inventory: bool,
    pub block_goods_movements: bool,
}

pub struct InventoryScopeRequest {
    pub scope_type: String,
    pub materials: Option<Vec<Uuid>>,
    pub storage_bins: Option<Vec<String>>,
    pub include_zero_stock: bool,
}

pub struct CreatePhysicalInventoryResponse {
    pub inventory_id: Uuid,
    pub inventory_number: String,
    pub planned_date: NaiveDate,
    pub count_documents: Vec<CountDocumentSummary>,
    pub total_items: u32,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/warehouse/physical-inventories/{inventory_id}/count
pub struct RecordCountRequest {
    pub counter: Uuid,
    pub count_date: NaiveDate,
    pub counts: Vec<CountEntryRequest>,
}

pub struct CountEntryRequest {
    pub material_id: Uuid,
    pub batch: Option<String>,
    pub storage_bin: Option<String>,
    pub counted_quantity: Decimal,
    pub unit: String,
}

pub struct RecordCountResponse {
    pub count_document_id: Uuid,
    pub count_document_number: String,
    pub items_counted: u32,
    pub differences_found: u32,
    pub recounts_required: Vec<RecountItem>,
}

pub struct RecountItem {
    pub material_number: String,
    pub storage_bin: Option<String>,
    pub book_quantity: Decimal,
    pub counted_quantity: Decimal,
    pub difference: Decimal,
    pub reason: String,
}

// POST /api/v1/warehouse/physical-inventories/{inventory_id}/post
pub struct PostPhysicalInventoryRequest {
    pub posting_date: NaiveDate,
    pub approval_required: bool,
}

pub struct PostPhysicalInventoryResponse {
    pub inventory_id: Uuid,
    pub inventory_number: String,
    pub material_documents: Vec<String>,
    pub total_differences: u32,
    pub total_difference_value: Decimal,
    pub posted_at: DateTime<Utc>,
}

// GET /api/v1/warehouse/physical-inventories/{inventory_id}/differences
pub struct GetInventoryDifferencesResponse {
    pub inventory_number: String,
    pub differences: Vec<InventoryDifferenceDto>,
    pub summary: DifferenceSummary,
}

pub struct DifferenceSummary {
    pub total_items_with_differences: u32,
    pub total_positive_differences_value: Decimal,
    pub total_negative_differences_value: Decimal,
    pub net_difference_value: Decimal,
    pub currency: String,
}
```

### 6.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WarehouseDomainEvent {
    WarehouseTaskCreated(WarehouseTaskCreated),
    WarehouseTaskAssigned(WarehouseTaskAssigned),
    WarehouseTaskConfirmed(WarehouseTaskConfirmed),
    HandlingUnitCreated(HandlingUnitCreated),
    HandlingUnitPacked(HandlingUnitPacked),
    HandlingUnitUnpacked(HandlingUnitUnpacked),
    HandlingUnitMoved(HandlingUnitMoved),
    PhysicalInventoryCreated(PhysicalInventoryCreated),
    PhysicalInventoryCountRecorded(PhysicalInventoryCountRecorded),
    PhysicalInventoryPosted(PhysicalInventoryPosted),
    StockRelocated(StockRelocated),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarehouseTaskConfirmed {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub task_id: Uuid,
    pub task_number: String,
    pub task_type: String,
    pub warehouse_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub confirmed_quantity: Decimal,
    pub unit: String,
    pub source_bin: Option<String>,
    pub destination_bin: String,
    pub batch: Option<String>,
    pub confirmed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandlingUnitCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub hu_id: Uuid,
    pub hu_number: String,
    pub hu_type: String,
    pub sscc: Option<String>,
    pub packaging_material: String,
    pub contents: Vec<HUContentData>,
    pub gross_weight: Decimal,
    pub volume: Decimal,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HUContentData {
    pub material_id: Uuid,
    pub material_number: String,
    pub quantity: Decimal,
    pub unit: String,
    pub batch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalInventoryPosted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub inventory_id: Uuid,
    pub inventory_number: String,
    pub plant: String,
    pub posting_date: NaiveDate,
    pub differences: Vec<PostedDifference>,
    pub total_difference_value: Decimal,
    pub currency: String,
    pub material_documents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostedDifference {
    pub material_id: Uuid,
    pub material_number: String,
    pub storage_bin: Option<String>,
    pub batch: Option<String>,
    pub difference_quantity: Decimal,
    pub difference_value: Decimal,
}
```

---

## 第七部分：质量管理模块 (QM - Quality Management)

### 7.1 数据模型

#### 7.1.1 质量检验批次 (Inspection Lot)

```rust
pub struct InspectionLot {
    pub lot_id: Uuid,
    pub lot_number: String,               // Format: QL-2025-000001
    pub inspection_lot_origin: InspectionLotOrigin,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,

    // Organizational Data
    pub plant: Plant,
    pub vendor: Option<Uuid>,
    pub customer: Option<Uuid>,

    // Inspection Scope
    pub inspection_lot_quantity: Decimal,
    pub unit_of_measure: Unit,
    pub sample_quantity: Decimal,

    // Dates
    pub inspection_start_date: NaiveDate,
    pub inspection_end_date: Option<NaiveDate>,
    pub actual_start_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,

    // Inspection Plan
    pub inspection_plan_id: Option<Uuid>,
    pub inspection_operations: Vec<InspectionOperation>,

    // Results
    pub usage_decision: Option<UsageDecision>,
    pub quality_score: Option<Decimal>,
    pub defect_quantity: Decimal,
    pub scrap_quantity: Decimal,

    // Status
    pub inspection_lot_status: InspectionLotStatus,
    pub quality_level: Option<QualityLevel>,

    // Reference Documents
    pub purchase_order: Option<String>,
    pub production_order: Option<String>,
    pub delivery_note: Option<String>,
    pub goods_receipt_document: Option<String>,

    // Assignment
    pub inspector: Option<UserId>,
    pub quality_engineer: Option<UserId>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum InspectionLotOrigin {
    GoodsReceipt,         // 01 - Inspection during goods receipt
    GoodsIssue,          // 02 - Inspection during goods issue
    ProductionOrder,     // 03 - In-process inspection
    DeliveryToCustomer,  // 04 - Final inspection before delivery
    StockTransfer,       // 05 - Inspection during stock transfer
    Recurring,           // 06 - Recurring inspection (stability testing)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UsageDecision {
    Accepted,            // A - Unrestricted use
    Rejected,            // R - Rejected
    AcceptedWithConcession, // C - Accepted with concession
    ReturnToVendor,      // V - Return to vendor
    Rework,             // W - Rework required
    Sample,             // S - Sample only
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum InspectionLotStatus {
    Created,
    Released,
    ResultsRecorded,
    UsageDecisionMade,
    Completed,
    Cancelled,
}

pub struct InspectionOperation {
    pub operation_id: Uuid,
    pub operation_number: String,
    pub operation_description: String,
    pub work_center: Option<String>,
    pub inspector: Option<UserId>,

    // Characteristics to Inspect
    pub characteristics: Vec<InspectionCharacteristic>,

    // Timing
    pub planned_start: Option<NaiveDateTime>,
    pub planned_end: Option<NaiveDateTime>,
    pub actual_start: Option<NaiveDateTime>,
    pub actual_end: Option<NaiveDateTime>,

    // Status
    pub operation_status: InspectionOperationStatus,
    pub inspection_completed: bool,
}

pub struct InspectionCharacteristic {
    pub characteristic_id: Uuid,
    pub characteristic_code: String,
    pub characteristic_description: String,
    pub characteristic_type: CharacteristicType,

    // Specification
    pub target_value: Option<Decimal>,
    pub lower_specification_limit: Option<Decimal>,
    pub upper_specification_limit: Option<Decimal>,
    pub lower_tolerance: Option<Decimal>,
    pub upper_tolerance: Option<Decimal>,

    // Sampling
    pub sample_size: u32,
    pub sampling_procedure: Option<SamplingProcedure>,

    // Results
    pub results: Vec<InspectionResult>,
    pub mean_value: Option<Decimal>,
    pub standard_deviation: Option<Decimal>,

    // Decision
    pub characteristic_decision: Option<CharacteristicDecision>,
    pub defect_class: Option<DefectClass>,

    // Measurement
    pub unit_of_measure: Option<Unit>,
    pub measurement_method: Option<String>,
    pub inspection_equipment: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CharacteristicType {
    Quantitative,        // Measured value (length, weight, etc.)
    Qualitative,         // Attribute (pass/fail, color, etc.)
    Text,               // Text description
}

pub struct InspectionResult {
    pub result_id: Uuid,
    pub sample_number: u32,
    pub measured_value: Option<Decimal>,
    pub attribute_value: Option<String>,
    pub text_value: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: UserId,
    pub measurement_equipment_id: Option<String>,
    pub within_specification: bool,
    pub defect_code: Option<DefectCode>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CharacteristicDecision {
    Accepted,
    Rejected,
    AcceptedWithDeviation,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DefectClass {
    Critical,
    Major,
    Minor,
}
```

#### 7.1.2 质量证书 (Quality Certificate)

```rust
pub struct QualityCertificate {
    pub certificate_id: Uuid,
    pub certificate_number: String,
    pub certificate_type: QualityCertificateType,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,

    // Origin
    pub manufacturer: Option<String>,
    pub production_date: Option<NaiveDate>,
    pub production_location: Option<String>,

    // Related Documents
    pub inspection_lot_number: Option<String>,
    pub purchase_order: Option<String>,
    pub delivery_note: Option<String>,

    // Certificate Data
    pub certificate_characteristics: Vec<CertificateCharacteristic>,
    pub certificate_text: Option<String>,
    pub certificate_pdf: Option<String>,  // File path or URL

    // Validity
    pub issue_date: NaiveDate,
    pub valid_until: Option<NaiveDate>,
    pub issuer: String,
    pub authorized_signatory: String,
    pub digital_signature: Option<String>,

    // Status
    pub certificate_status: CertificateStatus,
    pub verified: bool,
    pub verified_by: Option<UserId>,
    pub verified_at: Option<DateTime<Utc>>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct CertificateCharacteristic {
    pub characteristic_code: String,
    pub characteristic_description: String,
    pub certified_value: String,
    pub specification_limit: Option<String>,
    pub test_method: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QualityCertificateType {
    MaterialCertificate,     // 3.1 - Material test certificate
    InspectionCertificate,   // 3.2 - Inspection certificate
    ComplianceCertificate,   // Regulatory compliance
    AnalysisCertificate,     // Certificate of analysis
    ConformityCertificate,   // Declaration of conformity
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CertificateStatus {
    Draft,
    Issued,
    Verified,
    Expired,
    Revoked,
}
```

#### 7.1.3 质量通知 (Quality Notification)

```rust
pub struct QualityNotification {
    pub notification_id: Uuid,
    pub notification_number: String,      // Format: QN-2025-000001
    pub notification_type: QualityNotificationType,
    pub priority: NotificationPriority,

    // Description
    pub short_text: String,
    pub long_text: Option<String>,
    pub defect_description: String,

    // Material
    pub material_id: Option<Uuid>,
    pub material_number: Option<String>,
    pub batch: Option<String>,
    pub serial_number: Option<String>,

    // Location
    pub plant: Option<Plant>,
    pub storage_location: Option<StorageLocation>,

    // Business Partners
    pub vendor: Option<Uuid>,
    pub customer: Option<Uuid>,
    pub manufacturer: Option<String>,

    // Reference Documents
    pub purchase_order: Option<String>,
    pub sales_order: Option<String>,
    pub delivery_note: Option<String>,
    pub inspection_lot: Option<String>,

    // Defect Data
    pub defect_code: Option<DefectCode>,
    pub defect_location: Option<DefectLocation>,
    pub defect_quantity: Option<Decimal>,
    pub defect_percentage: Option<Decimal>,

    // Root Cause Analysis
    pub root_cause_code: Option<String>,
    pub root_cause_description: Option<String>,

    // Tasks
    pub tasks: Vec<QualityTask>,

    // Status
    pub notification_status: NotificationStatus,
    pub responsible_person: Option<UserId>,
    pub assigned_to: Option<UserId>,

    // Dates
    pub required_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,

    // Costs
    pub estimated_cost: Option<Money>,
    pub actual_cost: Option<Money>,

    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QualityNotificationType {
    CustomerComplaint,       // Q1 - Customer complaint
    VendorComplaint,        // Q2 - Complaint to vendor
    InternalProblem,        // Q3 - Internal quality problem
    AuditFinding,          // Q4 - Quality audit finding
    ProcessDeviation,      // Q5 - Process deviation
}

pub struct QualityTask {
    pub task_id: Uuid,
    pub task_code: String,
    pub task_description: String,
    pub task_type: TaskType,
    pub responsible_person: Option<UserId>,
    pub planned_start: Option<NaiveDate>,
    pub planned_end: Option<NaiveDate>,
    pub actual_start: Option<NaiveDate>,
    pub actual_end: Option<NaiveDate>,
    pub task_status: TaskStatus,
    pub completion_note: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TaskType {
    Containment,         // Immediate containment action
    RootCauseAnalysis,   // Investigate root cause
    CorrectiveAction,    // Implement corrective action
    PreventiveAction,    // Implement preventive action
    Verification,        // Verify effectiveness
}
```

### 7.2 API 规格

```rust
// POST /api/v1/quality/inspection-lots
pub struct CreateInspectionLotRequest {
    pub inspection_lot_origin: String,
    pub material_id: Uuid,
    pub batch: Option<String>,
    pub plant: String,
    pub inspection_lot_quantity: Decimal,
    pub unit_of_measure: String,
    pub vendor: Option<Uuid>,
    pub purchase_order: Option<String>,
    pub production_order: Option<String>,
    pub goods_receipt_document: Option<String>,
    pub inspection_plan_id: Option<Uuid>,
}

pub struct CreateInspectionLotResponse {
    pub lot_id: Uuid,
    pub lot_number: String,
    pub material_number: String,
    pub inspection_operations: Vec<InspectionOperationSummary>,
    pub inspector_assigned: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/quality/inspection-lots/{lot_id}/record-results
pub struct RecordInspectionResultsRequest {
    pub operation_number: String,
    pub results: Vec<CharacteristicResultRequest>,
    pub inspector: Uuid,
}

pub struct CharacteristicResultRequest {
    pub characteristic_code: String,
    pub sample_results: Vec<SampleResultRequest>,
}

pub struct SampleResultRequest {
    pub sample_number: u32,
    pub measured_value: Option<Decimal>,
    pub attribute_value: Option<String>,
    pub defect_code: Option<String>,
}

// POST /api/v1/quality/inspection-lots/{lot_id}/usage-decision
pub struct MakeUsageDecisionRequest {
    pub usage_decision: String,           // Accepted, Rejected, etc.
    pub quality_score: Option<Decimal>,
    pub defect_quantity: Option<Decimal>,
    pub scrap_quantity: Option<Decimal>,
    pub decision_note: Option<String>,
}

pub struct MakeUsageDecisionResponse {
    pub lot_id: Uuid,
    pub lot_number: String,
    pub usage_decision: String,
    pub quality_score: Option<Decimal>,
    pub stock_posting_action: Option<String>,
    pub decided_at: DateTime<Utc>,
    pub decided_by: String,
}

// POST /api/v1/quality/notifications
pub struct CreateQualityNotificationRequest {
    pub notification_type: String,
    pub priority: String,
    pub short_text: String,
    pub long_text: Option<String>,
    pub material_id: Option<Uuid>,
    pub batch: Option<String>,
    pub plant: Option<String>,
    pub defect_code: Option<String>,
    pub defect_quantity: Option<Decimal>,
    pub vendor: Option<Uuid>,
    pub customer: Option<Uuid>,
    pub reference_documents: Option<ReferenceDocumentsRequest>,
}

pub struct CreateQualityNotificationResponse {
    pub notification_id: Uuid,
    pub notification_number: String,
    pub notification_type: String,
    pub priority: String,
    pub assigned_to: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/quality/certificates
pub struct CreateQualityCertificateRequest {
    pub certificate_type: String,
    pub material_id: Uuid,
    pub batch: Option<String>,
    pub inspection_lot_number: Option<String>,
    pub manufacturer: Option<String>,
    pub production_date: Option<NaiveDate>,
    pub characteristics: Vec<CertificateCharacteristicRequest>,
    pub certificate_pdf: Option<String>,
    pub issuer: String,
    pub authorized_signatory: String,
}

pub struct CertificateCharacteristicRequest {
    pub characteristic_code: String,
    pub characteristic_description: String,
    pub certified_value: String,
    pub specification_limit: Option<String>,
}

pub struct CreateQualityCertificateResponse {
    pub certificate_id: Uuid,
    pub certificate_number: String,
    pub material_number: String,
    pub issue_date: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
}
```

### 7.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QualityDomainEvent {
    InspectionLotCreated(InspectionLotCreated),
    InspectionResultsRecorded(InspectionResultsRecorded),
    UsageDecisionMade(UsageDecisionMade),
    QualityNotificationCreated(QualityNotificationCreated),
    QualityNotificationCompleted(QualityNotificationCompleted),
    QualityCertificateIssued(QualityCertificateIssued),
    DefectDetected(DefectDetected),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionLotCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub lot_id: Uuid,
    pub lot_number: String,
    pub inspection_lot_origin: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub plant: String,
    pub inspection_lot_quantity: Decimal,
    pub unit: String,
    pub inspector_assigned: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageDecisionMade {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub lot_id: Uuid,
    pub lot_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub usage_decision: String,
    pub quality_score: Option<Decimal>,
    pub defect_quantity: Decimal,
    pub stock_posting_required: bool,
    pub target_stock_type: Option<String>,
    pub decided_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefectDetected {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub material_id: Uuid,
    pub material_number: String,
    pub batch: Option<String>,
    pub defect_code: String,
    pub defect_quantity: Decimal,
    pub defect_location: Option<String>,
    pub inspection_lot: Option<String>,
    pub notification_created: Option<String>,
}
```

---

本文档将继续补充以下模块：
- PM (Plant Maintenance) - 设备维护
- PS (Project System) - 项目系统
- HCM (Human Capital Management) - 人力资源
- TR (Treasury) - 资金管理
- 更多...

---

## 第八部分：跨模块集成架构

### 8.1 核心业务流程事件链

#### 8.1.1 采购到付款流程 (P2P - Procure to Pay)

```rust
// Event Chain: PR → PO → GR → IV → Payment
pub struct P2PEventChain {
    pub chain_id: Uuid,
    pub process_started_at: DateTime<Utc>,
    pub current_stage: P2PStage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum P2PStage {
    // Stage 1: Procurement Request
    PurchaseRequisitionCreated {
        requisition_id: Uuid,
        requisition_number: String,
        requester: UserId,
        total_value: Decimal,
    },
    PurchaseRequisitionApproved {
        approved_at: DateTime<Utc>,
        approved_by: UserId,
    },
    
    // Stage 2: Purchase Order
    PurchaseOrderCreated {
        po_id: Uuid,
        po_number: String,
        vendor_id: Uuid,
        po_value: Decimal,
    },
    PurchaseOrderReleased {
        released_at: DateTime<Utc>,
    },
    
    // Stage 3: Goods Receipt
    GoodsReceiptPosted {
        gr_id: Uuid,
        material_document_number: String,
        received_quantity: Decimal,
        gr_value: Decimal,
    },
    
    // Stage 4: Invoice Verification
    InvoiceReceived {
        invoice_id: Uuid,
        invoice_number: String,
        invoice_amount: Decimal,
        invoice_date: NaiveDate,
    },
    ThreeWayMatchCompleted {
        po_quantity: Decimal,
        gr_quantity: Decimal,
        invoice_quantity: Decimal,
        price_variance: Decimal,
        quantity_variance: Decimal,
        match_result: MatchResult,
    },
    InvoicePosted {
        accounting_document_id: Uuid,
        accounting_document_number: String,
        posted_at: DateTime<Utc>,
    },
    
    // Stage 5: Payment
    PaymentProposed {
        payment_run_id: Uuid,
        payment_method: String,
        payment_amount: Decimal,
        payment_date: NaiveDate,
    },
    PaymentExecuted {
        payment_document_id: Uuid,
        paid_amount: Decimal,
        paid_at: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MatchResult {
    ExactMatch,
    WithinTolerance,
    RequireKILLERproval,
    Blocked,
}
```

#### 8.1.2 订单到收款流程 (O2C - Order to Cash)

```rust
// Event Chain: SO → Delivery → PGI → Billing → Payment
pub struct O2CEventChain {
    pub chain_id: Uuid,
    pub process_started_at: DateTime<Utc>,
    pub current_stage: O2CStage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum O2CStage {
    // Stage 1: Sales Order
    SalesOrderCreated {
        order_id: Uuid,
        order_number: String,
        customer_id: Uuid,
        order_value: Decimal,
    },
    CreditCheckPassed {
        credit_limit: Decimal,
        credit_exposure: Decimal,
        available_credit: Decimal,
    },
    AvailabilityConfirmed {
        confirmed_quantity: Decimal,
        confirmed_date: NaiveDate,
    },
    
    // Stage 2: Delivery
    DeliveryCreated {
        delivery_id: Uuid,
        delivery_number: String,
        ship_to_party: Uuid,
    },
    DeliveryPicked {
        picked_at: DateTime<Utc>,
        picked_by: UserId,
    },
    
    // Stage 3: Goods Issue
    GoodsIssuePosted {
        material_document_number: String,
        goods_issue_date: NaiveDate,
        cogs_amount: Decimal,
    },
    
    // Stage 4: Billing
    BillingDocumentCreated {
        billing_id: Uuid,
        billing_number: String,
        invoice_amount: Decimal,
        due_date: NaiveDate,
    },
    RevenueRecognized {
        revenue_amount: Decimal,
        revenue_account: String,
        accounting_document_id: Uuid,
    },
    
    // Stage 5: Payment
    PaymentReceived {
        payment_id: Uuid,
        payment_amount: Decimal,
        payment_date: NaiveDate,
        payment_method: String,
    },
    InvoiceCleared {
        cleared_amount: Decimal,
        remaining_open_amount: Decimal,
    },
}
```

#### 8.1.3 生产订单流程 (Make to Stock/Order)

```rust
// Event Chain: SO/Forecast → Production Order → Manufacturing → GR → Delivery
pub struct ProductionEventChain {
    pub chain_id: Uuid,
    pub production_strategy: ProductionStrategy,
    pub current_stage: ProductionStage,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProductionStrategy {
    MakeToStock,     // MTS - Produce based on forecast
    MakeToOrder,     // MTO - Produce based on sales order
    AssembleToOrder, // ATO - Final assembly based on order
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProductionStage {
    // Planning
    DemandCreated {
        demand_id: Uuid,
        demand_type: String,  // Sales order, forecast, safety stock
        material_id: Uuid,
        required_quantity: Decimal,
        required_date: NaiveDate,
    },
    MrpRunExecuted {
        mrp_run_id: Uuid,
        planned_orders_created: u32,
        purchase_requisitions_created: u32,
    },
    
    // Production Order
    ProductionOrderCreated {
        order_id: Uuid,
        order_number: String,
        target_quantity: Decimal,
        scheduled_start: NaiveDate,
        scheduled_finish: NaiveDate,
    },
    ProductionOrderReleased {
        released_at: DateTime<Utc>,
        components_reserved: Vec<ComponentReservation>,
    },
    
    // Manufacturing
    ComponentsIssued {
        materials_withdrawn: Vec<MaterialWithdrawal>,
        total_value: Decimal,
    },
    OperationConfirmed {
        operation_number: String,
        work_center: String,
        yield_quantity: Decimal,
        actual_time: String,
    },
    
    // Completion
    ProductionGoodsReceiptPosted {
        material_document_number: String,
        quantity_produced: Decimal,
        production_cost: Decimal,
    },
    ProductionOrderSettled {
        settlement_document: String,
        settled_amount: Decimal,
        variance: Decimal,
    },
}

pub struct ComponentReservation {
    pub material_id: Uuid,
    pub material_number: String,
    pub reserved_quantity: Decimal,
    pub reservation_number: String,
}

pub struct MaterialWithdrawal {
    pub material_id: Uuid,
    pub material_number: String,
    pub withdrawn_quantity: Decimal,
    pub value: Decimal,
}
```

### 8.2 领域间消息路由

```rust
// Event Router Configuration
pub struct EventRoutingConfig {
    pub routes: HashMap<EventType, Vec<SubscriberConfig>>,
}

pub struct SubscriberConfig {
    pub subscriber_service: String,
    pub topic: String,
    pub consumer_group: String,
    pub retry_policy: RetryPolicy,
    pub dead_letter_queue: String,
}

// Example routing configuration
pub fn default_event_routing() -> EventRoutingConfig {
    let mut routes = HashMap::new();
    
    // Financial events routing
    routes.insert(
        EventType::DocumentPosted,
        vec![
            SubscriberConfig {
                subscriber_service: "controlling-service".to_string(),
                topic: "financial.document-posted".to_string(),
                consumer_group: "co-actual-postings".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 5 },
                dead_letter_queue: "financial.dlq".to_string(),
            },
            SubscriberConfig {
                subscriber_service: "bi-service".to_string(),
                topic: "financial.document-posted".to_string(),
                consumer_group: "bi-financial-analytics".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 3 },
                dead_letter_queue: "bi.dlq".to_string(),
            },
        ],
    );
    
    // Goods Receipt events routing
    routes.insert(
        EventType::GoodsReceiptPosted,
        vec![
            SubscriberConfig {
                subscriber_service: "financial-service".to_string(),
                topic: "materials.goods-receipt-posted".to_string(),
                consumer_group: "fi-inventory-accounting".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 5 },
                dead_letter_queue: "materials.dlq".to_string(),
            },
            SubscriberConfig {
                subscriber_service: "quality-service".to_string(),
                topic: "materials.goods-receipt-posted".to_string(),
                consumer_group: "qm-inspection-trigger".to_string(),
                retry_policy: RetryPolicy::Immediate { max_attempts: 3 },
                dead_letter_queue: "quality.dlq".to_string(),
            },
            SubscriberConfig {
                subscriber_service: "warehouse-service".to_string(),
                topic: "materials.goods-receipt-posted".to_string(),
                consumer_group: "wm-putaway-tasks".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 5 },
                dead_letter_queue: "warehouse.dlq".to_string(),
            },
        ],
    );
    
    // Sales Order events routing
    routes.insert(
        EventType::SalesOrderCreated,
        vec![
            SubscriberConfig {
                subscriber_service: "materials-service".to_string(),
                topic: "sales.order-created".to_string(),
                consumer_group: "mm-atp-check".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 5 },
                dead_letter_queue: "sales.dlq".to_string(),
            },
            SubscriberConfig {
                subscriber_service: "credit-management-service".to_string(),
                topic: "sales.order-created".to_string(),
                consumer_group: "fscm-credit-check".to_string(),
                retry_policy: RetryPolicy::Immediate { max_attempts: 3 },
                dead_letter_queue: "credit.dlq".to_string(),
            },
            SubscriberConfig {
                subscriber_service: "production-service".to_string(),
                topic: "sales.order-created".to_string(),
                consumer_group: "pp-demand-creation".to_string(),
                retry_policy: RetryPolicy::ExponentialBackoff { max_attempts: 3 },
                dead_letter_queue: "production.dlq".to_string(),
            },
        ],
    );
    
    EventRoutingConfig { routes }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EventType {
    // Financial
    DocumentPosted,
    PaymentReceived,
    PeriodClosed,
    
    // Materials
    GoodsReceiptPosted,
    PurchaseOrderCreated,
    
    // Sales
    SalesOrderCreated,
    DeliveryCreated,
    BillingDocumentCreated,
    
    // Production
    ProductionOrderCreated,
    OperationConfirmed,
    
    // Quality
    InspectionLotCreated,
    UsageDecisionMade,
    
    // Warehouse
    WarehouseTaskConfirmed,
    PhysicalInventoryPosted,
}

#[derive(Debug, Clone)]
pub enum RetryPolicy {
    Immediate { max_attempts: u8 },
    ExponentialBackoff { max_attempts: u8 },
    FixedDelay { delay_seconds: u64, max_attempts: u8 },
}
```

### 8.3 主数据同步策略

```rust
// Master Data Synchronization
pub struct MasterDataSyncService {
    pub mdg_client: Arc<MdgServiceClient>,
    pub event_publisher: Arc<EventPublisher>,
}

impl MasterDataSyncService {
    // Material Master Data sync from MDG to all consuming systems
    pub async fn sync_material_master(
        &self,
        material_id: Uuid,
    ) -> Result<SyncResult, SyncError> {
        // 1. Fetch from MDG (golden record)
        let material_master = self.mdg_client
            .get_material_master(material_id)
            .await?;
        
        // 2. Publish to consuming systems
        let event = MaterialMasterChanged {
            material_id,
            change_timestamp: Utc::now(),
            change_type: ChangeType::Update,
            material_data: material_master,
        };
        
        // Consuming systems: MM, SD, PP, WM, QM, FI/CO
        self.event_publisher.publish(
            "mdg.material-master-changed",
            &event,
        ).await?;
        
        Ok(SyncResult {
            sync_id: Uuid::new_v4(),
            synced_at: Utc::now(),
            target_systems: vec![
                "materials-service",
                "sales-service",
                "production-service",
                "warehouse-service",
                "quality-service",
                "financial-service",
            ],
        })
    }
    
    // Business Partner sync from MDG to FI, SD, MM
    pub async fn sync_business_partner(
        &self,
        bp_id: Uuid,
    ) -> Result<SyncResult, SyncError> {
        let bp_master = self.mdg_client
            .get_business_partner(bp_id)
            .await?;
        
        let event = BusinessPartnerChanged {
            bp_id,
            change_timestamp: Utc::now(),
            change_type: ChangeType::Update,
            bp_data: bp_master,
        };
        
        self.event_publisher.publish(
            "mdg.business-partner-changed",
            &event,
        ).await?;
        
        Ok(SyncResult {
            sync_id: Uuid::new_v4(),
            synced_at: Utc::now(),
            target_systems: vec![
                "financial-service",   // Customer/Vendor accounting
                "sales-service",       // Customer sales data
                "materials-service",   // Vendor purchasing data
                "credit-service",      // Credit management
            ],
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ChangeType {
    Create,
    Update,
    Delete,
    Block,
    Unblock,
}
```

### 8.4 数据一致性保障

```rust
// Saga Coordinator for cross-module transactions
pub struct SagaCoordinator {
    pub saga_store: Arc<SagaStore>,
    pub event_publisher: Arc<EventPublisher>,
    pub compensation_handler: Arc<CompensationHandler>,
}

impl SagaCoordinator {
    // Example: Order-to-Cash Saga
    pub async fn execute_order_to_cash_saga(
        &self,
        request: CreateSalesOrderRequest,
    ) -> Result<O2CSagaResult, SagaError> {
        let saga_id = Uuid::new_v4();
        let mut saga = O2CSaga::new(saga_id, request);
        
        // Step 1: Create Sales Order
        match self.create_sales_order(&mut saga).await {
            Ok(_) => {},
            Err(e) => {
                self.compensate_saga(&saga).await?;
                return Err(e);
            }
        }
        
        // Step 2: Check Credit Limit
        match self.check_credit_limit(&mut saga).await {
            Ok(_) => {},
            Err(e) => {
                self.compensate_saga(&saga).await?;
                return Err(e);
            }
        }
        
        // Step 3: Reserve Inventory (ATP Check)
        match self.reserve_inventory(&mut saga).await {
            Ok(_) => {},
            Err(e) => {
                self.compensate_saga(&saga).await?;
                return Err(e);
            }
        }
        
        // Step 4: Calculate Pricing
        match self.calculate_pricing(&mut saga).await {
            Ok(_) => {},
            Err(e) => {
                self.compensate_saga(&saga).await?;
                return Err(e);
            }
        }
        
        // Saga completed successfully
        saga.mark_completed();
        self.saga_store.save(&saga).await?;
        
        Ok(O2CSagaResult {
            saga_id,
            order_id: saga.order_id.unwrap(),
            order_number: saga.order_number.clone().unwrap(),
            completed_at: Utc::now(),
        })
    }
    
    async fn compensate_saga(&self, saga: &O2CSaga) -> Result<(), SagaError> {
        // Execute compensations in reverse order
        for step in saga.completed_steps.iter().rev() {
            match step {
                SagaStep::SalesOrderCreated { order_id } => {
                    self.compensation_handler
                        .delete_sales_order(*order_id)
                        .await?;
                }
                SagaStep::InventoryReserved { reservation_id } => {
                    self.compensation_handler
                        .release_reservation(*reservation_id)
                        .await?;
                }
                SagaStep::CreditBlocked { block_id } => {
                    self.compensation_handler
                        .release_credit_block(*block_id)
                        .await?;
                }
                _ => {}
            }
        }
        Ok(())
    }
}

pub struct O2CSaga {
    pub saga_id: Uuid,
    pub request: CreateSalesOrderRequest,
    pub order_id: Option<Uuid>,
    pub order_number: Option<String>,
    pub completed_steps: Vec<SagaStep>,
    pub status: SagaStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone)]
pub enum SagaStep {
    SalesOrderCreated { order_id: Uuid },
    CreditBlocked { block_id: Uuid },
    InventoryReserved { reservation_id: Uuid },
    PricingCalculated { total_value: Decimal },
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SagaStatus {
    InProgress,
    Completed,
    Compensating,
    Compensated,
    Failed,
}
```

---

## 总结与实施指南

### 核心设计原则

1. **领域驱动设计 (DDD)**
   - 每个模块都有清晰的领域边界
   - 聚合根负责维护业务不变性
   - 值对象确保数据完整性

2. **事件驱动架构**
   - 所有状态变更通过领域事件传播
   - 异步事件处理提高系统可扩展性
   - 事件溯源支持完整审计追踪

3. **微服务架构**
   - 每个业务模块独立部署
   - 服务间通过事件和API通信
   - 数据库按服务隔离

4. **API 优先**
   - RESTful API 设计规范
   - gRPC 用于服务间高性能通信
   - GraphQL 用于复杂查询场景

### 技术栈推荐

```rust
// Core dependencies
[dependencies]
# Web framework
axum = "0.7"
tower = "0.4"
tower-http = "0.5"

# Async runtime
tokio = { version = "1.35", features = ["full"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Database
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-native-tls", "uuid", "chrono", "decimal"] }
sea-orm = "0.12"

# gRPC
tonic = "0.11"
prost = "0.12"

# Event streaming
rdkafka = "0.36"

# Caching
redis = { version = "0.24", features = ["tokio-comp"] }

# Observability
tracing = "0.1"
tracing-subscriber = "0.3"
opentelemetry = "0.21"

# Validation
validator = { version = "0.16", features = ["derive"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Money & Decimal
rust_decimal = "1.33"
rust_decimal_macros = "1.33"

# UUID
uuid = { version = "1.6", features = ["v4", "serde"] }

# DateTime
chrono = { version = "0.4", features = ["serde"] }

# Authentication
jsonwebtoken = "9.2"

# Configuration
config = "0.14"
```

### 数据库设计原则

1. **分区策略**
   - 按fiscal_year分区交易表
   - 按posting_date分区高频表
   - 归档历史数据到冷存储

2. **索引优化**
   - 复合索引支持常见查询模式
   - 部分索引减少索引大小
   - 使用BRIN索引处理时序数据

3. **性能优化**
   - 读写分离（主从复制）
   - 物化视图加速报表查询
   - 连接池管理数据库连接

### 监控指标

```rust
// Business metrics
pub static ORDER_CREATED_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    register_int_counter!("erp_orders_created_total", "Total orders created")
});

pub static ORDER_VALUE: Lazy<Histogram> = Lazy::new(|| {
    register_histogram!("erp_order_value_usd", "Order value in USD")
});

// Technical metrics
pub static API_REQUEST_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "erp_api_request_duration_seconds",
        "API request duration",
        &["service", "endpoint", "method", "status"]
    )
});

pub static DATABASE_QUERY_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "erp_db_query_duration_seconds",
        "Database query duration",
        &["service", "query_type"]
    )
});
```

### 部署架构建议

```yaml
# Kubernetes namespace per environment
apiVersion: v1
kind: Namespace
metadata:
  name: erp-production
  labels:
    environment: production
    
---
# Service mesh with Istio
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
        x-api-version:
          exact: "v1"
    route:
    - destination:
        host: financial-service
        subset: v1
  - route:
    - destination:
        host: financial-service
        subset: v2
      weight: 10
    - destination:
        host: financial-service
        subset: v1
      weight: 90
```

---

## 下一步工作

本文档已完成以下模块的详细规格：

✅ **FI (Financial Accounting)** - 财务会计  
✅ **CO (Controlling)** - 成本控制  
✅ **MM (Materials Management)** - 物料管理  
✅ **SD (Sales & Distribution)** - 销售分销  
✅ **PP (Production Planning)** - 生产计划  
✅ **WM/EWM (Warehouse Management)** - 仓库管理  
✅ **QM (Quality Management)** - 质量管理  

**待补充模块** (可根据需要继续扩展):
- PM (Plant Maintenance) - 设备维护
- PS (Project System) - 项目系统
- HCM (Human Capital Management) - 人力资源
- TR (Treasury) - 资金管理
- BW/BI (Business Intelligence) - 商业智能

文档提供了:
- ✅ 完整的数据模型定义
- ✅ RESTful API 规格
- ✅ 领域事件定义
- ✅ 业务规则实现
- ✅ 跨模块集成架构
- ✅ 实施技术指南

此文档可作为开发团队的技术蓝图，配合 **Rust-Abc-Enhanced.md** (12个月开发计划) 和 **Rust-Implementation-Guide.md** (实施指南) 使用。

## 第九部分：设备维护模块 (PM - Plant Maintenance)

### 9.1 数据模型

#### 9.1.1 技术对象 (Technical Object)

```rust
pub struct Equipment {
    pub equipment_id: Uuid,
    pub equipment_number: String,         // Format: EQP-000001
    pub equipment_category: EquipmentCategory,
    
    // Description
    pub description: String,
    pub long_text: Option<String>,
    
    // Classification
    pub equipment_class: EquipmentClass,
    pub object_type: ObjectType,
    pub abc_indicator: Option<AbcIndicator>,
    
    // Technical Data
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub serial_number: Option<String>,
    pub manufacturing_date: Option<NaiveDate>,
    pub acquisition_date: Option<NaiveDate>,
    pub acquisition_value: Option<Money>,
    
    // Location
    pub plant: Plant,
    pub maintenance_plant: Plant,
    pub location: Option<Location>,
    pub room: Option<String>,
    pub functional_location: Option<String>,
    pub cost_center: CostCenter,
    
    // Organizational Assignment
    pub maintenance_planner_group: PlannerGroup,
    pub maintenance_work_center: WorkCenter,
    pub responsible_person: Option<UserId>,
    
    // Technical Specifications
    pub technical_characteristics: Vec<TechnicalCharacteristic>,
    pub capacity: Option<Capacity>,
    pub weight: Option<Weight>,
    pub dimensions: Option<Dimensions>,
    
    // Maintenance Strategy
    pub maintenance_strategy: Option<MaintenanceStrategy>,
    pub maintenance_plans: Vec<Uuid>,  // References to maintenance plans
    pub task_lists: Vec<Uuid>,         // References to task lists
    
    // Status
    pub system_status: EquipmentStatus,
    pub user_status: Option<UserStatus>,
    pub availability_status: AvailabilityStatus,
    
    // Performance Tracking
    pub total_operating_hours: Decimal,
    pub total_downtime_hours: Decimal,
    pub last_maintenance_date: Option<NaiveDate>,
    pub next_maintenance_date: Option<NaiveDate>,
    pub mtbf: Option<Decimal>,         // Mean Time Between Failures
    pub mttr: Option<Decimal>,         // Mean Time To Repair
    
    // Hierarchical Structure
    pub superior_equipment: Option<String>,
    pub structure_indicator: Option<StructureIndicator>,
    
    // Asset Link
    pub asset_number: Option<String>,  // Link to FI-AA
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
    pub last_changed_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EquipmentCategory {
    MachineEquipment,      // M - Machines
    ProductionResource,    // P - Production resources
    TransportEquipment,    // T - Transport equipment
    TestEquipment,        // E - Test equipment
    BuildingComponent,     // B - Building components
    Tool,                 // L - Tools
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AvailabilityStatus {
    Available,
    InMaintenance,
    Breakdown,
    Reserved,
    Decommissioned,
}

pub struct FunctionalLocation {
    pub floc_id: Uuid,
    pub floc_number: String,           // Format: SITE-AREA-ZONE-SYSTEM
    pub description: String,
    
    // Hierarchy
    pub superior_floc: Option<String>,
    pub structure_indicator: StructureIndicator,
    pub level: u8,
    
    // Organizational Data
    pub plant: Plant,
    pub maintenance_plant: Plant,
    pub location: Option<Location>,
    pub cost_center: CostCenter,
    pub planner_group: PlannerGroup,
    pub work_center: WorkCenter,
    
    // Category
    pub floc_category: FlocCategory,
    
    // Status
    pub system_status: FlocStatus,
    
    // Equipment installed at this location
    pub installed_equipment: Vec<String>,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FlocCategory {
    Site,
    Building,
    ProductionLine,
    Area,
    System,
    Subsystem,
}
```

#### 9.1.2 维护计划 (Maintenance Plan)

```rust
pub struct MaintenancePlan {
    pub plan_id: Uuid,
    pub plan_number: String,           // Format: MP-2025-000001
    pub maintenance_strategy: MaintenanceStrategy,
    
    // Object Reference
    pub object_type: MaintenanceObjectType,
    pub object_id: Uuid,
    pub object_number: String,
    
    // Planning Data
    pub scheduling_indicator: SchedulingIndicator,
    pub cycle_unit: CycleUnit,
    pub cycle_length: Decimal,
    pub cycle_start_date: NaiveDate,
    pub cycle_text: String,
    
    // Task List
    pub task_list_type: TaskListType,
    pub task_list_group: String,
    pub task_list_counter: String,
    
    // Scheduling Parameters
    pub scheduling_period: Period,
    pub factory_calendar: String,
    pub shift_factor: Decimal,
    pub lead_time: Duration,
    pub offset_start: Option<Duration>,
    pub offset_end: Option<Duration>,
    
    // Call Objects (Work orders to be generated)
    pub call_horizon: u16,             // Days
    pub order_type: String,
    pub priority: MaintenancePriority,
    pub work_center: WorkCenter,
    pub planner_group: PlannerGroup,
    
    // Schedule
    pub scheduled_calls: Vec<ScheduledCall>,
    pub last_call_date: Option<NaiveDate>,
    pub next_call_date: Option<NaiveDate>,
    
    // Status
    pub plan_status: MaintenancePlanStatus,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MaintenanceStrategy {
    TimeBasedSingleCycle,      // 01 - Time-based, single cycle
    TimeBasedMultipleCycle,    // 02 - Time-based, strategy plan
    PerformanceBased,          // 03 - Performance-based (running hours)
    ConditionBased,            // 04 - Condition-based monitoring
    PredictiveMaintenance,     // 05 - Predictive using IoT/AI
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SchedulingIndicator {
    TimeBased,             // 1 - Time-based
    FactoryCalendar,       // 2 - Factory calendar
    PerformanceBased,      // 3 - Performance-based (meter reading)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CycleUnit {
    Days,
    Weeks,
    Months,
    Years,
    OperatingHours,
    ProductionQuantity,
    Kilometers,
}

pub struct ScheduledCall {
    pub call_id: Uuid,
    pub call_number: u32,
    pub planned_date: NaiveDate,
    pub planned_start: NaiveDateTime,
    pub planned_finish: NaiveDateTime,
    pub call_status: CallStatus,
    pub work_order_id: Option<Uuid>,
    pub work_order_number: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CallStatus {
    Planned,
    OrderCreated,
    Released,
    InProgress,
    Completed,
    Cancelled,
}
```

#### 9.1.3 维护工单 (Maintenance Order)

```rust
pub struct MaintenanceOrder {
    pub order_id: Uuid,
    pub order_number: String,          // Format: MO-2025-000001
    pub order_type: MaintenanceOrderType,
    pub priority: MaintenancePriority,
    
    // Object Reference
    pub equipment_id: Option<Uuid>,
    pub equipment_number: Option<String>,
    pub functional_location: Option<String>,
    
    // Description
    pub short_text: String,
    pub long_text: Option<String>,
    pub malfunction_start: Option<NaiveDateTime>,
    pub malfunction_end: Option<NaiveDateTime>,
    
    // Organizational Data
    pub plant: Plant,
    pub maintenance_plant: Plant,
    pub planner_group: PlannerGroup,
    pub main_work_center: WorkCenter,
    pub cost_center: CostCenter,
    
    // Planning
    pub system_condition: Option<SystemCondition>,
    pub scheduling_type: SchedulingType,
    pub basic_start_date: NaiveDate,
    pub basic_finish_date: NaiveDate,
    pub scheduled_start_date: NaiveDateTime,
    pub scheduled_finish_date: NaiveDateTime,
    pub actual_start_date: Option<NaiveDateTime>,
    pub actual_finish_date: Option<NaiveDateTime>,
    
    // Operations
    pub operations: Vec<MaintenanceOperation>,
    
    // Materials/Components
    pub components: Vec<MaintenanceComponent>,
    
    // Costs
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub variance: Decimal,
    
    // Status
    pub system_status: MaintenanceOrderStatus,
    pub user_status: Option<UserStatus>,
    
    // References
    pub notification_id: Option<Uuid>,
    pub maintenance_plan_id: Option<Uuid>,
    pub maintenance_plan_call: Option<String>,
    
    // Settlement
    pub settlement_rule: Option<SettlementRule>,
    pub settled: bool,
    pub settlement_date: Option<NaiveDate>,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub released_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MaintenanceOrderType {
    BreakdownMaintenance,      // PM01 - Corrective maintenance
    PreventiveMaintenance,     // PM02 - Preventive maintenance
    PredictiveMaintenance,     // PM03 - Predictive maintenance
    Inspection,               // PM04 - Inspection
    Calibration,              // PM05 - Calibration
    Overhaul,                 // PM06 - Overhaul/refurbishment
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MaintenancePriority {
    VeryHigh,      // 1 - Immediate action required
    High,          // 2 - Urgent
    Medium,        // 3 - Normal
    Low,           // 4 - Can be scheduled
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SystemCondition {
    EquipmentDown,         // Equipment must be shut down
    EquipmentRunning,      // Can perform while running
    ProductionShutdown,    // Requires production line shutdown
}

pub struct MaintenanceOperation {
    pub operation_id: Uuid,
    pub operation_number: String,
    pub control_key: ControlKey,
    pub description: String,
    pub work_center: WorkCenter,
    
    // Work
    pub work_duration: Duration,
    pub number_of_capacities: u16,
    pub actual_work_duration: Option<Duration>,
    
    // Schedule
    pub earliest_start: NaiveDateTime,
    pub latest_finish: NaiveDateTime,
    pub actual_start: Option<NaiveDateTime>,
    pub actual_finish: Option<NaiveDateTime>,
    
    // Confirmation
    pub confirmations: Vec<OperationConfirmation>,
    pub operation_status: OperationStatus,
    
    // Personnel
    pub required_personnel: Vec<PersonnelRequirement>,
    pub assigned_personnel: Vec<UserId>,
    
    // Activity Type (for costing)
    pub activity_type: Option<String>,
}

pub struct PersonnelRequirement {
    pub qualification: String,
    pub number_required: u16,
    pub work_duration: Duration,
}

pub struct MaintenanceComponent {
    pub component_id: Uuid,
    pub item_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub material_description: String,
    
    // Requirement
    pub requirement_quantity: Decimal,
    pub requirement_date: NaiveDate,
    pub unit: Unit,
    
    // Withdrawal
    pub withdrawn_quantity: Decimal,
    pub return_quantity: Decimal,
    
    // Location
    pub plant: Plant,
    pub storage_location: StorageLocation,
    pub batch: Option<String>,
    
    // Item Category
    pub item_category: ItemCategory,
    pub component_type: ComponentType,
    
    // Reservation
    pub reservation_number: Option<String>,
    
    // Status
    pub goods_movement_status: GoodsMovementStatus,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ComponentType {
    SparePart,
    ConsumableMaterial,
    Tool,
    Service,
}
```

#### 9.1.4 维护通知 (Maintenance Notification)

```rust
pub struct MaintenanceNotification {
    pub notification_id: Uuid,
    pub notification_number: String,   // Format: MN-2025-000001
    pub notification_type: MaintenanceNotificationType,
    pub priority: MaintenancePriority,
    
    // Object Reference
    pub equipment_id: Option<Uuid>,
    pub equipment_number: Option<String>,
    pub functional_location: Option<String>,
    
    // Description
    pub short_text: String,
    pub long_text: Option<String>,
    
    // Malfunction Details
    pub malfunction_start: Option<NaiveDateTime>,
    pub malfunction_end: Option<NaiveDateTime>,
    pub breakdown: bool,
    pub effect: Option<MalfunctionEffect>,
    
    // Damage
    pub damage_code: Option<DamageCode>,
    pub cause_code: Option<CauseCode>,
    pub object_part: Option<ObjectPart>,
    pub damage_text: Option<String>,
    
    // Items (for multi-item notifications)
    pub items: Vec<NotificationItem>,
    
    // Tasks
    pub tasks: Vec<MaintenanceTask>,
    
    // Organizational Data
    pub plant: Plant,
    pub planner_group: PlannerGroup,
    pub reported_by: UserId,
    pub responsible_person: Option<UserId>,
    
    // Dates
    pub required_start_date: Option<NaiveDate>,
    pub required_end_date: Option<NaiveDate>,
    
    // Work Order
    pub work_order_created: bool,
    pub work_order_id: Option<Uuid>,
    pub work_order_number: Option<String>,
    
    // Status
    pub notification_status: NotificationStatus,
    
    // Completion
    pub completion_text: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub completed_by: Option<UserId>,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MaintenanceNotificationType {
    MalfunctionReport,     // M1 - Malfunction/problem report
    MaintenanceRequest,    // M2 - Maintenance request
    ActivityReport,        // M3 - Activity/work completion report
    InspectionReport,      // M4 - Inspection report
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MalfunctionEffect {
    EquipmentDown,
    PerformanceDegraded,
    QualityIssue,
    SafetyRisk,
    MinorIssue,
}

pub struct NotificationItem {
    pub item_id: Uuid,
    pub item_number: u16,
    pub object_part: ObjectPart,
    pub damage_code: DamageCode,
    pub cause_code: Option<CauseCode>,
    pub item_text: String,
    pub start_date: Option<NaiveDateTime>,
    pub end_date: Option<NaiveDateTime>,
}

pub struct MaintenanceTask {
    pub task_id: Uuid,
    pub task_code: String,
    pub task_text: String,
    pub responsible_person: Option<UserId>,
    pub planned_start: Option<NaiveDate>,
    pub planned_finish: Option<NaiveDate>,
    pub actual_start: Option<NaiveDate>,
    pub actual_finish: Option<NaiveDate>,
    pub task_status: TaskStatus,
    pub completion_note: Option<String>,
}

pub struct DamageCode {
    pub code_group: String,
    pub code: String,
    pub description: String,
}

pub struct CauseCode {
    pub code_group: String,
    pub code: String,
    pub description: String,
}

pub struct ObjectPart {
    pub part_code: String,
    pub part_description: String,
}
```

### 9.2 API 规格

#### 9.2.1 设备管理 API

```rust
// POST /api/v1/maintenance/equipment
pub struct CreateEquipmentRequest {
    pub equipment_category: String,
    pub description: String,
    pub plant: String,
    pub maintenance_plant: String,
    pub planner_group: String,
    pub work_center: String,
    pub cost_center: String,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub serial_number: Option<String>,
    pub functional_location: Option<String>,
    pub superior_equipment: Option<String>,
}

pub struct CreateEquipmentResponse {
    pub equipment_id: Uuid,
    pub equipment_number: String,
    pub description: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// PUT /api/v1/maintenance/equipment/{equipment_id}/status
pub struct UpdateEquipmentStatusRequest {
    pub availability_status: String,
    pub reason: Option<String>,
}

// POST /api/v1/maintenance/equipment/{equipment_id}/meter-reading
pub struct RecordMeterReadingRequest {
    pub reading_date: NaiveDateTime,
    pub meter_type: String,           // Operating hours, production count, km
    pub reading_value: Decimal,
    pub recorded_by: Uuid,
}

// GET /api/v1/maintenance/equipment/{equipment_id}/history
pub struct GetEquipmentHistoryQuery {
    pub history_type: Option<String>, // Maintenance, Breakdowns, All
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

pub struct GetEquipmentHistoryResponse {
    pub equipment_number: String,
    pub equipment_description: String,
    pub history_entries: Vec<EquipmentHistoryEntry>,
    pub statistics: EquipmentStatistics,
}

pub struct EquipmentStatistics {
    pub total_operating_hours: Decimal,
    pub total_downtime_hours: Decimal,
    pub number_of_breakdowns: u32,
    pub mtbf: Decimal,
    pub mttr: Decimal,
    pub availability_percentage: Decimal,
}
```

#### 9.2.2 维护计划 API

```rust
// POST /api/v1/maintenance/maintenance-plans
pub struct CreateMaintenancePlanRequest {
    pub maintenance_strategy: String,
    pub object_type: String,          // Equipment, FunctionalLocation
    pub object_id: Uuid,
    pub scheduling_indicator: String,
    pub cycle_unit: String,
    pub cycle_length: Decimal,
    pub cycle_start_date: NaiveDate,
    pub task_list_group: String,
    pub order_type: String,
    pub priority: String,
    pub work_center: String,
    pub planner_group: String,
    pub call_horizon: u16,
}

pub struct CreateMaintenancePlanResponse {
    pub plan_id: Uuid,
    pub plan_number: String,
    pub next_call_date: NaiveDate,
    pub scheduled_calls_count: u32,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/maintenance/maintenance-plans/{plan_id}/schedule
pub struct ScheduleMaintenancePlanRequest {
    pub scheduling_period_from: NaiveDate,
    pub scheduling_period_to: NaiveDate,
    pub immediate_call: bool,
}

pub struct ScheduleMaintenancePlanResponse {
    pub plan_id: Uuid,
    pub plan_number: String,
    pub calls_scheduled: Vec<ScheduledCallSummary>,
    pub next_call_date: NaiveDate,
}

pub struct ScheduledCallSummary {
    pub call_number: u32,
    pub planned_date: NaiveDate,
    pub work_order_created: bool,
    pub work_order_number: Option<String>,
}

// POST /api/v1/maintenance/maintenance-plans/{plan_id}/generate-orders
pub struct GenerateMaintenanceOrdersRequest {
    pub call_numbers: Option<Vec<u32>>, // Specific calls, or all if None
}

pub struct GenerateMaintenanceOrdersResponse {
    pub plan_id: Uuid,
    pub orders_generated: Vec<GeneratedOrderSummary>,
}

pub struct GeneratedOrderSummary {
    pub order_id: Uuid,
    pub order_number: String,
    pub call_number: u32,
    pub planned_start: NaiveDateTime,
    pub planned_finish: NaiveDateTime,
}
```

#### 9.2.3 维护工单 API

```rust
// POST /api/v1/maintenance/maintenance-orders
pub struct CreateMaintenanceOrderRequest {
    pub order_type: String,
    pub priority: String,
    pub short_text: String,
    pub equipment_id: Option<Uuid>,
    pub functional_location: Option<String>,
    pub plant: String,
    pub planner_group: String,
    pub work_center: String,
    pub basic_start_date: NaiveDate,
    pub basic_finish_date: NaiveDate,
    pub notification_id: Option<Uuid>,
}

pub struct CreateMaintenanceOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub equipment_number: Option<String>,
    pub scheduled_start: NaiveDateTime,
    pub scheduled_finish: NaiveDateTime,
    pub operations: Vec<OperationSummary>,
    pub components: Vec<ComponentRequirement>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/maintenance/maintenance-orders/{order_id}/release
pub struct ReleaseMaintenanceOrderRequest {
    pub release_type: String,         // Full, Operations, Materials
}

// POST /api/v1/maintenance/maintenance-orders/{order_id}/operations/{operation_id}/confirm
pub struct ConfirmMaintenanceOperationRequest {
    pub confirmation_date: NaiveDateTime,
    pub actual_work_duration: String, // Duration string
    pub work_performed: String,
    pub final_confirmation: bool,
    pub assigned_personnel: Vec<Uuid>,
}

// POST /api/v1/maintenance/maintenance-orders/{order_id}/complete
pub struct CompleteMaintenanceOrderRequest {
    pub completion_date: NaiveDateTime,
    pub completion_note: Option<String>,
    pub equipment_status_after: Option<String>,
}

pub struct CompleteMaintenanceOrderResponse {
    pub order_id: Uuid,
    pub order_number: String,
    pub actual_costs: Decimal,
    pub variance: Decimal,
    pub completed_at: DateTime<Utc>,
}

// GET /api/v1/maintenance/maintenance-orders
pub struct ListMaintenanceOrdersQuery {
    pub plant: Option<String>,
    pub equipment_id: Option<Uuid>,
    pub order_type: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub planner_group: Option<String>,
    pub start_date_from: Option<NaiveDate>,
    pub start_date_to: Option<NaiveDate>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}
```

#### 9.2.4 维护通知 API

```rust
// POST /api/v1/maintenance/notifications
pub struct CreateMaintenanceNotificationRequest {
    pub notification_type: String,
    pub priority: String,
    pub short_text: String,
    pub long_text: Option<String>,
    pub equipment_id: Option<Uuid>,
    pub functional_location: Option<String>,
    pub breakdown: bool,
    pub malfunction_start: Option<NaiveDateTime>,
    pub effect: Option<String>,
    pub damage_code: Option<String>,
    pub cause_code: Option<String>,
}

pub struct CreateMaintenanceNotificationResponse {
    pub notification_id: Uuid,
    pub notification_number: String,
    pub equipment_number: Option<String>,
    pub priority: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/maintenance/notifications/{notification_id}/create-order
pub struct CreateOrderFromNotificationRequest {
    pub order_type: String,
    pub planned_start: NaiveDate,
    pub planned_finish: NaiveDate,
}

pub struct CreateOrderFromNotificationResponse {
    pub notification_id: Uuid,
    pub order_id: Uuid,
    pub order_number: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/maintenance/notifications/{notification_id}/complete
pub struct CompleteNotificationRequest {
    pub completion_text: String,
    pub malfunction_end: Option<NaiveDateTime>,
}
```

### 9.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaintenanceDomainEvent {
    EquipmentCreated(EquipmentCreated),
    EquipmentStatusChanged(EquipmentStatusChanged),
    EquipmentBreakdown(EquipmentBreakdown),
    MaintenancePlanCreated(MaintenancePlanCreated),
    MaintenanceCallScheduled(MaintenanceCallScheduled),
    MaintenanceOrderCreated(MaintenanceOrderCreated),
    MaintenanceOrderReleased(MaintenanceOrderReleased),
    MaintenanceOperationConfirmed(MaintenanceOperationConfirmed),
    MaintenanceOrderCompleted(MaintenanceOrderCompleted),
    MaintenanceNotificationCreated(MaintenanceNotificationCreated),
    MeterReadingRecorded(MeterReadingRecorded),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquipmentBreakdown {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub equipment_id: Uuid,
    pub equipment_number: String,
    pub equipment_description: String,
    pub breakdown_start: NaiveDateTime,
    pub plant: String,
    pub functional_location: Option<String>,
    pub notification_id: Option<Uuid>,
    pub notification_number: Option<String>,
    pub reported_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceOrderCompleted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub order_id: Uuid,
    pub order_number: String,
    pub order_type: String,
    pub equipment_id: Option<Uuid>,
    pub equipment_number: Option<String>,
    pub actual_start: NaiveDateTime,
    pub actual_finish: NaiveDateTime,
    pub total_duration_hours: Decimal,
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub variance: Decimal,
    pub work_performed: String,
    pub equipment_status_after: Option<String>,
    pub completed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeterReadingRecorded {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub equipment_id: Uuid,
    pub equipment_number: String,
    pub reading_date: NaiveDateTime,
    pub meter_type: String,
    pub reading_value: Decimal,
    pub previous_reading_value: Option<Decimal>,
    pub increment: Option<Decimal>,
    pub recorded_by: String,
}
```

---

## 第十部分：项目系统模块 (PS - Project System)

### 10.1 数据模型

#### 10.1.1 项目定义 (Project Definition)

```rust
pub struct Project {
    pub project_id: Uuid,
    pub project_number: String,        // Format: PRJ-2025-000001
    pub project_profile: ProjectProfile,
    
    // Description
    pub project_name: String,
    pub project_description: String,
    pub project_type: ProjectType,
    
    // Organizational Data
    pub company_code: CompanyCode,
    pub controlling_area: ControllingArea,
    pub plant: Option<Plant>,
    pub business_area: Option<BusinessArea>,
    
    // Responsible Persons
    pub project_manager: UserId,
    pub applicant: Option<UserId>,
    pub person_responsible: Option<UserId>,
    
    // Dates
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub actual_start_date: Option<NaiveDate>,
    pub actual_finish_date: Option<NaiveDate>,
    
    // Budget
    pub original_budget: Money,
    pub current_budget: Money,
    pub budget_currency: Currency,
    
    // Work Breakdown Structure
    pub wbs_elements: Vec<WbsElement>,
    
    // Networks (activities)
    pub networks: Vec<Network>,
    
    // Status
    pub system_status: ProjectStatus,
    pub user_status: Option<UserStatus>,
    
    // Progress
    pub progress_percentage: Decimal,
    pub milestone_status: Vec<MilestoneStatus>,
    
    // Financials
    pub planned_costs: Money,
    pub actual_costs: Money,
    pub committed_costs: Money,
    pub planned_revenue: Money,
    pub actual_revenue: Money,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProjectType {
    InternalProject,       // Internal development/improvement
    CustomerProject,       // Project for external customer
    CapitalInvestment,     // Capital investment project
    R&D,                  // Research & development
    MaintenanceProject,    // Major maintenance/shutdown
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProjectStatus {
    Created,
    Released,
    InProgress,
    Completed,
    Closed,
    Cancelled,
}
```

#### 10.1.2 工作分解结构 (WBS - Work Breakdown Structure)

```rust
pub struct WbsElement {
    pub wbs_id: Uuid,
    pub wbs_element_code: String,      // Format: PRJ-2025-0001.1.1
    pub project_id: Uuid,
    
    // Description
    pub description: String,
    pub long_text: Option<String>,
    
    // Hierarchy
    pub level: u8,
    pub superior_wbs: Option<String>,
    pub left_number: u32,              // For hierarchical queries
    pub right_number: u32,
    
    // Type
    pub wbs_type: WbsType,
    pub account_assignment_element: bool,
    pub billing_element: bool,
    pub planning_element: bool,
    
    // Organizational Data
    pub company_code: CompanyCode,
    pub cost_center: Option<CostCenter>,
    pub profit_center: Option<ProfitCenter>,
    pub responsible_person: UserId,
    
    // Dates
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub scheduled_start: Option<NaiveDate>,
    pub scheduled_finish: Option<NaiveDate>,
    pub actual_start: Option<NaiveDate>,
    pub actual_finish: Option<NaiveDate>,
    
    // Budget
    pub budget: Money,
    pub budget_type: BudgetType,
    
    // Planning
    pub planned_costs: Money,
    pub planned_revenue: Option<Money>,
    
    // Actuals
    pub actual_costs: Money,
    pub committed_costs: Money,
    pub actual_revenue: Money,
    pub invoiced_revenue: Money,
    
    // Progress
    pub progress_percentage: Decimal,
    pub earned_value: Option<Money>,
    
    // Status
    pub wbs_status: WbsStatus,
    
    // Statistical Key Figures
    pub key_figures: HashMap<String, Decimal>,
    
    // Children
    pub child_wbs_elements: Vec<String>,
    pub activities: Vec<String>,        // Network activities assigned
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WbsType {
    Phase,
    Deliverable,
    Task,
    Milestone,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BudgetType {
    Overall,           // Overall budget for element
    Annual,           // Annual budget
    Period,           // Period-specific budget
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WbsStatus {
    Created,
    Released,
    InProgress,
    Completed,
    TechnicallyCompleted,
    Closed,
}
```

#### 10.1.3 网络活动 (Network & Activities)

```rust
pub struct Network {
    pub network_id: Uuid,
    pub network_number: String,        // Format: NET-2025-000001
    pub network_type: NetworkType,
    pub project_id: Uuid,
    
    // Description
    pub description: String,
    pub long_text: Option<String>,
    
    // Organizational Data
    pub company_code: CompanyCode,
    pub plant: Plant,
    pub planner_group: PlannerGroup,
    pub responsible_person: UserId,
    
    // WBS Assignment
    pub wbs_element: Option<String>,
    
    // Dates
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub scheduled_start: NaiveDateTime,
    pub scheduled_finish: NaiveDateTime,
    
    // Scheduling
    pub scheduling_type: SchedulingType,
    pub network_profile: NetworkProfile,
    
    // Activities
    pub activities: Vec<Activity>,
    
    // Relationships
    pub relationships: Vec<ActivityRelationship>,
    
    // Critical Path
    pub critical_path: Vec<String>,    // Activity numbers on critical path
    
    // Status
    pub network_status: NetworkStatus,
    
    // Costs
    pub planned_costs: Money,
    pub actual_costs: Money,
}

pub struct Activity {
    pub activity_id: Uuid,
    pub activity_number: String,
    pub network_id: Uuid,
    pub control_key: ControlKey,
    
    // Description
    pub description: String,
    pub long_text: Option<String>,
    pub activity_type: ActivityType,
    
    // Work Center
    pub work_center: Option<WorkCenter>,
    pub work: Duration,
    pub number_of_capacities: u16,
    
    // Dates
    pub earliest_start: NaiveDateTime,
    pub earliest_finish: NaiveDateTime,
    pub latest_start: NaiveDateTime,
    pub latest_finish: NaiveDateTime,
    pub scheduled_start: NaiveDateTime,
    pub scheduled_finish: NaiveDateTime,
    pub actual_start: Option<NaiveDateTime>,
    pub actual_finish: Option<NaiveDateTime>,
    
    // Float
    pub total_float: Duration,
    pub free_float: Duration,
    pub on_critical_path: bool,
    
    // Costs
    pub planned_activity_costs: Money,
    pub actual_activity_costs: Money,
    
    // Account Assignment
    pub wbs_element: Option<String>,
    pub cost_center: Option<CostCenter>,
    
    // Materials
    pub material_components: Vec<ActivityComponent>,
    
    // Progress
    pub progress_percentage: Decimal,
    
    // Confirmations
    pub confirmations: Vec<ActivityConfirmation>,
    
    // Status
    pub activity_status: ActivityStatus,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActivityType {
    InternalProcessing,
    ExternalProcessing,
    ServiceActivity,
    Milestone,
    WaitingTime,
}

pub struct ActivityRelationship {
    pub relationship_id: Uuid,
    pub predecessor_activity: String,
    pub successor_activity: String,
    pub relationship_type: RelationshipType,
    pub lag_time: Duration,           // Can be negative for lead time
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RelationshipType {
    FinishToStart,     // FS - Predecessor must finish before successor starts
    StartToStart,      // SS - Successor can start when predecessor starts
    FinishToFinish,    // FF - Successor finishes when predecessor finishes
    StartToFinish,     // SF - Successor finishes when predecessor starts
}

pub struct ActivityComponent {
    pub component_id: Uuid,
    pub item_number: String,
    pub material_id: Uuid,
    pub material_number: String,
    pub requirement_quantity: Decimal,
    pub unit: Unit,
    pub plant: Plant,
    pub storage_location: Option<StorageLocation>,
    pub requirement_date: NaiveDate,
    pub reservation_number: Option<String>,
}

pub struct ActivityConfirmation {
    pub confirmation_id: Uuid,
    pub confirmation_date: NaiveDate,
    pub actual_work: Duration,
    pub progress_percentage: Decimal,
    pub remaining_work: Duration,
    pub confirmed_by: UserId,
}
```

#### 10.1.4 项目预算与控制 (Project Budget)

```rust
pub struct ProjectBudget {
    pub budget_id: Uuid,
    pub project_id: Uuid,
    pub wbs_element: Option<String>,
    pub fiscal_year: u16,
    
    // Budget Types
    pub original_budget: Money,
    pub supplements: Vec<BudgetSupplement>,
    pub returns: Vec<BudgetReturn>,
    pub current_budget: Money,
    
    // Distribution
    pub annual_distribution: Vec<AnnualBudget>,
    pub period_distribution: Vec<PeriodBudget>,
    
    // Budget Profile
    pub budget_profile: BudgetProfile,
    pub tolerance_limits: ToleranceLimits,
    pub budget_control_active: bool,
    
    // Status
    pub budget_status: BudgetStatus,
    
    // Approval
    pub approval_required: bool,
    pub approved_by: Option<UserId>,
    pub approved_at: Option<DateTime<Utc>>,
}

pub struct BudgetSupplement {
    pub supplement_id: Uuid,
    pub amount: Money,
    pub reason: String,
    pub approval_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct BudgetReturn {
    pub return_id: Uuid,
    pub amount: Money,
    pub reason: String,
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

pub struct AnnualBudget {
    pub fiscal_year: u16,
    pub budget_amount: Money,
}

pub struct PeriodBudget {
    pub fiscal_year: u16,
    pub period: u8,
    pub budget_amount: Money,
}

pub struct ToleranceLimits {
    pub lower_warning_limit: Decimal,  // Percentage
    pub upper_warning_limit: Decimal,
    pub lower_error_limit: Decimal,
    pub upper_error_limit: Decimal,
}
```

### 10.2 API 规格

```rust
// POST /api/v1/projects/projects
pub struct CreateProjectRequest {
    pub project_name: String,
    pub project_description: String,
    pub project_type: String,
    pub company_code: String,
    pub project_manager: Uuid,
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub original_budget: Decimal,
    pub currency: String,
}

pub struct CreateProjectResponse {
    pub project_id: Uuid,
    pub project_number: String,
    pub project_name: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// POST /api/v1/projects/projects/{project_id}/wbs-elements
pub struct CreateWbsElementRequest {
    pub description: String,
    pub superior_wbs: Option<String>,
    pub wbs_type: String,
    pub responsible_person: Uuid,
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub budget: Option<Decimal>,
    pub account_assignment_element: bool,
}

// POST /api/v1/projects/networks
pub struct CreateNetworkRequest {
    pub description: String,
    pub project_id: Uuid,
    pub wbs_element: Option<String>,
    pub plant: String,
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub activities: Vec<CreateActivityRequest>,
    pub relationships: Vec<CreateRelationshipRequest>,
}

pub struct CreateActivityRequest {
    pub activity_number: String,
    pub description: String,
    pub activity_type: String,
    pub work_duration: String,       // Duration
    pub work_center: Option<String>,
    pub wbs_element: Option<String>,
}

pub struct CreateRelationshipRequest {
    pub predecessor_activity: String,
    pub successor_activity: String,
    pub relationship_type: String,
    pub lag_time: Option<String>,    // Duration
}

// POST /api/v1/projects/networks/{network_id}/schedule
pub struct ScheduleNetworkRequest {
    pub scheduling_type: String,     // Forward, Backward
    pub scheduling_date: NaiveDate,
}

pub struct ScheduleNetworkResponse {
    pub network_id: Uuid,
    pub network_number: String,
    pub scheduled_start: NaiveDateTime,
    pub scheduled_finish: NaiveDateTime,
    pub critical_path: Vec<CriticalPathActivity>,
    pub total_duration_days: Decimal,
}

pub struct CriticalPathActivity {
    pub activity_number: String,
    pub description: String,
    pub scheduled_start: NaiveDateTime,
    pub scheduled_finish: NaiveDateTime,
    pub duration: String,
}

// POST /api/v1/projects/activities/{activity_id}/confirm
pub struct ConfirmActivityRequest {
    pub confirmation_date: NaiveDate,
    pub actual_work: String,         // Duration
    pub progress_percentage: Decimal,
    pub remaining_work: Option<String>,
}

// GET /api/v1/projects/projects/{project_id}/financials
pub struct GetProjectFinancialsResponse {
    pub project_number: String,
    pub project_name: String,
    pub currency: String,
    pub budget_data: BudgetData,
    pub cost_data: CostData,
    pub revenue_data: RevenueData,
    pub earned_value_analysis: EarnedValueAnalysis,
}

pub struct BudgetData {
    pub original_budget: Decimal,
    pub current_budget: Decimal,
    pub budget_supplements: Decimal,
    pub budget_returns: Decimal,
}

pub struct CostData {
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub committed_costs: Decimal,
    pub total_costs: Decimal,
    pub cost_variance: Decimal,
    pub cost_variance_percentage: Decimal,
}

pub struct RevenueData {
    pub planned_revenue: Decimal,
    pub actual_revenue: Decimal,
    pub invoiced_revenue: Decimal,
    pub unbilled_revenue: Decimal,
}

pub struct EarnedValueAnalysis {
    pub planned_value: Decimal,        // PV - Planned Value
    pub earned_value: Decimal,         // EV - Earned Value
    pub actual_cost: Decimal,          // AC - Actual Cost
    pub cost_variance: Decimal,        // CV = EV - AC
    pub schedule_variance: Decimal,    // SV = EV - PV
    pub cost_performance_index: Decimal,    // CPI = EV / AC
    pub schedule_performance_index: Decimal, // SPI = EV / PV
    pub estimate_at_completion: Decimal,    // EAC
    pub estimate_to_complete: Decimal,      // ETC
    pub variance_at_completion: Decimal,    // VAC
}
```

### 10.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectDomainEvent {
    ProjectCreated(ProjectCreated),
    ProjectStatusChanged(ProjectStatusChanged),
    WbsElementCreated(WbsElementCreated),
    NetworkCreated(NetworkCreated),
    ActivityConfirmed(ActivityConfirmed),
    ProjectMilestoneReached(ProjectMilestoneReached),
    ProjectBudgetExceeded(ProjectBudgetExceeded),
    ProjectCompleted(ProjectCompleted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCreated {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub project_id: Uuid,
    pub project_number: String,
    pub project_name: String,
    pub project_type: String,
    pub project_manager: String,
    pub start_date: NaiveDate,
    pub finish_date: NaiveDate,
    pub original_budget: Decimal,
    pub currency: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectBudgetExceeded {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub project_id: Uuid,
    pub project_number: String,
    pub wbs_element: Option<String>,
    pub current_budget: Decimal,
    pub actual_costs: Decimal,
    pub committed_costs: Decimal,
    pub total_costs: Decimal,
    pub budget_utilization_percentage: Decimal,
    pub exceeded_by: Decimal,
}
```

文档将继续补充 HCM, TR, BW/BI 模块...

## 第十一部分：人力资源管理模块 (HCM - Human Capital Management)

### 11.1 数据模型

#### 11.1.1 员工主数据 (Employee Master Data)

```rust
pub struct Employee {
    pub employee_id: Uuid,
    pub employee_number: String,       // Format: EMP-000001
    pub personnel_number: String,      // Legacy/external system number
    
    // Personal Information
    pub personal_data: PersonalData,
    
    // Employment Data
    pub organizational_assignment: OrganizationalAssignment,
    pub employment_details: EmploymentDetails,
    
    // Compensation
    pub compensation_data: CompensationData,
    
    // Time Management
    pub work_schedule: WorkSchedule,
    pub time_recording_profile: TimeRecordingProfile,
    
    // Payroll
    pub payroll_area: PayrollArea,
    pub payment_method: PaymentMethod,
    pub bank_details: Vec<EmployeeBankAccount>,
    
    // Tax & Social Security
    pub tax_data: TaxData,
    pub social_security_data: SocialSecurityData,
    
    // Absence Entitlements
    pub leave_entitlements: Vec<LeaveEntitlement>,
    
    // Qualifications & Skills
    pub qualifications: Vec<Qualification>,
    pub competencies: Vec<Competency>,
    
    // Status
    pub employment_status: EmploymentStatus,
    pub action_type: Option<ActionType>,  // Hire, Termination, Transfer, etc.
    pub action_reason: Option<String>,
    
    // Dates
    pub hire_date: NaiveDate,
    pub seniority_date: Option<NaiveDate>,
    pub probation_end_date: Option<NaiveDate>,
    pub termination_date: Option<NaiveDate>,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
    pub last_changed_at: DateTime<Utc>,
}

pub struct PersonalData {
    pub first_name: String,
    pub last_name: String,
    pub middle_name: Option<String>,
    pub preferred_name: Option<String>,
    pub title: Option<String>,
    pub gender: Gender,
    pub date_of_birth: NaiveDate,
    pub place_of_birth: Option<String>,
    pub nationality: Country,
    pub marital_status: MaritalStatus,
    pub number_of_children: Option<u8>,
    
    // Contact
    pub personal_email: Option<String>,
    pub mobile_phone: Option<String>,
    pub home_phone: Option<String>,
    pub emergency_contact: Option<EmergencyContact>,
    
    // Address
    pub home_address: Address,
}

pub struct OrganizationalAssignment {
    pub company_code: CompanyCode,
    pub personnel_area: PersonnelArea,
    pub personnel_subarea: PersonnelSubarea,
    pub organizational_unit: OrganizationalUnit,
    pub department: Department,
    pub cost_center: CostCenter,
    pub position: Position,
    pub job: Job,
    pub manager: Option<Uuid>,          // Reports to
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
}

pub struct EmploymentDetails {
    pub employee_group: EmployeeGroup,   // Active, retiree, etc.
    pub employee_subgroup: EmployeeSubgroup, // Full-time, part-time, contractor
    pub contract_type: ContractType,
    pub employment_percentage: Decimal,
    pub probation_period_months: Option<u8>,
    pub notice_period_days: u16,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EmployeeGroup {
    Active,
    Retiree,
    Pensioner,
    External,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EmployeeSubgroup {
    FullTime,
    PartTime,
    Contractor,
    Intern,
    Temporary,
}

pub struct CompensationData {
    pub basic_pay: BasicPay,
    pub allowances: Vec<Allowance>,
    pub bonuses: Vec<Bonus>,
    pub total_annual_compensation: Money,
}

pub struct BasicPay {
    pub pay_scale_type: PayScaleType,
    pub pay_scale_area: String,
    pub pay_scale_group: String,
    pub pay_scale_level: String,
    pub annual_salary: Money,
    pub hourly_rate: Option<Money>,
    pub currency: Currency,
    pub effective_date: NaiveDate,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PayScaleType {
    MonthlySalary,
    HourlyWage,
    DailyWage,
    PieceRate,
    Commission,
}

pub struct Allowance {
    pub allowance_type: String,        // Housing, transport, meal, etc.
    pub amount: Money,
    pub frequency: PaymentFrequency,
    pub taxable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PaymentFrequency {
    Monthly,
    BiWeekly,
    Weekly,
    Daily,
    OneTime,
}

pub struct WorkSchedule {
    pub work_schedule_rule: String,
    pub weekly_working_hours: Decimal,
    pub daily_working_hours: Decimal,
    pub working_days_per_week: Decimal,
    pub shift_group: Option<String>,
}

pub struct LeaveEntitlement {
    pub leave_type: LeaveType,
    pub entitlement_days: Decimal,
    pub used_days: Decimal,
    pub remaining_days: Decimal,
    pub validity_start: NaiveDate,
    pub validity_end: NaiveDate,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LeaveType {
    AnnualLeave,
    SickLeave,
    MaternityLeave,
    PaternityLeave,
    UnpaidLeave,
    StudyLeave,
    Sabbatical,
}

pub struct Qualification {
    pub qualification_id: Uuid,
    pub qualification_type: String,
    pub qualification_name: String,
    pub institution: Option<String>,
    pub obtained_date: NaiveDate,
    pub expiry_date: Option<NaiveDate>,
    pub certificate_number: Option<String>,
}

pub struct Competency {
    pub competency_id: Uuid,
    pub competency_type: String,
    pub competency_name: String,
    pub proficiency_level: ProficiencyLevel,
    pub years_of_experience: Option<Decimal>,
    pub last_used_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProficiencyLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}
```

#### 11.1.2 考勤管理 (Time & Attendance)

```rust
pub struct TimeRecord {
    pub record_id: Uuid,
    pub employee_id: Uuid,
    pub employee_number: String,
    pub recording_date: NaiveDate,
    
    // Clock In/Out
    pub clock_in: Option<NaiveDateTime>,
    pub clock_out: Option<NaiveDateTime>,
    
    // Time Type
    pub time_type: TimeType,
    pub hours: Decimal,
    
    // Break
    pub break_hours: Decimal,
    
    // Calculated Times
    pub regular_hours: Decimal,
    pub overtime_hours: Decimal,
    pub night_shift_hours: Decimal,
    pub weekend_hours: Decimal,
    pub holiday_hours: Decimal,
    
    // Cost Assignment
    pub cost_center: Option<CostCenter>,
    pub internal_order: Option<String>,
    pub wbs_element: Option<String>,
    pub activity_type: Option<String>,
    
    // Approval
    pub approval_status: ApprovalStatus,
    pub approved_by: Option<UserId>,
    pub approved_at: Option<DateTime<Utc>>,
    
    // Status
    pub record_status: TimeRecordStatus,
    pub payroll_relevant: bool,
    pub transferred_to_payroll: bool,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TimeType {
    WorkingTime,
    Overtime,
    OnCall,
    Travel,
    Training,
}

pub struct AbsenceRecord {
    pub absence_id: Uuid,
    pub employee_id: Uuid,
    pub employee_number: String,
    
    // Absence Details
    pub absence_type: AbsenceType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub absence_days: Decimal,
    pub absence_hours: Decimal,
    
    // Reason
    pub reason: Option<String>,
    pub attachment: Option<String>,      // Medical certificate, etc.
    
    // Leave Quota Deduction
    pub deduct_from_quota: bool,
    pub quota_deducted: Decimal,
    
    // Approval
    pub approval_required: bool,
    pub approval_status: ApprovalStatus,
    pub approved_by: Option<UserId>,
    pub approved_at: Option<DateTime<Utc>>,
    
    // Status
    pub absence_status: AbsenceStatus,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AbsenceType {
    AnnualLeave,
    SickLeave,
    MaternityLeave,
    PaternityLeave,
    UnpaidLeave,
    PublicHoliday,
    CompensatoryTimeOff,
    Training,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AbsenceStatus {
    Requested,
    Approved,
    Rejected,
    Cancelled,
    Taken,
}
```

#### 11.1.3 薪资运算 (Payroll)

```rust
pub struct PayrollRun {
    pub payroll_run_id: Uuid,
    pub payroll_period: PayrollPeriod,
    pub payroll_area: PayrollArea,
    pub company_code: CompanyCode,
    
    // Run Details
    pub run_date: NaiveDate,
    pub payment_date: NaiveDate,
    pub accounting_period: Period,
    
    // Scope
    pub personnel_numbers: Vec<String>,
    pub total_employees: u32,
    pub successful_count: u32,
    pub error_count: u32,
    
    // Results
    pub payslips: Vec<Uuid>,             // References to payslip records
    pub total_gross_pay: Money,
    pub total_net_pay: Money,
    pub total_employer_contributions: Money,
    
    // Accounting Integration
    pub accounting_documents: Vec<Uuid>,
    pub posted_to_fi: bool,
    pub posting_date: Option<NaiveDate>,
    
    // Status
    pub payroll_status: PayrollStatus,
    
    // Audit
    pub executed_at: DateTime<Utc>,
    pub executed_by: UserId,
}

pub struct Payslip {
    pub payslip_id: Uuid,
    pub payroll_run_id: Uuid,
    pub employee_id: Uuid,
    pub employee_number: String,
    pub payroll_period: PayrollPeriod,
    
    // Earnings
    pub basic_salary: Money,
    pub allowances: Vec<PayslipItem>,
    pub overtime_pay: Money,
    pub bonuses: Vec<PayslipItem>,
    pub gross_earnings: Money,
    
    // Deductions
    pub income_tax: Money,
    pub social_security: Money,
    pub pension_contribution: Money,
    pub health_insurance: Money,
    pub other_deductions: Vec<PayslipItem>,
    pub total_deductions: Money,
    
    // Net Pay
    pub net_pay: Money,
    pub currency: Currency,
    
    // Employer Contributions
    pub employer_social_security: Money,
    pub employer_pension: Money,
    pub employer_health_insurance: Money,
    pub total_employer_contributions: Money,
    
    // Payment
    pub payment_method: PaymentMethod,
    pub bank_account_number: Option<String>,
    pub payment_reference: Option<String>,
    
    // Year-to-Date Totals
    pub ytd_gross_earnings: Money,
    pub ytd_deductions: Money,
    pub ytd_net_pay: Money,
    
    // Status
    pub payslip_status: PayslipStatus,
    
    // Generated
    pub generated_at: DateTime<Utc>,
}

pub struct PayslipItem {
    pub item_type: String,
    pub description: String,
    pub amount: Money,
    pub quantity: Option<Decimal>,
    pub rate: Option<Money>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PayrollPeriod {
    pub year: u16,
    pub period: u8,                    // 1-12 for monthly, 1-26 for biweekly
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PayrollStatus {
    InProgress,
    Completed,
    Released,
    Posted,
    Corrected,
}
```

### 11.2 API 规格

```rust
// POST /api/v1/hr/employees
pub struct CreateEmployeeRequest {
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: NaiveDate,
    pub gender: String,
    pub nationality: String,
    pub hire_date: NaiveDate,
    pub company_code: String,
    pub organizational_unit: String,
    pub position: String,
    pub employee_group: String,
    pub employee_subgroup: String,
    pub basic_annual_salary: Decimal,
    pub currency: String,
}

// POST /api/v1/hr/time-records
pub struct CreateTimeRecordRequest {
    pub employee_id: Uuid,
    pub recording_date: NaiveDate,
    pub clock_in: NaiveDateTime,
    pub clock_out: Option<NaiveDateTime>,
    pub time_type: String,
    pub cost_center: Option<String>,
}

// POST /api/v1/hr/absences
pub struct CreateAbsenceRequest {
    pub employee_id: Uuid,
    pub absence_type: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub attachment: Option<String>,
}

// POST /api/v1/hr/payroll-runs
pub struct ExecutePayrollRunRequest {
    pub payroll_area: String,
    pub payroll_period: PayrollPeriodRequest,
    pub payment_date: NaiveDate,
    pub personnel_numbers: Option<Vec<String>>, // All if None
    pub simulation: bool,
}

pub struct ExecutePayrollRunResponse {
    pub payroll_run_id: Uuid,
    pub total_employees: u32,
    pub successful_count: u32,
    pub error_count: u32,
    pub total_gross_pay: Decimal,
    pub total_net_pay: Decimal,
    pub errors: Vec<PayrollError>,
    pub executed_at: DateTime<Utc>,
}

pub struct PayrollError {
    pub employee_number: String,
    pub error_code: String,
    pub error_message: String,
}

// GET /api/v1/hr/employees/{employee_id}/payslip
pub struct GetPayslipQuery {
    pub payroll_period_year: u16,
    pub payroll_period_number: u8,
}
```

### 11.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HcmDomainEvent {
    EmployeeHired(EmployeeHired),
    EmployeeTerminated(EmployeeTerminated),
    EmployeeTransferred(EmployeeTransferred),
    AbsenceRequested(AbsenceRequested),
    AbsenceApproved(AbsenceApproved),
    TimeRecordSubmitted(TimeRecordSubmitted),
    PayrollRunCompleted(PayrollRunCompleted),
    PayslipGenerated(PayslipGenerated),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeHired {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub employee_id: Uuid,
    pub employee_number: String,
    pub first_name: String,
    pub last_name: String,
    pub hire_date: NaiveDate,
    pub company_code: String,
    pub organizational_unit: String,
    pub position: String,
    pub annual_salary: Decimal,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayrollRunCompleted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub payroll_run_id: Uuid,
    pub payroll_period: PayrollPeriod,
    pub payroll_area: String,
    pub total_employees: u32,
    pub total_gross_pay: Decimal,
    pub total_net_pay: Decimal,
    pub total_employer_contributions: Decimal,
    pub currency: String,
    pub payment_date: NaiveDate,
}
```

---

## 第十二部分：资金管理模块 (TR - Treasury)

### 12.1 数据模型

#### 12.1.1 现金管理 (Cash Management)

```rust
pub struct BankAccount {
    pub bank_account_id: Uuid,
    pub house_bank: HouseBank,
    pub account_id: String,
    pub bank_account_number: String,
    pub iban: Option<String>,
    pub swift_code: Option<String>,
    
    // Bank Details
    pub bank_name: String,
    pub bank_branch: Option<String>,
    pub bank_country: Country,
    
    // Account Details
    pub account_holder: String,
    pub account_currency: Currency,
    pub account_type: BankAccountType,
    
    // Company Assignment
    pub company_code: CompanyCode,
    pub gl_account: String,           // Link to FI GL account
    
    // Control
    pub available_for_payment: bool,
    pub available_for_receipts: bool,
    pub planning_type: Option<PlanningType>,
    
    // Balance
    pub current_balance: Money,
    pub available_balance: Money,
    pub ledger_balance: Money,
    pub last_statement_date: Option<NaiveDate>,
    
    // Limits
    pub overdraft_limit: Option<Money>,
    pub maximum_balance: Option<Money>,
    
    // Status
    pub account_status: BankAccountStatus,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BankAccountType {
    Checking,
    Savings,
    TimeDeposit,
    CreditLine,
    LoanAccount,
}

pub struct CashPosition {
    pub position_id: Uuid,
    pub company_code: CompanyCode,
    pub value_date: NaiveDate,
    pub currency: Currency,
    
    // Opening Balance
    pub opening_balance: Money,
    
    // Inflows
    pub customer_payments_received: Money,
    pub loan_disbursements: Money,
    pub investment_maturities: Money,
    pub other_inflows: Money,
    pub total_inflows: Money,
    
    // Outflows
    pub vendor_payments_made: Money,
    pub salary_payments: Money,
    pub loan_repayments: Money,
    pub investment_purchases: Money,
    pub tax_payments: Money,
    pub other_outflows: Money,
    pub total_outflows: Money,
    
    // Closing Balance
    pub closing_balance: Money,
    
    // Calculated
    pub net_cash_flow: Money,
    pub cumulative_cash_flow: Money,
    
    // Status
    pub position_type: CashPositionType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CashPositionType {
    Actual,
    Planned,
    Forecast,
}
```

#### 12.1.2 流动性预测 (Liquidity Forecast)

```rust
pub struct LiquidityForecast {
    pub forecast_id: Uuid,
    pub company_code: CompanyCode,
    pub currency: Currency,
    pub forecast_date: NaiveDate,
    pub forecast_horizon_days: u16,
    
    // Forecast Method
    pub forecast_method: ForecastMethod,
    pub confidence_level: Decimal,       // Percentage
    
    // Daily Forecast
    pub daily_forecasts: Vec<DailyLiquidityForecast>,
    
    // Summary
    pub minimum_balance_date: NaiveDate,
    pub minimum_balance_amount: Money,
    pub maximum_balance_date: NaiveDate,
    pub maximum_balance_amount: Money,
    
    // Alerts
    pub liquidity_alerts: Vec<LiquidityAlert>,
    
    // Status
    pub forecast_status: ForecastStatus,
    
    // Generated
    pub generated_at: DateTime<Utc>,
    pub generated_by: UserId,
}

pub struct DailyLiquidityForecast {
    pub value_date: NaiveDate,
    pub opening_balance: Money,
    pub expected_inflows: Money,
    pub expected_outflows: Money,
    pub closing_balance: Money,
    pub inflow_details: Vec<CashFlowItem>,
    pub outflow_details: Vec<CashFlowItem>,
}

pub struct CashFlowItem {
    pub item_type: CashFlowType,
    pub description: String,
    pub amount: Money,
    pub confidence: Decimal,            // Percentage
    pub source_document: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CashFlowType {
    CustomerPayment,
    VendorPayment,
    SalaryPayment,
    TaxPayment,
    LoanPayment,
    InvestmentMaturity,
    DividendPayment,
    InterestIncome,
    InterestExpense,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ForecastMethod {
    RuleBased,              // Based on payment terms
    HistoricalAverage,      // Based on historical patterns
    MachineLearning,        // ML-based prediction
    Manual,                 // Manual entry
}

pub struct LiquidityAlert {
    pub alert_id: Uuid,
    pub alert_type: AlertType,
    pub severity: AlertSeverity,
    pub value_date: NaiveDate,
    pub forecasted_balance: Money,
    pub threshold: Money,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AlertType {
    InsufficientFunds,
    ExcessCash,
    CreditLimitExceeded,
    LargePaymentDue,
}
```

#### 12.1.3 金融交易 (Financial Transactions)

```rust
pub struct FinancialTransaction {
    pub transaction_id: Uuid,
    pub transaction_type: FinancialTransactionType,
    pub transaction_number: String,
    
    // Parties
    pub company_code: CompanyCode,
    pub counterparty: Option<Counterparty>,
    
    // Financial Details
    pub transaction_currency: Currency,
    pub transaction_amount: Money,
    pub local_currency: Currency,
    pub local_amount: Money,
    pub exchange_rate: Option<ExchangeRate>,
    
    // Dates
    pub trade_date: NaiveDate,
    pub value_date: NaiveDate,
    pub maturity_date: Option<NaiveDate>,
    
    // Terms
    pub interest_rate: Option<Decimal>,
    pub tenor_days: Option<u16>,
    
    // Settlement
    pub settlement_account: Option<Uuid>,
    pub settlement_status: SettlementStatus,
    pub settled_date: Option<NaiveDate>,
    
    // Accounting
    pub accounting_document_id: Option<Uuid>,
    pub accounting_treatment: AccountingTreatment,
    
    // Status
    pub transaction_status: TransactionStatus,
    
    // Audit
    pub created_at: DateTime<Utc>,
    pub created_by: UserId,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FinancialTransactionType {
    ForeignExchange,        // FX spot/forward
    MoneyMarketDeposit,    // Time deposit
    MoneyMarketLoan,       // Short-term borrowing
    FxForwardContract,     // FX hedging
    InterestRateSwap,      // Interest rate hedging
    CommodityHedge,        // Commodity price hedging
}

pub struct Counterparty {
    pub counterparty_id: Uuid,
    pub counterparty_name: String,
    pub counterparty_type: CounterpartyType,
    pub credit_rating: Option<CreditRating>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CounterpartyType {
    Bank,
    CorporateEntity,
    GovernmentEntity,
    InvestmentFund,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SettlementStatus {
    Pending,
    Settled,
    Failed,
    Cancelled,
}
```

### 12.2 API 规格

```rust
// POST /api/v1/treasury/bank-accounts
pub struct CreateBankAccountRequest {
    pub house_bank: String,
    pub account_id: String,
    pub bank_account_number: String,
    pub iban: Option<String>,
    pub swift_code: Option<String>,
    pub bank_name: String,
    pub account_currency: String,
    pub company_code: String,
    pub gl_account: String,
}

// POST /api/v1/treasury/cash-positions
pub struct RecordCashPositionRequest {
    pub company_code: String,
    pub value_date: NaiveDate,
    pub currency: String,
    pub opening_balance: Decimal,
    pub inflows: CashFlowsRequest,
    pub outflows: CashFlowsRequest,
}

// POST /api/v1/treasury/liquidity-forecast
pub struct GenerateLiquidityForecastRequest {
    pub company_code: String,
    pub currency: String,
    pub forecast_horizon_days: u16,
    pub forecast_method: String,
}

pub struct GenerateLiquidityForecastResponse {
    pub forecast_id: Uuid,
    pub forecast_date: NaiveDate,
    pub daily_forecasts: Vec<DailyForecastSummary>,
    pub minimum_balance: ForecastExtreme,
    pub maximum_balance: ForecastExtreme,
    pub alerts: Vec<LiquidityAlertDto>,
}

pub struct ForecastExtreme {
    pub date: NaiveDate,
    pub amount: Decimal,
}

// POST /api/v1/treasury/financial-transactions
pub struct CreateFinancialTransactionRequest {
    pub transaction_type: String,
    pub company_code: String,
    pub counterparty_id: Option<Uuid>,
    pub transaction_currency: String,
    pub transaction_amount: Decimal,
    pub trade_date: NaiveDate,
    pub value_date: NaiveDate,
    pub maturity_date: Option<NaiveDate>,
    pub interest_rate: Option<Decimal>,
}

// GET /api/v1/treasury/cash-flow-analysis
pub struct GetCashFlowAnalysisQuery {
    pub company_code: String,
    pub currency: String,
    pub date_from: NaiveDate,
    pub date_to: NaiveDate,
    pub analysis_type: String,        // Daily, Weekly, Monthly
}

pub struct GetCashFlowAnalysisResponse {
    pub company_code: String,
    pub currency: String,
    pub period_from: NaiveDate,
    pub period_to: NaiveDate,
    pub periods: Vec<PeriodCashFlow>,
    pub total_inflows: Decimal,
    pub total_outflows: Decimal,
    pub net_cash_flow: Decimal,
}

pub struct PeriodCashFlow {
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub opening_balance: Decimal,
    pub inflows: Decimal,
    pub outflows: Decimal,
    pub closing_balance: Decimal,
}
```

### 12.3 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TreasuryDomainEvent {
    BankAccountCreated(BankAccountCreated),
    CashPositionRecorded(CashPositionRecorded),
    LiquidityAlertTriggered(LiquidityAlertTriggered),
    FinancialTransactionExecuted(FinancialTransactionExecuted),
    PaymentExecuted(PaymentExecuted),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityAlertTriggered {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub alert_id: Uuid,
    pub alert_type: String,
    pub severity: String,
    pub company_code: String,
    pub value_date: NaiveDate,
    pub forecasted_balance: Decimal,
    pub threshold: Decimal,
    pub currency: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinancialTransactionExecuted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub transaction_id: Uuid,
    pub transaction_number: String,
    pub transaction_type: String,
    pub company_code: String,
    pub transaction_currency: String,
    pub transaction_amount: Decimal,
    pub trade_date: NaiveDate,
    pub value_date: NaiveDate,
    pub counterparty: Option<String>,
    pub created_by: String,
}
```

---

## 总结

本 **Rust ERP Domain Specifications** 文档现已完成12个核心模块的详细技术规格：

✅ **FI (Financial Accounting)** - 财务会计  
✅ **CO (Controlling)** - 成本控制  
✅ **MM (Materials Management)** - 物料管理  
✅ **SD (Sales & Distribution)** - 销售分销  
✅ **PP (Production Planning)** - 生产计划  
✅ **WM/EWM (Warehouse Management)** - 仓库管理  
✅ **QM (Quality Management)** - 质量管理  
✅ **PM (Plant Maintenance)** - 设备维护  
✅ **PS (Project System)** - 项目系统  
✅ **HCM (Human Capital Management)** - 人力资源  
✅ **TR (Treasury)** - 资金管理  
✅ **Cross-Module Integration** - 跨模块集成架构

每个模块包含：
- 📊 完整的领域数据模型（Rust structs）
- 🔌 RESTful API 规格（Request/Response DTOs）
- 📡 领域事件定义（Event-driven架构）
- 🔄 业务流程事件链（P2P, O2C, Production）
- 🏗️ 集成架构设计（Event routing, Saga pattern）

配合已有文档使用：
1. **Rust-BOM.md** → 功能清单 (WHAT)
2. **Rust-Abc-Enhanced.md** → 12月开发计划 (WHEN)
3. **Rust-Implementation-Guide.md** → 技术实施指南 (HOW)
4. **Rust-Domain-Specifications.md** (本文档) → API与数据模型 (WHAT EXACTLY)

您的开发团队现在拥有完整的技术蓝图来构建生产级 Rust ERP 系统！🚀

## 第十三部分：商业智能与数据仓库 (BW/BI - Business Intelligence & Data Warehouse)

### 13.1 数据仓库架构

#### 13.1.1 分层架构设计

```rust
// Data Warehouse Layered Architecture
pub struct DataWarehouseArchitecture {
    pub staging_layer: StagingLayer,
    pub ods_layer: OdsLayer,              // Operational Data Store
    pub dw_layer: DwLayer,                // Data Warehouse Core
    pub data_mart_layer: DataMartLayer,   // Subject-specific data marts
    pub semantic_layer: SemanticLayer,    // Business view
}

// Staging Layer - Raw data from source systems
pub struct StagingLayer {
    pub staging_tables: Vec<StagingTable>,
    pub extraction_logs: Vec<ExtractionLog>,
    pub data_quality_checks: Vec<QualityCheck>,
}

pub struct StagingTable {
    pub table_name: String,
    pub source_system: String,           // FI, MM, SD, etc.
    pub last_extracted_at: DateTime<Utc>,
    pub row_count: u64,
    pub extraction_mode: ExtractionMode,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExtractionMode {
    Full,                  // Full extraction
    Incremental,          // Only changes since last extraction
    Delta,                // Change data capture (CDC)
    RealTime,             // Real-time streaming
}

// ODS Layer - Integrated operational data
pub struct OdsLayer {
    pub entities: Vec<OdsEntity>,
    pub update_frequency: UpdateFrequency,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UpdateFrequency {
    RealTime,
    Hourly,
    Daily,
    Weekly,
}

// Data Warehouse Core - Historical, integrated data
pub struct DwLayer {
    pub fact_tables: Vec<FactTable>,
    pub dimension_tables: Vec<DimensionTable>,
    pub bridge_tables: Vec<BridgeTable>,
}

// Data Mart Layer - Subject-specific aggregated data
pub struct DataMartLayer {
    pub data_marts: Vec<DataMart>,
}

pub struct DataMart {
    pub mart_id: Uuid,
    pub mart_name: String,
    pub subject_area: SubjectArea,
    pub fact_tables: Vec<String>,
    pub dimensions: Vec<String>,
    pub refresh_schedule: RefreshSchedule,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SubjectArea {
    Financial,
    Sales,
    Purchasing,
    Inventory,
    Production,
    HumanResources,
    CustomerAnalytics,
}
```

#### 13.1.2 维度建模 - 星型模式

```rust
// Fact Table - Measures and foreign keys to dimensions
pub struct FactTable {
    pub fact_id: Uuid,
    pub table_name: String,
    pub fact_type: FactType,
    pub grain: String,                    // e.g., "One row per document line item"
    
    // Dimension Foreign Keys
    pub dimension_keys: Vec<DimensionKey>,
    
    // Measures (Additive, Semi-additive, Non-additive)
    pub measures: Vec<Measure>,
    
    // Degenerate Dimensions (dimensions stored in fact table)
    pub degenerate_dimensions: Vec<DegenerateDimension>,
    
    // Partitioning
    pub partitioned_by: Option<String>,  // e.g., "posting_date"
    pub partition_type: PartitionType,
    
    // Metadata
    pub row_count: u64,
    pub last_updated: DateTime<Utc>,
    pub data_retention_days: u16,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FactType {
    Transaction,          // e.g., Sales transactions, GL postings
    PeriodicSnapshot,    // e.g., Daily inventory levels
    AccumulatingSnapshot, // e.g., Order fulfillment pipeline
}

pub struct DimensionKey {
    pub dimension_name: String,
    pub foreign_key_column: String,
    pub relationship_type: RelationshipType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RelationshipType {
    ManyToOne,
    ManyToMany,          // Requires bridge table
}

pub struct Measure {
    pub measure_name: String,
    pub column_name: String,
    pub data_type: MeasureDataType,
    pub aggregation_type: AggregationType,
    pub additivity: Additivity,
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AggregationType {
    Sum,
    Average,
    Count,
    DistinctCount,
    Min,
    Max,
    StandardDeviation,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Additivity {
    Additive,            // Can sum across all dimensions (e.g., sales amount)
    SemiAdditive,        // Can sum across some dimensions (e.g., inventory balance)
    NonAdditive,         // Cannot sum (e.g., ratios, percentages)
}

// Dimension Table - Descriptive attributes
pub struct DimensionTable {
    pub dimension_id: Uuid,
    pub table_name: String,
    pub dimension_type: DimensionType,
    
    // Surrogate Key
    pub surrogate_key_column: String,
    
    // Natural Key (from source system)
    pub natural_key_columns: Vec<String>,
    
    // Attributes
    pub attributes: Vec<DimensionAttribute>,
    
    // Hierarchy
    pub hierarchies: Vec<Hierarchy>,
    
    // Slowly Changing Dimension (SCD) Type
    pub scd_type: ScdType,
    
    // Metadata
    pub row_count: u64,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DimensionType {
    Standard,
    Conformed,           // Shared across multiple fact tables
    Degenerate,          // Stored in fact table
    RolePlayingCustomer, // Same dimension used multiple times with different roles
    Junk,               // Low-cardinality flags
    Date,               // Time dimension
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ScdType {
    Type0,              // No changes tracked
    Type1,              // Overwrite old value
    Type2,              // Create new row with version
    Type3,              // Add new column for old value
    Type4,              // Separate history table
    Type6,              // Hybrid (1+2+3)
}

pub struct DimensionAttribute {
    pub attribute_name: String,
    pub column_name: String,
    pub data_type: AttributeDataType,
    pub is_hierarchical: bool,
    pub parent_attribute: Option<String>,
}

pub struct Hierarchy {
    pub hierarchy_name: String,
    pub levels: Vec<HierarchyLevel>,
}

pub struct HierarchyLevel {
    pub level_number: u8,
    pub level_name: String,
    pub attribute_name: String,
}
```

#### 13.1.3 主要事实表设计

```rust
// Financial Fact Tables
pub struct FactGlPosting {
    // Surrogate Key
    pub gl_posting_key: i64,
    
    // Dimension Keys
    pub date_key: i32,
    pub company_code_key: i32,
    pub account_key: i32,
    pub cost_center_key: Option<i32>,
    pub profit_center_key: Option<i32>,
    pub business_partner_key: Option<i32>,
    pub currency_key: i32,
    
    // Degenerate Dimensions
    pub document_number: String,
    pub line_item_number: u16,
    pub posting_key: String,             // Debit/Credit indicator
    
    // Measures
    pub amount_in_document_currency: Decimal,
    pub amount_in_local_currency: Decimal,
    pub amount_in_group_currency: Decimal,
    pub quantity: Option<Decimal>,
    
    // Metadata
    pub source_system_id: String,
    pub load_timestamp: DateTime<Utc>,
}

// Sales Fact Tables
pub struct FactSalesOrder {
    // Surrogate Key
    pub sales_order_key: i64,
    
    // Dimension Keys
    pub order_date_key: i32,
    pub requested_delivery_date_key: i32,
    pub customer_key: i32,
    pub sold_to_party_key: i32,
    pub ship_to_party_key: i32,
    pub bill_to_party_key: i32,
    pub material_key: i32,
    pub sales_org_key: i32,
    pub distribution_channel_key: i32,
    pub division_key: i32,
    pub plant_key: i32,
    pub sales_employee_key: Option<i32>,
    
    // Degenerate Dimensions
    pub order_number: String,
    pub item_number: u16,
    pub order_type: String,
    pub order_category: String,
    
    // Measures (Additive)
    pub order_quantity: Decimal,
    pub confirmed_quantity: Decimal,
    pub delivered_quantity: Decimal,
    pub billed_quantity: Decimal,
    pub net_value: Decimal,
    pub cost: Decimal,
    pub gross_margin: Decimal,
    
    // Measures (Semi-additive)
    pub net_price_per_unit: Decimal,
    
    // Measures (Non-additive)
    pub gross_margin_percentage: Decimal,
    
    // Flags (Junk Dimension candidates)
    pub credit_check_passed: bool,
    pub delivery_complete_flag: bool,
    pub billing_complete_flag: bool,
    
    // Metadata
    pub current_status: String,
    pub load_timestamp: DateTime<Utc>,
}

// Inventory Fact Tables (Periodic Snapshot)
pub struct FactInventoryDaily {
    // Surrogate Key
    pub inventory_snapshot_key: i64,
    
    // Dimension Keys
    pub date_key: i32,
    pub material_key: i32,
    pub plant_key: i32,
    pub storage_location_key: i32,
    pub batch_key: Option<i32>,
    pub stock_type_key: i32,
    
    // Measures (Semi-additive - can't sum across time)
    pub unrestricted_stock_quantity: Decimal,
    pub quality_inspection_quantity: Decimal,
    pub blocked_stock_quantity: Decimal,
    pub total_stock_quantity: Decimal,
    pub stock_value: Decimal,
    
    // Measures (Additive)
    pub receipts_quantity: Decimal,
    pub issues_quantity: Decimal,
    pub adjustments_quantity: Decimal,
    
    // Calculated Measures
    pub days_of_supply: Option<Decimal>,
    pub stock_turnover_ratio: Option<Decimal>,
    
    // Metadata
    pub load_timestamp: DateTime<Utc>,
}

// Production Fact Tables
pub struct FactProductionOrder {
    // Surrogate Key
    pub production_order_key: i64,
    
    // Dimension Keys
    pub order_date_key: i32,
    pub start_date_key: i32,
    pub finish_date_key: i32,
    pub material_key: i32,
    pub plant_key: i32,
    pub production_supervisor_key: Option<i32>,
    pub bom_key: Option<i32>,
    pub routing_key: Option<i32>,
    
    // Degenerate Dimensions
    pub order_number: String,
    pub order_type: String,
    
    // Measures
    pub target_quantity: Decimal,
    pub confirmed_yield_quantity: Decimal,
    pub scrap_quantity: Decimal,
    pub planned_costs: Decimal,
    pub actual_costs: Decimal,
    pub cost_variance: Decimal,
    pub planned_duration_hours: Decimal,
    pub actual_duration_hours: Decimal,
    
    // Flags
    pub on_time_completion: bool,
    pub within_budget: bool,
    
    // Metadata
    pub current_status: String,
    pub load_timestamp: DateTime<Utc>,
}

// Purchasing Fact Tables
pub struct FactPurchaseOrder {
    // Surrogate Key
    pub po_key: i64,
    
    // Dimension Keys
    pub po_date_key: i32,
    pub delivery_date_key: i32,
    pub vendor_key: i32,
    pub material_key: i32,
    pub plant_key: i32,
    pub purchasing_org_key: i32,
    pub purchasing_group_key: i32,
    pub buyer_key: Option<i32>,
    
    // Degenerate Dimensions
    pub po_number: String,
    pub item_number: u16,
    pub po_type: String,
    
    // Measures
    pub order_quantity: Decimal,
    pub received_quantity: Decimal,
    pub invoiced_quantity: Decimal,
    pub net_value: Decimal,
    pub net_price_per_unit: Decimal,
    
    // Lead Time Measures
    pub planned_delivery_days: i32,
    pub actual_delivery_days: Option<i32>,
    pub delivery_variance_days: Option<i32>,
    
    // Quality Measures
    pub rejected_quantity: Decimal,
    pub quality_defect_rate: Decimal,
    
    // Flags
    pub on_time_delivery: Option<bool>,
    pub quality_passed: Option<bool>,
    
    // Metadata
    pub current_status: String,
    pub load_timestamp: DateTime<Utc>,
}
```

#### 13.1.4 主要维度表设计

```rust
// Date Dimension (Type 2 SCD - but typically not changed)
pub struct DimDate {
    pub date_key: i32,                   // Surrogate key: YYYYMMDD (e.g., 20250101)
    pub full_date: NaiveDate,
    pub day_of_week: u8,                 // 1-7
    pub day_name: String,                // Monday, Tuesday, etc.
    pub day_of_month: u8,
    pub day_of_year: u16,
    pub week_of_year: u8,
    pub iso_week: u8,
    pub month: u8,
    pub month_name: String,
    pub quarter: u8,
    pub quarter_name: String,
    pub year: i32,
    pub fiscal_year: i32,
    pub fiscal_period: u8,
    pub fiscal_quarter: u8,
    pub is_weekend: bool,
    pub is_holiday: bool,
    pub holiday_name: Option<String>,
    pub is_working_day: bool,
    pub week_start_date: NaiveDate,
    pub week_end_date: NaiveDate,
    pub month_start_date: NaiveDate,
    pub month_end_date: NaiveDate,
    pub quarter_start_date: NaiveDate,
    pub quarter_end_date: NaiveDate,
    pub year_start_date: NaiveDate,
    pub year_end_date: NaiveDate,
}

// Material Dimension (Type 2 SCD)
pub struct DimMaterial {
    pub material_key: i32,               // Surrogate key
    pub material_number: String,         // Natural key
    pub material_description: String,
    pub material_type: String,
    pub material_group: String,
    pub material_group_desc: String,
    pub base_unit_of_measure: String,
    pub product_hierarchy_level1: String,
    pub product_hierarchy_level2: String,
    pub product_hierarchy_level3: String,
    pub product_hierarchy_level4: String,
    pub gross_weight: Option<Decimal>,
    pub net_weight: Option<Decimal>,
    pub weight_unit: Option<String>,
    pub volume: Option<Decimal>,
    pub volume_unit: Option<String>,
    pub abc_indicator: Option<String>,
    
    // SCD Type 2 fields
    pub effective_from_date: NaiveDate,
    pub effective_to_date: Option<NaiveDate>,
    pub is_current: bool,
    pub version: u32,
    
    // Audit
    pub source_system_id: String,
    pub created_timestamp: DateTime<Utc>,
    pub last_updated_timestamp: DateTime<Utc>,
}

// Customer Dimension (Type 2 SCD)
pub struct DimCustomer {
    pub customer_key: i32,               // Surrogate key
    pub customer_number: String,         // Natural key
    pub customer_name: String,
    pub customer_group: String,
    pub customer_group_desc: String,
    pub industry_sector: String,
    pub country: String,
    pub region: String,
    pub city: String,
    pub postal_code: String,
    pub credit_limit: Decimal,
    pub payment_terms: String,
    pub abc_classification: Option<String>,
    pub customer_since_date: NaiveDate,
    
    // Hierarchy (for aggregation)
    pub sales_region: String,
    pub sales_district: String,
    pub sales_territory: String,
    
    // SCD Type 2 fields
    pub effective_from_date: NaiveDate,
    pub effective_to_date: Option<NaiveDate>,
    pub is_current: bool,
    pub version: u32,
    
    // Audit
    pub source_system_id: String,
    pub created_timestamp: DateTime<Utc>,
    pub last_updated_timestamp: DateTime<Utc>,
}

// Vendor Dimension (Type 2 SCD)
pub struct DimVendor {
    pub vendor_key: i32,
    pub vendor_number: String,
    pub vendor_name: String,
    pub vendor_group: String,
    pub country: String,
    pub region: String,
    pub city: String,
    pub payment_terms: String,
    pub currency: String,
    pub abc_indicator: Option<String>,
    pub vendor_since_date: NaiveDate,
    
    // Performance Metrics (Type 1 SCD - overwrite)
    pub on_time_delivery_rate: Decimal,
    pub quality_rating: Decimal,
    pub last_performance_review_date: Option<NaiveDate>,
    
    // SCD Type 2 fields
    pub effective_from_date: NaiveDate,
    pub effective_to_date: Option<NaiveDate>,
    pub is_current: bool,
    pub version: u32,
    
    // Audit
    pub source_system_id: String,
    pub created_timestamp: DateTime<Utc>,
    pub last_updated_timestamp: DateTime<Utc>,
}

// Account Dimension (Chart of Accounts)
pub struct DimAccount {
    pub account_key: i32,
    pub account_number: String,
    pub account_name: String,
    pub account_group: String,
    pub account_type: String,            // Asset, Liability, Equity, Revenue, Expense
    pub financial_statement_item: String,
    pub balance_sheet_category: Option<String>,
    pub profit_loss_category: Option<String>,
    
    // Hierarchy
    pub account_level1: String,
    pub account_level2: String,
    pub account_level3: String,
    pub account_level4: String,
    
    // Attributes
    pub line_item_display: bool,
    pub cost_element: Option<String>,
    
    // SCD Type 1 (typically)
    pub is_active: bool,
    
    // Audit
    pub source_system_id: String,
    pub created_timestamp: DateTime<Utc>,
    pub last_updated_timestamp: DateTime<Utc>,
}

// Plant Dimension
pub struct DimPlant {
    pub plant_key: i32,
    pub plant_code: String,
    pub plant_name: String,
    pub company_code: String,
    pub company_name: String,
    pub country: String,
    pub region: String,
    pub city: String,
    pub plant_category: String,
    pub factory_calendar: String,
    
    // Hierarchy
    pub country_region: String,
    pub business_unit: String,
    
    // Attributes
    pub is_active: bool,
    
    // Audit
    pub source_system_id: String,
    pub created_timestamp: DateTime<Utc>,
    pub last_updated_timestamp: DateTime<Utc>,
}
```

### 13.2 ETL流程设计

#### 13.2.1 ETL框架

```rust
pub struct EtlPipeline {
    pub pipeline_id: Uuid,
    pub pipeline_name: String,
    pub pipeline_type: PipelineType,
    pub source_system: String,
    pub target_table: String,
    
    // Stages
    pub extraction: ExtractionConfig,
    pub transformation: TransformationConfig,
    pub loading: LoadingConfig,
    
    // Scheduling
    pub schedule: EtlSchedule,
    pub execution_mode: ExecutionMode,
    
    // Monitoring
    pub last_run: Option<EtlRun>,
    pub status: PipelineStatus,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PipelineType {
    BatchFull,
    BatchIncremental,
    StreamingRealTime,
    MicroBatch,
}

pub struct ExtractionConfig {
    pub extraction_method: ExtractionMethod,
    pub source_query: Option<String>,
    pub change_detection_column: Option<String>, // For incremental
    pub watermark_column: Option<String>,        // For streaming
    pub parallelism: u8,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExtractionMethod {
    FullTableScan,
    IncrementalTimestamp,
    IncrementalCdc,              // Change Data Capture
    LogBasedReplication,
    ApiPolling,
    EventStreaming,
}

pub struct TransformationConfig {
    pub transformations: Vec<Transformation>,
    pub data_quality_rules: Vec<DataQualityRule>,
}

pub struct Transformation {
    pub transformation_id: Uuid,
    pub transformation_type: TransformationType,
    pub transformation_logic: String,     // SQL, Rust code, or config
    pub order: u8,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TransformationType {
    Mapping,                  // Column mapping
    Filtering,               // Row filtering
    Aggregation,             // Grouping and aggregation
    Joining,                 // Join with other tables
    Lookup,                  // Dimension lookup for surrogate keys
    Calculation,             // Derived columns
    Deduplication,           // Remove duplicates
    DataCleansing,          // Fix data quality issues
    SlowlyChangingDimension, // SCD Type 2 logic
}

pub struct LoadingConfig {
    pub loading_method: LoadingMethod,
    pub merge_key_columns: Vec<String>,
    pub partition_column: Option<String>,
    pub error_handling: ErrorHandling,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LoadingMethod {
    TruncateAndLoad,         // Full refresh
    InsertOnly,             // Append only
    Upsert,                 // Insert or update based on key
    MergeWithScd,           // SCD Type 2 merge
    DeltaMerge,             // Efficient merge for large tables
}

pub struct EtlRun {
    pub run_id: Uuid,
    pub pipeline_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: EtlRunStatus,
    
    // Metrics
    pub rows_extracted: u64,
    pub rows_transformed: u64,
    pub rows_loaded: u64,
    pub rows_rejected: u64,
    pub duration_seconds: u64,
    
    // Errors
    pub error_message: Option<String>,
    pub error_details: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EtlRunStatus {
    Running,
    Success,
    PartialSuccess,
    Failed,
    Cancelled,
}
```

#### 13.2.2 数据质量管理

```rust
pub struct DataQualityRule {
    pub rule_id: Uuid,
    pub rule_name: String,
    pub rule_type: DataQualityRuleType,
    pub rule_definition: String,
    pub severity: QualityIssueSeverity,
    pub action_on_failure: QualityActionOnFailure,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DataQualityRuleType {
    Completeness,           // Check for nulls
    Uniqueness,            // Check for duplicates
    Validity,              // Check data format/range
    Consistency,           // Cross-field validation
    Accuracy,              // Compare with reference data
    Timeliness,            // Check data freshness
    Referential,           // Foreign key validation
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QualityIssueSeverity {
    Critical,              // Must fix before loading
    Warning,               // Load but flag for review
    Info,                  // Log only
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QualityActionOnFailure {
    RejectRow,
    RejectBatch,
    LogAndContinue,
    UseDefaultValue,
    QuarantineRow,
}

pub struct DataQualityReport {
    pub report_id: Uuid,
    pub etl_run_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub total_rows: u64,
    pub passed_rows: u64,
    pub failed_rows: u64,
    pub rule_results: Vec<RuleResult>,
}

pub struct RuleResult {
    pub rule_id: Uuid,
    pub rule_name: String,
    pub passed: bool,
    pub failed_count: u64,
    pub sample_failures: Vec<String>,
}
```

#### 13.2.3 SCD Type 2 实现

```rust
// SCD Type 2 Merge Logic for Dimension Tables
pub async fn merge_dimension_scd_type2(
    staging_data: Vec<StagingDimensionRow>,
    target_table: &str,
    natural_key_columns: Vec<String>,
    attribute_columns: Vec<String>,
) -> Result<ScdMergeResult, EtlError> {
    
    // Step 1: Identify new records (INSERT)
    let new_records = identify_new_records(
        &staging_data,
        target_table,
        &natural_key_columns,
    ).await?;
    
    // Step 2: Identify changed records (UPDATE old + INSERT new)
    let changed_records = identify_changed_records(
        &staging_data,
        target_table,
        &natural_key_columns,
        &attribute_columns,
    ).await?;
    
    // Step 3: Close out old versions
    // UPDATE target_table
    // SET effective_to_date = CURRENT_DATE - 1,
    //     is_current = FALSE
    // WHERE natural_key IN (changed_records)
    //   AND is_current = TRUE
    
    // Step 4: Insert new versions
    // INSERT INTO target_table (...)
    // VALUES (..., effective_from_date = CURRENT_DATE, is_current = TRUE)
    
    // Step 5: Insert brand new records
    // INSERT INTO target_table (...)
    // VALUES (..., effective_from_date = CURRENT_DATE, is_current = TRUE)
    
    Ok(ScdMergeResult {
        new_records_inserted: new_records.len(),
        changed_records_updated: changed_records.len(),
        unchanged_records: staging_data.len() - new_records.len() - changed_records.len(),
    })
}

pub struct ScdMergeResult {
    pub new_records_inserted: usize,
    pub changed_records_updated: usize,
    pub unchanged_records: usize,
}
```

### 13.3 OLAP多维分析

#### 13.3.1 OLAP Cube定义

```rust
pub struct OlapCube {
    pub cube_id: Uuid,
    pub cube_name: String,
    pub subject_area: SubjectArea,
    
    // Fact Table
    pub fact_table: String,
    
    // Dimensions
    pub dimensions: Vec<CubeDimension>,
    
    // Measures
    pub measures: Vec<CubeMeasure>,
    
    // Calculated Measures
    pub calculated_measures: Vec<CalculatedMeasure>,
    
    // Aggregations (Pre-calculated for performance)
    pub aggregations: Vec<Aggregation>,
    
    // Metadata
    pub created_at: DateTime<Utc>,
    pub last_processed: Option<DateTime<Utc>>,
}

pub struct CubeDimension {
    pub dimension_name: String,
    pub dimension_table: String,
    pub key_column: String,
    pub attributes: Vec<String>,
    pub hierarchies: Vec<DimensionHierarchy>,
    pub default_member: Option<String>,
}

pub struct DimensionHierarchy {
    pub hierarchy_name: String,
    pub all_member_name: String,
    pub levels: Vec<HierarchyLevel>,
}

pub struct CubeMeasure {
    pub measure_name: String,
    pub source_column: String,
    pub aggregation_function: AggregationFunction,
    pub format_string: String,
    pub visible: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AggregationFunction {
    Sum,
    Avg,
    Min,
    Max,
    Count,
    DistinctCount,
}

pub struct CalculatedMeasure {
    pub measure_name: String,
    pub formula: String,               // MDX or custom expression
    pub format_string: String,
}

// Example: Sales Analysis Cube
pub fn create_sales_analysis_cube() -> OlapCube {
    OlapCube {
        cube_id: Uuid::new_v4(),
        cube_name: "Sales Analysis".to_string(),
        subject_area: SubjectArea::Sales,
        fact_table: "fact_sales_order".to_string(),
        dimensions: vec![
            CubeDimension {
                dimension_name: "Time".to_string(),
                dimension_table: "dim_date".to_string(),
                key_column: "date_key".to_string(),
                attributes: vec![
                    "full_date".to_string(),
                    "day_name".to_string(),
                    "month_name".to_string(),
                    "quarter_name".to_string(),
                    "year".to_string(),
                ],
                hierarchies: vec![
                    DimensionHierarchy {
                        hierarchy_name: "Calendar".to_string(),
                        all_member_name: "All Periods".to_string(),
                        levels: vec![
                            HierarchyLevel {
                                level_number: 1,
                                level_name: "Year".to_string(),
                                attribute_name: "year".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 2,
                                level_name: "Quarter".to_string(),
                                attribute_name: "quarter_name".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 3,
                                level_name: "Month".to_string(),
                                attribute_name: "month_name".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 4,
                                level_name: "Date".to_string(),
                                attribute_name: "full_date".to_string(),
                            },
                        ],
                    },
                ],
                default_member: None,
            },
            CubeDimension {
                dimension_name: "Customer".to_string(),
                dimension_table: "dim_customer".to_string(),
                key_column: "customer_key".to_string(),
                attributes: vec![
                    "customer_name".to_string(),
                    "customer_group".to_string(),
                    "country".to_string(),
                    "region".to_string(),
                ],
                hierarchies: vec![
                    DimensionHierarchy {
                        hierarchy_name: "Geography".to_string(),
                        all_member_name: "All Customers".to_string(),
                        levels: vec![
                            HierarchyLevel {
                                level_number: 1,
                                level_name: "Region".to_string(),
                                attribute_name: "sales_region".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 2,
                                level_name: "Country".to_string(),
                                attribute_name: "country".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 3,
                                level_name: "Customer".to_string(),
                                attribute_name: "customer_name".to_string(),
                            },
                        ],
                    },
                ],
                default_member: None,
            },
            CubeDimension {
                dimension_name: "Product".to_string(),
                dimension_table: "dim_material".to_string(),
                key_column: "material_key".to_string(),
                attributes: vec![
                    "material_description".to_string(),
                    "material_group".to_string(),
                    "product_hierarchy_level1".to_string(),
                ],
                hierarchies: vec![
                    DimensionHierarchy {
                        hierarchy_name: "Product Hierarchy".to_string(),
                        all_member_name: "All Products".to_string(),
                        levels: vec![
                            HierarchyLevel {
                                level_number: 1,
                                level_name: "Division".to_string(),
                                attribute_name: "product_hierarchy_level1".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 2,
                                level_name: "Category".to_string(),
                                attribute_name: "product_hierarchy_level2".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 3,
                                level_name: "Group".to_string(),
                                attribute_name: "material_group".to_string(),
                            },
                            HierarchyLevel {
                                level_number: 4,
                                level_name: "Product".to_string(),
                                attribute_name: "material_description".to_string(),
                            },
                        ],
                    },
                ],
                default_member: None,
            },
        ],
        measures: vec![
            CubeMeasure {
                measure_name: "Net Sales".to_string(),
                source_column: "net_value".to_string(),
                aggregation_function: AggregationFunction::Sum,
                format_string: "#,##0.00".to_string(),
                visible: true,
            },
            CubeMeasure {
                measure_name: "Cost".to_string(),
                source_column: "cost".to_string(),
                aggregation_function: AggregationFunction::Sum,
                format_string: "#,##0.00".to_string(),
                visible: true,
            },
            CubeMeasure {
                measure_name: "Quantity".to_string(),
                source_column: "order_quantity".to_string(),
                aggregation_function: AggregationFunction::Sum,
                format_string: "#,##0".to_string(),
                visible: true,
            },
            CubeMeasure {
                measure_name: "Order Count".to_string(),
                source_column: "sales_order_key".to_string(),
                aggregation_function: AggregationFunction::DistinctCount,
                format_string: "#,##0".to_string(),
                visible: true,
            },
        ],
        calculated_measures: vec![
            CalculatedMeasure {
                measure_name: "Gross Margin".to_string(),
                formula: "[Net Sales] - [Cost]".to_string(),
                format_string: "#,##0.00".to_string(),
            },
            CalculatedMeasure {
                measure_name: "Gross Margin %".to_string(),
                formula: "([Net Sales] - [Cost]) / [Net Sales]".to_string(),
                format_string: "0.00%".to_string(),
            },
            CalculatedMeasure {
                measure_name: "Average Order Value".to_string(),
                formula: "[Net Sales] / [Order Count]".to_string(),
                format_string: "#,##0.00".to_string(),
            },
        ],
        aggregations: vec![],
        created_at: Utc::now(),
        last_processed: None,
    }
}
```

#### 13.3.2 MDX查询引擎

```rust
// Multi-Dimensional eXpressions (MDX) Query
pub struct MdxQuery {
    pub select_clause: SelectClause,
    pub from_clause: String,           // Cube name
    pub where_clause: Option<WhereClause>,
    pub with_clause: Option<WithClause>,
}

pub struct SelectClause {
    pub columns_axis: Vec<DimensionExpression>,
    pub rows_axis: Vec<DimensionExpression>,
    pub measures: Vec<MeasureExpression>,
}

// Example MDX Query:
// SELECT
//   {[Measures].[Net Sales], [Measures].[Gross Margin %]} ON COLUMNS,
//   {[Time].[Calendar].[Year].Members} ON ROWS
// FROM [Sales Analysis]
// WHERE [Product].[Product Hierarchy].[Division].[Electronics]

pub async fn execute_mdx_query(
    query: MdxQuery,
    cube: &OlapCube,
) -> Result<MdxResult, AnalysisError> {
    // Parse MDX query
    // Generate SQL from MDX
    // Execute against star schema
    // Format results as multi-dimensional result set
    todo!()
}

pub struct MdxResult {
    pub column_headers: Vec<String>,
    pub row_headers: Vec<String>,
    pub cells: Vec<Vec<CellValue>>,
}

pub enum CellValue {
    Number(Decimal),
    String(String),
    Null,
}
```

### 13.4 实时数据处理

```rust
// Real-time streaming data pipeline
pub struct StreamingPipeline {
    pub pipeline_id: Uuid,
    pub pipeline_name: String,
    pub source_topic: String,          // Kafka topic
    pub sink_table: String,
    
    // Processing
    pub window_type: WindowType,
    pub window_size: Duration,
    pub aggregations: Vec<StreamAggregation>,
    
    // Watermark (for handling late data)
    pub watermark_column: String,
    pub allowed_lateness: Duration,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WindowType {
    Tumbling,              // Fixed, non-overlapping windows
    Sliding,              // Overlapping windows
    Session,              // Dynamic windows based on activity
}

pub struct StreamAggregation {
    pub aggregation_name: String,
    pub aggregation_function: AggregationFunction,
    pub measure_column: String,
    pub group_by_columns: Vec<String>,
}

// Real-time Sales Dashboard
// Updates every minute with latest sales data
pub async fn process_realtime_sales_stream(
    kafka_consumer: &KafkaConsumer,
) -> Result<(), StreamError> {
    loop {
        let messages = kafka_consumer.poll_messages().await?;
        
        for message in messages {
            let sales_event: SalesOrderCreated = 
                serde_json::from_slice(&message.payload)?;
            
            // Update real-time aggregates
            update_realtime_sales_aggregate(sales_event).await?;
        }
    }
}

pub async fn update_realtime_sales_aggregate(
    event: SalesOrderCreated,
) -> Result<(), StreamError> {
    // Upsert into real-time aggregate table
    // UPDATE or INSERT aggregate_sales_realtime
    // SET net_sales = net_sales + event.net_value,
    //     order_count = order_count + 1,
    //     last_updated = NOW()
    // WHERE date = TODAY AND customer_id = event.customer_id
    Ok(())
}
```

文档继续...

### 13.5 报表与仪表板

#### 13.5.1 报表定义

```rust
pub struct Report {
    pub report_id: Uuid,
    pub report_name: String,
    pub report_type: ReportType,
    pub category: ReportCategory,
    
    // Data Source
    pub data_source: DataSource,
    pub query: QueryDefinition,
    
    // Layout
    pub layout: ReportLayout,
    pub parameters: Vec<ReportParameter>,
    
    // Visualization
    pub visualizations: Vec<Visualization>,
    
    // Scheduling
    pub schedule: Option<ReportSchedule>,
    pub output_formats: Vec<OutputFormat>,
    pub distribution_list: Vec<String>,
    
    // Security
    pub access_control: AccessControl,
    
    // Metadata
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub last_modified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReportType {
    Operational,          // Transactional detailed reports
    Analytical,          // Aggregated analytical reports
    Dashboard,           // KPI dashboard
    AdHoc,              // User-defined queries
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReportCategory {
    Financial,
    Sales,
    Purchasing,
    Inventory,
    Production,
    HumanResources,
    Executive,
}

pub struct QueryDefinition {
    pub query_type: QueryType,
    pub sql_query: Option<String>,
    pub mdx_query: Option<String>,
    pub cube_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum QueryType {
    DirectSql,
    MdxCube,
    StoredProcedure,
    RestApi,
}

pub struct ReportLayout {
    pub page_size: PageSize,
    pub orientation: PageOrientation,
    pub sections: Vec<ReportSection>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PageSize {
    A4,
    Letter,
    Legal,
    Custom { width_mm: u16, height_mm: u16 },
}

pub struct ReportSection {
    pub section_type: SectionType,
    pub section_name: String,
    pub content: SectionContent,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SectionType {
    Header,
    Body,
    Footer,
    GroupHeader,
    GroupFooter,
}

pub struct ReportParameter {
    pub parameter_name: String,
    pub parameter_type: ParameterType,
    pub default_value: Option<String>,
    pub is_required: bool,
    pub display_label: String,
    pub data_source: Option<ParameterDataSource>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParameterType {
    Text,
    Number,
    Date,
    DateRange,
    SingleSelect,
    MultiSelect,
    Boolean,
}

pub struct Visualization {
    pub viz_id: Uuid,
    pub viz_type: VisualizationType,
    pub title: String,
    pub data_query: QueryDefinition,
    pub config: VisualizationConfig,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VisualizationType {
    Table,
    PivotTable,
    LineChart,
    BarChart,
    PieChart,
    ScatterPlot,
    Heatmap,
    GaugeChart,
    TreeMap,
    Waterfall,
    FunnelChart,
    GeoMap,
}

pub struct VisualizationConfig {
    pub x_axis: Option<AxisConfig>,
    pub y_axis: Option<AxisConfig>,
    pub series: Vec<SeriesConfig>,
    pub colors: Vec<String>,
    pub legend: LegendConfig,
    pub tooltip: TooltipConfig,
}

// Standard Financial Reports
pub struct StandardReports;

impl StandardReports {
    // Balance Sheet
    pub fn balance_sheet() -> Report {
        Report {
            report_id: Uuid::new_v4(),
            report_name: "Balance Sheet".to_string(),
            report_type: ReportType::Financial,
            category: ReportCategory::Financial,
            data_source: DataSource::Cube("Financial Analysis".to_string()),
            query: QueryDefinition {
                query_type: QueryType::MdxCube,
                sql_query: None,
                mdx_query: Some("
                    SELECT
                      {[Measures].[Closing Balance]} ON COLUMNS,
                      {[Account].[Financial Statement].[Asset].Children,
                       [Account].[Financial Statement].[Liability].Children,
                       [Account].[Financial Statement].[Equity].Children} ON ROWS
                    FROM [Financial Analysis]
                    WHERE [Time].[Fiscal Period].[Last Period]
                ".to_string()),
                cube_name: Some("Financial Analysis".to_string()),
            },
            layout: ReportLayout {
                page_size: PageSize::A4,
                orientation: PageOrientation::Portrait,
                sections: vec![
                    ReportSection {
                        section_type: SectionType::Header,
                        section_name: "Report Header".to_string(),
                        content: SectionContent::Text {
                            content: "Balance Sheet".to_string(),
                            style: TextStyle::Heading1,
                        },
                    },
                    ReportSection {
                        section_type: SectionType::Body,
                        section_name: "Assets".to_string(),
                        content: SectionContent::Table {
                            columns: vec![
                                "Account".to_string(),
                                "Current Period".to_string(),
                                "Previous Period".to_string(),
                                "Variance".to_string(),
                            ],
                        },
                    },
                ],
            },
            parameters: vec![
                ReportParameter {
                    parameter_name: "CompanyCode".to_string(),
                    parameter_type: ParameterType::SingleSelect,
                    default_value: None,
                    is_required: true,
                    display_label: "Company Code".to_string(),
                    data_source: Some(ParameterDataSource::Query(
                        "SELECT DISTINCT company_code FROM dim_company".to_string()
                    )),
                },
                ReportParameter {
                    parameter_name: "FiscalYear".to_string(),
                    parameter_type: ParameterType::Number,
                    default_value: Some("2025".to_string()),
                    is_required: true,
                    display_label: "Fiscal Year".to_string(),
                    data_source: None,
                },
                ReportParameter {
                    parameter_name: "Period".to_string(),
                    parameter_type: ParameterType::Number,
                    default_value: Some("12".to_string()),
                    is_required: true,
                    display_label: "Period".to_string(),
                    data_source: None,
                },
            ],
            visualizations: vec![],
            schedule: None,
            output_formats: vec![OutputFormat::Pdf, OutputFormat::Excel],
            distribution_list: vec![],
            access_control: AccessControl {
                owner: UserId::nil(),
                allowed_roles: vec!["CFO".to_string(), "Controller".to_string()],
                allowed_users: vec![],
            },
            created_by: UserId::nil(),
            created_at: Utc::now(),
            last_modified_at: Utc::now(),
        }
    }
    
    // Profit & Loss Statement
    pub fn profit_loss_statement() -> Report {
        // Similar structure to Balance Sheet
        todo!()
    }
    
    // Cash Flow Statement
    pub fn cash_flow_statement() -> Report {
        todo!()
    }
    
    // Sales Performance Report
    pub fn sales_performance_report() -> Report {
        todo!()
    }
    
    // Inventory Aging Report
    pub fn inventory_aging_report() -> Report {
        todo!()
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OutputFormat {
    Pdf,
    Excel,
    Csv,
    Json,
    Html,
}
```

#### 13.5.2 仪表板设计

```rust
pub struct Dashboard {
    pub dashboard_id: Uuid,
    pub dashboard_name: String,
    pub dashboard_type: DashboardType,
    pub category: ReportCategory,
    
    // Layout
    pub layout: DashboardLayout,
    pub widgets: Vec<DashboardWidget>,
    
    // Refresh
    pub refresh_interval_seconds: Option<u32>,
    pub auto_refresh: bool,
    
    // Filters (apply to all widgets)
    pub global_filters: Vec<DashboardFilter>,
    
    // Security
    pub access_control: AccessControl,
    
    // Metadata
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub last_viewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DashboardType {
    Executive,           // High-level KPIs for executives
    Operational,        // Operational metrics for managers
    Analytical,         // Detailed analysis for analysts
    RealTime,          // Real-time monitoring
}

pub struct DashboardLayout {
    pub rows: Vec<LayoutRow>,
    pub responsive: bool,
}

pub struct LayoutRow {
    pub row_height: u16,
    pub columns: Vec<LayoutColumn>,
}

pub struct LayoutColumn {
    pub width_percentage: u8,
    pub widget_id: Uuid,
}

pub struct DashboardWidget {
    pub widget_id: Uuid,
    pub widget_type: WidgetType,
    pub title: String,
    pub data_source: DataSource,
    pub visualization: Visualization,
    pub refresh_interval_seconds: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WidgetType {
    Kpi,                // Single number with trend
    Chart,
    Table,
    PivotTable,
    Text,
    Image,
}

pub struct DashboardFilter {
    pub filter_name: String,
    pub dimension: String,
    pub filter_type: FilterType,
    pub selected_values: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FilterType {
    SingleSelect,
    MultiSelect,
    DateRange,
    NumberRange,
}

// Executive Dashboard Example
pub fn create_executive_dashboard() -> Dashboard {
    Dashboard {
        dashboard_id: Uuid::new_v4(),
        dashboard_name: "Executive Dashboard".to_string(),
        dashboard_type: DashboardType::Executive,
        category: ReportCategory::Executive,
        layout: DashboardLayout {
            rows: vec![
                // Row 1: Key KPIs
                LayoutRow {
                    row_height: 150,
                    columns: vec![
                        LayoutColumn {
                            width_percentage: 25,
                            widget_id: Uuid::new_v4(), // Revenue KPI
                        },
                        LayoutColumn {
                            width_percentage: 25,
                            widget_id: Uuid::new_v4(), // Gross Margin KPI
                        },
                        LayoutColumn {
                            width_percentage: 25,
                            widget_id: Uuid::new_v4(), // EBITDA KPI
                        },
                        LayoutColumn {
                            width_percentage: 25,
                            widget_id: Uuid::new_v4(), // Cash Balance KPI
                        },
                    ],
                },
                // Row 2: Charts
                LayoutRow {
                    row_height: 400,
                    columns: vec![
                        LayoutColumn {
                            width_percentage: 60,
                            widget_id: Uuid::new_v4(), // Revenue Trend Chart
                        },
                        LayoutColumn {
                            width_percentage: 40,
                            widget_id: Uuid::new_v4(), // Top Products Pie Chart
                        },
                    ],
                },
                // Row 3: Detailed Tables
                LayoutRow {
                    row_height: 300,
                    columns: vec![
                        LayoutColumn {
                            width_percentage: 100,
                            widget_id: Uuid::new_v4(), // Sales by Region Table
                        },
                    ],
                },
            ],
            responsive: true,
        },
        widgets: vec![
            // Revenue KPI Widget
            DashboardWidget {
                widget_id: Uuid::new_v4(),
                widget_type: WidgetType::Kpi,
                title: "Total Revenue".to_string(),
                data_source: DataSource::Cube("Sales Analysis".to_string()),
                visualization: Visualization {
                    viz_id: Uuid::new_v4(),
                    viz_type: VisualizationType::GaugeChart,
                    title: "Total Revenue".to_string(),
                    data_query: QueryDefinition {
                        query_type: QueryType::MdxCube,
                        sql_query: None,
                        mdx_query: Some("
                            SELECT {[Measures].[Net Sales]} ON COLUMNS
                            FROM [Sales Analysis]
                            WHERE [Time].[Calendar].[Current Month]
                        ".to_string()),
                        cube_name: Some("Sales Analysis".to_string()),
                    },
                    config: VisualizationConfig {
                        x_axis: None,
                        y_axis: None,
                        series: vec![],
                        colors: vec!["#4CAF50".to_string()],
                        legend: LegendConfig { show: false, position: LegendPosition::Right },
                        tooltip: TooltipConfig { enabled: true },
                    },
                },
                refresh_interval_seconds: Some(300), // 5 minutes
            },
            // More widgets...
        ],
        refresh_interval_seconds: Some(300),
        auto_refresh: true,
        global_filters: vec![
            DashboardFilter {
                filter_name: "Time Period".to_string(),
                dimension: "Time".to_string(),
                filter_type: FilterType::DateRange,
                selected_values: vec!["Last 12 Months".to_string()],
            },
        ],
        access_control: AccessControl {
            owner: UserId::nil(),
            allowed_roles: vec!["Executive".to_string(), "CEO".to_string(), "CFO".to_string()],
            allowed_users: vec![],
        },
        created_by: UserId::nil(),
        created_at: Utc::now(),
        last_viewed_at: None,
    }
}
```

### 13.6 API 规格

#### 13.6.1 数据仓库管理 API

```rust
// POST /api/v1/bi/etl-pipelines/{pipeline_id}/execute
pub struct ExecuteEtlPipelineRequest {
    pub execution_mode: String,        // Full, Incremental
    pub parameters: HashMap<String, String>,
}

pub struct ExecuteEtlPipelineResponse {
    pub run_id: Uuid,
    pub pipeline_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
}

// GET /api/v1/bi/etl-pipelines/{pipeline_id}/runs/{run_id}
pub struct GetEtlRunStatusResponse {
    pub run_id: Uuid,
    pub pipeline_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<u64>,
    pub rows_extracted: u64,
    pub rows_loaded: u64,
    pub rows_rejected: u64,
    pub error_message: Option<String>,
}

// POST /api/v1/bi/dimensions/{dimension_name}/refresh
pub struct RefreshDimensionRequest {
    pub refresh_type: String,          // Full, Incremental, SCD
}

// GET /api/v1/bi/data-quality/report
pub struct GetDataQualityReportQuery {
    pub etl_run_id: Option<Uuid>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
    pub severity: Option<String>,
}

pub struct GetDataQualityReportResponse {
    pub total_checks: u64,
    pub passed_checks: u64,
    pub failed_checks: u64,
    pub quality_score: Decimal,
    pub rule_results: Vec<RuleResultDto>,
}
```

#### 13.6.2 OLAP查询 API

```rust
// POST /api/v1/bi/cubes/{cube_name}/query
pub struct ExecuteCubeQueryRequest {
    pub query_type: String,            // MDX, SQL
    pub query: String,
    pub parameters: Option<HashMap<String, String>>,
}

pub struct ExecuteCubeQueryResponse {
    pub query_id: Uuid,
    pub result_set: ResultSet,
    pub execution_time_ms: u64,
    pub row_count: u64,
}

pub struct ResultSet {
    pub columns: Vec<ColumnMetadata>,
    pub rows: Vec<Vec<serde_json::Value>>,
}

pub struct ColumnMetadata {
    pub column_name: String,
    pub data_type: String,
    pub format: Option<String>,
}

// POST /api/v1/bi/cubes/{cube_name}/drill-down
pub struct DrillDownRequest {
    pub current_level: String,
    pub hierarchy: String,
    pub member: String,
    pub measures: Vec<String>,
}

// POST /api/v1/bi/cubes/{cube_name}/drill-through
pub struct DrillThroughRequest {
    pub cell_coordinates: HashMap<String, String>,
    pub max_rows: Option<u32>,
}

pub struct DrillThroughResponse {
    pub fact_table_rows: Vec<FactTableRow>,
    pub total_count: u64,
}
```

#### 13.6.3 报表与仪表板 API

```rust
// POST /api/v1/bi/reports
pub struct CreateReportRequest {
    pub report_name: String,
    pub report_type: String,
    pub category: String,
    pub data_source: DataSourceRequest,
    pub query: QueryDefinitionRequest,
    pub layout: ReportLayoutRequest,
    pub parameters: Vec<ReportParameterRequest>,
}

// POST /api/v1/bi/reports/{report_id}/execute
pub struct ExecuteReportRequest {
    pub parameters: HashMap<String, String>,
    pub output_format: String,
}

pub struct ExecuteReportResponse {
    pub report_execution_id: Uuid,
    pub status: String,
    pub output_url: Option<String>,    // URL to download the report
}

// GET /api/v1/bi/reports/{report_id}/executions/{execution_id}/status
pub struct GetReportExecutionStatusResponse {
    pub execution_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub output_url: Option<String>,
    pub error_message: Option<String>,
}

// POST /api/v1/bi/dashboards
pub struct CreateDashboardRequest {
    pub dashboard_name: String,
    pub dashboard_type: String,
    pub category: String,
    pub layout: DashboardLayoutRequest,
    pub widgets: Vec<DashboardWidgetRequest>,
}

// GET /api/v1/bi/dashboards/{dashboard_id}
pub struct GetDashboardResponse {
    pub dashboard: DashboardDto,
    pub widgets: Vec<DashboardWidgetDto>,
    pub data: HashMap<Uuid, WidgetData>, // widget_id -> data
}

// POST /api/v1/bi/dashboards/{dashboard_id}/refresh
pub struct RefreshDashboardRequest {
    pub widget_ids: Option<Vec<Uuid>>,  // Specific widgets or all if None
}

pub struct RefreshDashboardResponse {
    pub dashboard_id: Uuid,
    pub refreshed_widgets: Vec<Uuid>,
    pub updated_at: DateTime<Utc>,
}
```

#### 13.6.4 实时分析 API

```rust
// GET /api/v1/bi/realtime/sales/summary
pub struct GetRealtimeSalesSummaryQuery {
    pub time_window_minutes: Option<u32>,
    pub group_by: Option<Vec<String>>, // customer, product, region
}

pub struct GetRealtimeSalesSummaryResponse {
    pub as_of_timestamp: DateTime<Utc>,
    pub time_window: String,
    pub metrics: RealtimeMetrics,
    pub breakdown: Vec<RealtimeBreakdown>,
}

pub struct RealtimeMetrics {
    pub total_orders: u64,
    pub total_sales: Decimal,
    pub average_order_value: Decimal,
    pub orders_per_minute: Decimal,
}

// WebSocket endpoint for real-time updates
// ws://api/v1/bi/realtime/stream
pub struct RealtimeStreamMessage {
    pub message_type: String,          // MetricUpdate, Alert
    pub timestamp: DateTime<Utc>,
    pub metric_name: String,
    pub metric_value: serde_json::Value,
}
```

### 13.7 数据治理

```rust
pub struct DataLineage {
    pub lineage_id: Uuid,
    pub target_table: String,
    pub target_column: Option<String>,
    pub lineage_graph: LineageGraph,
}

pub struct LineageGraph {
    pub nodes: Vec<LineageNode>,
    pub edges: Vec<LineageEdge>,
}

pub struct LineageNode {
    pub node_id: String,
    pub node_type: LineageNodeType,
    pub object_name: String,
    pub schema_name: Option<String>,
    pub database_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LineageNodeType {
    SourceTable,
    StagingTable,
    TransformationProcess,
    DimensionTable,
    FactTable,
    Cube,
    Report,
}

pub struct LineageEdge {
    pub from_node_id: String,
    pub to_node_id: String,
    pub transformation_type: Option<String>,
}

pub struct DataCatalog {
    pub catalog_entries: Vec<CatalogEntry>,
}

pub struct CatalogEntry {
    pub entry_id: Uuid,
    pub object_type: CatalogObjectType,
    pub object_name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub owner: UserId,
    pub steward: Option<UserId>,
    pub sensitivity_classification: SensitivityLevel,
    pub retention_policy: RetentionPolicy,
    pub usage_statistics: UsageStatistics,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SensitivityLevel {
    Public,
    Internal,
    Confidential,
    HighlyConfidential,
}

pub struct RetentionPolicy {
    pub retention_period_days: u32,
    pub archive_after_days: Option<u32>,
    pub delete_after_days: Option<u32>,
}

pub struct UsageStatistics {
    pub query_count_last_30_days: u64,
    pub unique_users_last_30_days: u64,
    pub last_accessed_at: Option<DateTime<Utc>>,
}
```

### 13.8 性能优化策略

```rust
pub struct AggregationTable {
    pub agg_table_id: Uuid,
    pub agg_table_name: String,
    pub base_fact_table: String,
    pub dimensions: Vec<String>,
    pub measures: Vec<String>,
    pub aggregation_level: AggregationLevel,
    pub refresh_strategy: RefreshStrategy,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AggregationLevel {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RefreshStrategy {
    FullRefresh,
    IncrementalAppend,
    IncrementalMerge,
}

// Partitioning Strategy
pub struct PartitioningConfig {
    pub table_name: String,
    pub partition_type: PartitionType,
    pub partition_column: String,
    pub partitions: Vec<Partition>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PartitionType {
    Range,               // Range partitioning (e.g., by date)
    List,                // List partitioning (e.g., by country)
    Hash,                // Hash partitioning
}

pub struct Partition {
    pub partition_name: String,
    pub partition_value: PartitionValue,
    pub row_count: u64,
    pub size_mb: u64,
}

pub enum PartitionValue {
    Range { start: String, end: String },
    List { values: Vec<String> },
    Hash { hash_value: u32 },
}

// Materialized View for performance
pub struct MaterializedView {
    pub view_id: Uuid,
    pub view_name: String,
    pub view_definition: String,         // SQL definition
    pub base_tables: Vec<String>,
    pub refresh_method: RefreshMethod,
    pub refresh_schedule: Option<RefreshSchedule>,
    pub last_refreshed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RefreshMethod {
    Complete,            // Full refresh
    Fast,               // Incremental based on logs
    Force,              // Force complete refresh
    OnDemand,           // Manual refresh only
}
```

### 13.9 领域事件

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BiDomainEvent {
    EtlPipelineExecuted(EtlPipelineExecuted),
    DataQualityIssueDetected(DataQualityIssueDetected),
    DimensionUpdated(DimensionUpdated),
    CubeProcessed(CubeProcessed),
    ReportGenerated(ReportGenerated),
    DashboardViewed(DashboardViewed),
    AlertTriggered(AlertTriggered),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPipelineExecuted {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub run_id: Uuid,
    pub pipeline_id: Uuid,
    pub pipeline_name: String,
    pub status: String,
    pub duration_seconds: u64,
    pub rows_extracted: u64,
    pub rows_loaded: u64,
    pub rows_rejected: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataQualityIssueDetected {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub etl_run_id: Uuid,
    pub rule_id: Uuid,
    pub rule_name: String,
    pub severity: String,
    pub table_name: String,
    pub failed_row_count: u64,
    pub sample_failures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CubeProcessed {
    pub event_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub cube_id: Uuid,
    pub cube_name: String,
    pub processing_type: String,
    pub duration_seconds: u64,
    pub aggregation_count: u64,
}
```

---

## 结语：完整的 Rust ERP 技术蓝图

本 **Rust Domain Specifications** 文档现已完整，涵盖 **13个核心业务模块**：

### 业务模块 (12个)
1. ✅ **FI (Financial Accounting)** - 财务会计
2. ✅ **CO (Controlling)** - 成本控制
3. ✅ **MM (Materials Management)** - 物料管理
4. ✅ **SD (Sales & Distribution)** - 销售分销
5. ✅ **PP (Production Planning)** - 生产计划
6. ✅ **WM/EWM (Warehouse Management)** - 仓库管理
7. ✅ **QM (Quality Management)** - 质量管理
8. ✅ **PM (Plant Maintenance)** - 设备维护
9. ✅ **PS (Project System)** - 项目系统
10. ✅ **HCM (Human Capital Management)** - 人力资源
11. ✅ **TR (Treasury)** - 资金管理
12. ✅ **Cross-Module Integration** - 跨模块集成

### 分析模块 (1个)
13. ✅ **BW/BI (Business Intelligence)** - 商业智能与数据仓库
    - 分层架构（Staging → ODS → DW → Data Mart → Semantic）
    - 维度建模（星型/雪花模式）
    - 12个核心事实表和8个主维度表
    - ETL框架（提取、转换、加载）
    - 数据质量管理
    - SCD Type 2 实现
    - OLAP多维分析
    - MDX查询引擎
    - 实时数据流处理
    - 标准财务报表（资产负债表、损益表、现金流量表）
    - 高管仪表板
    - 数据治理（血缘分析、数据目录）
    - 性能优化（聚合表、分区、物化视图）

## 📚 完整文档体系

您现在拥有完整的4份技术文档：

| 文档 | 用途 | 内容 |
|------|------|------|
| **Rust-BOM.md** | 功能清单 | 15个业务领域的完整功能列表 |
| **Rust-Abc-Enhanced.md** | 开发计划 | 5人团队12个月详细时间表 |
| **Rust-Implementation-Guide.md** | 实施指南 | 技术标准、架构模式、最佳实践 |
| **Rust-Domain-Specifications.md** | 领域规格 | 数据模型、API、事件、业务规则 |

## 🎯 技术亮点

### 数据仓库架构
- **5层架构**：Staging → ODS → DW → Data Mart → Semantic Layer
- **星型模式**：12个事实表 + 8个核心维度表
- **SCD处理**：支持Type 0-6的缓慢变化维度

### ETL能力
- **多种提取模式**：Full、Incremental、CDC、Real-time
- **数据质量**：7种质量规则类型
- **错误处理**：拒绝行/批次、隔离、使用默认值

### 分析能力
- **OLAP Cube**：多维分析、钻取、上卷、切片、切块
- **MDX查询**：支持复杂多维查询
- **实时分析**：流式处理、滚动窗口、会话窗口

### 报表系统
- **标准报表**：资产负债表、损益表、现金流量表
- **可视化**：12种图表类型
- **仪表板**：响应式布局、自动刷新

### 性能优化
- **聚合表**：预计算常用聚合
- **分区**：Range/List/Hash分区
- **物化视图**：快速查询响应

## 🚀 下一步行动

1. **架构设计评审** - 与架构师评审整体技术方案
2. **数据库设计** - 创建DDL脚本和初始数据
3. **API开发** - 基于API规格实现RESTful接口
4. **ETL开发** - 实现数据抽取、转换、加载流程
5. **报表开发** - 开发标准报表和仪表板
6. **集成测试** - 验证端到端业务流程

您的团队现在拥有构建世界级企业ERP系统所需的完整技术蓝图！🎉
