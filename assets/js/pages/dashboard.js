/* ══════════════════════════════════════
   BRHS YEARBOOK DASHBOARD
   Ms. McNelis logs in with one password (Supabase Auth under the hood,
   using a fixed staff account email she never sees). All content reads
   are public; all writes require this authenticated session, enforced
   by Row Level Security on the database and storage buckets — never by
   client-side code alone.
══════════════════════════════════════ */
const DASHBOARD_EMAIL = 'mcnelis@brhsyearbook-dashboard.local';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, matches the storage bucket limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_DIMENSION = 2000;

const sb = () => getSupabaseClient();

/* ══ TOASTS ══ */
function showToast(message, type){
    const wrap = document.getElementById('toastWrap');
    const toast = document.createElement('div');
    toast.className = `dash-toast ${type === 'error' ? 'error' : 'success'}`;
    const icon = type === 'error'
        ? '<svg class="dash-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
        : '<svg class="dash-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    wrap.appendChild(toast);
    setTimeout(()=>{
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(24px)';
        toast.style.transition = 'opacity .3s ease, transform .3s ease';
        setTimeout(()=> toast.remove(), 320);
    }, 4200);
}

function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

/* ══ MODALS ══ */
function openModal(id){ document.getElementById(id).hidden = false; }
function closeModal(id){ document.getElementById(id).hidden = true; }

document.querySelectorAll('[data-close-modal]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeModal(btn.dataset.closeModal));
});
document.querySelectorAll('.dash-modal-overlay').forEach(overlay=>{
    overlay.addEventListener('click', e=>{
        if(e.target === overlay) overlay.hidden = true;
    });
});

let pendingDelete = null;
function confirmDelete(message, onConfirm){
    document.getElementById('deleteConfirmText').textContent = message;
    pendingDelete = onConfirm;
    openModal('deleteConfirmModal');
}
document.getElementById('deleteConfirmBtn').addEventListener('click', async ()=>{
    if(!pendingDelete) return;
    const fn = pendingDelete;
    pendingDelete = null;
    closeModal('deleteConfirmModal');
    await fn();
});

/* ══ IMAGE VALIDATION + COMPRESSION ══ */
function validateImageFile(file){
    if(!ALLOWED_TYPES.includes(file.type)){
        return 'Only JPG, PNG, or WEBP images are allowed.';
    }
    if(file.size > MAX_FILE_SIZE){
        return 'That photo is larger than 10MB. Please choose a smaller file.';
    }
    return null;
}

/* Resizes/re-encodes an image client-side so uploads stay small and
   fast on slower school Wi-Fi. Always outputs a JPEG blob. */
function compressImage(file){
    return new Promise((resolve, reject)=>{
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            let { width, height } = img;
            if(width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION){
                const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob=>{
                URL.revokeObjectURL(objectUrl);
                if(!blob) return reject(new Error('Could not process image'));
                resolve(blob);
            }, 'image/jpeg', 0.82);
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not read image'));
        };
        img.src = objectUrl;
    });
}

function sanitizeFilename(name){
    return name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
}

function randomId(){
    return Math.random().toString(36).slice(2, 9);
}

/* Uploads a blob straight to Supabase Storage over XHR so we get real
   byte-level progress (the supabase-js helper doesn't expose progress
   events), and reads/writes go through the authenticated session so
   Row Level Security lets the write through. */
function uploadFileWithProgress(bucket, path, blob, onProgress){
    return new Promise(async (resolve, reject)=>{
        const { data: sessionData } = await sb().auth.getSession();
        const token = sessionData?.session?.access_token;
        if(!token) return reject(new Error('Your session expired. Please log in again.'));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BRHS_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, true);
        xhr.setRequestHeader('apikey', BRHS_SUPABASE_ANON_KEY);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e)=>{
            if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            if(xhr.status >= 200 && xhr.status < 300){
                resolve();
            } else {
                let msg = 'Upload failed';
                try { msg = JSON.parse(xhr.responseText).message || msg; } catch(e){}
                reject(new Error(msg));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'));
        xhr.send(blob);
    });
}

function publicUrlFor(bucket, path){
    return `${BRHS_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/* Deletes a storage object only if the URL is actually one of ours
   (legacy content lives at /assets/... on the static site, not in
   Supabase Storage, and should never be touched here). */
async function deleteStorageObjectFromUrl(bucket, url){
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if(idx === -1) return;
    const path = url.slice(idx + marker.length);
    try {
        await sb().storage.from(bucket).remove([path]);
    } catch(e){
        console.error('Could not remove storage object', e);
    }
}

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
async function checkSession(){
    const { data } = await sb().auth.getSession();
    if(data?.session){
        showApp();
    } else {
        showLogin();
    }
}

function showLogin(){
    document.getElementById('loginView').hidden = false;
    document.getElementById('appView').hidden = true;
}

function showApp(){
    document.getElementById('loginView').hidden = true;
    document.getElementById('appView').hidden = false;
    goto('home');
    refreshHomeCounts();
}

document.getElementById('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const btnText = document.getElementById('loginBtnText');
    const errorEl = document.getElementById('loginError');
    errorEl.hidden = true;
    btn.disabled = true;
    btnText.innerHTML = '<span class="dash-spinner"></span>';

    const { error } = await sb().auth.signInWithPassword({ email: DASHBOARD_EMAIL, password });

    btn.disabled = false;
    btnText.textContent = 'Unlock Dashboard';

    if(error){
        errorEl.textContent = 'Incorrect password. Please try again.';
        errorEl.hidden = false;
        return;
    }

    document.getElementById('loginPassword').value = '';
    showApp();
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    await sb().auth.signOut();
    showLogin();
});

document.getElementById('changePasswordBtn').addEventListener('click', ()=>{
    document.getElementById('changePasswordForm').reset();
    document.getElementById('changePasswordError').hidden = true;
    openModal('changePasswordModal');
});

document.getElementById('changePasswordForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pw = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('changePasswordError');
    if(pw !== confirm){
        errorEl.textContent = 'Passwords do not match.';
        errorEl.hidden = false;
        return;
    }
    const btn = document.getElementById('changePasswordSubmitBtn');
    btn.disabled = true;
    const { error } = await sb().auth.updateUser({ password: pw });
    btn.disabled = false;
    if(error){
        errorEl.textContent = error.message || 'Could not update password.';
        errorEl.hidden = false;
        return;
    }
    closeModal('changePasswordModal');
    showToast('Password updated.', 'success');
});

/* ══════════════════════════════════════
   VIEW ROUTING
══════════════════════════════════════ */
const VIEWS = ['home', 'sports', 'friday', 'seniors'];
function goto(view){
    VIEWS.forEach(v=>{
        document.getElementById(`${v}View`).hidden = (v !== view);
    });
    if(view === 'sports') refreshSportsView();
    if(view === 'friday') refreshFridayView();
    if(view === 'seniors') refreshSeniorsView();
    if(view === 'home') refreshHomeCounts();
    window.scrollTo(0, 0);
}
document.querySelectorAll('[data-goto]').forEach(el=>{
    el.addEventListener('click', ()=> goto(el.dataset.goto));
});

async function refreshHomeCounts(){
    const [sportPhotos, fridayPhotos, seniors] = await Promise.all([
        sb().from('sport_photos').select('id', { count: 'exact', head: true }),
        sb().from('happy_friday_photos').select('id', { count: 'exact', head: true }),
        sb().from('seniors').select('id', { count: 'exact', head: true }),
    ]);
    document.getElementById('sportsCount').textContent = `${sportPhotos.count ?? 0} uploaded photo${sportPhotos.count === 1 ? '' : 's'}`;
    document.getElementById('fridayCount').textContent = `${fridayPhotos.count ?? 0} uploaded photo${fridayPhotos.count === 1 ? '' : 's'}`;
    document.getElementById('seniorsCount').textContent = `${seniors.count ?? 0} senior profile${seniors.count === 1 ? '' : 's'}`;
}

/* ══════════════════════════════════════
   BULK PHOTO SELECTION
   Shared by the Sports and Happy Friday galleries (main grid + hidden
   grid = 4 independent selections). Selection is tracked as a plain Set
   of photo ids, kept separate from the rendered DOM so a full re-render
   never loses track of what's checked — it's cleared explicitly instead,
   any time the underlying photo list changes (new data load or a filter
   change), since ids that scroll out of a filter shouldn't stay silently
   selected in the background.
══════════════════════════════════════ */
function createPhotoSelection(){
    return { ids: new Set() };
}

function toggleSelection(selection, id, checked){
    checked ? selection.ids.add(id) : selection.ids.delete(id);
}

/* Wires a "select all" checkbox + per-card checkboxes (delegated) + bulk
   action buttons for one grid. `getVisible()` must return the array of
   currently-rendered photo objects (post-filter) so "select all" only
   ever affects what's actually on screen. */
function wireBulkBar({ gridId, selectAllId, countId, actionsId, selection, getVisible, onAction }){
    const grid = document.getElementById(gridId);
    const selectAll = document.getElementById(selectAllId);

    grid.addEventListener('change', e=>{
        const checkbox = e.target.closest('.dash-card-checkbox');
        if(!checkbox) return;
        toggleSelection(selection, checkbox.dataset.id, checkbox.checked);
        checkbox.closest('.dash-card')?.classList.toggle('is-selected', checkbox.checked);
        updateBulkBarUI({ selectAllId, countId, actionsId, selection, getVisible });
    });

    selectAll.addEventListener('change', ()=>{
        const visible = getVisible();
        if(selectAll.checked){
            visible.forEach(p=> selection.ids.add(p.id));
        } else {
            visible.forEach(p=> selection.ids.delete(p.id));
        }
        grid.querySelectorAll('.dash-card-checkbox').forEach(cb=>{
            cb.checked = selection.ids.has(cb.dataset.id);
            cb.closest('.dash-card')?.classList.toggle('is-selected', cb.checked);
        });
        updateBulkBarUI({ selectAllId, countId, actionsId, selection, getVisible });
    });

    document.getElementById(actionsId).addEventListener('click', e=>{
        const btn = e.target.closest('[data-bulk-action]');
        if(btn) onAction(btn.dataset.bulkAction);
    });
}

/* Recomputes "select all" checked/indeterminate state, the selected
   count, and which bulk-action buttons are relevant for what's selected. */
function updateBulkBarUI({ selectAllId, countId, actionsId, selection, getVisible }){
    const selectAll = document.getElementById(selectAllId);
    const countEl = document.getElementById(countId);
    const actionsEl = document.getElementById(actionsId);

    const visible = getVisible();
    const visibleSelected = visible.filter(p=> selection.ids.has(p.id));

    selectAll.checked = visible.length > 0 && visibleSelected.length === visible.length;
    selectAll.indeterminate = visibleSelected.length > 0 && visibleSelected.length < visible.length;

    const count = selection.ids.size;
    countEl.textContent = `${count} selected`;
    countEl.hidden = count === 0;
    actionsEl.hidden = count === 0;

    const hideBtn = actionsEl.querySelector('[data-bulk-action="hide"]');
    if(hideBtn){
        const hasLegacy = visible.some(p=> selection.ids.has(p.id) && p.source === 'legacy');
        hideBtn.hidden = !hasLegacy;
    }
    const deleteBtn = actionsEl.querySelector('[data-bulk-action="delete"]');
    if(deleteBtn){
        const hasDashboard = visible.some(p=> selection.ids.has(p.id) && p.source === 'dashboard');
        deleteBtn.hidden = !hasDashboard;
    }
}

function clearSelectionUI(selectAllId, countId, actionsId){
    const selectAll = document.getElementById(selectAllId);
    selectAll.checked = false;
    selectAll.indeterminate = false;
    document.getElementById(countId).hidden = true;
    document.getElementById(actionsId).hidden = true;
}

/* ══════════════════════════════════════
   SPORTS VIEW
══════════════════════════════════════ */
let sportsCache = [];
let sportPendingFiles = []; // {file, blobPromise, previewUrl}
let sportSelection = createPhotoSelection();
let sportHiddenSelection = createPhotoSelection();

async function loadSportsList(){
    const { data, error } = await sb().from('sports').select('*').order('display_order', { ascending: true });
    if(error){ showToast('Could not load sports list.', 'error'); return []; }
    sportsCache = data || [];
    return sportsCache;
}

function populateSportSelects(){
    const uploadSelect = document.getElementById('sportUploadSelect');
    const filterSelect = document.getElementById('sportFilterSelect');
    uploadSelect.innerHTML = sportsCache.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    filterSelect.innerHTML = '<option value="all">All Sports</option>' +
        sportsCache.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    syncCustomSelect(uploadSelect);
    syncCustomSelect(filterSelect);
}

async function refreshSportsView(){
    await loadSportsList();
    populateSportSelects();
    await loadSportPhotoGrid();
}

document.getElementById('addSportBtn').addEventListener('click', ()=>{
    document.getElementById('addSportForm').reset();
    document.getElementById('addSportError').hidden = true;
    openModal('addSportModal');
});

document.getElementById('addSportForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('newSportName').value.trim();
    const orderInput = document.getElementById('newSportOrder').value;
    const errorEl = document.getElementById('addSportError');
    errorEl.hidden = true;

    if(!name){
        errorEl.textContent = 'Please enter a sport name.';
        errorEl.hidden = false;
        return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const maxOrder = sportsCache.reduce((m, s)=> Math.max(m, s.display_order || 0), 0);
    const displayOrder = orderInput ? Number(orderInput) : maxOrder + 1;

    const btn = document.getElementById('addSportSubmitBtn');
    btn.disabled = true;
    const { error } = await sb().from('sports').insert({ name, slug, display_order: displayOrder });
    btn.disabled = false;

    if(error){
        errorEl.textContent = error.code === '23505'
            ? 'A sport with a similar name already exists.'
            : (error.message || 'Could not add sport.');
        errorEl.hidden = false;
        return;
    }

    closeModal('addSportModal');
    showToast(`"${name}" was added and now appears as a filter on the public Sports page.`, 'success');
    await refreshSportsView();
});

/* ── dropzone (shared logic reused for both sports + friday) ── */
function wireDropzone(dropzoneId, fileInputId, onFiles){
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(fileInputId);

    dropzone.addEventListener('click', ()=> input.click());
    input.addEventListener('change', ()=>{
        onFiles([...input.files]);
        input.value = '';
    });
    ['dragenter','dragover'].forEach(evt=>{
        dropzone.addEventListener(evt, e=>{
            e.preventDefault();
            dropzone.classList.add('is-dragover');
        });
    });
    ['dragleave','drop'].forEach(evt=>{
        dropzone.addEventListener(evt, e=>{
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
        });
    });
    dropzone.addEventListener('drop', e=>{
        const files = [...(e.dataTransfer?.files || [])];
        onFiles(files);
    });
}

function renderPreviewGrid(gridId, pending, onRemove){
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    pending.forEach((item, i)=>{
        const cell = document.createElement('div');
        cell.className = 'dash-preview-item';
        cell.innerHTML = `
            <img src="${item.previewUrl}" alt="">
            <div class="dash-preview-remove" data-i="${i}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </div>
            <div class="dash-preview-status" data-role="status"></div>
            <div class="dash-preview-progress"><div class="dash-preview-progress-bar" data-role="bar"></div></div>
        `;
        cell.querySelector('.dash-preview-remove').addEventListener('click', ()=> onRemove(i));
        grid.appendChild(cell);
    });
}

function addPendingFiles(fileList, pendingArr, gridId, optionsId, uploadBtnId, onChange){
    for(const file of fileList){
        const err = validateImageFile(file);
        if(err){
            showToast(`${file.name}: ${err}`, 'error');
            continue;
        }
        pendingArr.push({ file, previewUrl: URL.createObjectURL(file), status: 'pending', progress: 0 });
    }
    onChange();
    document.getElementById(optionsId).hidden = pendingArr.length === 0;
    document.getElementById(uploadBtnId).hidden = pendingArr.length === 0;
}

function removeSportPreview(i){
    sportPendingFiles.splice(i, 1);
    renderPreviewGrid('sportPreviewGrid', sportPendingFiles, removeSportPreview);
    document.getElementById('sportUploadOptions').hidden = sportPendingFiles.length === 0;
    document.getElementById('sportUploadBtn').hidden = sportPendingFiles.length === 0;
}

wireDropzone('sportDropzone', 'sportFileInput', files=>{
    addPendingFiles(files, sportPendingFiles, 'sportPreviewGrid', 'sportUploadOptions', 'sportUploadBtn', ()=>{
        renderPreviewGrid('sportPreviewGrid', sportPendingFiles, removeSportPreview);
    });
});

document.getElementById('sportUploadBtn').addEventListener('click', async ()=>{
    const sportId = document.getElementById('sportUploadSelect').value;
    const sport = sportsCache.find(s=> s.id === sportId);
    if(!sport){ showToast('Choose a sport first.', 'error'); return; }
    const season = document.getElementById('sportSeasonSelect').value;
    const caption = document.getElementById('sportCaptionInput').value.trim() || null;
    const btn = document.getElementById('sportUploadBtn');
    btn.disabled = true;

    const grid = document.getElementById('sportPreviewGrid');
    const cells = [...grid.children];

    let successCount = 0;
    for(let i = 0; i < sportPendingFiles.length; i++){
        const item = sportPendingFiles[i];
        const cell = cells[i];
        const bar = cell?.querySelector('[data-role="bar"]');
        const statusEl = cell?.querySelector('[data-role="status"]');
        try {
            const blob = await compressImage(item.file);
            const path = `${sport.slug}/${Date.now()}-${randomId()}-${sanitizeFilename(item.file.name)}.jpg`;
            await uploadFileWithProgress('sport-photos', path, blob, pct=>{ if(bar) bar.style.width = pct + '%'; });
            const imageUrl = publicUrlFor('sport-photos', path);
            const { error } = await sb().from('sport_photos').insert({
                sport_id: sport.id, storage_path: path, image_url: imageUrl, caption, season,
            });
            if(error) throw error;
            successCount++;
            if(statusEl){
                statusEl.classList.add('is-visible', 'status-ok');
                statusEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            }
        } catch(e){
            console.error(e);
            if(statusEl){
                statusEl.classList.add('is-visible', 'status-error');
                statusEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
            }
        }
    }

    btn.disabled = false;
    if(successCount > 0){
        showToast(`${successCount} photo${successCount === 1 ? '' : 's'} uploaded to ${sport.name}.`, 'success');
    }
    if(successCount < sportPendingFiles.length){
        showToast('Some photos could not be uploaded. Please try them again.', 'error');
    }

    sportPendingFiles = [];
    renderPreviewGrid('sportPreviewGrid', sportPendingFiles, ()=>{});
    document.getElementById('sportUploadOptions').hidden = true;
    document.getElementById('sportUploadBtn').hidden = true;
    document.getElementById('sportCaptionInput').value = '';
    await loadSportPhotoGrid();
    refreshHomeCounts();
});

let sportPhotosCache = []; // merged legacy (on-disk) + dashboard-uploaded photos
let sportGridFilters = { sport: 'all', year: 'all' };
const DASH_LEGACY_BASE_PATH = '../assets/images/gallery/';

/* Probes every sport's on-disk folder (same logic the public page uses)
   so legacy photos show up here even though they were never uploaded
   through the dashboard. */
async function loadLegacySportPhotos(){
    const lists = await Promise.all(sportsCache.map(async sport=>{
        const paths = await gatherLegacyFolderPhotos(DASH_LEGACY_BASE_PATH, sport.folder, sport.prefix);
        return paths.map(path => ({
            id: normalizeLegacyPath(path),
            source: 'legacy',
            sport_id: sport.id,
            image_url: path,
            caption: null,
            season: '2025-2026',
        }));
    }));
    return lists.flat();
}

async function loadSportPhotoGrid(){
    sportSelection.ids.clear();
    sportHiddenSelection.ids.clear();
    const grid = document.getElementById('sportPhotoGrid');
    grid.innerHTML = '<div class="dash-grid-loading"><span class="dash-spinner"></span>Gathering photos from the website and dashboard&hellip;</div>';

    const [legacyPhotos, dbResult, hiddenPaths] = await Promise.all([
        loadLegacySportPhotos(),
        sb().from('sport_photos').select('id, sport_id, image_url, caption, season, created_at').order('created_at', { ascending: false }),
        fetchHiddenLegacyPaths('sport'),
    ]);

    if(dbResult.error){ showToast('Could not load dashboard-uploaded sport photos.', 'error'); }
    const dbPhotos = (dbResult.data || []).map(row => ({ ...row, source: 'dashboard' }));

    sportPhotosCache = legacyPhotos.concat(dbPhotos).map(p => ({
        ...p,
        isHidden: p.source === 'legacy' && hiddenPaths.has(p.id),
    }));

    renderSportPhotoGrid();
    renderSportHiddenGrid('sport');
}

let sportVisibleItems = [];
let sportHiddenVisibleItems = [];

function renderSportPhotoGrid(){
    const grid = document.getElementById('sportPhotoGrid');
    const bySportId = new Map(sportsCache.map(s=>[s.id, s]));
    const filtered = sportPhotosCache.filter(p=>{
        if(p.isHidden) return false;
        const sportMatch = sportGridFilters.sport === 'all' || p.sport_id === sportGridFilters.sport;
        const yearMatch = sportGridFilters.year === 'all' || p.season === sportGridFilters.year;
        return sportMatch && yearMatch;
    });
    sportVisibleItems = filtered;

    grid.innerHTML = filtered.length
        ? filtered.map(p=> photoCardHtml(p, bySportId.get(p.sport_id)?.name, 'sport', sportSelection)).join('')
        : '<p class="dash-empty">No photos match this filter yet.</p>';

    updateBulkBarUI({ selectAllId: 'sportSelectAll', countId: 'sportSelectedCount', actionsId: 'sportBulkActions', selection: sportSelection, getVisible: ()=> sportVisibleItems });
}

function renderSportHiddenGrid(){
    const grid = document.getElementById('sportHiddenGrid');
    const bySportId = new Map(sportsCache.map(s=>[s.id, s]));
    const hidden = sportPhotosCache.filter(p=> p.isHidden);
    sportHiddenVisibleItems = hidden;
    document.getElementById('sportHiddenToggleText').textContent = `Hidden Photos (${hidden.length})`;

    grid.innerHTML = hidden.length
        ? hidden.map(p=> hiddenCardHtml(p, bySportId.get(p.sport_id)?.name, 'sport', sportHiddenSelection)).join('')
        : '<p class="dash-empty">No hidden photos.</p>';

    updateBulkBarUI({ selectAllId: 'sportHiddenSelectAll', countId: 'sportHiddenSelectedCount', actionsId: 'sportHiddenBulkActions', selection: sportHiddenSelection, getVisible: ()=> sportHiddenVisibleItems });
}

/* Shared card markup for both sports and Happy Friday galleries. */
function checkboxHtml(p, selection){
    const checked = selection.ids.has(p.id) ? 'checked' : '';
    return `
        <label class="dash-card-select">
            <input type="checkbox" class="dash-card-checkbox" data-id="${p.id}" ${checked}>
        </label>`;
}

function photoCardHtml(p, tagLabel, kind, selection){
    const sourceLabel = p.source === 'legacy' ? 'Website Photo' : 'Dashboard Upload';
    const editBtn = p.source === 'dashboard'
        ? `<button class="dash-icon-btn" data-action="edit-${kind}-photo" data-id="${p.id}">Edit</button>`
        : '';
    const isSelected = selection.ids.has(p.id) ? ' is-selected' : '';
    return `
    <div class="dash-card${isSelected}" data-id="${p.id}">
        ${checkboxHtml(p, selection)}
        <img class="dash-card-img" src="${p.image_url}" alt="" loading="lazy">
        <div class="dash-card-body">
            <span class="dash-card-tag">${escapeHtml(tagLabel || 'Unknown')}</span>
            <span class="dash-card-source dash-card-source-${p.source}">${sourceLabel}</span>
            <p class="dash-card-caption">${escapeHtml(p.caption || '')}</p>
            <p class="dash-card-meta">${escapeHtml(p.season || 'No year set')}</p>
            <div class="dash-card-actions">
                ${editBtn}
                <button class="dash-icon-btn danger" data-action="delete-${kind}-photo" data-id="${p.id}">Delete</button>
            </div>
        </div>
    </div>`;
}

function hiddenCardHtml(p, tagLabel, kind, selection){
    const isSelected = selection.ids.has(p.id) ? ' is-selected' : '';
    return `
    <div class="dash-card is-hidden-card${isSelected}" data-id="${p.id}">
        ${checkboxHtml(p, selection)}
        <img class="dash-card-img" src="${p.image_url}" alt="" loading="lazy">
        <div class="dash-card-body">
            <span class="dash-card-tag">${escapeHtml(tagLabel || 'Unknown')}</span>
            <span class="dash-card-source dash-card-source-legacy">Website Photo</span>
            <p class="dash-card-meta">${escapeHtml(p.season || 'No year set')}</p>
            <div class="dash-card-actions">
                <button class="dash-icon-btn" data-action="restore-${kind}-photo" data-id="${p.id}">Restore</button>
            </div>
        </div>
    </div>`;
}

document.getElementById('sportFilterSelect').addEventListener('change', e=>{
    sportGridFilters.sport = e.target.value;
    sportSelection.ids.clear();
    renderSportPhotoGrid();
});
document.getElementById('sportYearFilterRow').addEventListener('click', e=>{
    const btn = e.target.closest('.dash-pill');
    if(!btn) return;
    [...btn.parentElement.children].forEach(b=> b.classList.remove('is-active'));
    btn.classList.add('is-active');
    sportGridFilters.year = btn.dataset.year;
    sportSelection.ids.clear();
    renderSportPhotoGrid();
});

document.getElementById('sportHiddenToggle').addEventListener('click', ()=>{
    const grid = document.getElementById('sportHiddenGrid');
    const btn = document.getElementById('sportHiddenToggle');
    grid.hidden = !grid.hidden;
    document.getElementById('sportHiddenBulkBar').hidden = grid.hidden;
    btn.classList.toggle('is-open', !grid.hidden);
});

let editingPhoto = null; // { table, id }
document.getElementById('sportPhotoGrid').addEventListener('click', e=>{
    const editBtn = e.target.closest('[data-action="edit-sport-photo"]');
    const delBtn = e.target.closest('[data-action="delete-sport-photo"]');
    if(editBtn) openEditPhoto('sport_photos', editBtn.dataset.id, sportPhotosCache);
    if(delBtn) handlePhotoDelete('sport', delBtn.dataset.id, sportPhotosCache, loadSportPhotoGrid);
});
document.getElementById('sportHiddenGrid').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action="restore-sport-photo"]');
    if(btn) handlePhotoRestore('sport', btn.dataset.id, sportPhotosCache, loadSportPhotoGrid);
});

/* Legacy photos are hidden (not deleted — the file still lives in the
   repo); dashboard-uploaded photos are fully deleted from Storage + DB. */
function handlePhotoDelete(kind, id, cache, refreshFn){
    const photo = cache.find(p=> p.id === id);
    if(!photo) return;

    if(photo.source === 'legacy'){
        confirmDelete('Hide this photo from the public page? You can bring it back later from Hidden Photos.', async ()=>{
            const { error } = await hideLegacyPhoto(kind, photo.image_url);
            if(error){ showToast('Could not hide this photo.', 'error'); return; }
            showToast('Photo hidden. Find it under Hidden Photos to restore it.', 'success');
            await refreshFn();
        });
        return;
    }

    const bucket = kind === 'sport' ? 'sport-photos' : 'happy-friday-photos';
    const table = kind === 'sport' ? 'sport_photos' : 'happy_friday_photos';
    confirmDelete('Delete this photo? This cannot be undone.', ()=> deletePhoto(table, bucket, id, cache, refreshFn));
}

async function handlePhotoRestore(kind, id, cache, refreshFn){
    const photo = cache.find(p=> p.id === id);
    if(!photo) return;
    const { error } = await restoreLegacyPhoto(kind, photo.image_url);
    if(error){ showToast('Could not restore this photo.', 'error'); return; }
    showToast('Photo restored.', 'success');
    await refreshFn();
}

function openEditPhoto(table, id, cache){
    const photo = cache.find(p=> p.id === id);
    if(!photo) return;
    editingPhoto = { table, id };
    document.getElementById('editPhotoCaption').value = photo.caption || '';
    document.getElementById('editPhotoSeason').value = photo.season || '2026-2027';
    syncCustomSelect('editPhotoSeason');
    document.getElementById('editPhotoError').hidden = true;
    openModal('editPhotoModal');
}

document.getElementById('editPhotoForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!editingPhoto) return;
    const caption = document.getElementById('editPhotoCaption').value.trim() || null;
    const season = document.getElementById('editPhotoSeason').value;
    const btn = document.getElementById('editPhotoSubmitBtn');
    btn.disabled = true;
    const { error } = await sb().from(editingPhoto.table).update({ caption, season }).eq('id', editingPhoto.id);
    btn.disabled = false;
    if(error){
        document.getElementById('editPhotoError').textContent = error.message || 'Could not save changes.';
        document.getElementById('editPhotoError').hidden = false;
        return;
    }
    closeModal('editPhotoModal');
    showToast('Photo updated.', 'success');
    if(editingPhoto.table === 'sport_photos') await loadSportPhotoGrid();
    else await loadFridayPhotoGrid();
});

/* Pure delete (no toast/refresh) so it can be reused by both the
   single-photo and bulk-delete flows without double-refreshing. */
async function deletePhotoRow(table, bucket, id, cache){
    const photo = cache.find(p=> p.id === id);
    const { error } = await sb().from(table).delete().eq('id', id);
    if(error) return false;
    if(photo?.image_url) await deleteStorageObjectFromUrl(bucket, photo.image_url);
    return true;
}

async function deletePhoto(table, bucket, id, cache, refreshFn){
    const ok = await deletePhotoRow(table, bucket, id, cache);
    if(!ok){ showToast('Could not delete photo.', 'error'); return; }
    showToast('Photo deleted.', 'success');
    await refreshFn();
    refreshHomeCounts();
}

/* ══════════════════════════════════════
   BULK PHOTO ACTIONS
   Reused by both the Sports and Happy Friday galleries — `kind` selects
   the table/bucket/legacy-list to act on.
══════════════════════════════════════ */
function bulkConfig(kind){
    return kind === 'sport'
        ? { table: 'sport_photos', bucket: 'sport-photos' }
        : { table: 'happy_friday_photos', bucket: 'happy-friday-photos' };
}

function bulkHideSelected(kind, selection, cache, refreshFn){
    const ids = [...selection.ids].filter(id => cache.find(p=> p.id === id)?.source === 'legacy');
    if(!ids.length) return;
    const n = ids.length;
    confirmDelete(`Hide ${n} photo${n === 1 ? '' : 's'} from the public page? You can restore ${n === 1 ? 'it' : 'them'} later from Hidden Photos.`, async ()=>{
        const results = await Promise.all(ids.map(id=>{
            const photo = cache.find(p=> p.id === id);
            return hideLegacyPhoto(kind, photo.image_url);
        }));
        const successCount = results.filter(r=> !r.error).length;
        if(successCount) showToast(`${successCount} photo${successCount === 1 ? '' : 's'} hidden. Find ${successCount === 1 ? 'it' : 'them'} under Hidden Photos to restore.`, 'success');
        if(successCount < ids.length) showToast('Some photos could not be hidden.', 'error');
        selection.ids.clear();
        await refreshFn();
    });
}

function bulkDeleteSelected(kind, selection, cache, refreshFn){
    const ids = [...selection.ids].filter(id => cache.find(p=> p.id === id)?.source === 'dashboard');
    if(!ids.length) return;
    const n = ids.length;
    const { table, bucket } = bulkConfig(kind);
    confirmDelete(`Permanently delete ${n} photo${n === 1 ? '' : 's'}? This cannot be undone.`, async ()=>{
        const results = await Promise.all(ids.map(id=> deletePhotoRow(table, bucket, id, cache)));
        const successCount = results.filter(Boolean).length;
        if(successCount) showToast(`${successCount} photo${successCount === 1 ? '' : 's'} deleted.`, 'success');
        if(successCount < ids.length) showToast('Some photos could not be deleted.', 'error');
        selection.ids.clear();
        await refreshFn();
        refreshHomeCounts();
    });
}

function bulkRestoreSelected(kind, selection, cache, refreshFn){
    const ids = [...selection.ids];
    if(!ids.length) return;
    const n = ids.length;
    confirmDelete(`Restore ${n} photo${n === 1 ? '' : 's'} to the public page?`, async ()=>{
        const results = await Promise.all(ids.map(id=>{
            const photo = cache.find(p=> p.id === id);
            return restoreLegacyPhoto(kind, photo.image_url);
        }));
        const successCount = results.filter(r=> !r.error).length;
        if(successCount) showToast(`${successCount} photo${successCount === 1 ? '' : 's'} restored.`, 'success');
        if(successCount < ids.length) showToast('Some photos could not be restored.', 'error');
        selection.ids.clear();
        await refreshFn();
    });
}

/* ══════════════════════════════════════
   HAPPY FRIDAY VIEW
══════════════════════════════════════ */
let fridayPendingFiles = [];
let fridayPhotosCache = []; // merged legacy (on-disk) + dashboard-uploaded photos
let fridayGridFilters = { category: 'all', year: 'all' };
let fridaySelection = createPhotoSelection();
let fridayHiddenSelection = createPhotoSelection();

const FRIDAY_LABELS = { almost_friday: 'Almost Friday', finally_friday: 'Finally Friday' };
const FRIDAY_SETS = [
    { key: 'almost_friday', folder: 'almost_friday', prefix: 'afr' },
    { key: 'finally_friday', folder: 'finally_friday', prefix: 'ff' },
];

async function refreshFridayView(){
    await loadFridayPhotoGrid();
}

function removeFridayPreview(i){
    fridayPendingFiles.splice(i, 1);
    renderPreviewGrid('fridayPreviewGrid', fridayPendingFiles, removeFridayPreview);
    document.getElementById('fridayUploadOptions').hidden = fridayPendingFiles.length === 0;
    document.getElementById('fridayUploadBtn').hidden = fridayPendingFiles.length === 0;
}

wireDropzone('fridayDropzone', 'fridayFileInput', files=>{
    addPendingFiles(files, fridayPendingFiles, 'fridayPreviewGrid', 'fridayUploadOptions', 'fridayUploadBtn', ()=>{
        renderPreviewGrid('fridayPreviewGrid', fridayPendingFiles, removeFridayPreview);
    });
});

document.getElementById('fridayUploadBtn').addEventListener('click', async ()=>{
    const category = document.getElementById('fridayUploadSelect').value;
    const season = document.getElementById('fridaySeasonSelect').value;
    const caption = document.getElementById('fridayCaptionInput').value.trim() || null;
    const btn = document.getElementById('fridayUploadBtn');
    btn.disabled = true;

    const grid = document.getElementById('fridayPreviewGrid');
    const cells = [...grid.children];

    let successCount = 0;
    for(let i = 0; i < fridayPendingFiles.length; i++){
        const item = fridayPendingFiles[i];
        const cell = cells[i];
        const bar = cell?.querySelector('[data-role="bar"]');
        const statusEl = cell?.querySelector('[data-role="status"]');
        try {
            const blob = await compressImage(item.file);
            const path = `${category}/${Date.now()}-${randomId()}-${sanitizeFilename(item.file.name)}.jpg`;
            await uploadFileWithProgress('happy-friday-photos', path, blob, pct=>{ if(bar) bar.style.width = pct + '%'; });
            const imageUrl = publicUrlFor('happy-friday-photos', path);
            const { error } = await sb().from('happy_friday_photos').insert({
                category, storage_path: path, image_url: imageUrl, caption, season,
            });
            if(error) throw error;
            successCount++;
            if(statusEl){
                statusEl.classList.add('is-visible', 'status-ok');
                statusEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            }
        } catch(e){
            console.error(e);
            if(statusEl){
                statusEl.classList.add('is-visible', 'status-error');
                statusEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>';
            }
        }
    }

    btn.disabled = false;
    if(successCount > 0){
        showToast(`${successCount} photo${successCount === 1 ? '' : 's'} uploaded to ${FRIDAY_LABELS[category]}.`, 'success');
    }
    if(successCount < fridayPendingFiles.length){
        showToast('Some photos could not be uploaded. Please try them again.', 'error');
    }

    fridayPendingFiles = [];
    renderPreviewGrid('fridayPreviewGrid', fridayPendingFiles, ()=>{});
    document.getElementById('fridayUploadOptions').hidden = true;
    document.getElementById('fridayUploadBtn').hidden = true;
    document.getElementById('fridayCaptionInput').value = '';
    await loadFridayPhotoGrid();
    refreshHomeCounts();
});

async function loadLegacyFridayPhotos(){
    const lists = await Promise.all(FRIDAY_SETS.map(async set=>{
        const paths = await gatherLegacyFolderPhotos(DASH_LEGACY_BASE_PATH, set.folder, set.prefix);
        return paths.map(path => ({
            id: normalizeLegacyPath(path),
            source: 'legacy',
            category: set.key,
            image_url: path,
            caption: null,
            season: '2025-2026',
        }));
    }));
    return lists.flat();
}

async function loadFridayPhotoGrid(){
    fridaySelection.ids.clear();
    fridayHiddenSelection.ids.clear();
    const grid = document.getElementById('fridayPhotoGrid');
    grid.innerHTML = '<div class="dash-grid-loading"><span class="dash-spinner"></span>Gathering photos from the website and dashboard&hellip;</div>';

    const [legacyPhotos, dbResult, hiddenPaths] = await Promise.all([
        loadLegacyFridayPhotos(),
        sb().from('happy_friday_photos').select('id, category, image_url, caption, season, created_at').order('created_at', { ascending: false }),
        fetchHiddenLegacyPaths('friday'),
    ]);

    if(dbResult.error){ showToast('Could not load dashboard-uploaded Happy Friday photos.', 'error'); }
    const dbPhotos = (dbResult.data || []).map(row => ({ ...row, source: 'dashboard' }));

    fridayPhotosCache = legacyPhotos.concat(dbPhotos).map(p => ({
        ...p,
        isHidden: p.source === 'legacy' && hiddenPaths.has(p.id),
    }));

    renderFridayPhotoGrid();
    renderFridayHiddenGrid();
}

let fridayVisibleItems = [];
let fridayHiddenVisibleItems = [];

function renderFridayPhotoGrid(){
    const grid = document.getElementById('fridayPhotoGrid');
    const filtered = fridayPhotosCache.filter(p=>{
        if(p.isHidden) return false;
        const catMatch = fridayGridFilters.category === 'all' || p.category === fridayGridFilters.category;
        const yearMatch = fridayGridFilters.year === 'all' || p.season === fridayGridFilters.year;
        return catMatch && yearMatch;
    });
    fridayVisibleItems = filtered;

    grid.innerHTML = filtered.length
        ? filtered.map(p=> photoCardHtml(p, FRIDAY_LABELS[p.category] || p.category, 'friday', fridaySelection)).join('')
        : '<p class="dash-empty">No photos match this filter yet.</p>';

    updateBulkBarUI({ selectAllId: 'fridaySelectAll', countId: 'fridaySelectedCount', actionsId: 'fridayBulkActions', selection: fridaySelection, getVisible: ()=> fridayVisibleItems });
}

function renderFridayHiddenGrid(){
    const grid = document.getElementById('fridayHiddenGrid');
    const hidden = fridayPhotosCache.filter(p=> p.isHidden);
    fridayHiddenVisibleItems = hidden;
    document.getElementById('fridayHiddenToggleText').textContent = `Hidden Photos (${hidden.length})`;

    grid.innerHTML = hidden.length
        ? hidden.map(p=> hiddenCardHtml(p, FRIDAY_LABELS[p.category] || p.category, 'friday', fridayHiddenSelection)).join('')
        : '<p class="dash-empty">No hidden photos.</p>';

    updateBulkBarUI({ selectAllId: 'fridayHiddenSelectAll', countId: 'fridayHiddenSelectedCount', actionsId: 'fridayHiddenBulkActions', selection: fridayHiddenSelection, getVisible: ()=> fridayHiddenVisibleItems });
}

document.getElementById('fridayHiddenToggle').addEventListener('click', ()=>{
    const grid = document.getElementById('fridayHiddenGrid');
    const btn = document.getElementById('fridayHiddenToggle');
    grid.hidden = !grid.hidden;
    document.getElementById('fridayHiddenBulkBar').hidden = grid.hidden;
    btn.classList.toggle('is-open', !grid.hidden);
});

document.getElementById('fridayCategoryFilterRow').addEventListener('click', e=>{
    const btn = e.target.closest('.dash-pill');
    if(!btn) return;
    [...btn.parentElement.children].forEach(b=> b.classList.remove('is-active'));
    btn.classList.add('is-active');
    fridayGridFilters.category = btn.dataset.filter;
    fridaySelection.ids.clear();
    renderFridayPhotoGrid();
});
document.getElementById('fridayYearFilterRow').addEventListener('click', e=>{
    const btn = e.target.closest('.dash-pill');
    if(!btn) return;
    [...btn.parentElement.children].forEach(b=> b.classList.remove('is-active'));
    btn.classList.add('is-active');
    fridayGridFilters.year = btn.dataset.year;
    fridaySelection.ids.clear();
    renderFridayPhotoGrid();
});

document.getElementById('fridayPhotoGrid').addEventListener('click', e=>{
    const editBtn = e.target.closest('[data-action="edit-friday-photo"]');
    const delBtn = e.target.closest('[data-action="delete-friday-photo"]');
    if(editBtn) openEditPhoto('happy_friday_photos', editBtn.dataset.id, fridayPhotosCache);
    if(delBtn) handlePhotoDelete('friday', delBtn.dataset.id, fridayPhotosCache, loadFridayPhotoGrid);
});
document.getElementById('fridayHiddenGrid').addEventListener('click', e=>{
    const btn = e.target.closest('[data-action="restore-friday-photo"]');
    if(btn) handlePhotoRestore('friday', btn.dataset.id, fridayPhotosCache, loadFridayPhotoGrid);
});

/* ══════════════════════════════════════
   SENIORS VIEW
══════════════════════════════════════ */
let seniorsCache = [];
let seniorSearchTerm = '';
let seniorPhotoFiles = { kid: null, senior: null }; // pending File objects for the open form

async function refreshSeniorsView(){
    const { data, error } = await sb().from('seniors').select('*').order('display_order', { ascending: true });
    if(error){ showToast('Could not load seniors.', 'error'); return; }
    seniorsCache = data || [];
    renderSeniorList();
}

function renderSeniorList(){
    const list = document.getElementById('seniorList');
    const term = seniorSearchTerm.toLowerCase();
    const filtered = seniorsCache.filter(s=>
        !term || s.full_name.toLowerCase().includes(term) || (s.college || '').toLowerCase().includes(term)
    );

    if(!filtered.length){
        list.innerHTML = '<p class="dash-empty">No seniors match your search.</p>';
        return;
    }

    list.innerHTML = filtered.map(s=> `
        <div class="dash-senior-row" data-id="${s.id}">
            <div class="dash-senior-thumbs">
                <img src="${s.child_photo_url}" alt="" loading="lazy">
                <img src="${s.senior_photo_url}" alt="" loading="lazy">
            </div>
            <div class="dash-senior-info">
                <h3>${escapeHtml(s.full_name)}</h3>
                <p>${escapeHtml(s.college || '')}${s.major ? ' • ' + escapeHtml(s.major) : ''} &middot; Class of ${s.grad_year}</p>
            </div>
            <div class="dash-senior-actions">
                <button class="dash-icon-btn" data-action="edit-senior" data-id="${s.id}">Edit</button>
                <button class="dash-icon-btn danger" data-action="delete-senior" data-id="${s.id}">Delete</button>
            </div>
        </div>`).join('');
}

document.getElementById('seniorSearchInput').addEventListener('input', e=>{
    seniorSearchTerm = e.target.value;
    renderSeniorList();
});

document.getElementById('seniorList').addEventListener('click', e=>{
    const editBtn = e.target.closest('[data-action="edit-senior"]');
    const delBtn = e.target.closest('[data-action="delete-senior"]');
    if(editBtn) openSeniorForm(seniorsCache.find(s=> s.id === editBtn.dataset.id));
    if(delBtn){
        const s = seniorsCache.find(x=> x.id === delBtn.dataset.id);
        confirmDelete(`Delete ${s?.full_name || 'this senior'}'s profile? This cannot be undone.`, ()=> deleteSenior(delBtn.dataset.id));
    }
});

async function deleteSenior(id){
    const senior = seniorsCache.find(s=> s.id === id);
    const { error } = await sb().from('seniors').delete().eq('id', id);
    if(error){ showToast('Could not delete senior.', 'error'); return; }
    if(senior){
        await deleteStorageObjectFromUrl('senior-photos', senior.child_photo_url);
        await deleteStorageObjectFromUrl('senior-photos', senior.senior_photo_url);
    }
    showToast('Senior profile deleted.', 'success');
    await refreshSeniorsView();
    refreshHomeCounts();
}

document.getElementById('addSeniorBtn').addEventListener('click', ()=> openSeniorForm(null));

function openSeniorForm(senior){
    document.getElementById('seniorModalTitle').textContent = senior ? 'Edit Senior' : 'Add Senior';
    document.getElementById('seniorId').value = senior?.id || '';
    document.getElementById('seniorFullName').value = senior?.full_name || '';
    document.getElementById('seniorCollege').value = senior?.college || '';
    document.getElementById('seniorGradYear').value = senior?.grad_year || 2027;
    document.getElementById('seniorMajor').value = senior?.major || '';
    document.getElementById('seniorMinor').value = senior?.minor || '';
    document.getElementById('seniorNote').value = senior?.note || '';
    document.getElementById('seniorFormError').hidden = true;

    seniorPhotoFiles = { kid: null, senior: null };
    setPhotoSlot('kidPhotoSlot', senior?.child_photo_url || null);
    setPhotoSlot('seniorPhotoSlot', senior?.senior_photo_url || null);

    updateSeniorPreview();
    openModal('seniorModal');
}

function setPhotoSlot(slotId, existingUrl){
    const slot = document.getElementById(slotId);
    slot.classList.toggle('has-image', !!existingUrl);
    slot.innerHTML = existingUrl
        ? `<img src="${existingUrl}" alt="">`
        : `<span>${slotId === 'kidPhotoSlot' ? 'Childhood photo' : 'Senior photo'}<br><small>Click to choose</small></span>`;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.id = slotId === 'kidPhotoSlot' ? 'kidPhotoInput' : 'seniorPhotoInput';
    slot.appendChild(input);

    input.addEventListener('change', ()=>{
        const file = input.files[0];
        if(!file) return;
        const err = validateImageFile(file);
        if(err){ showToast(err, 'error'); return; }
        const kind = slotId === 'kidPhotoSlot' ? 'kid' : 'senior';
        seniorPhotoFiles[kind] = file;
        const url = URL.createObjectURL(file);
        slot.classList.add('has-image');
        slot.innerHTML = `<img src="${url}" alt="">`;
        slot.appendChild(input);
        updateSeniorPreview();
    });
}

function updateSeniorPreview(){
    const kidImg = document.getElementById('previewKidImg');
    const seniorImg = document.getElementById('previewSeniorImg');
    const existingKid = document.querySelector('#kidPhotoSlot img')?.src;
    const existingSenior = document.querySelector('#seniorPhotoSlot img')?.src;
    kidImg.src = existingKid || '';
    seniorImg.src = existingSenior || '';

    const name = document.getElementById('seniorFullName').value.trim() || 'Full Name';
    const college = document.getElementById('seniorCollege').value.trim();
    const major = document.getElementById('seniorMajor').value.trim();
    const minor = document.getElementById('seniorMinor').value.trim();
    const gradYear = document.getElementById('seniorGradYear').value || '2027';

    document.getElementById('previewGradYear').textContent = `Class of ${gradYear}`;
    document.getElementById('previewName').textContent = name;

    const parts = [];
    if(major) parts.push(`${major} Major`);
    if(minor) parts.push(`${minor} Minor`);
    const majorMinor = parts.join(' • ');
    document.getElementById('previewDetails').textContent = college && majorMinor
        ? `${college} • ${majorMinor}`
        : (college || majorMinor || 'College • Major');
}

['seniorFullName','seniorCollege','seniorGradYear','seniorMajor','seniorMinor'].forEach(id=>{
    document.getElementById(id).addEventListener('input', updateSeniorPreview);
});

document.getElementById('seniorForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const errorEl = document.getElementById('seniorFormError');
    errorEl.hidden = true;

    const id = document.getElementById('seniorId').value || null;
    const fullName = document.getElementById('seniorFullName').value.trim();
    const college = document.getElementById('seniorCollege').value.trim();
    const gradYear = Number(document.getElementById('seniorGradYear').value) || 2027;
    const major = document.getElementById('seniorMajor').value.trim() || null;
    const minor = document.getElementById('seniorMinor').value.trim() || null;
    const note = document.getElementById('seniorNote').value.trim() || null;

    if(!fullName || !college){
        errorEl.textContent = 'Full name and college are required.';
        errorEl.hidden = false;
        return;
    }
    if(!id && (!seniorPhotoFiles.kid || !seniorPhotoFiles.senior)){
        errorEl.textContent = 'Please choose both a childhood photo and a senior photo.';
        errorEl.hidden = false;
        return;
    }

    const btn = document.getElementById('seniorSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="dash-spinner"></span>';

    try {
        const payload = { full_name: fullName, college, grad_year: gradYear, major, minor, note };

        if(seniorPhotoFiles.kid){
            const blob = await compressImage(seniorPhotoFiles.kid);
            const path = `kid/${Date.now()}-${randomId()}-${sanitizeFilename(seniorPhotoFiles.kid.name)}.jpg`;
            await uploadFileWithProgress('senior-photos', path, blob);
            payload.child_photo_url = publicUrlFor('senior-photos', path);
        }
        if(seniorPhotoFiles.senior){
            const blob = await compressImage(seniorPhotoFiles.senior);
            const path = `senior/${Date.now()}-${randomId()}-${sanitizeFilename(seniorPhotoFiles.senior.name)}.jpg`;
            await uploadFileWithProgress('senior-photos', path, blob);
            payload.senior_photo_url = publicUrlFor('senior-photos', path);
        }

        if(id){
            const { error } = await sb().from('seniors').update(payload).eq('id', id);
            if(error) throw error;
            showToast(`${fullName}'s profile was updated.`, 'success');
        } else {
            const maxOrder = seniorsCache.reduce((m, s)=> Math.max(m, s.display_order || 0), 0);
            payload.display_order = maxOrder + 1;
            const { error } = await sb().from('seniors').insert(payload);
            if(error) throw error;
            showToast(`${fullName} was added to the Seniors page.`, 'success');
        }

        closeModal('seniorModal');
        await refreshSeniorsView();
        refreshHomeCounts();
    } catch(err){
        errorEl.textContent = err.message || 'Could not save this senior profile.';
        errorEl.hidden = false;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Senior';
    }
});

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
[
    'sportUploadSelect', 'sportSeasonSelect', 'sportFilterSelect',
    'fridayUploadSelect', 'fridaySeasonSelect', 'editPhotoSeason',
].forEach(syncCustomSelect);

wireBulkBar({
    gridId: 'sportPhotoGrid', selectAllId: 'sportSelectAll', countId: 'sportSelectedCount', actionsId: 'sportBulkActions',
    selection: sportSelection, getVisible: ()=> sportVisibleItems,
    onAction: action=>{
        if(action === 'hide') bulkHideSelected('sport', sportSelection, sportPhotosCache, loadSportPhotoGrid);
        if(action === 'delete') bulkDeleteSelected('sport', sportSelection, sportPhotosCache, loadSportPhotoGrid);
    },
});
wireBulkBar({
    gridId: 'sportHiddenGrid', selectAllId: 'sportHiddenSelectAll', countId: 'sportHiddenSelectedCount', actionsId: 'sportHiddenBulkActions',
    selection: sportHiddenSelection, getVisible: ()=> sportHiddenVisibleItems,
    onAction: action=>{
        if(action === 'restore') bulkRestoreSelected('sport', sportHiddenSelection, sportPhotosCache, loadSportPhotoGrid);
    },
});
wireBulkBar({
    gridId: 'fridayPhotoGrid', selectAllId: 'fridaySelectAll', countId: 'fridaySelectedCount', actionsId: 'fridayBulkActions',
    selection: fridaySelection, getVisible: ()=> fridayVisibleItems,
    onAction: action=>{
        if(action === 'hide') bulkHideSelected('friday', fridaySelection, fridayPhotosCache, loadFridayPhotoGrid);
        if(action === 'delete') bulkDeleteSelected('friday', fridaySelection, fridayPhotosCache, loadFridayPhotoGrid);
    },
});
wireBulkBar({
    gridId: 'fridayHiddenGrid', selectAllId: 'fridayHiddenSelectAll', countId: 'fridayHiddenSelectedCount', actionsId: 'fridayHiddenBulkActions',
    selection: fridayHiddenSelection, getVisible: ()=> fridayHiddenVisibleItems,
    onAction: action=>{
        if(action === 'restore') bulkRestoreSelected('friday', fridayHiddenSelection, fridayPhotosCache, loadFridayPhotoGrid);
    },
});

checkSession();
