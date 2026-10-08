(function(){
'use strict';
var body=document.body,root=body.getAttribute('data-root')||'./';
var $=function(s,c){return(c||document).querySelector(s)},$$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

/* mobile navigation */
var menu=$('.menu'),side=$('#side');
function nav(open){body.classList.toggle('nav-open',open);if(menu)menu.setAttribute('aria-expanded',open?'true':'false');if(open&&side){var a=$('a[aria-current=page]',side)||$('summary',side);a&&a.scrollIntoView({block:'center'})}}
if(menu)menu.addEventListener('click',function(){nav(!body.classList.contains('nav-open'))});
document.addEventListener('click',function(e){if(e.target.closest('[data-close]'))nav(false)});
var scrim=$('[data-scrim]');if(scrim)scrim.addEventListener('click',function(){nav(false)});
if(side)side.addEventListener('click',function(e){if(e.target.closest('a')&&window.matchMedia('(max-width:900px)').matches)nav(false)});

/* keep the current page visible in the sidebar */
if(side&&window.matchMedia('(min-width:901px)').matches){var cur=$('a[aria-current=page]',side);if(cur){var r=cur.getBoundingClientRect(),h=side.clientHeight;if(r.bottom>h||r.top<0)side.scrollTop+=r.top-h/2}}

/* copy buttons */
document.addEventListener('click',function(e){
  var b=e.target.closest('.copy');if(!b)return;
  var code=b.closest('.code').querySelector('code'),text=code.innerText.replace(/\n$/,'');
  function done(){b.textContent='Copied';b.classList.add('ok');setTimeout(function(){b.textContent='Copy';b.classList.remove('ok')},1400)}
  function fallback(){var r=document.createRange();r.selectNodeContents(code);var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy');done()}catch(x){}s.removeAllRanges()}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
});

/* contents rail: highlight the section being read */
var tocLinks=$$('.toc a');
if(tocLinks.length&&'IntersectionObserver' in window){
  var map={};tocLinks.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
  var heads=$$('.doc h2[id],.doc h3[id]').filter(function(h){return map[h.id]});
  var set=function(id){tocLinks.forEach(function(a){a.removeAttribute('aria-current')});if(map[id]){map[id].setAttribute('aria-current','true');var w=map[id].closest('.toc-wrap');if(w){var ar=map[id].getBoundingClientRect(),wr=w.getBoundingClientRect();if(ar.top<wr.top+40||ar.bottom>wr.bottom-40)w.scrollTop+=ar.top-wr.top-wr.height/2}}};
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting)set(en.target.id)})},{rootMargin:'-70px 0px -72% 0px'});
  heads.forEach(function(h){io.observe(h)});
}

/* search */
var index=null,loading=null,pal=null,input,list,active=-1,hits=[];
function norm(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function load(){
  if(index)return Promise.resolve(index);if(loading)return loading;
  loading=fetch(root+'assets/search-index.json').then(function(r){return r.json()}).then(function(j){
    j.forEach(function(p){p._t=norm(p.t);p._h=norm(p.h.join(' | '));p._x=norm(p.x)});index=j;return j});
  loading.catch(function(){loading=null});return loading;
}
function build(){
  pal=document.createElement('div');pal.className='pal';pal.setAttribute('role','dialog');pal.setAttribute('aria-modal','true');pal.setAttribute('aria-label','Search the documentation');
  pal.innerHTML='<div class="pal-box"><div class="pal-in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Search notes, headings and text" autocomplete="off" spellcheck="false" aria-label="Search" enterkeyhint="search"></div><ul class="pal-res" role="listbox"></ul><div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>';
  document.body.appendChild(pal);input=$('input',pal);list=$('.pal-res',pal);
  pal.addEventListener('mousedown',function(e){if(e.target===pal)close()});
  input.addEventListener('input',run);
  input.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'){e.preventDefault();move(1)}else if(e.key==='ArrowUp'){e.preventDefault();move(-1)}
    else if(e.key==='Enter'){var a=$$('a',list)[active<0?0:active];if(a){e.preventDefault();location.href=a.href}}
  });
}
function move(d){var as=$$('a',list);if(!as.length)return;active=(active+d+as.length)%as.length;as.forEach(function(a,i){a.classList.toggle('on',i===active);if(i===active)a.scrollIntoView({block:'nearest'})})}
function snippet(p,terms){
  var x=p.x,nx=p._x,pos=-1;for(var i=0;i<terms.length;i++){var k=nx.indexOf(terms[i]);if(k>=0&&(pos<0||k<pos))pos=k}
  var from=Math.max(0,pos<0?0:pos-50),s=x.slice(from,from+170);return(from>0?'… ':'')+s}
function hl(s,terms){
  var out=esc(s),n=norm(s);if(n.length!==s.length)return out;
  var marks=[];terms.forEach(function(t){var i=0;while((i=n.indexOf(t,i))>=0){marks.push([i,i+t.length]);i+=t.length}});
  marks.sort(function(a,b){return a[0]-b[0]});var res='',last=0;
  marks.forEach(function(m){if(m[0]<last)return;res+=esc(s.slice(last,m[0]))+'<mark>'+esc(s.slice(m[0],m[1]))+'</mark>';last=m[1]});
  return res+esc(s.slice(last))}
function run(){
  var q=norm(input.value).trim();active=-1;
  if(!q){list.innerHTML='<li class="pal-empty">Type to search '+(index?index.length+' notes':'the notes')+'.</li>';return}
  load().then(function(idx){
    if(norm(input.value).trim()!==q)return;
    var terms=q.split(/\s+/).filter(Boolean);
    hits=idx.map(function(p){
      var sc=0;for(var i=0;i<terms.length;i++){var t=terms[i],s=0;
        if(p._t===t)s=120;else if(p._t.indexOf(t)===0)s=90;else if(p._t.indexOf(t)>=0)s=70;
        else if(p._h.indexOf(t)>=0)s=40;else if(p._x.indexOf(t)>=0)s=15;
        if(!s)return null;sc+=s}
      return{p:p,s:sc}}).filter(Boolean).sort(function(a,b){return b.s-a.s}).slice(0,30);
    if(!hits.length){list.innerHTML='<li class="pal-empty">No results for “'+esc(input.value)+'”.</li>';return}
    list.innerHTML=hits.map(function(h,i){return'<li role="option"><a href="'+root+h.p.u+'"'+(i===0?' class="on"':'')+'><span class="r-t"><span>'+hl(h.p.t,terms)+'</span><span class="r-s">'+esc(h.p.s)+'</span></span><span class="r-x">'+hl(snippet(h.p,terms),terms)+'</span></a></li>'}).join('');
    active=0;
  },function(){list.innerHTML='<li class="pal-empty">Search needs the site to be served over http(s).</li>'});
}
var lastFocus=null;
function open(){if(!pal)build();lastFocus=document.activeElement;pal.classList.add('open');document.documentElement.style.overflow='hidden';input.focus();input.select();load();run()}
function close(){if(!pal)return;pal.classList.remove('open');document.documentElement.style.overflow='';lastFocus&&lastFocus.focus&&lastFocus.focus()}
document.addEventListener('click',function(e){if(e.target.closest('[data-search]')){e.preventDefault();open()}});
document.addEventListener('keydown',function(e){
  var t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
  if((e.key==='k'||e.key==='K')&&(e.ctrlKey||e.metaKey)){e.preventDefault();pal&&pal.classList.contains('open')?close():open()}
  else if(e.key==='/'&&!typing){e.preventDefault();open()}
  else if(e.key==='Escape'){if(pal&&pal.classList.contains('open'))close();else if(body.classList.contains('nav-open'))nav(false)}
});
var kb=$$('.search-btn kbd');if(/Mac|iPhone|iPad/.test(navigator.platform||''))kb.forEach(function(k){k.textContent='⌘ K'});
})();
