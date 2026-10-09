# Simple Khata

**An offline-first digital udhaar ledger for small shops in Pakistan.**

Simple Khata is a lightweight Android app for recording customer credit (*udhaar*), payments, and running balances. It is designed to feel as quick and familiar as a handwritten khata notebook, while making records easier to find and keep in sync across devices.

> **Project status:** Early MVP, independently developed and maintained by one developer. The Android app is already being used on real devices. Features and setup may change as the project develops.

## Why Simple Khata?

Many small kiryana shops still track credit in notebooks. A customer buys groceries, the shopkeeper writes down an amount, and payments are recorded later. Over time, finding entries and calculating balances becomes difficult—especially when more than one person manages the ledger.

Simple Khata focuses on that everyday workflow rather than trying to become a complete point-of-sale or accounting platform.

## Features

- **Fast udhaar entry:** Record an amount against a customer, with optional item details.
- **Payment tracking:** Record full or partial payments and view the updated balance.
- **Customer khatas:** Search customers and review their transaction history.
- **Offline-first:** Record transactions without an internet connection using on-device SQLite.
- **Multi-device sync:** Synchronize local changes through a FastAPI backend when connectivity is available.
- **Quick items:** Reuse common item names during entry.
- **Transaction filters:** Browse and review ledger activity.
- **WhatsApp sharing:** Share ledger information using the device's sharing flow.

The same running ledger can also be useful for informal personal money records. Broader account categories are being explored based on real-world feedback; they are **not part of the current MVP**.

## How it works

```text
Android app (React Native + Expo)
             |
             v
       Local SQLite
             |
      Sync / outbox
             |
             v
        FastAPI API
             |
             v
        PostgreSQL
```

The app writes financial entries to local SQLite first and updates the interface immediately. Changes are queued for synchronization, pushed to the server when a connection is available, and pulled to other devices.

**The core ledger has two entry types:**

| Entry | Meaning |
| --- | --- |
| Udhaar | Value given on credit; increases the customer's outstanding balance |
| Payment | Value received; reduces the outstanding balance |

The running balance is calculated from these entries, including partial payments.

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native, Expo, TypeScript, Expo Router |
| Mobile styling | NativeWind |
| Local database | SQLite (`expo-sqlite`) |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Migrations | Alembic |
| Synchronization | Custom offline-first push/pull flow with queued local writes |
| Android builds | Expo Application Services (EAS) |

## Repository layout

```text
simple-khata/
├── mobile/                  # Expo / React Native Android app
├── backend/                 # FastAPI service and Alembic migrations
├── docker-compose.yml       # Local backend and PostgreSQL services
├── compose.production.yml   # Production-oriented Compose overrides
├── .env.example             # Environment variable template
└── README.md
```

## Getting started

### Prerequisites

- Node.js and npm
- Python and the backend dependencies, or Docker with Docker Compose
- Android device or emulator for the mobile app
- Expo / EAS account if you want to generate an installable APK

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd simple-khata
```

Replace the placeholder with this repository's HTTPS or SSH clone URL.

### 2. Configure the backend

Use `.env.example` as a reference for the required environment variables. For local development, create a root `.env` file with the values required by the Docker Compose configuration.

```bash
cp .env.example .env
# Edit .env for your local environment
```

Start the local services:

```bash
docker compose up --build -d
```

Apply database migrations:

```bash
docker compose exec api alembic upgrade head
```

The Compose configuration exposes the API on port `8000` for local development. Check the backend configuration and API documentation for the available routes.

### 3. Run the mobile app

```bash
cd mobile
npm install
```

Configure the API endpoint in the mobile environment:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_DEVELOPMENT_MACHINE_IP:8000
```

Use an address reachable from the Android device. `localhost` on a physical phone refers to the phone itself, not your computer.

Start Expo:

```bash
npx expo start
```

Depending on the native modules and build configuration, a development build may be required rather than Expo Go.

### 4. Build an Android APK

Configure an EAS `preview` profile with Android `buildType` set to `apk`, and ensure `EXPO_PUBLIC_API_URL` points to your deployed HTTPS backend during the build.

```bash
cd mobile
npx tsc --noEmit
npx eas-cli build --platform android --profile preview
```

The resulting APK can be installed on supported Android devices. Production deployments and releases should use their own environment configuration.

## Development and releases

- `develop` is used for ongoing development.
- `main` is intended for stable releases.
- Validate mobile TypeScript and backend changes before merging.
- Test offline writes, sync, and **upgrades over an existing installed APK** before distributing updates.

Because the app stores real financial records, do not uninstall the app or clear its data on a device with unsynchronized entries.

## Security and privacy

Simple Khata is designed to collect only the information needed for a ledger. It does not require CNIC numbers, profile photos, location tracking, or access to contacts for its core workflow.

**For contributors and deployers:**

- Never commit `.env`, `.env.production`, database credentials, or other secrets.
- Do not place database credentials in `EXPO_PUBLIC_*` variables; these are included in client builds.
- Use HTTPS for a deployed backend.
- Keep development and production databases separate.
- Back up production data before applying schema migrations.
- Avoid including real customer names, phone numbers, or financial records in issues, screenshots, and logs.

## Roadmap

The immediate priority is reliability and learning from everyday use. Potential future improvements include:

- Khata categories for customers, suppliers, wholesale buyers, personal contacts, and funds management
- Category filters with one shared balance and transaction history per person
- Context-aware transaction labels
- Further improvements to transaction notes and balance presentation

These are ideas under consideration, **not promises or implemented features**.

## Maintainer

Simple Khata is an independent project built and maintained by a solo developer. It is not presented as a registered company or commercial service. Feedback from real-world use helps guide development.

## Contributing

Bug reports, suggestions, and pull requests are welcome. For changes affecting balances, SQLite, migrations, or synchronization, please describe the expected behavior and include tests where possible.

Before contributing, check existing issues and discuss significant data-model changes to avoid breaking compatibility with installed versions.

## License

**License not yet selected.** The repository is public, but public visibility alone does not grant permission to copy, modify, redistribute, or commercially reuse the code.

The maintainer may choose an open-source license in the future. Until a `LICENSE` file is added, please ask for permission before reusing the code. No company or product registration is required to publish an individual project or choose an open-source license.
