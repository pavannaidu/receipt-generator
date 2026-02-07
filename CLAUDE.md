# CLAUDE.md

## Project Overview

Receipt Generator is a cross-platform desktop/mobile app built with **Tauri v2 + React 19** for creating, managing, and exporting business receipts and estimates. Target market is Indian small businesses — currency is formatted as Indian Rupees (INR with lakh/crore grouping via `formatIndianCurrency`).

Core features: multi-business support, FIFO inventory tracking, customer management, PDF export, sales analytics. Uses SQLite (via Tauri plugin) for persistence with localStorage fallback for browser mode.

## Commands

```bash
# Frontend development
npm start                          # React dev server on port 3000
npm test                           # Jest test runner (watch mode)
npm run build                      # Production build → build/

# Desktop (Tauri) — requires Rust toolchain
npm run tauri:dev                  # Desktop dev with hot-reload
npm run tauri:build                # Build desktop release

# Android — requires Java 17 + Android SDK + Rust Android targets
npm run tauri:android:init         # Initialize Android project
npm run tauri:android:dev          # Test Android app
npm run tauri:android:build --apk  # Build APK
npm run tauri:android:build:aab    # Build Android App Bundle
```

## Architecture

```
src/                    # React frontend (~4,500 LOC)
├── components/         # 13 UI components (PascalCase .jsx)
│   ├── index.js        # Barrel export — import from here
│   ├── ReceiptPreview.jsx         # Receipt display/editing
│   ├── InventoryDashboard.jsx     # Stock entry table + search
│   ├── BusinessSelector.jsx       # Business switcher dropdown
│   ├── BusinessManager.jsx        # Create/manage businesses modal
│   ├── BusinessSettingsModal.jsx   # Edit business details
│   ├── PrintPreviewModal.jsx      # Print preview + PDF export
│   ├── SalesChart.jsx             # Revenue visualization
│   ├── DeleteModal.jsx            # Confirmation dialog
│   ├── MergeModal.jsx             # Merge/rename product names
│   ├── StockProgressBar.jsx       # Visual stock remaining indicator
│   ├── MobileDrawer.jsx           # Mobile navigation drawer
│   └── Skeleton.jsx               # Loading placeholders
├── hooks/              # 10 custom hooks (camelCase use*.js)
│   ├── index.js        # Barrel export — import from here
│   ├── useDataLoader.js           # Core data loading & DB sync
│   ├── useReceiptManagement.js    # Receipt CRUD & bill numbering
│   ├── useStockManagement.js      # Stock CRUD, FIFO deduction, merge
│   ├── useCustomerManagement.js   # Customer CRUD
│   ├── useBusinessManagement.js   # Business selection & management
│   ├── useInventoryFilters.js     # Inventory search/filter/sort
│   ├── useHistoryFilters.js       # Receipt history filtering
│   ├── useKeyboardShortcuts.js    # Keyboard bindings
│   ├── usePagination.js           # Pagination logic
│   └── useMediaQuery.js           # Responsive breakpoints
├── contexts/           # React context providers
│   ├── index.js        # Barrel export
│   ├── ThemeContext.jsx           # Dark/light theme + styled helpers
│   └── BusinessContext.jsx        # Multi-business state
├── utils/
│   ├── formatters.js              # formatIndianCurrency()
│   ├── dateUtils.js               # formatDate(), getLocalDateString()
│   └── pdfExport.js               # exportReceiptToPDF()
├── constants/
│   ├── storageKeys.js             # STORAGE_KEYS for localStorage
│   └── defaults.js                # DEFAULT_BUSINESS_INFO, getDefaultReceipt(), etc.
├── styles/
│   └── theme.js                   # Theme color definitions
├── db.js               # Database interface (40+ functions) — ALL DB access goes here
├── App.js              # Root ReceiptGenerator component (~700 LOC, owns all state)
└── index.js            # React entry point, wraps in ThemeProvider + BusinessProvider
```

```
src-tauri/              # Rust/Tauri backend
├── src/main.rs         # Tauri entry point → calls lib::run()
├── src/lib.rs          # Plugin initialization (sql, dialog, fs, shell, store)
├── migrations/         # SQLite versioned migrations (001, 003, 004)
├── capabilities/       # Tauri security permissions (default.json)
├── tauri.conf.json     # App config: window 1200x800, plugins, bundling
└── Cargo.toml          # Rust dependencies
```

### Layered Design

1. **Components** (UI) → render data, handle user interaction via callbacks
2. **Hooks** (Logic) → business logic, state management, CRUD operations
3. **db.js** (Data) → all SQLite queries, migrations, connection management
4. **Contexts** → ThemeContext (dark/light), BusinessContext (multi-business state)

### State Management

**Critical**: `App.js` exports `ReceiptGenerator`, a single large component (~700 LOC) that owns almost all application state. State is lifted here and passed down to components/hooks. There is no Redux or other state management library — it's React hooks + context.

Flow: `App.js` → initializes hooks (`useDataLoader`, `useStockManagement`, etc.) → passes state + callbacks to child components as props.

### Key Patterns

- **Functional components with React hooks only** (no class components)
- **Business scoping**: all database queries filter by `business_id` for multi-business isolation
- **Dual-mode (Tauri/browser)**: every hook that writes data has `if (isTauri) { await db.call() }` followed by local state update. Browser mode skips DB and uses localStorage via `useDataLoader`
- **FIFO stock deduction**: `deductStockFIFO()` deducts oldest stock first; `restoreStockFIFO()` restores to newest entries first
- **Barrel exports**: always import from `./components`, `./hooks`, `./contexts` — never from individual files
- **Inline CSS objects** for styling, no CSS-in-JS framework
- **Responsive design** via `useMediaQuery` hook (`useIsMobile`, `useIsTablet`, `useDrawer`)
- **Soft deletes** for businesses (`is_active = 0`); hard deletes for all other entities

## Database

- **Engine**: SQLite via `@tauri-apps/plugin-sql`
- **Connection**: `sqlite:receipt_app.db` (path configurable via `settings.json` store)
- **Interface**: All queries go through `src/db.js` — never import SQL plugin directly in components

### Schema

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `businesses` | id, name, address, phone, gstin, icon, next_bill_no, is_active | Soft-delete via `is_active` |
| `stock_entries` | id, name, purchase_price, quantity, remaining, date, product_group, provider, business_id | `remaining` tracks FIFO |
| `item_prices` | id, name, selling_price, business_id | Unique on (name, business_id) |
| `receipts` | id, bill_no, date, customer_name, others, round_off, total, saved_at, business_id | |
| `receipt_items` | id, receipt_id, name, qty, rate, amount | FK to receipts |
| `customers` | id, name, phone, address, created_at, updated_at, business_id | |
| `bill_counter` | id, next_bill_no | Legacy — use `businesses.next_bill_no` instead |
| `business_info` | id, name, address, phone, gstin | Legacy — use `businesses` table instead |

### Migrations

Located in `src-tauri/migrations/`:
- `001_init.sql` — initial schema (stock_entries, item_prices, receipts, receipt_items, bill_counter, business_info)
- `003_customers.sql` — customers table with indexes
- `004_multi_business.sql` — businesses table + business_id columns

Runtime migrations in `db.js`: `migrateDatabase()` adds columns (product_group, provider) and calls `migrateToMultiBusiness()`.

## Naming Conventions

- **Components**: PascalCase (`ReceiptPreview.jsx`, `BusinessSelector.jsx`)
- **Hooks**: camelCase with `use` prefix (`useDataLoader.js`, `useStockManagement.js`)
- **Utilities**: camelCase (`formatIndianCurrency`, `getLocalDateString`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`, `DEFAULT_BUSINESS_INFO`)
- **Database functions**: camelCase with domain prefix (`addStockEntry`, `upsertItemPrice`)
- **IDs**: generated via `Date.now()` (not UUIDs)

## Tech Stack

- **Frontend**: React 19, jsPDF + html2canvas (PDF export)
- **Desktop**: Tauri v2 (Rust), plugins: sql, dialog, fs, shell, store
- **Build**: Create React App (react-scripts 5.0.1)
- **Test**: Jest + React Testing Library (minimal — only `App.test.js` placeholder exists)
- **CI/CD**: GitHub Actions (`.github/workflows/build.yml`)

### CI/CD Pipeline

- **Triggers**: tag push (`v*`) or manual dispatch
- **Desktop build**: Windows + macOS via `tauri-apps/tauri-action`, creates draft GitHub Release
- **Android build**: Ubuntu, debug APK, uploads to same release
- **Requirements**: Node 20, Rust stable, Java 17 (Android), Android SDK (Android)

## Important Notes

- ESLint config extends `react-app` + `react-app/jest` (configured in package.json)
- Theme colors: dark theme uses blue gradient (#1a1a2e → #0f3460) with red accent (#e94560); light theme uses light gray with indigo accent (#4f46e5)
- PDF generation in `src/utils/pdfExport.js` — html2canvas captures receipt DOM, jsPDF exports as PDF
- Android signing docs at `docs/ANDROID_SIGNING.md`
- Windows path normalization in db.js: backslashes → forward slashes for SQLite connection URLs
- `isTauri()` check in `db.js` detects runtime via `window.__TAURI_INTERNALS__`
- App identifier: `com.receipt.generator`
- Default window: 1200x800, resizable
- Min Android SDK: 24
