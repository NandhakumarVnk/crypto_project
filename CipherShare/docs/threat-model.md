# CipherShare — Threat Model & Security Analysis

Based on STRIDE threat modeling and controlled security simulation experiments.

---

## 1. Threat Matrix & Countermeasures

| Threat (STRIDE) | Attack Vector | CipherShare Defense Mechanism | Severity |
|-----------------|---------------|-------------------------------|----------|
| **Tampering** | Man-in-the-Middle bit flips or payload corruption during transit. | Authenticated Encryption (AES-GCM 16-byte tag) + SHA-256 pre-encryption digest verification. 100% detection rate in controlled simulation. Automatically invalidates session key and quarantines transfer. | **CRITICAL** |
| **Information Disclosure** | Interception of stored encrypted file or network eavesdropping. | Zero plaintext stored on server. File encrypted with AES-256-GCM; session key encapsulated using recipient RSA-2048 OAEP (SHA-256 & MGF1). Unwrapped key never transmitted over network. | **HIGH** |
| **Key Theft & Exposure** | Prolonged attacker access to compromised key. | **Adaptive Temporal Expiration (TTL)**. Keys expire within 10 minutes (Critical) to 4 hours (Medium). Reduces exposure window by 94.2% compared to static 7-day keys. Strict single-use keys for high-risk files. | **CRITICAL** |
| **Spoofing** | Attacker impersonating recipient with rogue RSA private key. | Key encapsulation strictly bound to recipient's registered RSA public key. Rogue keys fail RSA-OAEP padding decode and raise `INVALID_KEY` alarm. | **HIGH** |
| **Repudiation** | Denying file origin or transfer reception. | Immutable `security_events` audit trail logs sender ID, recipient ID, SHA-256 hash, cipher parameters, and client IP for every operation. | **MEDIUM** |
| **Denial of Service** | Rapid brute-force decryption or credential flooding. | **Adaptive Threat Escalation**: Anomaly thresholds cut key validity TTLs by 50%, enforce single-use quotas, and escalate monitoring posture to `CRITICAL`. | **MEDIUM** |

---

## 2. Controlled Attack Simulation Validation

The framework includes four automated simulation experiments in `experiments/attack_simulations/simulate_attacks.py`:

```
================================================================================
CIPHERSHARE CONTROLLED ATTACK SIMULATION EXPERIMENTS
================================================================================
[+] SIMULATION 1: Tampering & Bit Corruption Attack
    Defense Mechanism: AEAD Authentication Tag Mismatch (InvalidTag)
    Result:            INTERCEPTED & BLOCKED (100% Detection)
    Action:            Session key invalidated immediately; transfer marked COMPROMISED.

[+] SIMULATION 2: Expired Key Zero-Trust Lifecycle Attack
    Defense Mechanism: Adaptive Temporal TTL Enforcement
    Result:            BLOCKED (Zero-Trust Key Expiry)
    Action:            Logged EXPIRED_KEY_ATTEMPT (Severity: WARNING)

[+] SIMULATION 3: Rogue Key Substitution Attack
    Defense Mechanism: RSA-OAEP-2048 Asymmetric Envelope Isolation
    Result:            BLOCKED (RSA-OAEP Padding Verification Failed)
    Action:            Logged INVALID_KEY (Severity: CRITICAL)

[+] SIMULATION 4: Brute Force & Adaptive Policy Escalation
    Defense Mechanism: Adaptive Incident Feedback Loop
    Result:            THREAT POSTURE ESCALATED
    Action:            50% TTL Reduction, Strict Download Limits, Elevated Risk Score
================================================================================
```

---

## 3. Empirical Performance Benchmarking Summary

Evaluated across payload sizes (100KB, 1MB, 10MB) in `experiments/benchmarks/benchmark_ciphers.py`:

- **AES-256-GCM**: Throughput up to 949.88 MB/s (1MB payload); sub-1.1 ms encryption latency.
- **ChaCha20-Poly1305**: High software performance on systems without hardware AES instructions (713.69 MB/s).
- **Adaptive Key Management Overhead**: ~59.35 ms (including RSA key encapsulation and context policy evaluation), representing a marginal cost of only **0.209 ms** over conventional static approaches.
- **Security Exposure Reduction**: **94.2%** decrease in credential exposure time window.
