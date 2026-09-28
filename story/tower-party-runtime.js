/* Original low-poly expedition presentation. Uses the existing render/update loop. */
(function(root){
  'use strict';
  function create(ctx){
    const P=root.TowerPartyCore,T=ctx.THREE,V=root.TowerCharacters;
    let actors=[],stations=[],near=null,offer=null,group=null,pulse=0,uiClock=0,skillLeft=0,guardVoiceLeft=0,worldFloor=null,worldSeed=null;
    const r=()=>ctx.run(), enabled=()=>!!r()?.party, live=()=>enabled()&&!ctx.inDungeon()&&worldFloor===r().floor&&worldSeed===r().seed;
    const esc=ctx.text,act=ctx.action;
    const distance=p=>Math.hypot(ctx.G.px-p.x,ctx.G.pz-p.z);
    const clear=p=>ctx.clear(ctx.G.px,ctx.G.pz,p.x,p.z);
    const part=(parent,geometry,color,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));m.position.set(x,y,z);parent.add(m);return m;};
    const ball=(p,s,c,x,y,z)=>part(p,new T.SphereGeometry(s,8,6),c,x,y,z);
    const box=(p,a,b,c,color,x,y,z)=>part(p,new T.BoxGeometry(a,b,c),color,x,y,z);
    const ring=(p,size,color)=>{const mesh=part(p,new T.TorusGeometry(size,.04,4,20),color,0,.07,0);mesh.rotation.x=Math.PI/2;return mesh;};
    function label(model,name,y=2.65){const tag=ctx.makeText(name);tag.position.y=y;tag.scale.set(1.65,.28,1);model.add(tag);model.userData.partyTag=tag;return tag;}
    function healthBar(model,color,y=2.15){const back=new T.Sprite(new T.SpriteMaterial({color:0x192939,depthWrite:false})),bar=new T.Sprite(new T.SpriteMaterial({color,depthWrite:false}));back.position.y=bar.position.y=y;back.scale.set(1,.08,1);bar.scale.set(.94,.055,1);back.renderOrder=1;bar.renderOrder=2;model.add(back,bar);model.userData.partyHp=bar;model.userData.partyHpBack=back;}
    function portrait(job){const colors={swordsman:'#83b5dc',mage:'#b99bff',scout:'#82dfbf',chef:'#ffd69c',healer:'#b9e6c4',smith:'#cca383'},c=colors[job];const paths={swordsman:'M25 5 10 22l-4 5m4-9 9 8m-7-5 4 4',mage:'m12 26 9-18m-2-4 2 4 5 1-4 3 1 5-4-3-4 1 2-5-2-4Z',scout:'M6 14h20M8 14l4-7h8l5 7M9 18v6h14v-6m-10 1v2m6-2v2',chef:'M9 18c-9-7 1-14 7-8 6-6 16 1 7 8v9H9Zm1 6h12',healer:'M16 28V10M16 20C4 23 3 9 14 13m2 3C28 17 29 4 18 8',smith:'m7 27 13-14M14 8l5-5 10 10-5 5Z M6 23l4 4'};return '<svg class="party-glyph" viewBox="0 0 32 32" aria-hidden="true" style="color:'+c+'"><path d="'+paths[job]+'"/></svg>';}
    function foodArt(id){const mushroom=id==='mushroom',herb=id==='herb',root=id==='root',shell=id==='shell',meat=id==='meat',nectar=id==='nectar';return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+(mushroom?'<path fill="#f0dbc6" d="M27 19h10v23H27z"/><path fill="#c88fae" d="M8 23C9 0 54 0 56 23Z"/><circle fill="#ffeacd" cx="23" cy="16" r="3"/>':herb?'<path stroke="#4eaf81" stroke-width="4" d="M30 44 36 8"/><ellipse fill="#88cf9a" cx="22" cy="24" rx="13" ry="7"/><ellipse fill="#b8e29e" cx="42" cy="13" rx="12" ry="7"/>':root?'<path fill="#d6ac68" d="M14 18Q54 5 49 27T10 39Z"/><path stroke="#649b69" stroke-width="4" d="m47 16 10-8m-9 8 0-12"/>':shell?'<path fill="#bba690" d="M9 39Q3 1 32 5q29-4 23 34Z"/><path stroke="#816e59" fill="none" d="M32 7v29M17 12l8 23m22-23-8 23"/>':meat?'<path fill="#d7836c" d="M9 34Q5 8 29 10t26 24Q27 49 9 34"/><path stroke="#f9d5b9" fill="none" stroke-width="5" d="M18 27q9-12 24 2"/>':nectar?'<path fill="#e9b750" d="M31 3Q5 31 18 40t26 0Q57 31 31 3"/><path stroke="#ffeb9d" stroke-width="4" d="M24 30q-4 7 3 9"/>':'<ellipse fill="#dfb775" cx="32" cy="26" rx="26" ry="10"/><path fill="#7da3b1" d="M6 26q4 21 26 20 22 1 26-20Z"/><circle fill="#86c69b" cx="22" cy="23" r="5"/><circle fill="#e3a273" cx="39" cy="26" r="6"/><path stroke="#d8e9e1" fill="none" stroke-width="2" d="M22 14q-5-5 0-10m12 10q-5-5 0-10m12 10q-5-5 0-10"/>')+'</svg>';}
    function ingredientModel(id){const model=new T.Group();if(id==='mushroom'){part(model,new T.CylinderGeometry(.13,.16,.55,8),0xead8bc,0,.28,0);part(model,new T.SphereGeometry(.45,10,6,0,Math.PI*2,0,Math.PI/2),0xca8db8,0,.48,0);}else if(id==='root'){const bulb=ball(model,.33,0xcfac76,0,.25,0);bulb.scale.set(1.3,.7,.8);for(let i=0;i<3;i++){const leaf=box(model,.12,.45,.035,0x83b776,(i-1)*.1,.6,0);leaf.rotation.z=(i-1)*.6;}}else if(id==='herb'){for(let i=0;i<4;i++){const leaf=ball(model,.2,0x8bc79a,(i%2?1:-1)*.12,.2+i*.1,0);leaf.scale.set(1.2,.5,.4);}}else if(id==='nectar'){part(model,new T.ConeGeometry(.25,.4,8),0xecc05d,0,.4,0);ball(model,.25,0xecc05d,0,.15,0);}else if(id==='shell'){const m=ball(model,.35,0xcab196,0,.2,0);m.scale.y=.6;}else{const m=ball(model,.35,0xda9682,0,.2,0);m.scale.y=.55;}return model;}
    function dishArt(id){
      const drawings={
        stew:'<path fill="#849eb2" d="M9 19h46v20q-23 14-46 0Z"/><ellipse fill="#ce9c63" cx="32" cy="20" rx="23" ry="9"/><path stroke="#64788e" stroke-width="4" fill="none" d="M9 24H3v12h6m46-12h6v12h-6"/><circle fill="#dcbd85" cx="23" cy="20" r="5"/><path fill="#a57284" d="M34 23q5-16 14 0Z"/>',
        broth:'<path fill="#d6e5cf" d="M9 20h40v19q-20 12-40 0Z"/><path stroke="#b5ccb9" stroke-width="5" fill="none" d="M49 25q22-2 0 13"/><ellipse fill="#9caf70" cx="29" cy="20" rx="20" ry="7"/><path stroke="#cff2ae" stroke-width="3" d="m18 17 8 6m4-7 7 7"/>',
        skewer:'<path stroke="#c1a17a" stroke-width="4" d="m8 44 45-37"/><path fill="#b28472" stroke="#e9bd6c" stroke-width="2" d="M12 30q-3-17 16-13L34 25ZM27 19q-3-17 16-13L49 14Z"/><path fill="#f5d68d" d="m17 31 5-6 5 3-6 6m13-17 6-6 4 4-6 5"/>',
        crab:'<ellipse fill="#cedbd4" cx="32" cy="32" rx="29" ry="12"/><path fill="#dc8b70" d="M10 31q1-23 20-11 11-17 23 5-14 15-43 6Z"/><path stroke="#835b47" stroke-width="2" d="m21 18 6 12m11-14 6 12"/><path fill="#94c875" d="m12 27-7-10 14 4"/>',
        soup:'<path fill="#dda971" d="M12 18h40v23q-20 10-40 0Z"/><ellipse fill="#f1d583" cx="32" cy="18" rx="20" ry="7"/><path stroke="#bf965b" stroke-width="3" d="m20 18 8 3m8-5 8 3"/><path stroke="#f8dfb6" fill="none" d="M25 8q-3-4 0-7m13 7q-3-4 0-7"/>',
        bento:'<rect fill="#b47f55" x="5" y="7" width="54" height="36" rx="6"/><rect fill="#f0d9ae" x="9" y="11" width="22" height="28" rx="3"/><path stroke="#745443" stroke-width="3" d="M33 8v33m0-17h23"/><path fill="#9dc681" d="M38 13h15v6H38z"/><path fill="#d79376" d="M38 28h15v9H38z"/>',
        salad:'<ellipse fill="#c7dcd0" cx="32" cy="32" rx="28" ry="13"/><path fill="#73b98b" d="M10 29q-7-22 13-14 1-19 15-6 23-8 17 11 9 24-20 16Z"/><path stroke="#c3e6a0" stroke-width="3" d="m15 19 14 12m5-17-3 16m19-8-16 10"/><circle fill="#dbb486" cx="24" cy="23" r="4"/>',
        feast:'<ellipse fill="#b5c9c8" cx="32" cy="34" rx="31" ry="12"/><path fill="#d59c71" d="M8 28q8-25 26 0Z"/><path fill="#d4dec5" d="M32 20h26v15q-13 10-26 0Z"/><ellipse fill="#e9bd71" cx="45" cy="20" rx="13" ry="6"/><path fill="#82b680" d="m14 34 7-14 8 15Z"/>',
      };
      return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+drawings[id]+'</svg>';
    }
    function memberModel(job,level){
      if(job==='swordsman')return V.buildWarrior(level,{THREE:T});
      const model=V.buildExplorer({mage:'sena',scout:'eve',chef:'rowan',healer:'mira',smith:'oren'}[job],{THREE:T});
      const color=P.PROFESSIONS[job].color;
      const mantle=box(model,.85,.22,.58,color,0,1.27,0);mantle.name='profession-mantle';
      if(job==='chef'){part(model,new T.CylinderGeometry(.27,.26,.45,8),0xf1ebda,0,2.15,0);ball(model,.29,0xf1ebda,0,2.35,0);}
      if(job==='mage'){part(model,new T.ConeGeometry(.33,.7,8),color,0,2.24,0);ball(model,.17,0xbbe9ee,-.55,1.6,0);}
      if(job==='smith'){box(model,.12,.75,.12,0x806043,-.5,.65,.13);box(model,.48,.22,.22,0x93a5b3,-.5,1.08,.13);}
      return model;
    }
    function monsterModel(kind,strength){
      if(!P.MONSTERS[kind])return null;const def=P.MONSTERS[kind],model=new T.Group(),body=new T.Group();model.add(body);body.position.y=1;
      if(kind==='mushroom'){part(body,new T.CylinderGeometry(.28,.38,1,8),0xe4d7be,0,-.4,0);part(body,new T.SphereGeometry(.86,12,7,0,Math.PI*2,0,Math.PI/2),def.color,0,.03,0);for(let i=0;i<5;i++)ball(body,.1,0xffe9c1,Math.cos(i*1.3)*.52,.42,Math.sin(i*1.3)*.52);}
      if(kind==='crab'){const shell=ball(body,.65,def.color,0,-.45,0);shell.scale.set(1.15,.6,1);for(const s of [-1,1]){for(let i=0;i<3;i++){const leg=box(body,.65,.09,.1,0x946d55,s*.7,-.7,(i-1)*.4);leg.rotation.z=s*.25;}ball(body,.3,0xd9b286,s*.7,-.3,.6);}}
      if(kind==='moth'){ball(body,.3,0x8b724a,0,0,0);for(const s of [-1,1]){const wing=ball(body,.6,def.color,s*.57,0,0);wing.scale.set(1,.13,.85);wing.name='party-wing';}}
      if(kind==='flower'){part(body,new T.CylinderGeometry(.18,.3,1.2,7),0x698d55,0,-.4,0);for(let i=0;i<6;i++){const petal=ball(body,.34,0xd58e9e,Math.cos(i*Math.PI/3)*.4,.38,Math.sin(i*Math.PI/3)*.4);petal.scale.y=.4;}ball(body,.3,0xe9c974,0,.38,0);}
      for(const s of [-1,1])ball(body,.08,0x223549,s*.2,0,.43);
      model.userData.body=body;model.userData.ring=ring(model,.92,0xe28476);model.userData.ring.material.transparent=true;model.userData.tag=label(model,def.name+' · '+strength+'/5');return model;
    }
    function stationModel(kind,index){const model=new T.Group();
      if(kind==='camp'){part(model,new T.CylinderGeometry(.6,.8,.16,8),0x657785,0,.08,0);for(let i=0;i<3;i++){const log=box(model,.9,.12,.12,0xc3a27b,0,.2,0);log.rotation.y=i*2;}const pot=part(model,new T.SphereGeometry(.44,10,7,0,Math.PI*2,0,Math.PI/2),0x859da8,0,.65,0);pot.rotation.z=Math.PI;label(model,'旅人營地',1.7);}
      else {part(model,new T.CylinderGeometry(.55,.65,.45,8),0x6e8593,0,.23,0);const crown=part(model,new T.OctahedronGeometry(.48),0x97dddb,0,1.15,0);crown.name='seal';if(r().floor===80){const beam=box(model,.09,.07,1.15,0xf6dfa0,0,.9,.75);crown.add(beam);crown.userData.beam=beam;const angle=P.mirrorTarget(r(),index)*Math.PI/2;ball(model,.18,0xffce64,Math.sin(angle)*1.25,.15,Math.cos(angle)*1.25);}label(model,(r().floor===80?'光鏡':'封印')+' '+(index+1),2);const warningRing=ring(model,1.5,0xe5bd6b);warningRing.name='boss-warning';
        for(let i=0;i<4;i++){const angle=i*Math.PI/2,arm=new T.Group();arm.name='boss-arm';arm.position.set(Math.sin(angle)*1.25,0,Math.cos(angle)*1.25);if(r().floor===90){box(arm,.65,1.1,.42,0x879fae,0,.55,0);box(arm,.45,.12,.45,0xb8cfcc,0,1.08,0);}else{const vine=part(arm,new T.ConeGeometry(.27,1.3,6),0x6b9d71,0,.65,0);vine.rotation.z=.25;ball(arm,.16,0xd7b46c,0,1.2,0);}arm.scale.y=.08;model.add(arm);}
      }
      return model;
    }
    function reset(){actors=[];stations=[];near=null;offer=null;group=null;pulse=0;skillLeft=0;guardVoiceLeft=0;worldFloor=null;worldSeed=null;}
    function build(random,used){reset();worldFloor=r()?.floor;worldSeed=r()?.seed;if(!live())return;group=new T.Group();ctx.world().add(group);
      const p=ctx.cell(0,0),camp={...p,kind:'camp',model:stationModel('camp')};camp.model.position.set(p.x,0,p.z);group.add(camp.model);stations.push(camp);
      offer=P.recruitOffer(r());if(offer&&!r().party.joined.includes(offer.id)){const p=ctx.chooseCell(random,used),model=memberModel(offer.profession,offer.level);model.position.set(p.x,0,p.z);label(model,P.PROFESSIONS[offer.profession].person+' · '+P.PROFESSIONS[offer.profession].name);group.add(model);stations.push({...p,kind:'recruit',model});}
      if(r().party.boss)for(let index=0;index<2;index++){const p=ctx.chooseCell(random,used,4),model=stationModel('boss',index);model.position.set(p.x,0,p.z);group.add(model);stations.push({...p,kind:'boss',index,model});}
      syncActors();const specs=P.monsterSpecs(r());for(const m of ctx.monsters()){healthBar(m.model,0xef9e81);m.partyMaxHp=specs.find(s=>s.id===m.id)?.maxHp||1;}
    }
    function syncActors(){if(!live()||!group)return;for(const a of actors)if(!r().party.members.some(m=>m.id===a.id)){group.remove(a.model);ctx.dispose(a.model);}actors=actors.filter(a=>r().party.members.some(m=>m.id===a.id));
      for(const m of r().party.members)if(!actors.some(a=>a.id===m.id)){const model=memberModel(m.profession,m.level);model.position.set(ctx.G.px,0,ctx.G.pz);for(let i=0;i<8;i++){const angle=actors.length*2.1+i*Math.PI/4+(ctx.player()?.rotation.y||0)+Math.PI,p={x:ctx.G.px+Math.sin(angle)*1.5,z:ctx.G.pz+Math.cos(angle)*1.5};if(clear(p)){model.position.set(p.x,0,p.z);break;}}label(model,P.PROFESSIONS[m.profession].name+' · '+P.PROFESSIONS[m.profession].person);healthBar(model,0x8cd2bd,2.35);group.add(model);actors.push({id:m.id,model,path:[],pathLeft:0});}
    }
    function safeCamp(){return live()&&(stations.some(s=>s.kind==='camp'&&distance(s)<2.8&&clear(s))||ctx.traders().some(s=>distance(s)<2.8&&clear(s)))&&!ctx.monsters().some(m=>m.alive&&distance(m.model.position)<4&&clear(m.model.position));}
    function panel(kind='team',quiet=false){if(!enabled())return;
      const run=r(),p=run.party;let body='',copy='四人小隊：主角加三名旅人。劍士就是護衛，占用一個隊友名額。';
      if(kind==='cook'){
        copy=safeCamp()?'營地很安全，可以烹飪、修理，或分享乾糧讓隊友恢復。':'在起點營地或行商身旁，且附近沒有怪物時才能烹飪、修理與休息。已做好的料理隨時可吃。';
        body='<div class="party-stocks">'+Object.entries(P.INGREDIENTS).map(([id,name])=>'<span>'+foodArt(id)+esc(name)+' <b>'+p.ingredients[id]+'</b></span>').join('')+'</div><div class="tower-grid">'+Object.entries(P.RECIPES).map(([id,recipe])=>'<article class="tower-item party-recipe">'+dishArt(id)+'<h3>'+esc(recipe.name)+' ×'+p.meals[id]+'</h3><p>'+Object.entries(recipe.cost).map(([k,v])=>P.INGREDIENTS[k]+' '+v).join('、')+'</p><p>生命 +'+recipe.hp+' · 飽食 +'+recipe.hunger+(recipe.team?' · 隊友生命 +'+recipe.team:'')+(recipe.buff?'<br>'+P.BUFFS[recipe.buff]+'，持續三層':'')+'</p>'+act('烹飪','party-cook',id,!safeCamp()||Object.entries(recipe.cost).some(([k,v])=>p.ingredients[k]<v))+act('享用','party-eat',id,!p.meals[id])+'</article>').join('')+'</div>';
      }else if(kind==='bestiary'){
        copy='擊敗怪物取得材料，料理是下一段冒險的補給。留意牠們的攻擊前兆，不必硬拚。';body='<div class="tower-grid">'+Object.entries(P.defs()).map(([id,m])=>'<article class="tower-item"><h3>'+esc(m.name)+'</h3><p>'+esc(m.description)+'</p><p>材料：'+Object.keys(P.MONSTERS[id]?.drop||{shell:1}).map(k=>P.INGREDIENTS[k]).join('、')+'</p></article>').join('')+'</div>';
      }else{
        body='<div class="tower-grid"><article class="tower-item">'+portrait(p.profession)+'<h3>'+esc(P.PROFESSIONS[p.profession].name)+' · 你</h3><p>'+esc(P.PROFESSIONS[p.profession].description)+'</p></article>'+p.members.map(m=>'<article class="tower-item">'+portrait(m.profession)+'<h3>'+esc(P.PROFESSIONS[m.profession].person)+' · '+esc(P.PROFESSIONS[m.profession].name)+'</h3><p>強度 '+m.level+'/5 · 生命 '+Math.ceil(m.hp)+'/'+P.memberMax(m)+(m.hp<=0?' · 需要料理或營地休息':'')+'</p>'+act('與他道別','party-dismiss-ask',m.id)+'</article>').join('')+'</div><p class="tower-copy">'+(p.buffs.length?p.buffs.map(b=>P.BUFFS[b.id]+'（'+b.floors+' 層）').join(' · '):'烹飪料理可獲得增益；最多同時保留兩種。')+'</p>';
      }
      ctx.dialog('高塔遠征 · 暫停中',{team:'冒險隊伍',cook:'旅人廚房',bestiary:'迷宮生物誌'}[kind],copy,body,act('隊伍','party-team')+act('料理','party-kitchen')+act('生物誌','party-bestiary')+act('分享乾糧休息','party-rest',null,!safeCamp())+act('修理 '+(P.has(run,'smith')?3:6)+' 幣','party-repair',null,!safeCamp())+act('裝備與道具','bag')+act('回到迷宮','close'),{silent:quiet,summary:{team:'冒險隊伍。主角加三名同伴。',cook:'旅人廚房。選擇烹飪，或享用料理。',bestiary:'迷宮生物誌。了解怪物，收集材料。'}[kind]});
    }
    function commit(result,speak=true){if(!ctx.transact(result))return false;if(speak&&result.message)ctx.toast(result.message,2300,result.message);return true;}
    function interact(){if(!live()||!near)return false;const n=near;if(n.kind==='camp'){panel('cook');return true;}
      if(n.kind==='recruit'){const job=P.PROFESSIONS[offer.profession];ctx.dialog(job.name+' · '+job.person,'一起尋找回家的路',job.description,'<div class="party-invite">'+portrait(offer.profession)+'<p>強度 '+offer.level+'/5 · 招募費 '+offer.price+' 枚銅幣 · 隊伍 '+(r().party.members.length+1)+'/4</p></div>',act('邀請加入','party-recruit',offer.id,r().coins<offer.price||r().party.members.length>=3)+act('查看隊伍','party-team')+act('下次再聊','close'),{speaker:{gender:job.gender,age:'adult'},summary:job.name+'，'+job.person+'。'+job.description+'。邀請加入需要'+offer.price+'枚銅幣。'});return true;}
      if(n.kind==='boss'){if(commit(P.bossAction(r(),n.index,r().revision)))ctx.save();return true;}return false;
    }
    function handle(key,id){if(!key.startsWith('party-'))return false;if(!enabled())return true;
      if(key==='party-team'){panel();return true;}if(key==='party-kitchen'){panel('cook');return true;}if(key==='party-bestiary'){panel('bestiary');return true;}
      if(key==='party-dismiss-ask'){const m=r().party.members.find(m=>m.id===id);if(m)ctx.dialog('與同伴道別','確定讓'+P.PROFESSIONS[m.profession].person+'離隊？','這位旅人會繼續自己的旅程，不能在原地重新招募。已支付的費用不會退回。','',act('繼續同行','party-team')+act('確定道別','party-dismiss',id));return true;}
      if(key==='party-dismiss'){if(commit(P.dismiss(r(),id,r().revision))){syncActors();panel('team',true);}return true;}
      if(key==='party-recruit'){if(!near||near.kind!=='recruit'||distance(near)>2.6||!clear(near))return true;if(commit(P.recruit(r(),id,r().revision))){near.model.visible=false;near=null;syncActors();panel('team',true);}return true;}
      if(key==='party-cook'&&safeCamp()){if(commit(P.cook(r(),id,r().revision)))panel('cook',true);return true;}
      if(key==='party-eat'){if(commit(P.eat(r(),id,r().revision)))panel('cook',true);return true;}
      if((key==='party-rest'||key==='party-repair')&&safeCamp()){if(commit(P.camp(r(),key==='party-rest'?'rest':'repair',r().revision)))panel('cook',true);return true;}return true;
    }
    function applyHit(m,memberId=null){
      const source=memberId?actors.find(a=>a.id===memberId)?.model.position:{x:ctx.G.px,z:ctx.G.pz};if(!source)return;
      const dx=source.x-m.model.position.x,dz=source.z-m.model.position.z,front=Math.cos(Math.atan2(dx,dz)-m.model.rotation.y)>.45;
      const result=P.strike(r(),m.id,{memberId,front},r().revision);if(!commit(result,false))return;
      ctx.audio.sfxHit();if(result.effect.stunned){m.windup=0;ctx.quest('stun',{monsterId:m.id});}
      if(result.effect.dead){m.alive=false;m.model.visible=false;ctx.quest('defeat',{monsterId:m.id});ctx.toast(result.message,2600,result.message);if(memberId){ctx.audio.sfxGuardDefeat?.();if(r().party.members.find(x=>x.id===memberId)?.profession==='swordsman')root.GameVoice?.announceAsset('guard.defeat','怪物已經打倒了，繼續前進！',true);}ctx.save();}
      else if(result.effect.broken)ctx.toast('武器用壞了！仍可徒手攻擊，記得找商人補充。',2000,'武器用壞了');
    }
    function attack(){if(!live()||ctx.paused()||ctx.G.shifting||skillLeft>0)return;skillLeft=.8;ctx.audio.sfxSwing();ctx.swing();
      const facing=ctx.player()?.rotation.y||0,target=ctx.monsters().filter(m=>{const p=m.model.position;return m.alive&&distance(p)<2.8&&clear(p)&&Math.cos(Math.atan2(p.x-ctx.G.px,p.z-ctx.G.pz)-facing)>-.05;}).sort((a,b)=>distance(a.model.position)-distance(b.model.position))[0];
      if(target)applyHit(target);else ctx.toast('前方沒有碰到怪物，靠近後再出手。',1200,false);
    }
    function skill(){if(!live()||ctx.paused()||ctx.G.shifting||!ctx.G.running)return;const result=P.skill(r(),r().revision);if(!commit(result))return;ctx.audio.sfxUse();if(result.effect.skill==='mage')for(const m of ctx.monsters())if(m.alive&&distance(m.model.position)<4&&clear(m.model.position)){r().monsterStuns[m.id]=Math.max(r().monsterStuns[m.id]||0,2);m.windup=0;}ctx.save();hud();}
    function guard(m,dt){if(!live())return false;const a=actors.find(a=>{const member=r().party.members.find(x=>x.id===a.id);return member?.profession==='swordsman'&&member.hp>0&&Math.hypot(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z)<1.8&&ctx.clear(a.model.position.x,a.model.position.z,m.model.position.x,m.model.position.z);});
      if(!a){m.partyGuardId=null;return false;}if(m.partyGuardId!==a.id&&guardVoiceLeft<=0){root.GameVoice?.announceAsset('guard.hold','我來擋住牠，你先走！',true);guardVoiceLeft=8;}m.partyGuardId=a.id;m.path=[];m.model.rotation.y=Math.atan2(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z);m.cooldown=Math.max(0,m.cooldown-dt);
      if(m.windup>0){m.windup-=dt;if(m.windup<=0){const hit=P.hurtMember(r(),a.id,m.def.damage,r().revision);if(commit(hit,false)){ctx.audio.sfxGuardBlock?.();if(hit.effect.down)ctx.toast(hit.message,2500,hit.message);}m.cooldown=2.4;}}
      else if(m.cooldown<=0)m.windup=.9;return true;
    }
    function shift(){for(const a of actors){const c=ctx.worldToCell(a.model.position.x,a.model.position.z),p=ctx.cell(c.x,c.y);a.model.position.set(p.x,0,p.z);a.path=[];a.pathLeft=0;}}
    function friendlyVisibility(model){
      const camera=ctx.camera?.();if(!camera)return;const c=camera.position,p=model.position,dx=ctx.G.px-c.x,dz=ctx.G.pz-c.z,length=dx*dx+dz*dz,t=length>.01?((p.x-c.x)*dx+(p.z-c.z)*dz)/length:0;
      const cameraDistance=Math.hypot(p.x-c.x,p.z-c.z),occludes=c.y<3.5&&(cameraDistance<1.4||(t>0&&t<1&&Math.hypot(p.x-c.x-t*dx,p.z-c.z-t*dz)<.65));
      if(model.userData.partyOccludes!==occludes){model.userData.partyOccludes=occludes;model.traverse(o=>{if(o.isMesh&&o.material){o.material.transparent=occludes;o.material.opacity=occludes?.16:1;o.material.depthWrite=!occludes;}});}
      for(const key of ['partyTag','partyHp','partyHpBack'])if(model.userData[key])model.userData[key].visible=!occludes&&cameraDistance>2.8;
    }
    function tick(dt,now){if(!live())return;skillLeft=Math.max(0,skillLeft-dt);guardVoiceLeft=Math.max(0,guardVoiceLeft-dt);pulse+=dt;
      near=stations.filter(s=>s.model.visible&&distance(s)<2.6&&clear(s)).sort((a,b)=>distance(a)-distance(b))[0]||null;
      for(const s of stations)if(s.kind==='recruit')friendlyVisibility(s.model);
      for(const a of actors){const m=r().party.members.find(m=>m.id===a.id);if(!m)continue;friendlyVisibility(a.model);a.model.userData.partyHp.scale.x=.94*Math.max(.001,m.hp/P.memberMax(m));a.model.rotation.z=m.hp<=0?.2:0;if(m.hp<=0)continue;
        const enemy=ctx.monsters().filter(e=>e.alive&&distance(e.model.position)<6&&ctx.clear(a.model.position.x,a.model.position.z,e.model.position.x,e.model.position.z)).sort((a,b)=>distance(a.model.position)-distance(b.model.position))[0];
        const target=m.profession==='swordsman'&&enemy?enemy.model.position:undefined;
        const moving=ctx.follow(a,dt,3.6,m.profession==='swordsman'&&enemy?1.35:1.7,target);
        friendlyVisibility(a.model);
        if(root.CharacterFace)root.CharacterFace.update(a.model,now/1000,enemy?'focus':'calm');
        for(const key of ['legL','legR'])if(a.model.userData[key])a.model.userData[key].rotation.x=moving?Math.sin(now*.01)*(key==='legL'?1:-1)*.35:0;
        if(a.model.userData.armR){const elapsed=(m.profession==='mage'?3:1.8)-m.cooldown;a.model.userData.armR.rotation.x=m.cooldown>0&&elapsed<.45?-Math.sin(elapsed/.45*Math.PI)*1.1:0;}
        if(m.profession==='healer'&&m.cooldown<=0&&r().hp<30&&r().party.ingredients.herb&&distance(a.model.position)<5){const result=ctx.core.transaction(r(),r().revision,n=>{n.party.ingredients.herb--;n.hp=Math.min(ctx.core.MAX_HP,n.hp+16);n.party.members.find(x=>x.id===m.id).cooldown=20;return {ok:true,message:'澄音用香草替你包紮了傷口。'};});commit(result);}
        if(enemy&&m.cooldown<=0&&['swordsman','mage','scout'].includes(m.profession)&&Math.hypot(a.model.position.x-enemy.model.position.x,a.model.position.z-enemy.model.position.z)<(m.profession==='mage'?6:2.4)){
          a.model.rotation.y=Math.atan2(enemy.model.position.x-a.model.position.x,enemy.model.position.z-a.model.position.z);root.CharacterMotion?.beginAction(a.model,'attack',.5);applyHit(enemy,m.id);
        }
      }
      for(const m of ctx.monsters()){if(!m.alive)continue;if(m.model.userData.partyHp)m.model.userData.partyHp.scale.x=.94*Math.max(.001,(r().party.health[m.id]??m.partyMaxHp)/m.partyMaxHp);
        if(ctx.camera?.()&&m.model.userData.tag)m.model.userData.tag.visible=m.model.position.distanceTo(ctx.camera().position)>3.4;
        if(m.kind==='moth'){m.model.userData.body.children.filter(x=>x.name==='party-wing').forEach((w,i)=>w.rotation.z=Math.sin(now*.012)*(i?1:-1)*.5);if(m.windup>0)for(const other of ctx.monsters())if(other.alive&&other!==m&&Math.hypot(other.model.position.x-m.model.position.x,other.model.position.z-m.model.position.z)<6)other.alertLeft=4;}
        if(m.kind==='mushroom'&&m.windup>0&&m.windup<=dt&&distance(m.model.position)<2.8&&clear(m.model.position))r().party.slowLeft=3;
      }
      const b=r().party.boss;if(b){const phase=P.bossPhase(r()),cycle=Math.floor(b.clock/14);for(const s of stations.filter(s=>s.kind==='boss')){const seal=s.model.children.find(x=>x.name==='seal');if(seal){seal.rotation.y=b.angles[s.index]*Math.PI/2;seal.position.y=1.15+(phase==='strike'?.5:Math.sin(pulse*2)*.08);seal.material.color.setHex(b.seals[s.index]?0x83ccac:phase==='warning'?0xffc273:phase==='strike'?0xf28975:0x97dddb);}for(const arm of s.model.children.filter(x=>x.name==='boss-arm'))arm.scale.y=!b.seals[s.index]&&phase==='strike'?1:!b.seals[s.index]&&phase==='warning'?.18+Math.sin(pulse*12)*.08:.08;const warning=s.model.children.find(x=>x.name==='boss-warning');if(warning)warning.material.color.setHex(b.seals[s.index]?0x80cab2:phase==='strike'?0xec7f69:0xe5bd6b);if(phase==='strike'&&!b.seals[s.index]&&distance(s)<1.65&&clear(s)&&s.hitCycle!==cycle){s.hitCycle=cycle;ctx.damage(r().floor===90?12:15,'trap','高塔的石陣震了起來，快退到安全的地方！');}}}
      uiClock+=dt;if(uiClock>.15){uiClock=0;hud();}
    }
    function hud(){if(!enabled())return;
      const status=document.getElementById('towerGuardStatus');if(status){status.hidden=false;let button=status.querySelector('.party-status');if(!button){status.innerHTML='<button class="party-status" type="button"></button>';button=status.firstChild;button.onclick=()=>panel();}button.textContent=P.PROFESSIONS[r().party.profession].name+' · 隊伍 '+(r().party.members.length+1)+'/4'+(r().party.members.some(m=>m.hp<=0)?' · 同伴需要休息':'');}
      const attack=document.getElementById('towerAttackBtn');if(attack&&live()){attack.disabled=skillLeft>0;attack.textContent=(r().equipment.weapon?'揮擊':'徒手')+(skillLeft>0?' '+skillLeft.toFixed(1):' X');}
      const skillButton=document.getElementById('towerProfessionBtn');if(skillButton){skillButton.hidden=!live();skillButton.disabled=r().party.cooldown>0||ctx.paused();skillButton.textContent=r().party.cooldown>0?'準備 '+Math.ceil(r().party.cooldown)+'秒':P.PROFESSIONS[r().party.profession].skill+' C';}
      const talk=document.getElementById('towerTalkBtn');if(near&&live()&&talk){talk.disabled=false;talk.hidden=ctx.paused();talk.ariaLabel=near.kind==='camp'?'營地料理（R）':near.kind==='boss'?'操作封印（R）':'邀請同伴（R）';}
      const objective=document.getElementById('towerObjective');if(objective&&live()){if(near)objective.textContent=near.kind==='camp'?'旅人營地 · 可烹飪、休息與修理':near.kind==='recruit'?'旅人正在招募同行者 · 靠近對話':P.BOSS_FLOORS[r().floor].name+' · '+({idle:'靠近機關開始挑戰',warning:'地面發光，先退開！',strike:'石陣正在甦醒',rest:'震動平息，可以操作機關',done:'封印已解除'}[P.bossPhase(r())]);else if(r().party.boss&&!r().party.boss.done)objective.textContent=P.BOSS_FLOORS[r().floor].name+' · 解開兩座機關 '+r().party.boss.seals.filter(Boolean).length+'/2';}
    }
    function install(){const rail=document.getElementById('towerActionRail');if(!rail)return;const b=document.createElement('button');b.id='towerProfessionBtn';b.className='tower-btn';b.hidden=true;ctx.bind(b,skill);rail.prepend(b);}
    return {enabled,live,portrait,ingredientModel,monsterModel,build,tick,hud,attack,skill,guard,shift,interact,handle,panel,install,reset,safeCamp,get nearby(){return live()?near:null;},reserved:()=>live()?stations:[],markers:()=>live()?stations.filter(s=>s.model.visible).map(s=>({cx:s.cx,cy:s.cy,color:s.kind==='boss'?'#efc977':'#a0dcc2',label:s.kind==='boss'?'陣':s.kind==='camp'?'營':'友'})):[]};
  }
  root.TowerPartyRuntime={create};
})(typeof globalThis!=='undefined'?globalThis:this);
