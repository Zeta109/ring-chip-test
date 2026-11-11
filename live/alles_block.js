
// ===== Gesamtlauf: Phase -> Struktur -> Kette automatisch, ein Bericht, ein PDF, ein Pruefknopf =====
const DCC = {
  US: ['Vereinigte Staaten', 'United States'], CA: ['Kanada', 'Canada'], MX: ['Mexiko', 'México'], GB: ['Vereinigtes Königreich', 'United Kingdom'], IE: ['Irland', 'Éire'],
  FR: ['Frankreich', 'France'], DE: ['Deutschland', 'Deutschland'], NL: ['Niederlande', 'Nederland'], BE: ['Belgien', 'België'], LU: ['Luxemburg', 'Lëtzebuerg'],
  CH: ['Schweiz', 'Schweiz'], AT: ['Österreich', 'Österreich'], IT: ['Italien', 'Italia'], ES: ['Spanien', 'España'], PT: ['Portugal', 'Portugal'],
  DK: ['Dänemark', 'Danmark'], SE: ['Schweden', 'Sverige'], NO: ['Norwegen', 'Norge'], FI: ['Finnland', 'Suomi'], IS: ['Island', 'Ísland'],
  EE: ['Estland', 'Eesti'], LV: ['Lettland', 'Latvija'], LT: ['Litauen', 'Lietuva'], PL: ['Polen', 'Polska'], CZ: ['Tschechien', 'Česko'],
  HU: ['Ungarn', 'Magyarország'], RO: ['Rumänien', 'România'], BG: ['Bulgarien', 'България'], RS: ['Serbien', 'Србија'], HR: ['Kroatien', 'Hrvatska'],
  GR: ['Griechenland', 'Ελλάδα'], CY: ['Zypern', 'Κύπρος'], UA: ['Ukraine', 'Україна'], RU: ['Russland', 'Россия'], TR: ['Türkei', 'Türkiye'],
  IL: ['Israel', 'ישראל'], JO: ['Jordanien', 'الأردن'], SA: ['Saudi-Arabien', 'السعودية'], AE: ['Vereinigte Arabische Emirate', 'الإمارات'], QA: ['Katar', 'قطر'],
  KW: ['Kuwait', 'الكويت'], BH: ['Bahrain', 'البحرين'], OM: ['Oman', 'عُمان'], EG: ['Ägypten', 'مصر'], DZ: ['Algerien', 'الجزائر'],
  MA: ['Marokko', 'المغرب'], TN: ['Tunesien', 'تونس'], NG: ['Nigeria', 'Nigeria'], GH: ['Ghana', 'Ghana'], KE: ['Kenia', 'Kenya'],
  TZ: ['Tansania', 'Tanzania'], UG: ['Uganda', 'Uganda'], RW: ['Ruanda', 'Rwanda'], AO: ['Angola', 'Angola'], ZM: ['Sambia', 'Zambia'],
  MZ: ['Mosambik', 'Moçambique'], ZA: ['Südafrika', 'South Africa'], DJ: ['Dschibuti', 'Djibouti'], MG: ['Madagaskar', 'Madagasikara'], MU: ['Mauritius', 'Maurice'],
  RE: ['Réunion', 'La Réunion'], IN: ['Indien', 'भारत'], PK: ['Pakistan', 'پاکستان'], BD: ['Bangladesch', 'বাংলাদেশ'], NP: ['Nepal', 'नेपाल'],
  LK: ['Sri Lanka', 'ශ්‍රී ලංකාව'], MV: ['Malediven', 'ދިވެހިރާއްޖެ'], MM: ['Myanmar', 'မြန်မာ'], TH: ['Thailand', 'ประเทศไทย'], VN: ['Vietnam', 'Việt Nam'],
  MY: ['Malaysia', 'Malaysia'], SG: ['Singapur', 'Singapore'], ID: ['Indonesien', 'Indonesia'], PH: ['Philippinen', 'Pilipinas'], CN: ['China', '中国'],
  HK: ['Hongkong', '香港'], TW: ['Taiwan', '臺灣'], JP: ['Japan', '日本'], KR: ['Südkorea', '대한민국'], GU: ['Guam', 'Guåhan'],
  AU: ['Australien', 'Australia'], NZ: ['Neuseeland', 'New Zealand'], NC: ['Neukaledonien', 'Nouvelle-Calédonie'], PF: ['Französisch-Polynesien', 'Polynésie française'],
  BR: ['Brasilien', 'Brasil'], AR: ['Argentinien', 'Argentina'], CL: ['Chile', 'Chile'], CO: ['Kolumbien', 'Colombia'], PE: ['Peru', 'Perú'],
  EC: ['Ecuador', 'Ecuador'], UY: ['Uruguay', 'Uruguay'], PY: ['Paraguay', 'Paraguay'], BO: ['Bolivien', 'Bolivia'], VE: ['Venezuela', 'Venezuela'],
  PA: ['Panama', 'Panamá'], CR: ['Costa Rica', 'Costa Rica'], GT: ['Guatemala', 'Guatemala'], PR: ['Puerto Rico', 'Puerto Rico'], CW: ['Curaçao', 'Curaçao'],
  JM: ['Jamaika', 'Jamaica'], SR: ['Suriname', 'Suriname']
};
const DCRAW = 'ABQ:US:Albuquerque|ACC:GH:Accra|ADL:AU:Adelaide|AKL:NZ:Auckland|ALG:DZ:الجزائر|AMD:IN:અમદાવાદ|AMM:JO:عمّان|AMS:NL:Amsterdam|ANC:US:Anchorage|ARN:SE:Stockholm|ASU:PY:Asunción|ATH:GR:Αθήνα|ATL:US:Atlanta|BAH:BH:المنامة|BCN:ES:Barcelona|BEG:RS:Београд|BER:DE:Berlin|BKK:TH:กรุงเทพมหานคร|BLR:IN:ಬೆಂಗಳೂರು|BNA:US:Nashville|BNE:AU:Brisbane|BOG:CO:Bogotá|BOM:IN:मुंबई|BOS:US:Boston|BRU:BE:Bruxelles|BSB:BR:Brasília|BUD:HU:Budapest|BUF:US:Buffalo|BWI:US:Baltimore|CAI:EG:القاهرة|CAN:CN:广州|CBR:AU:Canberra|CCS:VE:Caracas|CCU:IN:কলকাতা|CDG:FR:Paris|CEB:PH:Cebu|CGK:ID:Jakarta|CLT:US:Charlotte|CMB:LK:කොළඹ|CMH:US:Columbus|CMN:MA:الدار البيضاء|CNF:BR:Belo Horizonte|CNX:TH:เชียงใหม่|CPH:DK:København|CPT:ZA:Cape Town|CUR:CW:Willemstad|CWB:BR:Curitiba|DAC:BD:ঢাকা|DAR:TZ:Dar es Salaam|DEL:IN:दिल्ली|DEN:US:Denver|DFW:US:Dallas|DJI:DJ:Djibouti|DME:RU:Москва|DOH:QA:الدوحة|DTW:US:Detroit|DUB:IE:Baile Átha Cliath|DUS:DE:Düsseldorf|DXB:AE:دبي|EBB:UG:Entebbe|EWR:US:Newark|EZE:AR:Buenos Aires|FCO:IT:Roma|FOR:BR:Fortaleza|FRA:DE:Frankfurt am Main|FUK:JP:福岡|GDL:MX:Guadalajara|GIG:BR:Rio de Janeiro|GRU:BR:São Paulo|GUA:GT:Ciudad de Guatemala|GUM:GU:Hagåtña|GVA:CH:Genève|GYE:EC:Guayaquil|HAM:DE:Hamburg|HAN:VN:Hà Nội|HEL:FI:Helsinki|HKG:HK:香港|HND:JP:東京|HNL:US:Honolulu|HYD:IN:హైదరాబాద్|IAD:US:Ashburn|IAH:US:Houston|ICN:KR:인천|IND:US:Indianapolis|IST:TR:İstanbul|JAX:US:Jacksonville|JED:SA:جدة|JNB:ZA:Johannesburg|KBP:UA:Київ|KEF:IS:Reykjavík|KGL:RW:Kigali|KHI:PK:کراچی|KIN:JM:Kingston|KIX:JP:大阪|KTM:NP:काठमाडौं|KUL:MY:Kuala Lumpur|KWI:KW:الكويت|LAD:AO:Luanda|LAS:US:Las Vegas|LAX:US:Los Angeles|LCA:CY:Λάρνακα|LED:RU:Санкт-Петербург|LHE:PK:لاہور|LHR:GB:London|LIM:PE:Lima|LIS:PT:Lisboa|LOS:NG:Lagos|LPB:BO:La Paz|LUN:ZM:Lusaka|LUX:LU:Lëtzebuerg|LYS:FR:Lyon|MAA:IN:சென்னை|MAD:ES:Madrid|MAN:GB:Manchester|MBA:KE:Mombasa|MCI:US:Kansas City|MCT:OM:مسقط|MEL:AU:Melbourne|MEM:US:Memphis|MEX:MX:Ciudad de México|MIA:US:Miami|MLE:MV:މާލެ|MNL:PH:Maynila|MPM:MZ:Maputo|MRS:FR:Marseille|MRU:MU:Port-Louis|MSP:US:Minneapolis|MSY:US:New Orleans|MTY:MX:Monterrey|MUC:DE:München|MVD:UY:Montevideo|MXP:IT:Milano|NBO:KE:Nairobi|NOU:NC:Nouméa|NRT:JP:成田|OKA:JP:那覇|OKC:US:Oklahoma City|OMA:US:Omaha|ORD:US:Chicago|ORF:US:Norfolk|OSL:NO:Oslo|OTP:RO:București|PBM:SR:Paramaribo|PDX:US:Portland|PEK:CN:北京|PER:AU:Perth|PHL:US:Philadelphia|PHX:US:Phoenix|PIT:US:Pittsburgh|PMO:IT:Palermo|POA:BR:Porto Alegre|PPT:PF:Papeete|PRG:CZ:Praha|PTY:PA:Ciudad de Panamá|PVG:CN:上海|QRO:MX:Querétaro|REC:BR:Recife|RGN:MM:ရန်ကုန်|RIC:US:Richmond|RIX:LV:Rīga|RUH:SA:الرياض|RUN:RE:Saint-Denis|SAN:US:San Diego|SCL:CL:Santiago|SEA:US:Seattle|SFO:US:San Francisco|SGN:VN:Thành phố Hồ Chí Minh|SIN:SG:Singapore|SJC:US:San José|SJO:CR:San José|SJU:PR:San Juan|SLC:US:Salt Lake City|SMF:US:Sacramento|SOF:BG:София|SSA:BR:Salvador|STL:US:St. Louis|SYD:AU:Sydney|SZX:CN:深圳|TLL:EE:Tallinn|TLV:IL:תל אביב|TNR:MG:Antananarivo|TPA:US:Tampa|TPE:TW:臺北|TUL:US:Tulsa|TUN:TN:تونس|TXL:DE:Berlin|UIO:EC:Quito|VIE:AT:Wien|VNO:LT:Vilnius|WAW:PL:Warszawa|YEG:CA:Edmonton|YOW:CA:Ottawa|YUL:CA:Montréal|YVR:CA:Vancouver|YWG:CA:Winnipeg|YYC:CA:Calgary|YYZ:CA:Toronto|ZAG:HR:Zagreb|ZRH:CH:Zürich';
const DCI = {}; DCRAW.split('|').forEach(s => { const p = s.split(':'); DCI[p[0]] = [DCC[p[1]][0], DCC[p[1]][1], p[2]]; });

const ALLES_FORM = '<h2>Gesamtlauf: alles mit einem Knopf</h2><p>Phasenlauf, Struktur-Lauf und Kettenlauf laufen nacheinander von selbst. Am Ende steht ein Gesamtbericht mit einem Knopf zum PDF-Download und einem Knopf, mit dem dein Gerät alles nachrechnet.</p>' +
  '<form action="/alles" method="get"><input type="hidden" name="go" value="1"><p><label>Windung des Startzustands Q: <select name="q">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => '<option value="' + v + '"' + (v === 1 ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></p>' +
  '<p><label>Breite der Eigenfrequenzen B: <select name="b"><option value="0.02" selected>0,02 · Standard</option><option value="0.1">0,1</option><option value="0.3">0,3</option></select></label></p>' +
  '<p><button class="btn" type="submit">Gesamtlauf starten</button></p></form>';

const GLOBE_JS = String.raw`
var COAST=__COAST__,CL=__COLO__,DC=__DC__;
var cv=document.getElementById('gl'),g=cv.getContext('2d'),W=0,H=0,NODES=null,bolts=[],meanLon=10,t00=performance.now(),queue=0,lastMn=null,nextWave=0,IDLE=false,nextIdle=0;
function E(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
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
function mkNode(colo,step){var c=CL[colo];return{colo:colo,step:step,v:c?vec(c[1],c[0]):null,lon:c?c[1]:null,pulse:0}}
function setNodes(nodes){
  var mn=Math.min.apply(null,nodes.map(function(n){return n.step}));
  var first=!NODES||NODES.length!==nodes.length;
  NODES=nodes.map(function(n){return mkNode(n.colo,n.step)});
  if(first){lastMn=mn;queue=0;
    var sx=0,sy=0,k=0;NODES.forEach(function(n){if(n.lon!==null){sx+=Math.sin(n.lon*Math.PI/180);sy+=Math.cos(n.lon*Math.PI/180);k++}});if(k)meanLon=Math.atan2(sx,sy)*180/Math.PI;return}
  if(mn>lastMn){queue+=mn-lastMn;lastMn=mn}
}
function fire(list){
  var N=list.length,now=performance.now();
  list.forEach(function(n){n.pulse=1});
  for(var i=0;i<N;i++){var a=list[i],b=list[(i+1)%N];
    if(a.v&&b.v&&a.colo!==b.colo&&bolts.length<110)bolts.push({a:a.v,b:b.v,t:now,sd:Math.floor(Math.random()*1e6)})}
}
function bolt(b,now){
  var age=now-b.t,life=800;if(age>life)return false;
  var al=1-age/life,va=b.a,vb=b.b,dot=Math.max(-1,Math.min(1,va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2])),om=Math.acos(dot),so=Math.sin(om)||1e-6,K=22,pts=[],bk=Math.floor(age/80);
  for(var i=0;i<=K;i++){var t=i/K,w1=Math.sin((1-t)*om)/so,w2=Math.sin(t*om)/so,v=[w1*va[0]+w2*vb[0],w1*va[1]+w2*vb[1],w1*va[2]+w2*vb[2]];
    var lift=1+0.12*Math.sin(Math.PI*t)*Math.min(1,om/1.2),amp=0.05*Math.sin(Math.PI*t)*Math.min(1,om/0.6);
    for(var d=0;d<3;d++)v[d]=(v[d]+(hs(b.sd+bk*131+i*7+d)-0.5)*amp)*lift;
    pts.push(proj(v,1))}
  function line(w,col,blur){g.lineWidth=w;g.strokeStyle=col;g.shadowBlur=blur;g.shadowColor='rgba(80,255,200,'+al+')';g.beginPath();var on=false;
    for(var i=0;i<pts.length;i++){var p=pts[i];if(p[2]>0.02){if(!on){g.moveTo(p[0],p[1]);on=true}else g.lineTo(p[0],p[1])}else on=false}g.stroke()}
  line(3.5,'rgba(60,220,170,'+(0.3*al)+')',18);line(1.3,'rgba(220,255,245,'+al+')',8);g.shadowBlur=0;return true
}
function labels(){
  var seen={},L=[];NODES.forEach(function(n){if(!n.v||!DC[n.colo])return;var key=DC[n.colo][1];if(seen[key])return;var p=proj(n.v,1);if(p[2]>0.2){seen[key]=1;L.push([p,key])}});
  L.sort(function(a,b){return b[0][2]-a[0][2]});
  var boxes=[];g.font='bold 22px sans-serif';g.textBaseline='middle';
  L.forEach(function(e){var t=e[1],w=g.measureText(t).width,x=e[0][0]+11,y=e[0][1]-2;if(x+w>W-6)x=e[0][0]-11-w;
    var b=[x-3,y-14,x+w+3,y+14];if(boxes.some(function(o){return!(b[2]<o[0]||b[0]>o[2]||b[3]<o[1]||b[1]>o[3])}))return;boxes.push(b);
    g.lineWidth=5;g.strokeStyle='rgba(8,12,14,.9)';g.strokeText(t,x,y);g.fillStyle='#bff5e4';g.fillText(t,x,y)})
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
  if(IDLE){
    g.fillStyle='rgba(120,255,215,.35)';Object.keys(CL).forEach(function(c){var p=proj(vec(CL[c][1],CL[c][0]),1);if(p[2]>0){g.beginPath();g.arc(p[0],p[1],2.6,0,7);g.fill()}});
    if(now>=nextIdle){var ks=Object.keys(CL),pick=[];while(pick.length<14){var c=ks[Math.floor(Math.random()*ks.length)];if(pick.indexOf(c)<0)pick.push(c)}
      pick.sort(function(a,b){return CL[a][1]-CL[b][1]});fire(pick.map(function(c){return mkNode(c,0)}));nextIdle=now+3200}
  }else if(NODES){var N=NODES.length;
    if(queue>0&&now>=nextWave){fire(NODES);queue--;nextWave=now+(queue>5?150:320)}
    g.strokeStyle='rgba(60,200,160,.22)';g.lineWidth=1.2;
    NODES.forEach(function(n,i){var m=NODES[(i+1)%N];if(!n.v||!m.v||n.colo===m.colo)return;var a=proj(n.v,1),b=proj(m.v,1);if(a[2]>0&&b[2]>0){g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}});
    NODES.forEach(function(n){if(!n.v)return;var p=proj(n.v,1);if(p[2]<=0)return;n.pulse=Math.max(0,n.pulse-0.03);
      g.fillStyle='rgba(120,255,215,'+(0.75+0.25*n.pulse)+')';g.shadowBlur=10+14*n.pulse;g.shadowColor='rgba(80,255,200,1)';g.beginPath();g.arc(p[0],p[1],4+5*n.pulse,0,7);g.fill();g.shadowBlur=0});
    labels()
  }
  bolts=bolts.filter(function(b){return bolt(b,now)});
  requestAnimationFrame(frame)
}
frame();
`;

const ALLES_JS = String.raw`
var P=new URLSearchParams(location.search),Q=P.get('q')||'1',B=P.get('b')||'0.02';
var R={p:P.get('p'),s:P.get('s'),k:P.get('k')};
var ST=[['p','1 · Phasenlauf (36 Knoten)','live'],['s','2 · Struktur-Lauf (36 Knoten)','struktur'],['k','3 · Kettenlauf (1225 Knoten)','kette']];
var LEG={},legN=0;
function leg(cols){cols.forEach(function(c){if(DC[c])LEG[c]=1});var ks=Object.keys(LEG);if(ks.length===legN)return;legN=ks.length;
  ks.sort(function(a,b){return(DC[a][0]+a).localeCompare(DC[b][0]+b,'de')});
  document.getElementById('leg').innerHTML=ks.map(function(c){var d=DC[c];return'<div><b>'+c+'</b> '+E(d[0])+(d[1]!==d[0]?' · '+E(d[1]):'')+' · '+E(d[2])+'</div>'}).join('')}
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
  var run=R[key];NODES=null;queue=0;
  for(;;){
    try{var r=await fetch('/zustand?run='+run);var d=await r.json();var T=d.nodes[0].target||40;
      var mn=Math.min.apply(null,d.nodes.map(function(n){return n.step}));
      setNodes(d.nodes);var cs={};d.nodes.forEach(function(n){if(n.colo)cs[n.colo]=1});leg(Object.keys(cs));
      row(key,run+' · Schritt '+mn+' von '+T,Math.round(100*mn/T));cap(key,mn,T,Object.keys(cs).length);
      if(mn>=T&&d.nodes.every(function(n){return n.step>=T})){while(queue>0)await sleep(200);return true}}
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

const DARKCSS = '<style>html{background:#15181b}body{background:#15181b}.dkc{color:#e6ecea}.dkc h1,.dkc h2,.dkc h3{color:#7fe0c0}.dkc p.sub,.dkc p.sub i{color:#9ccfc4}.dkc a{color:#7fe0c0}.dkc .mono{color:#cfe3de}.dkc .bar{background:#262d2e;border-color:#3b4a49}.dkc .live{background:#15181b;color:#7fe0c0}.dkc .btn{background:#2bb08a;border-color:#2bb08a;color:#0b1d1a}.dkc .btn:hover{background:#7fe0c0;border-color:#7fe0c0}.dkc .ok{color:#6fe0a8}.dkc .sm{font-size:12px;margin:2px 0}.dkc .bar.sm{height:6px;border-radius:3px;margin:2px 0 8px}' +
  '.dkc th{background:#17302f;color:#7fe0c0;border-color:#2c4a49}.dkc td{border-color:#2c4a49}.dkc tr:nth-child(even) td{background:#1a2224}.dkc pre{background:#0f1517;border-color:#2c4a49;color:#cfe3de}.dkc summary{color:#7fe0c0}.dkc select{background:#1d2427;color:#e6ecea;border:1px solid #3b4a49;border-radius:4px;padding:3px}' +
  '.leg{display:grid;grid-template-columns:1fr 1fr;gap:1px 14px;font-size:11.5px;color:#b9d3cd;margin:6px 0 10px}.leg b{color:#7fe0c0}@media(max-width:520px){.leg{grid-template-columns:1fr}}' +
  '#gl{width:100%;max-width:760px;display:block;margin:6px auto;background:#0b0e10;border-radius:10px}</style>';
const RESCSS = '<style>html{background:#0a1a1d}body{background:linear-gradient(165deg,#0f3036 0%,#0b1c20 55%,#0a1316 100%) fixed}' +
  '#rep{background:rgba(9,22,25,.82);color:#dfeae8;padding:14px 12px;border-radius:10px;margin-top:14px;overflow-x:auto;border:1px solid #1f4a4a}#rep h1,#rep h2{color:#7fe0c0;border-top-color:#2bb08a}#rep a{color:#7fe0c0}' +
  '#rep th{background:#14383a;color:#7fe0c0;border-color:#2c5a58}#rep td{border-color:#2c5a58}#rep tr:nth-child(even) td{background:#0f2528}#rep .ok{color:#6fe0a8}#rep .mono{color:#cfe3de}#rep pre{background:#0a1618;border-color:#2c5a58;color:#cfe3de}#rep summary{color:#7fe0c0}#rep .big{color:#7fe0c0}#rep .live{background:#0a1618;color:#7fe0c0}</style>';
function dark(h, extra) { return h.replace('<head>', '<head><meta name="color-scheme" content="dark"><meta name="theme-color" content="#15181b">').replace('</head>', DARKCSS + (extra || '') + '</head>'); }
function globeJs() { return GLOBE_JS.replace('__COAST__', JSON.stringify(COAST)).replace('__COLO__', JSON.stringify(COLO)).replace('__DC__', JSON.stringify(DCI)); }

function allesPage(u) {
  const q = u.searchParams.get('q') || '1', b = u.searchParams.get('b') || '0.02';
  const rows = [['p', '1 · Phasenlauf'], ['s', '2 · Struktur-Lauf'], ['k', '3 · Kettenlauf']].map(([k, t]) =>
    '<div style="font-size:13px;margin-top:6px"><b>' + t + '</b> <span class="mono sm" id="t_' + k + '">wartet</span></div><div class="bar sm"><b id="b_' + k + '" style="width:0"></b></div>').join('');
  return reply(dark(html(TITLE + ' · Gesamtlauf',
    '<div class="dkc">' + HEAD + '<p><span class="live"><i></i>LÄUFT LIVE</span> <span class="mono" id="cap">Gesamtlauf wird gestartet ...</span></p>' +
    '<canvas id="gl"></canvas>' + rows + '<div class="leg" id="leg"></div>' +
    '<p id="msg" style="margin-top:14px;font-size:14px">Die Seite offen lassen. Sobald ein Lauf fertig ist, beginnt der nächste von selbst; am Ende öffnet sich der Gesamtbericht. Q = ' + esc(q) + ' · B = ' + esc(b) + '.</p></div>' +
    '<script>' + globeJs() + ALLES_JS + '</script>')));
}

function homePage(t) {
  const i = t.indexOf('<body>'), j = t.lastIndexOf('</body>');
  let inner = t.slice(i + 6, j).replace('<h2>Live-Lauf starten</h2>', '<canvas id="gl"></canvas>' + ALLES_FORM + '<h2>Live-Lauf starten</h2>');
  const head = t.slice(0, i), tail = t.slice(j);
  return reply(dark(head + '<body><div class="dkc">' + inner + '</div><script>' + globeJs() + 'IDLE=true;</script>' + tail));
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
var D=__DEVDATA__,COAST=__COAST__;
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
function wm(doc,W,H){
  var R=88,cx=W/2,cy=H/2,sx=0,sy=0,k=0;
  D.cols.forEach(function(c){sx+=Math.sin(c[0]*Math.PI/180);sy+=Math.cos(c[0]*Math.PI/180);k++});
  var rot=(k?Math.atan2(sx,sy):0.2),tilt=0.42;
  function P(lon,lat){var a=lon*Math.PI/180,b=lat*Math.PI/180,x0=Math.cos(b)*Math.sin(a),y0=Math.sin(b),z0=Math.cos(b)*Math.cos(a);
    var x=x0*Math.cos(rot)-z0*Math.sin(rot),z=x0*Math.sin(rot)+z0*Math.cos(rot),y2=y0*Math.cos(tilt)-z*Math.sin(tilt),z2=y0*Math.sin(tilt)+z*Math.cos(tilt);return[cx+R*x,cy-R*y2,z2]}
  doc.setGState(new doc.GState({opacity:0.14,'stroke-opacity':0.14}));
  doc.setDrawColor(15,82,87);doc.setLineWidth(0.6);doc.circle(cx,cy,R,'S');
  doc.setLineWidth(0.12);
  var la,lo,p,q;
  for(la=-60;la<=60;la+=30){p=null;for(lo=-180;lo<=180;lo+=6){q=P(lo,la);if(p&&p[2]>0&&q[2]>0)doc.line(p[0],p[1],q[0],q[1]);p=q}}
  for(lo=-180;lo<180;lo+=30){p=null;for(la=-90;la<=90;la+=6){q=P(lo,la);if(p&&p[2]>0&&q[2]>0)doc.line(p[0],p[1],q[0],q[1]);p=q}}
  doc.setLineWidth(0.3);
  for(var i=0;i<COAST.length;i++){var s=COAST[i];p=null;for(var j=0;j<s.length;j+=2){q=P(s[j],s[j+1]);if(p&&p[2]>0&&q[2]>0)doc.line(p[0],p[1],q[0],q[1]);p=q}}
  doc.setFillColor(43,176,138);
  D.cols.forEach(function(c){var z=P(c[0],c[1]);if(z[2]>0)doc.circle(z[0],z[1],0.9,'F')});
  doc.setGState(new doc.GState({opacity:1,'stroke-opacity':1}))
}
async function build(){
  var st=document.getElementById('pst');st.textContent='PDF wird erstellt ...';
  if(!window.html2canvas)await lib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if(!window.jspdf)await lib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  var rep=document.getElementById('rep');
  rep.querySelectorAll('details').forEach(function(d){d.open=true});
  var style=document.createElement('style');style.id='pdfst';style.textContent='.pdfh pre{white-space:pre-wrap;word-break:break-all;overflow:visible}';document.head.appendChild(style);
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
  var n=doc.getNumberOfPages();for(var p=1;p<=n;p++){doc.setPage(p);wm(doc,W,H);doc.setFontSize(8);doc.setTextColor(90);doc.text('Seite '+p+' von '+n+'   |   '+NAME,W/2,H-7,{align:'center'})}
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
  if (!ep.done || !es.done || !ek.done) return reply(dark(html(TITLE, '<div class="dkc">' + HEAD + '<p>Mindestens ein Lauf ist noch nicht fertig. Die Seite lädt sich neu.</p></div>', 3)));
  const hk = HEAD.replace('36 Knoten auf Servern', '1225 Knoten auf 35 Servern');
  const bp = runPage(ep).replace(HEAD, ''), bs = strPage(es).replace(HEAD, ''), bk = ketPage(ek).replace(hk, '').replace(/<h2>Nachrechnen auf deinem Gerät<\/h2>[\s\S]*?<\/script>/, '');
  const dur = e => ((e.t1 - e.t0) / 1000).toFixed(1) + ' s';
  const cls = (v, l) => '<td class="' + (v < l ? 'ok' : 'mono') + '">' + v.toExponential(2) + (v < l ? ' · bestanden' : '') + '</td>';
  const sum = '<h2>Gesamtübersicht</h2><table><tr><th>Lauf</th><th>Knoten · Schritte</th><th>Dauer</th><th>größte Abweichung von der Referenzrechnung</th><th>Kennwert</th></tr>' +
    '<tr><td>' + esc(p) + '<br>Phasenlauf</td><td>36 · 40</td><td>' + dur(ep) + '</td>' + cls(ep.maxdev, 1e-12) + '<td>Windung ' + ep.winding.toFixed(9) + '</td></tr>' +
    '<tr><td>' + esc(s) + '<br>Struktur-Lauf</td><td>36 · 40</td><td>' + dur(es) + '</td>' + cls(es.maxdev, 1e-12) + '<td>Summe 1/λ ' + es.trTotal.toFixed(6) + ' (Vorhersage ' + (1295 / 12).toFixed(6) + ')</td></tr>' +
    '<tr><td>' + esc(k) + '<br>Kettenlauf</td><td>1225 · 40</td><td>' + dur(ek) + '</td>' + cls(ek.maxdev, 1e-12) + '<td>Summe 1/λ ' + ek.trTotal.toFixed(6) + ' (Vorhersage ' + (1225 * 1225 - 1) / 12 + ')</td></tr></table>' +
    '<p>Widersprüche zwischen empfangenen Kopien eines Wertes in allen drei Läufen: <b class="ok">' + (ep.mismatch + es.mismatch + ek.mismatch) + ' · bestanden</b>. Abgewiesene Nachrichten (Prüfung der Nachrichten an jedem Knoten): <b class="ok">' + [ep, es, ek].reduce((a, e) => a + e.nodes.reduce((b, n) => b + (n.rejected || 0), 0), 0) + '</b>.</p>';
  const sets = [ep.colos, es.colos, ek.colos]; const all = Array.from(new Set([].concat(...sets))).filter(c => DCI[c]).sort((a, b) => (DCI[a][0] + a).localeCompare(DCI[b][0] + b, 'de'));
  const mark = (c) => sets.map((x, i) => x.indexOf(c) >= 0 ? (i + 1) : '–').join(' · ');
  const dct = '<h2>Rechenzentren dieser drei Läufe</h2><table><tr><th>Kennung</th><th>Land</th><th>Land im Original</th><th>Ort im Original</th><th>in Lauf</th></tr>' +
    all.map(c => '<tr><td class="mono">' + c + '</td><td>' + esc(DCI[c][0]) + '</td><td>' + esc(DCI[c][1]) + '</td><td>' + esc(DCI[c][2]) + '</td><td>' + mark(c) + '</td></tr>').join('') + '</table>';
  const mk = (e, c) => ({ seed: e.seed, run: e.run, round: e.srcRound || null, Q: e.Q, B: e.B, hist: c ? e.nodes.map(n => n.hist) : undefined });
  const cols = all.filter(c => COLO[c]).map(c => [COLO[c][1], COLO[c][0]]);
  const dd = { p: mk(ep, true), s: mk(es, true), k: { seed: ek.seed, run: ek.run, round: ek.srcRound || null, final: ek.final }, cols };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const fname = 'Gesamtlauf_V36_' + stamp;
  const client = GES_CLIENT.replace('__DEVDATA__', JSON.stringify(dd).replace(/</g, '\\u003c')).replace('__COAST__', JSON.stringify(COAST)).replace('__CHAIN__', DRAND).split('__FILENAME__').join(fname);
  const ctrl = '<div class="nx"><style>@media print{.nx{display:none}}</style>' +
    '<p><button class="btn" type="button" onclick="pdf()">Gesamtergebnis als PDF herunterladen</button></p>' +
    '<p><button class="btn" type="button" onclick="sharepdf()">PDF teilen oder in Dateien sichern</button></p><p class="mono" id="pst"></p>' +
    '<p><button class="btn" type="button" onclick="dev()">Auf diesem Gerät prüfen</button></p><div id="dv"></div></div>';
  const body = '<div class="dkc">' + HEAD + ctrl + '</div><div id="rep">' + sum + dct + bp + bs + bk + '<p>Serverzeit beim Aufruf: ' + tfmt(Date.now()) + '</p></div><script>' + client + '</script>';
  const resp = reply(dark(html(TITLE + ' · Gesamtbericht', body), RESCSS), 'public, max-age=120');
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
    if (u.pathname === '/' || u.pathname === '/alles') return homePage(await r.text());
    return r;
  }
};
