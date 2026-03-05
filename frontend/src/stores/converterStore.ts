import { create } from "zustand";
import type {
  ColorMode,
  ModelingMode,
  StructureMode,
  ColorReplacementItem,
} from "../api/types";
import {
  ColorMode as ColorModeEnum,
  ModelingMode as ModelingModeEnum,
  StructureMode as StructureModeEnum,
} from "../api/types";
import {
  fetchLutList as apiFetchLutList,
  convertPreview as apiConvertPreview,
  convertGenerate as apiConvertGenerate,
} from "../api/converter";

// ========== Helpers ==========

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const VALID_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/svg+xml",
]);

export function isValidImageType(mimeType: string): boolean {
  return VALID_IMAGE_TYPES.has(mimeType);
}

// ========== State Interface ==========

export interface ConverterState {
  // 图片
  imageFile: File | null;
  imagePreviewUrl: string | null;
  aspectRatio: number | null;

  // 会话（预览后由后端返回）
  sessionId: string | null;

  // 基础参数
  lut_name: string;
  target_width_mm: number;
  target_height_mm: number;
  spacer_thick: number;
  structure_mode: StructureMode;
  color_mode: ColorMode;
  modeling_mode: ModelingMode;

  // 高级设置
  auto_bg: boolean;
  bg_tol: number;
  quantize_colors: number;
  enable_cleanup: boolean;
  separate_backing: boolean;

  // 挂件环
  add_loop: boolean;
  loop_width: number;
  loop_length: number;
  loop_hole: number;

  // 浮雕
  enable_relief: boolean;
  color_height_map: Record<string, number>;
  heightmap_max_height: number;

  // 描边
  enable_outline: boolean;
  outline_width: number;

  // 掐丝珐琅
  enable_cloisonne: boolean;
  wire_width_mm: number;
  wire_height_mm: number;

  // 涂层
  enable_coating: boolean;
  coating_height_mm: number;

  // 颜色替换
  replacement_regions: ColorReplacementItem[];
  free_color_set: Set<string>;

  // UI 状态
  isLoading: boolean;
  error: string | null;
  previewImageUrl: string | null;
  modelUrl: string | null;

  // LUT 列表
  lutList: string[];
  lutListLoading: boolean;
}

// ========== Actions Interface ==========

export interface ConverterActions {
  // 图片
  setImageFile: (file: File | null) => void;

  // 参数 setter
  setLutName: (name: string) => void;
  setTargetWidthMm: (width: number) => void;
  setTargetHeightMm: (height: number) => void;
  setSpacerThick: (thick: number) => void;
  setStructureMode: (mode: StructureMode) => void;
  setColorMode: (mode: ColorMode) => void;
  setModelingMode: (mode: ModelingMode) => void;
  setAutoBg: (enabled: boolean) => void;
  setBgTol: (tol: number) => void;
  setQuantizeColors: (colors: number) => void;
  setEnableCleanup: (enabled: boolean) => void;
  setSeparateBacking: (enabled: boolean) => void;
  setAddLoop: (enabled: boolean) => void;
  setLoopWidth: (width: number) => void;
  setLoopLength: (length: number) => void;
  setLoopHole: (hole: number) => void;
  setEnableRelief: (enabled: boolean) => void;
  setColorHeightMap: (map: Record<string, number>) => void;
  setHeightmapMaxHeight: (height: number) => void;
  setEnableOutline: (enabled: boolean) => void;
  setOutlineWidth: (width: number) => void;
  setEnableCloisonne: (enabled: boolean) => void;
  setWireWidthMm: (width: number) => void;
  setWireHeightMm: (height: number) => void;
  setEnableCoating: (enabled: boolean) => void;
  setCoatingHeightMm: (height: number) => void;

  // API 操作
  fetchLutList: () => Promise<void>;
  submitPreview: () => Promise<void>;
  submitGenerate: () => Promise<string | null>;

  // UI 状态
  setError: (error: string | null) => void;
  clearError: () => void;
}


// ========== Default State ==========

const DEFAULT_STATE: ConverterState = {
  imageFile: null,
  imagePreviewUrl: null,
  aspectRatio: null,
  sessionId: null,
  lut_name: "",
  target_width_mm: 60,
  target_height_mm: 60,
  spacer_thick: 1.2,
  structure_mode: StructureModeEnum.DOUBLE_SIDED,
  color_mode: ColorModeEnum.FOUR_COLOR,
  modeling_mode: ModelingModeEnum.HIGH_FIDELITY,
  auto_bg: false,
  bg_tol: 40,
  quantize_colors: 48,
  enable_cleanup: true,
  separate_backing: false,
  add_loop: false,
  loop_width: 4.0,
  loop_length: 8.0,
  loop_hole: 2.5,
  enable_relief: false,
  color_height_map: {},
  heightmap_max_height: 5.0,
  enable_outline: false,
  outline_width: 2.0,
  enable_cloisonne: false,
  wire_width_mm: 0.4,
  wire_height_mm: 0.4,
  enable_coating: false,
  coating_height_mm: 0.08,
  replacement_regions: [],
  free_color_set: new Set(),
  isLoading: false,
  error: null,
  previewImageUrl: null,
  modelUrl: null,
  lutList: [],
  lutListLoading: false,
};

// ========== Store ==========

export const useConverterStore = create<ConverterState & ConverterActions>(
  (set, _get) => ({
    ...DEFAULT_STATE,

    // --- 图片 ---
    setImageFile: (file: File | null) => {
      // Revoke previous object URL to avoid memory leaks
      const prev = _get().imagePreviewUrl;
      if (prev) {
        URL.revokeObjectURL(prev);
      }

      if (!file) {
        set({ imageFile: null, imagePreviewUrl: null, aspectRatio: null });
        return;
      }

      const previewUrl = URL.createObjectURL(file);

      // Calculate aspect ratio from image dimensions
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        set({ aspectRatio: ratio });
      };
      img.src = previewUrl;

      set({ imageFile: file, imagePreviewUrl: previewUrl });
    },

    // --- 基础参数 ---
    setLutName: (name: string) => set({ lut_name: name }),

    setTargetWidthMm: (width: number) =>
      set((state) => {
        const clamped = clampValue(width, 10, 400);
        if (state.aspectRatio) {
          return {
            target_width_mm: clamped,
            target_height_mm: clampValue(
              Math.round(clamped / state.aspectRatio),
              10,
              400
            ),
          };
        }
        return { target_width_mm: clamped };
      }),

    setTargetHeightMm: (height: number) =>
      set((state) => {
        const clamped = clampValue(height, 10, 400);
        if (state.aspectRatio) {
          return {
            target_height_mm: clamped,
            target_width_mm: clampValue(
              Math.round(clamped * state.aspectRatio),
              10,
              400
            ),
          };
        }
        return { target_height_mm: clamped };
      }),

    setSpacerThick: (thick: number) =>
      set({ spacer_thick: clampValue(thick, 0.2, 3.5) }),

    setStructureMode: (mode: StructureMode) => set({ structure_mode: mode }),
    setColorMode: (mode: ColorMode) => set({ color_mode: mode }),
    setModelingMode: (mode: ModelingMode) => set({ modeling_mode: mode }),

    // --- 高级设置 ---
    setAutoBg: (enabled: boolean) => set({ auto_bg: enabled }),
    setBgTol: (tol: number) => set({ bg_tol: clampValue(tol, 0, 150) }),
    setQuantizeColors: (colors: number) =>
      set({ quantize_colors: clampValue(colors, 8, 256) }),
    setEnableCleanup: (enabled: boolean) => set({ enable_cleanup: enabled }),
    setSeparateBacking: (enabled: boolean) =>
      set({ separate_backing: enabled }),

    // --- 挂件环 ---
    setAddLoop: (enabled: boolean) => set({ add_loop: enabled }),
    setLoopWidth: (width: number) =>
      set({ loop_width: clampValue(width, 2, 10) }),
    setLoopLength: (length: number) =>
      set({ loop_length: clampValue(length, 4, 15) }),
    setLoopHole: (hole: number) =>
      set({ loop_hole: clampValue(hole, 1, 5) }),

    // --- 浮雕（互斥） ---
    setEnableRelief: (enabled: boolean) =>
      set((state) => ({
        enable_relief: enabled,
        enable_cloisonne: enabled ? false : state.enable_cloisonne,
      })),
    setColorHeightMap: (map: Record<string, number>) =>
      set({ color_height_map: map }),
    setHeightmapMaxHeight: (height: number) =>
      set({ heightmap_max_height: clampValue(height, 0.08, 15.0) }),

    // --- 描边 ---
    setEnableOutline: (enabled: boolean) => set({ enable_outline: enabled }),
    setOutlineWidth: (width: number) =>
      set({ outline_width: clampValue(width, 0.5, 10.0) }),

    // --- 掐丝珐琅（互斥） ---
    setEnableCloisonne: (enabled: boolean) =>
      set((state) => ({
        enable_cloisonne: enabled,
        enable_relief: enabled ? false : state.enable_relief,
      })),
    setWireWidthMm: (width: number) =>
      set({ wire_width_mm: clampValue(width, 0.2, 1.2) }),
    setWireHeightMm: (height: number) =>
      set({ wire_height_mm: clampValue(height, 0.04, 1.0) }),

    // --- 涂层 ---
    setEnableCoating: (enabled: boolean) => set({ enable_coating: enabled }),
    setCoatingHeightMm: (height: number) =>
      set({ coating_height_mm: clampValue(height, 0.04, 0.12) }),

    // --- API 操作 ---
    fetchLutList: async () => {
      set({ lutListLoading: true });
      try {
        const response = await apiFetchLutList();
        set({ lutList: response.luts.map((l) => l.name), lutListLoading: false });
      } catch (err) {
        set({
          lutListLoading: false,
          error: err instanceof Error ? err.message : "LUT 列表加载失败",
        });
      }
    },

    submitPreview: async () => {
      const state = _get();
      if (!state.imageFile) {
        set({ error: "请先上传图片" });
        return;
      }
      if (!state.lut_name) {
        set({ error: "请先选择 LUT" });
        return;
      }
      set({ isLoading: true, error: null });
      try {
        const response = await apiConvertPreview(state.imageFile, {
          lut_name: state.lut_name,
          target_width_mm: state.target_width_mm,
          auto_bg: state.auto_bg,
          bg_tol: state.bg_tol,
          color_mode: state.color_mode,
          modeling_mode: state.modeling_mode,
          quantize_colors: state.quantize_colors,
          enable_cleanup: state.enable_cleanup,
        });
        // 后端返回 JSON，preview_url 是相对路径如 /api/files/xxx
        const previewUrl = `http://localhost:8000${response.preview_url}`;
        set({
          isLoading: false,
          sessionId: response.session_id,
          previewImageUrl: previewUrl,
        });
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "预览失败",
        });
      }
    },

    submitGenerate: async () => {
      const state = _get();
      if (!state.sessionId) {
        set({ error: "请先预览图片" });
        return null;
      }
      set({ isLoading: true, error: null });
      try {
        const response = await apiConvertGenerate(state.sessionId, {
          lut_name: state.lut_name,
          target_width_mm: state.target_width_mm,
          auto_bg: state.auto_bg,
          bg_tol: state.bg_tol,
          color_mode: state.color_mode,
          modeling_mode: state.modeling_mode,
          quantize_colors: state.quantize_colors,
          enable_cleanup: state.enable_cleanup,
          spacer_thick: state.spacer_thick,
          structure_mode: state.structure_mode,
          separate_backing: state.separate_backing,
          add_loop: state.add_loop,
          loop_width: state.loop_width,
          loop_length: state.loop_length,
          loop_hole: state.loop_hole,
          enable_relief: state.enable_relief,
          color_height_map: state.enable_relief ? state.color_height_map : undefined,
          heightmap_max_height: state.heightmap_max_height,
          enable_outline: state.enable_outline,
          outline_width: state.outline_width,
          enable_cloisonne: state.enable_cloisonne,
          wire_width_mm: state.wire_width_mm,
          wire_height_mm: state.wire_height_mm,
          enable_coating: state.enable_coating,
          coating_height_mm: state.coating_height_mm,
          replacement_regions:
            state.replacement_regions.length > 0
              ? state.replacement_regions
              : undefined,
          free_color_set:
            state.free_color_set.size > 0
              ? Array.from(state.free_color_set)
              : undefined,
        });
        // 后端返回 download_url 和可选的 preview_3d_url
        // preview_3d_url 指向 GLB 文件（Three.js 可加载）
        // download_url 指向 3MF 文件（ZIP 格式，Three.js 无法加载）
        const modelUrl = response.preview_3d_url
          ? `http://localhost:8000${response.preview_3d_url}`
          : null;
        set({ isLoading: false, modelUrl });
        return modelUrl;
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "生成失败",
        });
        return null;
      }
    },

    // --- UI 状态 ---
    setError: (error: string | null) => set({ error }),
    clearError: () => set({ error: null }),
  })
);
