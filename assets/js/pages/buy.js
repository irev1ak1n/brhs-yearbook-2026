const kEl=document.getElementById('kicker');
'BRHS Yearbook — 2027'.split('').forEach((c,i)=>{
    const s=document.createElement('span');
    s.className='ch';s.textContent=c===' '?'\u00A0':c;
    s.style.animationDelay=`${.05+i*.033}s`;
    kEl.appendChild(s);
});

const rc=document.getElementById('c-room'),rx=rc.getContext('2d');
let RW,RH;
function rsR(){RW=rc.width=window.innerWidth;RH=rc.height=window.innerHeight}
rsR();window.addEventListener('resize',rsR);
const CANDLES=[
    {x:.15,y:.35,r:.38,phase:0,spd:.004,base:.08,track:false},
    {x:.85,y:.28,r:.32,phase:1.5,spd:.006,base:.06,track:false},
    {x:.5,y:.4,r:.52,phase:3.1,spd:.003,base:.1,track:true},
];
let mouseRX=.5,mouseRY=.4;
window.addEventListener('mousemove',e=>{mouseRX=e.clientX/window.innerWidth;mouseRY=e.clientY/window.innerHeight},{passive:true});
let RT=0;
function roomLoop(){
    rx.clearRect(0,0,RW,RH);
    const bg=rx.createRadialGradient(RW*.5,RH*.35,0,RW*.5,RH*.35,RW*.75);
    bg.addColorStop(0,'rgba(38,20,8,.0)');bg.addColorStop(.4,'rgba(18,10,4,.5)');bg.addColorStop(1,'rgba(8,4,1,.85)');
    rx.fillStyle=bg;rx.fillRect(0,0,RW,RH);
    RT++;
    CANDLES.forEach(c=>{
        c.phase+=c.spd;
        if(c.track){c.x+=(mouseRX-c.x)*.04;c.y+=(mouseRY-c.y)*.04}
        const flicker=c.base+.028*Math.sin(c.phase*7)+.018*Math.sin(c.phase*13)+.01*Math.sin(c.phase*23);
        const cx2=c.x*RW,cy=c.y*RH,cr=c.r*RW;
        const g=rx.createRadialGradient(cx2,cy,0,cx2,cy,cr);
        g.addColorStop(0,`rgba(255,190,90,${(flicker*1.2).toFixed(3)})`);
        g.addColorStop(.18,`rgba(220,130,40,${(flicker*.7).toFixed(3)})`);
        g.addColorStop(.5,`rgba(160,70,10,${(flicker*.3).toFixed(3)})`);
        g.addColorStop(1,'rgba(100,30,0,0)');
        rx.beginPath();rx.arc(cx2,cy,cr,0,Math.PI*2);rx.fillStyle=g;rx.fill();
    });
    const vig=rx.createRadialGradient(RW*.5,RH*.4,RH*.1,RW*.5,RH*.4,RW*.85);
    vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(.55,'rgba(0,0,0,.35)');vig.addColorStop(1,'rgba(0,0,0,.82)');
    rx.fillStyle=vig;rx.fillRect(0,0,RW,RH);
    requestAnimationFrame(roomLoop);
}
roomLoop();

const fc2=document.getElementById('c-fire'),fx2=fc2.getContext('2d');
let FW,FH;
function rsF(){FW=fc2.width=window.innerWidth;FH=fc2.height=window.innerHeight}
rsF();window.addEventListener('resize',rsF);
class Flame{
    constructor(x){
        this.x=x;this.y=FH;
        this.vx=(Math.random()-.5)*1.4;this.vy=-(Math.random()*3+1.5);
        this.life=0;this.ml=Math.floor(Math.random()*80+50);
        this.r=Math.random()*24+8;this.w=Math.random()*Math.PI*2;this.ws=(Math.random()-.5)*.1;
    }
    tick(){this.life++;this.w+=this.ws;this.x+=this.vx+Math.sin(this.w)*.7;this.y+=this.vy;this.vy*=.984;this.r*=.987}
    get alpha(){const p=this.life/this.ml;return p<.15?p/.15:p>.55?1-(p-.55)/.45:1}
    draw(){
        const a=this.alpha;if(a<=0||this.r<.5)return;
        const p=this.life/this.ml;
        let r2,g2,b2;
        if(p<.15){r2=255;g2=240;b2=180}
        else if(p<.4){r2=255;g2=Math.floor(240-(p-.15)/.25*160);b2=0}
        else{r2=Math.floor(255-(p-.4)/.6*130);g2=Math.floor(80-(p-.4)/.6*80);b2=0}
        const grd=fx2.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r);
        grd.addColorStop(0,`rgba(${r2},${g2},${b2},${(a*.5).toFixed(2)})`);
        grd.addColorStop(.5,`rgba(${r2},${Math.floor(g2*.55)},0,${(a*.2).toFixed(2)})`);
        grd.addColorStop(1,'rgba(120,0,0,0)');
        fx2.beginPath();fx2.arc(this.x,this.y,this.r,0,Math.PI*2);fx2.fillStyle=grd;fx2.fill();
    }
}
const EMIT=Array.from({length:32},(_,i)=>{return{x:(i/31)*(window.innerWidth||1400),t:Math.floor(Math.random()*15)}});
const FLAMES=Array.from({length:50},()=>new Flame(Math.random()*(window.innerWidth||1400)));
function fireLoop(){
    fx2.clearRect(0,0,FW,FH);
    EMIT.forEach(e=>{
        e.t++;
        if(e.t>7){e.t=0;e.x+=(Math.random()-.5)*50;e.x=Math.max(0,Math.min(FW,e.x));FLAMES.push(new Flame(e.x+(Math.random()-.5)*70));}
    });
    for(let i=FLAMES.length-1;i>=0;i--){
        FLAMES[i].tick();FLAMES[i].draw();
        if(FLAMES[i].life>=FLAMES[i].ml||FLAMES[i].r<.4)FLAMES.splice(i,1);
    }
    const eg=fx2.createLinearGradient(0,FH-80,0,FH);
    eg.addColorStop(0,'rgba(200,70,10,0)');eg.addColorStop(1,'rgba(160,50,5,.15)');
    fx2.fillStyle=eg;fx2.fillRect(0,FH-80,FW,80);
    requestAnimationFrame(fireLoop);
}
fireLoop();

const dc=document.getElementById('c-dust'),dx=dc.getContext('2d');
let DW,DH;
function rsD(){DW=dc.width=window.innerWidth;DH=dc.height=window.innerHeight}
rsD();window.addEventListener('resize',rsD);
class Mote{
    constructor(init){this.reset(init)}
    reset(init){
        this.x=Math.random()*DW;
        this.y=init?Math.random()*DH:DH+10;
        this.r=Math.random()*1.8+.3;
        this.vx=(Math.random()-.5)*.55;this.vy=-(Math.random()*.8+.2);
        this.life=0;this.ml=Math.floor(Math.random()*600+300);
        this.w=Math.random()*Math.PI*2;this.ws=(Math.random()-.5)*.025;
        this.isEmber=this.r>1.3;this.isPage=!this.isEmber&&Math.random()<.2;
        if(init)this.life=Math.floor(Math.random()*this.ml);
        this.maxA=this.isEmber?.7:this.isPage?.18:.35;
    }
    tick(){
        this.life++;this.w+=this.ws;
        this.x+=this.vx+Math.sin(this.w)*.4;this.y+=this.vy;
        if(this.life>this.ml||this.y<-15)this.reset(false);
    }
    get alpha(){const p=this.life/this.ml;return(p<.1?p/.1:p>.8?(1-(p-.8)/.2):1)*this.maxA}
    draw(){
        const a=this.alpha;if(a<=0)return;
        if(this.isEmber){
            const flk=.6+.4*Math.abs(Math.sin(this.w*4));
            const eg=dx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*4);
            eg.addColorStop(0,`rgba(255,${Math.floor(160+80*flk)},30,${(a*.5).toFixed(2)})`);
            eg.addColorStop(1,'rgba(255,80,0,0)');
            dx.beginPath();dx.arc(this.x,this.y,this.r*4,0,Math.PI*2);dx.fillStyle=eg;dx.fill();
            dx.beginPath();dx.arc(this.x,this.y,this.r,0,Math.PI*2);
            dx.fillStyle=`rgba(255,${Math.floor(200+55*flk)},60,${(a*flk).toFixed(2)})`;dx.fill();
        } else if(this.isPage){
            dx.save();dx.translate(this.x,this.y);dx.rotate(this.w*2);
            dx.fillStyle=`rgba(240,225,190,${(a*.9).toFixed(2)})`;dx.fillRect(-3,-2,6,4);dx.restore();
        } else {
            dx.beginPath();dx.arc(this.x,this.y,this.r*.6,0,Math.PI*2);
            dx.fillStyle=`rgba(200,175,130,${(a*1.2).toFixed(2)})`;dx.fill();
        }
    }
}
const MOTES=Array.from({length:220},()=>new Mote(true));
function dustLoop(){dx.clearRect(0,0,DW,DH);MOTES.forEach(m=>{m.tick();m.draw()});requestAnimationFrame(dustLoop)}
dustLoop();

const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
        if(!e.isIntersecting)return;
        const el=e.target,d=Number(el.dataset.delay||0);
        setTimeout(()=>el.classList.add('in'),d);
        io.unobserve(el);
    });
},{threshold:.08});
['ew1','sh1','ew2','sh2'].forEach(id=>{const el=document.getElementById(id);if(el)io.observe(el)});
[1,2,3,4].forEach((n,i)=>{
    const row=document.getElementById('zr'+n);if(!row)return;
    const card=row.querySelector('.zig-card');
    if(card){card.dataset.delay=i*130;io.observe(card)}
    new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)setTimeout(()=>row.classList.add('dot-lit'),i*130+300)});},{threshold:.08}).observe(card||row);
});
const zigEl=document.getElementById('zig');
if(zigEl)new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)setTimeout(()=>zigEl.classList.add('filled'),200)})},{threshold:.04}).observe(zigEl);
const db=document.querySelector('.deadline-box');if(db)io.observe(db);

(function(){
    const wrap=document.getElementById('pickup-book-wrap');
    const flip=document.getElementById('pb-flip');
    const bm=document.getElementById('pb-bm');
    const shadow=document.getElementById('pb-shadow');
    const hint=document.getElementById('pb-hint');
    const btnNext=document.getElementById('pb-next');
    const btnPrev=document.getElementById('pb-prev');
    if(!flip||!bm||!shadow||!hint||!btnNext||!btnPrev)return;
    let isOpen=false,flipping=false;
    function setOpen(open){
        if(flipping||open===isOpen)return;
        flipping=true;isOpen=open;
        flip.classList.add('turning');
        flip.classList.toggle('open',open);
        shadow.style.transform='scaleX(.75)';shadow.style.opacity='.6';
        spawnPageDust();
        setTimeout(()=>{
            flip.classList.remove('turning');
            shadow.style.transform='';shadow.style.opacity='';
            hint.textContent=open?'click again to close':'click a page or use arrows to flip';
            flipping=false;
        },760);
    }
    flip.addEventListener('click',()=>setOpen(!isOpen));
    btnNext.addEventListener('click',()=>setOpen(true));
    btnPrev.addEventListener('click',()=>setOpen(false));
    bm.addEventListener('click',e=>{e.stopPropagation();bm.classList.toggle('tucked')});
    document.addEventListener('keydown',e=>{
        if(!wrap)return;
        const r=wrap.getBoundingClientRect();
        if(r.top>window.innerHeight||r.bottom<0)return;
        if(e.key==='ArrowRight')setOpen(true);
        if(e.key==='ArrowLeft')setOpen(false);
    });
    const bookEl=document.getElementById('pickup-book');
    if(bookEl){
        bookEl.addEventListener('mousemove',e=>{
            const r=bookEl.getBoundingClientRect();
            const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
            bookEl.style.transition='transform .1s ease';
            bookEl.style.transform=`perspective(1000px) rotateX(${-y*6}deg) rotateY(${x*8}deg)`;
        });
        bookEl.addEventListener('mouseleave',()=>{
            bookEl.style.transition='transform .5s cubic-bezier(.16,1,.3,1)';
            bookEl.style.transform='';
        });
    }
    if(wrap)new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)wrap.classList.add('in')})},{threshold:.1}).observe(wrap);
    function spawnPageDust(){
        if(typeof MOTES==='undefined')return;
        const r=flip.getBoundingClientRect();
        const cx=r.left+r.width*.1,cy=r.top+r.height*.5;
        for(let i=0;i<22;i++){
            const m=new Mote(false);
            m.x=cx+(Math.random()-.5)*50;m.y=cy+(Math.random()-.5)*60;
            m.isPage=true;m.isEmber=false;m.vx=(Math.random()-.5)*2.5;
            m.vy=-(Math.random()*2.5+.8);m.maxA=.5;m.ml=55+Math.floor(Math.random()*45);m.life=0;
            MOTES.push(m);
        }
    }
})();

document.querySelectorAll('.zig-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        card.style.transform=`perspective(600px) rotateY(${x*12}deg) rotateX(${-y*10}deg) translateZ(8px)`;
    });
    card.addEventListener('mouseleave',()=>{card.style.transform='';card.style.transition='opacity .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1),border-color .3s,box-shadow .3s'});
    card.addEventListener('mouseenter',()=>{card.style.transition='transform .15s ease,border-color .3s,box-shadow .3s'});
});

window.addEventListener('scroll',()=>{
    const hi=document.querySelector('.hero-inner');
    if(hi)hi.style.transform=`translateY(${scrollY*.15}px)`;
},{passive:true});

function initPostDOM(){
    const lampBtn=document.getElementById('lamp-btn');
    if(lampBtn)lampBtn.addEventListener('click',()=>document.body.classList.toggle('lamp-off'));
    window.addEventListener('scroll',()=>{
        const docH=document.documentElement.scrollHeight-window.innerHeight;
        const pct=docH>0?(scrollY/docH*100).toFixed(1):0;
        const rb=document.getElementById('read-bar');
        if(rb)rb.style.width=pct+'%';
    },{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPostDOM);
else initPostDOM();