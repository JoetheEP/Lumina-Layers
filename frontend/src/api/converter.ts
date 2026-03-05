import apiClient from "./client";
import type {
  ConvertPreviewRequest,
  ConvertGenerateRequest,
  PreviewResponse,
  GenerateResponse,
  LutListResponse,
} from "./types";

/** 上传图片 + 参数，获取 2D 预览（返回 JSON，含 session_id 和 preview_url） */
export async function convertPreview(
  image: File,
  params: ConvertPreviewRequest
): Promise<PreviewResponse> {
  const fd = new FormData();
  fd.append("image", image);
  for (const [key, value] of Object.entries(params)) {
    fd.append(key, String(value));
  }

  const response = await apiClient.post<PreviewResponse>("/convert/preview", fd, {
    timeout: 0,
  });
  return response.data;
}

/** 使用 session_id + 全部参数，生成 3MF 模型 */
export async function convertGenerate(
  sessionId: string,
  params: ConvertGenerateRequest
): Promise<GenerateResponse> {
  const response = await apiClient.post<GenerateResponse>(
    "/convert/generate",
    { session_id: sessionId, params },
    { timeout: 0 }
  );
  return response.data;
}

/** 获取可用 LUT 列表 */
export async function fetchLutList(): Promise<LutListResponse> {
  const response = await apiClient.get<LutListResponse>("/lut/list", {
    timeout: 5_000,
  });
  return response.data;
}

/** 根据 file_id 获取文件下载 URL */
export function getFileUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}
