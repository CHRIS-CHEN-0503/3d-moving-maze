/* Original low-poly expedition presentation. Uses the existing render/update loop. */
(function(root){
  'use strict';
  function portrait(job){if(job==='robot')return root.TowerHeroIcons.svg('job_robot').replace('class="hero-icon"','class="party-glyph"');const colors={swordsman:'#83b5dc',mage:'#b99bff',scout:'#82dfbf',chef:'#ffd69c',healer:'#b9e6c4',smith:'#cca383',archer:'#e4d796',cleric:'#f0a9a9'},c=colors[job];const paths={swordsman:'M25 5 10 22l-4 5m4-9 9 8m-7-5 4 4',mage:'m12 26 9-18m-2-4 2 4 5 1-4 3 1 5-4-3-4 1 2-5-2-4Z',scout:'M6 14h20M8 14l4-7h8l5 7M9 18v6h14v-6m-10 1v2m6-2v2',chef:'M9 18c-9-7 1-14 7-8 6-6 16 1 7 8v9H9Zm1 6h12',healer:'M16 28V10M16 20C4 23 3 9 14 13m2 3C28 17 29 4 18 8',smith:'m7 27 13-14M14 8l5-5 10 10-5 5Z M6 23l4 4',archer:'M9 3q20 13 0 26V3M3 16h25m-5-4 5 4-5 4',cleric:'M5 9h22M8 13h16M11 9v18m10-18v18'};return '<svg class="party-glyph" viewBox="0 0 32 32" aria-hidden="true" style="color:'+c+'"><path d="'+paths[job]+'"/></svg>';}
  function baseFoodArt(id){const mushroom=id==='mushroom',herb=id==='herb',root=id==='root',shell=id==='shell',meat=id==='meat',nectar=id==='nectar';return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+(mushroom?'<path fill="#f0dbc6" d="M27 19h10v23H27z"/><path fill="#c88fae" d="M8 23C9 0 54 0 56 23Z"/><circle fill="#ffeacd" cx="23" cy="16" r="3"/>':herb?'<path stroke="#4eaf81" stroke-width="4" d="M30 44 36 8"/><ellipse fill="#88cf9a" cx="22" cy="24" rx="13" ry="7"/><ellipse fill="#b8e29e" cx="42" cy="13" rx="12" ry="7"/>':root?'<path fill="#d6ac68" d="M14 18Q54 5 49 27T10 39Z"/><path stroke="#649b69" stroke-width="4" d="m47 16 10-8m-9 8 0-12"/>':shell?'<path fill="#bba690" d="M9 39Q3 1 32 5q29-4 23 34Z"/><path stroke="#816e59" fill="none" d="M32 7v29M17 12l8 23m22-23-8 23"/>':meat?'<path fill="#d7836c" d="M9 34Q5 8 29 10t26 24Q27 49 9 34"/><path stroke="#f9d5b9" fill="none" stroke-width="5" d="M18 27q9-12 24 2"/>':nectar?'<path fill="#e9b750" d="M31 3Q5 31 18 40t26 0Q57 31 31 3"/><path stroke="#ffeb9d" stroke-width="4" d="M24 30q-4 7 3 9"/>':'<ellipse fill="#dfb775" cx="32" cy="26" rx="26" ry="10"/><path fill="#7da3b1" d="M6 26q4 21 26 20 22 1 26-20Z"/><circle fill="#86c69b" cx="22" cy="23" r="5"/><circle fill="#e3a273" cx="39" cy="26" r="6"/><path stroke="#d8e9e1" fill="none" stroke-width="2" d="M22 14q-5-5 0-10m12 10q-5-5 0-10m12 10q-5-5 0-10"/>')+'</svg>';}
  // Complete, original ingredient silhouettes are shared by kitchen and atlas.
  function foodArt(id){
    const art={
      cloudcap:'<path fill="#dbd7dc" d="M28 23h9v19h-9Z"/><path fill="#d9e7ee" d="M7 25Q3 15 15 14 15 3 28 8 37 0 46 11 63 11 58 25Z"/><path fill="#fff5db" d="M13 18q12-7 19 0t22 0v7H13Z"/>',
      sunseed:'<path fill="#75533b" d="m13 17 10-10 18 0 12 13-6 20-27 3-10-15Z"/><g fill="#f2cb66"><ellipse cx="24" cy="20" rx="5" ry="8" transform="rotate(-30 24 20)"/><ellipse cx="40" cy="20" rx="5" ry="8" transform="rotate(28 40 20)"/><ellipse cx="32" cy="34" rx="5" ry="8"/></g>',
      inkcap:'<path fill="#c6bdd5" d="M28 23h9v19h-9Z"/><path fill="#665777" d="M7 28Q13 3 32 4q18 0 25 24Z"/><path fill="#a08db3" d="M15 23Q23 7 32 9v15Z"/><path stroke="#cfc6dd" stroke-width="2" d="M15 28v5m11-5v8m16-8v7m9-7v4"/>',
      lotus:'<path fill="#cabba4" d="m13 8 36 10 3 19-9 8L8 29Z"/><ellipse fill="#f0dec3" cx="25" cy="24" rx="17" ry="19" transform="rotate(-22 25 24)"/><g fill="#a79885"><ellipse cx="19" cy="15" rx="3" ry="5"/><ellipse cx="30" cy="17" rx="3" ry="5"/><ellipse cx="17" cy="27" rx="3" ry="5"/><ellipse cx="29" cy="31" rx="3" ry="5"/></g>',
      crystaljelly:'<path fill="#80d4d5" d="M10 35 16 13q16-14 32 0l7 22q-22 17-45 0Z"/><ellipse fill="#b9f2e5" cx="32" cy="14" rx="16" ry="8"/><path fill="#e9fff5" d="m20 12 8-5 4 8-9 5Z"/><path stroke="#aef7e8" stroke-width="3" d="m16 31 9 5m17-17 5 12"/>',
      forestnut:'<path fill="#855432" d="M6 22Q18 3 30 21q5 16-12 23Q1 36 6 22Z"/><path fill="#cb9c59" d="M9 20q10 4 18 0-1 17-9 20Q8 31 9 20Z"/><path fill="#98683d" d="M35 10q17-6 23 12-2 18-14 20-15-6-9-32Z"/><path fill="#e1b978" d="M39 14q8-4 14 9-5 14-9 14-7-7-5-23Z"/>',
      emberpepper:'<path fill="#d74932" d="M15 17Q48 2 47 20T9 44q17-10 6-27Z"/><path fill="#f0863f" d="M23 19q17-11 17 0T18 37q12-10 5-18Z"/><path stroke="#60885a" stroke-width="5" fill="none" d="M39 12q-4-13 10-10"/>',
      frostberry:'<path stroke="#728e7b" stroke-width="4" d="M18 20 32 9l16 12M32 9V2"/><g fill="#8dbad9"><circle cx="18" cy="26" r="12"/><circle cx="43" cy="25" r="12"/><circle cx="31" cy="37" r="10"/></g><g fill="#e4f4f5"><path d="m11 19 4-5 6 2-2 6Zm27-2 5-4 5 4-5 3Zm-14 18 6-4 5 4-5 4Z"/></g>',
      coppergrain:'<path stroke="#99734b" stroke-width="3" d="m13 42 30-36m-7 36 17-25"/><g fill="#d6a15c"><ellipse cx="20" cy="31" rx="7" ry="4" transform="rotate(35 20 31)"/><ellipse cx="29" cy="24" rx="7" ry="4" transform="rotate(35 29 24)"/><ellipse cx="34" cy="15" rx="7" ry="4" transform="rotate(35 34 15)"/><ellipse cx="45" cy="32" rx="7" ry="4" transform="rotate(35 45 32)"/><ellipse cx="48" cy="23" rx="7" ry="4" transform="rotate(35 48 23)"/></g>',
      heartfruit:'<path fill="#e69178" d="M32 42C-7 20 13-8 32 10 52-8 73 20 32 42Z"/><path fill="#ffd498" d="M32 34q-18-14 0-22 18 8 0 22Z"/><path fill="#97be79" d="M32 9q-2-14 14-7-2 9-14 7Z"/>',
      deeproot:'<path fill="#786882" d="M7 28q5-19 21-21 7 10 24 13 13 13-4 22-8-9-23-3Q5 43 7 28Z"/><path fill="#b394b1" d="m16 19 10-5 4 12-10 4Zm19 8 11 1 1 9-9-3Z"/><path stroke="#c7a8bd" fill="none" d="m5 26 10 3m36 7 9 5"/>',
      blindshrimp:'<path fill="#d6bdd0" d="M48 8Q11-2 9 23q0 27 30 18L33 30Q18 35 19 23q0-10 20-5Z"/><path fill="#efe0df" d="m40 17 8-9 11 3-7 9Z"/><path stroke="#957894" stroke-width="2" fill="none" d="m13 17 9 3m-12 7 9-1m-6 9 9-5m-2 11 6-8M46 11 55 1m-9 10 14-3"/>',
      nighttruffle:'<path fill="#554557" d="M12 10q18-13 36 0t5 28q-16 15-38 2T12 10Z"/><path stroke="#987a90" stroke-width="3" fill="none" d="m15 10 7 9-8 7 10 13m7-33-2 16 9 7-5 15m12-32-5 8 12 8"/>',
      ashspice:'<path stroke="#b97965" stroke-width="3" d="m14 43 35-39"/><path fill="#b47166" d="M20 35Q-2 29 10 15q18-1 14 16ZM29 24q-7-23 9-24 9 16-6 25ZM35 23q19-19 27-4-8 16-27 8ZM24 37q26-11 27 4-17 10-27 0Z"/><path stroke="#dca785" stroke-width="2" d="m12 22 10 10m14-22-4 13m20-1-12 4m0 13-11-1"/>',
      starjelly:'<path fill="#9a89c8" d="M10 34 17 12q15-10 30 0l7 22q-22 15-44 0Z"/><ellipse fill="#c4b9e8" cx="32" cy="13" rx="15" ry="6"/><path fill="#fff0bf" d="m32 17 4 7 9 1-6 6 2 8-9-4-8 4 1-9-6-5 9-1Z"/>',
      dew:'<path fill="#7fae72" d="M8 38Q18 30 33 37 23 47 8 38Z"/><path fill="#9fd4ea" d="M34 7C31 17 20 24 20 31c0 15 28 15 28 0C48 24 37 16 34 7Z"/><path stroke="#dff5ff" stroke-width="3" stroke-linecap="round" fill="none" d="M29 21q-8 10-2 14"/><path stroke="#5fa7c7" stroke-width="2" stroke-linecap="round" fill="none" d="M23 36q11 11 22-1"/><g fill="#9fd4ea"><circle cx="48" cy="8" r="2.5"/><circle cx="53" cy="15" r="1.5"/></g>',
      cloudberry:'<path d="M23 14L32 23L43 13M32 23L30 35" fill="none" stroke="#679c9e" stroke-width="2"/><g fill="#9dd9ef"><circle cx="23" cy="23" r="7"/><circle cx="37" cy="23" r="8"/><circle cx="29" cy="34" r="8"/><circle cx="43" cy="33" r="6"/></g><path fill="#e9fbff" d="M12 18C8 14 12 9 17 10C18 3 27 4 29 10C34 8 39 12 36 17C30 21 19 20 12 18Z"/><path d="M20 21L22 19M34 20L37 18M26 32L28 30" fill="none" stroke="#e6faff" stroke-width="2" stroke-linecap="round"/>',
      windbell:'<path d="M29 42C34 30 30 17 35 6M32 17L19 13M32 24L45 18M31 32L19 27" fill="none" stroke="#5a9968" stroke-width="2"/><path fill="#85b873" d="M31 34C38 32 42 34 44 37C38 39 34 38 31 34ZM33 12C26 11 25 7 25 5C31 5 33 8 33 12Z"/><path fill="#b7a2df" d="M17 13C12 16 17 20 11 23C16 27 23 27 27 23C21 20 26 16 21 13ZM43 18C38 21 43 25 37 28C42 32 49 32 53 28C47 25 52 21 47 18ZM17 27C12 30 17 34 11 37C16 41 23 41 27 37C21 34 26 30 21 27Z"/><path d="M17 23L22 23M43 28L48 28M17 37L22 37" fill="none" stroke="#e7dcfa" stroke-width="2" stroke-linecap="round"/>',
      rosedew:'<path fill="#67875d" d="M31 13C24 10 21 6 22 4C29 3 33 7 34 11C36 6 42 5 46 7C44 12 39 14 34 14Z"/><path fill="#c85a7b" d="M31 12C15 9 9 22 14 34C19 46 40 46 49 35C57 23 48 10 35 12Z"/><path fill="#e8879e" d="M19 18C24 13 34 14 38 18C30 18 22 24 20 32C16 28 16 22 19 18Z"/><path fill="#a34268" d="M44 29C44 36 36 41 27 40C38 45 51 38 50 28Z"/><path fill="#c5f3f4" d="M41 17C41 17 35 23 35 27C35 33 45 34 46 28C47 24 43 20 41 17Z"/><path d="M40 24L39 27" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>',
      honeycomb:'<path fill="#b87824" d="M13 16L24 9L48 13L55 31L43 40L18 36Z"/><path fill="#f3c75c" d="M10 13L22 6L47 10L52 28L40 36L15 32Z"/><path fill="#cf8b2c" d="M17 14L23 11L29 15L28 22L21 24L16 20ZM33 15L39 12L45 16L46 23L39 27L33 23ZM24 26L30 23L36 27L35 33L28 34L23 31Z"/><path d="M18 14L23 12L27 15M34 15L39 14L43 17" fill="none" stroke="#ffe9a0" stroke-width="2" stroke-linecap="round"/><path fill="#e9aa35" d="M43 31C43 36 39 38 39 42C39 47 47 47 47 42C47 38 44 35 45 31Z"/><path d="M42 41L42 43" fill="none" stroke="#fff0af" stroke-width="2" stroke-linecap="round"/>',
      sapamber:'<path fill="#ca7b31" d="M22 7L42 9L52 24L45 39L26 44L12 31L14 16Z"/><path fill="#f6bb56" d="M22 7L40 11L46 25L39 37L24 39L15 29L17 17Z"/><path fill="#ffdc87" d="M22 10L34 12L25 19L19 31L17 26L19 17Z"/><path fill="#a58b3e" d="M26 30C26 20 36 18 40 19C40 26 35 31 26 30Z"/><path d="M26 32L36 23" fill="none" stroke="#d7b760" stroke-width="1.5"/><g fill="#ffe6a1"><circle cx="34" cy="15" r="2.5"/><circle cx="22" cy="26" r="2"/><circle cx="38" cy="34" r="1.5"/></g>',
      mossvelvet:'<path fill="#47734b" d="M9 33L6 28L11 25L9 19L16 19L17 12L23 15L28 8L32 13L39 9L42 15L49 14L49 20L56 23L53 28L58 33L51 37L49 41L40 40L34 44L27 41L18 43L15 38Z"/><path fill="#75a65e" d="M12 29L15 22L20 23L21 17L27 20L30 14L35 19L41 15L43 22L49 22L48 29L53 32L45 36L38 34L33 39L27 35L20 38L18 32Z"/><path fill="#97be75" d="M17 25L22 26L24 22L28 26L31 20L35 25L41 22L40 29L45 30L39 33L32 30L27 33L23 29L18 30Z"/><path d="M16 33L18 30M25 17L26 20M35 35L36 32M46 27L48 25" fill="none" stroke="#bbd498" stroke-width="1.5" stroke-linecap="round"/>',
      echosalt:'<path fill="#7dbdc5" d="M13 32L17 15L28 8L37 19L36 35L24 41Z"/><path fill="#c4eef0" d="M17 15L28 8L27 27L13 32Z"/><path fill="#e9ffff" d="M28 8L37 19L27 27Z"/><path fill="#a2d8dd" d="M27 27L37 19L36 35L24 41Z"/><path fill="#d4f3f3" d="M8 36L13 30L19 35L18 41L10 42Z"/><path d="M43 17C49 21 49 29 43 33M49 11C60 18 60 32 49 39" fill="none" stroke="#8ecdd4" stroke-width="2" stroke-linecap="round"/>',
      crystalcap:'<path fill="#9ccbdc" d="M26 25L38 25L42 40L32 44L22 40Z"/><path fill="#e0f6ff" d="M28 27L33 27L31 40L25 39Z"/><path fill="#6daccb" d="M8 25L16 12L31 5L47 13L56 26L42 31L22 31Z"/><path fill="#b7e5f8" d="M8 25L16 12L31 5L27 25Z"/><path fill="#dcf6ff" d="M31 5L47 13L38 25L27 25Z"/><path fill="#92cce8" d="M47 13L56 26L38 25Z"/><path d="M13 26L27 28L39 28L51 27" fill="none" stroke="#e9fbff" stroke-width="1.5"/>',
      inkberry:'<path d="M24 16L32 10L41 16M32 10L34 5" fill="none" stroke="#676849" stroke-width="2"/><path fill="#687858" d="M33 9C39 2 45 4 48 8C43 12 37 12 33 9Z"/><g fill="#30243d"><circle cx="23" cy="23" r="10"/><circle cx="40" cy="24" r="10"/><circle cx="31" cy="32" r="10"/></g><path fill="#171724" d="M39 30C38 36 43 36 43 40C43 46 51 46 51 40C51 36 45 34 45 29Z"/><path d="M18 19L21 17M37 19L40 18M27 29L29 27" fill="none" stroke="#88749b" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="47" cy="42" rx="1.5" ry="1" fill="#5e5279"/>',
      bookhoney:'<path fill="#9e7450" d="M7 14L28 17L32 21L36 17L57 14L55 38L36 40L32 43L28 40L9 38Z"/><path fill="#f4ead0" d="M9 10C18 8 27 11 32 16L32 38C25 32 16 33 9 34Z"/><path fill="#fff4d8" d="M32 16C39 10 47 8 55 10L55 34C46 32 38 33 32 38Z"/><path d="M13 15C19 14 24 16 27 18M38 18C42 15 47 14 51 15M13 29L22 29" fill="none" stroke="#d5c7a6" stroke-width="1.5"/><path fill="#e8ad38" d="M20 22C22 17 29 20 31 22C36 18 43 19 42 24C50 24 49 31 41 32L31 33C26 37 22 34 23 30C14 31 13 24 20 22Z"/><path d="M22 24C26 22 29 25 32 25L38 24" fill="none" stroke="#ffe49a" stroke-width="2" stroke-linecap="round"/>',
      mistalgae:'<path fill="#408e8e" d="M22 42C12 32 29 24 18 13C15 9 19 6 23 5C20 14 35 22 27 32C23 36 24 40 27 42Z"/><path fill="#69b4b0" d="M29 43C37 33 24 25 34 16C38 12 35 7 32 4C43 9 44 16 38 23C32 30 45 36 35 43Z"/><path fill="#397d87" d="M38 42C51 34 38 27 46 20C50 17 50 13 47 10C57 15 57 22 51 27C46 32 55 37 44 42Z"/><path d="M24 35C24 31 29 27 26 22M35 34C34 30 32 28 36 23" fill="none" stroke="#a4d5cd" stroke-width="1.5" stroke-linecap="round"/><g fill="#e1f3f1"><circle cx="10" cy="21" r="3"/><circle cx="14" cy="34" r="2"/><circle cx="47" cy="7" r="2"/><circle cx="55" cy="33" r="2.5"/></g>',
      ferryrice:'<path fill="#d6cbb1" d="M8 35C13 21 29 17 42 29L46 38C33 43 17 42 8 35Z"/><g fill="#f6edda"><ellipse cx="17" cy="31" rx="5" ry="2.5" transform="rotate(-30 17 31)"/><ellipse cx="27" cy="25" rx="5" ry="2.5" transform="rotate(20 27 25)"/><ellipse cx="35" cy="31" rx="5" ry="2.5" transform="rotate(40 35 31)"/><ellipse cx="25" cy="33" rx="5" ry="2.5" transform="rotate(-20 25 33)"/><ellipse cx="17" cy="37" rx="5" ry="2.5"/><ellipse cx="34" cy="38" rx="5" ry="2.5" transform="rotate(-15 34 38)"/></g><path fill="#6e9b65" d="M37 18L58 12C56 23 47 28 37 18Z"/><path fill="#abc78a" d="M37 18L58 12L46 20Z"/><path d="M39 19L54 16" fill="none" stroke="#507a53" stroke-width="1.5"/>',
      iceseed:'<ellipse cx="32" cy="42" rx="15" ry="3" fill="#bfdde8"/><path fill="#9edbea" d="M32 4C27 14 17 23 18 31C19 39 25 43 32 43C40 43 47 38 46 30C45 22 37 12 32 4Z"/><path fill="#dff8fc" d="M30 11C26 21 22 25 22 31C22 35 24 37 27 38C24 30 28 22 30 11Z"/><path fill="#d95b72" d="M32 34C29 31 25 28 26 25C27 22 31 22 32 25C34 22 38 23 38 26C38 29 34 32 32 34Z"/>',
      snowpaste:'<path fill="#accbd9" d="M17 17H47L45 39Q32 46 19 39Z"/><path fill="#e6f1ee" d="M21 20H43L42 36Q32 41 22 36Z"/><ellipse cx="32" cy="17" rx="15" ry="6" fill="#f9fcf1"/><path fill="#ffffff" d="M20 16Q22 10 28 13Q33 7 37 13Q44 11 45 17Q33 22 20 16Z"/><path stroke="#83bdd8" stroke-width="1.5" stroke-linecap="round" fill="none" d="M32 6V18M27 9L37 15M27 15L37 9M30 7L32 9L34 7M28 10L29 12L27 13M37 11L35 12L36 14"/><path stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" d="M23 25L24 33"/>',
      gearfungus:'<path fill="#d6b992" d="M28 23H37L40 40Q33 45 25 40Z"/><path fill="#aa8464" d="M34 25L37 39L32 41L34 25Z"/><path fill="#765039" d="M27 6H36L38 10L45 9L49 14L47 18L53 21L52 27L46 28L43 33L37 31L33 35L27 32L21 34L17 29L11 28L10 22L15 19L14 14L19 10L25 11Z"/><path fill="#ae7d4e" d="M27 12Q37 8 43 17Q48 26 37 29Q24 33 19 24Q14 16 27 12Z"/><path fill="#d6a36a" d="M24 14Q31 10 36 14L33 18L26 18Z"/><circle cx="32" cy="23" r="4" fill="#865a3d"/>',
      oilpepper:'<path fill="#566c3e" d="M38 12Q36 6 42 3L45 6Q39 8 43 14Z"/><path fill="#20252d" d="M40 11Q51 13 49 23Q47 35 30 39Q17 43 9 37Q23 37 27 27Q29 15 40 11Z"/><path fill="#373e49" d="M39 16Q44 14 45 19Q45 27 34 32Q39 25 39 16Z"/><path stroke="#a1beca" stroke-width="2" stroke-linecap="round" fill="none" d="M41 17Q44 22 39 27"/><path stroke="#607b91" stroke-width="1.5" stroke-linecap="round" fill="none" d="M20 37Q27 36 30 33"/>',
      lavasalt:'<path fill="#432d31" d="M11 30L19 12L34 6L48 15L54 32L43 42L23 43Z"/><path fill="#6d3335" d="M19 12L31 18L34 6L48 15L40 27L23 26Z"/><path fill="#261f29" d="M11 30L23 26L32 35L43 42L23 43Z"/><path stroke="#f16c37" stroke-width="3" stroke-linejoin="round" fill="none" d="M34 8L31 18L38 24L32 35L35 42M31 18L20 21L13 30M38 24L48 26L52 33"/><path stroke="#ffd277" stroke-width="1.2" stroke-linejoin="round" fill="none" d="M32 13L31 18L38 24L34 31M21 21L16 26M43 25L48 26"/>',
      fireantegg:'<ellipse cx="32" cy="41" rx="22" ry="3" fill="#dec3a6"/><path fill="#e96835" d="M22 22C16 19 10 27 11 34C12 41 20 42 25 37C29 32 28 25 22 22Z"/><path fill="#f68c3c" d="M33 9C26 9 23 19 26 26C29 33 38 31 41 24C44 17 40 9 33 9Z"/><path fill="#da5237" d="M45 23C38 22 33 31 36 37C39 43 48 41 52 35C55 29 51 24 45 23Z"/><path stroke="#ffce79" stroke-width="2" stroke-linecap="round" fill="none" d="M17 27L15 31M31 14Q28 18 29 21M43 28L40 32"/><path fill="#ffa83f" d="M13 10L15 15L12 18L10 14ZM49 8L51 13L48 16L47 12ZM56 21L58 24L55 26L54 23Z"/>',
      heartnectar:'<ellipse cx="32" cy="43" rx="11" ry="2" fill="#e6cc96"/><path fill="#d99736" d="M32 42C27 36 10 25 12 15C14 5 26 4 32 13C39 3 52 6 53 16C54 27 37 36 32 42Z"/><path fill="#f6bd57" d="M32 36C27 30 17 25 17 17C17 10 25 10 29 17L32 21L36 16C41 10 48 11 48 18C48 25 37 31 32 36Z"/><circle cx="33" cy="24" r="6" fill="#ffe19a"/><path fill="#fff9ce" d="M33 17L35 22L39 24L35 26L33 31L31 26L27 24L31 22Z"/><path stroke="#fff0b5" stroke-width="2" stroke-linecap="round" fill="none" d="M19 15Q21 11 25 14"/>',
      homewheat:'<path stroke="#a77a35" stroke-width="2" stroke-linecap="round" fill="none" d="M26 42L23 9M30 42L33 5M34 42L45 12"/><path fill="#e7b84c" d="M23 15Q15 12 17 7Q24 7 23 15ZM24 22Q15 20 16 14Q24 14 24 22ZM25 29Q17 28 17 22Q24 21 25 29ZM24 19Q24 11 29 10Q32 16 24 19ZM25 27Q25 20 30 19Q33 25 25 27Z"/><path fill="#f3cd68" d="M33 12Q27 9 30 3Q35 4 33 12ZM32 20Q26 18 26 12Q33 12 32 20ZM32 28Q25 25 26 20Q33 20 32 28ZM33 16Q34 9 39 9Q40 15 33 16ZM32 24Q34 17 39 18Q39 24 32 24Z"/><path fill="#d6a13e" d="M42 22Q37 18 40 13Q46 16 42 22ZM39 29Q34 24 37 20Q43 23 39 29ZM43 19Q44 12 50 12Q51 19 43 19ZM40 27Q42 20 48 20Q48 26 40 27ZM37 34Q39 27 45 27Q45 33 37 34Z"/><path stroke="#bd6b44" stroke-width="3" stroke-linecap="round" fill="none" d="M24 35L36 37M25 39L35 34"/>',
      rootsap:'<path fill="#715080" d="M18 8Q29 4 37 11L42 23L51 27L49 31L38 29L32 24L30 34L25 38L23 35L25 25L20 27L14 34L10 32L15 24L22 19Z"/><path fill="#9971a4" d="M20 10Q28 8 33 12L36 21L30 18L27 24L25 18Z"/><path stroke="#bc95c0" stroke-width="1.5" stroke-linecap="round" fill="none" d="M24 12L31 14M27 18L33 20M17 26L20 28M39 25L40 28"/><path fill="#9561ae" d="M49 33Q42 41 48 44Q55 44 49 33Z"/><path fill="#d4addf" d="M48 38Q45 41 48 42Z"/><path fill="#688254" d="M19 9Q12 8 11 3Q18 2 22 8Z"/>',
      darkmoss:'<path fill="#686183" d="M28 23H36L39 41Q32 45 24 40Z"/><path fill="#3d3555" d="M33 24L36 40L31 41Z"/><path fill="#4c416a" d="M10 25Q31 35 54 25L45 20L19 20Z"/><path fill="#292539" d="M9 25Q14 9 29 7Q45 5 55 25Q44 22 36 25Q28 21 20 25Q15 23 9 25Z"/><path fill="#463952" d="M17 19Q21 10 30 10Q35 10 37 13Q24 12 17 19Z"/><g fill="#8795d0"><circle cx="18" cy="28" r="2"/><circle cx="24" cy="30" r="1.5"/><circle cx="41" cy="29" r="2"/><circle cx="47" cy="27" r="1.5"/><circle cx="38" cy="33" r="1.5"/></g>',
      canalalgae:'<path fill="#8e7154" d="M25 13L39 10L43 39Q35 45 27 40Z"/><ellipse cx="32" cy="12" rx="7" ry="3" fill="#b79b72"/><path stroke="#604d3b" stroke-width="1.5" stroke-linecap="round" fill="none" d="M30 20L33 37M36 18L39 35"/><path fill="#275e4e" d="M18 42Q9 31 20 24Q28 18 18 8Q36 15 25 27Q16 32 24 41ZM31 42Q39 34 29 29Q18 22 34 19Q44 17 42 6Q53 20 37 24Q32 25 39 29Q48 35 39 43Z"/><path fill="#3d8264" d="M44 42Q38 32 49 26Q55 22 51 15Q62 24 51 31Q45 35 49 42Z"/><path stroke="#78a38b" stroke-width="1.2" stroke-linecap="round" fill="none" d="M20 36Q17 31 23 27M35 22Q44 20 45 15M47 37Q46 33 51 30"/>',
      blindroe:'<path fill="#d4c4cb" d="M9 35Q12 28 25 28Q45 24 55 35Q54 43 32 44Q12 43 9 35Z"/><path fill="#e5c6d0" d="M32 18A9 8 0 1 1 14 18A9 8 0 1 1 32 18ZM51 20A10 9 0 1 1 31 20A10 9 0 1 1 51 20Z"/><ellipse cx="20" cy="32" rx="10" ry="9" fill="#f4dfe1"/><ellipse cx="43" cy="34" rx="11" ry="9" fill="#eed2d9"/><ellipse cx="32" cy="29" rx="10" ry="10" fill="#f8e9e7"/><g fill="#d8a9b7"><circle cx="23" cy="19" r="2"/><circle cx="41" cy="21" r="2"/><circle cx="20" cy="33" r="2"/><circle cx="43" cy="35" r="2.5"/><circle cx="32" cy="30" r="2"/></g><path stroke="#fff8f1" stroke-width="2" stroke-linecap="round" fill="none" d="M18 15L21 13M37 15L41 14M15 29L18 27M28 25L31 23M39 31L43 29"/>',
      sunkentea:'<path stroke="#78979a" stroke-width="4" fill="none" d="M47 24q17-2 10 10-3 4-10 2"/><path fill="#789ca1" d="M13 20h34v15q-17 14-34 0Z"/><ellipse fill="#a48a54" cx="30" cy="20" rx="17" ry="6"/><path fill="#afbd7b" d="M18 17q7-7 13-2 6-5 14-1l-5 12q-6-5-11-1-4-5-13-1Z"/><path stroke="#64805b" stroke-width="1.5" fill="none" d="M31 15l-2 10m-8-6 6 2m9-3 5-1"/><path stroke="#c7dcd4" stroke-width="2" stroke-linecap="round" fill="none" d="M18 29v5q4 5 9 5"/>',
      nightberry:'<path stroke="#778d85" stroke-width="2.5" fill="none" d="M23 16q9-7 17 3M32 12V5"/><path fill="#3b315e" d="M10 29C5 14 27 5 32 20 39 8 59 16 54 33 48 47 36 46 31 37 18 46 10 38 10 29Z"/><path fill="#665084" d="M15 21q8-8 14 1-8-2-13 9-4-4-1-10Zm23 2q8-6 12 1-7-1-10 8-4-3-2-9Z"/><path fill="#f6e8b6" d="m22 17 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm22 11 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z"/><g fill="#c8c0ed"><circle cx="31" cy="30" r="1.5"/><circle cx="38" cy="20" r="1"/><circle cx="23" cy="36" r="1"/></g>',
      charcoalcore:'<path fill="#292d35" d="M10 17 27 8 49 13 56 32 42 43 17 40 7 29Z"/><path fill="#171e29" d="m27 8 4 16 25 8-14 11-25-3 9-12-16-11Z"/><path stroke="#59606b" stroke-width="2" fill="none" d="m11 19 14 7-9 11m13-26 4 11 13-7m-8 18 13 1-10 6"/><path fill="#9d5935" d="m28 23 8 1 4 7-8 5-7-7Z"/><circle fill="#d78143" cx="32" cy="28" r="4"/><circle fill="#f3b965" cx="32" cy="28" r="1.5"/>',
      ashsalt:'<ellipse fill="#acada7" cx="32" cy="39" rx="25" ry="5"/><path fill="#d6d5cb" d="M7 38 17 28 24 30 34 14 43 25 48 24 58 38q-25 10-51 0Z"/><path fill="#f2f0e6" d="m13 36 5-5 6 3 10-20 2 19 8-4 9 8-17-2-10 5Z"/><path fill="#92958f" d="m15 13 4-3 3 2-4 3Zm11-7 3-2 2 3-3 2Zm19 9 4-2 2 3-4 1Z"/><g fill="#b5b7ae"><circle cx="28" cy="35" r="1.5"/><circle cx="43" cy="37" r="1"/><circle cx="12" cy="22" r="1"/><circle cx="41" cy="6" r="1.5"/></g>',
      stardewhoney:'<path fill="#dca13b" d="M28 7C27 19 12 23 15 34c3 13 29 12 31-1 1-9-11-14-18-26Z"/><path fill="#f7cf71" d="M28 15q-1 9-7 15-3 9 9 11-16-1-11-13Z"/><path stroke="#fff0b8" stroke-width="2.5" stroke-linecap="round" fill="none" d="M25 25q-5 8 1 11"/><path fill="#fff3bc" d="m45 4 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path fill="#edbd54" d="M53 31q-7 8-2 11t2-11Z"/>',
      gatewheat:'<path stroke="#a5a086" stroke-width="3" stroke-linecap="round" fill="none" d="M39 41V18a9 9 0 0 1 18 0v23M36 41h7m10 0h7"/><path stroke="#a77f40" stroke-width="2" stroke-linecap="round" fill="none" d="m17 43 11-34m-2 27-2-22"/><path fill="#dbb45f" d="M28 4q7 7-1 13-4-7 1-13ZM25 21q-12 0-11-10 9 1 11 10Zm-2 8q-13 0-12-10 10 1 12 10Zm-3 8Q7 38 8 28q10 0 12 9Zm6-11q0-11 10-12 0 10-10 12Zm-3 9q1-11 10-12 1 10-10 12Z"/><path stroke="#f5dc94" stroke-width="1.5" fill="none" d="m17 16 5 4m-8 4 6 4m-8 4 6 3m11-14 4-3m-7 12 4-3"/>',
      dragonpepper:'<path stroke="#63885a" stroke-width="4" stroke-linecap="round" fill="none" d="M21 13q-5-10 8-9"/><path fill="#bd3f49" d="M16 12C6 20 17 42 54 42 42 34 41 24 33 16 28 12 23 10 16 12Z"/><path fill="#e87450" d="M15 19q0 17 28 20-17-9-20-18-4-5-8-2Z"/><path fill="#799154" d="m15 12 8-2 7 6-7-1-3 4-1-5Z"/><path stroke="#932f3c" stroke-width="1.5" fill="none" d="M15 20q5 7 10 1m1-4q3 7 9 7M20 28q6 6 11 0m1 0q3 7 9 6M31 36q4 3 8 1"/><path stroke="#f4ac7a" stroke-width="2" stroke-linecap="round" fill="none" d="M15 24q1 5 5 7"/>',
      thundercap:'<path fill="#e7cd7f" d="M23 24h9l4 18H20Z"/><path fill="#c28c41" d="M6 25q17-9 36 0v4q-18 7-36 0Z"/><path fill="#ecc74f" d="M6 26Q8 9 25 8q15 0 17 18Z"/><path fill="#fff0a0" d="M12 21q3-9 13-9l-4 9Z"/><path stroke="#f6e2a0" stroke-width="2" fill="none" d="M26 31v7"/><path fill="#efb745" d="M53 4 43 23h8l-5 18 16-24H53l6-13Z"/>',
      moonsalt:'<path fill="#f3e7b6" d="M47 4C31 2 23 18 33 29 39 36 52 34 57 25 42 31 31 13 47 4Z"/><path fill="#94c7de" d="M9 33 17 14 28 19 33 11 44 29 39 42 19 44Z"/><path fill="#d1eef3" d="m17 14 4 19-12 0Zm16-3 2 19-11 5 4-16Z"/><path fill="#b4dee9" d="m21 33 3 2 11-5 4 12-20 2Z"/><path stroke="#edfaff" stroke-width="1.5" fill="none" d="m18 18 3 15 3 7m9-24 2 14 6-1"/>',
      phantomfruit:'<path fill="#f3effa" stroke="#e6def4" stroke-width="2" d="M10 28q-4-17 11-18 6-7 13-3 18-6 20 15 3 19-20 23-19 1-24-17Z"/><path fill="#dfd1ed" d="M17 25q-1-14 12-12 11-6 17 6 7 15-7 21-17 6-22-15Z"/><path fill="#eee6f7" d="M38 14q11 6 8 19-3 10-14 9 9-9 6-28Z"/><path fill="#b5bfc9" d="M32 13q-4-10 7-10-4 5-2 11Z"/><path stroke="#faf8ff" stroke-width="2.5" stroke-linecap="round" fill="none" d="M25 19q-6 3-6 10"/><path stroke="#ece5f7" stroke-width="2" stroke-linecap="round" fill="none" d="M6 20q-2 6 0 11m51-15q4 9 1 17"/>',
      goldhoney:'<path fill="#bd8a41" d="M15 13h21v7l5 6v15q-16 9-32 0V26l6-6Z"/><path fill="#edbd56" d="M13 28h24v11q-12 6-24 0Z"/><path fill="#d7a54c" d="M14 12h22v6H14Z"/><ellipse fill="#f5d98a" cx="25" cy="12" rx="12" ry="4"/><path fill="#e8c473" d="M43 33C38 15 49 3 59 4q1 20-16 29Z"/><path stroke="#a27e3f" stroke-width="1.5" stroke-linecap="round" fill="none" d="M41 43 55 9m-9 19-1-10m5 2 6-4"/><path stroke="#fff0b4" stroke-width="2" stroke-linecap="round" fill="none" d="M17 29v7"/>',
      abyssalgae:'<path fill="#162c42" d="M29 42Q8 36 9 13q15 10 20 29Zm0 0Q20 18 34 4q8 20-5 38Zm2 0q7-23 25-24-1 21-25 24Z"/><path fill="#244862" d="M29 37q-3-18 5-29 1 19-5 29Zm6 2q9-15 18-18-8 13-18 18Z"/><path stroke="#3b7e88" stroke-width="1.5" stroke-linecap="round" fill="none" d="M28 37q-4-14 4-26m1 28 16-14M25 37l-9-13"/><g fill="#78d8cd"><circle cx="32" cy="17" r="1.5"/><circle cx="46" cy="28" r="1"/><circle cx="18" cy="30" r="1"/></g>',
    };
    return art[id]?'<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+art[id]+'</svg>':baseFoodArt(id);
  }
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
        trail_bread:'<ellipse fill="#b5c1ad" cx="32" cy="35" rx="29" ry="10"/><path fill="#bf8d55" d="M9 31Q11 5 32 7t23 24q-23 14-46 0Z"/><path fill="#e7bf7c" d="M12 29Q15 11 32 12t20 17q-21 11-40 0Z"/><path stroke="#976747" stroke-width="2" d="m20 17 5 9m5-12 4 12m6-10 4 9"/><path fill="#6b9e69" d="M27 31q-16-14-16-2 7 10 16 2m0 0q10-15 15-5-3 9-15 5"/>',
        honey_roast:'<path fill="#626e78" d="M3 11h58v27L32 46 3 38Z"/><path fill="#929a97" d="M7 15h50v19L32 41 7 34Z"/><path fill="#d6b47d" d="m13 22 12-8 11 10-12 9Z m20 10 10-9 11 7-12 9Z"/><path fill="#b18597" d="M29 22q7-15 19 2Zm-16 13q3-13 13-1Z"/><path fill="none" stroke="#f0c866" stroke-width="3" d="m13 26 14-5m-7 14 11-5m10-4 9 5"/>',
        crab_pot:'<path fill="#976a54" d="M7 19h50l-3 23Q31 52 10 42Z"/><ellipse fill="#e1b976" cx="32" cy="20" rx="25" ry="9"/><path fill="none" stroke="#654939" stroke-width="4" d="M8 26H2v10h8m46-10h6v10h-8"/><path fill="#d38e74" d="M12 22q6-13 16-1l-5 6Zm20-4q8-11 17 2l-7 8Z"/><path fill="#f0d19b" d="m28 17 6-2 3 10-8 1Z"/>',
        herbal_platter:'<ellipse fill="#cadac9" cx="32" cy="27" rx="30" ry="17"/><path fill="#83b68c" d="M9 20q9-15 16 0-7 16-16 0Zm29 9q15-12 18 1-7 15-18-1ZM27 12q12-7 16 1-7 8-16-1Z"/><path fill="#a8788f" d="M12 33q4-13 14 0ZM35 24q2-14 14 0Z"/><path fill="#f1d17b" d="M27 17q-8 11 0 13t0-13Z"/><path stroke="#e6edcf" stroke-width="2" d="m10 22 14 1m16 7 13 1"/>',
        root_banquet:'<path fill="#5e897c" d="M8 16h48v26q-24 10-48 0Z"/><ellipse fill="#dab777" cx="32" cy="16" rx="24" ry="9"/><path fill="#bd9970" d="m11 14 14-4 5 11-12 3Z m26-1 11 2-3 11-9-3Z"/><path fill="#b57f9c" d="M25 16q4-12 13 1Z"/><path fill="none" stroke="#92b979" stroke-width="3" d="m18 16 24 3M18 29q8 10 26 1M10 36q18 13 44-1"/><path stroke="#96aaa1" fill="none" stroke-width="3" d="M8 23H2v12h6m48-12h6v12h-6"/>',
        mist_broth:'<path fill="#bad8d5" d="M10 22h38v18q-19 10-38 0Z"/><ellipse fill="#94ba9d" cx="29" cy="22" rx="19" ry="7"/><path fill="none" stroke="#9fc6c4" stroke-width="5" d="M48 26q21-3 0 12"/><path fill="#e3c97a" d="m20 23 7-5 7 5-7 4Z"/><path fill="none" stroke="#e6f2df" stroke-width="2" d="M17 15q-10-5 0-11m12 11q-10-6 0-13m12 13q-10-5 0-11"/>',
        ember_crab:'<ellipse fill="#657981" cx="32" cy="34" rx="30" ry="12"/><path fill="#e4926c" d="M10 29q5-25 23-13 17-8 23 15-25 14-46-2Z"/><path fill="#bd6a50" d="m8 23 12-7-1 14Zm37-4 10 8-12 5Z"/><path stroke="#704c3a" stroke-width="3" d="m21 17 5 13m7-15 5 18m8-11 4 11"/><path fill="none" stroke="#f2c665" stroke-width="3" d="M14 28q10-9 15 2t18-1"/>',
        gate_feast:'<path fill="#b5c9bc" d="M2 22q30-13 60 0v15q-30 14-60 0Z"/><ellipse fill="#e2d9bb" cx="32" cy="22" rx="30" ry="10"/><path fill="#d99274" d="M5 22q6-18 20-4l-6 11Z"/><path fill="#8daf7a" d="m23 27 8-16 9 17Z"/><path fill="#7da9af" d="M40 17h20v15q-10 8-20 0Z"/><ellipse fill="#ebbf73" cx="50" cy="17" rx="10" ry="4"/><path fill="#eaca87" d="M29 1h6v10h-6Z"/><path fill="#fff1b5" d="M30 0h4v7h-4Z"/>',
        medley:'<path fill="#947b74" d="M9 23h46l-5 17q-18 12-36 0Z"/><ellipse fill="#bca36e" cx="32" cy="23" rx="23" ry="8"/><path fill="#86573f" d="m15 20 9-4 5 8-10 4Z"/><path fill="#78a652" d="m28 19 8-3 4 8-9 2Z"/><path fill="#9671ac" d="m39 23 7-6 6 8-9 4Z"/><path fill="#ddc6a3" d="m21 28 7-2 2 3-7 2Z"/><path fill="#e5dfcc" d="M23 15q-7-4-2-9l2-3 2 2q-6 5 0 8Zm16 0q-7-4-2-9l2-3 2 2q-6 5 0 8Z"/>',
        hidden_might:'<ellipse fill="#bdc9c5" cx="32" cy="35" rx="29" ry="10"/><path fill="#763640" d="M9 25q0-17 20-13 20-3 20 14v6q-5 10-23 7-17 2-17-9Z"/><path fill="#a44e55" d="M10 24q2-15 19-10 16-4 19 11-5 10-22 7-15 2-16-8Z"/><path fill="#ce7e75" d="M15 20q7-7 16-3l-1 3q-8-3-14 3Z"/><path fill="#763e3e" d="m20 21 3-1 5 9-3 1Zm11-1 3-1 5 10-3 1Z"/><path fill="#c6d5d7" d="M35 3h2v8h2V2h2v9h2V3h2v11l-4 3v8h-3v-8l-3-3Z"/><path fill="#d7673d" d="M51 37q-10-8-2-17l2 6q5-7 4-13 13 16-4 24Z"/><path fill="#efbc65" d="M52 33q-5-3 1-10 3 6-1 10Z"/><path fill="#759668" d="m54 15-2-6 3-1 2 5Z"/>',
        hidden_bulwark:'<path fill="#69777e" d="M3 23h8v12H3Zm50 0h8v12h-8Z"/><path fill="#7d898c" d="M9 19h46l-3 21q-20 12-40 0Z"/><ellipse fill="#b4b5a1" cx="32" cy="19" rx="23" ry="9"/><ellipse fill="#918d63" cx="32" cy="19" rx="19" ry="6"/><path fill="#d7cbb0" d="m16 19 5-7 8 3-4 8Zm17-4 7-3 6 8-10 2Z"/><path fill="#a69a7d" d="m20 15 3 3-2 4 2-1 2-4-3-3Zm18-1 2 4 5 1-2 2-5-2-2-4Z"/><path fill="#4e636d" d="m25 30 7-3 7 3v6q-1 5-7 8-6-3-7-8Z"/><path fill="#b9cac9" d="m28 32 4-2 4 2v4q-1 3-4 5-3-2-4-5Z"/><path fill="#e0e6d8" d="m28 32 4-2v11q-3-2-4-5Z"/>',
        hidden_featherstep:'<ellipse fill="#b9d2d1" cx="28" cy="37" rx="25" ry="9"/><path fill="#cbdcdd" d="M12 27h28l-3 13q-11 7-22 0Z"/><path fill="#f7f4e6" d="M11 27q-4-11 6-12 2-11 12-5 11-4 12 7 7 7-2 12Z"/><ellipse fill="#fffbed" cx="26" cy="20" rx="11" ry="5"/><path fill="#a8c3c8" d="m19 31 2 1 1 9-2-1Zm10 1h2l-1 10h-2Z"/><path fill="#eaf5ef" d="M43 34Q37 16 59 7q4 18-16 27Z"/><path fill="#bfd5d4" d="m46 23 5 1-8 8 2-7Zm5-8 4 3-7 5Z"/><path fill="#94b6ba" d="m42 38 13-25 2 1-13 25Z"/>',
        hidden_vigor:'<path fill="#424c58" d="M2 21h9v13H2Zm46 0h9v13h-9Z"/><path fill="#515c68" d="M8 21h43l-3 18q-17 14-37 0Z"/><ellipse fill="#8a6250" cx="29" cy="21" rx="21" ry="8"/><path fill="#b67a60" d="m14 19 8-4 6 8-9 3Zm17 4 5-8 9 4-3 7Z"/><path fill="#dab889" d="m17 19 5-2 2 2-6 2Zm18 0 2-2 5 2-1 2Z"/><g fill="#d6b68c"><circle cx="30" cy="16" r="3"/><circle cx="21" cy="10" r="2.5"/><circle cx="38" cy="8" r="2"/></g><circle fill="#f4c881" cx="51" cy="33" r="11"/><path fill="#dc8075" d="M51 41C34 30 44 24 51 30c7-6 17 0 0 11Z"/><path fill="#ffe4be" d="M43 31q2-4 5-1l-1 2q-2-2-3 1Z"/>',
        hidden_swift:'<ellipse fill="#99b9b6" cx="32" cy="37" rx="27" ry="8"/><path fill="#ede7cb" d="m17 33 15-24q3-4 7 1l16 21q4 7-5 9l-28-2q-9-1-5-5Z"/><path fill="#fff9df" d="m21 29 13-17q2-3 4 0l6 10q-12-6-23 7Z"/><path fill="#55796b" d="m33 25 10 3-2 11-13-3Z"/><circle fill="#cc8672" cx="37" cy="18" r="3"/><path fill="#a6bd8b" d="m34 28 2 1-2 7-2-1Z"/><path fill="#ffffff" d="m3 22 20-10 2 3L5 25Zm0 10 15-8 2 3L5 35Z"/>',
        hidden_keen:'<ellipse fill="#b9d2d8" cx="32" cy="38" rx="26" ry="8"/><path fill="#849ec3" d="m14 32 6-18 13-8 13 10 4 17-17 8Z"/><path fill="#b9dfe4" d="m20 14 13-8-3 15-16 11Z"/><path fill="#a7c8dd" d="m33 6 13 10 4 17-13-8Z"/><path fill="#667fa9" d="m14 32 16-5 7-2 13 8-17 8Z"/><path fill="#effff6" d="M22 23q10-11 21 0-11 10-21 0Z"/><circle fill="#83bfc5" cx="32" cy="23" r="4"/><circle fill="#446378" cx="32" cy="23" r="2"/><circle fill="#ffffff" cx="33" cy="22" r="1"/><path fill="#e5f8f4" d="m22 15 6-4-2 7-5 3Z"/>',
        hidden_ironskin:'<ellipse fill="#9eafb3" cx="27" cy="36" rx="24" ry="9"/><path fill="#697d8e" d="M6 30q1-22 23-22 17 0 20 23-21 13-43-1Z"/><path fill="#94a5ad" d="M10 28q4-17 20-16 13 0 15 16-17 10-35 0Z"/><path fill="#d3e0dd" d="m17 16 5-3 12 20-6 1Zm12-3 3 1 10 15-4 1Z"/><path fill="#586d7d" d="m22 15 2-1 8 13-2 1Zm12 1 2 1 6 9-2 1Z"/><path fill="#566875" d="m45 30 14-3 2 12-15 4-2-11Z"/><path fill="#b4c6c9" d="m48 32 9-2 1 7-9 3Z"/><g fill="#657c88"><circle cx="50" cy="33" r="1"/><circle cx="56" cy="36" r="1"/></g>',
        hidden_spirittide:'<ellipse fill="#bbd5d9" cx="29" cy="40" rx="23" ry="7"/><path fill="#8cb9cc" d="M44 24c17-2 16 16 0 15v-4c10-1 11-8 0-7Z"/><path fill="#a8d5e3" d="M13 22h31v13q-15 13-31 0Z"/><ellipse fill="#dff4ed" cx="28" cy="22" rx="16" ry="6"/><ellipse fill="#b9e3e9" cx="28" cy="22" rx="12" ry="4"/><ellipse fill="#f3fff6" cx="24" cy="21" rx="6" ry="1.5"/><path fill="#d5edf0" d="M22 16q-5-5 0-10l2 2q-3 3 1 7Z"/><path fill="#f0e7b8" d="m36 2 2 4 4 1-4 2-2 4-2-4-4-2 4-1Zm13 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/><circle fill="#d3edec" cx="28" cy="3" r="1.5"/><path fill="#deeff0" d="m18 28 3 1v7l-3-2Z"/>',
        hidden_lucky:'<path fill="#8aa888" d="M9 25h43l-5 16q-16 10-33 0Z"/><path fill="#f0e5c3" d="M9 25q-3-7 6-9 3-6 10-3 5-7 11-2 10-2 14 7 5 4 2 7-22 12-43 0Z"/><path fill="#d5c598" d="m18 23 5-1 1 2-5 1Zm10-5 5 1-1 2-5-1Zm8 9 5-2 1 2-5 2Z"/><path fill="#608f60" d="M19 12h3l2 10-3 1Z"/><path fill="#8ebc78" d="M20 10C10 11 10 3 16 3q4 0 4 5 0-5 5-5c7 0 7 8-3 7 9 1 8 8 2 8q-4 0-4-5 0 5-4 5c-6 0-7-7 4-8Z"/><circle fill="#c99b49" cx="48" cy="12" r="8"/><circle fill="#f1ce76" cx="48" cy="12" r="6"/><path fill="#b58b43" d="M47 7h2v10h-2Z"/><path fill="#fff0b1" d="M43 10q1-4 5-3v2q-3 0-3 2Z"/>',
        hidden_warmth:'<circle fill="#edac65" cx="32" cy="23" r="19"/><circle fill="#f3c67f" cx="32" cy="23" r="14"/><path fill="#915d48" d="M3 29h9v9H3Zm49 0h9v9h-9Z"/><path fill="#bb7b54" d="M10 29h44v11q-22 12-44 0Z"/><ellipse fill="#e7ae61" cx="32" cy="29" rx="22" ry="7"/><path fill="#f4dcad" d="M14 29q1-10 8-9 7 2 7 10Zm14-2q2-11 8-8 7 2 6 10Zm14 3q1-8 6-7 5 2 4 8Z"/><path fill="#c89b61" d="m20 23 3 5-2 1-3-5Zm14-1 3 4-2 1-3-4Z"/><path fill="#fff0d2" d="M19 19q-9-5-2-11 3-3 1-6l4 1q2 5-3 9-3 3 3 6Zm13-2q-8-5-1-10 2-2 0-6h4q3 5-2 9-3 2 2 6Zm14 3q-8-4-2-10 3-2 1-5l4 1q2 4-3 8-2 2 3 4Z"/>',
        hidden_rejuvenate:'<path fill="#96c6b9" d="M9 23h46l-5 17q-18 12-36 0Z"/><ellipse fill="#d0ead8" cx="32" cy="23" rx="23" ry="8"/><ellipse fill="#b1dbbc" cx="32" cy="23" rx="20" ry="6"/><path fill="#e6f8dc" d="M17 24q15 8 30 0l-1 2q-14 7-28 0Zm3-5q12-5 24 0l-1 2q-11-5-22 0Z"/><path fill="#719f82" d="M16 23q-7-9-2-15 9 8 5 16Zm6 0q-2-11 8-14 1 10-8 14Z"/><g fill="#edc8ca"><circle cx="38" cy="16" r="3"/><circle cx="43" cy="19" r="3"/><circle cx="42" cy="24" r="3"/><circle cx="36" cy="24" r="3"/><circle cx="34" cy="19" r="3"/></g><circle fill="#e5bd65" cx="39" cy="20" r="2.5"/><circle fill="#e8fff2" cx="16" cy="14" r="2"/><path fill="#c6e7d7" d="m16 33 3 1 2 6-3-1Z"/>',
        hidden_ward_burn:'<ellipse fill="#263c50" cx="29" cy="42" rx="24" ry="4"/><path fill="#6699b9" d="M7 25h41l-5 12q-3 6-16 6T12 37Z"/><ellipse fill="#d2eef0" cx="27" cy="25" rx="21" ry="8"/><ellipse fill="#82ccd9" cx="27" cy="25" rx="17" ry="5"/><path fill="#e5f7f3" d="m14 23 7-5 5 5-7 5Zm17-3 7 1 2 6-8 1Z"/><path fill="#548eac" d="m24 28 6-5 4 6-7 3Z"/><path fill="#9fc8dd" d="M13 32q10 7 24 4l-2 4q-15 3-22-8Z"/><circle fill="#edf1de" cx="52" cy="35" r="10"/><path fill="#dc8052" d="M51 25q4 4 2 7l4-3q6 11-4 13-10 0-9-7 1-4 5-6-1 5 2 5 2-3 0-9Z"/><path fill="#f4bd65" d="M51 34q5 6 1 7-5-1-1-7Z"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#b9655a" d="m43 42 15-15 2 2-15 15Z"/>',
        hidden_ward_poison:'<ellipse fill="#304337" cx="28" cy="42" rx="23" ry="4"/><path fill="#56754e" d="M7 24h42l-5 14q-5 6-16 6T12 38Z"/><ellipse fill="#b8cb85" cx="28" cy="24" rx="22" ry="8"/><ellipse fill="#77a963" cx="28" cy="24" rx="18" ry="5"/><path fill="#d4dc91" d="M14 24q3-8 10-5-1 7-10 5Zm15 0q5-8 11-2-5 5-11 2Z"/><circle fill="#dce7ac" cx="24" cy="26" r="2"/><circle fill="#edf0c8" cx="34" cy="21" r="1.5"/><path fill="#83a268" d="M14 33q8 7 20 5l-3 4q-13 0-17-9Z"/><circle fill="#eee8d1" cx="52" cy="35" r="10"/><path fill="#567e59" d="M52 25q-3 5-6 9-4 8 6 9 10-1 6-9Z"/><path fill="#a9c880" d="M49 33q-3 4-1 6l2-1q-2-2 1-5Z"/><circle fill="#dce5b0" cx="54" cy="38" r="1.5"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#bf6259" d="m43 42 15-15 2 2-15 15Z"/>',
        hidden_ward_slow:'<ellipse fill="#594435" cx="28" cy="42" rx="24" ry="4"/><path fill="#b77b4c" d="M6 26h44l-6 12q-5 6-16 6T12 38Z"/><ellipse fill="#ead1a1" cx="28" cy="26" rx="22" ry="8"/><ellipse fill="#e5a158" cx="28" cy="25" rx="18" ry="5"/><path fill="#f7d794" d="m14 24 6-2 2 2-6 2Zm12-4 5 1-1 2-5-1Zm8 5 6 1-1 2-6-1Zm-12 2 5-1 1 2-5 1Z"/><path fill="#d8a66c" d="M14 33q8 7 21 5l-3 4q-12 0-18-9Z"/><circle fill="#f0e7cf" cx="52" cy="35" r="10"/><path fill="#88704e" d="M43 37h13l3-5 2 1-2 5q-1 3-6 3h-9Z"/><circle fill="#bc925c" cx="51" cy="34" r="6"/><path fill="#f0cf8c" d="M52 29q-7-1-7 5 0 6 6 5 5-1 5-5 0-4-4-4-4 0-4 4 0 3 3 3l1-2q-3 1-2-1 0-2 2-2 3 1 1 4-2 3-5 0-3-5 4-5Z"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#bc5d52" d="m43 42 15-15 2 2-15 15Z"/>',
        hidden_ward_shock:'<ellipse fill="#493a32" cx="28" cy="42" rx="24" ry="4"/><path fill="#79715f" d="M5 33h46l-7 9H13Z"/><ellipse fill="#c1b79a" cx="28" cy="33" rx="23" ry="6"/><path fill="#98613c" d="M10 32q0-17 17-19 18-2 20 18-14 11-37 1Z"/><path fill="#c38c55" d="M13 28q3-12 15-12 12 0 15 12-14 7-30 0Z"/><path fill="#edd2a0" d="m19 20 4-2 4 10-4 1Zm11-3 4 1 3 9-4 1Z"/><path fill="#714c34" d="M14 33q15 5 28-1l-2 4q-16 5-26-3Z"/><circle fill="#eee6ca" cx="52" cy="35" r="10"/><path fill="#bc8b35" d="M52 25h7l-6 8h6L47 45l3-10h-5Z"/><path fill="#f2cf6c" d="M53 27h3l-6 8h4l-4 5 2-7h-3Z"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#9f5550" d="m43 42 15-15 2 2-15 15Z"/>',
        hidden_ward_curse:'<ellipse fill="#554733" cx="28" cy="42" rx="24" ry="4"/><path fill="#b28a43" d="M7 26h42l-6 13q-4 5-15 5T13 39Z"/><ellipse fill="#f2da91" cx="28" cy="26" rx="21" ry="7"/><path fill="#dfb951" d="M11 26q2-8 8-7 2-8 9-6 7-2 10 6 7 0 8 7-16 9-35 0Z"/><path fill="#fff0b5" d="m17 22 5-2 1 2-5 2Zm9-6 5 1-1 2-5-1Zm8 6 5 2-1 2-5-2Zm-10 4 5-1 1 2-5 1Z"/><path fill="#efd482" d="M15 33q9 6 21 4l-3 5q-13 0-18-9Z"/><path fill="#fff3bf" d="m28 4 2 5 5 1-5 2-2 5-2-5-5-2 5-1Z"/><circle fill="#f4e6c7" cx="52" cy="35" r="10"/><path fill="#946991" d="M42 35q10-13 20 0-10 13-20 0Z"/><ellipse fill="#d9b4cd" cx="52" cy="35" rx="4" ry="5"/><ellipse fill="#594b71" cx="52" cy="35" rx="2" ry="4"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#bf6654" d="m43 42 15-15 2 2-15 15Z"/>',
        hidden_ward_root:'<ellipse fill="#344b3a" cx="28" cy="42" rx="24" ry="4"/><path fill="#77947c" d="M6 27h44l-7 13q-5 4-15 4T13 40Z"/><ellipse fill="#d5dfb5" cx="28" cy="27" rx="22" ry="7"/><path fill="#518352" d="M11 26q-4-10 6-12 5 1 6 7-1-14 8-13 8 3 3 15 9-13 15-4 3 7-9 11Z"/><path fill="#8bb565" d="M15 28q-5-10 3-12 7 4 5 12Zm11 0q-4-12 5-15 6 7-1 15Zm8 0q4-11 12-8-1 10-12 8Z"/><path fill="#d8d79a" d="m19 21 2-1 7 12-2 1Zm12-4 2 1-3 14-2-1Z"/><circle fill="#dd956c" cx="17" cy="29" r="3"/><circle fill="#efd79d" cx="36" cy="28" r="3"/><path fill="#9bb296" d="M15 34q8 6 20 4l-4 4q-12-1-16-8Z"/><circle fill="#eee8ce" cx="52" cy="35" r="10"/><path fill="#56835e" d="M50 44q-6-5-1-10 6-4 3-8l3-1q5 7-2 11-5 3 0 7Z"/><path fill="#78a166" d="M51 32q-8 1-7-6 7-1 7 6Zm3 5q7-7 8 0-4 5-8 0Zm-5 3q-7 2-7-4 5-3 7 4Z"/><path fill="#fff4db" d="m42 41 15-15 4 4-15 15Z"/><path fill="#bc6256" d="m43 42 15-15 2 2-15 15Z"/>',
    };
    Object.assign(drawings,{
      trail_bread:'<ellipse fill="#bfd2d2" cx="32" cy="35" rx="29" ry="10"/><path fill="#d4a568" d="M7 32Q16 5 32 9t25 23q-23 13-50 0Z"/><path fill="#e4e7e8" d="M17 22q-3-9 7-8 5-8 11-1 10-3 12 9Z"/><path fill="#f7e9c9" d="M22 23h20l-3 8H25Z"/>',
      honey_roast:'<ellipse fill="#c3d5bc" cx="32" cy="30" rx="29" ry="15"/><g fill="#d99f52"><ellipse cx="19" cy="26" rx="8" ry="10" transform="rotate(-25 19 26)"/><ellipse cx="37" cy="23" rx="8" ry="10" transform="rotate(25 37 23)"/><ellipse cx="34" cy="36" rx="10" ry="7"/></g><path stroke="#ffe3a0" stroke-width="3" fill="none" d="M13 25q6-7 15 2t20 0M27 35h12"/>',
      herbal_platter:'<ellipse fill="#bfd0ca" cx="32" cy="31" rx="29" ry="14"/><path fill="#d5ba8d" d="M10 24q19-12 44 1v10q-21 12-44-1Z"/><path fill="#78617c" d="M14 25q5-23 19 0Zm21 4q4-25 17 0Z"/><path stroke="#c8b4c8" stroke-width="2" d="m20 19 5 5m17-5 4 7"/><path fill="#79a572" d="M22 33q-2-13 10-9-1 9-10 9Z"/>',
      crab_pot:drawings.crab_pot+'<g fill="#efddc0" stroke="#ae9475" stroke-width="1.5"><ellipse cx="30" cy="17" rx="6" ry="7"/><path d="M28 14v2m4-2v2m-3 3v2"/></g>',
      crystal_pudding:'<ellipse fill="#cee7df" cx="32" cy="37" rx="29" ry="9"/><path fill="#76c4c9" d="m13 32 6-19q13-11 26 0l6 19q-19 16-38 0Z"/><ellipse fill="#b8f1e4" cx="32" cy="13" rx="13" ry="6"/><path fill="#effffa" d="m24 9 6-4 7 5-6 6Z"/><path stroke="#c5f0e8" stroke-width="3" fill="none" d="M20 27q7 9 21 0"/>',
      forest_roast:'<path fill="#8c6b52" d="M6 22h52l-5 19q-21 12-42 0Z"/><ellipse fill="#d9c091" cx="32" cy="22" rx="26" ry="10"/><g fill="#a46f43"><ellipse cx="18" cy="21" rx="6" ry="8" transform="rotate(-20 18 21)"/><ellipse cx="40" cy="23" rx="7" ry="8" transform="rotate(20 40 23)"/></g><path fill="#eed5a2" d="m24 16 8-3 5 12-9 3Z"/>',
      ember_skewer:'<path stroke="#b49b7a" stroke-width="4" d="m7 43 48-38"/><path fill="#dc633b" d="M12 29q4-17 21-13-4 14-18 18Zm24-18q8-14 20-3-6 9-14 8Z"/><path fill="#ebc88a" d="m25 22 6-6 9 9-6 7Z"/><path stroke="#99664a" stroke-width="2" d="m29 20 7 7"/>',
      frost_compote:'<path fill="#a6cbdb" d="M12 20h40v18q-20 17-40 0Z"/><ellipse fill="#b59acd" cx="32" cy="20" rx="20" ry="8"/><g fill="#dde5f4"><circle cx="21" cy="18" r="5"/><circle cx="32" cy="15" r="5"/><circle cx="42" cy="20" r="5"/></g><path fill="none" stroke="#efdca0" stroke-width="3" d="M15 23q11 5 28 0"/>',
      copper_flatbread:'<ellipse fill="#a8bfc3" cx="32" cy="35" rx="29" ry="10"/><path fill="#bd8648" d="m18 8 9 3 10-6 6 8 11 2-1 11 6 8-10 5-2 7-13-1-8 3-7-7-12-2 2-11-4-6 10-6Z"/><path fill="#dfb66c" d="M16 20q16-13 32 0v13q-16 10-32-1Z"/><circle fill="#9b713e" cx="32" cy="25" r="7"/>',
      heart_jam:'<path fill="#c39483" d="M15 12h34v31q-17 9-34 0Z"/><path fill="#e49b87" d="M19 18h26v22q-13 7-26 0Z"/><ellipse fill="#ead1a2" cx="32" cy="12" rx="19" ry="7"/><path fill="#ffe1ae" d="M32 37C10 24 26 19 32 25c6-6 22-1 0 12Z"/>',
      root_banquet:drawings.root_banquet+'<path fill="#a28aab" d="m11 13 15-4 4 12-13 3Zm26-1 11 2-3 11-9-3Z"/>',
      mist_broth:drawings.mist_broth+'<path fill="#e8bfda" d="M37 20q-12-10-17 0t11 5l-3-4q-7 2-4-2t10 3Z"/>',
      ember_crab:'<ellipse fill="#b7c4c9" cx="32" cy="35" rx="30" ry="11"/><path fill="#dbc198" d="M9 24q23-14 46 0v10q-22 12-46 0Z"/><path fill="#786275" d="m12 23 4-9 9 2 4 9-8 6Zm19-3 9-9 11 5 1 12-14 4Z"/><path stroke="#c2a2b4" stroke-width="2" d="m17 17 5 6-4 4m24-12-3 7 7 4"/>',
      ash_stew:'<path fill="#6c737a" d="M7 17h50v24q-25 13-50 0Z"/><ellipse fill="#cf9e72" cx="32" cy="18" rx="25" ry="9"/><path fill="#efd09f" d="m13 17 12-4 7 10-14 2Zm24-3 9 2-2 9-9-5Z"/><path fill="#a96963" d="M24 16q-13-10-10 2 7 7 10-2ZM35 19q12-10 13 1-6 7-13-1Z"/>',
      gate_feast:'<path fill="#929bba" d="M4 22h56v17q-28 14-56 0Z"/><ellipse fill="#c1acd5" cx="32" cy="22" rx="28" ry="11"/><path fill="#f6dfaa" d="m21 12 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Zm23 3 2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1Z"/>'
    });
    // Hidden dishes share one drawing per effect family; the medley and anything unknown fall back to the medley bowl.
    const recipe=globalThis.TowerPartyCore?.RECIPES?.[id],key=drawings[id]?id:recipe?.hidden?'hidden_'+(recipe.buff||'ward_'+recipe.ward):id;
    return '<svg class="party-food" viewBox="0 0 64 48" aria-hidden="true">'+(drawings[key]||drawings.medley||'')+'</svg>';
  }
  function create(ctx){
    const P=root.TowerPartyCore,X=root.TowerExpedition,T=ctx.THREE,V=root.TowerCharacters,H=root.TowerHeroes;
    // The follower list is built once per frame (and again after each state transaction), not once per monster and companion.
    const modern=()=>!!r()?.party?.loadouts,records=()=>{const run=r();if(!recordsOf||recordsOf.run!==run)recordsOf={run,list:modern()?H.followerRecords(run):run.party.members};return recordsOf.list;};
    const heroes=root.TowerHeroesRuntime?.create({...ctx,actors:()=>actors,safeCamp,assemble,robotService:()=>{const service=root.TowerEncounters.serviceContext(r(),'tieLing');return service&&workshopSafe(service)?{service}:{safe:safeCamp()};},syncActors,hit:applyHit,portrait,walkClear:(a,b)=>walkClear(a,b)});
    let actors=[],queue=[],queueClock=0,stations=[],near=null,offer=null,group=null,pulse=0,uiClock=0,ailmentLeft=0,recordsOf=null,skillLeft=0,guardVoiceLeft=0,worldFloor=null,worldSeed=null,working=null,pendingForge=null,pendingDismantle=null,pendingRepair=null,pendingAffix=null,forgeSelected=null,forgeService,forgePage='list';
    const r=()=>ctx.run(), enabled=()=>!!r()?.party, live=()=>enabled()&&(modern()||!ctx.inDungeon())&&worldFloor===r().floor&&worldSeed===r().seed;
    const esc=ctx.text,act=ctx.action;
    const dressActor=a=>root.TowerHeroVisuals.dress(T,a.model,H.equipment(r(),a.id),ctx.dispose,{showHelmet:H.actor(r(),a.id).showHelmet});
    const distance=p=>Math.hypot(ctx.G.px-p.x,ctx.G.pz-p.z);
    const clear=p=>ctx.clear(ctx.G.px,ctx.G.pz,p.x,p.z);
    const QUEUE_GAP=1.8,BODY_GAP=1.15;
    const walkClear=(a,b)=>ctx.followClear?ctx.followClear(a,b):ctx.clear(a.x,a.z,b.x,b.z);
    function assemble(ids,definition){if(!modern()||ctx.paused()||ctx.G.shifting)return false;const origin={x:ctx.G.px,z:ctx.G.pz},points=[origin];for(const [dx,dz]of [[0,1.5],[0,-1.5],[1.5,0],[-1.5,0],[0,3],[0,-3],[3,0],[-3,0]]){const p={x:origin.x+dx,z:origin.z+dz};if(walkClear(origin,p)&&points.every(other=>Math.hypot(p.x-other.x,p.z-other.z)>=BODY_GAP&&Math.hypot(p.x-other.x,p.z-other.z)<=definition.formation.distance))points.push(p);}const members=actors.filter(a=>ids.includes(a.id)&&H.hp(r(),a.id)>0);if(points.length<members.length+1){ctx.toast('這裡太窄，先走到較寬的通道再集合。',1800,false);return false;}const used=[origin];for(const a of members){const p=points.slice(1).filter(p=>!used.includes(p)).sort((p,q)=>Math.hypot(a.model.position.x-p.x,a.model.position.z-p.z)-Math.hypot(a.model.position.x-q.x,a.model.position.z-q.z))[0];used.push(p);a.assembly={...p,left:8,active:H.state(r()).active};a.path=[];a.pathLeft=0;}return true;}
    const part=(parent,geometry,color,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,new T.MeshLambertMaterial({color,flatShading:true}));m.position.set(x,y,z);parent.add(m);return m;};
    const ball=(p,s,c,x,y,z)=>part(p,new T.SphereGeometry(s,8,6),c,x,y,z);
    const box=(p,a,b,c,color,x,y,z)=>part(p,new T.BoxGeometry(a,b,c),color,x,y,z);
    const ring=(p,size,color)=>{const mesh=part(p,new T.TorusGeometry(size,.04,4,20),color,0,.07,0);mesh.rotation.x=Math.PI/2;return mesh;};
    function label(model,name,y=2.65){const tag=ctx.makeText(name);tag.position.y=y;tag.scale.set(1.65,.28,1);model.add(tag);model.userData.partyTag=tag;return tag;}
    function healthBar(model,color,y=2.15){const back=new T.Sprite(new T.SpriteMaterial({color:0x192939,depthWrite:false})),bar=new T.Sprite(new T.SpriteMaterial({color,depthWrite:false}));back.position.y=bar.position.y=y;back.scale.set(1,.08,1);bar.scale.set(.94,.055,1);back.renderOrder=1;bar.renderOrder=2;model.add(back,bar);model.userData.partyHp=bar;model.userData.partyHpBack=back;}
    function baseIngredientModel(id){const model=new T.Group();if(id==='mushroom'){part(model,new T.CylinderGeometry(.13,.16,.55,8),0xead8bc,0,.28,0);part(model,new T.SphereGeometry(.45,10,6,0,Math.PI*2,0,Math.PI/2),0xca8db8,0,.48,0);}else if(id==='root'){const bulb=ball(model,.33,0xcfac76,0,.25,0);bulb.scale.set(1.3,.7,.8);for(let i=0;i<3;i++){const leaf=box(model,.12,.45,.035,0x83b776,(i-1)*.1,.6,0);leaf.rotation.z=(i-1)*.6;}}else if(id==='herb'){for(let i=0;i<4;i++){const leaf=ball(model,.2,0x8bc79a,(i%2?1:-1)*.12,.2+i*.1,0);leaf.scale.set(1.2,.5,.4);}}else if(id==='nectar'){part(model,new T.ConeGeometry(.25,.4,8),0xecc05d,0,.4,0);ball(model,.25,0xecc05d,0,.15,0);}else if(id==='shell'){const m=ball(model,.35,0xcab196,0,.2,0);m.scale.y=.6;}else{const m=ball(model,.35,0xda9682,0,.2,0);m.scale.y=.55;}return model;}
    function ingredientModel(id){
      if(['root','mushroom','herb','nectar','shell','meat'].includes(id))return baseIngredientModel(id);
      const model=new T.Group();model.userData.ingredient=id;
      const orb=(s,c,x,y,z,sx=1,sy=1,sz=1)=>{const m=ball(model,s,c,x,y,z);m.scale.set(sx,sy,sz);return m;};
      if(id==='cloudcap'||id==='inkcap'){
        part(model,new T.CylinderGeometry(.1,.14,.45,8),id==='cloudcap'?0xe2dde1:0xc6bdd5,0,.23,0);
        part(model,new T.SphereGeometry(.39,10,6,0,Math.PI*2,0,Math.PI/2),id==='cloudcap'?0xd9e7ee:0x665777,0,.45,0);
        if(id==='cloudcap')for(const s of [-1,1])orb(.18,0xeaf2ef,s*.25,.49,0,1, .65,1);
      }else if(id==='sunseed'||id==='forestnut'||id==='frostberry'){
        const color={sunseed:0xf2cb66,forestnut:0xb78953,frostberry:0x8dbad9}[id];
        for(let i=0;i<3;i++)orb(.18,color,Math.sin(i*2.1)*.2,.21,Math.cos(i*2.1)*.2,.8,id==='sunseed'?1.4:1,1);
        if(id==='frostberry')for(let i=0;i<2;i++)orb(.065,0xe5f2f1,(i-.5)*.26,.39,.03);
      }else if(id==='lotus'){
        const piece=part(model,new T.CylinderGeometry(.31,.31,.24,10),0xe8d3b5,0,.2,0);piece.rotation.z=.4;
        for(let i=0;i<4;i++)orb(.055,0xab947f,Math.sin(i*Math.PI/2)*.15,.33,Math.cos(i*Math.PI/2)*.15,1,.18,1);
      }else if(id==='crystaljelly'||id==='starjelly'){
        part(model,new T.CylinderGeometry(.2,.36,.4,10),id==='starjelly'?0xa190cd:0x81cfd0,0,.22,0);
        part(model,new T.OctahedronGeometry(.12),id==='starjelly'?0xffe9b7:0xd8fbf0,0,.48,0);
      }else if(id==='emberpepper'){
        const pod=orb(.27,0xdc633b,0,.29,0,.6,1.4,.65);pod.rotation.z=.7;
        const stem=part(model,new T.CylinderGeometry(.025,.04,.2,5),0x709861,.13,.53,0);stem.rotation.z=.7;
      }else if(id==='coppergrain'){
        for(let i=0;i<3;i++){const x=(i-1)*.13,stem=part(model,new T.CylinderGeometry(.022,.027,.5,5),0xa77e49,x,.25,0);stem.rotation.z=(i-1)*.25;for(let j=0;j<2;j++)orb(.1,0xd6a15c,x,.4+j*.13,0,.65,1.25,.7);}
      }else if(id==='heartfruit'){
        orb(.25,0xe69178,-.13,.32,0,.85,1,1);orb(.25,0xe69178,.13,.32,0,.85,1,1);
        const tip=part(model,new T.ConeGeometry(.24,.3,8),0xe69178,0,.13,0);tip.rotation.z=Math.PI;
        orb(.13,0x97be79,.1,.57,0,1.4,.3,.6);
      }else if(id==='deeproot'||id==='nighttruffle'){
        const color=id==='deeproot'?0x907d9b:0x655162;
        orb(.31,color,0,.24,0,id==='deeproot'?1.4:1,.7,.9);
        if(id==='nighttruffle')for(let i=0;i<3;i++)orb(.085,0x91738a,(i-1)*.15,.41,0,1,.4,1);
      }else if(id==='blindshrimp'){
        const tail=part(model,new T.TorusGeometry(.25,.095,5,10,Math.PI*1.5),0xd6bdd0,0,.18,0);tail.rotation.x=Math.PI/2;
        const fin=part(model,new T.ConeGeometry(.14,.18,3),0xe8d6dd,.22,.18,0);fin.rotation.z=Math.PI/2;
      }else if(id==='ashspice'){
        for(let i=0;i<4;i++){const leaf=orb(.17,0xb47166,(i%2?1:-1)*.1,.15+i*.09,0,1.4,.3,.7);leaf.rotation.z=(i%2?1:-1)*.4;}
      }else return baseIngredientModel(id);
      return model;
    }
    function materialModel(id){
      const model=new T.Group();model.userData.material=id;
      if(id==='toughfiber'){
        part(model,new T.CylinderGeometry(.23,.23,.48,10),0xb8c2a0,0,.26,0);
        part(model,new T.CylinderGeometry(.245,.245,.11,10),0xa3865a,0,.23,0);
      }else if(id==='crystalshard'){
        for(let i=0;i<2;i++){const shard=part(model,new T.OctahedronGeometry(.34),i?0xac90cc:0x89d1dc,(i-.5)*.28,.36,0);shard.scale.set(.6,1.5,.65);shard.rotation.z=(i-.5)*.35;}
      }else if(id==='abyssalloy'){
        const ingot=part(model,new T.CylinderGeometry(.26,.34,.25,4),0x8b88a3,0,.17,0);ingot.rotation.y=Math.PI/4;ingot.scale.z=1.4;
        part(model,new T.OctahedronGeometry(.09),0xc9bfdc,0,.36,0);
      }else{
        const color={ironore:0x829ba7,embercore:0x65545c,starore:0x817394}[id]||0x829ba7;
        const rock=part(model,new T.DodecahedronGeometry(.36,0),color,0,.29,0);rock.scale.y=.85;
        if(id==='embercore'||id==='starore')part(model,new T.OctahedronGeometry(.16),id==='embercore'?0xf4b85d:0xe5d6a6,.12,.48,.1);
      }
      return model;
    }
    function memberModel(job,level,identity='companion',gender=P.PROFESSIONS[job].gender){
      if(modern()&&ctx.makeHero){const m=ctx.makeHero(job,identity,gender);m.userData.partyProfession=job;return m;}
      const model=job==='swordsman'?V.buildWarrior(level,{THREE:T}):V.buildExplorer({mage:'sena',scout:'eve',chef:'rowan',healer:'mira',smith:'oren',archer:'eve',cleric:'mira'}[job],{THREE:T});
      model.userData.partyProfession=job;
      if(job==='swordsman')return model;
      const color=P.PROFESSIONS[job].color;
      const mantle=box(model,.85,.22,.58,color,0,1.27,0);mantle.name='profession-mantle';
      if(job==='chef'){part(model,new T.CylinderGeometry(.27,.26,.45,8),0xf1ebda,0,2.15,0);ball(model,.29,0xf1ebda,0,2.35,0);}
      if(job==='mage'){part(model,new T.ConeGeometry(.33,.7,8),color,0,2.24,0);ball(model,.17,0xbbe9ee,-.55,1.6,0);}
      if(job==='smith'){box(model,.12,.75,.12,0x806043,-.5,.65,.13);box(model,.48,.22,.22,0x93a5b3,-.5,1.08,.13);}
      return model;
    }
    function monsterModel(kind,strength,regionalDef){
      if(!P.MONSTERS[kind])return null;const def=regionalDef||P.MONSTERS[kind],model=new T.Group(),body=new T.Group();model.add(body);body.position.y=1;
      if(kind==='mushroom'){part(body,new T.CylinderGeometry(.28,.38,1,8),0xe4d7be,0,-.4,0);part(body,new T.SphereGeometry(.86,12,7,0,Math.PI*2,0,Math.PI/2),def.color,0,.03,0);for(let i=0;i<5;i++)ball(body,.1,0xffe9c1,Math.cos(i*1.3)*.52,.42,Math.sin(i*1.3)*.52);}
      if(kind==='crab'){const shell=ball(body,.65,def.color,0,-.45,0);shell.scale.set(1.15,.6,1);for(const s of [-1,1]){for(let i=0;i<3;i++){const leg=box(body,.65,.09,.1,0x946d55,s*.7,-.7,(i-1)*.4);leg.rotation.z=s*.25;}ball(body,.3,0xd9b286,s*.7,-.3,.6);}}
      if(kind==='moth'){ball(body,.3,0x8b724a,0,0,0);for(const s of [-1,1]){const wing=ball(body,.6,def.color,s*.57,0,0);wing.scale.set(1,.13,.85);wing.name='party-wing';}}
      if(kind==='flower'){part(body,new T.CylinderGeometry(.18,.3,1.2,7),0x698d55,0,-.4,0);for(let i=0;i<6;i++){const petal=ball(body,.34,0xd58e9e,Math.cos(i*Math.PI/3)*.4,.38,Math.sin(i*Math.PI/3)*.4);petal.scale.y=.4;}ball(body,.3,0xe9c974,0,.38,0);}
      for(const s of [-1,1])ball(body,.08,0x223549,s*.2,0,.43);
      model.userData.body=body;model.userData.ring=ring(model,.92,0xe28476);model.userData.ring.material.transparent=true;model.userData.tag=label(model,def.name+' · '+strength+'/5');return model;
    }
    // Boss mechanisms are looked up once at build time instead of searching their children every frame.
    function bossParts(model){const seal=model.children.find(x=>x.name==='seal'),sealMaterials=[];seal?.traverse(o=>{if(o.isMesh)sealMaterials.push(o.material);});return {seal,sealMaterials,arms:model.children.filter(x=>x.name==='boss-arm'),warning:model.children.find(x=>x.name==='boss-warning'),water:model.children.find(x=>x.name==='boss-water'),color:null};}
    function stationModel(kind,index){const model=new T.Group();
      if(kind==='camp'){part(model,new T.CylinderGeometry(.6,.8,.16,8),0x657785,0,.08,0);for(let i=0;i<3;i++){const log=box(model,.9,.12,.12,0xc3a27b,0,.2,0);log.rotation.y=i*2;}const pot=part(model,new T.SphereGeometry(.44,10,7,0,Math.PI*2,0,Math.PI/2),0x859da8,0,.65,0);pot.rotation.z=Math.PI;label(model,'旅人營地',1.7);return model;}
      const d=X.BOSSES[r().floor],type=d.kind;
      part(model,new T.CylinderGeometry(.58,.7,.4,8),0x6e8593,0,.2,0);
      const seal=new T.Group();seal.name='seal';seal.position.y=1.2;model.add(seal);
      const turner=['mirror','reverse','gear'].includes(type)||type==='heart'&&index===1;
      if(turner){
        if(type==='gear'){const wheel=part(seal,new T.TorusGeometry(.48,.12,5,12),d.color);wheel.rotation.x=Math.PI/2;for(let i=0;i<6;i++)box(seal,.17,.17,.17,d.color,Math.sin(i*Math.PI/3)*.56,0,Math.cos(i*Math.PI/3)*.56);}
        else box(seal,.75,.9,.12,d.color,0,0,0);
        box(seal,.07,.06,1.15,0xffefb0,0,0,.67);
        const angle=X.target(r(),index)*Math.PI/2;ball(model,.18,0xffcc69,Math.sin(angle)*1.28,.17,Math.cos(angle)*1.28);
      }else if(type==='tide'||type==='steam'){part(seal,new T.TorusGeometry(.35,.07,4,10),d.color);box(seal,.7,.08,.1,d.color,0,0,0);}
      else if(type==='frost'){const bowl=part(seal,new T.SphereGeometry(.4,8,6,0,Math.PI*2,0,Math.PI/2),0x6f8c9d);bowl.rotation.z=Math.PI;part(seal,new T.ConeGeometry(.22,.65,6),0xffbf75,0,.3,0);}
      else part(seal,new T.OctahedronGeometry(.42),d.color);
      label(model,(d.nodeName||'封印')+' '+(index+1),2.2);
      const warning=ring(model,1,d.color);warning.name='boss-warning';
      if(['tide','pulse'].includes(type)){const water=part(model,new T.CylinderGeometry(1,1,.045,24),0x548da3,0,.045,0);water.name='boss-water';water.material.transparent=true;water.material.opacity=.32;water.material.depthWrite=false;}
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2,arm=new T.Group();arm.name='boss-arm';arm.userData.angle=angle;arm.position.set(Math.sin(angle)*1.35,0,Math.cos(angle)*1.35);
        if(type==='chase'||type==='stone'){box(arm,type==='chase'?1.1:.65,1.25,.28,d.color,0,.63,0);arm.rotation.y=angle;}
        else if(type==='mirror'){part(arm,new T.ConeGeometry(.23,1.25,6),0x6b9d71,0,.63,0);}
        else if(type==='steam'){part(arm,new T.CylinderGeometry(.13,.2,.55,6),0x88705e,0,.27,0);ball(arm,.25,0xd8ccbb,0,.75,0);ball(arm,.3,0xd8ccbb,0,1.05,0);}
        else if(type==='frost'){part(arm,new T.ConeGeometry(.24,1.35,5),0xcbeff1,0,.67,0);}
        else if(type==='gear'){const wheel=part(arm,new T.TorusGeometry(.45,.1,4,10),d.color,0,.48,0);box(arm,1,.1,.1,d.color,0,.48,0);wheel.name='gear-wheel';}
        else if(type==='tide'||type==='pulse'){box(arm,.7,.12,.25,0xaee8e6,0,.1,0);arm.rotation.y=angle;}
        else{const blade=box(arm,.15,1.4,.45,d.color,0,.7,0);blade.rotation.z=.35;}
        arm.scale.y=.08;model.add(arm);
      }
      return model;
    }
    const SITE_RESOLVED_NAMES={swordsman:'石門已撐起',mage:'符文已穩定',scout:'暗門已開啟',chef:'食材箱已處理',healer:'泉水已淨化',smith:'機關箱已修復',archer:'箭臺已校正',cleric:'小祠已淨化',robot:'動力閘已啟動'};
    function siteModel(job){const model=new T.Group(),c=P.PROFESSIONS[job].color,pending=new T.Group(),resolved=new T.Group();
      pending.name='site-unfinished';resolved.name='site-resolved';model.add(pending,resolved);
      if(['swordsman','scout'].includes(job)){
        for(const s of [-1,1])box(model,.25,1.55,.32,0x98a6aa,s*.55,.78,0);box(model,1.35,.23,.38,0xb6c0b8,0,1.55,0);
        box(pending,.85,1.1,.2,c,0,.65,0);
        if(job==='swordsman'){
          for(let i=0;i<3;i++){const rock=part(pending,new T.DodecahedronGeometry(.18,0),0x778787,(i-1)*.3,.12,.32);rock.scale.y=.65;}
          const raised=box(resolved,.85,.5,.2,c,0,1.28,0);raised.name='raised-stone-door';
          for(const s of [-1,1])box(resolved,.12,1.03,.15,0xba9b72,s*.41,.52,.22);
        }else{
          const hinge=new T.Group();hinge.name='opened-secret-door';hinge.position.set(-.43,0,0);hinge.rotation.y=-1.12;resolved.add(hinge);box(hinge,.85,1.1,.16,c,.425,.65,0);part(hinge,new T.TorusGeometry(.1,.025,4,10),0xe5c48a,.7,.72,.12);
          for(let i=0;i<2;i++)box(resolved,.58,.035,.24,0xc2c2a3,0,.035,.27+i*.32);
        }
      }else if(job==='mage'){
        part(model,new T.CylinderGeometry(.58,.7,.14,8),0x738091,0,.08,0);
        const loose=part(pending,new T.OctahedronGeometry(.44),0xc68b94,0,.87,0);loose.rotation.z=.52;const broken=part(pending,new T.TorusGeometry(.62,.055,4,12,Math.PI*1.45),0xc89ba9,0,.31,0);broken.rotation.set(Math.PI/2,.3,.3);
        const crystal=part(resolved,new T.OctahedronGeometry(.44),0x94e1d5,0,.87,0);crystal.name='anchored-rune';const halo=ring(resolved,.62,0x86d0c1);halo.position.y=.32;
        for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(resolved,.14,.18,.2,0xd6c494,Math.sin(a)*.58,.17,Math.cos(a)*.58);}
      }else if(job==='chef'){
        box(model,1,.13,.8,0x805e47,0,.1,0);for(const s of [-1,1]){box(model,.1,.48,.8,0x9a7658,s*.45,.34,0);box(model,.8,.48,.1,0x9a7658,0,.34,s*.35);}
        box(pending,.96,.1,.76,0xac8864,0,.64,0);for(let i=0;i<4;i++)part(pending,new T.ConeGeometry(.1,.28,5),0xdcc8a1,(i%2-.5)*.7,.83,(Math.floor(i/2)-.5)*.5);
        const lid=box(resolved,.96,.1,.76,0xac8864,0,.9,-.43);lid.rotation.x=-1.13;lid.name='opened-clean-crate';box(resolved,.68,.045,.55,0xbdb492,0,.19,0);
        for(const s of [-1,1])box(resolved,.13,.06,.22,0xdfc998,s*.28,.25,.18);
      }else if(job==='healer'){
        part(model,new T.CylinderGeometry(.7,.75,.3,12),0x829cac,0,.15,0);const rim=part(model,new T.TorusGeometry(.63,.075,4,12),0xadbdc1,0,.32,0);rim.rotation.x=Math.PI/2;
        const dirty=part(pending,new T.CylinderGeometry(.58,.58,.04,12),0x75734e,0,.32,0);dirty.name='polluted-water';for(let i=0;i<3;i++){const scum=ball(pending,.1,0x53644d,(i-1)*.25,.365,Math.sin(i*2)*.2);scum.scale.set(1.3,.3,1);}
        const water=part(resolved,new T.CylinderGeometry(.58,.58,.045,12),0x61c7d7,0,.325,0);water.name='clear-spring-water';water.material.emissive.setHex(0x173b43);water.material.emissiveIntensity=.18;
        for(const radius of [.24,.42]){const ripple=part(resolved,new T.TorusGeometry(radius,.013,3,16),0xc7f2ec,0,.355,0);ripple.rotation.x=Math.PI/2;}
      }else if(job==='archer'){
        box(model,.85,.12,.7,0x806448,0,.1,0);for(const s of [-1,1])box(model,.12,1.16,.15,0x9c7951,s*.44,.61,-.15);
        const sag=part(pending,new T.TorusGeometry(.45,.022,3,12,Math.PI),0xc7ad79,0,.9,-.15);sag.rotation.z=Math.PI;box(pending,.66,.045,.1,0x897046,0,.27,.15);
        const rope=box(resolved,.85,.04,.05,0xe6d5a2,0,1.16,-.15);rope.name='retensioned-arrow-line';
        for(const s of [-1,1]){const arrow=new T.Group();arrow.position.set(s*.2,.58,.12);arrow.rotation.z=s*.18;resolved.add(arrow);box(arrow,.027,.68,.027,0xd5b27c,0,0,0);part(arrow,new T.ConeGeometry(.07,.16,4),0xaacbb9,0,.42,0);}
        const marker=part(resolved,new T.ConeGeometry(.13,.22,4),0x97d4bb,0,.38,.34);marker.rotation.x=Math.PI/2;
      }else if(job==='cleric'){
        // A roadside shrine: stone step, two posts and a small roof. Dust and cobwebs clear into red posts and paper streamers.
        box(model,1.05,.14,.8,0x8c8f8a,0,.07,0);for(const s of [-1,1])box(model,.1,1.05,.1,0x7d6f6a,s*.36,.62,.1);box(model,1.2,.08,.62,0x5b5451,0,1.2,.05);box(model,1.0,.06,.5,0x6a615d,0,1.1,.05);
        const dust=box(pending,.62,.36,.34,0x8e8b84,0,.5,.1);dust.name='dusty-shrine';for(let i=0;i<3;i++){const web=box(pending,.3,.012,.012,0xd9d6cf,(i-1)*.3,.95-i*.08,.1);web.rotation.z=.3*(i-1);}
        const lit=box(resolved,.62,.36,.34,0xf2ede4,0,.5,.1);lit.name='purified-shrine';for(const s of [-1,1])box(resolved,.1,1.05,.1,0xc03d3d,s*.36,.62,.1);for(let i=0;i<4;i++){const shide=box(resolved,.06,.1,.01,0xfaf6ee,-.3+i*.2,.98,.33);shide.rotation.z=(i%2?-1:1)*.3;}
        const bell=part(resolved,new T.SphereGeometry(.07,8,6),0xd8b35a,0,.86,.36);bell.name='shrine-bell';
      }else if(job==='robot'){
        box(model,.95,.16,.75,0x637a7d,0,.08,0);box(model,.74,.68,.56,0x42575f,0,.48,0);for(const s of [-1,1])box(model,.12,.9,.16,0x8e9b9b,s*.4,.55,0);
        const dead=part(pending,new T.IcosahedronGeometry(.2,0),0x687673,0,.48,.3);dead.name='dormant-generator';box(pending,.43,.06,.06,0x9b7052,0,.77,.31);
        const core=part(resolved,new T.IcosahedronGeometry(.2,1),0x92e2c2,0,.48,.3);core.name='lit-power-gate';core.material.emissive.setHex(0x3f987f);core.material.emissiveIntensity=.5;
        for(const s of [-1,1])box(resolved,.055,.43,.035,0x8de6c8,s*.27,.48,.31);box(resolved,.57,.045,.035,0xc2e9d7,0,.77,.31);
      }else{
        box(model,1,.55,.65,0x72878c,0,.4,0);box(model,.78,.05,.45,0x3d5058,0,.69,0);
        const snapped=part(pending,new T.TorusGeometry(.24,.065,4,10,Math.PI*1.5),0xba916f,-.17,.79,0);snapped.rotation.set(Math.PI/2,.3,.4);const loose=box(pending,.48,.07,.12,0xd8b179,.18,.84,.08);loose.rotation.z=.48;
        for(const s of [-1,1]){const wheel=part(resolved,new T.TorusGeometry(.2,.06,4,10),0xc5b991,s*.22,.77,0);wheel.rotation.x=Math.PI/2;wheel.name='repaired-gear';for(let i=0;i<4;i++){const a=i*Math.PI/2;const tooth=box(resolved,.12,.07,.09,0xc5b991,s*.22+Math.sin(a)*.23,.77,Math.cos(a)*.23);tooth.rotation.y=a;}}
        box(resolved,.18,.18,.025,0x88c9a8,0,.46,.338);
      }
      label(pending,X.SITES[job].name,2);label(resolved,SITE_RESOLVED_NAMES[job],2);const marker=ring(model,.95,c);marker.material.transparent=true;
      model.userData.siteVisual={job,pending,resolved,marker,done:null};setSiteVisual(model,!!r().party.journey.site.done);return model;
    }
    function setSiteVisual(model,done){const view=model.userData.siteVisual;if(!view||view.done===done)return;
      view.done=done;view.pending.visible=!done;view.resolved.visible=done;view.marker.material.color.setHex(done?0x79bba0:P.PROFESSIONS[view.job].color);view.marker.material.opacity=done?.35:1;
    }
    function refreshSiteVisuals(){if(!live())return;const done=!!r().party.journey.site.done;for(const s of stations)if(s.kind==='site')setSiteVisual(s.model,done);}
    function reset(){heroes?.reset();actors=[];queue=[];queueClock=0;stations=[];near=null;offer=null;group=null;pulse=0;ailmentLeft=0;recordsOf=null;skillLeft=0;guardVoiceLeft=0;worldFloor=null;worldSeed=null;working=null;pendingForge=pendingDismantle=pendingRepair=pendingAffix=null;forgeService=undefined;forgePage='list';workHud();}
    function recruitAvailable(candidate){
      const party=r()?.party;
      return !!candidate&&!!party&&(candidate.returning||!party.joined.includes(candidate.id))&&!party.members.some(m=>m.id===candidate.id||m.profession===candidate.profession);
    }
    function removeStation(station){
      station.model.parent?.remove(station.model);ctx.dispose(station.model);
      stations=stations.filter(s=>s!==station);if(near===station)near=null;
      if(station.kind==='recruit'&&offer?.id===station.offer?.id)offer=null;
    }
    function pruneRecruits(){
      if(!live())return;
      // Scene-level invariant: a named traveller cannot be both a follower and
      // a waiting recruit, even if a stale rule module or scene produced it.
      for(const station of stations)if(station.kind==='recruit'&&!recruitAvailable(station.offer))removeStation(station);
    }
    function build(random,used){
      // Rebuilding this runtime must replace its old group, not abandon a still
      // visible copy. Do not remove merchants, explorers or other world objects.
      const stale=new Set(ctx.world()?.children.filter(o=>o.name==='tower-party-scene')||[]);if(group)stale.add(group);
      for(const old of stale)if(old.parent){old.parent.remove(old);ctx.dispose(old);}
      reset();worldFloor=r()?.floor;worldSeed=r()?.seed;if(!live())return;group=new T.Group();group.name='tower-party-scene';ctx.world().add(group);if(ctx.inDungeon()){syncActors();return;}
      const p=ctx.cell(0,0),camp={...p,kind:'camp',model:stationModel('camp')};camp.model.position.set(p.x,0,p.z);group.add(camp.model);stations.push(camp);
      // The recruit's cell stays reserved after they join, keeping later stations in place.
      offer=P.recruitOffer(r());const recruitPoint=offer?ctx.chooseCell(random,used):null;if(recruitAvailable(offer)){const p=recruitPoint,model=memberModel(offer.profession,offer.level,offer.id,offer.sex);if(modern())root.TowerHeroVisuals.dress(T,model,H.preview(r(),offer).equipment,ctx.dispose);model.position.set(p.x,0,p.z);label(model,P.person(offer.profession,offer.sex)+' · '+P.PROFESSIONS[offer.profession].name);group.add(model);stations.push({...p,kind:'recruit',offer,model});}
      if(r().party.boss)for(let index=0;index<r().party.boss.seals.length;index++){const p=ctx.chooseCell(random,used,4),model=stationModel('boss',index);model.position.set(p.x,0,p.z);group.add(model);stations.push({...p,kind:'boss',index,model,parts:bossParts(model)});}
      const site=X.siteOffer(r());if(site){let p=ctx.chooseCell(random,used);if(['swordsman','scout'].includes(site.job)&&ctx.passage)for(let i=0;i<8&&!ctx.passage(p,true);i++)p=ctx.chooseCell(random,used);const model=siteModel(site.job);model.position.set(p.x,0,p.z);group.add(model);const station={...p,kind:'site',offer:site,model};stations.push(station);if(r().party.journey.site.done&&['swordsman','scout'].includes(site.job))ctx.passage?.(station);}
      syncActors();refreshMonsters();
    }
    function companionSpawn(origin={x:ctx.G.px,z:ctx.G.pz},occupied=actors,slot=actors.length){
      // Use the same body clearance as walking, not the thinner interaction ray.
      // Entry cells border two outer walls: the previous 1.5 m offset put a
      // 0.28 m follower inside their collision boxes and stuck on the next step.
      for(const radius of [1.25,.95])for(let i=0;i<16;i++){
        const angle=slot*2.1+i*Math.PI/8+(ctx.player()?.rotation.y||0)+Math.PI,p={x:origin.x+Math.sin(angle)*radius,z:origin.z+Math.cos(angle)*radius};
        if(walkClear(origin,p)&&distance(p)>.85&&occupied.every(a=>Math.hypot(a.model.position.x-p.x,a.model.position.z-p.z)>=BODY_GAP))return p;
      }
      return origin;
    }
    // Re-place every follower beside the player after a teleport (rift return):
    // building the floor spawned them at the entrance, a whole maze away.
    function regroup(){if(!live())return;const placed=[];for(const a of actors){const p=companionSpawn({x:ctx.G.px,z:ctx.G.pz},placed,placed.length);a.model.position.set(p.x,0,p.z);a.path=[];a.pathLeft=0;placed.push(a);}queueClock=0;}
    function syncActors(){if(!live()||!group)return;pruneRecruits();recordsOf=null;const list=records(),known=new Set(list.map(m=>m.id));for(const a of actors)if(!known.has(a.id)){group.remove(a.model);ctx.dispose(a.model);}actors=actors.filter(a=>known.has(a.id));
      for(const m of list)if(!actors.some(a=>a.id===m.id)){const model=memberModel(m.profession,m.level,m.id,m.sex||P.sex(r(),m.id)),p=companionSpawn();model.position.set(p.x,0,p.z);model.userData.companionId=m.id;label(model,P.PROFESSIONS[m.profession].name+' · '+(m.id==='hero'?(r().name||'主角'):P.person(m.profession,m.sex)));healthBar(model,0x8cd2bd,2.35);group.add(model);actors.push({id:m.id,model,path:[],pathLeft:0});}
      if(modern())for(const a of actors)dressActor(a);
      queue=queue.filter(a=>actors.includes(a));for(const a of actors)if(!queue.includes(a))queue.push(a);queueClock=0;
    }
    function refreshMonsters(){const specs=P.monsterSpecs(r());for(const m of ctx.monsters()){if(!m.model.userData.partyHp)healthBar(m.model,0xef9e81,m.lord?2.75:2.15);m.partyMaxHp=specs.find(s=>s.id===m.id)?.maxHp||m.maxHp||1;}}
    const wingsOf=model=>{const data=model.userData;if(data.partyWings)return data.partyWings;const wings=(data.body?.children||[]).filter(x=>x.name==='party-wing');if(data.body)data.partyWings=wings;return wings;};
    // Visible monsters within `range` of a point, nearest first (each distance is measured once).
    function enemiesAround(at,range){const sight=root.MazeSight?.active(),found=[];for(const e of ctx.monsters()){if(!e.alive)continue;const p=e.model.position,gap=Math.hypot(p.x-at.x,p.z-at.z);if(gap<range&&ctx.clear(at.x,at.z,p.x,p.z)&&(!sight||root.MazeSight.visible(p.x,p.z)))found.push({e,gap});}return found.sort((x,y)=>x.gap-y.gap).map(v=>v.e);}
    const peaceful=()=>!ctx.monsters().some(m=>m.alive&&distance(m.model.position)<4&&clear(m.model.position));
    // A travelling chef cooks wherever it is quiet; everyone else still needs the camp fire.
    const canCook=()=>safeCamp()||(live()&&P.has(r(),'chef')&&peaceful()&&!ctx.G.shifting&&!r().expedition?.active);
    function safeCamp(){return live()&&stations.some(s=>s.kind==='camp'&&distance(s)<2.8&&clear(s))&&peaceful();}
    function workshopSafe(service=forgeService){
      if(!service||service.kind==='camp')return safeCamp()&&P.has(r(),'smith');
      return live()&&service.kind==='merchant'&&service.floor===r().floor&&service.seed===r().seed&&peaceful()&&ctx.traders().some(t=>t.id===service.merchantId&&distance(t)<2.8&&clear(t));
    }
    function gearWearer(gearId){
      if(modern()){const id=H.ids(r()).find(id=>Object.values(H.equipment(r(),id)).some(g=>g?.id===gearId));return id?P.PROFESSIONS[H.job(r(),id)].name+' · '+(id==='hero'?'主角':P.person(H.job(r(),id),H.sex(r(),id))):null;}
      return Object.values(r().equipment).some(g=>g?.id===gearId)?'主角':null;
    }
    function stockPanel(stock,labels,material=false){
      const held=Object.entries(labels).filter(([key])=>(stock?.[key]||0)>0),total=held.reduce((n,[key])=>n+stock[key],0);
      return '<details class="party-stock-panel"><summary>'+(material?'鍛造素材':'食材袋')+' · '+held.length+' 種／'+total+' 份<span>查看庫存</span></summary><div class="party-stocks">'+(held.length?held.map(([key,name])=>'<span title="'+esc((root.TowerMaterials?.[material?'MATERIAL_META':'INGREDIENT_META']?.[key]?.sources||[]).join('；'))+'">'+(material?root.TowerResourceIcons?.svg(key)||'':foodArt(key))+'<span>'+esc(name)+' <b>'+stock[key]+'</b></span></span>').join(''):'<p>還沒有收集到'+(material?'鍛造素材':'食材')+'。</p>')+'</div>'+(ctx.help?.('素材保留規則','<p>已收集的材料會留在袋中；換環境後，新的怪物會提供不同素材。</p>')||'<small>已收集的材料會留在袋中；換環境後，新的怪物會提供不同素材。</small>')+'</details>';
    }
    function costLine(cost,material=false){
      const stock=material?r().party.journey.materials:r().party.ingredients,labels=material?root.TowerMaterials?.MATERIALS||{}:P.INGREDIENTS;
      return '<div class="party-costs" aria-label="'+(material?'鍛造素材需求':'食譜材料')+'">'+Object.entries(cost||{}).map(([key,need])=>{const have=stock?.[key]||0;return '<span class="party-cost'+(have<need?' missing':'')+'">'+(material?root.TowerResourceIcons?.svg(key)||'':foodArt(key))+'<span>'+esc(labels[key]||key)+' <b>'+have+'/'+need+'</b>'+(have<need?'<small>缺 '+(need-have)+'</small>':'')+'</span></span>';}).join('')+'</div>';
    }
    function forgePanel(quiet=false){if(!enabled())return;pendingForge=pendingDismantle=pendingRepair=pendingAffix=null;const run=r(),safe=workshopSafe(),merchant=forgeService?.kind==='merchant',vendor=merchant?root.TowerEncounters.MERCHANTS[forgeService.merchantId]:null,gear=X.allGear(run).filter(g=>!H?.ROBOT?.isCore(g)&&(!merchant||root.TowerEncounters.serviceAvailable(run,forgeService,g)));
      if(!gear.some(g=>g.id===forgeSelected))forgeSelected=gear[0]?.id;
      const g=gear.find(g=>g.id===forgeSelected),draw=kind=>root.TowerHeroIcons?.svg(kind)||'',help=(title,html)=>ctx.help?.(title,html)||html;
      const list='<nav class="forge-picker" aria-label="選擇要處理的裝備">'+gear.map(item=>'<button class="tower-btn forge-pick" data-tower="party-forge-select" data-item="'+esc(item.id)+'" aria-pressed="'+(item.id===forgeSelected)+'">'+draw(item.kind)+'<span><b>'+esc(item.name)+'</b><small>'+esc(gearWearer(item.id)||'背包備用')+' · '+ (item.durability===0?'已損壞':item.durability+'/'+item.maxDurability)+'</small></span><span class="forge-pick-arrow" aria-hidden="true">›</span></button>').join('')+(gear.length?'':'<p class="tower-copy">目前沒有這位商人能處理的裝備。</p>')+'</nav>';
      let detail='<p>尚無可處理的裝備。</p>';
      if(g){const quote=X.repairQuote(run,g.id,forgeService),choices=X.forgeOptions(run,g,forgeService);
        detail='<section class="forge-detail" aria-label="選中裝備的作業"><div class="forge-detail-nav">'+act('‹ 裝備清單','party-forge-list')+'</div><header class="forge-piece">'+draw(g.kind)+'<div><h3>'+esc(g.name)+'</h3><p>耐久 '+g.durability+'/'+g.maxDurability+' · '+(g.forge?X.TRAITS[g.forge.trait].name+' '+g.forge.level+'/2':'尚未鍛造')+'</p></div></header><section class="forge-repair"><div><h3>'+(g.durability===0?'重建破損裝備':'完整修理')+'</h3><p>'+(quote?!quote.allowed?esc(quote.reason):quote.broken?'含破損重建費':'補滿耐久':'耐久完整，無需修理。')+'</p></div>'+ (quote?act('修復 · '+quote.parts+' 零件／'+quote.coins+' 幣','party-mend-ask',g.id,!safe||!quote.allowed||run.coins<quote.coins||run.party.journey.scrap<quote.parts):'')+'</section><h3 class="forge-traits-title">鍛造特性 <small>選一種 · 最多二級</small></h3><div class="party-forge-traits">'+choices.map(q=>'<section><div class="forge-trait-heading">'+(root.TowerForgeIcons?.svg(X.TRAITS[q.trait].icon)||'')+'<b>'+esc(q.name)+(q.underground?' <small>地下</small>':'')+'</b></div>'+costLine(q.materialCost,true)+help(q.name+'效果說明','<p>'+esc(X.TRAITS[q.trait].description)+'</p>')+(!q.allowed?'<small class="forge-trait-warning">'+esc(q.reason)+'</small>':'')+act(q.level>2?'已達上限':(g.forge?'升級':'選擇')+' · '+q.parts+' 零件／'+q.coins+' 幣','party-forge-ask',q.trait+'|'+g.id,!safe||!q.allowed||!q.affordable)+'</section>').join('')+'</div><div class="forge-salvage">'+act('拆解 · 回收 '+X.salvageValue(g)+' 零件','party-dismantle-ask',g.id,!safe)+'</div></section>';
      }
      if(g&&H?.ROBOT?.isPart(g.kind)){
        const quote=X.repairQuote(run,g.id,forgeService),owner=H.ids(run).find(id=>H.equipment(run,id)[g.slot]?.id===g.id);
        detail='<section class="forge-detail" aria-label="固定機件作業"><div class="forge-detail-nav">'+act('‹ 裝備清單','party-forge-list')+'</div><header class="forge-piece">'+draw(g.kind)+'<div><h3>'+esc(g.name)+'</h3><p>耐久 '+g.durability+'/'+g.maxDurability+' · 第'+H.GEAR[g.kind].tier+'階固定機件</p></div></header><section class="forge-repair"><div><h3>'+(g.durability===0?'重建破損機件':'完整修理')+'</h3><p>'+(quote?quote.allowed?'補滿機件耐久':esc(quote.reason):'耐久完整，無需修理。')+'</p></div>'+(quote?act('修復 · '+quote.parts+' 零件／'+quote.coins+' 幣','party-mend-ask',g.id,!safe||!quote.allowed||run.coins<quote.coins||run.party.journey.scrap<quote.parts):'')+'</section>'+help('固定機件規則','<p>機殼與雙拳使用獨立進階系統，不套用一般裝備特性，也不能拆解、出售或移交。</p>')+act('機體進階','hero-robot-workshop',owner,!safe||!owner)+'</section>';
      }
      if(g&&modern()&&!H.ROBOT.isPart(g)&&root.TowerAffixes){
        const F=root.TowerAffixes,choices=Object.keys(F.EFFECTS).map(key=>F.quote(run,g.id,key,forgeService)).filter(q=>q&&(!F.EFFECTS[q.key].underground||run.floor<0));
        detail=detail.replace('<div class="forge-salvage">','<section class="forge-affixes"><h3>材料附魔 <small>獨立於鍛造特性 · 一件一種</small></h3><p>目前：'+(g.affix?esc(F.EFFECTS[g.affix.id].name):'無附魔')+'</p><div class="party-forge-traits">'+choices.map(q=>'<section><div class="forge-trait-heading"><span class="affix-icon" style="color:'+F.EFFECTS[q.key].color+'">'+F.svg(q.key)+'</span><b>'+esc(q.name)+'</b></div>'+costLine({[q.material]:q.count},true)+help(q.name+'附魔說明','<p>'+esc(q.description)+' '+esc(F.EFFECTS[q.key].description)+'</p><p>成功率 '+q.chance+'%；失敗消耗材料與費用，但保留原附魔。</p>')+act('附魔 '+q.chance+'% · '+q.coins+' 幣','party-affix-ask',g.id+'|'+q.key,!safe||!q.allowed||!q.affordable)+'</section>').join('')+'</div></section><div class="forge-salvage">');
      }
      const all=X.repairAllQuote(run,forgeService),priority=X.repairAllQuote(run,forgeService,{below:.7}),maintenance=X.maintenanceAllQuote(run,forgeService);
      const rules=merchant?'只承作這位商人專賣的防具與武器；修復及強化的銅幣費用加 20%，材料不加價。破損重建另按正常修理費 1.5 倍計算。耐用特性持續節省10%／20%損耗，修理不重置累積進度。':!P.has(run,'smith')?'隊伍沒有能行動的鍛匠。營地可做一次基本保養；完整修復與強化請找專門商人。':'鍛匠可完整修復或重建破損裝備；每件選一種特性，最多二級。耐用特性持續節省10%／20%損耗，修理不重置累積進度。';
      const overview=merchant?[['全部修理',all,'party-mend-all-ask'],['優先修理 · 低於70%',priority,'party-mend-priority-ask'],['小耗損合批保養',maintenance,'party-mend-maintenance-ask']].map(([title,q,key])=>'<section class="camp-service-strip"><div><b>'+title+'</b><small>'+q.entries.length+' 件'+(key==='party-mend-maintenance-ask'?' · 耐久70%以上':'')+'</small></div>'+act(q.allowed?q.coins+' 幣／'+q.parts+' 零件':'無可處理裝備',key,null,!safe||!q.allowed||!q.affordable)+'</section>').join(''):'';
      const support='<div class="forge-overview forge-overview-notes" data-forge-page="'+forgePage+'">'+stockPanel(run.party.journey.materials,root.TowerMaterials?.MATERIALS||{},true)+'</div>';
      const body=help('維護與強化規則','<p>'+esc(rules)+'</p>')+'<p class="tower-resource-line forge-resources">'+(root.TowerResourceIcons?.svg('scrap')||'')+'零件 '+run.party.journey.scrap+'／99 '+(root.TowerResourceIcons?.svg('coin')||'')+'銅幣 '+run.coins+'</p><div class="forge-overview" data-forge-page="'+forgePage+'">'+overview+'</div><div class="forge-workspace" data-forge-page="'+forgePage+'">'+list+detail+'</div>'+support;
      ctx.dialog((vendor?vendor.name+' · 專門維護':'營地工坊')+' · 暫停中',vendor?'商人維護與強化':'鍛匠工坊',!safe?merchant?'請先靠近這位商人，確認附近安全。':!P.has(run,'smith')?'隊伍沒有能行動的鍛匠。':'請先回到安全營地。':'',body,(merchant?(ctx.returnAction?.()||''):act('營地料理','party-kitchen'))+act('裝備背包','bag')+act('回到迷宮','close'),{silent:quiet,workshop:true,commerce:'workshop',summary:(vendor?vendor.name+'的專門維護。':'鍛匠工坊。')+'先選裝備，再選修理、鍛造或拆解。'});
    }
    function workMarkup(label,progress,state){return '<div class="tower-work-heading"><span data-work-name>'+esc(label)+'</span><small data-work-state>'+esc(state)+'</small></div><progress class="tower-work-track" max="100" value="'+Math.max(0,Math.min(100,progress/12*100))+'" aria-label="'+esc(label)+'進度"></progress>';}
    function workHud(){
      const box=document.getElementById('towerWorkProgress');if(!box)return;
      const task=heroes?.workProgress?.(),site=r()?.party?.journey?.site,station=working||(near?.kind==='site'&&site?.progress>0?near:null);
      const show=live()&&ctx.G.running&&r().status==='playing'&&!document.hidden&&!ctx.paused()&&!ctx.G.shifting&&(task||!ctx.inDungeon()&&station&&!site.done&&distance(station)<=2.6&&clear(station));
      const left=document.getElementById('towerLeftHud'),layout=show?'true':'false';if(left&&left.getAttribute('data-working')!==layout)left.setAttribute('data-working',layout);
      box.hidden=!show;if(!show)return;
      const label=task?task.label:station.offer.verb;
      box.querySelector('[data-work-name]').textContent=label;
      box.querySelector('[data-work-state]').textContent=task||working?'處理中':'已暫停 · 對話繼續';
      const bar=box.querySelector('progress');bar.value=Math.max(0,Math.min(100,(task?task.ratio:site.progress/12)*100));bar.setAttribute('aria-label',label+'進度');
    }
    function sitePanel(s){const done=r().party.journey.site.done,progress=r().party.journey.site.progress,has=P.has(r(),s.offer.job);ctx.dialog('職業探索 · 暫停中',s.offer.name,s.offer.description,
      '<p class="tower-copy">'+esc(s.offer.reward)+' 另獲得八枚銅幣。這是可跳過的探索，不影響主線通關。</p><p class="tower-copy">'+(done?'此處已完成，不會再次給予獎勵。':'留在現場慢慢處理，進度條填滿即可完成。途中仍有怪物與陷阱；離開、受傷或變形會中斷，已累積的進度保留，可稍後接續。')+'</p><section class="tower-site-progress">'+workMarkup(s.offer.verb,done?12:progress,done?'已完成':progress>0?'可接續處理':'尚未開始')+'</section>',
      (done?'':act('請'+P.PROFESSIONS[s.offer.job].name+s.offer.verb,'party-explore-job',s.offer.id,!has)+act(progress>0?'繼續處理':'慢慢處理','party-explore-work',s.offer.id))+act('返回迷宮','close'),{summary:done?'這處探索已經完成。':s.offer.description+' 沒有對應職業也可以慢慢處理。留在現場，進度條填滿就完成；中斷後可以接續。'});}
    function finishSite(s,method){const result=X.explore(r(),s.offer.id,method,r().revision);working=null;const ok=commit(result);refreshSiteVisuals();workHud();if(!ok)return false;if(result.effect.passage)ctx.passage?.(s);ctx.audio.sfxAction?.('device');ctx.close?.();return true;}
    function bossHelp(){if(!r()?.party?.boss)return;const d=X.BOSSES[r().floor];ctx.dialog('章末機關 · 暫停中',d.name,d.description,'<p class="tower-copy">'+esc(X.hint(r()))+'</p><p class="tower-copy">地面警戒圈標示危險範圍；黃光時退開，紅光時不可接近。操作只需靠近並按對話鈕。所有職業都能完成。整座迷宮的變形倒數維持原規則。</p>',act('回到迷宮','close'),{summary:d.description+' '+X.hint(r())});}
    function mealCard(id,recipe,cookable){const p=r().party;
      const explanation=(!cookable?'<p>已做好的料理，沒有廚師也能享用。</p>':'')+(recipe.description?'<p>'+esc(recipe.description)+'</p>':'');
      return '<article class="tower-item '+(cookable?'party-recipe':'party-prepared-meal')+'"><div class="grocery-heading">'+dishArt(id)+'<div><h3>'+esc(recipe.name)+(recipe.hidden?' ★':'')+'</h3><small>備好 '+p.meals[id]+' 份'+((p.specials?.[id]||0)>0?'（特製 '+p.specials[id]+'）':'')+(cookable&&recipe.requiredDepth?' · 地下 B'+recipe.requiredDepth+' 起':'')+'</small></div></div><p class="trade-item-stat">生命 +'+recipe.hp+' · 飽食 +'+recipe.hunger+(recipe.team?' · 全隊 +'+recipe.team:'')+(recipe.buff?' · '+esc(P.BUFFS[recipe.buff])+'（三層）':'')+(recipe.ward?' · 抵擋一次'+esc(root.TowerRecipeLab?.WARDS?.[recipe.ward]||recipe.ward)+'（五分鐘）':'')+'</p>'+(cookable?costLine(recipe.cost):'')+(explanation?(ctx.help?.(recipe.name+'料理說明',explanation)||explanation):'')+'<div class="trade-card-actions">'+(cookable?act('烹飪','party-cook',id,!canCook()||Object.entries(recipe.cost).some(([k,v])=>p.ingredients[k]<v)):'')+act('享用','party-eat',id,!p.meals[id])+'</div></article>';
    }
    let labPick={};
    function panel(kind='team',quiet=false){if(!enabled())return;if(kind==='team'&&modern()){heroes.panel(undefined,quiet);return;}
      const run=r(),p=run.party;let body='',copy=(run.floor<0?'地下五人小隊：主角加四名旅人。':'地上四人小隊：主角加三名旅人。')+'劍士就是護衛，占用一個隊友名額。';
      if(kind==='cook'){
        copy=(safeCamp()?'營地安全 · ':canCook()?'廚師現煮 · 周圍安全 · ':'需回到安全營地，或由廚師在安全處現煮 · ')+(P.has(run,'chef')?'廚師已開放高階菜譜與特製料理（+'+P.specialBonus(run)+'%）':'基本菜譜；廚師同行可開放高階料理與特製加成');
        const recipes=P.availableRecipes(run),prepared=Object.keys(p.meals).filter(id=>p.meals[id]>0&&!recipes[id]&&P.recipeUnlocked(run,id)),maintenance=P.campMaintenanceQuote(run),maintenancePercent=Math.round(maintenance.ratio*100),robot=modern()?H.ids(run).find(id=>H.job(run,id)==='robot'&&H.hp(run,id)>0):null;
        const notes='<p>不同環境與怪物提供不同食材，庫存會保留；料理隨時可吃。有一料雙份被動，才可能多做一份。商人身旁不能烹飪。</p><p>廚師同行時可在周圍安靜處現煮，不必回營地；廚師做的料理標為「特製」，享用時生命與飽食多 '+P.specialBonus(run)+'%（依廚師等級每級 10%，至少 10%、最多 50%）。蘇禾代煮的料理沒有特製加成。</p><p>保養恢復全隊穿戴中、未損壞裝備最大耐久的'+maintenancePercent+'%；每層一次，變形與讀檔不重置。鍛匠同行時可在安靜處以 '+P.FIELD_REPAIR_PARTS+' 份金屬零件就地修補穿戴裝備 '+Math.round(P.FIELD_REPAIR_RATIO*100)+'%，不限次數；第二級工藝與匠印只有鍛匠能做，營地附魔成功率也比商人高 '+(root.TowerAffixes?.SMITH_AFFIX_BONUS??15)+' 點。完整修復、破損重建與強化：需鍛匠同行或找對應專門商人。</p>';
        body=stockPanel(p.ingredients,P.INGREDIENTS)+'<section class="camp-service-strip"><div><b>營地保養</b><small>每層一次 · 耐久 +'+maintenancePercent+'%</small>'+(!maintenance.allowed&&!maintenance.used?'<small class="forge-trait-warning">'+esc(maintenance.reason)+'</small>':'')+'</div>'+act(maintenance.used?'本層已保養':'保養 · '+maintenance.cost+' 幣','party-repair',null,!safeCamp()||!maintenance.allowed||!maintenance.affordable)+(P.has(run,'smith')?(()=>{const fq=P.fieldRepairQuote(run);return act('野外修補 · '+fq.parts+' 零件','party-field-repair',null,!(live()&&peaceful())||!fq.allowed||!fq.affordable);})():'')+(P.has(run,'smith')?act('鍛匠工坊','party-forge'):'')+(root.TowerAlchemy?.makers(run).length?act('藥水製作','party-alchemy'):'')+(P.has(run,'chef')?act('食譜研發','party-lab'):'')+(robot?act('製作核心','hero-core-craft',robot,!safeCamp()):'')+'</section>'+(ctx.help?.('料理與保養規則',notes)||notes)+(()=>{
          // Dishes the party can cook right now come first; the rest stay one tap away.
          const entries=Object.entries(recipes),ready=([,recipe])=>Object.entries(recipe.cost).every(([k,v])=>p.ingredients[k]>=v),now=entries.filter(ready),later=entries.filter(entry=>!ready(entry));
          return '<h3 class="camp-section-title">'+(canCook()?'現在可以做':'材料已齊')+' · '+now.length+' 道</h3><div class="tower-grid">'+(now.map(([id,recipe])=>mealCard(id,recipe,true)).join('')||'<p class="bag-empty">食材還不夠任何一道料理；展開下方查看缺少的材料。</p>')+'</div>'+(later.length?'<details class="camp-more-recipes"><summary>材料不足的料理 · '+later.length+' 道</summary><div class="tower-grid">'+later.map(([id,recipe])=>mealCard(id,recipe,true)).join('')+'</div></details>':'');
        })()+(prepared.length?'<h3>已做好的料理</h3><div class="tower-grid">'+prepared.map(id=>mealCard(id,P.RECIPES[id],false)).join('')+'</div>':'');
      }else if(kind==='brew'){
        const A=root.TowerAlchemy,makers=A?A.makers(run):[];
        copy=(safeCamp()?'營地安全 · ':'需回到安全營地 · ')+(makers.length?makers.map(job=>A.MAKERS[job].name+'可'+A.MAKERS[job].verb+A.MAKERS[job].kind+'藥水').join('、'):'需要療癒師或神職同行才能製作藥水');
        const notes='<p>藥水以藥草為基底，加上清露與各地食材在營地調製；做出來的藥水與商店販售的完全相同，放入背包後可手動或自動使用。療癒師負責恢復型，神職負責強化型；中級療癒藥第 60 層起，高級療癒藥、勇氣與魔力藥水要到地下才調得出來。清露可向雜貨商購買，也會從庭園、晶窟、霧河、霜原的生物取得。</p>';
        const card=id=>{const q=A.quote(run,id);return '<article class="tower-item party-recipe"><div class="grocery-heading">'+(root.TowerHeroIcons?.svg('item_'+id)||'')+'<div><h3>'+esc(q.name)+'</h3><small>'+esc(q.makerName)+' · '+esc(q.kind)+' · 持有 '+q.have+'</small></div></div><p class="trade-item-stat">'+esc(q.description)+'</p>'+costLine(q.cost)+(q.reason?'<small class="forge-trait-warning">'+esc(q.reason)+'</small>':'')+'<div class="trade-card-actions">'+act(q.verb,'party-brew',id,!safeCamp()||!q.allowed||!q.affordable)+'</div></article>';};
        body=stockPanel(p.ingredients,P.INGREDIENTS)+(ctx.help?.('藥水製作規則',notes)||notes)+(A?Object.keys(A.MAKERS).map(job=>'<h3 class="camp-section-title">'+esc(A.MAKERS[job].name+' · '+A.MAKERS[job].kind+'藥水')+'</h3><div class="tower-grid">'+Object.keys(A.RECIPES).filter(id=>A.RECIPES[id].maker===job).map(card).join('')+'</div>').join(''):'');
      }else if(kind==='lab'){
        const Lab=root.TowerRecipeLab,chef=P.has(run,'chef'),found=(p.discoveries||[]).length,total=Lab?.COUNT||0;
        copy=(chef?(canCook()?'廚師就緒 · 周圍安全':'需回到安全營地，或由廚師在安靜處研發'):'需要隊伍中仍能行動的廚師')+' · 已發現隱藏食譜 '+found+'/'+total;
        const types=Object.keys(labPick).filter(k=>labPick[k]>0),count=types.reduce((s,k)=>s+labPick[k],0);
        const notes='<p>從食材袋挑 2～4 種食材（總量最多 8 份）按「試做」。配方完全命中隱藏食譜就會永久記入菜譜並做出料理；沒命中會用掉食材，一半機率留下一份實驗雜燴，並提示有幾種食材方向正確。隱藏食譜大多比現有料理更強，常帶有猛力、堅守、飄步等三層增益；不同配方也可能做出相同效果。魔物獵人與怪物會帶來各層稀罕食材。</p>';
        const chips=Object.entries(P.INGREDIENTS).filter(([k])=>(p.ingredients[k]||0)>0).map(([k,name])=>{const n=labPick[k]||0;return '<article class="tower-item party-recipe lab-ingredient'+(n?' is-picked':'')+'"><div class="grocery-heading">'+foodArt(k)+'<div><h3>'+esc(name)+'</h3><small>袋中 '+p.ingredients[k]+(n?' · 已選 '+n:'')+'</small></div></div><div class="trade-card-actions">'+act('－','party-lab-sub',k,!n)+act('＋','party-lab-add',k,n>=p.ingredients[k]||count>=8||(!n&&types.length>=4))+'</div></article>';}).join('');
        const picked=types.length?types.map(k=>esc(P.INGREDIENTS[k])+' ×'+labPick[k]).join('、'):'還沒選食材';
        const discovered=(p.discoveries||[]).map(id=>'<li>'+esc(P.RECIPES[id].name)+'<small> · '+esc(P.RECIPES[id].buff?P.BUFFS[P.RECIPES[id].buff]:P.RECIPES[id].ward?'抵擋一次'+(Lab?.WARDS?.[P.RECIPES[id].ward]||''):'')+'</small></li>').join('');
        body=(ctx.help?.('食譜研發規則',notes)||notes)+'<section class="camp-service-strip"><div><b>這次試做</b><small>'+picked+'</small></div>'+act('試做','party-lab-try',null,!chef||!canCook()||types.length<2)+act('清除','party-lab-clear',null,!types.length)+'</section><div class="tower-grid">'+(chips||'<p class="bag-empty">食材袋是空的，先去採集或向商人購買。</p>')+'</div>'+(found?'<details class="camp-more-recipes"><summary>已發現的隱藏食譜 · '+found+' 道</summary><ul class="lab-found">'+discovered+'</ul></details>':'');
      }else if(kind==='bestiary'){
        copy='點開怪物，查看前兆、應對與可能掉落。';
        const dropNotes='<p>被選為討伐候選後，普通20%（五種常用食材'+(root.TowerLoot?.chance({type:'ingredient',key:'herb',rarity:'common'})??25)+'%）、少見12%、稀有6%、珍稀3%，不是每次都會掉落；落地需靠近拾取。</p>';
        const definitions=P.defs(),rows=root.TowerStoryInsights?.bestiary(run,definitions)||Object.entries(definitions).map(([id,m])=>({id,local:false,known:true,name:m.name,lore:root.TowerFieldGuide?.monster(m)?.lore||''}));
        const card=row=>{const id=row.id,m=definitions[id];
          const guide=root.TowerFieldGuide?.monster(m),sense=root.TowerMonsterSense?.profile(m),lord=id.startsWith('lord-'),unreadLord=lord&&row.storyKnown===false;
          const tactics=guide?'<p><b>前兆</b> '+esc(guide.tell)+'</p><p><b>應對</b> '+esc(guide.counter)+'</p>':'<p>'+esc(unreadLord?'留意守門者的蓄力與攻擊前兆。':m.description)+'</p>';
          const sensing=guide?'<p class="tower-bestiary-sense">察敵 '+esc(guide.range)+' 公尺 · '+esc(unreadLord?'章末守門者':guide.personality)+'<br>'+esc(guide.sensing)+'</p>':sense?'<p>察敵 '+esc(sense.range)+' 公尺 · '+esc(unreadLord?'章末守門者':sense.personality)+'</p>':'';
          const materials=root.TowerMaterials,variant=materials?.ecology(run).variants[id];
          const drops=materials?lord?'補給物資':variant?materials.dropPool(run,{kind:id}).map(d=>esc((d.type==='material'?materials.MATERIALS:P.INGREDIENTS)[d.key])).join('、')||'補給物資':'本環境不出現此種怪物；換環境會有不同的食材與素材。':Object.keys(P.MONSTERS[id]?.drop||{shell:1}).map(k=>esc(P.INGREDIENTS[k]||k)).join('、');
          return '<details class="tower-item tower-bestiary-card" data-monster="'+esc(id)+'"><summary><strong>'+esc(row.name||variant?.name||m.name)+'</strong>'+(guide?'<span> · '+esc(guide.role)+'</span>':'')+'</summary><div class="tower-bestiary-notes">'+(row.lore?'<p class="bestiary-region">'+esc(row.lore)+'</p>':'')+tactics+sensing+'<p>可能掉落：'+drops+(lord?'；另有50%機率掉裝備':'')+'</p>'+(variant?'<p>素材來自 '+esc(materials.ecology(run).name)+'，不是所有怪物都掉相同食材。</p>':'')+(guide?.gate?'<p>'+esc(guide.gate)+'</p>':'')+'</div></details>';
        };
        const local=rows.filter(row=>row.local),known=rows.filter(row=>row.known&&!row.local),unseen=rows.filter(row=>!row.known).length;
        body=(ctx.help?.('討伐掉落規則',dropNotes)||dropNotes)+'<h3>本環境可遇見</h3><p class="bestiary-region">'+esc(root.TowerMaterials?.ecology(run)?.name||'目前迷宮')+' · 生態名、可掉食材與戰術一起查看；實際出現仍由本層生成決定。</p><div class="tower-grid tower-bestiary">'+local.map(card).join('')+'</div><details class="tower-bestiary-archive"><summary>其他已知生物 · '+known.length+' 種</summary><div class="tower-grid tower-bestiary">'+known.map(card).join('')+'</div></details>'+(unseen?'<p class="bestiary-region">還有 '+unseen+' 位尚未遇見的樓層主，抵達對應章末後再留下紀錄。</p>':'');
      }else{
        body='<div class="tower-grid"><article class="tower-item">'+portrait(p.profession)+'<h3>'+esc(P.PROFESSIONS[p.profession].name)+' · 你</h3><p>'+esc(P.PROFESSIONS[p.profession].description)+'</p></article>'+p.members.map(m=>'<article class="tower-item">'+portrait(m.profession)+'<h3>'+esc(P.person(m.profession,P.sex(r(),m.id)))+' · '+esc(P.PROFESSIONS[m.profession].name)+'</h3><p>強度 '+m.level+'/5 · 生命 '+Math.ceil(m.hp)+'/'+P.memberMax(m)+(m.hp<=0?' · 需要料理或營地休息':'')+'</p>'+act('與他道別','party-dismiss-ask',m.id)+'</article>').join('')+'</div><p class="tower-copy">'+(p.buffs.length?p.buffs.map(b=>P.BUFFS[b.id]+'（'+b.floors+' 層）').join(' · '):'烹飪料理可獲得增益；最多同時保留兩種。')+'</p>';
      }
      const footer=kind==='cook'||kind==='brew'||kind==='lab'?act('背包','bag')+(modern()?act('隊伍裝備','hero-panel',H.state(run).active):'')+(ctx.returnAction?.()||'')+act('回到迷宮','close'):act('隊伍','party-team')+act('料理','party-kitchen')+(P.has(run,'smith')?act('鍛匠工坊','party-forge'):'')+(root.TowerAlchemy?.makers(run).length?act('藥水','party-alchemy'):'')+(P.has(run,'chef')?act('研發','party-lab'):'')+act('生物誌','party-bestiary')+(run.party.boss?act('本層機關說明','party-boss-help'):'')+act('裝備與道具','bag')+act('回到迷宮','close');
      ctx.dialog('高塔遠征 · 暫停中',{team:'冒險隊伍',cook:'旅人廚房',brew:'旅人藥坊',lab:'食譜研發',bestiary:'迷宮生物誌'}[kind],copy,body,footer,{silent:quiet,commerce:kind==='cook'||kind==='brew'||kind==='lab'?'camp':'',summary:{team:run.floor<0?'冒險隊伍。主角加四名同伴。':'冒險隊伍。主角加三名同伴。',cook:'旅人廚房。選擇烹飪，或享用料理。',brew:'旅人藥坊。療癒師調製恢復藥水，神職祈願強化藥水。',lab:'食譜研發。廚師挑食材試做，命中就記入隱藏食譜。',bestiary:'迷宮生物誌。了解怪物，收集材料。'}[kind]});
    }
    function commit(result,speak=true){if(!ctx.transact(result))return false;if(speak&&result.message)ctx.toast(result.message,2300,result.message);return true;}
    function interact(){pruneRecruits();if(!live()||!near||ctx.G.shifting||distance(near)>2.6||!clear(near))return false;const n=near;if(n.kind==='camp'){panel('cook');return true;}
      if(n.kind==='site'){sitePanel(n);return true;}
      if(n.kind==='recruit'){
        const quote=P.recruitQuote(r(),n.offer.id);if(!quote?.offer){ctx.toast('這位旅人已繼續前進。');return true;}offer=quote.offer;
        const maxLevel=modern()?H.maxLevel(r(),offer.id):5,job=P.PROFESSIONS[offer.profession],traveller=P.person(offer.profession,offer.sex),draw=modern()?H.preview(r(),offer):null;
        const needs=quote.list.map(item=>'<li class="'+(item.missing?'recruit-cost-missing':'')+'"><span>'+esc(item.label)+'</span><b>'+item.count+'</b><small>持有 '+item.have+(item.missing?' · 尚缺 '+item.missing:'')+'</small></li>').join('');
        const summary=job.name+'，'+traveller+'。'+(quote.returning?'老朋友，再一起走一段吧。':'')+'加入需要'+quote.list.map(item=>item.label+item.count+'份').join('、')+'。';
        ctx.dialog(job.name+' · '+traveller,quote.returning?'老朋友，再次同行':'一起尋找回家的路',esc(quote.story||job.description),'<div class="party-invite">'+(modern()?root.TowerHeroVisuals.portrait(offer.profession,offer.sex):portrait(offer.profession))+'<p>等級 '+offer.level+'/'+maxLevel+' · 同伴 '+r().party.members.length+'/'+P.recruitLimit(r())+'</p>'+(quote.returning?'<p>保留離隊時的等級、經驗與技能；原裝備已退回背包，加入後請重新分配。不重複贈送裝備或箭矢。</p>':modern()&&r().floor<0?'<p>地下新同伴從 5 級起步，加入時隨機獲得四級追加技能，最高可升至 10 級。</p>':'')+'<h3>同行約定</h3><ul class="recruit-costs">'+needs+'</ul>'+(!quote.affordable?'<p class="recruit-cost-missing">'+esc(quote.reason||'所需物資不足。')+'</p>':'')+(draw?'<details><summary>查看持有技能</summary><p>主動：'+draw.skills.map(k=>H.SKILLS[k].name).join('、')+'</p><p>被動：'+draw.passives.map(k=>H.PASSIVES[k].name).join('、')+'</p></details>':'')+'</div>',act(quote.returning?'再次邀請':'邀請加入','party-recruit',offer.id,!quote.affordable||r().party.members.length>=P.recruitLimit(r()))+act('查看隊伍','party-team')+act('下次再聊','close'),{speaker:{gender:offer.sex,age:'adult'},summary});return true;
      }
      if(n.kind==='boss'){if(commit(P.bossAction(r(),n.index,r().revision))){ctx.audio.sfxAction?.('device');ctx.save();}return true;}return false;
    }
    function handle(key,id){if(heroes?.handle(key,id))return true;if(!key.startsWith('party-'))return false;if(!enabled())return true;
      if(key==='party-team'){panel();return true;}if(key==='party-kitchen'){panel('cook');return true;}if(key==='party-alchemy'){panel('brew');return true;}if(key==='party-lab'){panel('lab');return true;}
      if(key==='party-lab-add'){labPick[id]=(labPick[id]||0)+1;panel('lab',true);return true;}if(key==='party-lab-sub'){if(labPick[id]>0)labPick[id]--;if(!labPick[id])delete labPick[id];panel('lab',true);return true;}if(key==='party-lab-clear'){labPick={};panel('lab',true);return true;}
      if(key==='party-lab-try'){if(!canCook()){ctx.toast('請回到安全營地，或由廚師在安靜處研發。',1800,false);return true;}const result=P.research(r(),labPick,r().revision);if(commit(result,false)){ctx.toast(result.message,result.effect.discovered?3600:2600,false);ctx.audio.sfxAction?.(result.effect.discovered?'levelup':'cook');if(result.effect.discovered&&modern())heroes.specialty('chef');labPick={};panel('lab',true);}else if(result.message)ctx.toast(result.message,1800,false);return true;}if(key==='party-bestiary'){panel('bestiary');return true;}
      if(key==='party-forge'){forgeService=undefined;forgePage='list';forgePanel();return true;}
      if(key==='party-merchant-forge'){const service=root.TowerEncounters.serviceContext(r(),id);if(service&&workshopSafe(service)){forgeService=service;forgePage='list';forgePanel();}else ctx.toast('請靠近這位商人，並確認附近安全。');return true;}
      if(key==='party-forge-back'){forgePanel(true);return true;}if(key==='party-boss-help'){bossHelp();return true;}
      if(key==='party-forge-list'){forgePage='list';forgePanel(true);return true;}
      if(key==='party-forge-select'){forgeSelected=id;forgePage='detail';forgePanel(true);return true;}
      if(/^party-mend-(all|priority|maintenance)-(ask|confirm)$/.test(key)){
        if(forgeService?.kind!=='merchant'||!workshopSafe())return true;const mode=key.split('-')[2],q=mode==='maintenance'?X.maintenanceAllQuote(r(),forgeService):X.repairAllQuote(r(),forgeService,mode==='priority'?{below:.7}:{});if(!q.allowed||!q.affordable)return true;
        if(key.endsWith('-ask')){pendingRepair={mode,revision:r().revision,service:forgeService};ctx.dialog('確認批次維護','修復 '+q.entries.length+' 件裝備？','總計 '+q.coins+' 枚銅幣與 '+q.parts+' 份金屬零件。只處理這位商人承作的裝備；失敗或取消不扣款。','<ul>'+q.entries.map(e=>'<li>'+esc(e.name)+' · '+esc(gearWearer(e.id)||'背包備用')+(e.broken?' · 已損壞':'')+'</li>').join('')+'</ul>',act('取消','party-forge-back')+act('確認維護','party-mend-'+mode+'-confirm'),{summary:'確認修復 '+q.entries.length+' 件裝備。'});return true;}
        if(pendingRepair?.mode!==mode||!workshopSafe(pendingRepair.service))return true;
        const result=mode==='maintenance'?X.maintenanceAll(r(),pendingRepair.revision,pendingRepair.service):X.repairAll(r(),pendingRepair.revision,pendingRepair.service,mode==='priority'?{below:.7}:{});if(commit(result)){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();syncActors();forgePanel(true);}return true;
      }
      if(key==='party-affix-ask'||key==='party-affix-confirm'){
        if(!workshopSafe())return true;const [gearId,effect]=String(id||'').split('|'),F=root.TowerAffixes,g=H.allGear(r()).find(g=>g.id===gearId),q=F?.quote(r(),gearId,effect,forgeService);if(!g||!q?.allowed||!q.affordable)return true;
        if(key.endsWith('-ask')){pendingAffix={id,revision:r().revision,service:forgeService};ctx.dialog('確認材料附魔',g.name+' · '+q.name,'成功率 '+q.chance+'%。消耗 '+q.count+' 份'+root.TowerMaterials.MATERIALS[q.material]+'與 '+q.coins+' 枚銅幣。'+(g.affix?'成功會替換原附魔；':'')+'失敗仍消耗材料與費用，但保留原有附魔。','<p>'+esc(q.description)+' '+esc(F.EFFECTS[effect].description)+'</p>',act('取消','party-forge-back')+act('確認附魔','party-affix-confirm',id),{summary:'確認'+q.name+'附魔，成功率'+q.chance+'%。'});return true;}
        if(pendingAffix?.id!==id||!workshopSafe(pendingAffix.service))return true;if(commit(F.forge(r(),gearId,effect,pendingAffix.revision,pendingAffix.service))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();forgePanel(true);}return true;
      }
      if(key==='party-mend-ask'||key==='party-mend-confirm'){
        if(!workshopSafe())return true;const g=X.allGear(r()).find(g=>g.id===id),q=X.repairQuote(r(),id,forgeService);if(!g||!q||!q.allowed)return true;
        if(key==='party-mend-ask'){pendingRepair={id,revision:r().revision,service:forgeService};ctx.dialog('確認修理',g.name,'補滿耐久需要 '+q.coins+' 枚銅幣與 '+q.parts+' 份金屬零件。'+(q.broken?'破損修理費已乘上 1.5 倍。':'')+(q.merchant?'銅幣已包含商人 20% 服務加價。':''),'',act('返回工坊','party-forge-back')+act('確認修復','party-mend-confirm',id),{summary:'確認修復 '+g.name+'。'});return true;}
        if(!pendingRepair||pendingRepair.id!==id)return true;
        if(!workshopSafe(pendingRepair.service))return true;if(commit(X.repair(r(),id,pendingRepair.revision,pendingRepair.service))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();syncActors();forgePanel(true);}return true;
      }
      if(key==='party-forge-ask'||key==='party-forge-confirm'){
        if(!workshopSafe())return true;const split=id?.indexOf('|'),trait=id?.slice(0,split),gearId=id?.slice(split+1),g=X.allGear(r()).find(g=>g.id===gearId),q=X.forgeQuote(r(),gearId,trait,forgeService);if(!g||!q)return true;
        if(key==='party-forge-ask'){if(!q.allowed||!q.affordable){ctx.toast(q.reason||'鍛造素材、零件或銅幣不足。');return true;}pendingForge={id,revision:r().revision,service:forgeService};ctx.dialog('確認鍛造',g.name+' · '+q.name,'第 '+q.level+' 級，需要 '+q.parts+' 份金屬零件與 '+q.coins+' 枚銅幣。'+(q.merchant?'銅幣已包含商人 20% 服務加價。':'')+'選定特性後不能更換，每件裝備最多強化兩次。','<p>'+esc(X.TRAITS[trait].description)+'</p>'+costLine(q.materialCost,true),act('返回工坊','party-forge-back')+act('確認鍛造','party-forge-confirm',id),{summary:'確認鍛造'+q.name+'。選定後不能更換。'});return true;}
        if(!pendingForge||pendingForge.id!==id)return true;
        if(!workshopSafe(pendingForge.service))return true;if(commit(X.forge(r(),gearId,trait,pendingForge.revision,pendingForge.service),!modern())){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();forgePanel(true);if(modern()){ctx.toast('鍛造完成！',1800,false);if(!forgeService)heroes.specialty('smith');}}return true;
      }
      if(key==='party-dismantle-ask'||key==='party-dismantle'){
        if(!workshopSafe())return true;const g=X.allGear(r()).find(g=>g.id===id);if(!g||forgeService&&!root.TowerEncounters.serviceAvailable(r(),forgeService,g))return true;
        if(key==='party-dismantle-ask'){const wearer=gearWearer(id),warning=wearer?'這件裝備正由'+wearer+'穿戴，拆解後將失去它的能力。':'這件裝備目前放在背包。';pendingDismantle={id,revision:r().revision,service:forgeService};ctx.dialog('拆解裝備確認','拆解'+g.name+'？','拆解後不能取回，將獲得'+X.salvageValue(g)+'份零件。'+warning,'',act('保留裝備','party-forge-back')+act('確認拆解','party-dismantle',id),{summary:'確定拆解'+g.name+'？'+warning+'拆解後不能取回。'});return true;}
        if(!pendingDismantle||pendingDismantle.id!==id)return true;
        if(!workshopSafe(pendingDismantle.service))return true;if(commit(X.dismantle(r(),id,pendingDismantle.revision,pendingDismantle.service))){ctx.audio.sfxAction?.('device');ctx.refreshGear?.();forgePanel(true);}return true;
      }
      if(key==='party-explore-job'||key==='party-explore-work'){
        const s=stations.find(s=>s.kind==='site'&&s.offer.id===id);if(!live()||!s||distance(s)>2.6||!clear(s)||r().party.journey.site.done||ctx.G.shifting)return true;
        if(key==='party-explore-job')finishSite(s,'profession');else{working=s;ctx.close?.();workHud();ctx.toast('開始'+s.offer.verb+'，留意四周的動靜。',1600,'開始'+s.offer.verb+'，留意四周。');}return true;
      }
      if(key==='party-dismiss-ask'){const m=r().party.members.find(m=>m.id===id);if(m)ctx.dialog('與同伴道別','確定讓'+P.person(m.profession,m.sex)+'離隊？','離隊後會保留等級、經驗與技能，裝備退回背包。後續樓層有機會再次相遇，但同行條件會提高；本層不能重新招募，已支付的物資不退回。','',act('繼續同行','party-team')+act('確定道別','party-dismiss',id));return true;}
      if(key==='party-dismiss'){if(commit(P.dismiss(r(),id,r().revision))){syncActors();panel('team',true);}return true;}
      if(key==='party-recruit'){pruneRecruits();if(!near||near.kind!=='recruit'||distance(near)>2.6||!clear(near))return true;const station=near;if(commit(P.recruit(r(),id,r().revision))){if(stations.includes(station))removeStation(station);syncActors();panel('team',true);}return true;}
      if(key==='party-cook'&&canCook()){if(commit(P.cook(r(),id,r().revision),!modern())){ctx.audio.sfxAction?.('cook');panel('cook',true);if(modern()){ctx.toast('料理完成！',1800,false);heroes.specialty('chef');}}return true;}
      if(key==='party-brew'&&safeCamp()){if(commit(root.TowerAlchemy.brew(r(),id,r().revision),!modern())){ctx.audio.sfxAction?.('drink');panel('brew',true);if(modern())ctx.toast('藥水完成！',1800,false);}return true;}
      if(key==='party-eat'){if(commit(P.eat(r(),id,r().revision))){ctx.audio.sfxAction?.('cook');panel('cook',true);}return true;}
      if(key==='party-field-repair'){if(!(live()&&peaceful()))ctx.toast('附近有怪物，等安靜下來再修補。',1600,false);else if(commit(P.fieldRepair(r(),r().revision))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();syncActors();panel('cook',true);}return true;}
      if(key==='party-repair'&&safeCamp()){if(commit(P.camp(r(),'repair',r().revision))){ctx.audio.sfxAction?.('forge');ctx.refreshGear?.();syncActors();panel('cook',true);}return true;}return true;
    }
    // A hit that the half-health shield absorbs repeats the counter hint, at most once every eight seconds.
    let lastGuardHint=-1e9;const clock=()=>globalThis.performance?.now?.()??Date.now();
    function applyHit(m,memberId=null,skillId=null,shot=false){
      if(ctx.paused()||ctx.beforeMonsterHit?.(m)===false)return;
      // Only a fresh swing is refused while preparing; a skill projectile was paid for at cast time and must still land.
      if(!shot&&!skillId&&modern()&&heroes.preparing(memberId||H.state(r()).active))return;
      const source=memberId?actors.find(a=>a.id===memberId)?.model.position:{x:ctx.G.px,z:ctx.G.pz};if(!source)return;
      const dx=source.x-m.model.position.x,dz=source.z-m.model.position.z,front=Math.cos(Math.atan2(dx,dz)-m.model.rotation.y)>.45;
      const result=P.strike(r(),m.id,{memberId,front,skillId,shot,lootCell:ctx.worldToCell(m.model.position.x,m.model.position.z)},r().revision);if(!commit(result,false))return;
      if(result.effect.lord&&result.effect.damage===0){const notice=root.TowerAdventureEvents?.guardNotice?.(r());if(notice&&clock()-lastGuardHint>=8000){lastGuardHint=clock();ctx.toast(notice.hint,3200,false);}}
      ctx.monsterEngaged?.(m);
      if(modern())heroes.impact(m,memberId||H.state(r()).active,skillId,result.effect.crit===true);else ctx.audio.sfxHit();if(result.effect.stunned){m.windup=0;ctx.quest('stun',{monsterId:m.id});}
      if(result.effect.rooted)ctx.quest('root',{monsterId:m.id});
      if(result.effect.dead){if(modern())heroes.defeat?.(m,memberId||H.state(r()).active);m.alive=false;m.model.visible=false;ctx.quest('defeat',{monsterId:m.id});ctx.toast(result.message,2600,modern()?false:result.message);ctx.monsterDefeated?.(m,result.effect);if(modern()&&!result.effect.lord)heroes.victory(memberId||H.state(r()).active);if(memberId){ctx.audio.sfxGuardDefeat?.();if(!modern()&&r().party.members.find(x=>x.id===memberId)?.profession==='swordsman')root.GameVoice?.announceAsset('guard.defeat','怪物已經打倒了，繼續前進！',true);}ctx.save();}
      else if(result.effect.broken)ctx.toast('武器用壞了！可換上備用武器，或請鍛匠在營地修復。',2400,'武器壞了，找鍛匠修理吧');
      if(result.effect.stunned||skillId==='backstab'||skillId==='decisive_slash')m.windup=0;return result;
    }
    function attack(){if(!live()||ctx.paused()||ctx.G.shifting||(modern()&&(heroes.preparing()||heroes.dashing?.(H.state(r()).active)))||(modern()?H.actor(r()).attack:skillLeft)>0||ctx.beforeAction?.()===false)return;
      if(modern()&&H.job(r())==='robot'&&!H.ROBOT.powered(r())){ctx.toast('能源不足，補充動力石再出拳。',1800,false);return;}
      skillLeft=modern()?H.stats(r()).interval:X.attackInterval(r())/ctx.core.hasteMultiplier(r());
      const aim=modern()&&ctx.autoAim?.(),facing=ctx.player()?.rotation.y||0,reach=modern()?H.stats(r()).reach:2.8,target=aim?heroes.aimTarget(reach):ctx.monsters().filter(m=>{const p=m.model.position;return m.alive&&distance(p)<reach&&clear(p)&&Math.cos(Math.atan2(p.x-ctx.G.px,p.z-ctx.G.pz)-facing)>-.05;}).sort((a,b)=>distance(a.model.position)-distance(b.model.position))[0];
      if(modern()&&target)heroes.engage(target);if(modern()&&H.ranged(r())){heroes.shoot(target||null);return;}ctx.audio.sfxSwing();ctx.swing();
      if(target)applyHit(target);else{if(modern()){H.actor(r()).attack=H.stats(r()).interval;ctx.save();}ctx.toast('前方沒有碰到怪物，靠近後再出手。',1200,false);}
    }
    function skill(){if(modern()){heroes.cast(H.actor(r()).skills[0]);return;}if(!live()||ctx.paused()||ctx.G.shifting||!ctx.G.running)return;const result=P.skill(r(),r().revision);if(!commit(result))return;ctx.audio.sfxUse();if(result.effect.skill==='mage')for(const m of ctx.monsters())if(m.alive&&distance(m.model.position)<4&&clear(m.model.position)){r().monsterStuns[m.id]=Math.max(r().monsterStuns[m.id]||0,2);m.windup=0;}ctx.save();hud();}
    function guard(m,dt){if(!live())return false;if(modern()&&root.TowerAffixes?.attackBlocked(r(),m.id,true)){m.windup=0;m.aim=null;m.path=[];return true;}if(heroes?.blocker(m,dt))return true;
      const provoke=modern()?H.state(r()).enemy[m.id]:null;if(provoke?.tauntLeft>0&&provoke.tauntId!==H.state(r()).active){const bait=actors.find(a=>a.id===provoke.tauntId);if(bait&&!(provoke?.root>0)&&H.hp(r(),bait.id)>0&&Math.hypot(bait.model.position.x-m.model.position.x,bait.model.position.z-m.model.position.z)>(m.def.ranged?7:1.7)){ctx.follow(m,dt,(m.def.speed??2.1)*(root.TowerAffixes?.movement(r(),m.id,true)??1),1.35,bait.model.position,{direct:true});return true;}}const a=actors.find(a=>{const member=records().find(x=>x.id===a.id);return (modern()?H.pv(r(),'guard_instinct',a.id)>0||(H.state(r()).enemy[m.id]?.tauntLeft>0&&H.state(r()).enemy[m.id]?.tauntId===a.id):member?.profession==='swordsman')&&member.hp>0&&Math.hypot(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z)<(m.def.ranged?7:1.8)&&ctx.clear(a.model.position.x,a.model.position.z,m.model.position.x,m.model.position.z);});
      if(!a){m.partyGuardId=null;return false;}if(m.partyGuardId!==a.id&&guardVoiceLeft<=0){if(modern())heroes.battle(a.id);else root.GameVoice?.announceAsset('guard.hold','我來擋住牠，你先走！',true);guardVoiceLeft=8;}m.partyGuardId=a.id;m.path=[];m.model.rotation.y=Math.atan2(a.model.position.x-m.model.position.x,a.model.position.z-m.model.position.z);m.cooldown=Math.max(0,m.cooldown-dt);
      if(m.windup>0){m.windup-=dt;if(m.windup<=0){if(modern())H.setBuff(r(),a.id,'intercept',.1,1);const status=modern()?H.state(r()).enemy[m.id]:null,weak=Math.max(status?.weak||0,status?.relayWeak>0?.25:0);if(status)status.weak=0;const hit=P.hurtMember(r(),a.id,m.def.damage*(1-weak)*(root.TowerAffixes?.offense(r(),m.id,true)??1),r().revision,m.id);if(commit(hit,false)){m.cueRelease=(m.cueRelease||0)+1;ctx.audio.sfxGuardBlock?.();if(hit.effect.down)ctx.toast(hit.message,2500,hit.message);}m.cooldown=2.4;}}
      else if(m.cooldown<=0){m.windup=.9;m.windupTotal=.9;}return true;
    }
    // The core rejects a strike from an unpowered robot or a shocked fighter;
    // an AI swing that is certain to fail would retry (and toast) every frame.
    function strikeReady(id){return !modern()||!((H.job(r(),id)==='robot'&&!H.ROBOT?.powered(r(),id))||root.TowerAffixes?.attackBlocked(r(),id));}
    function shift(){
      pruneRecruits();working=null;queueClock=0;if(modern()){const seconds=H.teamPassive(r(),'intuition');if(seconds)r().effects.reveal=Math.max(r().effects.reveal||0,seconds);}heroes?.reset();workHud();if(modern())root.TowerHeroGrowth.state(r()).route=null;const placed=[];
      for(const a of actors){
        const c=ctx.worldToCell(a.model.position.x,a.model.position.z),centre=ctx.cell(c.x,c.y),p=companionSpawn(centre,placed,placed.length);
        a.model.position.set(p.x,0,p.z);a.path=[];a.pathLeft=0;a.safeTurn=false;a.queueLeader=null;a.assembly=null;a.retreating=false;placed.push(a);
      }
    }
    function orderQueue(dt){
      queueClock-=dt;if(queueClock>0)return;queueClock=.5;
      const player={x:ctx.G.px,z:ctx.G.pz},scores=new Map(queue.map(a=>[a,ctx.followDistance?ctx.followDistance(a.model.position,player):distance(a.model.position)]));
      // Stable ordering with hysteresis: let the nearer traveller lead when
      // turning around or leaving a narrow camp, without swapping every frame.
      for(let i=0;i<queue.length-1;i++){
        let nearest=i;for(let j=i+1;j<queue.length;j++)if(scores.get(queue[j])<scores.get(queue[nearest]))nearest=j;
        // Compare with every remaining traveller. Adjacent-only swaps can miss
        // a frontmost member behind two similar scores and deadlock the entry.
        if(scores.get(queue[nearest])+.35<scores.get(queue[i]))queue.splice(i,0,queue.splice(nearest,1)[0]);
      }
    }
    function queueMove(actor,dt,speed,stop,target){
      const p=actor.model.position,start={x:p.x,z:p.z},peers=actors.filter(a=>a!==actor);
      const gap=(point,a)=>Math.hypot(point.x-a.model.position.x,point.z-a.model.position.z);
      const overlap=peers.some(a=>gap(start,a)<BODY_GAP-.001);
      const free=point=>walkClear(start,point)&&peers.every(a=>gap(point,a)>=BODY_GAP-.001||gap(point,a)>gap(start,a)+.00001);
      const moving=ctx.follow(actor,dt,speed,stop,target,{direct:true});
      if(moving&&free(p)&&!overlap)return true;
      if(!moving&&!overlap)return false;
      let dx=p.x-start.x,dz=p.z-start.z;p.x=start.x;p.z=start.z;
      // Yield sideways inside the corridor rather than walk through a companion.
      // If a restored/turned-around group overlaps, separate gradually, never
      // teleport through a wall or move the player to make room.
      if(overlap){dx=dz=0;for(const other of peers){const d=gap(start,other);if(d<BODY_GAP){dx+=(start.x-other.model.position.x)/Math.max(d,.01);dz+=(start.z-other.model.position.z)/Math.max(d,.01);}}}
      if(Math.hypot(dx,dz)<.001){const angle=actors.indexOf(actor)*2.1;dx=Math.sin(angle);dz=Math.cos(angle);}
      const angle=Math.atan2(dx,dz),side=actors.indexOf(actor)%2?1:-1,step=speed*Math.min(dt,.1);
      for(const turn of [0,side*Math.PI/4,-side*Math.PI/4,side*Math.PI/2,-side*Math.PI/2,Math.PI]){
        const next={x:start.x+Math.sin(angle+turn)*step,z:start.z+Math.cos(angle+turn)*step};
        if(!free(next))continue;p.x=next.x;p.z=next.z;actor.model.rotation.y=angle+turn;return step>0;
      }
      return false;
    }
    function retreat(actor,enemies,dt,speed,strategy){
      if(!enemies.length||strategy==='manual'){actor.retreating=false;return null;}const p=actor.model.position,start={x:p.x,z:p.z},enemy=enemies[0],gap=q=>Math.min(...enemies.map(m=>Math.hypot(q.x-m.model.position.x,q.z-m.model.position.z))),before=gap(start),limit=enemy.def?.ranged?1.7:strategy==='survive'?3.8:strategy==='support'?3:2.1;
      if(before>=limit+(actor.retreating ? .6 : 0)){actor.retreating=false;return null;}actor.retreating=true;const step=Math.min(Math.max(0,limit-before),speed*Math.min(Math.max(0,dt),.1));if(step<=0)return {moving:false};
      const peers=[...actors.filter(a=>a!==actor).map(a=>a.model.position),{x:ctx.G.px,z:ctx.G.pz}],angle=Math.atan2(start.x-enemy.model.position.x,start.z-enemy.model.position.z),candidates=[];
      for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2]){const next={x:start.x+Math.sin(angle+turn)*step,z:start.z+Math.cos(angle+turn)*step};if(!walkClear(start,next)||gap(next)<=before+.001||distance(next)>Math.max(10,distance(start))||peers.some(q=>{const old=Math.hypot(start.x-q.x,start.z-q.z),d=Math.hypot(next.x-q.x,next.z-q.z);return d<BODY_GAP-.001&&d<=old+.00001;}))continue;candidates.push({next,gap:gap(next),turn});}
      candidates.sort((a,b)=>b.gap-a.gap||Math.abs(a.turn)-Math.abs(b.turn));if(!candidates.length)return {moving:false};
      const next=candidates[0].next;p.x=next.x;p.z=next.z;actor.path=[];actor.pathLeft=0;actor.safeTurn=false;actor.model.rotation.y=Math.atan2(enemy.model.position.x-p.x,enemy.model.position.z-p.z);return {moving:true};
    }
    function friendlyVisibility(model){
      const camera=ctx.camera?.();if(!camera)return;const c=camera.position,p=model.position,dx=ctx.G.px-c.x,dz=ctx.G.pz-c.z,length=dx*dx+dz*dz,t=length>.01?((p.x-c.x)*dx+(p.z-c.z)*dz)/length:0;
      const cameraDistance=Math.hypot(p.x-c.x,p.z-c.z),occludes=c.y<3.5&&(cameraDistance<1.4||(t>0&&t<1&&Math.hypot(p.x-c.x-t*dx,p.z-c.z-t*dz)<.65));
      if(model.userData.partyOccludes!==occludes){model.userData.partyOccludes=occludes;model.traverse(o=>{if(o.isMesh&&o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material]){const base=mat.userData.partyVisibility||(mat.userData.partyVisibility={transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite});mat.transparent=occludes||base.transparent;mat.opacity=base.opacity*(occludes?.16:1);mat.depthWrite=occludes?false:base.depthWrite;}});}
      for(const key of ['partyTag','partyHp','partyHpBack'])if(model.userData[key])model.userData[key].visible=!occludes&&cameraDistance>2.8;
    }
    // Defeats are noticed every frame; the floating status text is rebuilt a few times a second.
    function syncAilments(dt){if(!modern())return;const F=root.TowerAffixes;let changed=false;ailmentLeft-=dt;const due=ailmentLeft<=0;if(due)ailmentLeft=.25;for(const m of ctx.monsters()){
      let defeated=false;if(m.alive&&r().defeatedMonsters.includes(m.id)){m.alive=false;m.model.visible=false;const drops=(r().party.loot?.entries||[]).filter(e=>e.source===m.id),at=ctx.worldToCell(m.model.position.x,m.model.position.z);for(const d of drops){d.cx=at.x;d.cy=at.y;}ctx.quest('defeat',{monsterId:m.id});ctx.monsterDefeated?.(m,{dead:true,lord:!!m.lord,drops});ctx.audio.sfxGuardDefeat?.();changed=true;defeated=true;}
      if(!due&&!defeated)continue;
      const text=m.alive?(F?.list(r(),m.id,true)||[]).map(s=>F.EFFECTS[s.id].name).join(' · '):'';if(m.model.userData.affixText!==text){const old=m.model.userData.affixTag;if(old){old.parent?.remove(old);ctx.dispose(old);}m.model.userData.affixText=text;m.model.userData.affixTag=null;if(text){const tag=ctx.makeText(text);tag.position.y=m.lord?3.05:2.48;tag.scale.set(1.35,.2,1);m.model.add(tag);m.model.userData.affixTag=tag;}}
    }if(changed){ctx.save();hud();}}
    function tick(dt,now){if(!live()||!ctx.G.running||r().status!=='playing'||document.hidden){workHud();return;}pruneRecruits();if(ctx.G.shifting){if(working){working=null;ctx.save();}workHud();return;}if(ctx.paused()){workHud();return;}recordsOf=null;syncAilments(dt);skillLeft=Math.max(0,skillLeft-dt);guardVoiceLeft=Math.max(0,guardVoiceLeft-dt);pulse+=dt;
      {let best=null,bestGap=Infinity;for(const s of stations){if(!s.model.visible)continue;const gap=distance(s);if(gap<2.6&&gap<bestGap&&clear(s)){best=s;bestGap=gap;}}near=best;}
      if(working){if(distance(working)>2.6||!clear(working)||ctx.hurt?.()){working=null;ctx.save();ctx.toast('先避開危險，稍後可以接著處理。',1400,false);}else{const site=r().party.journey.site;site.progress=Math.min(12,site.progress+dt);if(site.progress>=12)finishSite(working,'work');}}
      refreshSiteVisuals();workHud();
      for(const s of stations)if(s.kind==='recruit')friendlyVisibility(s.model);
      orderQueue(dt);
      let leader={x:ctx.G.px,z:ctx.G.pz},leaderId='player';
      for(const a of queue){if(ctx.paused())return;const m=records().find(m=>m.id===a.id);if(!m)continue;a.model.userData.partyHp.scale.x=.94*Math.max(.001,m.hp/(modern()?H.maxHp(r(),m.id):P.memberMax(m)));a.model.rotation.z=m.hp<=0?.2:0;if(m.hp<=0){friendlyVisibility(a.model);continue;}
        const focus=modern()?heroes.engagement(a.id):null,localEnemies=enemiesAround(a.model.position,8),local=localEnemies[0];
        const enemy=focus&&ctx.clear(a.model.position.x,a.model.position.z,focus.model.position.x,focus.model.position.z)?focus:local,combatEnemy=focus||enemy;
        if(a.assembly){a.assembly.left-=dt;if(a.assembly.left<=0||H.actor(r(),a.id).hurt>0||a.assembly.active!==H.state(r()).active)a.assembly=null;}
        const assembling=!!a.assembly,fighting=!assembling&&!!(combatEnemy&&(focus||(modern()?root.TowerHeroGrowth.state(r()).policies[a.id].strategy!=='survive'&&H.pv(r(),'guard_instinct',a.id)>0:m.profession==='swordsman'))),target=assembling?a.assembly:fighting?combatEnemy.model.position:leader,targetId=assembling?'assembly':fighting?'enemy:'+combatEnemy.id:leaderId;
        if(a.queueLeader!==targetId){a.queueLeader=targetId;a.path=[];a.pathLeft=0;}
        const speed=(fighting?3.6:Math.hypot(target.x-a.model.position.x,target.z-a.model.position.z)>6?6.2:5.6)*(modern()?H.speed(r(),a.id):1);
        const standOff=fighting&&modern()&&H.ranged(r(),a.id)?Math.max(2.5,Math.min(6,H.stats(r(),a.id).reach-.6)):1.35;
        const busy=modern()&&(heroes.cooperating?.(a.id)||heroes.preparing?.(a.id)),withdrawal=!assembling&&!busy&&modern()&&H.ranged(r(),a.id)?retreat(a,localEnemies,dt,3.6*H.speed(r(),a.id),root.TowerHeroGrowth.state(r()).policies[a.id].strategy):null,withdrawing=!!withdrawal,moving=busy?false:withdrawal?withdrawal.moving:queueMove(a,dt,speed,assembling?.15:fighting?standOff:QUEUE_GAP,target);
        // A guard who leaves the line must not drag the rest of the party into
        // battle; downed companions likewise never become a stationary leader.
        if(!fighting&&!withdrawing){leader=a.model.position;leaderId=a.id;}
        friendlyVisibility(a.model);
        if(root.CharacterFace)root.CharacterFace.update(a.model,now/1000,modern()&&H.actor(r(),a.id).hurt>0?'hurt':enemy?'focus':m.hp<(modern()?H.maxHp(r(),m.id):P.memberMax(m))*.25?'tired':'calm');
        for(const key of ['legL','legR'])if(a.model.userData[key])a.model.userData[key].rotation.x=moving?Math.sin(now*.01)*(key==='legL'?1:-1)*.35:0;
        if(a.model.userData.armR){const elapsed=(m.profession==='mage'?3:1.8)-m.cooldown;a.model.userData.armR.rotation.x=m.cooldown>0&&elapsed<.45?-Math.sin(elapsed/.45*Math.PI)*1.1:0;}
        if(!modern()&&m.profession==='healer'&&m.cooldown<=0&&r().hp<30&&r().party.ingredients.herb&&distance(a.model.position)<5){const result=ctx.core.transaction(r(),r().revision,n=>{n.party.ingredients.herb--;n.hp=Math.min(ctx.core.MAX_HP,n.hp+16);n.party.members.find(x=>x.id===m.id).cooldown=20;return {ok:true,message:'澄音用藥草替你包紮了傷口。'};});commit(result);}
        if(enemy&&m.cooldown<=0&&strikeReady(m.id)&&(modern()||['swordsman','mage','scout'].includes(m.profession))&&Math.hypot(a.model.position.x-enemy.model.position.x,a.model.position.z-enemy.model.position.z)<(modern()?H.stats(r(),m.id).reach:m.profession==='mage'?6:2.4)&&!(modern()&&heroes.wantsSkill(m.id,enemy))){
          a.model.rotation.y=Math.atan2(enemy.model.position.x-a.model.position.x,enemy.model.position.z-a.model.position.z);const ranged=modern()&&H.ranged(r(),m.id),result=ranged?{ok:heroes.shoot(enemy,m.id)}:applyHit(enemy,m.id);if(result?.ok&&!ranged){root.CharacterMotion?.beginAction(a.model,'attack',.5);if(modern())root.TowerCombatMotion?.begin(a.model,'attack',H.stats(r(),m.id).interval);}
        }
      }
      if(ctx.paused())return;
      if(modern()){for(const a of actors){if(H.job(r(),a.id)==='robot')dressActor(a);if(H.hp(r(),a.id)<=0){root.TowerCombatMotion?.cancel(a.model);continue;}root.TowerHeroVisuals.pose(a.model,H.actor(r(),a.id).attack,H.stats(r(),a.id).interval,false,dt);}heroes.tick(dt);}
      if(ctx.paused())return;
      for(const m of ctx.monsters()){if(!m.alive)continue;if(m.model.userData.partyHp)m.model.userData.partyHp.scale.x=.94*Math.max(.001,(r().party.health[m.id]??m.partyMaxHp)/m.partyMaxHp);
        if(ctx.camera?.()&&m.model.userData.tag)m.model.userData.tag.visible=m.model.position.distanceTo(ctx.camera().position)>3.4;
        if(m.kind==='moth'){wingsOf(m.model).forEach((w,i)=>w.rotation.z=Math.sin(now*.012)*(i?1:-1)*.5);if(m.windup>0)for(const other of ctx.monsters())if(other.alive&&other!==m&&Math.hypot(other.model.position.x-m.model.position.x,other.model.position.z-m.model.position.z)<6)other.alertLeft=4;}
        if(m.kind==='mushroom'&&m.windup>0&&m.windup<=dt&&distance(m.model.position)<2.8&&clear(m.model.position)){if(modern())H.inflict(r(),H.state(r()).active,'slow',3,.6);else r().party.slowLeft=3;}
      }
      const b=r().party.boss;if(b){const phase=P.bossPhase(r()),d=X.BOSSES[r().floor];for(const s of stations){if(s.kind!=='boss')continue;
        const hazard=X.danger(r(),s.index),parts=s.parts,solved=b.seals[s.index],color=solved?0x83ccac:phase==='warning'?0xffc273:hazard.active?0xf28975:d.kind==='pulse'&&X.cycle(r())%3===s.index?0xffffff:d.color,recolor=parts.color!==color;parts.color=color;
        if(parts.seal){parts.seal.rotation.y=b.angles[s.index]*Math.PI/2;parts.seal.position.y=1.2+(phase==='strike'?.16:Math.sin(pulse*2)*.06);if(recolor)for(const material of parts.sealMaterials)material.color.setHex(color);}
        for(const arm of parts.arms){arm.scale.y=hazard.active?1:!solved&&phase==='warning'?.22+Math.sin(pulse*10)*.04:.08;const angle=arm.userData.angle;arm.position.set(Math.sin(angle)*hazard.radius*.82,0,Math.cos(angle)*hazard.radius*.82);}
        parts.warning.scale.set(hazard.radius,hazard.radius,1);if(recolor)parts.warning.material.color.setHex(color);
        const water=parts.water;if(water){water.scale.set(hazard.radius,1,hazard.radius);water.position.y=hazard.active?.5:.05;water.visible=!solved;}
        if(hazard.active&&distance(s)<hazard.radius&&clear(s)&&s.hitCycle!==hazard.cycle){s.hitCycle=hazard.cycle;ctx.damage(hazard.damage,'trap','機關動起來了，快退到警戒圈外！');if(ctx.paused()||r().status!=='playing')break;}
      }}
      uiClock+=dt;if(uiClock>.15){uiClock=0;hud();}
    }
    function hud(){refreshSiteVisuals();workHud();if(!enabled())return;
      const status=document.getElementById('towerGuardStatus');if(status){status.hidden=false;let button=status.querySelector('.party-status');if(!button){status.innerHTML='<button class="party-status" type="button"></button>';button=status.firstChild;button.onclick=()=>panel();}button.textContent=P.PROFESSIONS[modern()?H.job(r()):r().party.profession].name+' · 隊伍 '+(r().party.members.length+1)+'/'+Math.max(r().party.members.length+1,P.recruitLimit(r())+1)+(r().party.members.some(m=>m.hp<=0)?' · 同伴需要休息':'');}
const attack=document.getElementById('towerAttackBtn');if(attack&&live()&&(!ctx.inDungeon()||ctx.inHunt?.())){const cd=modern()?H.actor(r()).attack:skillLeft,type=modern()?H.GEAR[H.stats(r()).weapon?.kind]?.type:null,bow=type==='bow',orb=['staff','book'].includes(type),label=bow?'射箭':orb?'光彈':r().equipment.weapon?'揮擊':'徒手';attack.disabled=cd>0||(modern()&&H.job(r())==='robot'&&!H.ROBOT.powered(r()));attack.title=bow?'箭矢 '+r().bag.arrow+'／'+ctx.core.itemLimit('arrow',r())+' · 每次射擊消耗一支':orb?'光彈發射即消耗武器耐久':'近戰命中才消耗武器耐久';if(window.BattleDock)BattleDock.attackLabel(label,cd,bow?'箭 '+r().bag.arrow:'');else attack.textContent=label+(cd>0?' '+cd.toFixed(1):bow?' · 箭 '+r().bag.arrow:' X');}
      if(modern())heroes.hud();
      const skillButton=document.getElementById('towerProfessionBtn');if(skillButton){skillButton.hidden=!live()||modern();skillButton.disabled=r().party.cooldown>0||ctx.paused();skillButton.textContent=r().party.cooldown>0?'準備 '+Math.ceil(r().party.cooldown)+'秒':P.PROFESSIONS[r().party.profession].skill+' C';}
      const talk=document.getElementById('towerTalkBtn');if(near&&live()&&talk){talk.disabled=false;talk.hidden=ctx.paused();talk.ariaLabel=near.kind==='camp'?'營地料理（R）':near.kind==='boss'?'操作機關（R）':near.kind==='site'?'探索機關（R）':'邀請同伴（R）';}
      const objective=document.getElementById('towerObjective');if(objective&&live()){
        if(working)objective.textContent=working.offer.verb+' · 進度條填滿即可完成';
        else if(near)objective.textContent=near.kind==='camp'?'旅人營地 · 料理、保養'+(P.has(r(),'smith')?'、鍛造':'')+(root.TowerAlchemy?.makers(r()).length?'、藥水':'')+'（R）':near.kind==='recruit'?'旅人正在招募同行者 · 靠近對話':near.kind==='site'?near.offer.name+' · '+(r().party.journey.site.done?'已完成':'對話可選職業專長或一般處理'):X.BOSSES[r().floor].name+' · '+({idle:'對話開始；背包可讀機關說明',warning:'黃光預警，先退開！',strike:'機關啟動，避開警戒圈',rest:X.hint(r()),done:'封印已解除'}[P.bossPhase(r())]);
        else if(root.TowerAdventureEvents?.guardNotice?.(r()))objective.textContent=root.TowerAdventureEvents.guardNotice(r()).objective;
        else if(r().party.boss&&!r().party.boss.done)objective.textContent=X.BOSSES[r().floor].name+' · 機關 '+r().party.boss.seals.filter(Boolean).length+'/'+r().party.boss.seals.length+' · 背包內有說明';
      }
    }
    function install(){heroes?.install();const left=document.getElementById('towerLeftHud');if(left&&!document.getElementById('towerWorkProgress')){const work=document.createElement('section');work.id='towerWorkProgress';work.hidden=true;work.setAttribute('aria-label','現場探索進度');work.innerHTML=workMarkup('現場探索',0,'處理中');left.appendChild(work);}const rail=document.getElementById('towerActionRail');if(!rail)return;const b=document.createElement('button');b.id='towerProfessionBtn';b.className='tower-btn';b.hidden=true;ctx.bind(b,skill);rail.prepend(b);}
    function switchControl(from,to){const target=actors.find(a=>a.id===to),old={x:ctx.G.px,z:ctx.G.pz};if(!target)return;const next={x:target.model.position.x,z:target.model.position.z};syncActors();const previous=actors.find(a=>a.id===from);if(previous)previous.model.position.set(old.x,0,old.z);ctx.G.px=next.x;ctx.G.pz=next.z;ctx.player().position.set(next.x,0,next.z);}
    return {enabled,live,portrait,switchControl,heroes,movementLocked:()=>modern()&&!!heroes?.movementLocked(),refreshActors:syncActors,regroup,refreshMonsters,refreshWorkProgress:workHud,ingredientModel,materialModel,monsterModel,build,tick,hud,attack,skill,guard,shift,interact,handle,panel,install,reset,safeCamp,get nearby(){pruneRecruits();return live()?near:null;},reserved:()=>{pruneRecruits();return live()?stations:[];},markers:()=>{pruneRecruits();return live()?stations.filter(s=>s.model.visible).map(s=>({cx:s.cx,cy:s.cy,color:s.kind==='boss'?'#efc977':'#a0dcc2',label:s.kind==='boss'?String(s.index+1):s.kind==='camp'?'營':s.kind==='site'?'探':'友'})):[];}};
  }
  root.TowerPartyRuntime={create,portrait,foodArt,dishArt};
})(typeof globalThis!=='undefined'?globalThis:this);
