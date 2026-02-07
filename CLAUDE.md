# CLAUDE.md

## Project Overview

Receipt Generator is a cross-platform desktop/mobile app built with **Tauri v2 + React 19** for creating, managing, and exporting business receipts and estimates. It features multi-business support, FIFO inventory tracking, customer management, and PDF export. Uses SQLite (via Tauri plugin) for persistence with localStorage fallback for browser mode.

## Commands

```bash
# Frontend development
npm start                          # React dev server on port 3000
npm test                           # Jest test runner (watch mode)
npm run build                      # Production build → build/

# Desktop (Tauri)
npm run tauri:dev                  # Desktop dev with hot-reload
npm run tauri:build                # Build desktop release

# Android
npm run tauri:android:init         # Initialize Android project
npm run tauri:android:dev          # Test Android app
npm run tauri:android:build --apk  # Build APK
```

## Architecture

```
src/                    # React frontend (~4,500 LOC)
├── components/         # UI components (PascalCase .jsx files)
├── hooks/              # Custom React hooks (camelCase use*.js)
├── contexts/           # ThemeContext, BusinessContext
├── utils/              # formatters, dateUtils, pdfExport
├── constants/          # App defaults and storage keys
├── styles/             # Theme definitions
├── db.js               # Database interface (40+ functions)
├── App.js              # Root component
└── index.js            # React entry point

src-tauri/              # Rust/Tauri backend
├── src/main.rs         # Tauri entry point → calls lib::run()
├── src/lib.rs          # Plugin initialization
├── migrations/         # SQLite versioned migrations
├── capabilities/       # Tauri security permissions
├── tauri.conf.json     # App config (window, plugins, bundling)
└── Cargo.toml          # Rust dependencies
```

### Layered Design

1. **Components** (UI) → render data, handle user interaction
2. **Hooks** (Logic) → business logic, state management, CRUD operations
3. **db.js** (Data) → all SQLite queries, migrations, connection management
4. **Contexts** → ThemeContext (dark/light), BusinessContext (multi-business state)

### Key Patterns

- Functional components with React hooks only (no class components)
- All database queries scoped by `business_id` for multi-business isolation
- FIFO stock deduction logic in `deductStockFIFO()` / `restoreStockFIFO()`
- Dual-mode: Tauri (SQLite) and browser (localStorage) via runtime detection in db.js
- Inline CSS objects for styling, no CSS-in-JS framework
- Responsive design via `useMediaQuery` hook (`useIsMobile`, `useIsTablet`)

## Database

- **Engine**: SQLite via `@tauri-apps/plugin-sql`
- **Connection**: `sqlite:receipt_app.db`
- **Tables**: businesses, stock_entries, item_prices, receipts, receipt_items, customers, bill_counter (legacy), business_info (legacy)
- **Migrations**: `src-tauri/migrations/` (001_init, 003_customers, 004_multi_business)
- **Interface**: All queries go through `src/db.js` — never import SQL plugin directly in components

## Naming Conventions

- **Components**: PascalCase (`ReceiptPreview.jsx`, `BusinessSelector.jsx`)
- **Hooks**: camelCase with `use` prefix (`useDataLoader.js`, `useStockManagement.js`)
- **Utilities**: camelCase (`formatIndianCurrency`, `getLocalDateString`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`, `DEFAULT_BUSINESS_INFO`)
- **Database functions**: camelCase with domain prefix (`addStockEntry`, `upsertItemPrice`)

## Tech Stack

- **Frontend**: React 19, jsPDF + html2canvas (PDF export)
- **Desktop**: Tauri v2 (Rust), plugins: sql, dialog, fs, shell, store
- **Build**: Create React App (react-scripts 5.0.1)
- **Test**: Jest + React Testing Library
- **CI/CD**: GitHub Actions (`.github/workflows/build.yml`) — builds desktop (Windows/macOS) and Android on tag push

## Important Notes

- ESLint config extends `react-app` (configured in package.json)
- Theme colors: dark theme uses blue gradient (#1a1a2e → #0f3460) with red accent (#e94560); light theme uses light gray with indigo accent (#4f46e5)
- PDF generation is in `src/utils/pdfExport.js` using html2canvas to capture and jsPDF to export
- Android signing docs at `docs/ANDROID_SIGNING.md`
- Windows path normalization exists in db.js for SQLite connection URLs
