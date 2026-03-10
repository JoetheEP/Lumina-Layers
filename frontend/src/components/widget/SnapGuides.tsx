/**
 * Snap guide lines rendered during widget drag near screen edges.
 * 拖拽 Widget 接近屏幕边缘时渲染的吸附引导线。
 */

import type { RefObject } from 'react';
import { SNAP_THRESHOLD, WIDGET_WIDTH } from '../../utils/widgetUtils';

interface SnapGuidesProps {
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function SnapGuides({ isDragging, dragPosition, containerRef }: SnapGuidesProps) {
  if (!isDragging || !dragPosition || !containerRef.current) return null;

  const containerWidth = containerRef.current.getBoundingClientRect().width;
  const widgetLeft = dragPosition.x;
  const widgetRight = dragPosition.x + WIDGET_WIDTH;

  const nearLeft = widgetLeft < SNAP_THRESHOLD;
  const nearRight = containerWidth - widgetRight < SNAP_THRESHOLD;

  if (!nearLeft && !nearRight) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {nearLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />
      )}
      {nearRight && (
        <div
          className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />
      )}
    </div>
  );
}
