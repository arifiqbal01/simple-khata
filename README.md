# Simple Khata

**An offline-first digital khata for small shops in Pakistan.**

Simple Khata is a lightweight Android app for managing customer credit (*udhaar*), supplier accounts, items, payments, and running balances. It is designed to feel as quick and familiar as a handwritten khata notebook, while making records easier to manage and synchronize across devices.

> **Project status:** Early MVP (v0.2.0), independently developed and maintained by one developer. The Android app is being used on real devices. Features and setup may change as the project develops.

## Why Simple Khata?

Many small kiryana shops still manage customer credit, supplier payments, and purchases in notebooks. Over time, tracking transactions, finding records, and calculating balances becomes difficult.

Simple Khata focuses on everyday shopkeeping workflows without trying to become a complete point-of-sale or accounting platform.

## Features

- **Customer management:** Create, search, and manage customer khatas.
- **Udhaar tracking:** Record customer credit with optional item details.
- **Supplier management:** Maintain supplier accounts and transaction histories.
- **Supply tracking:** Record goods received from suppliers and supplier payments.
- **Item management:** Add, edit, search, and delete items with units and prices.
- **Supplier products:** Maintain supplier-specific product catalogs and pricing.
- **Running balances:** Track outstanding amounts and full or partial payments.
- **Transaction history:** Browse, filter, and delete ledger entries.
- **Offline-first:** Store transactions locally using SQLite without internet access.
- **Multi-device sync:** Synchronize changes through a FastAPI backend.
- **WhatsApp sharing:** Share ledger information through the device's sharing flow.

## How it works

```text
Android App (React Native + Expo)
              |
              v
        Local SQLite
              |
         Sync / Outbox
              |
              v
         FastAPI API
              |
              v
         PostgreSQL
```

Financial transactions are saved locally first. Changes are queued for synchronization and pushed to the backend when connectivity is available.

### Ledger entry types

| Entry | Meaning |
|---|---|
| Udhaar | Customer credit; increases the customer's outstanding balance |
| Supply | Goods received from a supplier; increases the amount owed |
| Payment | Reduces the outstanding balance |

Customer and supplier ledgers use shared party-based accounting workflows while maintaining separate account types.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo, TypeScript, Expo Router |
| Styling | NativeWind |
| Local database | SQLite (`expo-sqlite`) |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Migrations | Alembic |
| Synchronization | Offline-first push/pull with local outbox |
| Android builds | Expo Application Services (EAS) |

## Repository layout

```text
simple-khata/
├── mobile/                  # Expo / React Native Android app
├── backend/                 # FastAPI backend and migrations
├── docker-compose.yml       # Local development services
├── compose.production.yml   # Production Compose overrides
├── .env.example             # Environment variable template
├── CHANGELOG.md             # Version history
└── README.md
```

## Getting started

### Prerequisites

- Node.js and npm
- Python and backend dependencies, or Docker with Docker Compose
- Android device or emulator
- Expo / EAS account for APK builds

### 1. Clone the repository

```bash
git clone https://github.com/arifiqbal01/simple-khata.git
cd simple-khata
```

### 2. Configure the backend

Create a local environment file:

```bash
cp .env.example .env
```

Update the environment variables for your development setup.

Start the services:

```bash
docker compose up --build -d
```

Apply database migrations:

```bash
docker compose exec api alembic upgrade head
```

The development API is configured to run on port `8000`.

### 3. Run the mobile app

```bash
cd mobile
npm install
```

Configure the backend URL:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_DEVELOPMENT_MACHINE_IP:8000
```

Use an IP address reachable from your Android device.

Start Expo:

```bash
npx expo start
```

A development build may be required depending on the native modules and configuration.

### 4. Build an Android APK

Configure the EAS `preview` profile for APK output and provide the appropriate backend URL.

```bash
cd mobile
npx tsc --noEmit
npx eas-cli build --platform android --profile preview
```

Use a deployed HTTPS backend for distributed builds.

## Development and releases

- `develop` — ongoing development.
- `main` — stable release branch.
- `v0.1.0` — initial customer udhaar ledger.
- `v0.2.0` — supplier management, item catalogs, and expanded ledger workflows.

See [CHANGELOG.md](CHANGELOG.md) for version history.

Validate TypeScript, backend changes, database migrations, and offline synchronization before releasing.

**Important:** Do not uninstall the app or clear its data on devices containing unsynchronized financial records. Test upgrades over existing installations before distributing new APKs.

## Security and privacy

Simple Khata is designed to collect only the information required for ledger management. Its core workflow does not require CNIC numbers, profile photos, location tracking, or access to contacts.

For contributors and deployers:

- Never commit environment files, credentials, or secrets.
- Never store database credentials in `EXPO_PUBLIC_*` variables.
- Use HTTPS for deployed backend services.
- Keep development and production databases separate.
- Back up production data before database migrations.
- Avoid sharing real customer information or financial records in logs and screenshots.

## Roadmap

The immediate priority is reliability, testing, and improvements based on everyday use.

Potential improvements include:

- More flexible account and khata categories.
- Improved transaction notes and balance presentation.
- Enhanced supplier and item management.
- Further offline synchronization improvements.
- Better reporting and ledger sharing.

These are planned or exploratory improvements, not implemented features or release commitments.

## Maintainer

Simple Khata is independently developed and maintained by a solo developer. It is not presented as a registered company or commercial service.

Feedback from real-world use helps guide development.

## Contributing

Bug reports, suggestions, and pull requests are welcome.

Changes affecting balances, SQLite, database migrations, or synchronization should include a clear explanation and tests where possible.

Discuss significant data-model changes before implementation to avoid breaking compatibility with existing installations.

## License

**License not yet selected.**

The repository is public, but public visibility alone does not grant permission to copy, modify, redistribute, or commercially reuse the code.

Until a `LICENSE` file is added, please request permission before reusing the project.