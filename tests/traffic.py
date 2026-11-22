# Run with Python Playwright and Chromium. Set CHROMIUM to use a system executable.
from playwright.sync_api import sync_playwright
from pathlib import Path
import os
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.getenv('CHROMIUM'),args=['--no-sandbox','--no-zygote','--single-process','--disable-gpu'])
 t=b.new_page(); t.on('pageerror',lambda e: print('ERROR',e)); t.goto((Path(__file__).resolve().parents[1] / 'index.html').as_uri());print(t.title());print(t.evaluate('({time,cars:cars.length})'))
 t.evaluate("if(!paused)$('pause').click()")
 for w,h in [(1360,850),(820,1180),(390,844),(844,390)]:
  t.set_viewport_size(dict(width=w,height=h))
  for mode in ['lab','discover']:
   t.locator('#'+mode).click(); t.evaluate('paint()')
   print(w,h,mode,t.evaluate('[document.documentElement.scrollWidth,canvas.clientWidth,canvas.clientHeight]'));assert t.evaluate('document.documentElement.scrollWidth===innerWidth')
 t.set_viewport_size(dict(width=1360,height=850))
 for lanes in [1,2]:
  for n in [6,30]:
   result=t.evaluate('''([lanes,n])=>{restoreControls();$('length').value=450;$('lanes').value=lanes;$('n').value=n;$('v0').value=100;reset();paint();if(n===30)obstacles.push({lane:0,pos:cfg.length*.8,obstacle:true});const entrants=[addCar('car'),addCar('car'),addCar('car')];let jumps=0;for(let i=0;i<2400;i++){const prev=new Map(cars.map(c=>[c.id,c.pos]));step();for(const c of cars)if(prev.has(c.id)&&mod(c.pos-prev.get(c.id),cfg.length)>5)jumps++}return {remaining:queue.map(c=>[c.id,c.ramp,c.mergeYieldTo]),jumps,avg:currentMeasurement().speed}}''',[lanes,n])
   assert not result['remaining'] and result['jumps']==0, result
 t.evaluate("restoreControls();reset()")
 result=t.evaluate('''()=>{
 function check(test,ok){if(!ok)throw Error(test);results.push(test)}
 const results=[];
 restoreControls();reset();paint();
 function run(mode){setMode(mode);reset();paint();for(let i=0;i<400;i++)step();return JSON.stringify(cars,(k,v)=>k==='draw'?undefined:v)}
 check('Identischer Verlauf bei gleichem Seed in beiden Ebenen',run(true)===run(false));
 selected=cars[0].id; const snap=()=>JSON.stringify([cars,queue,selected,time,currentMeasurement(),cfg],(k,v)=>k==='draw'?undefined:v);
 const state=snap();setMode(true);setMode(false);check('Umschalten erhaelt Zustand',state===snap());
 $('lanes').value=2;$('n').value=1;reset();paint();const c=cars[0];selected=c.id;
 for(const lane of [1,0]){manualLane();step();check('Blinkrichtung nach Spur '+lane,indicatorSide(c)===(lane===1?-1:1));for(let i=0;i<70;i++)step();check('Spurwechsel '+lane,c.lane===lane&&!c.laneChange)}
 reset();cars[0].pos=cfg.length*.75-.01;step();check('Eine Durchfahrt',passages.length===1);
 cars[0].brake=Infinity;for(let i=0;i<400;i++)step();
 check('Stillstand korrekt begrenzt',currentMeasurement().stopped>0&&currentMeasurement().stopped<100);
 $('remember').click();reset();check('Referenz bleibt beim Neustart erhalten',reference.seconds>=20&&time===0);
 setMode(true);check('Abweichende Laborwerte sichtbar',!$('defaults').hidden);$('defaults').click();check('Standardwerte wiederhergestellt',$('defaults').hidden);
 const entry=addCar('car');for(let i=0;i<1500&&queue.length;i++)step();selected=entry.id;requestExit();for(let i=0;i<2400&&!completed;i++)step();
 check('Reisezeit einer vollstaendigen Fahrt',completed===1&&Math.abs(tripTime-time)<.001);
 $('setupName').value='Test';saveSetup();const saved=snap();reset();loadSetup();check('Setup mit Messwerten wiederhergestellt',snap()===saved);
 acc=0;last=1000;paused=false;$('timescale').value=4;read();const start=time;frame(1100);paused=true;frame(1200);check('Vierfache Geschwindigkeit und Pause',Math.abs(time-start-.4)<.00001);
 return results;
 }''')
 print(result)
