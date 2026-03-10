/**
 * LUT color grid widget content wrapper.
 * LUT 颜色网格 Widget 内容包装组件。
 */

import LutColorGrid from '../sections/LutColorGrid';

export default function LutColorGridWidgetContent() {
  return (
    <div className="overflow-y-auto max-h-[60vh] p-3">
      <LutColorGrid />
    </div>
  );
}
