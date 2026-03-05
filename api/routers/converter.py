"""Converter domain API router.
Converter 领域 API 路由模块。
"""

from __future__ import annotations

import os
import tempfile
import zipfile

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

from api.dependencies import get_file_registry, get_session_store
from api.file_bridge import ndarray_to_png_bytes, pil_to_png_bytes, upload_to_tempfile
from api.file_registry import FileRegistry
from api.schemas.converter import (
    ColorMergePreviewRequest,
    ColorReplaceRequest,
    ConvertGenerateRequest,
)
from api.schemas.responses import (
    BatchItemResult,
    BatchResponse,
    ColorReplaceResponse,
    GenerateResponse,
    MergePreviewResponse,
    PreviewResponse,
)
from api.session_store import SessionStore
from core.color_merger import ColorMerger
from core.color_replacement import ColorReplacementManager
from core.converter import convert_image_to_3d, extract_color_palette, generate_final_model, generate_preview_cached
from config import ModelingMode as CoreModelingMode
from utils.lut_manager import LUTManager

router = APIRouter(prefix="/api/convert", tags=["Converter"])

_STUB_RESPONSE: dict[str, str] = {
    "status": "not_implemented",
    "message": "Phase 2 will integrate core logic",
}


def _handle_core_error(e: Exception, context: str) -> None:
    """将 core 模块异常转换为 HTTP 500 错误。"""
    print(f"[API] {context} error: {e}")
    raise HTTPException(status_code=500, detail=f"{context} failed: {str(e)}")


def _require_session(store: SessionStore, session_id: str) -> dict:
    """获取 session 数据，不存在时抛出 404。"""
    data = store.get(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return data


def _require_preview_cache(session_data: dict) -> dict:
    """获取 preview_cache，不存在时抛出 409。"""
    cache = session_data.get("preview_cache")
    if cache is None:
        raise HTTPException(
            status_code=409, detail="No preview cache. Call POST /api/convert/preview first."
        )
    return cache


def _image_to_png_bytes(img: object) -> bytes:
    """将 ndarray 或 PIL Image 转换为 PNG 字节流。"""
    if isinstance(img, np.ndarray):
        return ndarray_to_png_bytes(img)
    if isinstance(img, Image.Image):
        return pil_to_png_bytes(img)
    raise TypeError(f"Unsupported image type: {type(img)}")


@router.post("/preview")
async def convert_preview(
    image: UploadFile = File(..., description="输入图像"),
    lut_name: str = Form(..., description="LUT 名称"),
    target_width_mm: float = Form(60.0, description="目标宽度 (mm)"),
    auto_bg: bool = Form(False, description="自动去背景"),
    bg_tol: int = Form(40, description="背景容差"),
    color_mode: str = Form("4-Color", description="颜色模式"),
    modeling_mode: str = Form("high-fidelity", description="建模模式"),
    quantize_colors: int = Form(48, description="K-Means 色彩细节"),
    enable_cleanup: bool = Form(True, description="孤立像素清理"),
    store: SessionStore = Depends(get_session_store),
    registry: FileRegistry = Depends(get_file_registry),
) -> PreviewResponse:
    """Generate a 2D color-matched preview image.
    生成 2D 颜色匹配预览图。
    """
    # Resolve LUT path
    lut_path = LUTManager.get_lut_path(lut_name)
    if lut_path is None:
        raise HTTPException(status_code=404, detail=f"LUT not found: {lut_name}")

    # Save uploaded image to temp file
    temp_path = await upload_to_tempfile(image)

    # Call core preview generation
    try:
        preview_img, cache_data, status_msg = generate_preview_cached(
            image_path=temp_path,
            lut_path=lut_path,
            target_width_mm=target_width_mm,
            auto_bg=auto_bg,
            bg_tol=bg_tol,
            color_mode=color_mode,
            modeling_mode=modeling_mode,
            quantize_colors=quantize_colors,
            enable_cleanup=enable_cleanup,
        )
    except Exception as e:
        _handle_core_error(e, "Preview generation")

    if preview_img is None:
        raise HTTPException(status_code=500, detail=status_msg or "Preview generation failed")

    # Create session and store state
    session_id = store.create()
    store.put(session_id, "preview_cache", cache_data)
    store.put(session_id, "image_path", temp_path)
    store.put(session_id, "lut_path", lut_path)
    store.put(session_id, "lut_name", lut_name)
    store.put(session_id, "replacement_regions", [])
    store.put(session_id, "replacement_history", [])
    store.put(session_id, "free_color_set", set())
    store.register_temp_file(session_id, temp_path)

    # Register preview image
    preview_bytes = _image_to_png_bytes(preview_img)
    preview_id = registry.register_bytes(session_id, preview_bytes, "preview.png")

    # Extract palette and dimensions from cache
    palette = cache_data.get("color_palette", []) if cache_data else []
    dimensions = {}
    if cache_data:
        dimensions = {
            "width": cache_data.get("target_w", 0),
            "height": cache_data.get("target_h", 0),
        }

    return PreviewResponse(
        session_id=session_id,
        status="ok",
        message=status_msg or "Preview generated",
        preview_url=f"/api/files/{preview_id}",
        palette=palette,
        dimensions=dimensions,
    )


class _GenerateBody(BaseModel):
    """Wrapper combining session_id with generate parameters."""

    session_id: str
    params: ConvertGenerateRequest


@router.post("/generate")
def convert_generate(
    body: _GenerateBody,
    store: SessionStore = Depends(get_session_store),
    registry: FileRegistry = Depends(get_file_registry),
) -> GenerateResponse:
    """Generate a printable 3MF model from the input image.
    从输入图像生成可打印的 3MF 模型。
    """
    session_data = _require_session(store, body.session_id)
    cache = _require_preview_cache(session_data)

    request = body.params

    # Retrieve paths stored during preview
    image_path: str | None = session_data.get("image_path")
    lut_path: str | None = session_data.get("lut_path")
    if not image_path or not os.path.exists(image_path):
        raise HTTPException(status_code=409, detail="Image file missing. Call POST /api/convert/preview first.")
    if not lut_path or not os.path.exists(lut_path):
        raise HTTPException(status_code=409, detail="LUT file missing. Call POST /api/convert/preview first.")

    # Merge replacement_regions: prefer session state, fall back to request body
    replacement_regions = session_data.get("replacement_regions") or None
    if request.replacement_regions is not None:
        replacement_regions = [
            {
                "quantized_hex": r.quantized_hex,
                "matched_hex": r.matched_hex,
                "replacement_hex": r.replacement_hex,
            }
            for r in request.replacement_regions
        ]

    free_color_set = session_data.get("free_color_set") or None
    if request.free_color_set is not None:
        free_color_set = request.free_color_set

    # Convert API ModelingMode enum to core ModelingMode enum
    core_modeling_mode = CoreModelingMode(request.modeling_mode.value)

    try:
        result = generate_final_model(
            image_path=image_path,
            lut_path=lut_path,
            target_width_mm=request.target_width_mm,
            spacer_thick=request.spacer_thick,
            structure_mode=request.structure_mode.value,
            auto_bg=request.auto_bg,
            bg_tol=request.bg_tol,
            color_mode=request.color_mode.value,
            add_loop=request.add_loop,
            loop_width=request.loop_width,
            loop_length=request.loop_length,
            loop_hole=request.loop_hole,
            loop_pos=request.loop_pos,
            modeling_mode=core_modeling_mode,
            quantize_colors=request.quantize_colors,
            replacement_regions=replacement_regions,
            separate_backing=request.separate_backing,
            enable_relief=request.enable_relief,
            color_height_map=request.color_height_map,
            heightmap_max_height=request.heightmap_max_height,
            enable_cleanup=request.enable_cleanup,
            enable_outline=request.enable_outline,
            outline_width=request.outline_width,
            enable_cloisonne=request.enable_cloisonne,
            wire_width_mm=request.wire_width_mm,
            wire_height_mm=request.wire_height_mm,
            free_color_set=free_color_set,
            enable_coating=request.enable_coating,
            coating_height_mm=request.coating_height_mm,
        )
    except Exception as e:
        _handle_core_error(e, "3MF generation")
        return  # unreachable, keeps type checker happy

    # Unpack result: (3mf_path, glb_path, preview_img, status_msg, color_recipe_path)
    threemf_path, glb_path, _preview_img, status_msg, _recipe_path = result

    if not threemf_path or not os.path.exists(threemf_path):
        raise HTTPException(status_code=500, detail=status_msg or "3MF generation failed")

    # Register output files via FileRegistry
    sid = body.session_id
    download_id = registry.register_path(sid, threemf_path)

    preview_3d_url: str | None = None
    if glb_path and os.path.exists(glb_path):
        glb_id = registry.register_path(sid, glb_path)
        preview_3d_url = f"/api/files/{glb_id}"

    return GenerateResponse(
        status="ok",
        message=status_msg or "Model generated",
        download_url=f"/api/files/{download_id}",
        preview_3d_url=preview_3d_url,
    )


@router.post("/batch")
async def convert_batch(
    images: list[UploadFile] = File(..., description="批量图像"),
    lut_name: str = Form(..., description="LUT 名称"),
    target_width_mm: float = Form(60.0, description="目标宽度 (mm)"),
    spacer_thick: float = Form(1.2, description="底板厚度 (mm)"),
    structure_mode: str = Form("Double-sided", description="打印结构模式"),
    auto_bg: bool = Form(False, description="自动去背景"),
    bg_tol: int = Form(40, description="背景容差"),
    color_mode: str = Form("4-Color", description="颜色模式"),
    modeling_mode: str = Form("high-fidelity", description="建模模式"),
    quantize_colors: int = Form(48, description="K-Means 色彩细节"),
    enable_cleanup: bool = Form(True, description="孤立像素清理"),
    registry: FileRegistry = Depends(get_file_registry),
) -> BatchResponse:
    """Batch-convert multiple images with shared parameters.
    使用共享参数批量转换多张图像。
    """
    # Resolve LUT path
    lut_path = LUTManager.get_lut_path(lut_name)
    if lut_path is None:
        raise HTTPException(status_code=404, detail=f"LUT not found: {lut_name}")

    # Convert modeling_mode string to core enum
    try:
        core_modeling_mode = CoreModelingMode(modeling_mode)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid modeling_mode: {modeling_mode}",
        )

    results: list[BatchItemResult] = []
    successful_paths: list[str] = []

    for upload_file in images:
        filename = upload_file.filename or "unknown"
        try:
            temp_path = await upload_to_tempfile(upload_file)
            threemf_path, _glb_path, _preview_img, status_msg = convert_image_to_3d(
                image_path=temp_path,
                lut_path=lut_path,
                target_width_mm=target_width_mm,
                spacer_thick=spacer_thick,
                structure_mode=structure_mode,
                auto_bg=auto_bg,
                bg_tol=bg_tol,
                color_mode=color_mode,
                add_loop=False,
                loop_width=4.0,
                loop_length=8.0,
                loop_hole=2.5,
                loop_pos=None,
                modeling_mode=core_modeling_mode,
                quantize_colors=quantize_colors,
                enable_cleanup=enable_cleanup,
            )
            if threemf_path and os.path.exists(threemf_path):
                successful_paths.append(threemf_path)
                results.append(BatchItemResult(
                    filename=filename,
                    status="success",
                ))
            else:
                results.append(BatchItemResult(
                    filename=filename,
                    status="failed",
                    error=status_msg or "3MF generation returned no output",
                ))
        except Exception as e:
            results.append(BatchItemResult(
                filename=filename,
                status="failed",
                error=str(e),
            ))

    # Package successful 3MF files into a ZIP
    fd, zip_path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path_3mf in successful_paths:
            zf.write(path_3mf, os.path.basename(path_3mf))

    # Register ZIP via FileRegistry
    session_id = "batch"
    download_id = registry.register_path(session_id, zip_path)

    success_count = sum(1 for r in results if r.status == "success")
    total_count = len(results)

    return BatchResponse(
        status="ok" if success_count > 0 else "failed",
        message=f"Batch complete: {success_count}/{total_count} succeeded",
        download_url=f"/api/files/{download_id}",
        results=results,
    )


@router.post("/replace-color")
def replace_color(
    request: ColorReplaceRequest,
    store: SessionStore = Depends(get_session_store),
    registry: FileRegistry = Depends(get_file_registry),
) -> ColorReplaceResponse:
    """Replace a single color in the current session preview.
    替换当前 session 预览中的单个颜色。
    """
    session_data = _require_session(store, request.session_id)
    cache = _require_preview_cache(session_data)

    try:
        # Parse hex colors to RGB tuples
        selected_rgb = ColorReplacementManager._hex_to_color(request.selected_color)
        replacement_rgb = ColorReplacementManager._hex_to_color(request.replacement_color)

        # Build manager from all existing replacement_regions
        manager = ColorReplacementManager()
        for record in session_data.get("replacement_regions", []):
            orig = ColorReplacementManager._hex_to_color(record["selected_color"])
            repl = ColorReplacementManager._hex_to_color(record["replacement_color"])
            manager.add_replacement(orig, repl)

        # Add the new replacement
        manager.add_replacement(selected_rgb, replacement_rgb)

        # Apply all replacements to the original matched_rgb
        matched_rgb: np.ndarray = cache["matched_rgb"]
        replaced_rgb = manager.apply_to_image(matched_rgb)

        # Generate preview PNG from replaced image
        preview_bytes = _image_to_png_bytes(replaced_rgb)
        preview_id = registry.register_bytes(
            request.session_id, preview_bytes, "preview_replaced.png"
        )

        # Save history snapshot (deep copy of regions before this change) for undo
        current_regions = session_data.get("replacement_regions", [])
        snapshot = [dict(r) for r in current_regions]
        history = list(session_data.get("replacement_history", []))
        history.append(snapshot)
        store.put(request.session_id, "replacement_history", history)

        # Append new replacement record
        current_regions.append({
            "selected_color": request.selected_color,
            "replacement_color": request.replacement_color,
        })
        store.put(request.session_id, "replacement_regions", current_regions)

    except HTTPException:
        raise
    except Exception as e:
        _handle_core_error(e, "Color replacement")

    return ColorReplaceResponse(
        status="ok",
        message="Color replaced successfully",
        preview_url=f"/api/files/{preview_id}",
        replacement_count=len(current_regions),
    )


def _rgb_to_lab(rgb_array: np.ndarray) -> np.ndarray:
    """Convert RGB array (N, 3) uint8 to LAB array (N, 3) float."""
    rgb_2d = rgb_array.reshape(1, -1, 3).astype(np.uint8)
    lab_2d = cv2.cvtColor(rgb_2d, cv2.COLOR_RGB2LAB)
    return lab_2d.reshape(-1, 3).astype(np.float64)


@router.post("/merge-colors")
def merge_colors(
    request: ColorMergePreviewRequest,
    store: SessionStore = Depends(get_session_store),
    registry: FileRegistry = Depends(get_file_registry),
) -> MergePreviewResponse:
    """Preview the effect of merging similar colors.
    预览合并相似颜色的效果。
    """
    session_data = _require_session(store, request.session_id)
    cache = _require_preview_cache(session_data)

    try:
        # Extract palette from preview cache
        palette = extract_color_palette(cache)
        colors_before = len(palette)

        # If merge disabled, return empty merge with perfect quality
        if not request.merge_enable:
            preview_bytes = _image_to_png_bytes(cache["matched_rgb"])
            preview_id = registry.register_bytes(
                request.session_id, preview_bytes, "preview_merged.png"
            )
            store.put(request.session_id, "merge_map", {})
            return MergePreviewResponse(
                status="ok",
                message="Color merging disabled",
                preview_url=f"/api/files/{preview_id}",
                merge_map={},
                quality_metric=100.0,
                colors_before=colors_before,
                colors_after=colors_before,
            )

        # Build merge map using ColorMerger
        merger = ColorMerger(rgb_to_lab_func=_rgb_to_lab)
        merge_map = merger.build_merge_map(
            palette,
            threshold_percent=request.merge_threshold,
            max_distance=float(request.merge_max_distance),
        )

        # Apply merging to matched_rgb
        matched_rgb: np.ndarray = cache["matched_rgb"]
        merged_rgb = merger.apply_color_merging(matched_rgb, merge_map)

        # Calculate quality metric
        merged_palette = extract_color_palette({
            "matched_rgb": merged_rgb,
            "mask_solid": cache["mask_solid"],
        })
        quality = merger.calculate_quality_metric(palette, merged_palette, merge_map)
        colors_after = len(merged_palette)

        # Generate preview PNG
        preview_bytes = _image_to_png_bytes(merged_rgb)
        preview_id = registry.register_bytes(
            request.session_id, preview_bytes, "preview_merged.png"
        )

        # Store merge_map in session
        store.put(request.session_id, "merge_map", merge_map)

    except HTTPException:
        raise
    except Exception as e:
        _handle_core_error(e, "Color merging")

    return MergePreviewResponse(
        status="ok",
        message=f"Merged {len(merge_map)} colors",
        preview_url=f"/api/files/{preview_id}",
        merge_map=merge_map,
        quality_metric=round(quality, 2),
        colors_before=colors_before,
        colors_after=colors_after,
    )
