/* Original workshop pictograms shared by the game and its reference atlas. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerForgeIcons=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const drawings=Object.freeze({
    forge_durable:'<path d="M12 16l20-7 20 7v22Q46 52 32 59 18 52 12 38ZM22 17v18q2 10 10 14 8-4 10-14V17M26 29h12m-6-6v12"/>',
    forge_light:'<path d="M30 48Q12 33 30 10q15-9 24-3 3 29-24 41Zm-12 9L49 13M27 34l1-14m6 7 11-2M3 23h14M2 34h13M7 45h12"/>',
    forge_grip:'<path d="M19 7h24v22l10 8v15H8V37l11-8ZM14 44h33M17 45v8m10-8v8m10-8v8M21 16h18m-18 7h18M8 60h46m-10-3 5 6m-33-6-5 6"/>',
    forge_sharp:'<path d="m16 48 8-8L45 5l10 5-22 33-10 8ZM24 40l9 3M13 41l16 14m-21 1 10-10M5 10l9 5m1-12v9m36 16 8 1M43 58l-5-9"/>',
    forge_plated:'<path d="M10 18 32 9l22 9v14L32 42 10 32Zm0 15v10l22 11 22-11V33M20 15l12 7 12-7M32 23v17m0 5v9M5 6h8m-4-4v8"/>',
    forge_starvein:'<path d="m10 57 29-33M24 17l5-12 13 4 12 14-5 14-13-3-12-17Zm5-12 7 14 13 18M25 17l11 2 6-10M36 19l18 4M8 17l5 5m-9 5h8M40 48l6 8 9-9"/>',
    forge_abyssward:'<path d="M12 14 32 6l20 8v25Q42 55 32 60 22 55 12 39ZM20 23l12-7 12 7v10l-12 8-12-8ZM32 16v25M20 33l12-9 12 9M5 41l10 7m-7 5 13 4M59 41l-10 7m7 5-13 4"/>',
  });
  function svg(id){if(!Object.hasOwn(drawings,id))return '';return '<svg class="hero-icon forge-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="#284957" fill-opacity=".75" stroke="#f6db9e" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">'+drawings[id]+'</g></svg>';}
  return Object.freeze({svg,ids:Object.freeze(Object.keys(drawings))});
});
