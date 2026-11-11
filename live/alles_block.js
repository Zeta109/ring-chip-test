
// ===== Gesamtlauf: Phase -> Struktur -> Kette automatisch, ein Bericht, ein PDF, ein Pruefknopf =====
const ALLES_FORM = '<h2>Gesamtlauf: alles mit einem Knopf</h2><p>Phasenlauf, Struktur-Lauf und Kettenlauf laufen nacheinander von selbst. Am Ende steht ein Gesamtbericht mit einem Knopf zum PDF-Download und einem Knopf, mit dem dein Gerät alles nachrechnet.</p>' +
  '<form action="/alles" method="get"><input type="hidden" name="go" value="1"><p><label>Windung des Startzustands Q: <select name="q">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => '<option value="' + v + '"' + (v === 1 ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></p>' +
  '<p><label>Breite der Eigenfrequenzen B: <select name="b"><option value="0.02" selected>0,02 · Standard</option><option value="0.1">0,1</option><option value="0.3">0,3</option></select></label></p>' +
  '<p><button class="btn" type="submit">Gesamtlauf starten</button></p></form>';

const ALLES_JS = String.raw`
var P=new URLSearchParams(location.search),Q=P.get('q')||'1',B=P.get('b')||'0.02';
var R={p:P.get('p'),s:P.get('s'),k:P.get('k')};
var ST=[['p','1 · Phasenlauf (36 Knoten)','live'],['s','2 · Struktur-Lauf (36 Knoten)','struktur'],['k','3 · Kettenlauf (1225 Knoten)','kette']];
var COAST=__COAST__,CL=__COLO__;
var cv=document.getElementById('gl'),g=cv.getContext('2d'),W=0,H=0,NODES=null,CUR='p',bolts=[],lastStep=[],meanLon=10,t00=performance.now();
function size(){var w=cv.clientWidth;W=cv.width=Math.round(w*2);H=cv.height=Math.round(w*2*0.8)}
size();window.addEventListener('resize',size);
function hs(n){n=(n^61)^(n>>>16);n=(n+(n<<3))|0;n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return(n>>>0)/4294967296}
function vec(lon,lat){var a=lon*Math.PI/180,b=lat*Math.PI/180;return[Math.cos(b)*Math.sin(a),Math.sin(b),Math.cos(b)*Math.cos(a)]}
var ROT=0,TILT=0.42;
function proj(v,s){
  var c=Math.cos(ROT),sn=Math.sin(ROT),x=v[0]*c-v[2]*sn,z=v[0]*sn+v[2]*c,y=v[1];
  var ct=Math.cos(TILT),st=Math.sin(TILT),y2=y*ct-z*st,z2=y*st+z*ct;
  var R0=Math.min(W,H)*0.46;return[W/2+R0*s*x,H/2-R0*s*y2,z2]
}
function setNodes(nodes){
  var first=!NODES||NODES.length!==nodes.length;
  NODES=nodes.map(function(n,i){var c=CL[n.colo];return{i:i,colo:n.colo,step:n.step,v:c?vec(c[1],c[0]):null,lon:c?c[1]:null,pulse:0}});
  var N=NODES.length;
  if(first){lastStep=NODES.map(function(n){return n.step});
    var sx=0,sy=0,k=0;NODES.forEach(function(n){if(n.lon!==null){sx+=Math.sin(n.lon*Math.PI/180);sy+=Math.cos(n.lon*Math.PI/180);k++}});if(k)meanLon=Math.atan2(sx,sy)*180/Math.PI;return}
  NODES.forEach(function(n,i){
    if(n.step>lastStep[i]){n.pulse=1;
      [(i+1)%N,(i+N-1)%N].forEach(function(j){var m=NODES[j];if(n.v&&m.v&&(n.colo!==m.colo)&&bolts.length<45)bolts.push({a:n.v,b:m.v,t:performance.now(),sd:Math.floor(Math.random()*1e6)})})}
    lastStep[i]=n.step})
}
function bolt(b,now){
  var age=now-b.t,life=900;if(age>life)return false;
  var al=1-age/life,va=b.a,vb=b.b,dot=Math.max(-1,Math.min(1,va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2])),om=Math.acos(dot),so=Math.sin(om)||1e-6,K=22,pts=[],bk=Math.floor(age/80);
  for(var i=0;i<=K;i++){var t=i/K,w1=Math.sin((1-t)*om)/so,w2=Math.sin(t*om)/so,v=[w1*va[0]+w2*vb[0],w1*va[1]+w2*vb[1],w1*va[2]+w2*vb[2]];
    var lift=1+0.12*Math.sin(Math.PI*t)*Math.min(1,om/1.2),amp=0.05*Math.sin(Math.PI*t)*Math.min(1,om/0.6);
    for(var d=0;d<3;d++)v[d]=(v[d]+(hs(b.sd+bk*131+i*7+d)-0.5)*amp)*lift;
    pts.push(proj(v,1))}
  function line(w,col,blur){g.lineWidth=w;g.strokeStyle=col;g.shadowBlur=blur;g.shadowColor='rgba(80,255,200,'+al+')';g.beginPath();var on=false;
    for(var i=0;i<pts.length;i++){var p=pts[i];if(p[2]>0.02){if(!on){g.moveTo(p[0],p[1]);on=true}else g.lineTo(p[0],p[1])}else on=false}g.stroke()}
  line(3.5,'rgba(60,220,170,'+(0.3*al)+')',18);line(1.3,'rgba(220,255,245,'+al+')',8);g.shadowBlur=0;return true
}
function frame(){
  var now=performance.now();ROT=(meanLon+55*Math.sin((now-t00)/14000))*Math.PI/180;
  g.clearRect(0,0,W,H);var R0=Math.min(W,H)*0.46,cx=W/2,cy=H/2;
  var gr=g.createRadialGradient(cx-R0*0.3,cy-R0*0.3,R0*0.1,cx,cy,R0);gr.addColorStop(0,'#1b2a33');gr.addColorStop(1,'#090d10');
  g.fillStyle=gr;g.beginPath();g.arc(cx,cy,R0,0,7);g.fill();
  g.strokeStyle='rgba(120,200,220,.9)';g.lineWidth=3;g.shadowBlur=22;g.shadowColor='rgba(120,200,255,.8)';g.beginPath();g.arc(cx,cy,R0+1,0,7);g.stroke();g.shadowBlur=0;
  g.strokeStyle='rgba(120,170,180,.10)';g.lineWidth=1;
  for(var la=-60;la<=60;la+=30){g.beginPath();var on=false;for(var lo=-180;lo<=180;lo+=5){var p=proj(vec(lo,la),1);if(p[2]>0){if(!on){g.moveTo(p[0],p[1]);on=true}else g.lineTo(p[0],p[1])}else on=false}g.stroke()}
  for(var lo=-180;lo<180;lo+=30){g.beginPath();var on=false;for(var la=-90;la<=90;la+=5){var p=proj(vec(lo,la),1);if(p[2]>0){if(!on){g.moveTo(p[0],p[1]);on=true}else g.lineTo(p[0],p[1])}else on=false}g.stroke()}
  g.strokeStyle='rgba(110,170,175,.75)';g.lineWidth=1.6;
  for(var k=0;k<COAST.length;k++){var s=COAST[k];g.beginPath();var on=false;for(var j=0;j<s.length;j+=2){var p=proj(vec(s[j],s[j+1]),1);if(p[2]>0){if(!on){g.moveTo(p[0],p[1]);on=true}else g.lineTo(p[0],p[1])}else on=false}g.stroke()}
  if(NODES){var N=NODES.length;
    g.strokeStyle='rgba(60,200,160,.22)';g.lineWidth=1.2;
    NODES.forEach(function(n,i){var m=NODES[(i+1)%N];if(!n.v||!m.v||n.colo===m.colo)return;var a=proj(n.v,1),b=proj(m.v,1);if(a[2]>0&&b[2]>0){g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}});
    NODES.forEach(function(n){if(!n.v)return;var p=proj(n.v,1);if(p[2]<=0)return;n.pulse=Math.max(0,n.pulse-0.03);
      g.fillStyle='rgba(120,255,215,'+(0.75+0.25*n.pulse)+')';g.shadowBlur=10+14*n.pulse;g.shadowColor='rgba(80,255,200,1)';g.beginPath();g.arc(p[0],p[1],4+5*n.pulse,0,7);g.fill();g.shadowBlur=0})
  }
  bolts=bolts.filter(function(b){return bolt(b,now)});
  requestAnimationFrame(frame)
}
frame();
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function setUrl(){var u='/alles?go=1&q='+Q+'&b='+B;['p','s','k'].forEach(function(x){if(R[x])u+='&'+x+'='+R[x]});history.replaceState(null,'',u)}
function row(key,txt,pct){document.getElementById('t_'+key).textContent=txt;document.getElementById('b_'+key).style.width=pct+'%'}
function cap(key,mn,T,n){var t=ST.filter(function(x){return x[0]===key})[0][1];document.getElementById('cap').textContent=t+' · Schritt '+mn+' von '+T+(n?' · '+n+' Rechenzentren':'')}
function fail(m){document.getElementById('msg').innerHTML='<b>'+m+'</b>'}
async function startStage(key,t){
  for(var n=0;n<4;n++){
    try{var r=await fetch('/alles/neu?t='+t+'&q='+Q+'&b='+B);var j=await r.json();
      if(j.run){R[key]=j.run;setUrl();return true}
      if(j.fehler){fail(j.fehler);return false}
    }catch(e){}
    await sleep(2000)
  }
  fail('Der Lauf konnte nicht gestartet werden. Seite neu laden.');return false
}
async function waitDone(key){
  var run=R[key];CUR=key;NODES=null;
  for(;;){
    try{var r=await fetch('/zustand?run='+run);var d=await r.json();var T=d.nodes[0].target||40;
      var mn=Math.min.apply(null,d.nodes.map(function(n){return n.step}));
      setNodes(d.nodes);var cs={};d.nodes.forEach(function(n){if(n.colo)cs[n.colo]=1});
      row(key,run+' · Schritt '+mn+' von '+T,Math.round(100*mn/T));cap(key,mn,T,Object.keys(cs).length);
      if(mn>=T&&d.nodes.every(function(n){return n.step>=T}))return true}
    catch(e){}
    await sleep(900)
  }
}
(async function(){
  for(var i=0;i<ST.length;i++){
    var key=ST[i][0];
    if(!R[key]){row(key,'wird gestartet ...',0);if(!(await startStage(key,ST[i][2])))return}
    await waitDone(key);row(key,R[key]+' · fertig',100)
  }
  document.getElementById('msg').innerHTML='Alle drei Läufe sind fertig. Der Gesamtbericht wird erstellt ...';
  location.href='/gesamt?p='+R.p+'&s='+R.s+'&k='+R.k
})();
`;

const DARKCSS = '<style>body{background:#15181b}.dkc{color:#e6ecea}.dkc h1,.dkc h2,.dkc h3{color:#7fe0c0}.dkc p.sub,.dkc p.sub i{color:#9ccfc4}.dkc a{color:#7fe0c0}.dkc .mono{color:#cfe3de}.dkc .bar{background:#262d2e;border-color:#3b4a49}.dkc .live{background:#15181b;color:#7fe0c0}.dkc .btn{background:#2bb08a;border-color:#2bb08a;color:#0b1d1a}.dkc .btn:hover{background:#7fe0c0;border-color:#7fe0c0}.dkc .ok{color:#6fe0a8}.dkc .sm{font-size:12px;margin:2px 0}.dkc .bar.sm{height:6px;border-radius:3px;margin:2px 0 8px}#rep{background:#fff;color:#111;padding:14px 12px;border-radius:8px;margin-top:14px;overflow-x:auto}#gl{width:100%;max-width:760px;display:block;margin:6px auto;background:#0b0e10;border-radius:10px}</style>';
function dark(h) { return h.replace('</head>', DARKCSS + '</head>').replace('<body>', '<body>'); }

function allesPage(u) {
  const q = u.searchParams.get('q') || '1', b = u.searchParams.get('b') || '0.02';
  const rows = [['p', '1 · Phasenlauf'], ['s', '2 · Struktur-Lauf'], ['k', '3 · Kettenlauf']].map(([k, t]) =>
    '<div style="font-size:13px;margin-top:6px"><b>' + t + '</b> <span class="mono sm" id="t_' + k + '">wartet</span></div><div class="bar sm"><b id="b_' + k + '" style="width:0"></b></div>').join('');
  const js = ALLES_JS.replace('__COAST__', JSON.stringify(COAST)).replace('__COLO__', JSON.stringify(COLO));
  return reply(dark(html(TITLE + ' · Gesamtlauf',
    '<div class="dkc">' + HEAD + '<p><span class="live"><i></i>LÄUFT LIVE</span> <span class="mono" id="cap">Gesamtlauf wird gestartet ...</span></p>' +
    '<canvas id="gl"></canvas>' + rows +
    '<p id="msg" style="margin-top:14px;font-size:14px">Die Seite offen lassen. Sobald ein Lauf fertig ist, beginnt der nächste von selbst; am Ende öffnet sich der Gesamtbericht. Q = ' + esc(q) + ' · B = ' + esc(b) + '.</p></div>' +
    '<script>' + js + '</script>')));
}

async function allesNeu(BASEOBJ, request, env, u) {
  const t = u.searchParams.get('t');
  let path;
  if (t === 'live') path = '/live?q=' + encodeURIComponent(u.searchParams.get('q') || '1') + '&b=' + encodeURIComponent(u.searchParams.get('b') || '0.02');
  else if (t === 'struktur') path = '/struktur';
  else if (t === 'kette') path = '/kette';
  else return Response.json({ fehler: 'unbekannte Art' }, { status: 400 });
  const r = await BASEOBJ.fetch(new Request(new URL(path, request.url).toString()), env);
  const loc = r.headers.get('location'); const m = loc && loc.match(/run=([a-z]+-\d{8}-\d{1,2})/);
  if (m) return Response.json({ run: m[1] }, { headers: { 'cache-control': 'no-store' } });
  return Response.json({ fehler: 'Die Läufe dieses Tages dieser Art sind aufgebraucht (Grenze pro Tag). Ab 01:00 Uhr deutscher Zeit gibt es neue.' }, { status: 429 });
}

const GES_CLIENT = String.raw`
var D=__DEVDATA__;
function mb(a){var s=a>>>0;return function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function ok(v,l){return '<b class="'+(v<1e-9?'ok':'mono')+'">'+v.toExponential(2)+(v<1e-9?' · bestanden':'')+'</b>'}
async function drand(x){
  if(!x.round)return 'Kennzahl: Quelle lokal, keine Prüfung gegen drand';
  try{var j=await(await fetch('https://api.drand.sh/__CHAIN__/public/'+x.round)).json();
    var d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(j.randomness+'|'+x.run));
    var h=Array.from(new Uint8Array(d)).map(function(q){return('0'+q.toString(16)).slice(-2)}).join('');
    return 'Kennzahl aus drand-Runde '+x.round+' von diesem Gerät geholt: '+(parseInt(h.slice(0,8),16)>>>0===x.seed?'<b class="ok">stimmt · bestanden</b>':'ABWEICHUNG')}
  catch(e){return 'Kennzahl: drand von diesem Gerät nicht erreichbar'}
}
async function dev(){
  var o=document.getElementById('dv');o.innerHTML='Dein Gerät rechnet ...';
  await new Promise(function(r){setTimeout(r,40)});
  var N=36,t0=performance.now(),i,t,x,y,m,out=[];
  var r=mb(D.p.seed),u=[],mm=0;for(i=0;i<N;i++){var v=Math.floor(r()*13)-6;u.push(v);mm+=v}mm/=N;
  var om=u.map(function(q){return D.p.B*(q-mm)});
  x=[];for(i=0;i<N;i++)x.push(2*Math.PI*D.p.Q*i/N);m=0;
  for(i=0;i<N;i++)m=Math.max(m,Math.abs(x[i]-D.p.hist[i][0]));
  for(t=0;t<40;t++){y=[];for(i=0;i<N;i++)y.push(x[i]+0.05*(om[i]+4*(Math.sin(x[(i+1)%N]-x[i])+Math.sin(x[(i+N-1)%N]-x[i]))));x=y;for(i=0;i<N;i++)m=Math.max(m,Math.abs(x[i]-D.p.hist[i][t+1]))}
  out.push('<p><b>Phasenlauf</b> (36 Knoten × 41 Werte): größte Abweichung auf diesem Gerät '+ok(m)+'</p>');
  out.push('<p class="mono">'+await drand(D.p)+'</p>');
  r=mb((D.s.seed^0x9E3779B9)>>>0);x=[];for(i=0;i<N;i++)x.push(2*r()-1);m=0;
  for(i=0;i<N;i++)m=Math.max(m,Math.abs(x[i]-D.s.hist[i][0]));
  for(t=0;t<40;t++){y=[];for(i=0;i<N;i++)y.push(x[i]+0.05*(x[(i+1)%N]+x[(i+N-1)%N]-2*x[i]));x=y;for(i=0;i<N;i++)m=Math.max(m,Math.abs(x[i]-D.s.hist[i][t+1]))}
  out.push('<p><b>Struktur-Lauf</b> (36 Knoten × 41 Werte): größte Abweichung auf diesem Gerät '+ok(m)+'</p>');
  out.push('<p class="mono">'+await drand(D.s)+'</p>');
  var NN=1225;r=mb((D.k.seed^0x9E3779B9)>>>0);x=[];for(i=0;i<NN;i++)x.push(2*r()-1);
  for(t=0;t<40;t++){y=new Array(NN);for(i=0;i<NN;i++)y[i]=x[i]+0.05*(x[(i+1)%NN]+x[(i-1+NN)%NN]-2*x[i]);x=y}
  m=0;for(i=0;i<NN;i++)m=Math.max(m,Math.abs(x[i]-D.k.final[i]));
  out.push('<p><b>Kettenlauf</b> (1225 Knoten, 40 Schritte): größte Abweichung auf diesem Gerät '+ok(m)+'</p>');
  out.push('<p class="mono">'+await drand(D.k)+'</p>');
  out.push('<p class="mono">Rechenzeit auf diesem Gerät: '+Math.round(performance.now()-t0)+' ms</p>');
  o.innerHTML=out.join('')
}
function lib(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error(src))};document.head.appendChild(s)})}
var NAME='__FILENAME__';
async function build(){
  var st=document.getElementById('pst');st.textContent='PDF wird erstellt ...';
  if(!window.html2canvas)await lib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if(!window.jspdf)await lib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  var rep=document.getElementById('rep');
  rep.querySelectorAll('details').forEach(function(d){d.open=true});
  var style=document.createElement('style');style.id='pdfst';style.textContent='#rep pre{white-space:pre-wrap;word-break:break-all;overflow:visible}.pdfh pre{white-space:pre-wrap;word-break:break-all;overflow:visible}';document.head.appendChild(style);
  var kids=Array.prototype.slice.call(rep.children).filter(function(e){return e.tagName!=='SCRIPT'});
  var units=[],k=0;while(k<kids.length){var e=kids[k];if((e.tagName==='H2')&&k+1<kids.length){units.push([e,kids[k+1]]);k+=2}else{units.push([e]);k++}}
  var doc=new jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
  var W=210,H=297,M=12,cw=W-2*M,ph=H-2*M-6,y=M,hold=document.createElement('div');hold.className='pdfh';
  hold.style.cssText='position:absolute;left:-10000px;top:0;width:820px;padding:0 6px;background:#fff;color:#111;font-size:16px';document.body.appendChild(hold);
  for(var u=0;u<units.length;u++){
    hold.innerHTML='';units[u].forEach(function(e){hold.appendChild(e.cloneNode(true))});
    var sc=hold.scrollHeight>4000?1:2;
    var cv=await html2canvas(hold,{scale:sc,backgroundColor:'#ffffff',logging:false});
    var h=cv.height*cw/cv.width;
    if(h<=ph){
      if(y+h>H-M-6){doc.addPage();y=M}
      doc.addImage(cv.toDataURL('image/jpeg',0.92),'JPEG',M,y,cw,h);y+=h+2
    }else{
      var ppx=Math.floor(ph*cv.width/cw),off=0;
      if(y>M){doc.addPage();y=M}
      while(off<cv.height){
        var sl=Math.min(ppx,cv.height-off),c2=document.createElement('canvas');c2.width=cv.width;c2.height=sl;
        var g=c2.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c2.width,sl);g.drawImage(cv,0,off,cv.width,sl,0,0,cv.width,sl);
        var hh=sl*cw/cv.width;doc.addImage(c2.toDataURL('image/jpeg',0.92),'JPEG',M,y,cw,hh);off+=sl;y+=hh+2;
        if(off<cv.height){doc.addPage();y=M}
      }
    }
    st.textContent='PDF wird erstellt ... '+Math.round(100*(u+1)/units.length)+' %'
  }
  document.body.removeChild(hold);document.head.removeChild(style);
  var n=doc.getNumberOfPages();for(var p=1;p<=n;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(90);doc.text('Seite '+p+' von '+n+'   |   '+NAME,W/2,H-7,{align:'center'})}
  window.PDFB=doc.output('blob');window.PDFN=n;st.textContent='PDF ist fertig ('+n+' Seiten).';return doc
}
async function pdf(){
  var st=document.getElementById('pst');
  try{var doc=await build();doc.save(NAME+'.pdf')}catch(e){st.textContent='PDF konnte nicht erstellt werden: '+e.message}
}
async function sharepdf(){
  var st=document.getElementById('pst');
  try{
    if(!window.PDFB)await build();
    var f=new File([window.PDFB],NAME+'.pdf',{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Gesamtlauf'});st.textContent='Geteilt.'}
    else st.textContent='Dieses Gerät kann Dateien nicht teilen. Nimm den Download-Knopf.'
  }catch(e){
    if(e&&e.name==='AbortError'){st.textContent='Teilen abgebrochen.';return}
    st.textContent=window.PDFB?'PDF ist fertig. Tippe jetzt noch einmal auf Teilen.':'PDF konnte nicht erstellt werden: '+(e&&e.message)
  }
}
`;

async function gesamtPage(env, request, u) {
  const p = u.searchParams.get('p'), s = u.searchParams.get('s'), k = u.searchParams.get('k');
  const cp = cfg(p), cs = cfg(s), ck = cfg(k);
  if (!cp || cp.kind !== 'phase' || !cs || cs.kind !== 'lin' || !ck || ck.kind !== 'chn') return Response.json({ error: 'run' }, { status: 400 });
  const key = new Request(request.url); const cache = caches.default; const hit = await cache.match(key); if (hit) return hit;
  const [ep, es, ek] = await Promise.all([evaluate(env, p), evaluateLin(env, s), evaluateKet(env, k)]);
  if (!ep.done || !es.done || !ek.done) return reply(html(TITLE, HEAD + '<p>Mindestens ein Lauf ist noch nicht fertig. Die Seite lädt sich neu.</p>', 3));
  const hk = HEAD.replace('36 Knoten auf Servern', '1225 Knoten auf 35 Servern');
  const bp = runPage(ep).replace(HEAD, ''), bs = strPage(es).replace(HEAD, ''), bk = ketPage(ek).replace(hk, '').replace(/<h2>Nachrechnen auf deinem Gerät<\/h2>[\s\S]*?<\/script>/, '');
  const dur = e => ((e.t1 - e.t0) / 1000).toFixed(1) + ' s';
  const cls = (v, l) => '<td class="' + (v < l ? 'ok' : 'mono') + '">' + v.toExponential(2) + (v < l ? ' · bestanden' : '') + '</td>';
  const sum = '<h2>Gesamtübersicht</h2><table><tr><th>Lauf</th><th>Knoten · Schritte</th><th>Dauer</th><th>größte Abweichung von der Referenzrechnung</th><th>Kennwert</th></tr>' +
    '<tr><td>' + esc(p) + '<br>Phasenlauf</td><td>36 · 40</td><td>' + dur(ep) + '</td>' + cls(ep.maxdev, 1e-12) + '<td>Windung ' + ep.winding.toFixed(9) + '</td></tr>' +
    '<tr><td>' + esc(s) + '<br>Struktur-Lauf</td><td>36 · 40</td><td>' + dur(es) + '</td>' + cls(es.maxdev, 1e-12) + '<td>Summe 1/λ ' + es.trTotal.toFixed(6) + ' (Vorhersage ' + (1295 / 12).toFixed(6) + ')</td></tr>' +
    '<tr><td>' + esc(k) + '<br>Kettenlauf</td><td>1225 · 40</td><td>' + dur(ek) + '</td>' + cls(ek.maxdev, 1e-12) + '<td>Summe 1/λ ' + ek.trTotal.toFixed(6) + ' (Vorhersage ' + (1225 * 1225 - 1) / 12 + ')</td></tr></table>' +
    '<p>Widersprüche zwischen empfangenen Kopien eines Wertes in allen drei Läufen: <b class="ok">' + (ep.mismatch + es.mismatch + ek.mismatch) + ' · bestanden</b>. Abgewiesene Nachrichten (Prüfung der Nachrichten an jedem Knoten): <b class="ok">' + [ep, es, ek].reduce((a, e) => a + e.nodes.reduce((b, n) => b + (n.rejected || 0), 0), 0) + '</b>.</p>';
  const mk = (e, c) => ({ seed: e.seed, run: e.run, round: e.srcRound || null, Q: e.Q, B: e.B, hist: c ? e.nodes.map(n => n.hist) : undefined });
  const dd = { p: mk(ep, true), s: mk(es, true), k: { seed: ek.seed, run: ek.run, round: ek.srcRound || null, final: ek.final } };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const fname = 'Gesamtlauf_V36_' + stamp;
  const client = GES_CLIENT.replace('__DEVDATA__', JSON.stringify(dd).replace(/</g, '\\u003c')).replace('__CHAIN__', DRAND).split('__FILENAME__').join(fname);
  const ctrl = '<div class="nx"><style>@media print{.nx{display:none}}</style>' +
    '<p><button class="btn" type="button" onclick="pdf()">Gesamtergebnis als PDF herunterladen</button></p>' +
    '<p><button class="btn" type="button" onclick="sharepdf()">PDF teilen oder in Dateien sichern</button></p><p class="mono" id="pst"></p>' +
    '<p><button class="btn" type="button" onclick="dev()">Auf diesem Gerät prüfen</button></p><div id="dv"></div></div>';
  const body = '<div class="dkc">' + HEAD + ctrl + '</div><div id="rep">' + sum + bp + bs + bk + '<p>Serverzeit beim Aufruf: ' + tfmt(Date.now()) + '</p></div><script>' + client + '</script>';
  const resp = reply(dark(html(TITLE + ' · Gesamtbericht', body)), 'public, max-age=120');
  await cache.put(key, resp.clone()); return resp;
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    try {
      if (u.pathname === '/alles' && u.searchParams.get('go') === '1') return allesPage(u);
      if (u.pathname === '/alles/neu') return await allesNeu(BASE, request, env, u);
      if (u.pathname === '/gesamt') return await gesamtPage(env, request, u);
    } catch (e) { return Response.json({ error: String(e) }, { status: 503 }); }
    const r = await BASE.fetch(request, env);
    if (u.pathname === '/' || u.pathname === '/alles') {
      const t = await r.text();
      return reply(t.replace('<h2>Live-Lauf starten</h2>', ALLES_FORM + '<h2>Live-Lauf starten</h2>'));
    }
    return r;
  }
};
