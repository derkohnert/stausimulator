// Run simulation logic without a browser: node tests/deadlocks.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const noop=()=>{},elements=new Map();
function element(id){if(!elements.has(id)){
 const tag=html.match(new RegExp('<(?:input|select)[^>]*id="'+id+'"[^>]*>'))?.[0]||'';
 const select=html.match(new RegExp('<select[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</select>'))?.[1];
 const options=select?[...select.matchAll(/<option([^>]*)value="([^"]*)"[^>]*>/g)]:[];
 const value=tag.match(/value="([^"]*)"/)?.[1]??(options.find(o=>o[0].includes('selected'))||options[0])?.[2]??'';
 elements.set(id,{value,textContent:'',innerHTML:'',style:{},classList:{contains:()=>false,toggle:noop,remove:noop,add:noop},setAttribute:noop,addEventListener:noop,add:noop,click(){this.onclick?.()},getContext:()=>new Proxy({},{get:()=>noop}),getBoundingClientRect:()=>({width:800,height:650}),clientWidth:800,clientHeight:650});
 }return elements.get(id)}
const context=vm.createContext({console,Math,Map,Set,JSON,Number,String,Infinity,Option:function(){},devicePixelRatio:1,requestAnimationFrame:noop,window:{addEventListener:noop},document:{getElementById:element,addEventListener:noop,querySelectorAll:()=>[],querySelector:()=>null,body:element('body')},localStorage:{getItem:()=>null,setItem:noop}});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
function run(code){return vm.runInContext(code,context)}
run(`function setup(lanes=1,n=0){restoreControls();$('length').value=450;$('lanes').value=lanes;$('n').value=n;$('v0').value=100;reset();buildShape();physicsGeometry=makeGeometry(800,650);physicsKey=[shapeKey,cfg.length,cfg.lanes,cfg.carlen].join('/')}
function snapshot(){return new Map([...cars,...queue,...exits].map(c=>[c,{pos:c.pos,ramp:c.ramp,exitProgress:c.exitProgress}]))}
function freezeArbitrate(seconds){for(let i=0;i<seconds/dt;i++){const before=snapshot();time+=dt;arbitrateDeadlocks(before)}}`);
assert.equal(run(`setup();let a=makeCar(0,mergeGate()),b=addCar('car');cars=[a];b.ramp=.97;a.v=b.rampV=0;freezeArbitrate(1);deadlocks.values().next().value.round`),0);
assert.equal(run(`freezeArbitrate(.5);deadlocks.values().next().value.round`),1);
assert.equal(run(`freezeArbitrate(1.5);deadlocks.values().next().value.round`),2);
assert.equal(run(`freezeArbitrate(1.5);[a,b].some(c=>c.deadlockMovedAt>0)`),true);
assert.equal(run(`boxesOverlap(vehicleBox(a,physicsGeometry),vehicleBox(b,physicsGeometry))`),false);
assert.equal(run(`setup();cars=[makeCar(0,30),makeCar(0,40),makeCar(0,50)];cars.forEach(c=>c.v=0);freezeArbitrate(10);deadlocks.size`),0);
assert.equal(run(`setup();cars=[makeCar(0,30),makeCar(0,30),makeCar(0,30)];cars.forEach(c=>c.v=0);freezeArbitrate(5);cars.every((c,i)=>cars.every((o,j)=>i===j||!boxesOverlap(vehicleBox(c,physicsGeometry),vehicleBox(o,physicsGeometry))))`),true);
assert.equal(run(`setup();a=makeCar(0,30);b=makeCar(0,30);cars=[a,b];a.brake=Infinity;freezeArbitrate(5);deadlocks.size`),0);
assert.equal(run(`setup(2);cars=[makeCar(0,30),makeCar(1,30)];cars.forEach(c=>c.v=0);freezeArbitrate(10);deadlocks.size`),0);
// Real steps must recover from a pre-existing multi-car collision too.
assert.equal(run(`setup();cars=[makeCar(0,30),makeCar(0,30),makeCar(0,30)];cars.forEach(c=>c.v=0);for(let i=0;i<500;i++)step();cars.every((c,i)=>cars.every((o,j)=>i===j||!boxesOverlap(vehicleBox(c,physicsGeometry),vehicleBox(o,physicsGeometry))))`),true);
// Emergency corrections must not cross a red light or cone in either direction.
assert.equal(run(`setup();a=makeCar(0,30);b=makeCar(0,30);cars=[a,b];signals=[{id:1,lane:0,pos:34}];obstacles=[{lane:0,pos:26,obstacle:true}];let original=a.pos;nudgeConflict(a,cars,3);a.pos===original`),true);
assert.equal(run(`setup();cars=[makeCar(0,30),makeCar(0,30)];cars.forEach(c=>c.v=0);freezeArbitrate(1.5);let first=$('laneStatus').textContent;setup();cars=[makeCar(0,30),makeCar(0,30)];cars.forEach(c=>c.v=0);freezeArbitrate(1.5);first===$('laneStatus').textContent`),true);
// Bumper gaps below the old five-metre threshold, both parked and moving.
for(const speed of [0,10]){
 assert.equal(run(`setup();var entrant=addCar('car');entrant.ramp=.84;entrant.rampV=${speed};var target=mergeGate()-rampSpan()*.16;cars=[makeCar(0,target-6),makeCar(0,target+6)];cars.forEach(c=>c.v=${speed});advanceQueue();cars.includes(entrant)&&!!entrant.laneChange`),true);
 assert.equal(run(`setup();entrant=addCar('car');entrant.ramp=.84;cars=[makeCar(0,target)];advanceQueue();queue.includes(entrant)`),true);
}
// Entry is possible throughout the final fifth, including at the end.
for(const fraction of [.81,.93,1]){
 assert.equal(run(`setup();var mergingCar=addCar('car');mergingCar.ramp=${fraction};advanceQueue();cars.includes(mergingCar)&&!!mergingCar.laneChange`),true);
}
for(const previousWinner of ['main','ramp']){
 assert.equal(run(`setup();lastZipperWinner='${previousWinner}';var z=addCar('car');z.ramp=.75;z.rampV=8;var neighbour=makeCar(0,mergeGate()-rampSpan()*.25);neighbour.v=8;cars=[neighbour];advanceQueue();queue.includes(z)&&('${previousWinner}'==='main'?neighbour.zipperBrakeUntil>time:z.rampV<8)`),true);
}
assert.equal(run(`setup();var waiting=addCar('car');waiting.ramp=.6;advanceQueue();queue.includes(waiting)`),true);
assert.equal(run(`waiting.ramp=.98;waiting.rampV=2;var blocker=makeCar(0,mergeGate());blocker.v=0;cars=[blocker];for(let i=0;i<200;i++)advanceQueue();queue.includes(waiting)&&waiting.ramp===1&&waiting.rampV===0`),true);
assert.equal(run(`cars=[];advanceQueue();cars.includes(waiting)&&!!waiting.laneChange`),true);
assert.equal(run(`setup();var follower=makeCar(0,40),leader=makeCar(0,48);cars=[follower,leader];leader.v=follower.v=10;follower.recoverGap=true;step();follower.v>9.9&&follower.v<10`),true);
// Normal traffic continues merging without emergency teleports.
for(const lanes of [1,2])for(const count of [6,30]){
 const result=run(`setup(${lanes},${count});if(${count}===30)obstacles.push({lane:0,pos:cfg.length*.8,obstacle:true});for(let i=0;i<3;i++)addCar('car');var nudges=0;for(let i=0;i<2400;i++){step();nudges+=[...cars,...queue].filter(c=>c.deadlockMovedAt===time).length}JSON.stringify({waiting:queue.length,nudges})`);
 const parsed=JSON.parse(result);assert.equal(parsed.waiting,0,result);assert.equal(parsed.nudges,0,result);
 console.log('Merge regression',lanes,count,parsed);
}
console.log('Passed: standstill delay, reroll escalation, safe repositioning, groups, ordinary queues, manual braking, merge regressions.');
