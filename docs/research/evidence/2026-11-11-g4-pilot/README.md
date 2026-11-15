# G4 本地工程证据

本目录保留失败与成功的独立运行；以[最终回执](verification.json)和[完整性复核](final-check.json)指定的结果为当前证据。合成数据不能代表真实家庭纵向试点。

- [最终667项原生、Chrome与备份验证](migrations-1794393601976-9c739a2a-e278-417c-9844-51b44c57f10e/results.json)
- [Chrome检查](migrations-1794393601976-9c739a2a-e278-417c-9844-51b44c57f10e/chrome-pilot/browser-results.json)、[实际HTML报告](migrations-1794393601976-9c739a2a-e278-417c-9844-51b44c57f10e/chrome-pilot/synthetic-report.html)、[CLI保存的HTML](migrations-1794393601976-9c739a2a-e278-417c-9844-51b44c57f10e/chrome-pilot/cli-report.html)、[JSON完整报表](migrations-1794393601976-9c739a2a-e278-417c-9844-51b44c57f10e/chrome-pilot/synthetic-report.json)
- [G3本轮672项回归](../2026-11-11-g3-delivery/migrations-1794392704988-d1a36f28-3f5b-4055-960e-136bc3716461/results.json)
- [全量verify](verify.log)、[G4定向120项](targeted-final.log)、[shared](shared.log)、[infra最终](infra-final.log)
- [独立审查](review.md)、[G3源基线复核](baseline.json)、[当前源码清单](source-manifest.json)、[G4变更](source-changes.json)、[源码归档](source.tar.gz)
- [首次infra失败](infra.log)、[首次组合备份失败](backup.log)、[最初缺少模块的RED](ledger-red.log)保留诊断；最终成功日志为[final-all.log](final-all.log)。

所有数据库使用本地合成Auth/Storage平台schema，应用通过真实Supabase SDK经局部HTTP适配到PG17.4；不声称资格等同正式PostgREST/Auth/Storage。Chrome为本机安装版本。所有时间/付款/质检样本来自明确标记的synthetic_fixture，不是人为等待数周所得。
