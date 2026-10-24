# CipherShare — System Architecture & Cryptographic Design

Based on the research specification in `adaptive_secure_file_transfer_project.pdf`.

---

## 1. Abstract & System Overview

Secure file transfer is vital for protecting confidential information from unauthorized access, data modification, and key compromise during transmission. While conventional systems commonly combine AES for symmetric data encryption and RSA for key exchange, they lack **adaptive key management** responsive to file characteristics and transfer conditions.

**CipherShare** introduces an **Adaptive Cryptographic Key Management and Integrity Verification Framework**. It characterises file metadata (size, MIME type, sensitivity classification) and contextual security telemetry (incident history, attack anomaly scores) to dynamically assign optimal cryptographic policies:
- **AES-256-GCM / AES-128-GCM / ChaCha20-Poly1305** for authenticated file encryption.
- **RSA-2048 / 4096 (OAEP with SHA-256 & MGF1)** for asymmetric key encapsulation.
- **SHA-256** for constant-time end-to-end file integrity verification.
- **Dynamic Key Lifecycle Management**: Automated generation, temporal expiration (TTL), forward-secrecy key rotation, and instant invalidation upon tamper detection.

---

## 2. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 SENDER (CLIENT)                                   |
|  [User Auth]  -->  [File Selection]  -->  [Characterization]  -->  [Policy Req]  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                            APPLICATION SERVER (BACKEND)                           |
|                                                                                   |
|  +------------------------+      +---------------------------------------------+  |
|  | Authentication Module  |      | Security Policy Engine                      |  |
|  | - Argon2id & JWT Auth  |      | - File Characterization & Threat Evaluation |  |
|  | - RSA Identity Mgmt    |      | - Dynamic TTL (10m - 24h) & Quota Assignment|  |
|  +------------------------+      +---------------------------------------------+  |
|                                                                                   |
|  +------------------------+      +---------------------------------------------+  |
|  | Key Management Module  |      | File Encryption Module                      |  |
|  | - AES Key Gen          |      | - AES-256-GCM / ChaCha20 Encryption         |  |
|  | - RSA-OAEP Wrapping    |      | - Pre-encryption SHA-256 Digest             |  |
|  | - Rotation & Expiry    |      | - AEAD Auth Tag Verification                |  |
|  +------------------------+      +---------------------------------------------+  |
|                                                                                   |
|  +------------------------+      +---------------------------------------------+  |
|  | Security Event Logger  |      | File Transfer & Storage                     |  |
|  | - Audit Trail Feed     |      | - Zero-Plaintext Encrypted Disk Store       |  |
|  | - Anomaly Interception |      | - Quota & Download Tracking                 |  |
|  +------------------------+      +---------------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               RECEIVER (CLIENT)                                   |
|  [Inbox Transfer]  -->  [RSA Key Decrypt]  -->  [AES Decrypt]  -->  [SHA-256 OK]  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Components

| Component | Responsibility |
|-----------|----------------|
| **Authentication Module** | Manages user registration, Argon2id password hashing, JWT bearer tokens, and RSA public/private keypair initialization. |
| **File Characterization** | Extracts file size, extension, MIME type, and assigns sensitivity classifications (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| **Security Policy Engine** | Analyzes payload size and incident context to compute cipher algorithms, key lengths, validity TTLs, rotation thresholds, and threat ratings. |
| **Key Management Module** | Generates symmetric session keys, encapsulates them using recipient RSA-OAEP public keys, monitors expiration, conducts automated key rotation, and enforces invalidation. |
| **File Encryption Module** | Executes authenticated symmetric encryption (`AES-256-GCM`, `AES-128-GCM`, `ChaCha20-Poly1305`) and computes pre-encryption SHA-256 digests. |
| **Integrity Verification** | Decrypts ciphertext with authenticated tag verification and compares computed SHA-256 digests against sender digests using constant-time evaluation. |
| **Security Event Logger** | Records cryptographic operations (`FILE_ENCRYPTED`, `KEY_ROTATED`, `INTEGRITY_VERIFIED`, `INTEGRITY_FAILURE`), maintaining an auditable forensic log. |
| **Database & File Storage** | SQLAlchemy models persist user metadata, transfer records, key states, and audit events. Encrypted payloads reside in isolated storage without plaintext caching. |

---

## 4. Key Lifecycle States

```
                [ Generate AES Key ]
                         |
                         v
                    +----------+
                    |  ACTIVE  | <---+ (Key Rotation)
                    +----+-----+     |
                         |           |
            +------------+-----------+
            |                        |
            v                        v
     [ TTL Expires ]           [ Tampering / Max Quota ]
            |                        |
            v                        v
      +-----------+           +---------------+
      |  EXPIRED  |           |  INVALIDATED  |
      +-----------+           +---------------+
```

1. **ACTIVE**: Key is valid, encapsulated with recipient's RSA key, and eligible for decryption.
2. **ROTATED**: Proactive re-keying generates a fresh AES key and re-encrypts the payload while retiring the previous key.
3. **EXPIRED**: The key has crossed its temporal validity window (TTL). Decryption is permanently blocked by zero-trust enforcement.
4. **INVALIDATED**: Triggered immediately upon tamper detection (AEAD tag mismatch or SHA-256 mismatch) or once single-use quotas are exhausted.
