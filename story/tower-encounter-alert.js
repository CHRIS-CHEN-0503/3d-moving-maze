/* One voice notice per entered story session; a reusable original geometric ! per encounter. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.TowerEncounterAlert=api;})(globalThis,function(){
  'use strict';
  function create({THREE:T,world,player,camera,voice,firstPerson=()=>false,viewportHeight=()=>globalThis.innerHeight||720}){
    let spoken=false,hold=0,left=0,marker=null;
    const projected=new T.Vector3(),viewPoint=new T.Vector3();
    function clearVisual(){if(marker){marker.parent?.remove(marker);marker.traverse(p=>{p.geometry?.dispose();p.material?.dispose();});marker=null;}hold=left=0;}
    function resetSession(){clearVisual();spoken=false;}
    function build(){marker=new T.Group();marker.name='tower-encounter-exclamation';
      for(const [geometry,y]of [[new T.BoxGeometry(.115,.36,.045),.12],[new T.SphereGeometry(.07,10,6),-.17]]){const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xff3448,depthWrite:false,depthTest:false}));mesh.position.y=y;mesh.renderOrder=1000;marker.add(mesh);}world().add(marker);
    }
    function update(threat,dt){const step=Math.max(0,Number(dt)||0);if(threat&&hold<=0){left=2.4;if(!spoken){spoken=true;voice();}}hold=threat?4:Math.max(0,hold-step);left=Math.max(0,left-step);
      if(left>0&&world()&&player()&&camera()){if(!marker)build();if(marker.parent!==world())world().add(marker);marker.visible=true;
        if(firstPerson()){marker.position.set(0,.16,-1.3).applyQuaternion(camera().quaternion).add(camera().position);marker.scale.setScalar(.45);}
        else{marker.position.copy(player().position);marker.position.y+=2.45+Math.sin((2.4-left)*7)*.045;marker.scale.setScalar(1);}
        const cam=camera();cam.updateMatrixWorld();
        // Keep the warning readable without filling the screen when the camera is close to a wall.
        viewPoint.copy(marker.position).applyMatrix4(cam.matrixWorldInverse);
        const span=cam.isPerspectiveCamera?2*Math.max(.1,-viewPoint.z)*Math.tan(cam.fov*Math.PI/360)/(cam.zoom||1):(cam.top-cam.bottom)/(cam.zoom||1);
        marker.scale.setScalar(Math.max(.04,Math.min(1.2,span*34/(Math.max(1,viewportHeight())*.54))));
        projected.copy(marker.position).project(cam);
        if(projected.z>=-1&&projected.z<=1&&(Math.abs(projected.x)>.92||Math.abs(projected.y)>.84)){projected.x=Math.max(-.92,Math.min(.92,projected.x));projected.y=Math.max(-.84,Math.min(.84,projected.y));marker.position.copy(projected.unproject(cam));}
        marker.quaternion.copy(cam.quaternion);
      }else if(marker)marker.visible=false;
    }
    return {update,resetSession,clearVisual,state:()=>({spoken,hold,left,visible:!!marker?.visible})};
  }
  return {create};
});
