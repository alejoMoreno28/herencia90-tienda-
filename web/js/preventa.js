

(function () {
        var ppStep = 1;
        var PP_TOTAL = 4;
        var PP_LABELS = ['Camiseta', 'Talla', 'Mis Datos', 'Confirmar'];

        function ppRenderProgress() {
            var el = document.getElementById('pp-progress');
            if (!el) return;
            var html = '';
            for (var i = 1; i <= PP_TOTAL; i++) {
                var done = i < ppStep, active = i === ppStep;
                var connColor = i < ppStep ? 'var(--gold-dark)' : 'rgba(255,255,255,0.1)';
                var numBg = done ? 'var(--gold-dark)' : active ? 'var(--gold)' : 'rgba(255,255,255,0.04)';
                var numBorder = done ? 'var(--gold-dark)' : active ? 'var(--gold)' : 'rgba(255,255,255,0.15)';
                var numColor = done ? '#fff' : active ? '#111' : 'var(--text-secondary)';
                var labelColor = active ? 'var(--gold)' : 'var(--text-secondary)';
                var labelWeight = active ? '700' : '400';
                var glow = active ? 'box-shadow:0 0 0 4px rgba(217,195,145,0.15);' : '';
                var connector = i < PP_TOTAL
                    ? '<div style="position:absolute;top:13px;left:calc(50% + 15px);right:calc(-50% + 15px);height:1px;background:' + connColor + ';z-index:0;"></div>'
                    : '';
                html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;">' +
                    connector +
                    '<div style="width:28px;height:28px;border-radius:50%;border:2px solid ' + numBorder + ';background:' + numBg + ';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:' + numColor + ';position:relative;z-index:1;' + glow + '">' + (done ? 'âœ“' : i) + '</div>' +
                    '<div style="font-size:0.58rem;color:' + labelColor + ';font-weight:' + labelWeight + ';text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;">' + PP_LABELS[i - 1] + '</div>' +
                    '</div>';
            }
            el.innerHTML = html;
        }

        function ppShowSlide(n) {
            for (var i = 1; i <= PP_TOTAL; i++) {
                var s = document.getElementById('pp-slide-' + i);
                if (s) s.style.display = i === n ? 'block' : 'none';
            }
            var backBtn = document.getElementById('pp-back-btn');
            var nextBtn = document.getElementById('pp-next-btn');
            if (backBtn) backBtn.style.display = n > 1 ? 'inline-block' : 'none';
            if (nextBtn) nextBtn.style.display = n < PP_TOTAL ? 'block' : 'none';
            ppRenderProgress();
        }

        function ppValidate() {
            if (ppStep === 1) {
                var eq = document.getElementById('pp-equipo');
                if (!eq.value.trim()) {
                    eq.style.borderColor = '#ff5252'; eq.focus();
                    setTimeout(function () { eq.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1800);
                    return false;
                }
            }
            if (ppStep === 2) {
                if (!document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected')) {
                    var gbns = document.querySelectorAll('#pp-genero-btns .pp-talla-btn');
                    gbns.forEach(function(b){ b.style.borderColor='#ff5252'; });
                    setTimeout(function(){ gbns.forEach(function(b){ b.style.borderColor=''; }); }, 1800);
                    return false;
                }
                if (!document.querySelector('#pp-talla-btns .pp-talla-btn.pp-selected')) {
                    var tbns = document.querySelectorAll('#pp-talla-btns .pp-talla-btn');
                    tbns.forEach(function(b){ b.style.borderColor='#ff5252'; });
                    setTimeout(function(){ tbns.forEach(function(b){ b.style.borderColor=''; }); }, 1800);
                    return false;
                }
            }
            if (ppStep === 3) {
                var ids = ['pp-nombre', 'pp-celular', 'pp-ciudad'];
                for (var f = 0; f < ids.length; f++) {
                    var el = document.getElementById(ids[f]);
                    if (!el.value.trim()) {
                        el.style.borderColor = '#ff5252'; el.focus();
                        (function(e){ setTimeout(function(){ e.style.borderColor='rgba(255,255,255,0.1)'; }, 1800); })(el);
                        return false;
                    }
                }
            }
            return true;
        }

        function ppBuildSummary() {
            var equipo    = document.getElementById('pp-equipo').value.trim();
            var temporada = document.getElementById('pp-temporada').value.trim();
            var tipoBtn   = document.querySelector('#pp-slide-1 .pp-tipo-btn.pp-selected');
            var tipo      = tipoBtn ? tipoBtn.dataset.val : 'No especificado';
            var tallaBtn  = document.querySelector('.pp-talla-btn.pp-selected');
            var talla     = tallaBtn ? tallaBtn.dataset.val : '';
            var isCustom  = document.getElementById('pp-custom-si').classList.contains('pp-selected');
            var cNombre   = document.getElementById('pp-custom-nombre').value.trim();
            var cNum      = document.getElementById('pp-custom-num').value.trim();
            var nombre    = document.getElementById('pp-nombre').value.trim();
            var celular   = document.getElementById('pp-celular').value.trim();
            var ciudad    = document.getElementById('pp-ciudad').value.trim();
            var notas     = document.getElementById('pp-notas').value.trim();

            // Parches seleccionados
            var patchBtns = document.querySelectorAll('#pp-patches .pp-tipo-btn.pp-selected');
            var patches = [];
            patchBtns.forEach(function(b){ patches.push(b.dataset.val); });
            var patchOtro = document.getElementById('pp-patch-otro').value.trim();
            if (patchOtro) patches.push(patchOtro);

            var personaliz = 'Sin nombre/n&uacute;mero';
            if (isCustom) {
                personaliz = 'Con nombre/n&uacute;mero';
                if (cNombre) personaliz += ' â€” ' + cNombre.toUpperCase();
                if (cNum)    personaliz += ' #' + cNum;
            }
            var patchesStr = patches.length ? patches.join(', ') : 'Sin parches';

            var generoBtn2 = document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected');
            var genero2    = generoBtn2 ? generoBtn2.dataset.val : 'No especificado';
            var rows = [
                ['Equipo / Selecci&oacute;n', equipo],
                ['Tipo', tipo],
                ['Temporada', temporada || 'La m&aacute;s reciente'],
                ['G&eacute;nero', genero2],
                ['Talla', talla],
                ['divider', ''],
                ['Nombre/n&uacute;mero', personaliz],
                ['Parches', patchesStr],
                ['divider', ''],
                ['Tu nombre', nombre],
                ['Celular', celular],
                ['Ciudad', ciudad]
            ];
            if (notas) rows.push(['Notas', notas]);

            var box = document.getElementById('pp-summary-box');
            box.innerHTML = rows.map(function(r) {
                if (r[0] === 'divider') return '<div style="border-bottom:1px solid rgba(255,255,255,0.07);margin:7px 0;"></div>';
                return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);gap:12px;">' +
                    '<span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);min-width:110px;flex-shrink:0;">' + r[0] + '</span>' +
                    '<span style="font-size:0.83rem;font-weight:600;color:#fff;text-align:right;">' + r[1] + '</span>' +
                    '</div>';
            }).join('');

            // Extras para el mensaje WA
            var extrasLines = [];
            if (isCustom) extrasLines.push('  â€¢ Nombre/n&uacute;mero: ' + personaliz.replace('Con nombre/n&uacute;mero â€” ','').replace('Con nombre/n&uacute;mero','').trim() || personaliz);
            if (patches.length) extrasLines.push('  â€¢ Parches: ' + patches.join(', '));
            var extrasStr = extrasLines.length
                ? '\n\nðŸ“‹ *Extras a cotizar (costo adicional):*\n' + extrasLines.join('\n')
                : '\n\nðŸ“‹ *Extras:* Sin extras adicionales';

            var notasStr = notas ? '\nðŸ“ *Notas:* ' + notas : '';
            var generoBtn  = document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected');
            var genero     = generoBtn ? generoBtn.dataset.val : '';
            var msg = 'ðŸ·ï¸ *COTIZACI&Oacute;N PRE-VENTA â€” HERENCIA 90*\n\n' +
                'ðŸ‘• *Camiseta:* ' + equipo + ' â€” ' + tipo + ' â€” ' + (temporada || 'La m&aacute;s reciente') + '\n' +
                (genero ? 'ðŸ§ *G&eacute;nero:* ' + genero + '\n' : '') +
                'ðŸ“ *Talla:* ' + talla +
                extrasStr + '\n\n' +
                'ðŸ‘¤ *Nombre:* ' + nombre + '\n' +
                'ðŸ“± *Celular:* ' + celular + '\n' +
                'ðŸ“ *Ciudad:* ' + ciudad + notasStr + '\n\n' +
                'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n' +
                '&iquest;Me puedes cotizar el total con todo incluido?\n' +
                'ðŸ’° Entiendo que el anticipo es del 20%.\n' +
                'â±ï¸ Entrega ~15 d&iacute;as h&aacute;biles.';

            document.getElementById('pp-wa-btn').href = 'https://wa.me/573126428153?text=' + encodeURIComponent(msg);
        }

        window.ppNext = function () {
            if (!ppValidate()) return;
            if (ppStep === PP_TOTAL - 1) ppBuildSummary();
            ppStep = Math.min(ppStep + 1, PP_TOTAL);
            ppShowSlide(ppStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        window.ppBack = function () {
            if (ppStep > 1) { ppStep--; ppShowSlide(ppStep); }
        };
        window.ppSelectTipo = function (btn) {
            btn.closest('div').querySelectorAll('.pp-tipo-btn').forEach(function(b){ b.classList.remove('pp-selected'); });
            btn.classList.add('pp-selected');
        };
        window.ppTogglePatch = function (btn) {
            btn.classList.toggle('pp-selected');
        };
        window.ppSelectTalla = function (btn) {
            document.querySelectorAll('#pp-talla-btns .pp-talla-btn').forEach(function(b){ b.classList.remove('pp-selected'); });
            btn.classList.add('pp-selected');
        };
        window.ppSelectGenero = function (btn) {
            document.querySelectorAll('#pp-genero-btns .pp-talla-btn').forEach(function(b){ b.classList.remove('pp-selected'); });
            btn.classList.add('pp-selected');
        };
        window.ppSelectCustom = function (val) {
            ['no','si'].forEach(function(v){
                document.getElementById('pp-custom-'+v).classList.toggle('pp-selected', v === val);
            });
            document.getElementById('pp-custom-fields').style.display = val === 'si' ? 'block' : 'none';
        };

        document.addEventListener('DOMContentLoaded', function () {
            ppRenderProgress();
            ppShowSlide(1);
            ppSelectCustom('no');
        });
    })();

(function () {
        var SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
        var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
        var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        var _pvAll = [];           // todas las referencias cargadas
        var _pvFiltroType = 'all'; // tipo de filtro activo
        var _pvFiltroVal  = '';    // valor del filtro activo

        // ── Cargar desde Supabase ─────────────────────────────────────

        async function pvCargar() {
            var galSection = document.getElementById('pv-galeria');
            try {
                var res = await db.from('preventa_catalogo')
                    .select('id,slug,equipo,temporada,tipo,categoria,decada,imagenes,destacado,descripcion,precio_aprox')
                    .eq('publicado', true)
                    .order('destacado', { ascending: false });

                if (res.error) throw res.error;
                _pvAll = res.data || [];

                if (!_pvAll.length) {
                    // Sin referencias aún — ocultar sección completa
                    galSection.style.display = 'none';
                    return;
                }

                galSection.style.display = '';
                pvRenderGrid(_pvAll);
            } catch (e) {
                galSection.style.display = 'none';
                console.warn('[pv-galeria] Error cargando catálogo:', e.message);
            }
        }

        // ── Filtros ───────────────────────────────────────────────────

        window.pvFiltrar = function (btn, type, val) {
            document.querySelectorAll('.pv-filtro-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            _pvFiltroType = type;
            _pvFiltroVal  = val;
            pvApplyFilters();
        };

        window.pvReset = function () {
            document.getElementById('pv-search').value = '';
            var btn = document.querySelector('.pv-filtro-btn[data-filtro-type="all"]');
            if (btn) window.pvFiltrar(btn, 'all', '');
        };

        // Combinar filtro de categoría + búsqueda de texto
        function pvApplyFilters() {
            var searchTerm = (document.getElementById('pv-search').value || '').trim().toLowerCase();

            var filtered = _pvAll.filter(function (r) {
                // Filtro de categoría
                var passFilter = true;
                if (_pvFiltroType !== 'all') {
                    if (_pvFiltroType === 'destacado') passFilter = r.destacado;
                    else passFilter = r[_pvFiltroType] === _pvFiltroVal;
                }
                if (!passFilter) return false;

                // Filtro de búsqueda
                if (searchTerm) {
                    var haystack = [
                        r.equipo, r.temporada, r.tipo, r.categoria,
                        r.pais_o_club, r.descripcion, (r.tags || []).join(' ')
                    ].join(' ').toLowerCase();
                    return haystack.indexOf(searchTerm) !== -1;
                }
                return true;
            });

            pvRenderGrid(filtered);
        }

        // ── Render grid ───────────────────────────────────────────────

        function pvRenderGrid(items) {
            var grid = document.getElementById('pv-grid');
            var empty = document.getElementById('pv-empty');

            if (!items.length) {
                grid.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';

            grid.innerHTML = items.map(function (r, idx) {
                var imgs = r.imagenes || [];
                var img1 = imgs[0] ? imgs[0].url : '';
                var img2 = imgs[1] ? imgs[1].url : (imgs[0] ? imgs[0].url : '');
                var tipoLabel = (r.tipo || '').replace(/-/g,' ');
                var nFotos = imgs.length;
                var precio = pvGetPrecio(r.tipo);

                return '<div class="pv-card-item" onclick="pvAbrirLightbox(' + idx + ')" data-pv-idx="' + idx + '">' +
                    '<div class="pv-card-img-wrap">' +
                        (img1 ? '<img class="pv-img-main" src="' + img1 + '" alt="' + escHtml(r.equipo) + '" loading="lazy">' : '') +
                        (img2 ? '<img class="pv-img-hover" src="' + img2 + '" alt="' + escHtml(r.equipo) + ' - foto 2" loading="lazy">' : '') +
                        (r.destacado ? '<span class="pv-dest-badge">&#9733; Top</span>' : '') +
                        (nFotos > 1 ? '<span class="pv-photo-count"><i class="ph-bold ph-images"></i> ' + nFotos + '</span>' : '') +
                    '</div>' +
                    '<div class="pv-card-info">' +
                        '<div class="pv-card-equipo">' + escHtml(r.equipo) + '</div>' +
                        '<div class="pv-card-precio">' + precio + '</div>' +
                        '<div class="pv-card-meta">' + escHtml(r.temporada) + ' &middot; ' + tipoLabel + '</div>' +
                        '<div class="pv-card-cta"><i class="ph-bold ph-eye"></i> Ver fotos</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }

        function escHtml(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        // ── Prefill del wizard ────────────────────────────────────────

        window.pvSeleccionar = function (rJson) {
            var r;
            try { r = JSON.parse(rJson); } catch { return; }

            // Prellenar campos del wizard
            var equipoEl = document.getElementById('pp-equipo');
            if (equipoEl) equipoEl.value = r.equipo || '';

            var tempEl = document.getElementById('pp-temporada');
            if (tempEl) tempEl.value = r.temporada || '';

            // Seleccionar el tipo en los botones del wizard (si existen)
            if (r.tipo) {
                document.querySelectorAll('#pp-slide-1 .pp-tipo-btn').forEach(function (btn) {
                    var match = btn.dataset.val && r.tipo.toLowerCase().includes(btn.dataset.val.toLowerCase());
                    btn.classList.toggle('pp-selected', match);
                });
            }

            // Guardar referencia interna en campo oculto
            var refEl = document.getElementById('pp-ref-interna');
            if (refEl) refEl.value = r.slug || '';

            // Scroll suave al wizard
            var anchor = document.getElementById('pv-wizard-anchor');
            if (anchor) {
                anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        // ── Inyectar ref. interna al mensaje de WA ──────────────────
        // Envuelve ppBuildSummary para agregar la línea REF- al final del msg
        document.addEventListener('DOMContentLoaded', function () {
            var _origBuildSummary = window.ppBuildSummary;
            if (typeof _origBuildSummary === 'function') {
                window.ppBuildSummary = function () {
                    _origBuildSummary();
                    var btn = document.getElementById('pp-wa-btn');
                    var refEl = document.getElementById('pp-ref-interna');
                    if (!btn || !refEl || !refEl.value) return;
                    var href = btn.href;
                    try {
                        var parts = href.split('?text=');
                        if (parts.length < 2) return;
                        var decoded = decodeURIComponent(parts[1]);
                        var ref = '\n\n\uD83D\uDD16 Ref. interna: REF-' + refEl.value;
                        if (decoded.indexOf('Ref. interna') === -1) {
                            btn.href = parts[0] + '?text=' + encodeURIComponent(decoded + ref);
                        }
                    } catch (e) { /* silencioso */ }
                };
            }
        });

        // ── Precio según tipo ──────────────────────────────────────────
        function pvGetPrecio(tipo) {
            if (!tipo) return '';
            var t = tipo.toLowerCase();
            if (t === 'retro') return '$120.000';
            if (t === 'player' || t === 'manga-larga') return '$110.000';
            return '$99.000';
        }

        // ── Lightbox ──────────────────────────────────────────────────
        var _pvCurrentItems = [];     // referencia al array filtrado actual
        var _pvLbData = null;         // referencia activa en el lightbox
        var _pvLbIdx = 0;             // índice de foto actual

        // Guardar referencia al array filtrado para el lightbox
        var _origPvRenderGrid = pvRenderGrid;
        pvRenderGrid = function(items) {
            _pvCurrentItems = items;
            _origPvRenderGrid(items);
        };

        window.pvAbrirLightbox = function(itemIdx) {
            var r = _pvCurrentItems[itemIdx];
            if (!r) return;
            _pvLbData = r;
            _pvLbIdx = 0;

            var imgs = r.imagenes || [];
            if (!imgs.length) { pvSeleccionar(JSON.stringify(r)); return; }

            var lb = document.getElementById('pv-lightbox');
            var tipoLabel = (r.tipo || '').replace(/-/g,' ');
            var precio = pvGetPrecio(r.tipo);

            document.getElementById('pv-lb-equipo').textContent = r.equipo || '';
            document.getElementById('pv-lb-meta').textContent =
                (r.temporada || '') + ' · ' + tipoLabel;
            document.getElementById('pv-lb-precio').textContent = precio;

            // Render thumbnails
            var thumbsEl = document.getElementById('pv-lb-thumbs');
            if (imgs.length > 1) {
                thumbsEl.innerHTML = imgs.map(function(img, i) {
                    return '<img class="pv-lb-thumb' + (i === 0 ? ' active' : '') + '" ' +
                        'src="' + img.url + '" alt="Foto ' + (i+1) + '" ' +
                        'onclick="pvLbGoTo(' + i + ')">';
                }).join('');
                thumbsEl.style.display = 'flex';
            } else {
                thumbsEl.innerHTML = '';
                thumbsEl.style.display = 'none';
            }

            // Show/hide arrows
            document.getElementById('pv-lb-prev').style.display = imgs.length > 1 ? 'flex' : 'none';
            document.getElementById('pv-lb-next').style.display = imgs.length > 1 ? 'flex' : 'none';

            pvLbShowImg(0);

            lb.classList.add('entering');
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    lb.classList.remove('entering');
                    lb.classList.add('active');
                });
            });
            document.body.style.overflow = 'hidden';
        };

        function pvLbShowImg(idx) {
            var imgs = (_pvLbData && _pvLbData.imagenes) || [];
            if (!imgs.length) return;
            _pvLbIdx = ((idx % imgs.length) + imgs.length) % imgs.length;

            var imgEl = document.getElementById('pv-lb-img');
            imgEl.classList.add('switching');
            setTimeout(function() {
                imgEl.src = imgs[_pvLbIdx].url;
                imgEl.alt = (_pvLbData.equipo || '') + ' - foto ' + (_pvLbIdx + 1);
                imgEl.classList.remove('switching');
            }, 150);

            // Update counter
            document.getElementById('pv-lb-counter').textContent =
                (_pvLbIdx + 1) + ' / ' + imgs.length;

            // Update thumbs
            var thumbs = document.querySelectorAll('.pv-lb-thumb');
            thumbs.forEach(function(t, i) {
                t.classList.toggle('active', i === _pvLbIdx);
            });

            // Scroll active thumb into view
            if (thumbs[_pvLbIdx]) {
                thumbs[_pvLbIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }

        window.pvLbGoTo = function(idx) { pvLbShowImg(idx); };

        function pvLbCerrar() {
            var lb = document.getElementById('pv-lightbox');
            lb.classList.remove('active');
            lb.classList.remove('entering');
            document.body.style.overflow = '';
            _pvLbData = null;
        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('pv-lb-close').addEventListener('click', pvLbCerrar);
            document.getElementById('pv-lb-prev').addEventListener('click', function() {
                pvLbShowImg(_pvLbIdx - 1);
            });
            document.getElementById('pv-lb-next').addEventListener('click', function() {
                pvLbShowImg(_pvLbIdx + 1);
            });

            // Click backdrop to close
            document.getElementById('pv-lightbox').addEventListener('click', function(e) {
                if (e.target === this) pvLbCerrar();
            });

            // CTA button — prefill wizard
            document.getElementById('pv-lb-cta').addEventListener('click', function() {
                if (_pvLbData) {
                    pvSeleccionar(JSON.stringify(_pvLbData));
                    pvLbCerrar();
                }
            });

            // Keyboard
            document.addEventListener('keydown', function(e) {
                var lb = document.getElementById('pv-lightbox');
                if (!lb.classList.contains('active')) return;
                if (e.key === 'Escape') pvLbCerrar();
                if (e.key === 'ArrowLeft') pvLbShowImg(_pvLbIdx - 1);
                if (e.key === 'ArrowRight') pvLbShowImg(_pvLbIdx + 1);
            });

            // Touch swipe
            var carousel = document.getElementById('pv-lb-carousel');
            var touchStartX = 0;
            carousel.addEventListener('touchstart', function(e) {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });
            carousel.addEventListener('touchend', function(e) {
                var diff = touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                    pvLbShowImg(diff > 0 ? _pvLbIdx + 1 : _pvLbIdx - 1);
                }
            }, { passive: true });
        });

        // ── Init ──────────────────────────────────────────────────────

        // Search input with debounce
        document.addEventListener('DOMContentLoaded', function() {
            var searchInput = document.getElementById('pv-search');
            var searchTimer = null;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function() {
                    pvApplyFilters();
                }, 250);
            });
        });

        document.addEventListener('DOMContentLoaded', pvCargar);
    })();

