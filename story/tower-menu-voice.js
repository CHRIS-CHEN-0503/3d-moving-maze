/* Routine menus are quiet; explicit navigation speaks only the chosen function.
 * Narrative, quests, confirmations and manual replay are deliberately excluded. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerMenuVoice=api;})(globalThis,function(){
  'use strict';
  const menus=new Set(['高塔遠征 · 暫停中','營地工坊 · 暫停中','旅人背包 · 暫停中','隊伍管理 · 暫停中','專屬圖鑑','技能排列 · 暫停中','隊友與快捷道具 · 暫停中','主角成長 · 暫停中','營地工藝','照明工具 · 暫停中','旅程暫停中']);
  const labels=Object.freeze({'party-team':'隊伍','party-kitchen':'料理','party-forge':'鍛匠工坊','party-bestiary':'生物誌',bag:'裝備與道具','hero-panel':'隊伍與裝備','hero-order':'技能排序','hero-policy':'自動行動與快捷道具','hero-growth':'主角成長','hero-imprint':'匠魂刻印','battle-settings':'遊戲設定'});
  function quiet(kicker,narration={}){return !narration.full&&(!!narration.heroManagement||!!narration.workshop||menus.has(kicker)||kicker.endsWith(' · 行商營地'));}
  function label(action,item){if(action==='hero-tab')return {gear:'裝備',skills:'技能',bag:'共用背包'}[item]||'';if(action==='hero-catalog')return '技能與裝備圖鑑';return labels[action]||'';}
  return Object.freeze({quiet,label});
});
