/* Shared original resource symbols for game panels and the read-only atlas.
 * The clue and quest chest retain the existing world's octahedron/pedestal and
 * small chest silhouettes; these are not invented alternative game items. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TowerResourceIcons=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const drawings=Object.freeze({
    ironore:'<path fill="#71858f" d="m9 44 4-24L29 7l23 13 5 24-22 13Z"/><path fill="#adc5ca" d="m15 22 15-9 4 18-13 10Z"/><path fill="#91a8b2" d="m36 30 14-6 2 17-13 9Z"/><path d="m29 7 6 23-26 14m26-14 0 27"/>',
    toughfiber:'<path fill="#b8c2a0" d="M16 10q16-9 32 0v42q-16 11-32 0Z"/><ellipse fill="#dde0b9" cx="32" cy="10" rx="16" ry="7"/><path d="M16 19q16 8 32 0M16 28q16 8 32 0M16 37q16 8 32 0m-16-5q21 10 22 22H44"/><path fill="#a3865a" d="M12 40h40v8H12Z"/>',
    crystalshard:'<path fill="#74b9c8" d="m10 45 4-27 12-11 8 17-7 31Z"/><path fill="#c3f4ea" d="m14 18 12-11 0 30-16 8Z"/><path fill="#9d84bb" d="m31 44 8-31 16 8 2 27-18 9Z"/><path fill="#cfb9e8" d="m39 13 5 25-13 6Z"/><path d="m44 38 13 10M26 7l8 17"/>',
    embercore:'<path fill="#65545c" d="m10 42 2-24L27 6l23 9 8 26-18 16-24-5Z"/><path fill="#d15e3d" d="m17 37 4-17 13-7 11 9 4 15-15 14Z"/><path fill="#f4b85d" d="m24 34 6-13 9 2 3 13-8 7Z"/><path fill="#ffdf98" d="m30 30 5-6 2 12-6 2Z"/>',
    starore:'<path fill="#706886" d="m7 43 8-25L32 6l20 16 5 26-23 11Z"/><path fill="#a499bf" d="m15 18 17-12 4 23-16 16Z"/><path fill="#e5d6a6" d="m36 15 3 10 11 2-9 6 1 11-7-8-11 4 5-10-6-9 11 2Z"/><path d="m7 43 13 2 14 14m2-30 21 19"/>',
    abyssalloy:'<path fill="#64677d" d="m6 40 12-21 30-1 11 21-19 16-29-3Z"/><path fill="#a09cba" d="m18 19 30-1 1 23-28 4Z"/><path fill="#464659" d="m49 41 10-2-19 16-19-10Z"/><path d="m26 25 10-2 5 9-9 6-8-5Z m8 1-2 8m-14 5-2 7"/>',
    coin:'<ellipse fill="#a56b29" cx="34" cy="35" rx="22" ry="25"/><ellipse fill="#dfb658" cx="29" cy="31" rx="22" ry="25"/><ellipse fill="#edcc7b" cx="29" cy="31" rx="16" ry="19"/><path d="m29 17 10 14-10 14-10-14Z"/><path d="M51 24h5m-4 12h5m-8 11h5"/>',
    scrap:'<path fill="#7995a1" d="m15 7 7 2 4-5 7 3-1 6 5 5-4 6-6-2-5 5-6-4 1-7-5-3Z"/><circle cx="24" cy="16" r="4"/><path fill="#b4bac0" d="m9 35 12-7 14 9-2 15-13 7-14-10Z"/><path d="m13 37 9-5 9 6-2 11-9 5-10-7Z"/><path fill="#bd9c70" d="m45 17 11 7-5 25-10 7-7-7 7-10Z"/><path d="m43 29 10 5m-13 4 10 5m-16 6 8 4"/>',
    wood:'<path fill="#9d704b" d="m8 48 40-39 8 8-40 39Z"/><path fill="#ba946a" d="m6 17 9-8 43 36-10 11Z"/><path d="m19 26 28 23M22 35l5 6m4-14 4-6m8 19 5-1"/><ellipse fill="#d8b58a" cx="51" cy="13" rx="5" ry="3" transform="rotate(44 51 13)"/><path d="m23 21 16 18m-20-14 16 18"/>',
    cloth:'<path fill="#e1d2b3" d="M11 13 45 8l10 35-35 13Z"/><path fill="#c2b297" d="m11 13 9 43-10-5L5 19Z"/><path fill="#f1e3c9" d="m18 24 28-8 4 16-27 12Z"/><path d="m21 21 21-6M28 48l16-6m-34-9 6-2m32 7 4-1"/>',
    fuel:'<path fill="#a27b54" d="m7 19 5-7 45 33-5 7Z M9 47 4 40 47 8l5 7Z"/><path fill="#e0d0ad" d="m20 23 14-9 14 20-14 11Z"/><path d="m22 26 15 17m-9-22 14 18"/><path fill="#f0e3c8" d="m39 42 14-8 8 15-15 10Z"/>',
    clue:'<path fill="#526777" d="M12 47 32 40l20 7v8l-20 7-20-7Z"/><path fill="#6f8591" d="m12 47 20-7 20 7-20 7Z"/><path fill="#ffdd83" d="m32 3 15 25-15 18-15-18Z"/><path fill="#c59f56" d="m32 3 15 25-15 18Z"/><path d="m17 28 15 5 15-5M32 3v43"/>',
    questFragment:'<path fill="#aa7b51" d="M7 29h50v23L32 59 7 52Z"/><path fill="#c39867" d="M7 29q0-21 25-21t25 21Z"/><path fill="#dcc17f" d="M13 16h7v38l-7-2ZM44 16h7v38l-7 2Z"/><path d="M7 30h50M21 12q11-4 22 0"/><path fill="#d4bc80" d="M27 25h10v14H27Z"/><path d="M32 29v6"/>'
  });
  function svg(id){const body=drawings[id];return body?'<svg class="resource-icon hero-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#f4dca4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">'+body+'</g></svg>':'';}
  return Object.freeze({svg,ids:Object.freeze(Object.keys(drawings))});
});
