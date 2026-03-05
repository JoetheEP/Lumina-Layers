import { useConverterStore } from "../../stores/converterStore";
import Accordion from "../ui/Accordion";
import Checkbox from "../ui/Checkbox";
import Slider from "../ui/Slider";

export default function ReliefSettings() {
  const {
    enable_relief,
    heightmap_max_height,
    setEnableRelief,
    setHeightmapMaxHeight,
  } = useConverterStore();

  return (
    <Accordion title="浮雕设置">
      <div className="flex flex-col gap-4">
        <Checkbox
          label="启用浮雕"
          checked={enable_relief}
          onChange={setEnableRelief}
        />

        {enable_relief && (
          <Slider
            label="最大高度"
            value={heightmap_max_height}
            min={0.08}
            max={15.0}
            step={0.1}
            unit="mm"
            onChange={setHeightmapMaxHeight}
          />
        )}
      </div>
    </Accordion>
  );
}
