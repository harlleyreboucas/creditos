/* =========================================================
   Créditos finais (versão compacta) — Harlley Rebouças
   Uso no template (uma linha só):
     <div id="creditos-harlley"></div>
     <script src="https://SEU-USUARIO.github.io/SEU-REPO/creditos-mini.js" defer="defer"></script>
   O script carrega o creditos-mini.css da mesma pasta sozinho.
   ========================================================= */
(function () {
  'use strict';

  // ---- Configuração (edite aqui) ----
  var CONFIG = {
    rotulo:   'Site desenvolvido por',
    nome:     'Harlley Rebouças',
    site:     'https://www.harlley.com.br',
    siteTxt:  'harlley.com.br',
    whatsapp: '5569999481714',
    foneTxt:  '(69) 99948-1714'
  };

  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^\/?#]*([?#].*)?$/, '') : '';

  function init() {
    // Onde montar: <div id="creditos-harlley"> ou, se não existir, logo antes do script
    var host = document.getElementById('creditos-harlley');
    if (!host) {
      host = document.createElement('div');
      if (script && script.parentNode) script.parentNode.insertBefore(host, script);
      else document.body.appendChild(host);
    }
    if (host.getAttribute('data-cf-ok')) return; // evita montar duas vezes
    host.setAttribute('data-cf-ok', '1');

    // Carrega o CSS (uma vez só)
    var wrap = document.createElement('div');
    wrap.className = 'cf-wrap';
    wrap.style.visibility = 'hidden'; // evita "piscar" sem estilo

    var show = function () { wrap.style.visibility = ''; };
    if (!document.getElementById('cf-creditos-mini.css')) {
      var link = document.createElement('link');
      link.id = 'cf-creditos-mini.css';
      link.rel = 'stylesheet';
      link.href = base + 'creditos-mini.css';
      link.onload = show;
      link.onerror = show;
      document.head.appendChild(link);
      setTimeout(show, 3000); // segurança caso o onload não dispare
    } else {
      show();
    }

    var ano = new Date().getFullYear();
    var wa = 'https://wa.me/' + CONFIG.whatsapp;

    wrap.innerHTML =
      '<div class="cf-stage" aria-hidden="true">' +
        '<div class="cf-orb cf-orb--1"></div><div class="cf-orb cf-orb--2"></div><div class="cf-orb cf-orb--3"></div>' +
        '<div class="cf-starfield"><div class="cf-layer"></div><div class="cf-layer"></div><div class="cf-layer"></div></div>' +
        '<div class="cf-shooting"></div>' +
      '</div>' +
      '<div class="cf-credit" role="contentinfo">' +
        '<a href="' + CONFIG.site + '" target="_blank" rel="noopener" class="cf-logo-link" aria-label="Visitar o site de ' + CONFIG.nome + '">' +
          '<div class="cf-logo"><div class="cf-echo"></div><div class="cf-trail"><div class="cf-trail-dark">' +
            '<div class="cf-trail-tail">' + repeat('<div class="cf-tail-line"></div>', 7) + '</div>' +
            '<div class="cf-planet">' + repeat('<div class="cf-planet-dot"></div>', 5) + '</div>' +
          '</div></div></div>' +
        '</a>' +
        '<div class="cf-text">' +
          '<span class="cf-label">' + CONFIG.rotulo + '</span>' +
          '<a href="' + CONFIG.site + '" target="_blank" rel="noopener" class="cf-name">' + CONFIG.nome + '</a>' +
          '<div class="cf-actions">' +
            '<a href="' + wa + '" target="_blank" rel="noopener" class="cf-btn cf-btn--wa" aria-label="Conversar no WhatsApp: ' + CONFIG.foneTxt + '">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18.1L0 24l6.1-1.6A12 12 0 1 0 12 0z"/></svg>' +
              '<span>' + CONFIG.foneTxt + '</span>' +
            '</a>' +
            '<a href="' + CONFIG.site + '" target="_blank" rel="noopener" class="cf-btn">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2H8c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4z"/></svg>' +
              '<span>' + CONFIG.siteTxt + '</span>' +
            '</a>' +
          '</div>' +
          '<small class="cf-copy">&copy; ' + ano + ' &middot; Todos os direitos reservados</small>' +
        '</div>' +
      '</div>';

    host.appendChild(wrap);
    criarEstrelas(wrap.querySelector('.cf-shooting'));
    observar(wrap);
  }

  function repeat(s, n) { var r = ''; while (n--) r += s; return r; }

  // Estrelas cadentes com tamanho, cor e tempo aleatórios
  function criarEstrelas(box) {
    if (!box) return;
    var mobile = window.matchMedia && window.matchMedia('(max-width: 560px)').matches;
    var total = mobile ? 20 : 45;
    var cores = ['#00ffe0', '#ffffff', '#ffd16e', '#ff6fa5', '#7fb8ff'];
    var rand = function (a, b) { return Math.random() * (b - a) + a; };
    var frag = document.createDocumentFragment();
    for (var i = 0; i < total; i++) {
      var s = document.createElement('div');
      s.className = 'cf-star';
      s.style.setProperty('--top', rand(0, 100).toFixed(1) + '%');
      s.style.setProperty('--tail', rand(5, 7.5).toFixed(2) + 'em');
      s.style.setProperty('--dur', rand(6, 12).toFixed(2) + 's');
      s.style.setProperty('--delay', rand(0, 10).toFixed(2) + 's');
      s.style.setProperty('--color', cores[Math.floor(Math.random() * cores.length)]);
      frag.appendChild(s);
    }
    box.appendChild(frag);
  }

  // Anima a entrada quando o rodapé aparece e pausa quando sai da tela
  function observar(wrap) {
    if (!('IntersectionObserver' in window)) { wrap.classList.add('cf-visible'); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { wrap.classList.add('cf-visible'); wrap.classList.remove('cf-paused'); }
        else { wrap.classList.add('cf-paused'); }
      });
    }, { threshold: 0.1 }).observe(wrap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
