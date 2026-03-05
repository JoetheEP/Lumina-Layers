import { useConverterStore, isValidImageType } from "../../stores/converterStore";
import {
  ModelingMode,
  StructureMode,
} from "../../api/types";
import ImageUpload from "../ui/ImageUpload";
import Dropdown from "../ui/Dropdown";
import Slider from "../ui/Slider";
import RadioGroup from "../ui/RadioGroup";

const structureModeOptions = Object.values(StructureMode).map((v) => ({
  label: v,
  value: v,
}));

const modelingModeOptions = Object.values(ModelingMode).map((v) => ({
  label: v,
  value: v,
}));

export default function BasicSettings() {
  const {
    imagePreviewUrl,
    lut_name,
    lutList,
    target_width_mm,
    target_height_mm,
    spacer_thick,
    structure_mode,
    modeling_mode,
    setImageFile,
    setLutName,
    setTargetWidthMm,
    setTargetHeightMm,
    setSpacerThick,
    setStructureMode,
    setModelingMode,
    setError,
  } = useConverterStore();

  const lutOptions = lutList.map((name) => ({ label: name, value: name }));

  const handleFileSelect = (file: File) => {
    if (!isValidImageType(file.type)) {
      setError("仅支持 JPG/PNG/SVG 格式");
      return;
    }
    setImageFile(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <ImageUpload
        onFileSelect={handleFileSelect}
        accept="image/jpeg,image/png,image/svg+xml"
        preview={imagePreviewUrl ?? undefined}
      />

      <Dropdown
        label="LUT"
        value={lut_name}
        options={lutOptions}
        onChange={setLutName}
        placeholder="选择 LUT..."
      />

      <Slider
        label="宽度"
        value={target_width_mm}
        min={10}
        max={400}
        step={1}
        unit="mm"
        onChange={setTargetWidthMm}
      />

      <Slider
        label="高度"
        value={target_height_mm}
        min={10}
        max={400}
        step={1}
        unit="mm"
        onChange={setTargetHeightMm}
      />

      <Slider
        label="厚度"
        value={spacer_thick}
        min={0.2}
        max={3.5}
        step={0.08}
        unit="mm"
        onChange={setSpacerThick}
      />

      <RadioGroup
        label="结构模式"
        value={structure_mode}
        options={structureModeOptions}
        onChange={(v) => setStructureMode(v as StructureMode)}
      />

      <RadioGroup
        label="建模模式"
        value={modeling_mode}
        options={modelingModeOptions}
        onChange={(v) => setModelingMode(v as ModelingMode)}
      />
    </div>
  );
}
