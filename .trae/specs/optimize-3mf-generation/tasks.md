# Tasks
- [ ] Task 1: 建立性能基线与回归样本：固定代表性输入，记录当前导出耗时、输出体积与正确性结果。
  - [ ] SubTask 1.1: 选取 5-Color 光栅、5-Color 矢量、典型校准板作为样本
  - [ ] SubTask 1.2: 记录总耗时与各阶段耗时（Mesh、XML、ZIP）
  - [ ] SubTask 1.3: 记录文件可读性、对象命名与元数据结果

- [ ] Task 2: 实现 XML 向量化写入：重构 `bambu_3mf_writer.py` 对象 XML 生成路径为批量格式化与批量拼接。
  - [ ] SubTask 2.1: 替换顶点写入逐元素循环
  - [ ] SubTask 2.2: 替换三角面写入逐元素循环
  - [ ] SubTask 2.3: 增加与旧输出语义等价的回归校验

- [ ] Task 3: 实现 ZIP 直写与低开销打包：在写入器中支持 `writestr` 直写并调整压缩策略。
  - [ ] SubTask 3.1: 以流式/内存方式构建 XML 条目
  - [ ] SubTask 3.2: 将打包流程改为直接写入 ZIP 条目
  - [ ] SubTask 3.3: 验证目标切片软件兼容性

- [ ] Task 4: 统一导出路径消除冗余 I/O：将 converter 与 calibration 的目标分支统一迁移到单次写入接口。
  - [ ] SubTask 4.1: 迁移 converter 中 5-Color 光栅与矢量分支
  - [ ] SubTask 4.2: 迁移 calibration 中 Smart1296、8-Color、BW、5-Color 相关分支
  - [ ] SubTask 4.3: 删除或旁路重复修复链路并保留必要兼容入口

- [ ] Task 5: 实现 Mesh NumPy 预分配：重构 `mesh_generators.py` 的顶点/面片聚合路径。
  - [ ] SubTask 5.1: 预计算容量并预分配数组
  - [ ] SubTask 5.2: 使用切片/广播填充几何数据
  - [ ] SubTask 5.3: 与旧几何结果做一致性校验

- [ ] Task 6: 实现可控并行 Mesh 生成：在 converter 中引入按材料维度并行与串行回退机制。
  - [ ] SubTask 6.1: 抽象单材料网格构建为可并行调用单元
  - [ ] SubTask 6.2: 增加并行执行与失败回退策略
  - [ ] SubTask 6.3: 验证多材料结果确定性

- [ ] Task 7: 完成端到端验证与性能复测：在同一基线下复测并输出优化收益结论。
  - [ ] SubTask 7.1: 覆盖关键模式的导出正确性验证
  - [ ] SubTask 7.2: 对比优化前后耗时与体积
  - [ ] SubTask 7.3: 记录风险点与默认配置建议

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2
- Task 5 depends on Task 1
- Task 6 depends on Task 5
- Task 7 depends on Task 3, Task 4, Task 6
