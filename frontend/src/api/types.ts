export interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
}

// ========== Enums ==========

export enum ColorMode {
  BW = "BW (Black & White)",
  FOUR_COLOR = "4-Color",
  SIX_COLOR = "6-Color (Smart 1296)",
  EIGHT_COLOR = "8-Color Max",
  MERGED = "Merged",
}

export enum ModelingMode {
  HIGH_FIDELITY = "high-fidelity",
  PIXEL = "pixel",
  VECTOR = "vector",
}

export enum StructureMode {
  DOUBLE_SIDED = "Double-sided",
  SINGLE_SIDED = "Single-sided",
}

// ========== Request Models ==========

export interface ConvertPreviewRequest {
  lut_name: string;
  target_width_mm: number;
  auto_bg: boolean;
  bg_tol: number;
  color_mode: ColorMode;
  modeling_mode: ModelingMode;
  quantize_colors: number;
  enable_cleanup: boolean;
}

export interface ConvertGenerateRequest extends ConvertPreviewRequest {
  spacer_thick: number;
  structure_mode: StructureMode;
  separate_backing: boolean;
  add_loop: boolean;
  loop_width: number;
  loop_length: number;
  loop_hole: number;
  loop_pos?: [number, number];
  enable_relief: boolean;
  color_height_map?: Record<string, number>;
  heightmap_max_height: number;
  enable_outline: boolean;
  outline_width: number;
  enable_cloisonne: boolean;
  wire_width_mm: number;
  wire_height_mm: number;
  enable_coating: boolean;
  coating_height_mm: number;
  replacement_regions?: ColorReplacementItem[];
  free_color_set?: string[];
}

export interface ColorReplacementItem {
  quantized_hex: string;
  matched_hex: string;
  replacement_hex: string;
}

// ========== Response Models ==========

/** 预览接口响应，包含 session_id 和预览图 URL */
export interface PreviewResponse {
  session_id: string;
  status: string;
  message: string;
  preview_url: string;
  palette: Record<string, unknown>[];
  dimensions: { width: number; height: number };
}

/** 生成接口响应，包含下载 URL 和可选的 3D 预览 URL */
export interface GenerateResponse {
  status: string;
  message: string;
  download_url: string;
  preview_3d_url?: string;
}

export interface LutListResponse {
  luts: LutInfo[];
}

export interface LutInfo {
  name: string;
  color_mode: ColorMode;
  path: string;
}

// ========== Calibration Enums ==========

export enum CalibrationColorMode {
  BW = "BW (Black & White)",
  FOUR_COLOR = "4-Color",
  SIX_COLOR = "6-Color (Smart 1296)",
  EIGHT_COLOR = "8-Color Max",
}

export enum BackingColor {
  WHITE = "White",
  CYAN = "Cyan",
  MAGENTA = "Magenta",
  YELLOW = "Yellow",
  RED = "Red",
  BLUE = "Blue",
}

// ========== Calibration Request Models ==========

export interface CalibrationGenerateRequest {
  color_mode: CalibrationColorMode;
  block_size: number;
  gap: number;
  backing: BackingColor;
}

// ========== Calibration Response Models ==========

export interface CalibrationResponse {
  status: string;
  message: string;
  download_url: string;
  preview_url: string | null;
}

// ========== Extractor Enums ==========

export enum ExtractorColorMode {
  BW = "BW (Black & White)",
  FOUR_COLOR = "4-Color",
  SIX_COLOR = "6-Color (Smart 1296)",
  EIGHT_COLOR = "8-Color Max",
}

export enum ExtractorPage {
  PAGE_1 = "Page 1",
  PAGE_2 = "Page 2",
}

// ========== Extractor Response Models ==========

export interface ExtractResponse {
  session_id: string;
  status: string;
  message: string;
  lut_download_url: string;
  warp_view_url: string;
  lut_preview_url: string;
}

export interface ManualFixResponse {
  status: string;
  message: string;
  lut_preview_url: string;
}

// ========== LUT Manager Models ==========

export interface LutInfoResponse {
  name: string;
  color_mode: string;
  color_count: number;
}

export interface MergeStats {
  total_before: number;
  total_after: number;
  exact_dupes: number;
  similar_removed: number;
}

export interface MergeRequest {
  primary_name: string;
  secondary_names: string[];
  dedup_threshold: number;
}

export interface MergeResponse {
  status: string;
  message: string;
  filename: string;
  stats: MergeStats;
}
