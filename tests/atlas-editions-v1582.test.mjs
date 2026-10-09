import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('docs/職業裝備圖鑑.html'),renderer=read('docs/story-atlas.js'),css=read('docs/story-atlas.css');
const block=id=>{const start=html.indexOf('id="'+id+'"');assert.ok(start>0,id);return html.slice(html.lastIndexOf('<',start),html.indexOf('</details>',start));};
const headings=text=>[...text.matchAll(/<section><h3>([^<]+)<\/h3>/g)].map(m=>m[1]);
const DETAILED=['職業本領不等於隨機技能','地上與地下成長分開','覺醒與進階路線','武器階級與耐久','人物與裝備外觀','機器人機件','動力核心與能源','靠牆採集資源','物資與照明','隊伍連攜','料理與鍛造','材料附魔與異常','固定景觀與探索事件','把線索連起來','隊友戰術與演出','療癒與自動補血','移動中施放技能','小樓主','討伐裂隙','經驗節奏','經驗進度條','MP 與招式冷卻','藥水一覽','升級光影','生命上限與職業體質','更強裝備提示','繪製迷宮委託','樓主半血反制','數值怎麼閱讀','手機操作與說明','重要時刻鏡頭','動畫故事舞台','雲頂電影演出與技能預覽','通關後樓梯浮現'];

// The page loads with the same script order as the browser, without touching the document.
function loadPage(){
  const c=vm.createContext({});c.window=c;
  for(const key of ['document','localStorage','sessionStorage','fetch','setTimeout','setInterval','requestAnimationFrame'])Object.defineProperty(c,key,{get(){throw Error('Read-only data touched '+key);}});
  for(const source of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1])){if(source.startsWith('story-atlas.js'))continue;vm.runInContext(readFileSync(new URL('../docs/'+source.split('?')[0],import.meta.url),'utf8'),c,{filename:source});}
  return c;
}

test('the player edition is the default; only the exact 逃生梯 hash opens the detailed edition, before paint',()=>{
  assert.match(html,/<html lang="zh-Hant" data-edition="player">/);
  const head=html.slice(0,html.indexOf('</head>')),inline=head.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(inline,'an inline head script decides the edition before the body renders');
  for(const [hash,edition]of [['',null],['#逃生梯','gm'],['#'+encodeURIComponent('逃生梯'),'gm'],['#entry-skills-x',null],['#results',null],['#逃生梯2',null],['#%E0%A4%A',null]]){
    const root={dataset:{}},doc={documentElement:root,title:'原標題'};vm.runInNewContext(inline,{location:{hash},document:doc,decodeURIComponent});
    assert.equal(root.dataset.edition,edition??undefined,hash);assert.equal(doc.title,edition?'冒險者全書・逃生梯詳細版':'原標題',hash);
  }
  assert.match(css,/html:not\(\[data-edition="gm"\]\) \[data-edition-only="gm"\]\{display:none!important\}/);assert.match(css,/html\[data-edition="gm"\] \[data-edition-only="player"\]\{display:none!important\}/);
  assert.match(renderer,/addEventListener\('hashchange',\(\)=>\{if\(!gm&&gmHash\(\)\)location\.reload\(\);\}\)/,'typing the hash later reloads into the detailed edition');
  assert.match(html,/<span data-edition-only="gm">版本標示不代表正式網站已部署。<\/span>/);
});

test('the player guide is short, plain and covers the essentials; every detailed rule stays in the 逃生梯 edition',()=>{
  const guide=block('readingRules'),detailed=block('gmRules');
  assert.match(guide,/^<details class="rules" id="readingRules" data-edition-only="player">/);assert.match(detailed,/^<details class="rules" id="gmRules" data-edition-only="gm" open>/);
  assert.deepEqual(headings(guide),['職業與技能','升級與同伴','裝備與修理','機器人','補給、採集與照明','料理、鍛造與附魔','隊友與連攜','戰鬥小技巧','小樓主','討伐裂隙','樓梯、樓主與記憶裂隙','故事與日誌','怎麼使用這本書']);
  assert.deepEqual(headings(detailed),DETAILED,'the detailed edition keeps every rule section in order');
  for(const section of guide.split('<section>').slice(1))assert.ok(section.replace(/<[^>]+>/g,'').length<260,'each guide section stays short: '+section.slice(0,30));
  for(const jargon of [/存檔驗證|存檔格式|舊存檔|遷移|程式|著色器|重編譯|編號|種子|決定性|累計進度|世界距離單位|%|×|258|SURFACE/])assert.doesNotMatch(guide.replace(/<[^>]+>/g,''),jargon);
  for(const fact of ['第 10 層前後','「獵」','12 枚銅幣','技能光影預覽.html','本頁不會讀取或改動你的存檔'])assert.ok(guide.includes(fact),fact);
  assert.match(block('gmData'),/<details class="rules gm-data" id="gmData" data-edition-only="gm" open>/);assert.match(html,/<aside class="gm-banner" data-edition-only="gm"[^>]*>[\s\S]*?<a href="職業裝備圖鑑.html">切換到玩家版<\/a><\/aside>/);
});

test('player cards drop only clauses about old saves, internal code or probability breakdowns; the useful rest stays',()=>{
  const lines=renderer.match(/  const gmHash=[\s\S]*?const forPlayer=[^\n]+\n/)?.[0];assert.ok(lines);
  const c=loadPage(),R=c.StoryAtlasRules.build(),records=[...R.entries,...c.StoryAtlasItems.records(),...c.StoryAtlasCooperation.records()];
  const edition=gm=>vm.runInNewContext(lines+';({forPlayer,DEV_CLAUSE})',{location:{hash:''},document:{documentElement:{dataset:{edition:gm?'gm':'player'}}},decodeURIComponent});
  const player=edition(false),detailed=edition(true),texts=r=>[r.description,...r.notes,...r.details.map(d=>d.value)].filter(v=>typeof v==='string');
  let dropped=0;
  for(const raw of records){const r={...raw,notes:raw.notes||[],details:raw.details||[]},p=player.forPlayer(r);
    assert.deepEqual(detailed.forPlayer(r),r,'the detailed edition shows cards unchanged');
    for(const text of texts(p)){assert.doesNotMatch(text,player.DEV_CLAUSE,r.id);assert.doesNotMatch(text,/^[；。]|；$/,r.id);}
    assert.ok(p.description,r.id);dropped+=texts(r).join('').length-texts(p).join('').length;}
  assert.ok(dropped>2000,'a meaningful amount of developer text is hidden: '+dropped);
  const find=id=>player.forPlayer(records.find(r=>r.id===id));
  assert.ok(find('item:shield').notes.includes('護盾專精可提高護盾量。'),'the useful half of a mixed note stays');
  assert.ok(find('item:feather').notes.every(n=>!n.includes('50 點')),'an outdated-value note disappears');
  assert.ok(find('warhammer_t4').notes.includes('高階裝備提高普通初始耐久下限，不提高相同類型的最高隨機品質。'));
  assert.ok(find('ingredient:herb').notes.some(n=>/中性環境 40% 出現、60% 不出現；適合環境 60% 出現/.test(n)),'appearance rates stay, the 1/2/3 breakdown goes');
});

test('the detailed numbers come straight from the game modules',()=>{
  const c=loadPage(),sections=c.StoryAtlasGm.sections(),by=Object.fromEntries(sections.map(s=>[s.id,s]));
  assert.deepEqual([...sections.map(s=>s.id)],['levels','life','mana','kill-xp','lords','minis','hunts']);
  for(const s of sections)for(const row of s.rows){assert.equal(row.length,s.columns.length,s.id);assert.doesNotMatch(row.join(''),/undefined|NaN|null/,s.id);}
  const G=require('../story/tower-hero-growth.js'),H=require('../story/tower-heroes-core.js'),B=require('../story/tower-floor-lords.js'),M=require('../story/tower-materials.js'),D=require('../story/tower-dungeons.js');
  assert.deepEqual([...by.levels.rows.map(r=>Number(r[1]))],[...G.XP]);
  const PC=require('../story/tower-party-core.js');assert.equal(by.life.rows.length,Object.keys(PC.VITALITY).length);
  for(const [job]of Object.entries(PC.VITALITY)){const row=by.life.rows.find(r=>r[0]===H.JOBS[job].name);assert.equal(row[2],[1,10,15].map(l=>PC.vitalHp(job,l,true)).join('／'));assert.equal(row[3],[1,5,10].map(l=>PC.vitalHp(job,l,false)).join('／'));}
  assert.ok(by['kill-xp'].intro.includes('÷ '+H.SURFACE_XP_DEPTH)&&by['kill-xp'].intro.includes('× '+H.HUNT_XP)&&by['kill-xp'].intro.includes('另加 '+B.LORD_XP));
  assert.equal(by['kill-xp'].rows.find(r=>r[0]==='1 F')[1],'× '+(1+98/H.SURFACE_XP_DEPTH).toFixed(2));
  const lords=Object.values(B.allLords());assert.equal(by.lords.rows.length,lords.length);
  for(const d of lords){const row=by.lords.rows.find(r=>r[1]===d.name);assert.equal(Number(row[2]),B.spec({floor:d.floor,party:{}}).maxHp,d.name);assert.equal(Number(row[3]),d.damage);}
  assert.equal(by.minis.rows.length,M.ECOLOGIES.length);for(const e of M.ECOLOGIES){const row=by.minis.rows.find(r=>r[0]===e.name);for(const m of B.MINI_LORDS[e.id])assert.ok(row[2].includes(m.name),m.name);}
  for(const [i,row]of by.hunts.rows.entries())for(const [k,kind]of Object.keys(D.HUNT_KINDS).entries()){const shape=D.huntShape(kind,i+1);assert.equal(row[2+k],shape.count+' 隻 · '+shape.timeLimit+' 秒 · '+shape.reward.coins+' 幣');}
  for(let f=98;f>=-49;f--)if(f)assert.equal(D.huntTier(f),f<0?5:Math.min(5,1+Math.floor((99-f)/20)));
  assert.ok(by.hunts.intro.includes(D.HUNT_CHANCE+'%'));
});

test('only the 逃生梯 panel links to the detailed edition; the game keeps linking the player edition',()=>{
  const gm=read('story/tower-gm.js');assert.match(gm,/<a class="gm-book" href="docs\/職業裝備圖鑑.html#逃生梯" target="_blank" rel="noopener">冒險書詳細版<\/a>/);
  const others=['index.html',...readdirSync(new URL('../story/',import.meta.url)).filter(f=>f.endsWith('.js')&&f!=='tower-gm.js').map(f=>'story/'+f)];
  for(const file of others)assert.doesNotMatch(read(file),/職業裝備圖鑑\.html#|#逃生梯.*職業裝備圖鑑|edition=gm/,file);
  assert.match(read('index.html'),/href="docs\/職業裝備圖鑑.html" target="_blank" rel="noopener">/);
  assert.ok(existsSync(new URL('../docs/story-atlas-gm.js',import.meta.url)));
});
