/* ══════════════════════════════════════
   CUSTOM SELECT
   Progressively enhances a native <select> with a themed dropdown so the
   operating system's white/blue native menu never appears. The native
   <select> stays in the DOM (visually hidden) as the single source of
   truth — existing code that reads `.value` or listens for "change" on
   it keeps working unmodified. Call syncCustomSelect() again any time
   the underlying <select>'s options or value change programmatically
   (e.g. after repopulating it, or after setting .value in code).
══════════════════════════════════════ */
function syncCustomSelect(select){
    if(typeof select === 'string') select = document.getElementById(select);
    if(!select) return;

    let wrap = select.closest('.dash-select');

    if(!wrap){
        wrap = document.createElement('div');
        wrap.className = 'dash-select';
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        select.classList.add('dash-select-native');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'dash-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML =
            '<span class="dash-select-value"></span>' +
            '<svg class="dash-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
        wrap.appendChild(trigger);

        const panel = document.createElement('div');
        panel.className = 'dash-select-panel';
        panel.setAttribute('role', 'listbox');
        wrap.appendChild(panel);

        const valueEl = trigger.querySelector('.dash-select-value');

        // a <label for="..."> pointing at the (now hidden) native select
        // should still land the user on the visible trigger
        select.addEventListener('focus', ()=> trigger.focus());

        let activeIndex = -1;

        const options = () => [...panel.querySelectorAll('.dash-select-option')];

        function isOpen(){ return wrap.classList.contains('is-open'); }

        function open(){
            if(select.disabled || options().length === 0) return;
            document.querySelectorAll('.dash-select.is-open').forEach(other=>{
                if(other !== wrap) other.classList.remove('is-open');
            });
            wrap.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            const opts = options();
            activeIndex = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
            highlight(activeIndex < 0 ? 0 : activeIndex);
        }

        function close(){
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }

        function toggle(){ isOpen() ? close() : open(); }

        function highlight(i){
            const opts = options();
            opts.forEach(o=> o.classList.remove('is-active'));
            if(opts[i]){
                opts[i].classList.add('is-active');
                opts[i].scrollIntoView({ block: 'nearest' });
            }
            activeIndex = i;
        }

        function choose(i){
            const opts = options();
            const opt = opts[i];
            if(!opt) return;
            select.value = opt.dataset.value;
            opts.forEach(o=> o.removeAttribute('aria-selected'));
            opt.setAttribute('aria-selected', 'true');
            valueEl.textContent = opt.textContent;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
            close();
            trigger.focus();
        }

        trigger.addEventListener('click', toggle);

        trigger.addEventListener('keydown', e=>{
            if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)) e.preventDefault();
            if(e.key === 'ArrowDown'){
                isOpen() ? highlight(Math.min(activeIndex + 1, options().length - 1)) : open();
            } else if(e.key === 'ArrowUp'){
                isOpen() ? highlight(Math.max(activeIndex - 1, 0)) : open();
            } else if(e.key === 'Enter' || e.key === ' '){
                isOpen() ? choose(activeIndex) : open();
            } else if(e.key === 'Escape'){
                close();
            } else if(e.key === 'Tab'){
                close();
            }
        });

        panel.addEventListener('click', e=>{
            const opt = e.target.closest('.dash-select-option');
            if(opt) choose(options().indexOf(opt));
        });
        panel.addEventListener('mousemove', e=>{
            const opt = e.target.closest('.dash-select-option');
            if(opt) highlight(options().indexOf(opt));
        });

        document.addEventListener('click', e=>{
            if(isOpen() && !wrap.contains(e.target)) close();
        });
        document.addEventListener('keydown', e=>{
            if(e.key === 'Escape' && isOpen()) close();
        }, true);
        window.addEventListener('resize', ()=>{ if(isOpen()) close(); });
        window.addEventListener('scroll', ()=>{ if(isOpen()) close(); }, true);
    }

    // (re)build the option panel + trigger label from the native select's current state
    const trigger = wrap.querySelector('.dash-select-trigger');
    const panel = wrap.querySelector('.dash-select-panel');
    const valueEl = trigger.querySelector('.dash-select-value');

    panel.innerHTML = '';
    [...select.options].forEach(opt=>{
        const el = document.createElement('div');
        el.className = 'dash-select-option';
        el.setAttribute('role', 'option');
        el.dataset.value = opt.value;
        el.textContent = opt.textContent;
        if(opt.value === select.value) el.setAttribute('aria-selected', 'true');
        panel.appendChild(el);
    });

    const selectedOption = select.options[select.selectedIndex];
    valueEl.textContent = selectedOption ? selectedOption.textContent : '';
    trigger.disabled = !!select.disabled;
    wrap.classList.toggle('is-disabled', !!select.disabled);
}
