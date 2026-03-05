import { useConverterStore } from "../../stores/converterStore";
import Button from "../ui/Button";

export default function ActionBar() {
  const imageFile = useConverterStore((s) => s.imageFile);
  const lut_name = useConverterStore((s) => s.lut_name);
  const isLoading = useConverterStore((s) => s.isLoading);
  const error = useConverterStore((s) => s.error);
  const previewImageUrl = useConverterStore((s) => s.previewImageUrl);
  const submitPreview = useConverterStore((s) => s.submitPreview);
  const submitGenerate = useConverterStore((s) => s.submitGenerate);

  const canSubmit = !!imageFile && !!lut_name;

  return (
    <div className="flex flex-col gap-3">
      {!canSubmit && (
        <p className="text-xs text-yellow-400">请先上传图片并选择 LUT</p>
      )}

      <div className="flex gap-2">
        <Button
          label="预览"
          variant="secondary"
          onClick={submitPreview}
          disabled={!canSubmit || isLoading}
          loading={isLoading}
        />
        <Button
          label="生成"
          variant="primary"
          onClick={() => void submitGenerate()}
          disabled={!canSubmit || isLoading}
          loading={isLoading}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}

      {previewImageUrl && (
        <img
          src={previewImageUrl}
          alt="预览结果"
          className="w-full rounded-md border border-gray-700"
        />
      )}
    </div>
  );
}
