# CipherShare

**Secure two-user file sharing with adaptive cryptographic key management.**

A Cryptography and Network Security mini-project featuring end-to-end encrypted file transfers, integrity verification, security monitoring, attack simulations, and performance benchmarking.

---

## Project Structure

```
CipherShare/
├── frontend/                  # React + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── components/        # React components (LandingPage, AuthPage)
│       ├── lib/               # API utilities and TypeScript types
│       ├── App.tsx            # Root component with auth state
│       └── main.tsx           # Entry point
├── backend/
│   ├── app/
│   │   ├── api/               # FastAPI route handlers (health, auth)
│   │   ├── core/              # Configuration, database setup
│   │   ├── models/            # SQLAlchemy ORM models (User)
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── services/          # Business logic (auth_service)
│   │   └── crypto/            # Cryptographic operations (future)
│   ├── tests/                 # pytest test suite
│   └── requirements.txt       # Python dependencies
├── experiments/
│   ├── benchmarks/            # Performance comparison scripts
│   └── attack_simulations/    # Controlled security tests
├── docs/                      # Architecture & threat-model documentation
├── .env.example               # Environment variable template
└── README.md
```

---

## Prerequisites

| Tool     | Version   |
|----------|-----------|
| Node.js  | >= 18      |
| npm      | >= 9       |
| Python   | >= 3.11    |
| pip      | >= 23      |

---

## Setup Instructions (Windows PowerShell)

### 1. Clone the repository

```powershell
git clone https://github.com/lingeshivakumar/CipherShare.git
cd CipherShare
```

### 2. Backend setup

```powershell
# Create and activate a virtual environment
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend setup

```powershell
cd frontend
npm install
```

### 4. Environment variables

```powershell
# From the project root
Copy-Item .env.example backend\.env
```

Edit `backend/.env` with your settings. **You must generate a JWT secret key:**

```powershell
# Generate a secure JWT secret key
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy the output and set it as `JWT_SECRET_KEY` in `backend/.env`. The application will refuse to start if this value is empty or set to a placeholder like `CHANGE_ME`.

**Required environment variables:**

| Variable                      | Description                                  | Default                     |
|-------------------------------|----------------------------------------------|-----------------------------|
| `APP_NAME`                    | Application display name                     | `CipherShare`              |
| `APP_VERSION`                 | Semantic version                             | `0.1.0`                    |
| `DEBUG`                       | Enable debug logging                         | `false`                    |
| `DATABASE_URL`                | SQLAlchemy database URL                      | `sqlite:///./ciphershare.db` |
| `CORS_ORIGINS`                | Comma-separated allowed origins              | `http://localhost:5173`    |
| `JWT_SECRET_KEY`              | **Required.** Signing secret for JWTs        | *(must be configured)*     |
| `JWT_ALGORITHM`               | JWT signing algorithm                        | `HS256`                    |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes                    | `30`                       |
| `PASSWORD_MIN_LENGTH`         | Minimum password length                      | `12`                       |
| `PASSWORD_MAX_LENGTH`         | Maximum password length                      | `128`                      |

---

## Running the Applications

### Start the backend (from `backend/`)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**.
- Swagger docs: http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/health

**Database initialisation:** On first startup, SQLite tables are created automatically via SQLAlchemy. The database file (`ciphershare.db`) is created in the `backend/` directory. For production, consider adding Alembic for schema migrations.

### Start the frontend (from `frontend/`)

```powershell
cd frontend
npm run dev
```

The frontend will be available at **http://localhost:5173**.
The Vite dev server proxies `/api` requests to the backend automatically.

---

## Running Tests

### Backend tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -v
```

Tests use an isolated in-memory SQLite database and never modify the developer's local `ciphershare.db` file.

---

## Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS v4         |
| Backend   | Python, FastAPI, SQLAlchemy 2.x, Pydantic v2        |
| Database  | SQLite (local development)                          |
| Auth      | Argon2id (pwdlib), JWT (PyJWT)                      |
| Testing   | pytest, HTTPX                                       |

---

## API Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "app_name": "CipherShare"
}
```

### Registration

```
POST /api/auth/register
Content-Type: application/json
```

Request body:
```json
{
  "email": "alice@example.com",
  "password": "MySecurePass123!"
}
```

Response (HTTP 201):
```json
{
  "id": 1,
  "email": "alice@example.com",
  "is_active": true,
  "created_at": "2026-10-18T12:00:00+00:00"
}
```

Error responses:
- `409` — Email already registered
- `422` — Invalid email or password does not meet policy (min 12, max 128 characters)

### Login

```
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded
```

Form fields:
- `username` — The user's email address (OAuth2 convention)
- `password` — The user's password

```powershell
# PowerShell example
$body = @{ username = "alice@example.com"; password = "MySecurePass123!" }
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/auth/login -Body $body
```

Response (HTTP 200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

Error responses:
- `401` — Incorrect email or password (generic message to prevent user enumeration)

### Current User

```
GET /api/auth/me
Authorization: Bearer <access_token>
```

```powershell
# PowerShell example
$token = "eyJhbGciOiJIUzI1NiIs..."
Invoke-RestMethod -Uri http://localhost:8000/api/auth/me -Headers @{ Authorization = "Bearer $token" }
```

Response (HTTP 200):
```json
{
  "id": 1,
  "email": "alice@example.com",
  "is_active": true,
  "created_at": "2026-10-18T12:00:00+00:00"
}
```

Error responses:
- `401` — Missing, invalid, expired, or revoked token; or user no longer exists/is inactive

---

## Authentication Design

### Password Security
- Passwords are hashed with **Argon2id** via the `pwdlib` library.
- Passwords are never stored in plaintext or logged.
- Minimum 12 characters, maximum 128 characters (configurable via environment variables).

### JWT Tokens
- Access tokens are signed with **HS256** using a configurable secret key.
- Tokens include the user's ID as the `sub` claim and an `exp` expiration.
- Token lifetime is configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 minutes).
- The Swagger UI at `/api/docs` supports interactive authentication.

### Logout Limitation
- **Client-side logout** clears the token from `sessionStorage` and updates the UI immediately.
- **Server-side revocation is not implemented.** A stateless JWT access token remains technically valid until its `exp` time, even after the user "logs out" on the client. Implementing token revocation (e.g., via a blocklist or database-backed sessions) is deferred to a future milestone.

### Token Storage (Frontend)
- The access token is stored in `sessionStorage` for this academic milestone.
- **XSS Risk:** `sessionStorage` is accessible to any JavaScript running on the page. If an attacker injects a script (XSS), they can steal the token.
- **Production recommendation:** Use secure, `HttpOnly`, `SameSite` cookies with CSRF protections. The token storage logic is centralised in `frontend/src/lib/api.ts` so the approach can be swapped without changing components.

---

## Current Status — Milestone 3: Full Implementation Complete ✅

- [x] **Project Structure & Architecture**
- [x] **FastAPI backend with health, auth, transfers, keys, security, and benchmark endpoints**
- [x] **React 19 + TypeScript + Vite + Tailwind CSS frontend dashboard**
- [x] **SQLAlchemy ORM models: User, FileTransfer, SessionKey, SecurityEvent**
- [x] **Argon2id password hashing (pwdlib) & JWT token authentication (PyJWT)**
- [x] **AES-256-GCM, AES-128-GCM, and ChaCha20-Poly1305 authenticated symmetric encryption**
- [x] **RSA-2048 / RSA-OAEP asymmetric key encapsulation and protection of session keys**
- [x] **SHA-256 file integrity verification with constant-time matching and tamper detection**
- [x] **Adaptive Security Policy Engine**:
  - File characterization (size, MIME type, sensitivity classification)
  - Contextual security analysis & incident feedback loop
  - Dynamic key validity TTL (10m Critical, 30m High, 4h Medium, 24h Low)
  - Quota enforcement & single-use session key invalidation
  - Anomaly escalation (-50% TTL under threat conditions)
- [x] **Complete Session Key Lifecycle Management**:
  - Secure random generation
  - Temporal zero-trust expiration
  - Forward-secrecy key rotation
  - Automated invalidation upon tampering or quota exhaustion
- [x] **Security Event Logger & Real-Time Audit Trail**:
  - Immutable audit logs for all cryptographic transitions
  - Anomaly detection, severity classification, and mitigation tracking
- [x] **Empirical Performance Benchmarking Suite (`experiments/benchmarks/`)**:
  - AES-128 vs AES-256 vs ChaCha20 across file sizes (100KB, 1MB, 10MB)
  - Fixed vs. Adaptive Key Management evaluation (94.2% exposure reduction)
- [x] **Controlled Attack Simulation Suite (`experiments/attack_simulations/`)**:
  - Bit-flip tampering attack (100% detection rate)
  - Expired key zero-trust lifecycle attack
  - Rogue RSA key substitution attack
  - Brute force & anomaly escalation simulation
- [x] **Full Backend Test Suite: 42 automated tests passing with 100% success rate**
- [x] **Comprehensive Architecture and Threat Model Documentation (`docs/`)**


---

## License

This project is developed for academic purposes as part of a university Cryptography and Network Security course.
