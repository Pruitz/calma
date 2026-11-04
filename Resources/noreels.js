// ==UserScript==
// @name         Instagram senza Reels
// @match        https://www.instagram.com/*
// @run-at       document-start
// @noframes
// ==/UserScript==
//
// Questo stesso file funziona sia nell'app "Calma" sia in Safari con Userscripts.

(function () {
  'use strict';

  // ================= IMPOSTAZIONI =================
  const LIMITE_MINUTI = 0;           // minuti al giorno (le chat non contano); 0 = nessun limite
  const PAUSA_SECONDI = 10;          // attesa prima di entrare; 0 = nessuna pausa
  const MINUTI_PER_NUOVA_PAUSA = 5;  // se torni dopo 5+ minuti, nuova pausa
  const APRI_MESSAGGI = true;        // all'apertura vai alle chat invece che al feed

  // Apertura: direttamente ai messaggi
  if (APRI_MESSAGGI && location.pathname === '/') {
    location.replace('/direct/inbox/');
    return;
  }

  // ================= RICONOSCIMENTO PAGINE =================
  const isTabReels = (p) => p === '/reels/' || p === '/reels';
  const isReel = (p) => !isTabReels(p) && /\/reels?\//.test(p);
  const isChat = (p) => p.startsWith('/direct/');
  const isEsplora = (p) => p.startsWith('/explore');
  const isPost = (p) => /\/p\//.test(p);
  const isEsploraVietata = (p) => /^\/explore\/(tags|locations|search\/keyword)/.test(p);
  const idReel = (p) => (p.match(/\/reels?\/([^/]+)/) || [])[1] || null;

  // ================= CSS =================
  const style = document.createElement('style');
  style.textContent = `
    /* Tab Reels */
    a[href="/reels/"], a[href="/reels"] { display: none !important; }

    /* Post del feed tolti dallo script (reel e sponsorizzati) */
    [data-no-feed] { display: none !important; }

    /* Cerca: niente griglia, hashtag, luoghi, audio */
    html.ig-esplora a[href*="/p/"],
    html.ig-esplora a[href*="/reel/"],
    html.ig-esplora a[href^="/explore/tags/"],
    html.ig-esplora a[href^="/explore/locations/"],
    html.ig-esplora a[href^="/explore/search/keyword"],
    html.ig-esplora a[href*="/audio/"] { display: none !important; }
    html.ig-esplora div:has(> a[href*="/p/"]),
    html.ig-esplora div:has(> a[href*="/reel/"]) { display: none !important; }

    /* Cerca: niente indicatori di caricamento */
    html.ig-esplora [role="progressbar"],
    html.ig-esplora [data-visualcompletion="loading-state"],
    html.ig-esplora svg[aria-label*="aricamento"],
    html.ig-esplora svg[aria-label*="oading"] { display: none !important; }

    /* Schermata di pausa / limite */
    #noreels-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      display: none; flex-direction: column; align-items: center; justify-content: center;
      gap: 16px; padding: 32px; box-sizing: border-box;
      background: #000; color: #fff; text-align: center; touch-action: none;
      font: 17px -apple-system, system-ui, sans-serif;
    }
    #noreels-overlay.attivo { display: flex; }
    #noreels-overlay h1 { margin: 0 0 4px; font: 700 26px -apple-system, system-ui, sans-serif; color: #fff; }
    #noreels-overlay p { margin: 0 0 12px; opacity: .7; line-height: 1.4; color: #fff; }
    #noreels-overlay button {
      width: 100%; max-width: 320px; padding: 15px; border: 0; border-radius: 12px;
      font: 600 17px -apple-system, system-ui, sans-serif; background: #fff; color: #000;
    }
    #noreels-overlay button.secondario { background: #262626; color: #fff; }
    #noreels-overlay button:disabled { opacity: .35; }
    #noreels-overlay button.link { background: transparent; color: #fff; opacity: .6; font-weight: 400; padding: 8px; }
    #noreels-overlay small { opacity: .45; font-size: 13px; line-height: 1.4; }
  `;
  document.documentElement.appendChild(style);

  // ================= FEED: reel e post sponsorizzati =================
  // Parole che Instagram usa per le pubblicità (a volte spezzate in più pezzi)
  const PAROLE_ADV = /^(sponsorizzat[oa]|postsponsorizzato|sponsored|pubblicit[aà])$/i;
  const pulisci = (t) => t.replace(/[\s ​-‍﻿·•]/g, '');

  // "Partnership pagata con …" / "Paid partnership with …"
  const PAROLE_PARTNERSHIP = /^(partnershippagata|paidpartnership|collaborazioneretribuita)/i;
  const isPartnership = (art) => {
    for (const el of art.querySelectorAll('span, a, div, button')) {
      if (el.childElementCount > 15) continue;
      const t = el.textContent;
      if (t && t.length <= 80 && PAROLE_PARTNERSHIP.test(pulisci(t))) return true;
    }
    return false;
  };

  const isAdv = (art) => {
    if (art.querySelector('a[href*="l.instagram.com"], a[href*="/ads/"]')) return true;
    for (const el of art.querySelectorAll('span, a, div')) {
      if (el.childElementCount > 15) continue;
      const t = el.textContent;
      if (t && t.length <= 30 && PAROLE_ADV.test(pulisci(t))) return true;
    }
    return false;
  };

  // Contenitore che scorre (di solito la pagina intera)
  const contenitoreScroll = (el) => {
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight) return e;
    }
    return document.scrollingElement || document.documentElement;
  };

  // Primo elemento che viene dopo "el" nella pagina (fuori da el)
  const elementoDopo = (el) => {
    let e = el;
    while (e && !e.nextElementSibling) e = e.parentElement;
    return e ? e.nextElementSibling : null;
  };

  // Nasconde un post senza far saltare quello che stai leggendo
  const nascondiNelFeed = (el, motivo) => {
    if (el.dataset.noFeed) return;
    const r = el.getBoundingClientRect();
    const sc = contenitoreScroll(el);
    const cimaSchermo = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
    const rif = r.top < cimaSchermo ? elementoDopo(el) : null;
    const prima = rif ? rif.getBoundingClientRect().top : 0;

    el.dataset.noFeed = motivo;
    el.style.setProperty('display', 'none', 'important');

    // Il post stava sopra lo schermo: riporta il contenuto dov'era
    if (rif) {
      const dopo = rif.getBoundingClientRect().top;
      if (dopo !== prima) sc.scrollTop += dopo - prima;
    }
  };

  const valutaArticolo = (art) => {
    if (art.dataset.noFeed) return;
    if (art.querySelector('a[href*="/reel/"]')) nascondiNelFeed(art, 'reel');
    else if (isAdv(art)) nascondiNelFeed(art, 'adv');
    else if (isPartnership(art)) nascondiNelFeed(art, 'partnership');
  };

  // Riserva: blocchi di reel suggeriti fuori dai post
  const valutaReelSciolti = (radice) => {
    radice.querySelectorAll('a[href*="/reel/"]').forEach((a) => {
      if (a.closest('article') || a.closest('[data-no-feed]')) return;
      let el = a;
      for (let i = 0; i < 20 && el.parentElement && el.parentElement !== document.body; i++) {
        const padre = el.parentElement;
        if (padre.querySelector('article')) break; // mai nascondere il feed intero
        if (padre.children.length >= 3 && el.getBoundingClientRect().height > 200) {
          nascondiNelFeed(el, 'reel');
          return;
        }
        el = padre;
      }
    });
  };

  // Controlla solo le parti della pagina appena cambiate
  const controllaFeed = (nodi) => {
    if (location.pathname !== '/') return;
    const articoli = new Set();
    for (let n of nodi) {
      if (n && n.nodeType !== 1) n = n.parentElement;
      if (!n || !n.isConnected) continue;
      const a = n.closest('article');
      if (a) articoli.add(a);
      else {
        n.querySelectorAll('article').forEach((x) => articoli.add(x));
        valutaReelSciolti(n);
      }
    }
    articoli.forEach(valutaArticolo);
  };

  // ================= BLOCCO DELLO SCORRIMENTO =================
  const videoSchermoIntero = () => {
    const h = window.innerHeight;
    return [...document.querySelectorAll('video')].some((v) => {
      const r = v.getBoundingClientRect();
      return r.height > h * 0.6 && r.top < h * 0.5 && r.bottom > h * 0.5;
    });
  };

  let blocca = false;
  let posizioni = new Map();

  window.addEventListener('touchstart', (e) => {
    const p = location.pathname;
    blocca = isReel(p) || (isChat(p) && videoSchermoIntero());
    posizioni = new Map();
    if (!blocca) return;
    for (let el = e.target; el && el.nodeType === 1; el = el.parentElement) {
      posizioni.set(el, el.scrollTop);
    }
    const doc = document.scrollingElement;
    if (doc) posizioni.set(doc, doc.scrollTop);
  }, { capture: true, passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!blocca) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }, { capture: true, passive: false });

  document.addEventListener('scroll', (e) => {
    const el = e.target === document ? document.scrollingElement : e.target;
    if (posizioni.has(el) && el.scrollTop !== posizioni.get(el)) {
      el.scrollTop = posizioni.get(el);
    }
  }, true);

  // ================= CONTROLLO DELLA NAVIGAZIONE =================
  let ultimaPagina = null;
  let reelConsentito = null;
  let pausaFino = 0;

  const esci = () => {
    pausaFino = Date.now() + 1500;
    if (history.length > 1) history.back();
    else location.replace('/direct/inbox/');
  };

  const controlla = () => {
    const p = location.pathname;
    document.documentElement.classList.toggle('ig-esplora', isEsplora(p));
    if (Date.now() < pausaFino) return;

    if (isTabReels(p)) {
      pausaFino = Date.now() + 1500;
      location.replace('/direct/inbox/');
      return;
    }
    if (isEsploraVietata(p)) { esci(); return; }

    if (!isReel(p)) {
      if (isPost(p) && ultimaPagina && isEsplora(ultimaPagina)) { esci(); return; }
      ultimaPagina = p;
      reelConsentito = null;
      return;
    }
    if (reelConsentito === null) {
      const daChat = ultimaPagina === null || isChat(ultimaPagina);
      if (daChat) reelConsentito = idReel(p);
      else esci();
    } else if (idReel(p) !== reelConsentito) {
      esci();
    }
  };

  // ================= TEMPO GIORNALIERO E PAUSA =================
  const CHIAVE_TEMPO = 'noreels-tempo';
  const oggi = () => new Date().toLocaleDateString('sv'); // AAAA-MM-GG

  const leggiSecondi = () => {
    try {
      const d = JSON.parse(localStorage.getItem(CHIAVE_TEMPO) || '{}');
      return d.data === oggi() ? (d.secondi || 0) : 0;
    } catch (e) { return 0; }
  };
  const salvaSecondi = (s) => {
    try { localStorage.setItem(CHIAVE_TEMPO, JSON.stringify({ data: oggi(), secondi: s })); } catch (e) {}
  };

  // Pausa attivabile/disattivabile dall'app (scuoti il telefono → Impostazioni)
  const CHIAVE_PAUSA = 'calma-pausa';
  const pausaAttiva = () => {
    if (PAUSA_SECONDI <= 0) return false;
    try { return localStorage.getItem(CHIAVE_PAUSA) !== 'no'; } catch (e) { return true; }
  };
  const impostaPausa = (si) => {
    try { localStorage.setItem(CHIAVE_PAUSA, si ? 'si' : 'no'); } catch (e) {}
  };

  // Chat e reel ricevuti in chat: liberi, non contano nel tempo
  const zonaLibera = (p) => isChat(p) || (isReel(p) && reelConsentito !== null);

  const crea = (tag, testo, classe) => {
    const el = document.createElement(tag);
    if (testo) el.textContent = testo;
    if (classe) el.className = classe;
    return el;
  };

  const overlay = crea('div');
  overlay.id = 'noreels-overlay';
  overlay.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  let modalita = null; // null | 'pausa' | 'limite' | 'impostazioni'
  let pausaFatta = false;
  let finePausa = 0;
  let pulsanteEntra = null;
  let nascostoDa = null;

  const vaiAiMessaggi = () => { location.href = '/direct/inbox/'; };

  const aggiornaConteggio = () => {
    if (modalita !== 'pausa' || !pulsanteEntra) return;
    const s = Math.ceil((finePausa - Date.now()) / 1000);
    pulsanteEntra.disabled = s > 0;
    pulsanteEntra.textContent = s > 0 ? `Entra tra ${s}…` : 'Entra';
  };

  const nascondi = () => {
    modalita = null;
    pulsanteEntra = null;
    overlay.classList.remove('attivo');
    overlay.replaceChildren();
  };

  const mostra = (nuova) => {
    if (modalita === nuova) return;
    modalita = nuova;
    overlay.replaceChildren();

    if (nuova === 'impostazioni') {
      pulsanteEntra = null;
      const btnPausa = crea('button', '');
      const scrivi = () => {
        btnPausa.textContent = pausaAttiva() ? 'Pausa all’ingresso: SÌ' : 'Pausa all’ingresso: NO';
      };
      btnPausa.addEventListener('click', () => { impostaPausa(!pausaAttiva()); scrivi(); });
      scrivi();
      const btnChiudi = crea('button', 'Chiudi', 'secondario');
      btnChiudi.addEventListener('click', () => { pausaFatta = true; nascondi(); });
      overlay.append(
        crea('h1', 'Impostazioni'),
        crea('p', `Con la pausa attiva, prima di uscire dalle chat aspetti ${PAUSA_SECONDI} secondi.`),
        btnPausa,
        btnChiudi
      );
      overlay.classList.add('attivo');
      return;
    }

    const btnMessaggi = crea('button', 'Vai ai messaggi', nuova === 'pausa' ? 'secondario' : '');
    btnMessaggi.addEventListener('click', vaiAiMessaggi);

    if (nuova === 'pausa') {
      finePausa = Date.now() + PAUSA_SECONDI * 1000;
      const restanti = Math.max(0, LIMITE_MINUTI - Math.floor(leggiSecondi() / 60));
      const sottotitolo = LIMITE_MINUTI > 0
        ? `Oggi ti restano ${restanti} minuti di Instagram.`
        : 'Prenditi un momento prima di entrare.';
      pulsanteEntra = crea('button', '');
      pulsanteEntra.addEventListener('click', () => {
        if (Date.now() < finePausa) return;
        pausaFatta = true;
        nascondi();
      });
      const btnDisattiva = crea('button', 'Disattiva la pausa', 'link');
      btnDisattiva.addEventListener('click', () => {
        impostaPausa(false);
        pausaFatta = true;
        nascondi();
      });
      overlay.append(
        crea('h1', 'Cosa sei venuto a fare?'),
        crea('p', sottotitolo),
        pulsanteEntra,
        btnMessaggi,
        btnDisattiva,
        crea('small', 'Scuoti il telefono per aprire le impostazioni.')
      );
      aggiornaConteggio();
    } else {
      overlay.append(
        crea('h1', 'Tempo finito per oggi'),
        crea('p', `Hai usato i tuoi ${LIMITE_MINUTI} minuti. Le chat restano disponibili.`),
        btnMessaggi
      );
    }
    overlay.classList.add('attivo');
  };

  const aggiornaOverlay = () => {
    if (!overlay.isConnected) document.documentElement.appendChild(overlay);
    if (modalita === 'impostazioni') return;
    const p = location.pathname;
    if (zonaLibera(p)) { if (modalita) nascondi(); return; }
    if (LIMITE_MINUTI > 0 && leggiSecondi() >= LIMITE_MINUTI * 60) { mostra('limite'); return; }
    if (!pausaFatta && pausaAttiva()) { mostra('pausa'); return; }
    if (modalita) nascondi();
  };

  // Chiamata dall'app quando scuoti il telefono
  window.__calmaImpostazioni = () => {
    if (!overlay.isConnected) document.documentElement.appendChild(overlay);
    mostra('impostazioni');
  };

  // Conta i secondi solo fuori dalle chat, con Instagram visibile
  setInterval(() => {
    aggiornaConteggio();
    if (document.visibilityState !== 'visible') return;
    if (modalita !== null || zonaLibera(location.pathname)) return;
    salvaSecondi(leggiSecondi() + 1);
  }, 1000);

  // Se torni dopo un po', nuova pausa
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      nascostoDa = Date.now();
    } else if (nascostoDa && Date.now() - nascostoDa > MINUTI_PER_NUOVA_PAUSA * 60000) {
      pausaFatta = false;
    }
  });

  // ================= BANNER "INSTALLA / APRI L'APP" =================
  const FRASI_APP = /(installa|scarica|ottieni|usa|apri|passa a)\s*(l['’]\s*)?app\b|nell['’]\s*app\b|\b(get|use|open|install|download|switch to)\s+(the\s+)?app\b|\bapp\s+instagram\b|\binstagram\s+app\b/i;

  const isBarraPrincipale = (el) =>
    el.querySelector('a[href="/"], a[href*="/direct/"], a[href*="/accounts/activity"], a[href*="/explore"]');

  const isPosizioneBanner = (el) => {
    const r = el.getBoundingClientRect();
    if (r.top + window.scrollY < 200) return true;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const pos = getComputedStyle(e).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  };

  const nascondiStriscia = (partenza) => {
    let box = partenza;
    while (
      box.parentElement &&
      box.parentElement !== document.body &&
      box.parentElement.getBoundingClientRect().height < 120 &&
      !isBarraPrincipale(box.parentElement)
    ) {
      box = box.parentElement;
    }
    box.dataset.noApp = '1';
    box.style.setProperty('display', 'none', 'important');
  };

  const giaGestito = (el) => !!el.closest('[data-no-app]');

  const togliBanner = () => {
    document.querySelectorAll('meta[name="apple-itunes-app"]').forEach((m) => m.remove());
    if (!document.body) return;
    const p = location.pathname;

    document
      .querySelectorAll('a[href*="apps.apple.com"], a[href*="itunes.apple.com"], a[href^="instagram://"]')
      .forEach((el) => { if (!giaGestito(el)) nascondiStriscia(el); });

    if (isChat(p) || isPost(p)) return;

    document.querySelectorAll('[aria-label]').forEach((el) => {
      if (giaGestito(el) || el.closest('article')) return;
      const label = el.getAttribute('aria-label') || '';
      if (label.length < 60 && FRASI_APP.test(label) && isPosizioneBanner(el)) nascondiStriscia(el);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const trovati = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue;
      if (!t || t.length > 80 || !FRASI_APP.test(t)) continue;
      const el = n.parentElement;
      if (el && !giaGestito(el) && !el.closest('article')) trovati.push(el);
    }
    trovati.forEach((el) => {
      if (!giaGestito(el) && isPosizioneBanner(el)) nascondiStriscia(el);
    });
  };

  // ================= CICLO PRINCIPALE =================
  let ultimoGiro = 0;
  const giro = () => {
    ultimoGiro = Date.now();
    if (!style.isConnected) document.documentElement.appendChild(style);
    controlla();
    aggiornaOverlay();
    togliBanner();
  };

  new MutationObserver((mutazioni) => {
    const cambiati = new Set();
    for (const m of mutazioni) {
      cambiati.add(m.target);
      for (const n of m.addedNodes) {
        if (n.nodeName === 'META' && n.getAttribute('name') === 'apple-itunes-app') n.remove();
        else cambiati.add(n);
      }
    }
    // Subito, prima che la pagina venga disegnata: così il feed non salta
    controllaFeed(cambiati);
    if (Date.now() - ultimoGiro > 250) giro();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  setInterval(giro, 300);
  // Controllo completo del feed ogni tanto, per sicurezza
  setInterval(() => { if (document.body) controllaFeed([document.body]); }, 2000);
  giro();
})();
