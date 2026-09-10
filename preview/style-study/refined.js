// Appearance prototype; no game state or browser storage is read or written.
if(!new URLSearchParams(location.search).has('theme'))history.replaceState(null,'',location.pathname+'?theme=c&letter=d');
await import('./world-directions.js');
const game=document.querySelector('.r-game');
const rose=`<path d="M0-11C-5-15-11-8-8-4C-15 0-9 8-5 7C-5 14 5 14 6 7C13 8 15-2 8-5C10-12 3-15 0-11ZM0-8C-8-8-7 3-1 5C5 7 10-1 4-5C0-8-5-3-2 1C0 4 5 1 2-1M0 11v10M0 17C-8 11-12 16-5 18ZM0 20C8 14 13 18 5 21Z"/>`;
const icon=(paths,cls='')=>`<svg viewBox="0 0 24 24" class="game-glyph ${cls}" aria-hidden="true">${paths}</svg>`;
const arrow=icon('<path d="M4 12h16m-6-6 6 6-6 6"/>');
const lock=icon('<path d="M8 10V6a4 4 0 0 1 8 0v4"/><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M12 15v2"/>');
const quill=icon('<path d="M4 21 18 4m-9 9c-3-5 4-10 11-11-1 7-5 14-11 11ZM8 17h8"/>');
function paper(name,i){
 const k='refine-letter-'+i;
 return `<svg class="art-envelope finished-paper" viewBox="0 0 198 104" aria-hidden="true"><defs>
 <linearGradient id="${k}-paper" x2=".6" y2="1"><stop stop-color="#fcf6e6"/><stop offset=".55" stop-color="#eee4cd"/><stop offset="1" stop-color="#d5c7aa"/></linearGradient>
 <linearGradient id="${k}-flap" x2=".2" y2="1"><stop stop-color="#fff9ed"/><stop offset=".65" stop-color="#f1e8d4"/><stop offset="1" stop-color="#e4d8bc"/></linearGradient>
 <radialGradient id="${k}-wax" cx=".3" cy=".22"><stop stop-color="#696355"/><stop offset=".45" stop-color="#443f36"/><stop offset=".8" stop-color="#28272a"/><stop offset="1" stop-color="#1e2023"/></radialGradient>
 <linearGradient id="${k}-waxrim" x2=".7" y2="1"><stop stop-color="#c1ad8580"/><stop offset=".45" stop-color="#71624a"/><stop offset="1" stop-color="#121315"/></linearGradient>
 <filter id="${k}-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1.4" stdDeviation=".85" flood-color="#392c25" flood-opacity=".45"/></filter>
 <pattern id="${k}-fibre" width="17" height="13" patternUnits="userSpaceOnUse"><path d="M2 3h4m6 7h3M4 11h2M11 1h2" stroke="#897951" stroke-opacity=".085" stroke-width=".5"/></pattern>
 </defs><path d="M5 7H193V101H5Z" fill="#a89573"/><path d="M5 5H193V99H5Z" fill="url(#${k}-paper)" stroke="#cfbea0" stroke-width=".8"/>
 <path d="M6 6H192M6 6V98" stroke="#fffdf2" stroke-width=".9"/><path d="M7 98l73-49h40l71 49" fill="#cbb99629"/>
 <path d="M8 97l76-50M190 97l-75-50" stroke="#8f80664f" stroke-width="1.2"/><path d="M9 96l75-48M189 96l-74-48" stroke="#fff8e2" stroke-opacity=".7" stroke-width=".6"/>
 <path d="M8 8l80 52q11 7 22 0l81-52" fill="none" stroke="#8c7d6655" stroke-width="3" transform="translate(0 1.1)"/>
 <path d="M6 6H192L110 57q-11 7-22 0Z" fill="url(#${k}-flap)" stroke="#8e816637" stroke-width=".55"/><path d="M7 7l81 49q11 7 22 0l81-49" fill="none" stroke="#fff9e9" stroke-width=".75"/>
 <path d="M5 5h188v94H5Z" fill="url(#${k}-fibre)"/>
 <path d="M9 9h180v86H9Z" fill="none" stroke="#545044" stroke-width="1.45"/><path d="M13 13h172v78H13Z" fill="none" stroke="#77705f" stroke-width=".55"/>
 <g stroke="#706957" stroke-width=".5" fill="none"><path d="M17 16l24 14m-24-11 19 11m-19-8 14 8M181 16l-24 14m24-11-19 11m19-8-14 8"/>
 <g transform="translate(29 79) scale(.28)">${rose}</g><g transform="translate(171 79) scale(-.28 .28)">${rose}</g></g>
 <text class="finished-sender" x="99" y="29" text-anchor="middle" fill="#5f5746" font-size="11.4" letter-spacing="1.1">${name}</text>
 <g filter="url(#${k}-shadow)"><path d="M84 60q-3-9 4-13q5-6 13-3q9-2 13 5q6 7 1 14q-1 9-11 11q-10 3-17-4q-6-2-3-10Z" fill="url(#${k}-wax)" stroke="url(#${k}-waxrim)" stroke-width="1"/>
 <path d="M87 55q0-10 10-10q9-2 14 6" fill="none" stroke="#c1ab7c" stroke-opacity=".38" stroke-width=".7"/>
 <circle cx="100" cy="58" r="11" fill="none" stroke="#0e141b" stroke-opacity=".62" stroke-width="1.25"/><circle cx="100.5" cy="58.6" r="10.5" fill="none" stroke="#a39470" stroke-opacity=".28" stroke-width=".65"/>
 <g transform="translate(100 55.8) scale(.43)" fill="none" stroke="#181b20" stroke-width="2.5">${rose}</g><g transform="translate(100.4 56.4) scale(.43)" fill="none" stroke="#b0a17d" stroke-opacity=".65" stroke-width="1">${rose}</g></g></svg>`;
}
const offers=[...game.querySelectorAll('.a-offer')];
const records=offers.map((row,i)=>({row,index:i,title:row.querySelector('.a-offer-title').textContent,name:[...row.querySelectorAll('.art-envelope text')].at(-1).textContent,terms:row.querySelector('.a-offer-terms').innerHTML}));
const glyphFor=id=>game.querySelector(`[data-growth="${id}"] .game-glyph`)?.outerHTML??quill;
records.forEach(record=>{
 const {row,index,name}=record;
 row.querySelector('.a-envelope-face').innerHTML=paper(name,index);
 const button=row.querySelector('.a-envelope');button.tabIndex=0;button.style.removeProperty('cursor');
 const oldArrow=row.querySelector('.a-row-arrow');oldArrow.outerHTML=`<span class="f-open-cue"><small>開封</small>${arrow}</span>`;
 row.querySelector('.a-bonds').innerHTML=Array.from({length:3},()=>'<i class="f-bond-mark" aria-hidden="true"></i>').join('');
 row.querySelector('.a-bonds').setAttribute('aria-label',`${name}との関係 0／3`);
 const chance=row.querySelector('.a-growth-reward');if(chance){chance.innerHTML=quill;chance.dataset.note='物語中の選択で、経験や関係が変わります。';chance.title='物語中の選択による変化';}
 button.addEventListener('click',()=>openLetter(record));
});
// Riveted spine: three visible bindings, each mounted on a narrow leather strip.
game.querySelector('.art-frame').innerHTML=`<defs><linearGradient id="f-spine" x2="1" y2="0"><stop stop-color="#241b23"/><stop offset=".3" stop-color="#694448"/><stop offset=".6" stop-color="#533339"/><stop offset="1" stop-color="#2d2028"/></linearGradient><linearGradient id="f-brass" x2="0" y2="1"><stop stop-color="#bca476"/><stop offset=".45" stop-color="#746144"/><stop offset=".62" stop-color="#d7be8b"/><stop offset="1" stop-color="#766145"/></linearGradient></defs><rect x="341" y="86" width="18" height="309" rx="2" fill="url(#f-spine)" stroke="#9b7b563a"/><path d="M344 91v298M356 91v298" stroke="#bc91604c" stroke-width=".65" stroke-dasharray="2 3"/>${[126,241,356].map(y=>`<g><rect x="345" y="${y-8}" width="10" height="16" rx="2" fill="#57413b" stroke="#a98c5a66" stroke-width=".6"/><circle cx="350" cy="${y-5}" r="1.15" fill="url(#f-brass)"/><circle cx="350" cy="${y+5}" r="1.15" fill="url(#f-brass)"/><path d="M348 ${y-2}q-11-8-12 0q-1 6 11 5" fill="none" stroke="#18141c" stroke-width="2.2" transform="translate(.6 1)"/><path d="M348 ${y-2}q-11-8-12 0q-1 6 11 5" fill="none" stroke="url(#f-brass)" stroke-width="1.5"/></g>`).join('')}<g stroke="#b598663b" fill="none"><path d="M374 94h799M374 395h799M561 114h451" stroke-width=".7"/></g>`;
game.querySelector('.a-character-name').innerHTML='<small>LATIER</small><span>エレオノール</span>';
game.querySelector('.a-deadline').insertAdjacentHTML('afterbegin','<span class="f-remaining">残り</span>');
const repayment=game.querySelector('.a-goal .a-meter');repayment.classList.add('f-repayment');repayment.setAttribute('aria-label','返済に充てられる金額：120／1050');game.querySelector('.a-goal').title='返済残 930G。所持金120G／必要額1050G。';
game.querySelectorAll('.a-axis').forEach(button=>{
 const label=button.dataset.axis;
 button.querySelectorAll('.a-rank-marks i:not(.lit)').forEach(i=>i.classList.add('f-lost'));
 button.tabIndex=0;button.style.removeProperty('cursor');
 const rank=button.querySelector('.a-axis-title b').textContent,value=button.querySelector('.a-axis-value>span:last-child').textContent;
 button.addEventListener('click',()=>showNote(button,`${label}　ランク${rank} ／ ${value}`, '斜線の刻みは失ったランク。回復できるのは、現在のランクの範囲内です。'));
});
const growthInfo={negotiation:['交渉','利害を調整し、取り決めを作る力'],knowledge:['知見','世間の仕組みを知り、事情を理解する力'],courage:['胆力','圧力や緊張の中でも行動を貫く強さ'],charm:['魅力','人の関心を引き、関わりたいと思わせる力']};
game.querySelectorAll('.a-growth-item').forEach(button=>{
 const meter=button.querySelector('.a-growth-progress .a-meter'),xp=Number(meter.getAttribute('aria-valuenow')),next=[2,5,9].find(n=>n>xp),start=[0,2,5,9].filter(n=>n<=xp).at(-1);
 if(next!==undefined){meter.style.setProperty('--f-start',(start/9*100)+'%');meter.style.setProperty('--f-end',(next/9*100)+'%');meter.insertAdjacentHTML('beforeend',`<span class="f-next-mark" style="left:${next/9*100}%" aria-hidden="true"></span>`);meter.title=`次の段階まで ${next-xp}`;}
 else{button.classList.add('f-complete');button.querySelector('.a-growth-marks').insertAdjacentHTML('beforeend','<span class="f-complete-seal" aria-hidden="true">✓</span>');}
 button.tabIndex=0;button.style.removeProperty('cursor');const [label,desc]=growthInfo[button.dataset.growth];button.addEventListener('click',()=>showNote(button,`${label}　経験 ${xp}／9`,desc+(next===undefined?'。最高段階に達しています。':`。次の段階まで ${next-xp}。`)));
});
game.querySelector('.a-goal').tabIndex=0;game.querySelector('.a-goal').style.removeProperty('cursor');game.querySelector('.a-goal').addEventListener('click',()=>showNote(null,'返済残　930 G','所持金 120 G ／ 必要額 1,050 G。ゲージは返済に充てられる金額を表します。'));
const note=document.createElement('aside');note.className='f-note';note.hidden=true;note.innerHTML='<button class="f-note-close" aria-label="説明を閉じる">×</button><strong></strong><p></p>';game.append(note);note.querySelector('button').onclick=()=>note.hidden=true;
function showNote(anchor,title,body){note.querySelector('strong').textContent=title;note.querySelector('p').textContent=body;note.style.left=anchor?.classList.contains('a-axis')?'25px':'630px';note.style.width=anchor?.classList.contains('a-axis')?'305px':'520px';note.hidden=false;}
const detail=document.createElement('section');detail.className='f-letter-detail';detail.hidden=true;game.append(detail);let opened=null,lastButton=null;
function closeLetter(){detail.hidden=true;game.querySelector('.a-offers').hidden=false;game.querySelector('.a-rest-action').hidden=false;game.classList.remove('f-reading');opened=null;lastButton?.focus({preventScroll:true});parent.postMessage({type:'refinement-scene',value:'list'},location.origin);}
function openLetter(record){
 opened=record;lastButton=record.row.querySelector('.a-envelope');note.hidden=true;game.querySelector('.a-offers').hidden=true;game.querySelector('.a-rest-action').hidden=true;game.classList.add('f-reading');
 const blocked=record.row.classList.contains('f-unavailable');
 detail.innerHTML=`<div class="f-letter-sheet"><div class="f-letter-border"></div><div class="f-letter-address">エレオノール様</div><h2 tabindex="-1">${record.row.querySelector('.a-offer-title').textContent}</h2><p>検証用の仮依頼。人物・本文・報酬は後から差し替えられます。</p><div class="f-letter-signature"><span>${record.name}</span><svg viewBox="-18 -18 36 42" aria-hidden="true">${rose}</svg></div><span class="f-signed" hidden>Éléonore</span></div><div class="f-letter-bottom"><div class="f-letter-facts">${record.row.querySelector('.a-offer-terms').innerHTML}</div><div class="f-letter-actions"><button class="f-accept" ${blocked?'disabled':''}>この依頼を受ける ${arrow}</button><button class="f-back">手紙一覧へ</button>${blocked?'<small class="f-blocked-note">体力が足りません</small>':''}</div></div>`;
 detail.hidden=false;detail.querySelector('.f-back').onclick=closeLetter;detail.querySelector('.f-accept').onclick=e=>{detail.querySelector('.f-signed').hidden=false;e.currentTarget.innerHTML='署名済み';e.currentTarget.disabled=true;};detail.querySelector('h2').focus({preventScroll:true});parent.postMessage({type:'refinement-scene',value:'detail'},location.origin);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!detail.hidden)closeLetter();else note.hidden=true;}});
const baselineTerms=records.map(r=>r.row.querySelector('.a-offer-terms').innerHTML);
function setExample(mode){
 if(opened)closeLetter();note.hidden=true;
 records.forEach((r,i)=>{r.row.querySelector('.a-offer-title').textContent=r.title;r.row.querySelector('.a-offer-terms').innerHTML=baselineTerms[i];r.row.classList.remove('f-unavailable');});
 if(mode==='varied'){
  const amounts=[80,160,240],stamina=[10,20,120],bond=[1,2,0];records.forEach((r,i)=>{r.row.querySelector('.a-pay b').textContent=String(amounts[i]);const energy=r.row.querySelector('.a-energy');energy.innerHTML=energy.querySelector('svg').outerHTML+'−'+stamina[i];r.row.querySelectorAll('.f-bond-mark').forEach((m,j)=>m.classList.toggle('lit',j<bond[i]));r.row.querySelector('.a-bonds').setAttribute('aria-label',`${r.name}との関係 ${bond[i]}／3`);});
  records[1].row.querySelector('.a-offer-title').textContent='経験を使って役割を選び、次の依頼へ繋げる';
  records[1].row.querySelector('.a-offer-terms').insertAdjacentHTML('beforeend',`<span class="f-preview-cost" title="品位 −10、ランク3から2へ">${game.querySelector('[data-axis="品位"] .game-glyph').outerHTML}−10 <span class="f-rank-drop">3→2</span></span>`);
  records[0].row.querySelector('.a-growth-reward').innerHTML=glyphFor('negotiation')+'<small>＋2</small>';
  records[2].row.classList.add('f-unavailable');records[2].row.querySelector('.a-offer-terms').insertAdjacentHTML('beforeend',`<span class="f-unavailable-note">${lock}体力不足</span>`);
 }
 document.body.dataset.example=mode;
}
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const m=e.data;if(m?.type==='refinement-example')setExample(m.value==='varied'?'varied':'normal');if(m?.type==='refinement-detail'){if(m.value)openLetter(records[0]);else closeLetter();}});
setExample(new URLSearchParams(location.search).get('example')==='varied'?'varied':'normal');
document.body.dataset.refinedReady='true';
