# High-Concurrency Consultation Booking System

A type-safe, highly resilient backend engine built with **Node.js**, **TypeScript**, **Express**, and **Prisma v7** that allows patients to search for available doctor consultation slots and book them securely. The system features a production-ready **Optimistic Concurrency Control (OCC)** architecture to completely prevent double-bookings, even when multiple users attempt to reserve the exact same slot at the identical millisecond.

---

## 🚀 Key Technical Features

- **Optimistic Concurrency Control (OCC):** Uses an atomic version-checking token system within a database transaction block to guarantee slot isolation under extreme, concurrent thread loads.
- **Explicit State Machine Validation:** Enforces structural transition rules to prevent invalid shifts in booking status (e.g., blocking a cancelled booking from moving directly to completed).
- **Prisma v7 Driver Adapters:** Uses decoupled, modern driver configurations via `@prisma/adapter-pg` alongside a native PostgreSQL connection pool framework.
- **Containerized Environment:** Fully portable data infrastructure powered by Docker Compose, requiring zero local database installation.

---



## 📂 Project Directory Structure

```text
consultation-booking-system/
├── prisma/
│   ├── schema.prisma       # Database model architecture (Prisma v7 compliant)
│   └── seed.ts             # Auto-population script for testing slots
├── src/
│   ├── controllers/
│   │   └── bookingController.ts # HTTP Request/Response validation lifecycle handlers
│   ├── repositories/
│   │   └── bookingRepository.ts # Core transactional engine and database access layer
│   └── app.ts              # Primary server entry point, express routing, and bootstrap
├── .env                    # Application environment configuration variables
├── docker-compose.yml      # Isolated PostgreSQL container profile
├── package.json            # Scripts and project dependencies
├── prisma.config.ts        # Prisma v7 environment configuration layer
├── test-concurrency.ts    # Multi-threaded race condition validation script
└── tsconfig.json           # TypeScript compilation rule boundaries
```

---



## 🛠️ System Architecture & Concurrency Approach



### 1. Data Model Strategy

The relational schema splits data into two high-performance tables:

- **Slots:** Contains the doctor reference, start/end timestamps, availability status (`AVAILABLE`, `HELD`, `BOOKED`), and a critical version control token (`version`) initialized to `0`.
- **Bookings:** Tracks successful customer allocations and maps uniquely back to the slot record with its tracking status (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`).



### 2. The Atomic State Machine & Concurrency Lock

Instead of utilizing slow, block-level table locks (Pessimistic Locking) which degrade database performance under stress, this engine operates on an atomic optimistic state verification pattern:

1. The server reads the available slot row along with its tracking `version`.
2. It initiates a Prisma transaction block (`prisma.$transaction`).
3. It issues an atomic update conditional on both the ID and the version matching the initial read state:
  ```sql
   UPDATE slots SET status = 'BOOKED', version = version + 1 WHERE id = $1 AND version = $2 AND status = 'AVAILABLE';
  ```
4. If a separate thread completes an update first, the version changes. The second query updates exactly `0` rows, instantly tripping a conflict validation failure and triggering a safe, automatic database rollback.



### 🔄 Explicit Design & Limitations (Reviewer Context)

As requested by the assessment prompt, this system deliberately prioritizes structural soundness and correctness over an expansive feature set:

1. **Explicit State Machine:** Booking lifecycles are controlled via an internal validation map (`isValidTransition`). This strictly blocks invalid lifecycle shifts (e.g., preventing a user from moving a booking from `CANCELLED` directly to `COMPLETED`).
2. **What Was Left Out & Why:**
  - *Authentication/RBAC:* Omitted to focus entirely on the transactional concurrency requirements within the given time scope.
  - *Database Indexing:* The database uses standard primary keys. If scaled to millions of rows, we would add composite tracking indexes over `[doctor_id, start_time]` to keep querying performant.

---



## 🏁 Quick Start & Installation



### 1. Clone & Install Dependencies

```bash
npm install
```



### 2. Launch the PostgreSQL Container

Ensure Docker Desktop is open and running, then boot up the isolated database service background worker:

```bash
docker compose up -d
```



### 3. Sync Database Tables & Generate Prisma Engine

Map out your table constraints directly to the live Docker environment instance:

```bash
npm run db:setup
npm run prisma:generate
```

### 4. Seed Testing Slots & Reset Identity Sequences

Populate the database with clean sample slots. This script triggers an explicit, ordered async deletion sequence and restarts identity tracking sequences back to 1:

```bash
npx prisma db seed
```



### 5. Boot Up the Development Server

```bash
npm run dev
```

The application will begin actively listening on: `http://localhost:3000`

---



## 🌐 API Endpoint Documentation



### 1. Fetch Available Slots

- **Endpoint:** `GET /api/slots/available`
- **Response Status:** `200 OK`
- **Payload Structure:** Returns a list of all open appointments sorted chronologically.



### 2. Book a Consultation

- **Endpoint:** `POST /api/bookings`
- **Content-Type:** `application/json`
- **Body:** `{ "slotId": 1, "patientId": "patient_alice" }`
- **Responses:**
  - `201 Created`: Appointment successfully captured.
  - `409 Conflict`: Double-booking safely prevented; slot captured by another thread.
  - `400 Bad Request`: Missing mandatory parameters.



### 3. Change Booking Status (State Machine)

- **Endpoint:** `PATCH /api/bookings/:id/status`
- **Content-Type:** `application/json`
- **Body:** `{ "status": "CANCELLED" }`
- **Responses:**
  - `200 OK`: Booking status updated successfully. If cancelled, the slot is atomically freed back to the available pool.
  - `400 Bad Request`: Illegal state machine transition or invalid status string parameter.

---



## 🧪 Empirically Proving the Concurrency Fix

We built a script (`test-concurrency.ts`) that triggers two simultaneous API requests at the identical millisecond targeting the same slot ID using `Promise.all`.

Keep your server running in your first terminal, open a secondary window, and execute the test:

```bash
npx ts-node test-concurrency.ts
```



### Actual Test Logs Output:

```text
🏁 Simulating 2 concurrent booking requests for Slot ID: 1...


--- Result for Request 1 (Alice) ---
Status: 201
Data: { message: 'Booking initialized and confirmed successfully!' }

--- Result for Request 2 (Bob) ---
Status: 409
Data: {
  error: 'Concurrency Conflict: Slot is no longer available. Please select another timing.'
}
```

---



## 🧠 Engineering Trade-offs & Scale Considerations

- **Soft Deletes vs Hard Deletes:** Cancelled records are preserved with their historical database IDs rather than hard deleted. This maintains a verifiable audit trail for compliance and medical safety tracking.
- **Integer Sequences Boundary:** Table IDs use standard 32-bit `Int` layouts supporting up to 2.1 billion rows. To scale to a global platform without a rewrite, we can easily change these columns to 8-byte `BigInt` (supporting 9.2 quintillion records) or transition to time-sorted `UUID v7` identifiers to completely eliminate database sequence exhaustion.

