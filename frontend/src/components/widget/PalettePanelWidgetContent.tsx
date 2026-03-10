/**
 * Palette panel widget content wrapper.
 * 调色板 Widget 内容包装组件。
 */

import PalettePanel from '../sections/PalettePanel';

export default function PalettePanelWidgetContent() {
  return (
    <div className="overflow-y-auto max-h-[60vh] p-3">
      <PalettePanel />
    </div>
  );
}
