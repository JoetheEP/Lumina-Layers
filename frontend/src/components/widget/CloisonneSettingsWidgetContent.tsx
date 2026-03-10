/**
 * Cloisonné settings widget content wrapper.
 * 景泰蓝设置 Widget 内容包装组件。
 */

import CloisonneSettings from '../sections/CloisonneSettings';

export default function CloisonneSettingsWidgetContent() {
  return (
    <div className="overflow-y-auto max-h-[60vh] p-3">
      <CloisonneSettings />
    </div>
  );
}
