const $ = id => document.getElementById(id);
const state = { user: null, projects: [], project: null, imageData: '', mobile: false, codeOpen: false, saveTimer: null, toastTimer: null };
const views = ['authView', 'dashboardView', 'builderView'];
function showView(id) { views.forEach(view => $(view).classList.toggle('hidden', view !== id)); }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3200); }
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || `Request failed (${response.status})`); error.status = response.status; throw error; }
  return body;
}
function safeText(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
function niceDate(value) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)); }
function setAuthMode(mode) {
  const signup = mode === 'signup'; $('authTitle').textContent = signup ? 'Make room for ideas' : 'Welcome back';
  $('authSubtitle').textContent = signup ? 'Create a free account and start building.' : 'Sign in to pick up where you left off.';
  $('authSubmit').innerHTML = signup ? 'Create free account <span>→</span>' : 'Sign in <span>→</span>';
  $('authSwitchText').textContent = signup ? 'Already have an account?' : 'New to NovaForge?';
  $('authSwitch').textContent = signup ? 'Sign in' : 'Create an account'; $('authForm').dataset.mode = mode;
  $('authForm').elements.password.autocomplete = signup ? 'new-password' : 'current-password';
}
$('authSwitch').addEventListener('click', () => setAuthMode($('authForm').dataset.mode === 'signup' ? 'login' : 'signup'));
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('authSubmit'); button.disabled = true;
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  try { const result = await api(`/api/auth/${event.currentTarget.dataset.mode}`, { method: 'POST', body: JSON.stringify(data) }); state.user = result.user; $('authForm').reset(); await loadDashboard(); }
  catch (error) { toast(error.message); } finally { button.disabled = false; }
});
async function loadDashboard() {
  $('userEmail').textContent = state.user.email; $('avatar').textContent = state.user.email[0].toUpperCase();
  state.projects = await api('/api/projects'); renderProjects(); showView('dashboardView');
}
function renderProjects() {
  $('projectCount').textContent = state.projects.length; $('headingCount').textContent = state.projects.length;
  $('projectGrid').innerHTML = state.projects.map(project => `<article class="project-card" data-open="${safeText(project.id)}"><div class="project-thumb"><div class="thumb-window"><div class="thumb-top"><i></i><i></i><i></i></div><div class="thumb-hero"></div><div class="thumb-bottom"><i></i><i></i><i></i></div></div></div><div class="project-card-info"><div style="min-width:0"><div class="project-name">${safeText(project.name)}</div><div class="project-date">Edited ${niceDate(project.updated_at)}</div></div><button class="card-more" data-delete="${safeText(project.id)}" aria-label="Delete ${safeText(project.name)}">···</button></div></article>`).join('');
  $('projectGrid').classList.toggle('hidden', state.projects.length === 0); $('emptyState').classList.toggle('hidden', state.projects.length !== 0);
}
$('projectGrid').addEventListener('click', async event => {
  const del = event.target.closest('[data-delete]'); if (del) { event.stopPropagation(); const id = del.dataset.delete; const project = state.projects.find(p => p.id === id); if (confirm(`Delete “${project?.name}”? This cannot be undone.`)) { try { await api(`/api/projects/${id}`, { method: 'DELETE' }); state.projects = state.projects.filter(p => p.id !== id); renderProjects(); toast('Project deleted.'); } catch (error) { toast(error.message); } } return; }
  const card = event.target.closest('[data-open]'); if (card) openProject(card.dataset.open);
});
async function createProject() {
  try { const project = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Untitled project' }) }); state.projects.unshift(project); renderProjects(); await openProject(project.id); $('promptInput').focus(); }
  catch (error) { toast(error.message); }
}
['newProject', 'newProjectTop', 'emptyCreate'].forEach(id => $(id).addEventListener('click', createProject));
async function openProject(id) {
  try { state.project = await api(`/api/projects/${id}`); $('projectName').value = state.project.name; $('previewTitle').textContent = state.project.name; $('codeEditor').value = state.project.html; $('chatMessages').innerHTML = ''; $('attachmentPreview').classList.add('hidden'); state.imageData = ''; state.codeOpen = false; $('codePane').classList.add('hidden'); $('previewFrameWrap').classList.remove('hidden'); $('previewBlank').classList.add('hidden'); renderPreview(); showView('builderView'); }
  catch (error) { toast(error.message); }
}
function renderPreview() { if (!state.project) return; $('previewFrame').srcdoc = state.project.html; $('previewFrameWrap').classList.toggle('mobile', state.mobile); $('mobileView').classList.toggle('active', state.mobile); $('desktopView').classList.toggle('active', !state.mobile); $('viewportLabel').textContent = `${state.mobile ? 'Mobile' : 'Desktop'} · 100%`; }
$('backButton').addEventListener('click', async () => { if (state.project) await saveProject(); await loadDashboard(); });
$('projectName').addEventListener('input', () => { if (!state.project) return; state.project.name = $('projectName').value.trim() || 'Untitled project'; $('previewTitle').textContent = state.project.name; scheduleSave(); });
$('codeEditor').addEventListener('input', () => { if (!state.project) return; state.project.html = $('codeEditor').value; renderPreview(); scheduleSave(); });
function scheduleSave() { clearTimeout(state.saveTimer); $('saveStatus').className = 'save-status saving'; $('saveStatus').innerHTML = '<i></i> Saving'; state.saveTimer = setTimeout(saveProject, 700); }
async function saveProject() {
  if (!state.project) return; clearTimeout(state.saveTimer);
  try { await api(`/api/projects/${state.project.id}`, { method: 'PUT', body: JSON.stringify({ name: state.project.name, html: state.project.html }) }); $('saveStatus').className = 'save-status'; $('saveStatus').innerHTML = '<i></i> Saved'; }
  catch (error) { $('saveStatus').className = 'save-status error'; $('saveStatus').innerHTML = '<i></i> Not saved'; toast(error.message); }
}
$('codeToggle').addEventListener('click', () => { state.codeOpen = !state.codeOpen; $('codePane').classList.toggle('hidden', !state.codeOpen); $('previewFrameWrap').classList.toggle('hidden', state.codeOpen); $('previewBlank').classList.add('hidden'); $('codeToggle').classList.toggle('active', state.codeOpen); });
$('desktopView').addEventListener('click', () => { state.mobile = false; renderPreview(); }); $('mobileView').addEventListener('click', () => { state.mobile = true; renderPreview(); }); $('refreshPreview').addEventListener('click', renderPreview);
$('previewButton').addEventListener('click', () => { if (!state.codeOpen) { $('previewFrame').contentWindow?.location.reload(); } else { state.codeOpen = false; $('codePane').classList.add('hidden'); $('previewFrameWrap').classList.remove('hidden'); } });
$('downloadButton').addEventListener('click', () => { if (!state.project) return; const blob = new Blob([state.project.html], { type: 'text/html;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${(state.project.name || 'website').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`; link.click(); URL.revokeObjectURL(link.href); });
$('logoutButton').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} state.user = null; showView('authView'); });
$('newChat').addEventListener('click', () => { $('chatMessages').innerHTML = ''; $('attachmentPreview').classList.add('hidden'); state.imageData = ''; });
function addMessage(text, kind) { const node = document.createElement('div'); node.className = `message ${kind}`; if (kind === 'ai') { const label = document.createElement('div'); label.className = 'message-label'; label.textContent = '✳ NovaForge'; node.appendChild(label); } node.append(document.createTextNode(text)); $('chatMessages').appendChild(node); $('chatMessages').scrollTop = $('chatMessages').scrollHeight; }
document.querySelectorAll('.suggestion').forEach(button => button.addEventListener('click', () => { $('promptInput').value = button.dataset.prompt; $('promptInput').focus(); }));
$('imageInput').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return; if (file.size > 4 * 1024 * 1024) { toast('Please use an image under 4 MB.'); event.target.value = ''; return; }
  const reader = new FileReader(); reader.onload = () => { state.imageData = reader.result; $('attachmentPreview').innerHTML = `<img src="${state.imageData}" alt="Screenshot reference"><span>${safeText(file.name)}</span><button type="button" aria-label="Remove image">×</button>`; $('attachmentPreview').classList.remove('hidden'); $('attachmentPreview').querySelector('button').onclick = () => { state.imageData = ''; $('attachmentPreview').classList.add('hidden'); $('imageInput').value = ''; }; }; reader.readAsDataURL(file);
});
$('promptForm').addEventListener('submit', async event => {
  event.preventDefault(); if (!state.project) return; const prompt = $('promptInput').value.trim(); const referenceUrl = (prompt.match(/https?:\/\/[^\s]+/i) || [])[0] || '';
  if (!prompt) { toast('Describe a website or a change first.'); return; }
  addMessage(prompt, 'user'); $('promptInput').value = ''; $('sendPrompt').disabled = true;
  const typing = document.createElement('div'); typing.className = 'message ai typing'; typing.innerHTML = '<i></i><i></i><i></i>'; $('chatMessages').appendChild(typing); $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  try {
    const result = await api('/api/ai/generate', { method: 'POST', body: JSON.stringify({ prompt, currentHtml: state.project.html, referenceUrl, imageData: state.imageData }) });
    state.project.html = result.html; state.project.name = result.name || state.project.name; $('projectName').value = state.project.name; $('previewTitle').textContent = state.project.name; $('codeEditor').value = state.project.html; $('previewBlank').classList.add('hidden'); renderPreview(); scheduleSave(); addMessage('Your update is ready. The live preview and editable HTML are now updated.', 'ai'); state.imageData = ''; $('attachmentPreview').classList.add('hidden'); $('imageInput').value = '';
  } catch (error) { typing.remove(); addMessage(error.message, 'error'); }
  finally { if (typing.isConnected) typing.remove(); $('sendPrompt').disabled = false; }
});
$('promptInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('promptForm').requestSubmit(); } });
(async function init() {
  try { const result = await api('/api/auth/me'); state.user = result.user; await loadDashboard(); }
  catch { setAuthMode('login'); showView('authView'); }
})();
