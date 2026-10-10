import './style.css';
import { eras, formatProgress } from './timeline';
import { CosmicScene } from './scene';
import { AmbientSound } from './ambient';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div class="experience">
  <div class="scene" id="scene" aria-hidden="true"></div>
  <div class="vignette"></div>
  <header class="topbar">
    <a class="brand" href="#now" aria-label="Afterlight, начало"><span class="brand-symbol">✳</span> AFTERLIGHT<span class="brand-dot">.</span></a>
    <div class="top-center">АТЛАС ДАЛЁКОГО БУДУЩЕГО <span class="top-divider">/</span> ИНТЕРАКТИВНАЯ ХРОНИКА</div>
    <div class="header-actions"><button id="ambient-toggle" class="ambient-toggle" type="button" aria-pressed="false" title="Включить фоновый эмбиент">♫ <span>ДОБАВИТЬ АТМОСФЕРЫ</span></button><a class="github" href="https://github.com/ivalexandr/afterlight" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></div>
  </header>
  <main class="content">
    <div class="eyebrow"><span class="eyebrow-line"></span><span id="epoch">ПРОЛОГ</span><span class="chapter" id="chapter">01 / 12</span></div>
    <div class="event" id="event">
      <div class="time" id="time">НАСТОЯЩЕЕ</div>
      <h1 id="title">Мы здесь. Мы существуем.</h1>
      <p class="description" id="description"></p>
      <div class="footnote"><span class="info-icon">i</span><span id="note"></span></div>
      <div class="confidence" id="confidence"></div>
    </div>
    <div class="quote">«Вселенная не обязана быть понятной нам.<br>И всё же мы пытаемся её понять.»</div>
  </main>
  <footer class="timeline-panel">
    <div class="timeline-heading"><span>ПУТЕШЕСТВИЕ ВО ВРЕМЕНИ</span><span id="period-label">01 — ПРОЛОГ</span></div>
    <div class="timeline-track-wrap"><input id="timeline" aria-label="Время во Вселенной" type="range" min="0" max="1000" value="0" step="1"/><div class="timeline-ticks" id="ticks"></div></div>
    <div class="bottom-row"><span class="range-label">НАСТОЯЩЕЕ</span><div class="controls"><button id="prev" aria-label="Предыдущая эпоха">←</button><span id="counter">01 <span>/ 12</span></span><button id="next" aria-label="Следующая эпоха">→</button></div><span class="range-label">ЗА 10¹⁰⁰ ЛЕТ →</span></div>
  </footer>
  <div class="side-index">AFTERLIGHT — VOL. I <span>✦</span> THE FAR FUTURE</div>
</div>`;

const scene=new CosmicScene(document.querySelector('#scene')!);
const ambient=new AmbientSound();
const ambientButton=document.querySelector<HTMLButtonElement>('#ambient-toggle')!;
ambientButton.addEventListener('click',async()=>{
  ambientButton.disabled=true;
  try{
    const playing=await ambient.toggle();
    ambientButton.setAttribute('aria-pressed',String(playing));
    ambientButton.innerHTML=playing?'♫ <span>ВЫКЛЮЧИТЬ АТМОСФЕРУ</span>':'♫ <span>ДОБАВИТЬ АТМОСФЕРЫ</span>';
    ambientButton.title=playing?'Выключить фоновый эмбиент':'Включить фоновый эмбиент';
  }catch(error){console.error('Не удалось включить звук',error);}
  finally{ambientButton.disabled=false;}
});
const slider=document.querySelector<HTMLInputElement>('#timeline')!;
const ticks=document.querySelector<HTMLDivElement>('#ticks')!;
const $=(id:string)=>document.getElementById(id)!;
let index=0;
const maxProgress=formatProgress(eras[eras.length-1].year);
for(let i=0;i<eras.length;i++){const mark=document.createElement('span');mark.style.left=(formatProgress(eras[i].year)/maxProgress*100)+'%';mark.className='tick';mark.title=eras[i].time;mark.addEventListener('click',()=>go(i));ticks.append(mark);}
function go(next:number, updateHash=true){
  index=Math.max(0,Math.min(eras.length-1,next));const era=eras[index];
  $('epoch').textContent=era.epoch;$('chapter').textContent=String(index+1).padStart(2,'0')+' / '+eras.length;
  $('time').textContent=era.time;$('title').textContent=era.title;$('description').textContent=era.description;$('note').textContent=era.note;
  $('confidence').textContent=era.confidence==='high'?'● НАБЛЮДАЕМЫЙ ФАКТ':era.confidence==='model'?'◌ НАУЧНАЯ МОДЕЛЬ':'◇ НЕОПРЕДЕЛЁННЫЙ СЦЕНАРИЙ';
  $('period-label').textContent=String(index+1).padStart(2,'0')+' — '+era.epoch;
  $('counter').innerHTML=String(index+1).padStart(2,'0')+' <span>/ '+eras.length+'</span>';
  $('prev').toggleAttribute('disabled',index===0);$('next').toggleAttribute('disabled',index===eras.length-1);
  slider.value=String(Math.round(formatProgress(era.year)/maxProgress*1000));
  slider.style.setProperty('--progress',(Number(slider.value)/10)+'%');
  document.documentElement.style.setProperty('--accent',era.accent);
  $('event').classList.remove('enter');void $('event').offsetWidth;$('event').classList.add('enter');
  scene.setEra(era);
  if(updateHash)history.replaceState(null,'','#'+era.id);
}
slider.addEventListener('input',()=>{
  const value=Number(slider.value)/1000*maxProgress;
  let closest=0,dist=Infinity;
  eras.forEach((era,i)=>{const d=Math.abs(formatProgress(era.year)-value);if(d<dist){dist=d;closest=i;}});
  if(closest!==index)go(closest);
  else slider.style.setProperty('--progress',(Number(slider.value)/10)+'%');
});
$('prev').addEventListener('click',()=>go(index-1));$('next').addEventListener('click',()=>go(index+1));
window.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);}});
window.addEventListener('hashchange',()=>{const i=eras.findIndex(x=>x.id===location.hash.slice(1));if(i>=0)go(i,false);});
go(Math.max(0,eras.findIndex(x=>x.id===location.hash.slice(1))),false);
