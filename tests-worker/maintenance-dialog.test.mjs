import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../web/maintenance.js',import.meta.url),'utf8');
const notice={id:1,title:'資料更新延遲',body:'<script>alert(1)</script>\n請確認日期',severity:'warning',created_at:'2026-10-26T13:00:00Z'};
function harness({reduced=false,otherDialog=false}={}){
 const nodes=[],timers=new Map(),frames=new Map(),events=new Map();let seq=0,interval,current=notice,failed=false;
 const document={hidden:false,activeElement:null,body:null,addEventListener(n,fn){events.set(n,fn);},getElementById(id){return nodes.find(e=>e.id===id);},querySelector(){return otherDialog?{}:nodes.find(e=>e.tag==='dialog'&&e.open)||null;},createElement(tag){return new Element(tag);}};
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={overflow:''};this.listeners=new Map();this.open=false;this.isConnected=true;this.attrs={};const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};nodes.push(this);}
  setAttribute(k,v){this.attrs[k]=v;}append(...children){this.children.push(...children);}addEventListener(k,fn){this.listeners.set(k,fn);}removeEventListener(k,fn){if(this.listeners.get(k)===fn)this.listeners.delete(k);}focus(){document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;events.get('close')?.({target:this});}getBoundingClientRect(){return {};}querySelector(tag){return this.children.find(e=>e.tag===tag)||this.children.map(e=>e.querySelector(tag)).find(Boolean);}emit(k,event={}){this.listeners.get(k)?.({target:this,...event});}
 }
 document.body=new Element('body');const trigger=new Element('button');document.activeElement=trigger;
 const window={matchMedia:()=>({matches:reduced}),requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{interval=fn;}};
 vm.runInNewContext(source,{document,window,fetch:async()=>failed?new Response(null,{status:503}):Response.json({announcement:current}),AbortSignal,Date,Set});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return{document,trigger,nodes,frames,timers,settle,dialog:()=>document.getElementById('maintenanceNotice'),async poll(value=current){current=value;await interval();},fail(){failed=true;},flushFrames(){for(const fn of frames.values())fn();frames.clear();},finish(){for(const [id,t]of [...timers]){timers.delete(id);t.fn();}},otherClosed(){otherDialog=false;events.get('close')?.({target:{}});}};
}
test('published notice opens a labelled native modal with safe text and staged animation',async()=>{
 const h=harness();await h.settle();const d=h.dialog();assert.equal(d.open,true);assert.equal(d.attrs['aria-labelledby'],'maintenanceNoticeTitle');assert.equal(d.attrs['aria-describedby'],'maintenanceNoticeBody');assert.equal(h.document.getElementById('maintenanceNoticeBody').textContent,notice.body);assert.equal(h.document.body.style.overflow,'hidden');assert.equal(d.classList.contains('is-visible'),false);h.flushFrames();assert.equal(d.classList.contains('is-visible'),true);assert.equal(h.document.activeElement,d.querySelector('button'));
});
test('acknowledging animates out, restores focus and suppresses repeated polling until a new revision',async()=>{
 const h=harness();await h.settle();h.flushFrames();const d=h.dialog();d.querySelector('button').emit('click');assert.equal(d.open,true);assert.equal(d.classList.contains('is-visible'),false);h.finish();assert.equal(d.open,false);assert.equal(h.document.activeElement,h.trigger);assert.equal(h.document.body.style.overflow,'');await h.poll();assert.equal(d.open,false);await h.poll({...notice,id:2});assert.equal(d.open,true);assert.equal(d.dataset.revision,'2');
});
test('Escape and a backdrop press use the same animated close path with reduced motion',async()=>{
 const h=harness({reduced:true});await h.settle();h.flushFrames();let prevented=false;const d=h.dialog();d.emit('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(d.open,true);assert.equal([...h.timers.values()][0].ms,200);h.finish();assert.equal(d.open,false);await h.poll({...notice,id:2});h.flushFrames();d.emit('pointerdown',{target:d.children[0]});d.emit('click');assert.equal(h.timers.size,0);d.emit('pointerdown');d.emit('click');assert.equal(d.open,true);h.finish();assert.equal(d.open,false);
});
test('an existing modal keeps focus; withdrawn notices close, and network failures preserve notices',async()=>{
 const h=harness({otherDialog:true});await h.settle();assert.equal(h.dialog(),undefined);h.otherClosed();const d=h.dialog();assert.equal(d.open,true);h.fail();await h.poll();assert.equal(d.open,true);
 const second=harness();await second.settle();await second.poll(null);assert.equal(second.dialog().open,true);second.finish();assert.equal(second.dialog().open,false);
});
