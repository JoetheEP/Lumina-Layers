"""Unit tests for Converter Preview endpoint integration.

Validates:
- LUT name resolution failure returns 404 (Requirement 5.4)
- Session contains preview_cache after successful preview (Requirement 5.2)
- Response includes palette and dimensions fields (Requirement 5.3)
"""

from __future__ import annotations

import io
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from api.app import app
from api.dependencies import get_session_store, get_file_registry
from api.session_store import SessionStore
from api.file_registry import FileRegistry

# Isolated store/registry per test module to avoid cross-test pollution
_test_store: SessionStore = SessionStore(ttl=1800)
_test_registry: FileRegistry = FileRegistry()

app.dependency_overrides[get_session_store] = lambda: _test_store
app.dependency_overrides[get_file_registry] = lambda: _test_registry

client: TestClient = TestClient(app)

# Mock cache_data returned by generate_preview_cached
_mock_palette: list[dict] = [
    {"hex": "#FF0000", "color": "Red", "count": 50, "percentage": 25.0},
    {"hex": "#00FF00", "color": "Green", "count": 150, "percentage": 75.0},
]
_mock_cache: dict = {
    "target_w": 120,
    "target_h": 80,
    "target_width_mm": 60.0,
    "color_palette": _mock_palette,
}
_mock_preview_img: np.ndarray = np.zeros((80, 120, 3), dtype=np.uint8)
_mock_return = (_mock_preview_img, _mock_cache, "Preview OK")


def _make_test_image_buf() -> io.BytesIO:
    """Create a minimal PNG image buffer for upload."""
    img = Image.fromarray(np.zeros((100, 100, 3), dtype=np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


# =========================================================================
# 1. LUT name resolution failure returns 404 - Requirement 5.4
# =========================================================================


class TestLutNotFoundReturns404:
    """Verify unresolvable lut_name returns HTTP 404."""

    def test_preview_unknown_lut_returns_404(self) -> None:
        """Send a non-existent lut_name, expect 404."""
        buf = _make_test_image_buf()
        with patch(
            "api.routers.converter.LUTManager.get_lut_path",
            return_value=None,
        ):
            response = client.post(
                "/api/convert/preview",
                files={"image": ("test.png", buf, "image/png")},
                data={
                    "lut_name": "nonexistent_lut",
                    "color_mode": "4-Color",
                },
            )
        assert response.status_code == 404
        assert "LUT" in response.json()["detail"]


# =========================================================================
# 2. Session contains preview_cache - Requirement 5.2
# =========================================================================


class TestSessionContainsPreviewCache:
    """Verify session stores preview_cache after successful preview."""

    def test_preview_stores_cache_in_session(self) -> None:
        """Mock core call, verify session has preview_cache."""
        buf = _make_test_image_buf()
        with patch(
            "api.routers.converter.LUTManager.get_lut_path",
            return_value="/tmp/fake.npy",
        ), patch(
            "api.routers.converter.upload_to_tempfile",
            return_value="/tmp/uploaded.png",
        ), patch(
            "api.routers.converter.generate_preview_cached",
            return_value=_mock_return,
        ):
            response = client.post(
                "/api/convert/preview",
                files={"image": ("test.png", buf, "image/png")},
                data={
                    "lut_name": "test_lut",
                    "color_mode": "4-Color",
                },
            )
        assert response.status_code == 200
        body = response.json()
        session_id: str = body["session_id"]
        assert session_id

        session_data = _test_store.get(session_id)
        assert session_data is not None
        assert "preview_cache" in session_data
        assert session_data["preview_cache"] is _mock_cache


# =========================================================================
# 3. Response includes palette and dimensions - Requirement 5.3
# =========================================================================


class TestResponseContainsPaletteAndDimensions:
    """Verify response JSON includes palette and dimensions fields."""

    def test_preview_response_has_palette_and_dimensions(self) -> None:
        """Mock core call, verify palette and dimensions in response."""
        buf = _make_test_image_buf()
        with patch(
            "api.routers.converter.LUTManager.get_lut_path",
            return_value="/tmp/fake.npy",
        ), patch(
            "api.routers.converter.upload_to_tempfile",
            return_value="/tmp/uploaded.png",
        ), patch(
            "api.routers.converter.generate_preview_cached",
            return_value=_mock_return,
        ):
            response = client.post(
                "/api/convert/preview",
                files={"image": ("test.png", buf, "image/png")},
                data={
                    "lut_name": "test_lut",
                    "color_mode": "4-Color",
                },
            )
        assert response.status_code == 200
        body = response.json()

        # palette
        assert "palette" in body
        assert isinstance(body["palette"], list)
        assert len(body["palette"]) == 2
        assert body["palette"][0]["hex"] == "#FF0000"

        # dimensions
        assert "dimensions" in body
        assert body["dimensions"]["width"] == 120
        assert body["dimensions"]["height"] == 80
