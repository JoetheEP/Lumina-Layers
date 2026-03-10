import { useEffect } from 'react';
import { useConverterStore } from '../stores/converterStore';

/**
 * Initialize converter data on app startup.
 * 应用启动时初始化转换器数据（LUT 列表和打印床尺寸）。
 *
 * Migrated from LeftPanel's useEffect initialization logic.
 * 从 LeftPanel 的 useEffect 初始化逻辑迁移而来。
 */
export function useConverterDataInit() {
  const fetchLutList = useConverterStore((s) => s.fetchLutList);
  const fetchBedSizes = useConverterStore((s) => s.fetchBedSizes);

  useEffect(() => {
    void fetchLutList();
    void fetchBedSizes();
  }, [fetchLutList, fetchBedSizes]);
}
