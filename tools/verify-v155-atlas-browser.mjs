// Read back the real v1.55.0 atlas using isolated browser storage.
// Only same-origin GET/HEAD are permitted: no fixtures, runtime test bridge,
// personal profile, game rooms or production data writes.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [baseArg,releaseDir,version,sha,outArg]=process.argv.slice(2);
const base=new URL(baseArg),out=outArg||'.agent-run/releases/v'+version+'/atlas';
assert.equal(base.protocol,'https:');
assert.ok(base.hostname==='3d-moving-maze.pages.dev'||/^[a-f0-9]{8}\.3d-moving-maze\.pages\.dev$/.test(base.hostname),'verified production or fixed Pages domain only');
assert.equal(base.pathname,'/');assert.equal(base.username,'');assert.equal(base.password,'');
assert.equal(version,'1.55.0');assert.match(sha,/^[a-f0-9]{40}$/);assert.ok(path.isAbsolute(releaseDir));
const roots=(await readdir(releaseDir)).filter(name=>name!=='.wrangler');
assert.deepEqual(roots.sort(),['assets','docs','functions','index.html','lib','manifest.webmanifest','package.json','story','wrangler.toml'].sort());
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const viewports=[{width:1440,height:900},{width:568,height:320},{width:390,height:844}];
const cards=[
  ...[['burn','灼傷'],['poison','中毒'],['slow','緩速'],['curse','衰弱詛咒'],['shock','電麻'],['root','束縛']].map(([key,name])=>({group:'affix',key,id:'affix:'+key,category:'forging',name:'材料附魔・'+name})),
  ...[['ironore','精鐵礦'],['toughfiber','韌絲'],['crystalshard','共鳴晶片'],['embercore','餘燼核'],['starore','星脈礦'],['abyssalloy','鎮淵合金']].map(([key,name])=>({group:'material',key,id:'material:'+key,category:'items',name})),
  ...[['forest','被困住的幼菇'],['workshop','轟響的舊機組'],['river','霧河的回程燈']].map(([key,name])=>({group:'event',key,id:'event:'+key,category:'items',name})),
  ...[['tree','固定古樹區'],['pool','固定水池區'],['crystal','固定晶簇區'],['machine','固定機組區'],['hearth','固定爐石區'],['waystone','固定路石區']].map(([key,name])=>({group:'landmark',key,id:'landmark:'+key,category:'items',name})),
  ...[['archer','斷索箭臺'],['robot','沉睡動力閘']].map(([key,name])=>({group:'site',key,id:'site:'+key,category:'items',name})),
  ...[['rootCounter','庭園樓主・供能藤',80],['crystalCounter','晶窟樓主・轉向晶柱',60]].map(([key,name,floor])=>({group:'counter',key,id:'lord-counter:'+key,category:'items',name,floor})),
  ...[['crystal_pudding','共鳴晶凍','shock'],['ember_skewer','餘火椒根串','burn'],['frost_compote','霜莓蜜煮','poison']].map(([key,name,ward])=>({group:'meal',key,id:'meal:'+key,category:'cooking',name,ward}))
];
const report={version,sha,hashes:[],url:new URL('docs/'+encodeURIComponent('職業裝備圖鑑.html')+'?v='+version+'&release='+sha,base).href,views:[],contexts:[],screenshots:[],errors:[],consoleErrors:[],missing:[],blocked:[],socketAttempts:[],storageWrites:[]};
const screenshots=new Set(['affix:shock','event:workshop','landmark:pool','site:robot','lord-counter:crystalCounter','meal:ember_skewer']);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.MAZE_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
let activePage;
try{
  // Before viewing any card, compare the document and every directly referenced
  // dependency with the parent's fixed, allowlisted commit export.
  const atlasName='docs/職業裝備圖鑑.html';
  const atlasSource=await readFile(path.join(releaseDir,atlasName),'utf8');
  const files=new Set([atlasName,'docs/story-atlas-cooperation.js','story/tower-affixes.js','story/tower-adventure-events.js','story/tower-landmarks.js','story/tower-cooperation-core.js','story/tower-cooperation-runtime.js']);
  for(const m of atlasSource.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(?:https?:|data:|\/\/)/.test(m[1]))continue;
    const name=path.posix.normalize('docs/'+m[1].split(/[?#]/)[0]);
    assert.ok(!name.startsWith('/')&&!name.startsWith('../'),'atlas reference stays in release export');
    if(await stat(path.join(releaseDir,name)).then(s=>s.isFile()).catch(()=>false))files.add(name);
  }
  for(const name of files){
    const expected=await readFile(path.join(releaseDir,name)),url=new URL(name,base);
    url.searchParams.set('release',sha);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
    assert.equal(response.status,200,name+' HTTP status');
    const actual=Buffer.from(await response.arrayBuffer());
    assert.equal(digest(actual),digest(expected),name+' differs from fixed release');
    report.hashes.push({path:name,sha256:digest(actual),bytes:actual.length});
  }
  for(const viewport of viewports){
    const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block'});
    await context.exposeFunction('recordAtlasSocket',url=>report.socketAttempts.push({viewport,url}));
    await context.exposeFunction('recordAtlasStorageWrite',key=>report.storageWrites.push({viewport,key}));
    await context.addInitScript(()=>{
      globalThis.WebSocket=class{constructor(url){globalThis.recordAtlasSocket(String(url));throw Error('Atlas must not connect to game rooms');}};
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(this===localStorage)globalThis.recordAtlasStorageWrite(String(key));return original.call(this,key,value);};
    });
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(!['GET','HEAD'].includes(request.method())||url.origin!==base.origin){report.blocked.push({viewport,method:request.method(),url:request.url()});return route.abort();}
      return route.continue();
    });
    const page=activePage=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',e=>report.errors.push({viewport,message:e.stack}));
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({viewport,message:message.text()});});
    page.on('response',response=>{if(response.status()>=400)report.missing.push({viewport,url:response.url(),status:response.status()});});
    const response=await page.goto(report.url,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(new URL(response.request().url()).searchParams.get('v'),version,'initial document request has current cache key');
    await page.waitForSelector('html[data-atlas-ready="true"]');
    assert.ok((await page.locator('.topbar').innerText()).includes('v'+version+' 圖鑑'),'current visible atlas version');
    const initial=await page.evaluate(()=>({engine:typeof THREE,storage:localStorage.length,scripts:[...document.scripts].map(s=>s.src),stats:document.querySelector('#stats').textContent}));
    assert.equal(initial.engine,'undefined','atlas must not initialize the 3D game');
    assert.equal(initial.storage,0,'isolated atlas must not create player saves');
    for(const path of ['story-core.js','tower-affixes.js','tower-adventure-events.js','tower-landmarks.js','tower-expedition-core.js','tower-party-core.js','story-atlas-rules.js','story-atlas-items.js']){
      const script=initial.scripts.find(src=>new URL(src).pathname.endsWith('/'+path));
      assert.ok(script,path+' loaded');assert.equal(new URL(script).searchParams.get('v'),version,path+' current cache key');
    }
    for(const card of cards){
      await page.locator('#search').fill(card.name);
      const entry=page.locator('[id="entry-'+card.category+'-'+card.id+'"]');
      assert.equal(await entry.count(),1,card.name+' appears exactly once');
      assert.equal(await entry.locator('h3').innerText(),card.name);
      await entry.locator('summary').tap();
      assert.equal(await entry.locator('details').evaluate(e=>e.open),true,'actual tap expands '+card.name);
      const text=await entry.innerText();
      const ui=await entry.evaluate((element,{id,key,group})=>{
        const A=TowerAffixes,M=TowerMaterials,E=TowerAdventureEvents,L=TowerLandmarks,P=TowerPartyCore;
        const record=group==='affix'?StoryAtlasRules.affixing(key):StoryAtlasItems.records().find(r=>r.id===id);
        let gameIcon,definition,extra={};
        if(group==='affix'){
          definition=A.EFFECTS[key];gameIcon=A.svg(key);
          // This is an isolated quote-only inventory, not a game/save or transaction.
          const run={floor:definition.underground?-21:99,seed:71,coins:999,hp:60,gearBag:[],equipment:{},party:{profession:'smith',members:[],journey:{materials:Object.fromEntries(Object.keys(M.MATERIALS).map(k=>[k,99]))},loadouts:{active:'hero',actors:{}}}};
          extra.gameQuotes=[1,2,3,4,5].map(tier=>{const gear=TowerCore.createGear(TowerHeroes.tierKind('longsword',tier),run.floor,run.seed,'v155-qa-'+tier);run.gearBag=[gear];const q=A.quote(run,gear.id,key);return {coins:q.coins,count:q.count,chance:q.chance};});
          extra.materialName=M.MATERIALS[definition.material];
        }else if(group==='material'){
          gameIcon=TowerResourceIcons.svg(key);definition={name:M.MATERIALS[key],affixes:Object.entries(A.EFFECTS).filter(([,d])=>d.material===key).map(([id,d])=>({id,name:d.name}))};
        }else if(group==='event'){gameIcon=E.svg(key);definition=E.KINDS[key];}
        else if(group==='landmark'){gameIcon=L.svg(key);definition={name:L.NAMES[key]};}
        else if(group==='site'){gameIcon=TowerPartyRuntime.portrait(key);definition=TowerExpedition.SITES[key];}
        else if(group==='counter'){gameIcon=E.svg(key);definition={key,floor:key==='rootCounter'?80:60};}
        else if(group==='meal'){
          gameIcon=TowerPartyRuntime.dishArt(key);definition=P.RECIPES[key];
          extra.wardName=A.EFFECTS[definition.ward].name;
          extra.gameCommission={fee:TowerCommissionCooking.fee(key),category:TowerCommissionCooking.category(key),quantity:1};
          extra.materials=Object.entries(definition.cost).map(([id,n])=>P.INGREDIENTS[id]+' ×'+n);
        }
        const expected=document.createElement('div');expected.innerHTML=gameIcon;
        const facts=Object.fromEntries([...element.querySelectorAll('.facts > div')].map(e=>[e.querySelector('dt').textContent,e.querySelector('dd').textContent]));
        const art=element.querySelector('.art'),details=element.querySelector('details');
        return {iconMatchesGame:art.innerHTML===expected.innerHTML,svgCount:art.querySelectorAll('svg').length,definition,record,facts,...extra,documentWidth:document.documentElement.scrollWidth,cardScrollWidth:element.scrollWidth,cardClientWidth:element.clientWidth,detailsScrollWidth:details.scrollWidth,detailsClientWidth:details.clientWidth};
      },card);
      assert.equal(ui.iconMatchesGame,true,card.name+' uses exact actual game artwork');
      assert.ok(ui.svgCount>0,card.name+' renders game SVG');
      assert.ok(ui.documentWidth<=viewport.width+1,card.name+' document horizontal overflow');
      assert.ok(ui.cardScrollWidth<=ui.cardClientWidth+1,card.name+' card horizontal overflow');
      assert.ok(ui.detailsScrollWidth<=ui.detailsClientWidth+1,card.name+' expanded details horizontal overflow');
      if(card.group==='affix'){
        assert.deepEqual(ui.record.quotes,ui.gameQuotes);
        assert.deepEqual(ui.gameQuotes,[1,2,3,4,5].map(tier=>({coins:10+4*tier,count:2,chance:65+3*tier})));
        assert.equal(ui.facts.異常效果,ui.definition.description);
        assert.equal(ui.facts.基礎時限,ui.definition.duration+' 秒；同種效果刷新而不累加多份。');
        assert.equal(ui.facts.每次材料,ui.materialName+' ×2');
        assert.ok(ui.facts.隊內費用.includes('14／18／22／26／30 銅幣'));
        assert.ok(ui.facts.成功率.includes('68／71／74／77／80%'));
        for(const phrase of ['25%','35%','65%','排除機器人','失敗保留原附魔','加20%，向上取整','素材數量不變'])assert.ok(text.includes(phrase),card.name+' '+phrase);
        assert.equal(ui.record.underground,!!ui.definition.underground);
        if(ui.definition.underground)assert.ok(text.includes('地下篇限定'));
      }else if(card.group==='material'){
        assert.equal(ui.definition.name,card.name);
        for(const d of ui.definition.affixes)assert.ok(ui.facts.效果與使用方式.includes(d.name+'材料附魔：每次 2 份'));
        assert.equal(ui.facts.持有上限,'99 份');
      }else if(card.group==='event'){
        assert.deepEqual(ui.record.choices,ui.definition.choices);
        for(const choice of ui.definition.choices){assert.ok(ui.facts.效果與使用方式.includes(choice.label));assert.ok(ui.facts.效果與使用方式.includes(choice.description));}
        for(const phrase of [ui.definition.follow,ui.definition.reward,'每隔兩至三層','兩層後','可以放棄','不影響原主線','不會重複贈送'])assert.ok(text.includes(phrase),card.name+' '+phrase);
      }else if(card.group==='landmark'){
        assert.equal(ui.definition.name,card.name);
        for(const phrase of ['三乘三格','位置與開放區保持不變','周圍道路仍可能改變','不額外發送物品','裂隙副本不生成','不是安全營地'])assert.ok(text.includes(phrase),card.name+' '+phrase);
      }else if(card.group==='site'){
        assert.equal(ui.record.description,ui.definition.description);
        assert.ok(ui.facts.效果與使用方式.includes('八枚銅幣'));
        assert.ok(ui.facts.效果與使用方式.includes(ui.definition.reward));
        assert.deepEqual(ui.record.jobs,[card.key]);
        for(const phrase of ['進度條','完成後模型改為已處理','不再重複發放獎勵','舊存檔未完成的機關'])assert.ok(text.includes(phrase),card.name+' '+phrase);
        if(card.key==='archer')for(const phrase of ['三十支箭矢','十二秒出口路線','箭袋放不下'])assert.ok(text.includes(phrase));
        if(card.key==='robot')for(const phrase of ['兩份金屬零件','所有能行動的機器人','25%能源'])assert.ok(text.includes(phrase));
      }else if(card.group==='counter'){
        assert.equal(ui.definition.floor,card.floor);
        for(const phrase of ['生命降至一半','护罩'.replace('护','護'),'第'+card.floor+'層','封印與主線出口條件仍要完成','不會被高傷害直接跳過'])assert.ok(text.includes(phrase),card.name+' '+phrase);
        if(card.floor===80)assert.ok(text.includes('斬斷兩根供能藤'));
        else for(const phrase of ['轉向晶柱','晶光攻擊擊中晶柱','護罩才解除'])assert.ok(text.includes(phrase));
      }else if(card.group==='meal'){
        assert.deepEqual(ui.record.recipe,ui.definition);assert.equal(ui.definition.ward,card.ward);
        assert.deepEqual(ui.record.commission,ui.gameCommission);
        assert.ok(ui.facts.效果與使用方式.includes('生命 '+ui.definition.hp+' 點'));
        assert.ok(ui.facts.效果與使用方式.includes('飽食度 '+ui.definition.hunger+' 點'));
        for(const phrase of ['五分鐘內抵擋一次'+ui.wardName,'觸發即消失','不抵擋直接傷害'])assert.ok(ui.facts.效果與使用方式.includes(phrase),card.name+' '+phrase);
        for(const material of ui.materials)assert.ok(ui.facts.取得方式.includes(material));
        assert.ok(ui.facts.取得方式.includes('費用 '+ui.gameCommission.fee+' 幣'));
        assert.ok(text.includes('委託代煮固定一份'));
      }
      if(screenshots.has(card.id)){
        // A full locator screenshot can leave off-viewport <details> unpainted
        // in headless Chrome. Scroll the actual rule text into each phone view.
        const effect=entry.locator('.facts > div:first-child dd');
        await effect.scrollIntoViewIfNeeded();
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const visibleEffect=await effect.evaluate(element=>{const r=element.getBoundingClientRect(),x=r.left+Math.min(16,r.width/2),y=Math.min(innerHeight-12,Math.max(12,r.top+12));return {top:r.top,bottom:r.bottom,visible:element.contains(document.elementFromPoint(x,y))};});
        assert.equal(visibleEffect.visible,true,card.name+' actual effects text is visible and unobstructed');
        const file=out+'/'+viewport.width+'-'+card.id.replaceAll(':','-')+'.png';
        await page.screenshot({path:file});report.screenshots.push(file);
        const last=entry.locator('.entry-note').last();
        await last.scrollIntoViewIfNeeded();
        const expanded=file.replace('.png','-notes.png');await page.screenshot({path:expanded});report.screenshots.push(expanded);
      }
      report.views.push({viewport,id:card.id,name:card.name,group:card.group,iconMatchesGame:ui.iconMatchesGame,svgCount:ui.svgCount,facts:ui.facts,definition:ui.definition,quotes:ui.gameQuotes,commission:ui.gameCommission,widths:{document:ui.documentWidth,card:ui.cardScrollWidth,cardClient:ui.cardClientWidth,details:ui.detailsScrollWidth,detailsClient:ui.detailsClientWidth},pass:true});
      console.log('PASS '+viewport.width+'×'+viewport.height+' '+card.name);
    }
    const finalStorage=await page.evaluate(()=>({length:localStorage.length,keys:Object.keys(localStorage)}));
    assert.deepEqual(finalStorage,{length:0,keys:[]},'searching/expanding atlas does not establish a game save');
    report.contexts.push({viewport,initial,finalStorage});
    await context.close();activePage=null;
  }
  assert.equal(report.views.length,cards.length*viewports.length);
  for(const key of ['errors','consoleErrors','missing','blocked','socketAttempts','storageWrites'])assert.deepEqual(report[key],[],key+' must be empty');
  report.pass=true;
}catch(error){report.failure=error.stack;if(activePage)await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,hashes:report.hashes.length,views:report.views.length,errors:report.errors.length,consoleErrors:report.consoleErrors.length,missing:report.missing.length,blocked:report.blocked.length,socketAttempts:report.socketAttempts.length,storageWrites:report.storageWrites.length,report:out+'/report.json',failure:report.failure}));}
