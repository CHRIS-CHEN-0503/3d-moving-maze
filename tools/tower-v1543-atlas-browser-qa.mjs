// Read-only actual atlas UI verification. Run with a managed local MAZE_QA_URL.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.env.MAZE_QA_URL||'http://127.0.0.1:8796/');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'QA must use an isolated localhost server');
const version='1.54.3',out='.agent-run/v1543-atlas-qa';
const report={version,url:new URL('docs/'+encodeURIComponent('職業裝備圖鑑.html')+'?v='+version,base).href,views:[],screenshots:[],errors:[],missing:[],blocked:[],socketAttempts:[]};
const resources=[
  {name:'香草',id:'ingredient:herb',category:'items'},
  {name:'精鐵礦',id:'material:ironore',category:'items'},
  {name:'微光動力石',id:'item:power_glimmer',category:'items'}
];
const cooperation=[
  {name:'雷核飛拳',id:'thunder_fist',category:'cooperation',preparation:.5,costs:{ingredients:{},arrows:0,scrap:0}},
  {name:'鋼甲同盟',id:'steel_oath',category:'cooperation',preparation:.5,costs:{ingredients:{},arrows:0,scrap:0}},
  {name:'星核再造',id:'core_reconstruction',category:'cooperation',preparation:.9,costs:{ingredients:{shell:1},arrows:0,scrap:1}}
];
const cards=[...resources,{name:'湛藍復甦核',id:'robot_core',category:'armor'},...cooperation];
const probabilityPhrases=['中性環境 40% 出現、60% 不出現','適合環境 60% 出現、40% 不出現','不適合環境 20% 出現、80% 不出現'];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
let activePage;
try{
  for(const viewport of [{width:1440,height:900},{width:568,height:320},{width:390,height:844}]){
    const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'});
    await context.exposeFunction('recordAtlasSocket',url=>report.socketAttempts.push(url));
    await context.addInitScript(()=>{globalThis.WebSocket=class{constructor(url){globalThis.recordAtlasSocket(String(url));throw Error('Atlas must not connect to game rooms');}};});
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(!['GET','HEAD'].includes(request.method())||url.origin!==base.origin){report.blocked.push({method:request.method(),url:request.url()});return route.abort();}
      return route.continue();
    });
    const page=activePage=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',e=>report.errors.push({viewport,message:e.stack}));
    page.on('response',response=>{if(response.status()>=400)report.missing.push({viewport,url:response.url(),status:response.status()});});
    const response=await page.goto(report.url,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(new URL(response.request().url()).searchParams.get('v'),version,'initial document request is versioned');
    await page.waitForSelector('html[data-atlas-ready="true"]');
    assert.ok((await page.locator('.topbar').innerText()).includes('v'+version+' 圖鑑'),'current visible atlas version');
    const initial=await page.evaluate(()=>({engine:typeof THREE,storage:localStorage.length,foragingVersion:TowerForaging.FORMAT_VERSION,quantity:TowerForaging.POWER_DEPOSIT_QUANTITY,appearance:TowerForaging.APPEARANCE,scripts:[...document.scripts].map(s=>s.src)}));
    assert.equal(initial.engine,'undefined','atlas must not initialize the 3D game');assert.equal(initial.storage,0,'atlas must not create player saves');
    assert.equal(initial.foragingVersion,4);assert.equal(initial.quantity,1);assert.deepEqual(initial.appearance,{neutral:40,suitable:60,unsuitable:20});
    for(const path of ['tower-foraging.js','tower-robot-core.js','tower-cooperation-core.js','tower-cooperation-runtime.js','story-atlas-items.js','story-atlas-rules.js','story-atlas-cooperation.js']){
      const script=initial.scripts.find(src=>new URL(src).pathname.endsWith('/'+path));assert.ok(script,path+' loaded');assert.equal(new URL(script).searchParams.get('v'),version,path+' current cache key');
    }
    for(const card of cards){
      await page.locator('#search').fill(card.name);
      const entry=page.locator('[id="entry-'+card.category+'-'+card.id+'"]');
      assert.equal(await entry.count(),1,card.name+' appears exactly once');
      assert.equal(await entry.locator('h3').innerText(),card.name);
      await entry.locator('summary').tap();assert.equal(await entry.locator('details').evaluate(e=>e.open),true,'actual tap expands '+card.name);
      const text=await entry.innerText();
      const ui=await entry.evaluate((element,{id,category})=>{
        const record=category==='items'?StoryAtlasItems.records().find(r=>r.id===id):category==='armor'?StoryAtlasRules.gear(id):StoryAtlasCooperation.records().find(r=>r.id===id);
        const gameIcon=category==='items'?StoryAtlasItems.iconHtml(record):category==='armor'?TowerHeroIcons.svg(id):TowerCooperationRuntime.icon(id);
        const expected=document.createElement('div');expected.innerHTML=gameIcon;
        const facts=Object.fromEntries([...element.querySelectorAll('.facts > div')].map(e=>[e.querySelector('dt').textContent,e.querySelector('dd').textContent]));
        const definition=category==='cooperation'?TowerCooperation.DEFINITIONS.find(d=>d.id===id):null;
        return {iconMatchesGame:element.querySelector('.art').innerHTML===expected.innerHTML,svgCount:element.querySelectorAll('.art svg').length,facts,foraging:record.foraging||null,definition:definition?{preparation:definition.preparation,costs:definition.costs,participants:definition.participants.map(p=>TowerHeroes.JOBS[p.job].name+'：'+TowerHeroes.SKILLS[p.skill].name).join(' ＋ ')}:null,width:innerWidth,documentWidth:document.documentElement.scrollWidth,cardWidth:element.getBoundingClientRect().width,cardScrollWidth:element.scrollWidth,cardClientWidth:element.clientWidth,detailsScrollWidth:element.querySelector('details').scrollWidth,detailsClientWidth:element.querySelector('details').clientWidth};
      },card);
      assert.equal(ui.iconMatchesGame,true,card.name+' uses exact actual game icon');assert.ok(ui.svgCount>0,card.name+' has rendered SVG');
      assert.ok(ui.documentWidth<=viewport.width+1,card.name+' document horizontal overflow '+JSON.stringify(ui));
      assert.ok(ui.cardScrollWidth<=ui.cardClientWidth+1,card.name+' card horizontal overflow');
      assert.ok(ui.detailsScrollWidth<=ui.detailsClientWidth+1,card.name+' expanded details horizontal overflow');
      if(card.category==='items'){
        for(const phrase of probabilityPhrases)assert.ok(text.includes(phrase),card.name+' '+phrase);
        if(card.id==='item:power_glimmer'){
          assert.deepEqual(ui.foraging.quantity,[1,1]);assert.ok(text.includes('新樓層每處 1 顆'));assert.ok(text.includes('新樓層每處只有 1 顆動力石'));assert.ok(!text.includes('1～3 顆'),'new atlas must not advertise former multi-stone quantity');
        }else assert.ok(text.includes('每株或每堆採得 1 份'),card.name+' one item per herb/ore deposit');
      }else if(card.category==='armor'){
        assert.ok(ui.facts.行商.includes('不能修理或套用一般裝備特性'));assert.ok(text.includes('耐久耗盡立即消失'));assert.ok(text.includes('不能由鍛匠、商人、技能或營地保養修復'));assert.ok(text.includes('只能重新製作'));
      }else{
        assert.equal(ui.definition.preparation,card.preparation);assert.deepEqual(ui.definition.costs,card.costs);
        assert.ok(ui.facts.合作準備.startsWith(card.preparation+' 秒；'));assert.equal(ui.facts.需要隊員與已學技能,ui.definition.participants);
        assert.equal(ui.facts.箭矢耗用,'不需箭矢');
        assert.equal(ui.facts.金屬零件耗用,card.costs.scrap?'金屬零件 × '+card.costs.scrap:'不需金屬零件');
        assert.equal(ui.facts.食材耗用,card.costs.ingredients.shell?'硬殼 × '+card.costs.ingredients.shell:'不需食材');
        assert.ok(ui.facts.共同條件.includes('不允許隔牆連攜'));assert.ok(ui.facts.共同條件.includes('機器人必須還有能源'));
        if(card.id==='core_reconstruction'){assert.ok(ui.facts.開放條件.includes('僅進入地下篇後'));assert.ok(text.includes('不重建破損機件或修復核心'));}
      }
      await entry.locator('summary').scrollIntoViewIfNeeded();
      const screenshot=out+'/'+viewport.width+'-'+card.category+'-'+card.id.replaceAll(':','-')+'.png';
      const viewportScreenshot=screenshot.replace('.png','-viewport.png');
      await page.screenshot({path:viewportScreenshot});report.screenshots.push(viewportScreenshot);
      await entry.screenshot({path:screenshot});report.screenshots.push(screenshot);
      report.views.push({viewport,id:card.id,name:card.name,...ui,pass:true});
      console.log('PASS '+viewport.width+'×'+viewport.height+' '+card.name);
    }
    assert.equal(await page.evaluate(()=>localStorage.length),0,'expanded atlas remains read-only');await context.close();activePage=null;
  }
  assert.equal(report.views.length,21);assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.socketAttempts,[]);report.pass=true;
}catch(error){report.failure=error.stack;if(activePage)await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,views:report.views.length,errors:report.errors.length,missing:report.missing.length,blocked:report.blocked.length,socketAttempts:report.socketAttempts.length,report:out+'/report.json',failure:report.failure}));}
