/* Transient leader focus, not saved and never an omniscient enemy scan. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerCombatIntent=api;})(globalThis,function(){
  function create(ctx){let focus=null,left=0;
    function engage(monster,id){if(id!==ctx.active()||!monster?.alive)return false;const p=ctx.position(id),q=monster.model.position;if(!p||Math.hypot(p.x-q.x,p.z-q.z)>12||!ctx.clear(p,q))return false;focus=monster;left=8;return true;}
    function target(id){if(!focus?.alive||left<=0||ctx.policy(id)==='survive')return null;const p=ctx.position(id),q=focus.model.position;return p&&Math.hypot(p.x-q.x,p.z-q.z)<=22?focus:null;}
    return {engage,target,tick(dt){left=Math.max(0,left-dt);if(!focus?.alive||left===0)focus=null;},reset(){focus=null;left=0;}};
  }
  return {create};
});
