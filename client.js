// ============================================================================
// dsh-whale-widget —— DSH 客户端插件（dsh.client）
// ============================================================================
// 用途：把 DSH 客户端服务 `uiWorkspace.openSession(sessionId)` 桥接到 window，
//       供宿主注入的普通 <script>（assets/whale-widget.js）调用。
//
// 背景：挂件前端是宿主经 tapIndex 注入的普通 script，不在 Cordis/React 上下文里，
//       拿不到 `ctx`，无法直接调用会话导航服务。issue #238 的「去处理」跳转需要
//       这个最小桥接。
//
// 约束（遵循贡献标准 / 官方客户端插件规范）：
//   · 只做 `openSession` 的桥，不引入任何 UI、不注册槽位、不碰 DOM；
//   · 服务缺失（旧版 DSH）时静默降级：不设置 window 桥，挂件端会退化为「点气泡=只收起」；
//   · 资源清理挂在 ctx.effect 上，插件卸载时移除桥接。
// ============================================================================
window.__ModuleLoader__.load({
  id: 'dsh-whale-widget',
  // factory 按 DSH 客户端装载器约定接收 require（取 react / @deepseek-ai/dsh-client-* 等浏览器模块）。
  // 本插件只做「服务桥接」，不取任何模块，故不使用该参数；保留签名便于未来扩展、避免误用拿到 undefined。
  factory: function whaleWidgetClientFactory(require) {
    'use strict';
    void require; // 明确声明：当前不需要 require，仅为契约签名保留
    return {
      // inject 声明的是**服务名**（非包名）：apply 前由 DSH 客户端把 uiWorkspace 服务注入到 ctx。
      // uiWorkspace 服务由 @deepseek-ai/dsh-client-ui-workspace 提供（已在 package.json 的
      // dsh.client.inject 里声明该包名依赖）；精简版 DSH 若未内置该包，本插件不激活或
      // ctx.uiWorkspace 为空 → 挂件端退化为「只收起」。
      inject: ['uiWorkspace'],
      apply: function apply(ctx) {
        let uiWorkspace = null;
        try {
          uiWorkspace = ctx.uiWorkspace || (typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : null);
        } catch (err) {
          uiWorkspace = null;
        }
        if (!uiWorkspace || typeof uiWorkspace.openSession !== 'function') {
          return;
        }
        window.__dshWhaleOpenSession = function dshWhaleOpenSession(sessionId) {
          if (!sessionId) return;
          try {
            uiWorkspace.openSession(String(sessionId));
          } catch (err) {
            // 跳转失败：静默，不打断气泡的收起流程（widget.js 侧自行兜底）
          }
        };
        try {
          ctx.effect(() => () => {
            try {
              if (window.__dshWhaleOpenSession) delete window.__dshWhaleOpenSession;
            } catch (err) {}
          });
        } catch (err) {}
      },
    };
  },
});
