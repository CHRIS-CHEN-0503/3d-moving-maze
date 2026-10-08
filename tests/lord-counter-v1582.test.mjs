import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8'),tower=read('story/tower-mode.js'),html=read('index.html');
function extract(source,name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\n  function ',start+1);return source.slice(start,end);}

test('the garden queen\'s two vines grow around her, on opposite sides, never far across the maze',()=>{
  for(const size of [13,15,17])for(const [lx,ly]of [[6,6],[size-2,size-3],[2,9],[Math.floor(size/2),1]]){
    const G={mazeW:size,mazeH:size,cell:4},cellPoint=(x,y)=>({x:x*4,z:y*4,cx:x,cy:y}),c=vm.createContext({G,cellPoint,Math});vm.runInContext(extract(tower,'gardenVinePoint'),c);
    const lord={x:lx*4,z:ly*4},used=new Set([lx+','+ly,'0,0']);
    const first=c.gardenVinePoint(lord,used,null);assert.ok(first);used.add(first.cx+','+first.cy);
    const second=c.gardenVinePoint(lord,used,first);assert.ok(second);
    for(const v of [first,second]){const d=Math.hypot(v.x-lord.x,v.z-lord.z)/4;assert.ok(d>=1.2&&d<=3.2,size+' '+lx+','+ly+': '+d);}
    const angle=v=>Math.atan2(v.x-lord.x,v.z-lord.z);let gap=Math.abs(angle(first)-angle(second));gap=Math.min(gap,Math.PI*2-gap);
    assert.ok(gap>=Math.PI/2,'different sides of the queen ('+gap.toFixed(2)+' rad)');assert.notDeepEqual([first.cx,first.cy],[second.cx,second.cy]);
    // Deterministic for the same floor.
    assert.deepEqual(c.gardenVinePoint(lord,new Set([lx+','+ly,'0,0']),null),first);
  }
  assert.match(tower,/if\(run\.floor===80\)point=gardenVinePoint\(lord,used,counterObjects\[0\]\);/);
});

test('lord counters are minimap beacons drawn above the sight fog, and the guidance says where to look',()=>{
  assert.match(tower,/beacon:counterObjects\.includes\(o\)/);
  const draw=html.slice(html.indexOf('function drawMap('),html.indexOf('\n}\n',html.indexOf('function drawMap(')));
  const fog=draw.indexOf('window.MazeSight?.map(ctx,pad,cw,ch);'),beacons=draw.indexOf('if(!m.beacon)continue;');
  assert.ok(fog>0&&beacons>fog,'beacons are painted after the fog');assert.match(draw,/if\(m\.beacon\)continue;/,'and skipped in the fogged pass');
  assert.match(tower,/斬斷她身旁的兩根供能藤（小地圖「藤」）/);assert.match(read('story/tower-floor-lords.js'),/兩根供能藤會長在園后附近（小地圖「藤」）/);
  assert.match(read('docs/職業裝備圖鑑.html'),/長在她附近的兩根供能藤（小地圖「藤」標示，迷霧中也看得到）/);
});
