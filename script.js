(function(){
  // ===== Tema opsional via JS =====
  window.Theme = {
    setAccent(hex){ document.documentElement.style.setProperty('--accent', hex); },
    setFont(family){ document.documentElement.style.setProperty('--font', family); }
  };

  // ===== Data MOCK — ganti dengan fetch API produksi =====
  const MOCK_DB = {
    "PKG-98431": {
      id: "PKG-98431",
      status: "Dalam perjalanan ke pabrik",
      steps: [
        { title: "Order dibuat", ts: "2025-08-10T09:15:00+07:00" },
        { title: "Diambil kurir internal", ts: "2025-08-10T11:02:00+07:00" },
        { title: "Sampai gudang transit", ts: "2025-08-10T15:40:00+07:00" },
        { title: "Berangkat ke pabrik", ts: "2025-08-11T08:20:00+07:00" }
      ]
    },
    "SO-10015": {
      id: "SO-10015",
      status: "Tiba di pabrik (selesai)",
      steps: [
        { title: "Order dibuat", ts: "2025-08-08T08:10:00+07:00" },
        { title: "Diambil kurir internal", ts: "2025-08-08T10:45:00+07:00" },
        { title: "Sampai gudang transit", ts: "2025-08-08T14:00:00+07:00" },
        { title: "Berangkat ke pabrik", ts: "2025-08-09T07:50:00+07:00" },
        { title: "Tiba di pabrik", ts: "2025-08-09T11:05:00+07:00" }
      ]
    }
  };

  // ===== Utils =====
  const fmt = new Intl.DateTimeFormat('id-ID', {
    dateStyle:'full', timeStyle:'short', timeZone:'Asia/Jakarta'
  });
  const $ = (sel)=>document.querySelector(sel);
  const show = (el)=> el && el.removeAttribute('hidden');
  const hide = (el)=> el && el.setAttribute('hidden','');
  const setQueryId = (id)=>{
    const url = new URL(location.href);
    id ? url.searchParams.set('id', id) : url.searchParams.delete('id');
    history.replaceState(null,'',url);
  };
  const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

  // ===== Data source (mock → real) =====
  async function fetchShipment(id){
    // PRODUKSI:
    // const res = await fetch(`/api/shipments/${encodeURIComponent(id)}`);
    // if(!res.ok) return null;
    // return await res.json();

    // DEMO MOCK:
    await wait(380);
    return MOCK_DB[id] || null;
  }

  // ===== Renderers =====
  function stepDotClass(i, last){
    if (i < last) return 'dot ok';
    if (i === last) return 'dot live';
    return 'dot';
  }

  function renderDetail(data){
    $('#labelId').textContent = data.id;
    $('#labelStatus').textContent = data.status;

    // Progres
    const stepsEl = $('#steps'); stepsEl.innerHTML = '';
    const last = data.steps.length - 1;
    data.steps.forEach((s,i)=>{
      const div = document.createElement('div');
      div.className = 'step';
      div.innerHTML = `
        <div class="${stepDotClass(i,last)}">${i<last? '✓' : (i===last? '•' : '')}</div>
        <div>
          <div class="title">${s.title}</div>
          <div class="meta">
            <span>${fmt.format(new Date(s.ts))}</span>
            <span>${i<last? 'Selesai' : 'Sedang berlangsung'}</span>
          </div>
        </div>`;
      stepsEl.appendChild(div);
    });

    // Linimasa (terbaru di atas)
    const tl = $('#timeline'); tl.innerHTML = '';
    data.steps.slice().reverse().forEach(s=>{
      const el = document.createElement('div');
      el.className = 'tl-item';
      el.innerHTML = `<div class="tl-title">${s.title}</div>
                      <div class="tl-time">${fmt.format(new Date(s.ts))}</div>`;
      tl.appendChild(el);
    });

    // Tampilkan view detail
    show($('#detailView')); hide($('#searchView'));
    setQueryId(data.id);

    // Render peta setelah terlihat
    renderMap(data);
  }

  // ===== Map (Leaflet) =====
  const DEFAULT_ROUTES = {
    "PKG-98431": { coords: [
      [-6.2000, 106.8166], /* Jakarta */
      [-6.2383, 106.9756], /* Bekasi Barat */
      [-6.2963, 107.1703], /* Cikarang */
      [-6.3229, 107.2993], /* Karawang */
      [-6.4140, 107.5900]  /* Purwakarta */
    ], progressIndex: 3 },
    "SO-10015": { coords: [
      [-6.2000, 106.8166],
      [-6.2383, 106.9756],
      [-6.2963, 107.1703],
      [-6.3229, 107.2993],
      [-6.4140, 107.5900]
    ], progressIndex: 4 }
  };

  let map, routeDone, routeTodo, posMarker;
  function ensureMap(){
    if (map) return;
    map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function renderMap(data){
    const route = (data && data.route) || DEFAULT_ROUTES[data?.id];
    if (!route || !Array.isArray(route.coords)) return;

    ensureMap();

    const coords = route.coords.map(c=>L.latLng(c[0], c[1]));
    if (!coords.length) return;

    const idx = Math.min(Math.max(0, route.progressIndex||0), coords.length-1);

    // Bersihkan layer lama
    if (routeDone) routeDone.remove();
    if (routeTodo) routeTodo.remove();
    if (posMarker) posMarker.remove();

    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || '#5b8cff';

    routeDone = L.polyline(coords.slice(0, idx+1), { color: accent, weight: 5 }).addTo(map);
    routeTodo = L.polyline(coords.slice(idx), { color: '#aab2d5', weight: 4, dashArray: '6 6' }).addTo(map);
    posMarker = L.circleMarker(coords[idx], { radius: 7, color: accent, fillColor: accent, fillOpacity: .9 }).addTo(map);

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [24,24] });
    setTimeout(()=> map.invalidateSize(), 0);
  }

  // ===== Actions =====
  async function handleSearch(id){
    const btn = $('#btnCari'); btn.disabled = true; show($('#liveSpinner'));
    try{
      const data = await fetchShipment(id);
      if(!data){ openNF(); return; }
      renderDetail(data);
    } finally{
      hide($('#liveSpinner')); btn.disabled = false;
    }
  }

  function showModal(title, message){
    $('#nfTitle').textContent = title;
    $('#nfBody').textContent = message;
    show($('#modalNF'));
  }
  function openNF(){
    showModal('ID tidak ditemukan',
      'Mohon periksa kembali nomor ID pengiriman yang dimasukkan. Jika tetap tidak ada, hubungi admin logistik.');
  }
  function closeNF(){ hide($('#modalNF')); }

  function goBack(){
    hide($('#detailView'));
    show($('#searchView'));
    setQueryId('');
    $('#idInput').focus();
  }

  async function refreshData(){
    const id = $('#labelId').textContent;
    if(!id) return;
    show($('#liveSpinner'));
    try{
      const data = await fetchShipment(id);
      if(data) renderDetail(data);
    } finally{
      hide($('#liveSpinner'));
    }
  }

  // Expose untuk onclick di HTML
  window.TrackingUI = { goBack, refreshData, closeNF };

  // ===== Boot =====
  $('#year').textContent = new Date().getFullYear();

  // Submit form
  $('#searchForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const id = ($('#idInput').value||'').trim();
    const ID_PATTERN = new RegExp('^(PKG|SO)-[0-9]{5,}$','i');

    if(!id){
      showModal('ID belum diisi','Mohon masukkan ID pengiriman. Contoh: PKG-98431 atau SO-10015.');
      return;
    }
    if(!ID_PATTERN.test(id)){
      showModal('Format ID tidak valid','Gunakan format seperti PKG-98431 atau SO-10015 (huruf kode + tanda hubung + 5+ digit).');
      return;
    }
    handleSearch(id);
  });

  // Deep-link ?id=...
  (function(){
    const url = new URL(location.href);
    const id = (url.searchParams.get('id')||'').trim();
    if(id){ $('#idInput').value = id; handleSearch(id); }
  })();
})();
