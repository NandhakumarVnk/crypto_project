"""Unit tests for CipherShare cryptographic primitives and Adaptive Policy Engine."""

import pytest
from cryptography.exceptions import InvalidTag

from app.crypto.aes import (
    generate_aes_key,
    generate_chacha_key,
    encrypt_symmetric,
    decrypt_symmetric,
)
from app.crypto.rsa import (
    generate_rsa_keypair,
    encrypt_session_key_with_rsa,
    decrypt_session_key_with_rsa,
)
from app.crypto.integrity import (
    compute_sha256,
    verify_integrity,
    tamper_bytes,
)
from app.crypto.adaptive_policy import AdaptiveSecurityPolicyEngine


class TestSymmetricCrypto:
    def test_aes_256_encrypt_decrypt(self):
        key = generate_aes_key(256)
        assert len(key) == 32
        data = b"Confidential CipherShare Data"
        ciphertext, nonce, tag = encrypt_symmetric(data, key, "AES-256-GCM")
        assert len(nonce) == 12
        assert len(tag) == 16
        assert ciphertext != data

        decrypted = decrypt_symmetric(ciphertext, key, nonce, tag, "AES-256-GCM")
        assert decrypted == data

    def test_aes_128_encrypt_decrypt(self):
        key = generate_aes_key(128)
        assert len(key) == 16
        data = b"Standard Payload"
        ciphertext, nonce, tag = encrypt_symmetric(data, key, "AES-128-GCM")
        decrypted = decrypt_symmetric(ciphertext, key, nonce, tag, "AES-128-GCM")
        assert decrypted == data

    def test_chacha20_encrypt_decrypt(self):
        key = generate_chacha_key()
        assert len(key) == 32
        data = b"ChaCha20 Stream Data"
        ciphertext, nonce, tag = encrypt_symmetric(data, key, "CHACHA20-POLY1305")
        decrypted = decrypt_symmetric(ciphertext, key, nonce, tag, "CHACHA20-POLY1305")
        assert decrypted == data

    def test_aes_gcm_tamper_detection(self):
        key = generate_aes_key(256)
        data = b"Original Sensitive Message"
        ciphertext, nonce, tag = encrypt_symmetric(data, key, "AES-256-GCM")

        # Tamper ciphertext
        tampered_ciphertext = tamper_bytes(ciphertext)
        with pytest.raises(InvalidTag):
            decrypt_symmetric(tampered_ciphertext, key, nonce, tag, "AES-256-GCM")

        # Tamper tag
        tampered_tag = tamper_bytes(tag)
        with pytest.raises(InvalidTag):
            decrypt_symmetric(ciphertext, key, nonce, tampered_tag, "AES-256-GCM")


class TestAsymmetricCrypto:
    def test_rsa_keypair_and_oaep_wrapping(self):
        private_pem, public_pem = generate_rsa_keypair(2048)
        assert "-----BEGIN PRIVATE KEY-----" in private_pem
        assert "-----BEGIN PUBLIC KEY-----" in public_pem

        aes_session_key = generate_aes_key(256)
        encrypted_key = encrypt_session_key_with_rsa(aes_session_key, public_pem)
        assert encrypted_key != aes_session_key

        recovered_key = decrypt_session_key_with_rsa(encrypted_key, private_pem)
        assert recovered_key == aes_session_key

    def test_rsa_wrong_key_fails(self):
        priv1, pub1 = generate_rsa_keypair(2048)
        priv2, _ = generate_rsa_keypair(2048)

        aes_key = generate_aes_key(256)
        encrypted_key = encrypt_session_key_with_rsa(aes_key, pub1)

        with pytest.raises(ValueError):
            decrypt_session_key_with_rsa(encrypted_key, priv2)


class TestIntegrityModule:
    def test_sha256_integrity(self):
        data = b"Integrity verified file content"
        hash_val = compute_sha256(data)
        assert len(hash_val) == 64
        assert verify_integrity(data, hash_val) is True

    def test_sha256_detects_tampering(self):
        data = b"Original message"
        hash_val = compute_sha256(data)
        tampered = tamper_bytes(data)
        assert verify_integrity(tampered, hash_val) is False


class TestAdaptivePolicyEngine:
    def test_policy_sensitivities(self):
        low_p = AdaptiveSecurityPolicyEngine.evaluate(1024, "test.txt", "LOW")
        assert low_p.sensitivity == "LOW"
        assert low_p.key_size_bits == 128
        assert low_p.ttl_seconds == 86400

        crit_p = AdaptiveSecurityPolicyEngine.evaluate(1024, "secret.key", "CRITICAL")
        assert crit_p.sensitivity == "CRITICAL"
        assert crit_p.key_size_bits == 256
        assert crit_p.ttl_seconds == 600
        assert crit_p.max_downloads == 1

    def test_policy_security_incidents_escalation(self):
        normal_p = AdaptiveSecurityPolicyEngine.evaluate(1024, "doc.pdf", "HIGH", recent_security_incidents=0)
        escalated_p = AdaptiveSecurityPolicyEngine.evaluate(1024, "doc.pdf", "HIGH", recent_security_incidents=2)

        assert escalated_p.ttl_seconds < normal_p.ttl_seconds
        assert escalated_p.risk_score > normal_p.risk_score
        assert any("recent security event" in r.lower() for r in escalated_p.decision_reasons)
