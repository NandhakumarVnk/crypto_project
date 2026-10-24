"""Integration tests for file transfer, key lifecycle, security audits, and benchmarks."""

import io
import pytest
from fastapi.testclient import TestClient

from app.models.user import User


def _create_user(client: TestClient, email: str, password: str = "StrongPass1234!") -> dict:
    resp = client.post("/api/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201
    login_resp = client.post("/api/auth/login", data={"username": email, "password": password})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"email": email, "token": token, "user": resp.json()}


class TestTransfersAndKeyLifecycle:
    def test_preview_policy(self, client: TestClient):
        alice = _create_user(client, "alice_policy@example.com")
        headers = {"Authorization": f"Bearer {alice['token']}"}

        resp = client.post(
            "/api/transfers/preview-policy",
            json={
                "file_size_bytes": 2048,
                "filename": "confidential.pdf",
                "sensitivity": "CRITICAL",
            },
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sensitivity"] == "CRITICAL"
        assert data["cipher_algorithm"] == "AES-256-GCM"
        assert data["ttl_seconds"] == 600
        assert data["max_downloads"] == 1

    def test_send_and_decrypt_file_transfer(self, client: TestClient):
        alice = _create_user(client, "alice_sender@example.com")
        bob = _create_user(client, "bob_receiver@example.com")

        alice_headers = {"Authorization": f"Bearer {alice['token']}"}
        bob_headers = {"Authorization": f"Bearer {bob['token']}"}

        # 1. Alice sends encrypted file to Bob
        file_content = b"Confidential financial statement data for Bob."
        send_resp = client.post(
            "/api/transfers/send",
            data={
                "receiver_id": bob["user"]["id"],
                "sensitivity": "HIGH",
            },
            files={"file": ("financial.txt", io.BytesIO(file_content), "text/plain")},
            headers=alice_headers,
        )
        assert send_resp.status_code == 201
        transfer_data = send_resp.json()
        transfer_id = transfer_data["id"]
        assert transfer_data["original_filename"] == "financial.txt"
        assert transfer_data["sensitivity"] == "HIGH"
        assert transfer_data["status"] == "ACTIVE"

        # 2. Bob checks inbox
        inbox_resp = client.get("/api/transfers/inbox", headers=bob_headers)
        assert inbox_resp.status_code == 200
        inbox_items = inbox_resp.json()
        item = next(it for it in inbox_items if it["id"] == transfer_id)
        assert item["key_status"] == "ACTIVE"
        assert item["key_expires_at"] is not None
        assert item["key_expires_at"].endswith("Z")
        assert item["created_at"].endswith("Z")

        # 3. Bob verifies integrity
        verify_resp = client.post(f"/api/transfers/{transfer_id}/verify", headers=bob_headers)
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["integrity_verified"] is True
        assert verify_data["expected_sha256"] == verify_data["computed_sha256"]

        # 4. Bob downloads decrypted file
        down_resp = client.get(f"/api/transfers/{transfer_id}/download", headers=bob_headers)
        assert down_resp.status_code == 200
        assert down_resp.content == file_content
        assert down_resp.headers["x-ciphershare-integrity"] == "VERIFIED"

    def test_key_rotation_workflow(self, client: TestClient):
        alice = _create_user(client, "alice_rot@example.com")
        bob = _create_user(client, "bob_rot@example.com")

        alice_headers = {"Authorization": f"Bearer {alice['token']}"}

        # Alice sends file
        file_content = b"Important document to rotate keys on."
        send_resp = client.post(
            "/api/transfers/send",
            data={"receiver_id": bob["user"]["id"], "sensitivity": "MEDIUM"},
            files={"file": ("rotate_doc.txt", io.BytesIO(file_content), "text/plain")},
            headers=alice_headers,
        )
        transfer_id = send_resp.json()["id"]

        # Rotate key
        rot_resp = client.post(
            "/api/keys/rotate",
            json={"transfer_id": transfer_id, "ttl_seconds": 7200},
            headers=alice_headers,
        )
        assert rot_resp.status_code == 200
        rot_data = rot_resp.json()
        assert rot_data["rotation_count"] == 1
        assert rot_data["status"] == "ACTIVE"

        # Bob can still decrypt with new key
        bob_headers = {"Authorization": f"Bearer {bob['token']}"}
        down_resp = client.get(f"/api/transfers/{transfer_id}/download", headers=bob_headers)
        assert down_resp.status_code == 200
        assert down_resp.content == file_content

    def test_key_invalidation_blocks_decryption(self, client: TestClient):
        alice = _create_user(client, "alice_inv@example.com")
        bob = _create_user(client, "bob_inv@example.com")

        alice_headers = {"Authorization": f"Bearer {alice['token']}"}
        bob_headers = {"Authorization": f"Bearer {bob['token']}"}

        send_resp = client.post(
            "/api/transfers/send",
            data={"receiver_id": bob["user"]["id"], "sensitivity": "MEDIUM"},
            files={"file": ("sensitive.txt", io.BytesIO(b"Secret content"), "text/plain")},
            headers=alice_headers,
        )
        transfer_id = send_resp.json()["id"]

        # Invalidate key
        inv_resp = client.post(
            "/api/keys/invalidate",
            json={"transfer_id": transfer_id, "reason": "Compromise suspected"},
            headers=alice_headers,
        )
        assert inv_resp.status_code == 200
        assert inv_resp.json()["status"] == "INVALIDATED"

        # Bob attempt to download must fail with 403
        down_resp = client.get(f"/api/transfers/{transfer_id}/download", headers=bob_headers)
        assert down_resp.status_code == 403

    def test_security_audit_events_and_attack_simulation(self, client: TestClient):
        alice = _create_user(client, "alice_sec@example.com")
        alice_headers = {"Authorization": f"Bearer {alice['token']}"}

        # Run tampering attack simulation
        sim_resp = client.post(
            "/api/security/simulate-attack",
            json={"simulation_type": "tampering"},
            headers=alice_headers,
        )
        assert sim_resp.status_code == 200
        sim_data = sim_resp.json()
        assert sim_data["attack_detected"] is True
        assert sim_data["status"] == "BLOCKED"
        assert sim_data["event_logged"] == "INTEGRITY_FAILURE"

        # Verify event logged in audit trail
        events_resp = client.get("/api/security/events", headers=alice_headers)
        assert events_resp.status_code == 200
        events = events_resp.json()
        assert any(e["event_type"] == "INTEGRITY_FAILURE" for e in events)

        # Check summary
        summary_resp = client.get("/api/security/summary", headers=alice_headers)
        assert summary_resp.status_code == 200
        assert summary_resp.json()["integrity_failures"] >= 1

    def test_benchmarks_api(self, client: TestClient):
        alice = _create_user(client, "alice_bench@example.com")
        alice_headers = {"Authorization": f"Bearer {alice['token']}"}

        bench_resp = client.post(
            "/api/benchmarks/run",
            json={"file_size_kb": 100, "iterations": 2},
            headers=alice_headers,
        )
        assert bench_resp.status_code == 200
        results = bench_resp.json()
        assert len(results) == 3  # AES-128, AES-256, ChaCha20
        assert all(r["integrity_verified"] is True for r in results)

        comp_resp = client.get("/api/benchmarks/compare-approaches", headers=alice_headers)
        assert comp_resp.status_code == 200
        comp_data = comp_resp.json()
        assert "fixed_approach" in comp_data
        assert "adaptive_approach" in comp_data
