const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const https = require('https');
const zlib = require('zlib');
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, 'cache');
const HOST = '127.0.0.1';
const PORT = 8787;
const GEO_CACHE = path.join(CACHE, 'geocode.json');
const SEARCH_CACHE = path.join(CACHE, 'search.json');
const WEB_CACHE = path.join(CACHE, 'web-validation.json');
const NETWORK_CACHE = path.join(CACHE, 'network-profile.json');
fs.mkdirSync(CACHE, { recursive: true });

function loadJSON(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function saveJSON(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); }
let geoCache = loadJSON(GEO_CACHE, {});
let searchCache = loadJSON(SEARCH_CACHE, {});
let webCache = loadJSON(WEB_CACHE, {});
let networkProfile = loadJSON(NETWORK_CACHE, { overpassSkipUntil: 0, lastWorkingOverpass: '' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const COUNTRIES = {
  BR:{name:'Brasil', code:'br', lang:'pt-BR', bing:'pt-BR', cc:'br', tlds:['com.br','com'], calling:'55'},
  PT:{name:'Portugal', code:'pt', lang:'pt-PT', bing:'pt-PT', cc:'pt', tlds:['pt','com'], calling:'351'},
  US:{name:'United States', code:'us', lang:'en-US', bing:'en-US', cc:'us', tlds:['com','net','org'], calling:'1'},
  CA:{name:'Canada', code:'ca', lang:'en-CA', bing:'en-CA', cc:'ca', tlds:['ca','com'], calling:'1'},
  GB:{name:'United Kingdom', code:'gb', lang:'en-GB', bing:'en-GB', cc:'gb', tlds:['co.uk','uk','com'], calling:'44'},
  AU:{name:'Australia', code:'au', lang:'en-AU', bing:'en-AU', cc:'au', tlds:['com.au','au','com'], calling:'61'},
  IE:{name:'Ireland', code:'ie', lang:'en-IE', bing:'en-IE', cc:'ie', tlds:['ie','com'], calling:'353'},
  ES:{name:'España', code:'es', lang:'es-ES', bing:'es-ES', cc:'es', tlds:['es','com'], calling:'34'},
  NZ:{name:'New Zealand', code:'nz', lang:'en-NZ', bing:'en-NZ', cc:'nz', tlds:['co.nz','nz','com'], calling:'64'}
};

const NICHES = {
  aesthetics:[
    'nwr["shop"="beauty"]({bbox});','nwr["beauty"]({bbox});','nwr["healthcare"="clinic"]["name"~"estet|aesthetic|med spa|beauty|harmon",i]({bbox});','nwr["name"~"estet|aesthetic|med spa|beauty|harmon|facial",i]({bbox});'
  ],
  dental:['nwr["amenity"="dentist"]({bbox});','nwr["healthcare"="dentist"]({bbox});','nwr["name"~"odont|dental|dentist",i]({bbox});'],
  physio:['nwr["healthcare"="physiotherapist"]({bbox});','nwr["name"~"fisio|physio|physical therapy|rehab|reabilita",i]({bbox});'],
  pilates:[
    'nwr["sport"="pilates"]({bbox});',
    'nwr["name"~"pilates",i]({bbox});',
    'nwr["leisure"="fitness_centre"]["name"~"pilates",i]({bbox});',
    'nwr["healthcare"="physiotherapist"]["name"~"pilates",i]({bbox});',
    'nwr["club"="sport"]["name"~"pilates",i]({bbox});'
  ],
  medical:['nwr["amenity"="clinic"]({bbox});','nwr["healthcare"="clinic"]({bbox});','nwr["amenity"="doctors"]({bbox});'],
  veterinary:['nwr["amenity"="veterinary"]({bbox});','nwr["name"~"veterin|vet clinic",i]({bbox});'],
  pet:['nwr["shop"="pet"]({bbox});'],
  salon:['nwr["shop"="hairdresser"]({bbox});','nwr["shop"="beauty"]({bbox});'],
  accounting:['nwr["office"="accountant"]({bbox});','nwr["name"~"contab|account|bookkeep",i]({bbox});'],
  chiropractor:['nwr["healthcare"="chiropractor"]({bbox});','nwr["name"~"chiro|chiropr",i]({bbox});'],
  cleaning:['nwr["craft"="cleaning"]({bbox});','nwr["office"="company"]["name"~"clean|limpeza",i]({bbox});','nwr["name"~"cleaning|limpeza",i]({bbox});'],
  landscaping:['nwr["craft"="gardener"]({bbox});','nwr["name"~"landscap|garden|jardin|paisag",i]({bbox});'],
  contractor:['nwr["craft"="builder"]({bbox});','nwr["office"="construction_company"]({bbox});','nwr["name"~"contractor|construction|builder|construtora",i]({bbox});']
};

const FALLBACK_TERMS = {
  aesthetics:{
    'pt-BR':['clínica de estética','estética avançada','harmonização facial','esteticista'],
    'pt-PT':['clínica de estética','medicina estética','estética avançada','harmonização facial'],
    'en':['aesthetic clinic','med spa','skin clinic','aesthetics'],
    'es':['clínica estética','medicina estética','estética avanzada']
  },
  dental:{'pt-BR':['clínica odontológica','dentista','odontologia'],'pt-PT':['clínica dentária','dentista','medicina dentária'],'en':['dental clinic','dentist'],'es':['clínica dental','dentista']},
  physio:{'pt-BR':['fisioterapia','clínica de fisioterapia','reabilitação'],'pt-PT':['fisioterapia','clínica de fisioterapia','reabilitação'],'en':['physical therapy clinic','physiotherapy','rehabilitation clinic'],'es':['fisioterapia','clínica de fisioterapia']},
  pilates:{'pt-BR':['pilates','estúdio de pilates','pilates clínico'],'pt-PT':['pilates','estúdio de pilates','pilates clínico','fisioterapia pilates'],'en':['pilates studio','pilates','reformer pilates'],'es':['pilates','estudio de pilates']},
  medical:{'pt-BR':['clínica médica','consultório médico'],'pt-PT':['clínica médica','consultório médico'],'en':['medical clinic','doctor clinic'],'es':['clínica médica','consultorio médico']},
  veterinary:{'pt-BR':['clínica veterinária','veterinário'],'pt-PT':['clínica veterinária','veterinário'],'en':['veterinary clinic','veterinarian'],'es':['clínica veterinaria','veterinario']},
  pet:{'pt-BR':['pet shop','loja de animais'],'pt-PT':['loja de animais','pet shop'],'en':['pet shop','pet store'],'es':['tienda de mascotas','pet shop']},
  salon:{'pt-BR':['salão de beleza','cabeleireiro'],'pt-PT':['salão de beleza','cabeleireiro'],'en':['hair salon','beauty salon'],'es':['salón de belleza','peluquería']},
  accounting:{'pt-BR':['escritório de contabilidade','contador'],'pt-PT':['contabilidade','contabilista'],'en':['accounting firm','accountant','bookkeeping'],'es':['asesoría contable','contabilidad']},
  chiropractor:{'pt-BR':['quiropraxia','quiroprata'],'pt-PT':['quiropraxia','quiroprático'],'en':['chiropractor','chiropractic clinic'],'es':['quiropráctico','quiropráctica']},
  cleaning:{'pt-BR':['empresa de limpeza','serviços de limpeza'],'pt-PT':['empresa de limpeza','serviços de limpeza'],'en':['cleaning company','cleaning service'],'es':['empresa de limpieza','servicio de limpieza']},
  landscaping:{'pt-BR':['paisagismo','jardinagem'],'pt-PT':['jardinagem','paisagismo'],'en':['landscaping company','landscaper','garden service'],'es':['paisajismo','jardinería']},
  contractor:{'pt-BR':['construtora','empreiteira'],'pt-PT':['empreiteiro','empresa de construção'],'en':['general contractor','construction company','builder'],'es':['empresa de construcción','contratista']}
};
function languageBucket(countryCode){const c=COUNTRIES[countryCode]||COUNTRIES.BR;if(c.lang==='pt-BR')return'pt-BR';if(c.lang==='pt-PT')return'pt-PT';if(c.lang.startsWith('es'))return'es';return'en';}
function fallbackTerms(nicheKey,nicheLabel,customNiche,countryCode){
  const terms=[];const custom=String(customNiche||'').trim();if(custom)terms.push(custom);
  const bucket=languageBucket(countryCode),dict=FALLBACK_TERMS[nicheKey]||{};
  for(const t of (dict[bucket]||dict.en||[]))if(t)terms.push(t);
  const label=String(nicheLabel||'').trim();if(label)terms.push(label);
  return [...new Set(terms.map(x=>x.trim()).filter(Boolean))].slice(0,4);
}


// Qualification v1.7: fallback sources are useful only when the business really
// matches both the requested city and the requested niche. This intentionally
// prefers fewer, cleaner leads over a larger noisy list.
const NICHE_QUALITY = {
  aesthetics:{include:['estet','aesthet','med spa','beauty clinic','harmon','skin clinic','laser clinic','facial','cosmetic clinic'],exclude:['podolog','dent','odont','pilates','fisi','physio','veterin','account','contab']},
  dental:{include:['dent','odont','dental','dentist'],exclude:['veterin','podolog','pilates','physio','fisi']},
  physio:{include:['fisio','physio','physical therapy','physiotherap','rehab','reabilit'],exclude:['dental','dentist','odont','veterin']},
  pilates:{include:['pilates','reformer'],exclude:['dental','dentist','odont','veterin','podolog']},
  medical:{include:['medical clinic','clinica medica','clínica médica','doctor','doctors','health clinic','centro medico','centro médico'],exclude:['veterin','dental','dentist','odont','podolog']},
  veterinary:{include:['veterin','veterinary','vet clinic','animal clinic'],exclude:['dental','dentist','odont']},
  pet:{include:['pet shop','pet store','loja de animais','mascotas'],exclude:['veterin clinic']},
  salon:{include:['hair salon','beauty salon','cabeleire','salão de beleza','salao de beleza','peluquer'],exclude:['medical clinic','dental','dentist','odont']},
  accounting:{include:['account','bookkeep','contab','contabil','contable'],exclude:[]},
  chiropractor:{include:['chiro','quiropr'],exclude:[]},
  cleaning:{include:['cleaning','limpeza','limpieza'],exclude:[]},
  landscaping:{include:['landscap','garden','gardener','jardin','paisag'],exclude:[]},
  contractor:{include:['contractor','construction','builder','construtor','construcao','construção','empreite'],exclude:[]}
};
function textHasAny(text, terms=[]){const t=fold(text);return terms.some(x=>t.includes(fold(x)));}
function nicheQualityMatch(nicheKey,customNiche,text){
  const t=fold(text);
  if(customNiche){
    const toks=fold(customNiche).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>=4);
    return toks.length ? toks.some(x=>t.includes(x)) : true;
  }
  const cfg=NICHE_QUALITY[nicheKey];
  if(!cfg)return true;
  if(cfg.exclude?.some(x=>t.includes(fold(x))))return false;
  return cfg.include?.some(x=>t.includes(fold(x))) || false;
}
function cityQualityMatch(city,text,structured=[],scope='strict'){
  const target=fold(city||'').trim();if(!target)return true;
  const vals=(structured||[]).map(fold).filter(Boolean);
  // Strict means the requested municipality/city itself. Do not let county,
  // district or state names make a neighbouring municipality pass.
  if(scope==='strict'){
    if(vals.some(v=>v===target))return true;
    // Accept common decorated locality labels such as "Braga (São Vítor)".
    if(vals.some(v=>v.startsWith(target+' ')||v.startsWith(target+' (')||v.endsWith(' '+target)))return true;
    return false;
  }
  if(scope==='nearby'){
    if(vals.some(v=>v===target||v.includes(target)||target.includes(v)))return true;
    return fold(text).includes(target);
  }
  // Broad district/state scope intentionally accepts the target anywhere in
  // structured locality or address text.
  return vals.some(v=>v.includes(target)||target.includes(v))||fold(text).includes(target);
}
function nominatimQuality(x,{nicheKey,customNiche,city,countryCode,geoScope='strict'}){
  const addr=x.address||{},extra=x.extratags||{};
  const cc=fold(addr.country_code||'');const expected=fold((COUNTRIES[countryCode]||COUNTRIES.BR).code);
  if(cc&&cc!==expected)return {ok:false,reason:'geo'};
  const strictLocalities=[addr.city,addr.town,addr.municipality,addr.village];
  const nearbyLocalities=[...strictLocalities,addr.county,addr.state_district];
  const broadLocalities=[...nearbyLocalities,addr.state,addr.region];
  const localities=geoScope==='strict'?strictLocalities:(geoScope==='nearby'?nearbyLocalities:broadLocalities);
  if(!cityQualityMatch(city,x.display_name||'',localities,geoScope))return {ok:false,reason:'geo'};
  const evidence=[x.name,x.display_name,x.category,x.type,x.class,JSON.stringify(extra)].filter(Boolean).join(' ');
  if(!nicheQualityMatch(nicheKey,customNiche,evidence))return {ok:false,reason:'niche'};
  return {ok:true};
}
function photonQuality(p,{nicheKey,customNiche,city,countryCode,geoScope='strict'}){
  const expected=fold((COUNTRIES[countryCode]||COUNTRIES.BR).code),cc=fold(p.countrycode||'');
  if(cc&&cc!==expected)return {ok:false,reason:'geo'};
  const strictLocalities=[p.city,p.locality,p.district];
  const nearbyLocalities=[...strictLocalities,p.county];
  const broadLocalities=[...nearbyLocalities,p.state,p.region];
  const localities=geoScope==='strict'?strictLocalities:(geoScope==='nearby'?nearbyLocalities:broadLocalities);
  const evidence=[p.name,p.street,p.type,p.osm_key,p.osm_value,p.city,p.state,p.country].filter(Boolean).join(' ');
  if(!cityQualityMatch(city,evidence,localities,geoScope))return {ok:false,reason:'geo'};
  if(!nicheQualityMatch(nicheKey,customNiche,evidence))return {ok:false,reason:'niche'};
  return {ok:true};
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let data='';
    req.on('data',c=>{data+=c;if(data.length>2_000_000){reject(new Error('Requisição muito grande.'));req.destroy();}});
    req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch{reject(new Error('JSON inválido.'))}});
    req.on('error',reject);
  });
}
function errText(e){
  if(!e) return 'erro desconhecido';
  const cause=e.cause;
  return [e.message, cause?.code, cause?.message].filter(Boolean).join(' / ');
}
function responseLike({status, headers, body, url}){
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get(name){ return headers[String(name).toLowerCase()] ?? null; } },
    async text(){ return body.toString('utf8'); },
    async json(){ return JSON.parse(body.toString('utf8')); }
  };
}
function decodeBody(buf, encoding=''){
  try{
    encoding=String(encoding||'').toLowerCase();
    if(encoding.includes('gzip')) return zlib.gunzipSync(buf);
    if(encoding.includes('deflate')) return zlib.inflateSync(buf);
    if(encoding.includes('br')) return zlib.brotliDecompressSync(buf);
  }catch{}
  return buf;
}
function nodeHttpRequest(url, options={}, timeout=35000, redirects=4){
  return new Promise((resolve,reject)=>{
    let u;
    try{ u = url instanceof URL ? url : new URL(String(url)); }
    catch(e){ return reject(e); }
    const lib = u.protocol === 'http:' ? http : https;
    const method = String(options.method||'GET').toUpperCase();
    const headers = {...(options.headers||{})};
    const body = options.body == null ? null : Buffer.from(String(options.body));
    if(body && !Object.keys(headers).some(k=>k.toLowerCase()==='content-length')) headers['Content-Length']=String(body.length);
    // Asking for plain content avoids some CDN decompression problems on Windows.
    if(!Object.keys(headers).some(k=>k.toLowerCase()==='accept-encoding')) headers['Accept-Encoding']='gzip, deflate, br';
    const req = lib.request({
      protocol:u.protocol, hostname:u.hostname, port:u.port||undefined,
      path:u.pathname+u.search, method, headers,
      family:4, servername:u.hostname
    }, res=>{
      const status=res.statusCode||0;
      const location=res.headers.location;
      if(location && [301,302,303,307,308].includes(status) && redirects>0){
        res.resume();
        const next=new URL(location,u).toString();
        const nextOptions={...options};
        if([301,302,303].includes(status) && method!=='GET' && method!=='HEAD'){
          nextOptions.method='GET'; delete nextOptions.body;
          const nh={...(nextOptions.headers||{})};
          for(const k of Object.keys(nh)) if(['content-length','content-type'].includes(k.toLowerCase())) delete nh[k];
          nextOptions.headers=nh;
        }
        return nodeHttpRequest(next,nextOptions,timeout,redirects-1).then(resolve,reject);
      }
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>{
        const raw=Buffer.concat(chunks);
        const bodyBuf=decodeBody(raw,res.headers['content-encoding']);
        const h={}; for(const [k,v] of Object.entries(res.headers)) h[k.toLowerCase()]=Array.isArray(v)?v.join(', '):(v??'');
        resolve(responseLike({status,headers:h,body:bodyBuf,url:u.toString()}));
      });
    });
    req.setTimeout(timeout,()=>req.destroy(new Error(`timeout após ${Math.round(timeout/1000)}s`)));
    req.on('error',reject);
    if(body) req.write(body);
    req.end();
  });
}
async function fetchTimeout(url, options={}, timeout=35000) {
  let ipv4Error;
  // Primeiro usa o cliente HTTPS nativo forçando IPv4. Em alguns Windows/Node,
  // fetch (Undici) falha com "fetch failed" mesmo com internet normal no navegador.
  try { return await nodeHttpRequest(url,options,timeout); }
  catch(e){ ipv4Error=e; }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try { return await fetch(url,{...options,signal:controller.signal}); }
  catch(e){
    let host='rede'; try{host=(url instanceof URL?url:new URL(String(url))).hostname}catch{}
    throw new Error(`falha de rede em ${host}: IPv4=${errText(ipv4Error)} | fetch=${errText(e)}`);
  } finally { clearTimeout(timer); }
}

let lastNominatim = 0;
async function geocode(query, countryCode) {
  const country = COUNTRIES[countryCode] || COUNTRIES.BR;
  const key = `${country.code}|${query.trim().toLowerCase()}`;
  if (geoCache[key]) return geoCache[key];
  const wait = 1150-(Date.now()-lastNominatim); if(wait>0) await sleep(wait); lastNominatim=Date.now();
  const errors=[];
  try{
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('format','jsonv2');u.searchParams.set('q',query);u.searchParams.set('limit','1');u.searchParams.set('countrycodes',country.code);u.searchParams.set('addressdetails','1');
    const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.2','Accept-Language':country.lang+',en;q=0.7'}},20000);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    if(data.length){
      const x=data[0],result={displayName:x.display_name,bbox:x.boundingbox.map(Number),lat:Number(x.lat),lon:Number(x.lon),geocoder:'Nominatim'};
      geoCache[key]=result;saveJSON(GEO_CACHE,geoCache);return result;
    }
    errors.push('Nominatim: região não encontrada');
  }catch(e){errors.push('Nominatim: '+e.message)}

  // Backup gratuito de geocodificação. Ajuda quando o Nominatim está temporariamente
  // bloqueado ou inacessível na rede do usuário.
  try{
    const u=new URL('https://photon.komoot.io/api/');
    u.searchParams.set('q',query);u.searchParams.set('limit','5');
    const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.2','Accept-Language':country.lang+',en;q=0.7'}},18000);
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    const features=Array.isArray(data.features)?data.features:[];
    const x=features.find(f=>String(f.properties?.countrycode||'').toLowerCase()===country.code)||features[0];
    if(x){
      const coords=x.geometry?.coordinates||[]; const lon=Number(coords[0]),lat=Number(coords[1]);
      let bbox;
      const ex=x.properties?.extent;
      if(Array.isArray(ex)&&ex.length===4){
        // Photon extent: [minLon,minLat,maxLon,maxLat] -> app: [south,north,west,east]
        bbox=[Number(ex[1]),Number(ex[3]),Number(ex[0]),Number(ex[2])];
      }else bbox=[lat-0.08,lat+0.08,lon-0.10,lon+0.10];
      const displayName=[x.properties?.name,x.properties?.city,x.properties?.state,x.properties?.country].filter(Boolean).join(', ');
      const result={displayName:displayName||query,bbox,lat,lon,geocoder:'Photon'};
      geoCache[key]=result;saveJSON(GEO_CACHE,geoCache);return result;
    }
    errors.push('Photon: região não encontrada');
  }catch(e){errors.push('Photon: '+e.message)}
  throw new Error(`Geocodificação falhou. ${errors.join(' | ')}`);
}
async function geocodeWithFallback({region,city,state,countryCode}){
  const country=COUNTRIES[countryCode]||COUNTRIES.BR;
  const clean=[];
  for(const v of [region,city,state,country.name]){
    const x=String(v||'').trim();
    if(!x)continue;
    if(!clean.some(y=>y.toLowerCase()===x.toLowerCase()))clean.push(x);
  }
  const attempts=[];
  if(clean.length)attempts.push(clean.join(', '));
  if(city)attempts.push([city,country.name].filter(Boolean).join(', '));
  if(state&&String(state).toLowerCase()!==String(city).toLowerCase())attempts.push([state,country.name].filter(Boolean).join(', '));
  let last;
  for(const q of [...new Set(attempts)]){
    try{return await geocode(q,countryCode)}catch(e){last=e}
  }
  throw last||new Error('Localização não encontrada.');
}
function escRegex(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/"/g,'\\"');}
function bboxString(b){return `${b[0]},${b[2]},${b[1]},${b[3]}`;}
function overpassQuery(nicheKey, customNiche, bbox){
  const defs=NICHES[nicheKey]||[`nwr["name"~"${escRegex(customNiche||nicheKey)}",i]({bbox});`];
  return `[out:json][timeout:30];(\n${defs.map(x=>x.replaceAll('{bbox}',bboxString(bbox))).join('\n')}\n);out center tags;`;
}
const OVERPASS=[
  // Mantemos poucos endpoints reais. Redes que bloqueiam Overpass não devem
  // ficar esperando uma longa lista de timeouts antes de usar os fallbacks.
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
let preferredOverpass = networkProfile.lastWorkingOverpass || null;
const overpassCooldown = new Map();
function overpassOrder(){
  const now=Date.now();
  if(Number(networkProfile.overpassSkipUntil||0)>now) return [];
  const list=[...OVERPASS];
  if(preferredOverpass){
    const i=list.indexOf(preferredOverpass);
    if(i>0){list.splice(i,1);list.unshift(preferredOverpass)}
  }
  return list.filter(ep=>!overpassCooldown.has(ep) || now-overpassCooldown.get(ep)>120000);
}
function markOverpassUnavailable(minutes=30){
  networkProfile.overpassSkipUntil=Date.now()+minutes*60*1000;
  saveJSON(NETWORK_CACHE,networkProfile);
}
function markOverpassWorking(endpoint){
  networkProfile.overpassSkipUntil=0;
  networkProfile.lastWorkingOverpass=endpoint||'';
  saveJSON(NETWORK_CACHE,networkProfile);
}
async function overpassTransport(endpoint, query, timeout=5200){
  const headers={'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json','User-Agent':'KromaLeadsGlobal/3.7'};
  let postError=null;
  try{
    const r=await nodeHttpRequest(endpoint,{method:'POST',headers,body:'data='+encodeURIComponent(query)},timeout);
    if(r.ok)return r;
    postError=new Error(`POST HTTP ${r.status}`);
  }catch(e){postError=e}
  // Alguns proxies/redes domésticas tratam POST para estes hosts pior que GET.
  // Para consultas pequenas, tentamos GET como segunda rota.
  const getUrl=endpoint+'?data='+encodeURIComponent(query);
  let getError=null;
  if(getUrl.length<7800){
    try{
      const r=await nodeHttpRequest(getUrl,{method:'GET',headers:{'Accept':'application/json','User-Agent':'KromaLeadsGlobal/3.7'}},Math.min(timeout,4200));
      if(r.ok)return r;
      getError=new Error(`GET HTTP ${r.status}`);
    }catch(e){getError=e}
  }
  throw new Error(`POST=${errText(postError)}${getError?` | GET=${errText(getError)}`:''}`);
}
async function queryOverpass(query){
  const errors=[];
  const endpoints=overpassOrder();
  if(!endpoints.length) throw new Error('Overpass temporariamente ignorado nesta rede para acelerar a busca.');
  for(const endpoint of endpoints){
    try{
      const r=await overpassTransport(endpoint,query,5200);
      preferredOverpass=endpoint; overpassCooldown.delete(endpoint); markOverpassWorking(endpoint);
      return await r.json();
    }catch(e){
      overpassCooldown.set(endpoint,Date.now());
      errors.push(`${new URL(endpoint).hostname}: ${e.message}`);
    }
  }
  markOverpassUnavailable(30);
  throw new Error(`Overpass indisponível nesta rede. ${errors.join(' | ')}`);
}
function gridBboxes(bbox,cells=4){
  const [south,north,west,east]=bbox,rows=Math.ceil(Math.sqrt(cells)),cols=rows,out=[];
  const dh=(north-south)/rows,dw=(east-west)/cols;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out.push([south+r*dh,Math.min(north,south+(r+1)*dh),west+c*dw,Math.min(east,west+(c+1)*dw)]);
  return out;
}
async function resilientOverpass(nicheKey,customNiche,bbox){
  try{return await queryOverpass(overpassQuery(nicheKey,customNiche,bbox))}
  catch(firstError){
    // Se a rede inteira está sem Overpass, dividir a área só multiplicaria timeouts.
    if(/indisponível nesta rede|temporariamente ignorado/i.test(firstError.message||'')) throw firstError;
    let elements=[],success=0,last=firstError;
    for(const cell of gridBboxes(bbox,4)){
      try{const d=await queryOverpass(overpassQuery(nicheKey,customNiche,cell));elements.push(...(d.elements||[]));success++}
      catch(e){last=e}
      await sleep(180);
    }
    if(success)return{elements};
    throw last;
  }
}
function tag(tags,names){for(const n of names)if(tags&&tags[n])return tags[n];return '';}
function buildAddress(tags){const p=[];const street=tag(tags,['addr:street']),num=tag(tags,['addr:housenumber']),district=tag(tags,['addr:suburb','addr:neighbourhood','addr:district']),city=tag(tags,['addr:city']),postcode=tag(tags,['addr:postcode']);if(street)p.push(street+(num?', '+num:''));if(district)p.push(district);if(city)p.push(city);if(postcode)p.push(postcode);return p.join(' · ');}
function instagramFrom(tags){let v=tag(tags,['contact:instagram','instagram']);if(!v)return '';const m=v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);return m?m[1]:v.replace(/^@/,'').trim();}
function parseElements(elements,nicheKey,nicheLabel,region,countryCode){return (elements||[]).map(el=>{const tags=el.tags||{},name=tag(tags,['name','brand','operator']);if(!name)return null;return{osmKey:`${el.type}-${el.id}`,name,nicheKey,niche:nicheLabel,region,country:countryCode,address:buildAddress(tags),phone:tag(tags,['contact:whatsapp','whatsapp','contact:mobile','mobile','contact:phone','phone']),whatsapp:tag(tags,['contact:whatsapp','whatsapp']),instagram:instagramFrom(tags),website:tag(tags,['contact:website','website','url']),email:tag(tags,['contact:email','email']),openingHours:tag(tags,['opening_hours']),lat:el.lat??el.center?.lat??'',lon:el.lon??el.center?.lon??''}}).filter(Boolean);}
function sourceList(r){return Array.isArray(r.sources)?r.sources.filter(Boolean):[r.source].filter(Boolean);}
function businessIdentity(r){
  const phone=String(r.phone||r.whatsapp||'').replace(/\D/g,'');
  if(phone.length>=8)return 'p:'+phone.slice(-10);
  const name=fold(r.name||'').replace(/[^a-z0-9]+/g,' ').trim();
  const place=fold(r.region||r.city||'').replace(/[^a-z0-9]+/g,' ').trim();
  return 'n:'+name+'|'+place+'|'+String(r.country||'');
}
function mergeRows(rows){
  const map=new Map();
  for(const raw of rows||[]){
    if(!raw||!raw.name)continue;
    const r={...raw,sources:sourceList(raw)};
    const key=businessIdentity(r);
    if(!map.has(key)){map.set(key,r);continue}
    const a=map.get(key);
    for(const f of ['address','phone','whatsapp','instagram','website','email','openingHours','lat','lon','city','region'])if(!a[f]&&r[f])a[f]=r[f];
    a.sources=[...new Set([...sourceList(a),...sourceList(r)])];
    a.source=a.sources.join(' + ');
    // Keep a stable OSM key when available; otherwise preserve the first discovered key.
    if(String(r.osmKey||'').startsWith('node-')||String(r.osmKey||'').startsWith('way-')||String(r.osmKey||'').startsWith('relation-'))a.osmKey=r.osmKey;
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function nominatimRow(x,{nicheKey,nicheLabel,region,city,countryCode,source='Nominatim'}){
  const country=COUNTRIES[countryCode]||COUNTRIES.BR,extra=x.extratags||{},named=x.namedetails||{},addr=x.address||{};
  const name=x.name||named.name||named['name:'+country.code]||String(x.display_name||'').split(',')[0].trim();if(!name)return null;
  const phone=extra['contact:whatsapp']||extra.whatsapp||extra['contact:mobile']||extra.mobile||extra['contact:phone']||extra.phone||'';
  const website=extra['contact:website']||extra.website||extra.url||'';
  return {osmKey:`${x.osm_type||'osm'}-${x.osm_id||x.place_id}`,name,nicheKey,niche:nicheLabel,region:region||city,city,country:countryCode,address:x.display_name||[addr.road,addr.house_number,addr.suburb,addr.city,addr.postcode].filter(Boolean).join(' · '),phone,whatsapp:extra['contact:whatsapp']||extra.whatsapp||'',instagram:instagramFrom(extra),website,email:extra['contact:email']||extra.email||'',openingHours:extra.opening_hours||'',lat:x.lat||'',lon:x.lon||'',source,sources:[source]};
}
async function searchNominatimBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geoScope='strict'}){
  const country=COUNTRIES[countryCode]||COUNTRIES.BR,terms=fallbackTerms(nicheKey,nicheLabel,customNiche,countryCode);
  const out=[],errors=[];let filteredOut=0;
  for(const term of terms.slice(0,3)){
    const parts=[term,region,city];if(state&&fold(state)!==fold(city))parts.push(state);parts.push(country.name);const q=parts.filter(Boolean).join(', ');
    const wait=1150-(Date.now()-lastNominatim);if(wait>0)await sleep(wait);lastNominatim=Date.now();
    try{
      const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('format','jsonv2');u.searchParams.set('q',q);u.searchParams.set('countrycodes',country.code);u.searchParams.set('limit',String(Math.min(Math.max(maxResults||20,10),40)));u.searchParams.set('addressdetails','1');u.searchParams.set('extratags','1');u.searchParams.set('namedetails','1');u.searchParams.set('dedupe','1');
      const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.7','Accept-Language':country.lang+',en;q=0.7'}},14000);if(!r.ok){errors.push(`${term}: HTTP ${r.status}`);continue}
      const data=await r.json();for(const x of data){const quality=nominatimQuality(x,{nicheKey,customNiche,city,countryCode,geoScope});if(!quality.ok){filteredOut++;continue}const row=nominatimRow(x,{nicheKey,nicheLabel,region,city,countryCode,source:'Nominatim'});if(row)out.push({...row,discoveryQuality:'strict'})}
    }catch(e){errors.push(`${term}: ${e.message}`)}
    if(mergeRows(out).length>=Math.min(maxResults,30))break;
  }
  return {results:mergeRows(out),errors,filteredOut};
}
function photonAddress(p={}){return [p.street,p.housenumber,p.district||p.locality,p.city,p.state,p.postcode,p.country].filter(Boolean).join(' · ')}
async function searchPhotonBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geo,geoScope='strict'}){
  const country=COUNTRIES[countryCode]||COUNTRIES.BR,terms=fallbackTerms(nicheKey,nicheLabel,customNiche,countryCode),out=[],errors=[];let filteredOut=0;
  for(const term of terms.slice(0,3)){
    const q=[term,region,city,state&&fold(state)!==fold(city)?state:'',country.name].filter(Boolean).join(' ');
    try{
      const u=new URL('https://photon.komoot.io/api/');u.searchParams.set('q',q);u.searchParams.set('limit',String(Math.min(Math.max(maxResults||20,10),50)));const photonLang=country.lang.slice(0,2);if(['de','en','fr','it'].includes(photonLang))u.searchParams.set('lang',photonLang);
      if(geo?.lat&&geo?.lon){u.searchParams.set('lat',String(geo.lat));u.searchParams.set('lon',String(geo.lon))}
      const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.7','Accept-Language':country.lang+',en;q=0.7'}},12000);if(!r.ok){errors.push(`${term}: HTTP ${r.status}`);continue}
      const d=await r.json();for(const f of d.features||[]){const p=f.properties||{},coords=f.geometry?.coordinates||[];const quality=photonQuality(p,{nicheKey,customNiche,city,countryCode,geoScope});if(!quality.ok){filteredOut++;continue}const name=p.name||p.street||'';if(!name)continue;out.push({osmKey:`photon-${p.osm_type||'x'}-${p.osm_id||p.extent?.join('-')||name}`,name,nicheKey,niche:nicheLabel,region:region||city,city,country:countryCode,address:photonAddress(p),phone:'',whatsapp:'',instagram:'',website:'',email:'',openingHours:'',lat:coords[1]||'',lon:coords[0]||'',source:'Photon',sources:['Photon'],discoveryQuality:'strict'})}
    }catch(e){errors.push(`${term}: ${e.message}`)}
    if(mergeRows(out).length>=Math.min(maxResults,30))break;
    await sleep(180);
  }
  return {results:mergeRows(out),errors,filteredOut};
}
function cleanDiscoveryTitle(title=''){
  let t=stripTags(title).replace(/\s+[|–—-]\s+(Instagram|Facebook|Yelp|Tripadvisor|LinkedIn|TikTok).*$/i,'').replace(/\s+[|–—-]\s+.*$/,'').trim();
  t=t.replace(/^Home\s*[-|:]\s*/i,'').replace(/\s+\(@[^)]+\).*$/,'').trim();
  return t.length>=3&&t.length<=100?t:'';
}
function discoveryLooksUseful(name,row,terms,city,nicheKey,customNiche,geoScope='strict'){const raw=`${name} ${row.title||''} ${row.snippet||''}`;const text=fold(raw),target=fold(city||'');if(city&&!text.includes(target))return false;if(geoScope==='strict'&&city){const title=fold(row.title||'');const snippet=fold(row.snippet||'');if(!title.includes(target)&&!snippet.includes(target))return false;}if(!nicheQualityMatch(nicheKey,customNiche,raw))return false;return terms.some(t=>fold(t).split(/\s+/).some(x=>x.length>=5&&text.includes(x)));}
async function searchWebBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geoScope='strict'}){
  const country=COUNTRIES[countryCode]||COUNTRIES.BR,terms=fallbackTerms(nicheKey,nicheLabel,customNiche,countryCode),out=[],errors=[];let filteredOut=0;
  const queries=[];for(const term of terms.slice(0,3)){queries.push(`${term} ${city} ${region||state||''} ${country.name}`.trim());queries.push(`site:instagram.com ${term} ${city} ${country.name}`.trim())}
  for(const q of queries.slice(0,5)){
    try{
      const search=await searchFreeWeb(q,countryCode);errors.push(...(search.errors||[]));
      for(const row of search.rows||[]){
        const name=cleanDiscoveryTitle(row.title);if(!name||!discoveryLooksUseful(name,row,terms,city,nicheKey,customNiche,geoScope)){filteredOut++;continue;}
        const host=hostOf(row.url);let instagram='';const im=(row.url||'').match(/instagram\.com\/([A-Za-z0-9._]+)/i);if(im&&!['p','reel','stories','explore'].includes(im[1].toLowerCase()))instagram=im[1];
        const isOwnSite=host&&!blockedHost(host)&&/^https?:/i.test(row.url||'');
        out.push({osmKey:'web-'+fold(name).replace(/[^a-z0-9]+/g,'-')+'-'+out.length,name,nicheKey,niche:nicheLabel,region:region||city,city,country:countryCode,address:[region,city,state,country.name].filter(Boolean).join(' · '),phone:'',whatsapp:'',instagram,website:isOwnSite?row.url:'',email:'',openingHours:'',lat:'',lon:'',source:'Web discovery',sources:['Web discovery'],webDiscovery:{url:row.url,title:row.title,snippet:row.snippet,engine:search.engine}})
      }
    }catch(e){errors.push(e.message)}
    if(mergeRows(out).length>=Math.min(maxResults,24))break;
    await sleep(250);
  }
  return {results:mergeRows(out),errors,filteredOut};
}
async function searchArea({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geoScope='strict'}){
  const geo=await geocodeWithFallback({region,city,state,countryCode}),location=geo.displayName;
  const key=JSON.stringify({version:'1.8',nicheKey,customNiche,location,bbox:geo.bbox,maxResults,countryCode,geoScope});const cached=searchCache[key];if(cached&&Date.now()-cached.time<86400000)return cached.data;
  let all=[],warnings=[],sources=[];let overpassFailed=false,filteredOut=0;
  try{
    const data=await resilientOverpass(nicheKey,customNiche,geo.bbox);const rows=parseElements(data.elements,nicheKey,nicheLabel,region||city,countryCode).map(x=>({...x,city,source:'Overpass',sources:['Overpass']}));all.push(...rows);sources.push('Overpass');
  }catch(e){overpassFailed=true;warnings.push('Overpass indisponível: '+e.message)}
  const desired=Math.min(maxResults,overpassFailed?35:25);
  if(mergeRows(all).length<desired){
    const n=await searchNominatimBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geoScope});if(n.results.length){all.push(...n.results);sources.push('Nominatim')}filteredOut+=n.filteredOut||0;if(n.errors.length)warnings.push('Nominatim parcial: '+n.errors.slice(0,2).join(' | '));
  }
  if(mergeRows(all).length<desired){
    const p=await searchPhotonBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geo,geoScope});if(p.results.length){all.push(...p.results);sources.push('Photon')}filteredOut+=p.filteredOut||0;if(p.errors.length)warnings.push('Photon parcial: '+p.errors.slice(0,2).join(' | '));
  }
  if(mergeRows(all).length<Math.min(maxResults,overpassFailed?25:12)){
    const w=await searchWebBusinesses({nicheKey,nicheLabel,customNiche,city,region,state,countryCode,maxResults,geoScope});if(w.results.length){all.push(...w.results);sources.push('Web discovery')}filteredOut+=w.filteredOut||0;if(w.errors.length&&!w.results.length)warnings.push('Web discovery indisponível ou limitado.');
  }
  const merged=mergeRows(all).slice(0,maxResults);
  if(!merged.length)throw new Error('Nenhuma das fontes gratuitas conseguiu devolver estabelecimentos para esta consulta.');
  const uniqSources=[...new Set(sources)];
  const warning=overpassFailed?`Overpass indisponível nesta rede; usando ${uniqSources.filter(x=>x!=='Overpass').join(' + ')||'fontes de reserva'}.`:'';
  const result={results:merged,location:geo.displayName,source:uniqSources.join(' + '),sources:uniqSources,warning,warnings,filteredOut};
  searchCache[key]={time:Date.now(),data:result};saveJSON(SEARCH_CACHE,searchCache);return result;
}


const BLOCKED_HOSTS=[
  'instagram.com','facebook.com','linkedin.com','youtube.com','tiktok.com','x.com','twitter.com','pinterest.com',
  'google.com','google.com.br','google.pt','google.co.uk','maps.google.com','goo.gl','bing.com','duckduckgo.com',
  'yelp.com','tripadvisor.com','foursquare.com','yellowpages.com','yellowpages.ca','pagesjaunes.ca','thomsonlocal.com','yell.com',
  'doctoralia.com.br','doctoralia.com.pt','zocdoc.com','healthgrades.com','ratemds.com','whatclinic.com','doctolib.com',
  'wellhub.com','gympass.com','classpass.com','mindbodyonline.com','booksy.com','fresha.com','treatwell.com','vagaro.com',
  'solutudo.com.br','guiamais.com.br','telelistas.net','apontador.com.br','cylex.com','cylex-usa.com','hotfrog.com','manta.com',
  'linktr.ee','beacons.ai','bio.site','carrd.co'
];
const GENERIC_TOKENS=new Set(['clinic','clinica','clínica','studio','estudio','estúdio','pilates','physio','fisioterapia','therapy','estetica','estética','aesthetic','beauty','dental','dentist','odontologia','medical','medica','médica','vet','veterinary','pet','shop','salon','salao','salão','accounting','accountant','cleaning','landscaping','contractor','center','centre','centro','space','espaco','espaço','institute','instituto','consultorio','consultório','official','oficial']);
function fold(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function tokens(v=''){return fold(v).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>=3&&!GENERIC_TOKENS.has(x));}
function htmlDecode(v=''){return String(v).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#x2F;/gi,'/');}
function stripTags(v=''){return htmlDecode(String(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());}
function hostOf(url=''){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}
function blockedHost(host=''){return BLOCKED_HOSTS.some(x=>host===x||host.endsWith('.'+x));}
function unwrapSearchUrl(url=''){let u=htmlDecode(url);if(u.startsWith('//'))u='https:'+u;try{const p=new URL(u),uddg=p.searchParams.get('uddg');if(uddg)return decodeURIComponent(uddg);const target=p.searchParams.get('url')||p.searchParams.get('u');if(target&&/^https?:/i.test(target))return target}catch{}return u;}
function similarityScore(b,row){
  const nameTokens=tokens(b.name),domain=fold(hostOf(row.url)),text=fold(`${row.title} ${row.snippet}`),phone=String(b.phone||'').replace(/\D/g,'');
  let score=0,matches=0,domainMatches=0;
  for(const tok of nameTokens){
    if(domain.includes(tok)){score+=14;matches++;domainMatches++;}
    else if(text.includes(tok)){score+=9;matches++;}
  }
  if(nameTokens.length>=2&&matches>=2)score+=14;
  if(nameTokens.length>=3&&matches>=3)score+=8;
  if(b.city&&text.includes(fold(b.city)))score+=14;
  if(b.region&&text.includes(fold(b.region)))score+=4;
  if(phone.length>=8){const tail=phone.slice(-8),all=String(`${row.title} ${row.snippet} ${row.url}`).replace(/\D/g,'');if(all.includes(tail))score+=38;}
  // A single token appearing only in a domain is weak evidence, especially for
  // short/generic brands such as "4Ever".
  if(nameTokens.length===1&&domainMatches===1&&!text.includes(nameTokens[0]))score=Math.min(score,24);
  return Math.min(100,score);
}
function parseDuck(html){const out=[];const re=/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))&&out.length<12){const url=unwrapSearchUrl(m[1]),title=stripTags(m[2]),tail=html.slice(re.lastIndex,re.lastIndex+1800),sm=tail.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);out.push({url,title,snippet:sm?stripTags(sm[1]):'',source:'DuckDuckGo'});}return out;}
function parseBing(html){const out=[];const re=/<li[^>]+class="[^"]*b_algo[^"]*"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi;let m;while((m=re.exec(html))&&out.length<12){const block=m[0],pm=block.match(/<p>([\s\S]*?)<\/p>/i);out.push({url:unwrapSearchUrl(m[1]),title:stripTags(m[2]),snippet:pm?stripTags(pm[1]):'',source:'Bing'});}return out;}
async function searchFreeWeb(query,countryCode){const c=COUNTRIES[countryCode]||COUNTRIES.BR;const ua={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':c.lang+',en;q=0.7'};const errors=[];try{const r=await fetchTimeout('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query),{headers:ua},15000);if(r.ok){const rows=parseDuck(await r.text());if(rows.length)return{rows,engine:'DuckDuckGo',errors};}else errors.push('DuckDuckGo HTTP '+r.status)}catch(e){errors.push('DuckDuckGo: '+e.message)}try{const u='https://www.bing.com/search?q='+encodeURIComponent(query)+'&setlang='+encodeURIComponent(c.bing)+'&cc='+c.cc;const r=await fetchTimeout(u,{headers:ua},15000);if(r.ok){const rows=parseBing(await r.text());if(rows.length)return{rows,engine:'Bing',errors};}else errors.push('Bing HTTP '+r.status)}catch(e){errors.push('Bing: '+e.message)}return{rows:[],engine:'',errors};}
function confidenceBand(v){return v>=75?'strong':v>=50?'probable':'weak';}
function rankWebRows(rows,b){
  const candidates=[],social=[];
  for(const row of rows){
    const url=row.url||'',host=hostOf(url);if(!host||!/^https?:/i.test(url))continue;
    if(host==='instagram.com'||host.endsWith('.instagram.com')){const m=url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);if(m&&!['p','reel','stories','explore'].includes(m[1].toLowerCase()))social.push({type:'instagram',username:m[1],url,title:row.title,source:row.source});continue;}
    if(blockedHost(host))continue;
    const confidence=similarityScore(b,row);if(confidence<25)continue;
    candidates.push({...row,host,confidence,band:confidenceBand(confidence)});
  }
  const uniq=new Map();for(const c of candidates.sort((a,b)=>b.confidence-a.confidence))if(!uniq.has(c.host))uniq.set(c.host,c);
  const soc=new Map();for(const s of social)if(!soc.has(s.username.toLowerCase()))soc.set(s.username.toLowerCase(),s);
  return{candidates:[...uniq.values()].slice(0,5),social:[...soc.values()].slice(0,3)};
}
function domainSeeds(name,instagram=''){
  const raw=tokens(name).filter(x=>x.length>=4).slice(0,4),seeds=new Set();
  // Do not guess a bare domain from a single weak token. Multi-token brand
  // combinations are far less likely to collide with unrelated global domains.
  if(raw.length>=2){seeds.add(raw.join(''));seeds.add(raw.slice(0,2).join(''));if(raw.length>=3)seeds.add(raw.slice(0,3).join(''));}
  const ig=fold(String(instagram||'').replace(/^@/,'').replace(/[^a-z0-9._]/g,'')).replace(/[._]/g,'');if(ig.length>=5)seeds.add(ig);
  return[...seeds].filter(x=>x.length>=5&&x.length<=40).slice(0,5);
}
function directDomainEvidence(b,{url,title,snippet}){
  const text=fold(`${title||''} ${snippet||''}`),host=fold(hostOf(url)),nts=tokens(b.name),phone=String(b.phone||'').replace(/\D/g,'');
  const tokenMatches=nts.filter(t=>text.includes(t)||host.includes(t)).length;
  const cityMatch=!!(b.city&&text.includes(fold(b.city)));
  let phoneMatch=false;if(phone.length>=8){const tail=phone.slice(-8),all=String(`${url} ${title} ${snippet}`).replace(/\D/g,'');phoneMatch=all.includes(tail);}
  return {tokenMatches,cityMatch,phoneMatch,strong:phoneMatch||(tokenMatches>=2&&cityMatch)||(nts.length>=3&&tokenMatches>=3)};
}
async function probeLikelyDomains(b){
  const c=COUNTRIES[b.country]||COUNTRIES.BR,seeds=domainSeeds(b.name,b.instagram),domains=[];for(const seed of seeds)for(const tld of c.tlds)domains.push(seed+'.'+tld);const out=[];
  for(const domain of domains.slice(0,6)){
    try{
      const r=await fetchTimeout('https://'+domain,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 KromaLeadsGlobal/3.9','Accept-Language':c.lang+',en;q=0.7'}},4000);if(!r.ok)continue;
      const type=r.headers.get('content-type')||'';if(!type.includes('text/html'))continue;
      const html=(await r.text()).slice(0,180000),tm=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i),title=tm?stripTags(tm[1]):domain,visible=stripTags(html.slice(0,80000)),url=r.url||('https://'+domain),host=hostOf(url);if(blockedHost(host))continue;
      const snippet=visible.slice(0,10000),evidence=directDomainEvidence(b,{url,title,snippet});if(!evidence.strong)continue;
      const confidence=similarityScore(b,{url,title,snippet});if(confidence>=55)out.push({url,title,snippet:visible.slice(0,240),source:'Verificação direta de domínio',host,confidence:Math.min(95,confidence+4),band:confidenceBand(Math.min(95,confidence+4))});
    }catch{}
  }
  const uniq=new Map();for(const x of out.sort((a,b)=>b.confidence-a.confidence))if(!uniq.has(x.host))uniq.set(x.host,x);return[...uniq.values()].slice(0,3);
}
async function validateWebBusiness(b){
  const c=COUNTRIES[b.country]||COUNTRIES.BR,name=String(b.name||'').trim();if(!name)throw new Error('Empresa sem nome.');
  const key='v19|'+fold([b.country,name,b.city,b.region,b.phone].join('|')),cached=webCache[key];if(cached&&Date.now()-cached.time<7*86400000)return{...cached.data,cached:true};
  const query=`"${name}" ${b.city||''} ${b.region||''} ${c.name} ${b.phone||''}`.trim(),search=await searchFreeWeb(query,b.country),ranked=rankWebRows(search.rows,b);
  if(!ranked.candidates.some(x=>x.confidence>=50))ranked.candidates.push(...await probeLikelyDomains(b));
  ranked.candidates=[...new Map(ranked.candidates.sort((a,b)=>b.confidence-a.confidence).map(x=>[x.host,x])).values()].slice(0,5);
  const best=ranked.candidates[0],actionable=best&&best.confidence>=50;
  const data={query,engine:search.engine,candidates:ranked.candidates,social:ranked.social,searchedAt:new Date().toISOString(),available:!!search.engine||ranked.candidates.length>0,status:actionable?'candidate-found':(search.engine?'no-candidate':'unavailable'),errors:search.errors,note:actionable?'Foi encontrado um domínio com evidência suficiente para revisão. Confirme antes de classificar.':(best?'Foi encontrado apenas um candidato fraco. Ele não altera o score até revisão manual.':(!search.engine?'A busca automática gratuita não respondeu nesta rede. Use a Revisão assistida; isso não altera o score.':'Web pesquisada: nenhum domínio oficial com confiança suficiente foi localizado. Isso NÃO confirma ausência de site.'))};
  webCache[key]={time:Date.now(),data};saveJSON(WEB_CACHE,webCache);return data;
}
async function networkDiagnostics(){
  const out={node:process.version,ipv4First:true,dns:{},http:{},overpassEndpoints:[]};
  const diagEndpoints=[
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ];
  const hosts=['nominatim.openstreetmap.org',...diagEndpoints.map(x=>new URL(x).hostname)];
  for(const host of [...new Set(hosts)]){
    try{const x=await dns.promises.lookup(host,{family:4});out.dns[host]={ok:true,address:x.address}}
    catch(e){out.dns[host]={ok:false,error:errText(e)}}
  }
  try{
    const u='https://nominatim.openstreetmap.org/search?format=jsonv2&q=Porto%2C%20Portugal&limit=1&countrycodes=pt';
    const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.7','Accept-Language':'pt-PT,en;q=0.7'}},9000);
    out.http.nominatim={ok:r.ok,status:r.status};
  }catch(e){out.http.nominatim={ok:false,error:e.message}}
  try{
    const u='https://photon.komoot.io/api/?q=pilates%20Porto%20Portugal&limit=1';
    const r=await fetchTimeout(u,{headers:{'User-Agent':'KromaLeadsGlobal/3.7','Accept-Language':'pt-PT,en;q=0.7'}},9000);
    out.http.photon={ok:r.ok,status:r.status};
  }catch(e){out.http.photon={ok:false,error:e.message}}
  const q='[out:json][timeout:5];node(41.145,-8.615,41.146,-8.614);out 1;';
  let working=null;
  for(const endpoint of diagEndpoints){
    const host=new URL(endpoint).hostname;
    try{
      const r=await overpassTransport(endpoint,q,5500);
      const info={host,ok:r.ok,status:r.status};out.overpassEndpoints.push(info);
      if(r.ok){working=endpoint;preferredOverpass=endpoint;overpassCooldown.delete(endpoint);markOverpassWorking(endpoint);break}
    }catch(e){out.overpassEndpoints.push({host,ok:false,error:e.message});overpassCooldown.set(endpoint,Date.now())}
  }
  if(working)out.http.overpass={ok:true,status:200,endpoint:new URL(working).hostname};
  else{markOverpassUnavailable(30);out.http.overpass={ok:false,error:out.overpassEndpoints.map(x=>`${x.host}: ${x.error||('HTTP '+x.status)}`).join(' | ')}};
  out.degraded=!out.http.overpass?.ok && (!!out.http.nominatim?.ok || !!out.http.photon?.ok);
  const fallbackNames=[out.http.nominatim?.ok?'Nominatim':'',out.http.photon?.ok?'Photon':''].filter(Boolean);
  out.fallback=out.degraded?{ok:true,name:fallbackNames.join(' + '),note:'A busca continua em cascata gratuita e pode complementar com descoberta web.'}:{ok:false};
  out.ok=(!!out.http.nominatim?.ok || !!out.http.photon?.ok) && (!!out.http.overpass?.ok || out.degraded);
  return out;
}

function staticFile(req,res){let pathname;try{pathname=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname)}catch{pathname='/'}if(pathname==='/')pathname='/index.html';const file=path.normalize(path.join(PUBLIC,pathname));if(!file.startsWith(PUBLIC)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return sendJSON(res,404,{error:'Não encontrado.'});const ext=path.extname(file).toLowerCase(),types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}

http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET'&&req.url.startsWith('/api/status'))return sendJSON(res,200,{ok:true,mode:'free',version:'global-pro-1.9',countries:Object.keys(COUNTRIES),webValidation:'best-effort-plus-assisted-review'});
    if(req.method==='GET'&&req.url.startsWith('/api/diagnostics'))return sendJSON(res,200,await networkDiagnostics());
    if(req.method==='POST'&&req.url==='/api/search'){
      const b=await readBody(req),countryCode=String(b.country||'BR').toUpperCase(),city=String(b.city||'').trim(),state=String(b.state||'').trim(),nicheKey=String(b.nicheKey||'').trim(),nicheLabel=String(b.nicheLabel||'').trim(),customNiche=String(b.customNiche||'').trim(),geoScope=['strict','nearby','region'].includes(String(b.geoScope||''))?String(b.geoScope):'strict';const regions=Array.isArray(b.regions)?b.regions.map(x=>String(x).trim()).filter(Boolean):[],maxResults=Math.max(10,Math.min(Number(b.maxResults)||150,500));if(!COUNTRIES[countryCode])return sendJSON(res,400,{error:'País não suportado.'});if(!city||(!nicheKey&&!customNiche))return sendJSON(res,400,{error:'Informe cidade e nicho.'});const targets=regions.length?regions:[''];let all=[],errors=[],warnings=[],sources=new Set(),filteredOut=0;for(const region of targets){try{const d=await searchArea({nicheKey,nicheLabel,customNiche,city,state,region,countryCode,maxResults,geoScope});all.push(...d.results);filteredOut+=d.filteredOut||0;if(d.warning)warnings.push(`${region||city}: ${d.warning}`);for(const w of (d.warnings||[]))warnings.push(`${region||city}: ${w}`);for(const src of (d.sources||[]))sources.add(src);if(!d.sources?.length&&d.source)sources.add(d.source)}catch(e){errors.push(`${region||city}: ${e.message}`)}if(all.length>=maxResults)break;await sleep(300);}return sendJSON(res,200,{results:mergeRows(all).slice(0,maxResults),errors,warnings:[...new Set(warnings)].slice(0,8),sources:[...sources],filteredOut});
    }
    if(req.method==='POST'&&req.url==='/api/validate-web'){
      const b=await readBody(req);return sendJSON(res,200,await validateWebBusiness({name:String(b.name||'').trim(),city:String(b.city||'').trim(),region:String(b.region||b.state||'').trim(),phone:String(b.phone||'').trim(),address:String(b.address||'').trim(),instagram:String(b.instagram||'').trim(),country:String(b.country||'BR').toUpperCase()}));
    }
    if(req.method==='POST'&&req.url==='/api/clear-cache'){searchCache={};webCache={};saveJSON(SEARCH_CACHE,searchCache);saveJSON(WEB_CACHE,webCache);return sendJSON(res,200,{ok:true});}
    if(req.url.startsWith('/api/'))return sendJSON(res,404,{error:'Endpoint não encontrado.'});
    staticFile(req,res);
  }catch(e){console.error(e);sendJSON(res,500,{error:e.message||'Erro interno.'});}
}).listen(PORT,HOST,()=>{console.log('');console.log('Kroma Leads Global Pro');console.log('======================');console.log(`Abra no navegador: http://${HOST}:${PORT}`);console.log('Busca gratuita via OpenStreetMap / Overpass.');console.log('Validação web gratuita: melhor esforço, com revisão manual.');console.log('');});
