import fs from 'node:fs'; import {createHash} from 'node:crypto';
const N=36;
const cfg=JSON.parse(fs.readFileSync(process.argv[2]||'steps.json','utf8'));
const S=cfg; // steps per run
const RUNS={
 phase:{kind:'phase',steps:S.phase,K:4,DT:0.05,B:0.02,Q:1,title:'Phasenlauf mit Sinus, K = 4, Windung 1, 36 Knoten, '+S.phase+' Schritte'},
 k2:{kind:'phase',steps:S.k2,K:2,DT:0.05,B:0.02,Q:1,title:'Phasenlauf mit Sinus, K = 2, Windung 1, 36 Knoten, '+S.k2+' Schritte'},
 k8:{kind:'phase',steps:S.k8,K:8,DT:0.05,B:0.02,Q:1,title:'Phasenlauf mit Sinus, K = 8, Windung 1, 36 Knoten, '+S.k8+' Schritte'},
 q3:{kind:'phase',steps:S.q3,K:4,DT:0.05,B:0.02,Q:3,title:'Phasenlauf mit Sinus, K = 4, Windung 3, 36 Knoten, '+S.q3+' Schritte'},
 eps:{kind:'diff',steps:S.eps,eps:0.496,title:'Lauf nahe der Grenze, ε = 0,496, 36 Knoten, '+S.eps+' Schritte'},
 fault:{kind:'diff',steps:S.fault,eps:0.25,crashNode:17,crashStep:S.crash,title:'Störlauf: Ausfall und Wiederherstellung von Knoten 17 bei Schritt '+S.crash+', 36 Knoten, '+S.fault+' Schritte'}
};
const h=b=>createHash('sha256').update(b).digest('hex');
const pack=rows=>{const n=rows.reduce((a,r)=>a+r.length,0),b=Buffer.alloc(8*n);let k=0;for(const r of rows)for(const x of r){b.writeDoubleLE(x,8*k++)}return b};
const omega=(i,c)=>{let m=0;for(let j=0;j<N;j++)m+=(7*j)%13;m/=N;return c.B*(((7*i)%13)-m)};
const x0=(i,c)=>c.kind==='phase'?2*Math.PI*c.Q*i/N:((7*i)%13)/13;
const nextX=(i,x,R,L,c)=>c.kind==='phase'?x+c.DT*(omega(i,c)+c.K*(Math.sin(R-x)+Math.sin(L-x))):x+c.eps*(R+L-2*x);
const wrap=d=>d-2*Math.PI*Math.round(d/(2*Math.PI));
const SEAL={};
for(const [k,c] of Object.entries(RUNS)){
  let x=Array.from({length:N},(_,i)=>x0(i,c));const H=[x];
  for(let s=0;s<c.steps;s++){const y=x;x=y.map((v,i)=>nextX(i,v,y[(i+1)%N],y[(i+N-1)%N],c));H.push(x)}
  const e={all:h(pack(H)),final:h(pack([x]))};
  if(c.kind==='phase'){
    e.ref_final=x; let mn=9,mx=-9;for(let i=0;i<N;i++){const d=wrap(x[(i+1)%N]-x[i]);mn=Math.min(mn,d);mx=Math.max(mx,d)}
    e.band=(k==='phase')?[0.13,0.21]:[Math.floor((mn-0.01)*1000)/1000,Math.ceil((mx+0.01)*1000)/1000]; e.ref_nb=[mn,mx];
    // Windung des Referenzlaufs
    let wm=0;for(const r of H){let s=0;for(let i=0;i<N;i++)s+=wrap(r[(i+1)%N]-r[i]);wm=Math.max(wm,Math.abs(s/(2*Math.PI)-c.Q))}e.ref_wind_dev=wm;
  }
  SEAL[k]=e;
}
let t=fs.readFileSync('template.js','utf8'),pg=fs.readFileSync('page.js','utf8');
fs.writeFileSync('page.txt',pg);t=t.replace('__RUNS__',()=>JSON.stringify(RUNS)).replace('__SEAL__',()=>JSON.stringify(SEAL));
fs.writeFileSync('worker.js',t);
fs.writeFileSync('seal.json',JSON.stringify({RUNS,SEAL},null,1));
console.log(Object.entries(SEAL).map(([k,v])=>k+' '+v.all.slice(0,12)+' '+v.final.slice(0,12)+(v.band?' band '+v.band:'')+(v.ref_wind_dev!==undefined?' wdev '+v.ref_wind_dev:'')).join('\n'));
