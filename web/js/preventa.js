(function () {
    var ppStep = 1;
    var PP_TOTAL = 4;
    var PP_LABELS = ['Camiseta', 'Talla', 'Mis Datos', 'Confirmar'];

    function ppRenderProgress() {
        var el = document.getElementById('pp-progress');
        if (!el) return;
        var html = '';
        for (var i = 1; i <= PP_TOTAL; i++) {
            var done = i < ppStep;
            var active = i === ppStep;
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
                '<div style="width:28px;height:28px;border-radius:50%;border:2px solid ' + numBorder + ';background:' + numBg + ';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:' + numColor + ';position:relative;z-index:1;' + glow + '">' + (done ? '&#10003;' : i) + '</div>' +
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
                eq.style.borderColor = '#ff5252';
                eq.focus();
                setTimeout(function () { eq.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1800);
                return false;
            }
        }

        if (ppStep === 2) {
            if (!document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected')) {
                var gbns = document.querySelectorAll('#pp-genero-btns .pp-talla-btn');
                gbns.forEach(function (b) { b.style.borderColor = '#ff5252'; });
                setTimeout(function () { gbns.forEach(function (b) { b.style.borderColor = ''; }); }, 1800);
                return false;
            }
            if (!document.querySelector('#pp-talla-btns .pp-talla-btn.pp-selected')) {
                var tbns = document.querySelectorAll('#pp-talla-btns .pp-talla-btn');
                tbns.forEach(function (b) { b.style.borderColor = '#ff5252'; });
                setTimeout(function () { tbns.forEach(function (b) { b.style.borderColor = ''; }); }, 1800);
                return false;
            }
        }

        if (ppStep === 3) {
            var ids = ['pp-nombre', 'pp-celular', 'pp-ciudad'];
            for (var f = 0; f < ids.length; f++) {
                var el = document.getElementById(ids[f]);
                if (!el.value.trim()) {
                    el.style.borderColor = '#ff5252';
                    el.focus();
                    (function (target) {
                        setTimeout(function () { target.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1800);
                    })(el);
                    return false;
                }
            }
        }

        return true;
    }

    function ppBuildSummary() {
        var equipo = document.getElementById('pp-equipo').value.trim();
        var temporada = document.getElementById('pp-temporada').value.trim();
        var tipoBtn = document.querySelector('#pp-slide-1 .pp-tipo-btn.pp-selected');
        var tipo = tipoBtn ? tipoBtn.dataset.val : 'No especificado';
        var tallaBtn = document.querySelector('#pp-talla-btns .pp-talla-btn.pp-selected');
        var talla = tallaBtn ? tallaBtn.dataset.val : '';
        var isCustom = document.getElementById('pp-custom-si').classList.contains('pp-selected');
        var cNombre = document.getElementById('pp-custom-nombre').value.trim();
        var cNum = document.getElementById('pp-custom-num').value.trim();
        var nombre = document.getElementById('pp-nombre').value.trim();
        var celular = document.getElementById('pp-celular').value.trim();
        var ciudad = document.getElementById('pp-ciudad').value.trim();
        var notas = document.getElementById('pp-notas').value.trim();

        var patchBtns = document.querySelectorAll('#pp-patches .pp-tipo-btn.pp-selected');
        var patches = [];
        patchBtns.forEach(function (b) { patches.push(b.dataset.val); });
        var patchOtro = document.getElementById('pp-patch-otro').value.trim();
        if (patchOtro) patches.push(patchOtro);

        var personaliz = 'Sin nombre/n&uacute;mero';
        if (isCustom) {
            personaliz = 'Con nombre/n&uacute;mero';
            if (cNombre) personaliz += ' - ' + cNombre.toUpperCase();
            if (cNum) personaliz += ' #' + cNum;
        }

        var patchesStr = patches.length ? patches.join(', ') : 'Sin parches';
        var generoBtn = document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected');
        var genero = generoBtn ? generoBtn.dataset.val : 'No especificado';
        var rows = [
            ['Equipo / Selecci&oacute;n', equipo],
            ['Tipo', tipo],
            ['Temporada', temporada || 'La m&aacute;s reciente'],
            ['G&eacute;nero', genero],
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
        box.innerHTML = rows.map(function (r) {
            if (r[0] === 'divider') return '<div style="border-bottom:1px solid rgba(255,255,255,0.07);margin:7px 0;"></div>';
            return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);gap:12px;">' +
                '<span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);min-width:110px;flex-shrink:0;">' + r[0] + '</span>' +
                '<span style="font-size:0.83rem;font-weight:600;color:#fff;text-align:right;">' + r[1] + '</span>' +
                '</div>';
        }).join('');

        var extrasLines = [];
        if (isCustom) extrasLines.push('  • Nombre/número: ' + personaliz.replace('Con nombre/n&uacute;mero - ', '').replace('Con nombre/n&uacute;mero', '').trim());
        if (patches.length) extrasLines.push('  • Parches: ' + patches.join(', '));
        var extrasStr = extrasLines.length
            ? '\n\n📋 *Extras a cotizar (costo adicional):*\n' + extrasLines.join('\n')
            : '\n\n📋 *Extras:* Sin extras adicionales';

        var notasStr = notas ? '\n📝 *Notas:* ' + notas : '';
        var msg = '🏷️ *COTIZACIÓN PRE-VENTA - HERENCIA 90*\n\n' +
            '👕 *Camiseta:* ' + equipo + ' - ' + tipo + ' - ' + (temporada || 'La más reciente') + '\n' +
            (genero ? '🧍 *Género:* ' + genero + '\n' : '') +
            '📐 *Talla:* ' + talla +
            extrasStr + '\n\n' +
            '👤 *Nombre:* ' + nombre + '\n' +
            '📱 *Celular:* ' + celular + '\n' +
            '📍 *Ciudad:* ' + ciudad + notasStr + '\n\n' +
            '━━━━━━━━━━━━━━━\n' +
            '¿Me puedes cotizar el total con todo incluido?\n' +
            '💰 Entiendo que el anticipo es del 20%.\n' +
            '⏱️ Entrega ~15 días hábiles.';

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
        if (ppStep > 1) {
            ppStep--;
            ppShowSlide(ppStep);
        }
    };

    window.ppSelectTipo = function (btn) {
        btn.closest('div').querySelectorAll('.pp-tipo-btn').forEach(function (b) { b.classList.remove('pp-selected'); });
        btn.classList.add('pp-selected');
    };

    window.ppTogglePatch = function (btn) {
        btn.classList.toggle('pp-selected');
    };

    window.ppSelectTalla = function (btn) {
        document.querySelectorAll('#pp-talla-btns .pp-talla-btn').forEach(function (b) { b.classList.remove('pp-selected'); });
        btn.classList.add('pp-selected');
    };

    window.ppSelectGenero = function (btn) {
        document.querySelectorAll('#pp-genero-btns .pp-talla-btn').forEach(function (b) { b.classList.remove('pp-selected'); });
        btn.classList.add('pp-selected');
    };

    window.ppSelectCustom = function (val) {
        ['no', 'si'].forEach(function (v) {
            document.getElementById('pp-custom-' + v).classList.toggle('pp-selected', v === val);
        });
        document.getElementById('pp-custom-fields').style.display = val === 'si' ? 'block' : 'none';
    };

    window.ppBuildSummary = ppBuildSummary;

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

    var _pvAll = [];
    var _pvFiltroType = 'all';
    var _pvFiltroVal = '';
    var _pvCollections = {};
    var _pvVisibleCounts = {};
    var _pvLbData = null;
    var _pvLbIdx = 0;
    var _pvRenderToken = 0;
    var PV_MOBILE_VIEW_KEY = 'pv-mobile-view';

    var PV_ICONIC_TEAMS = [
        'real madrid', 'barcelona', 'manchester united', 'ac milan', 'milan', 'inter', 'chelsea',
        'arsenal', 'liverpool', 'bayern', 'juventus', 'argentina', 'brasil', 'brazil', 'italia',
        'francia', 'alemania', 'portugal', 'holanda', 'espana', 'españa', 'boca', 'river', 'santos'
    ];
    var PV_MEGA_CLUBS = ['real madrid', 'barcelona', 'manchester united', 'ac milan', 'milan', 'inter', 'chelsea', 'arsenal', 'liverpool', 'bayern', 'juventus'];
    var PV_SUDAMERICA_TEAMS = ['boca', 'river', 'santos'];
    var PV_NICHE_HINTS = ['porto', 'roma', 'holanda', 'portugal', 'alemania', 'francia', 'inglaterra'];
    var PV_FEATURED_SPOTLIGHT = ['colombia', 'real madrid', 'barcelona', 'brasil', 'brazil', 'ac milan', 'milan', 'liverpool', 'bayern', 'argentina'];
    var PV_FEATURED_EXCLUDE = ['portugal'];

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function hasAnyKeyword(text, list) {
        for (var i = 0; i < list.length; i++) {
            if (text.indexOf(list[i]) !== -1) return true;
        }
        return false;
    }

    function getPhotoCount(item) {
        return Array.isArray(item.imagenes) ? item.imagenes.length : 0;
    }

    function getDecadeWeight(decada) {
        if (decada === '2000s') return 10;
        if (decada === '90s') return 8;
        if (decada === '2010s') return 7;
        if (decada === '80s') return 5;
        return 3;
    }

    function getItemScore(item) {
        var text = normalizeText([item.equipo, item.temporada, item.descripcion, item.tipo].join(' '));
        var score = 0;

        if (item.destacado) score += 45;
        if (item.categoria === 'clubes') score += 10;
        if (item.categoria === 'selecciones') score += 8;
        if (item.tipo === 'retro') score += 8;
        if (item.tipo === 'manga-larga') score += 6;
        if (hasAnyKeyword(text, PV_ICONIC_TEAMS)) score += 28;
        if (text.indexOf('ronaldo') !== -1 || text.indexOf('messi') !== -1 || text.indexOf('neymar') !== -1 || text.indexOf('zidane') !== -1 || text.indexOf('kaka') !== -1 || text.indexOf('beckham') !== -1 || text.indexOf('maradona') !== -1) score += 18;
        if (text.indexOf('champions') !== -1 || text.indexOf('final') !== -1 || text.indexOf('libertadores') !== -1) score += 10;
        score += getDecadeWeight(item.decada);
        score += Math.min(getPhotoCount(item), 8);

        return score;
    }

    function getFeaturedBoost(item) {
        var text = normalizeText([item.equipo, item.temporada, item.descripcion].join(' '));
        var boost = 0;

        if (hasAnyKeyword(text, PV_FEATURED_EXCLUDE)) return -9999;
        if (getPhotoCount(item) < 6) return -500;

        for (var i = 0; i < PV_FEATURED_SPOTLIGHT.length; i++) {
            if (text.indexOf(PV_FEATURED_SPOTLIGHT[i]) !== -1) {
                boost += 160 - (i * 10);
                break;
            }
        }

        if (text.indexOf('world cup') !== -1 || text.indexOf('copa del mundo') !== -1 || text.indexOf('2002') !== -1 || text.indexOf('1994') !== -1) boost += 18;
        return boost;
    }

    function getFeaturedTeamCap(teamText) {
        if (teamText.indexOf('real madrid') !== -1) return 2;
        if (teamText.indexOf('barcelona') !== -1) return 2;
        if (teamText.indexOf('milan') !== -1) return 2;
        if (teamText.indexOf('colombia') !== -1) return 2;
        if (teamText.indexOf('brasil') !== -1 || teamText.indexOf('brazil') !== -1) return 2;
        if (teamText.indexOf('liverpool') !== -1) return 2;
        if (teamText.indexOf('bayern') !== -1) return 2;
        return 1;
    }

    function compareByScore(a, b) {
        var diff = getItemScore(b) - getItemScore(a);
        if (diff !== 0) return diff;
        return normalizeText(a.equipo).localeCompare(normalizeText(b.equipo));
    }

    function pvGetPrecio(tipo) {
        if (!tipo) return '';
        var t = tipo.toLowerCase();
        if (t === 'retro') return '$120.000';
        if (t === 'player' || t === 'manga-larga') return '$110.000';
        return '$99.000';
    }

    function normalizeKey(value) {
        return normalizeText(value).replace(/[^a-z0-9]/g, '');
    }

    function getSeasonKeys(temporada) {
        var raw = String(temporada || '').trim();
        if (!raw) return [];

        var keys = [normalizeKey(raw)];
        var years = raw.match(/\d{2,4}/g) || [];
        if (years.length >= 2) {
            var first = years[0];
            var second = years[1];
            var shortFirst = first.length === 4 ? first.slice(2) : first;
            var shortSecond = second.length === 4 ? second.slice(2) : second;
            keys.push(normalizeKey(shortFirst + shortSecond));
            keys.push(normalizeKey(shortFirst + '/' + shortSecond));
            keys.push(normalizeKey(first + '/' + second));
            keys.push(normalizeKey(first + '-' + second));
        }

        return keys.filter(Boolean);
    }

    function titleAlreadyHasSeason(title, temporada) {
        var titleKey = normalizeKey(title);
        var seasonKeys = getSeasonKeys(temporada);
        for (var i = 0; i < seasonKeys.length; i++) {
            if (seasonKeys[i] && titleKey.indexOf(seasonKeys[i]) !== -1) return true;
        }
        return false;
    }

    function getPreventaVariant(item) {
        var titleText = normalizeText(item.equipo || '');
        var sourceText = normalizeText([item.slug, item.equipo, item.tipo, item.descripcion].join(' '));
        var parts = [];

        if (sourceText.indexOf('local') !== -1 && titleText.indexOf('local') === -1) parts.push('Local');
        if (sourceText.indexOf('visitante') !== -1 && titleText.indexOf('visitante') === -1) parts.push('Visitante');
        if (sourceText.indexOf('tercera') !== -1 && titleText.indexOf('tercera') === -1) parts.push('Tercera');
        if ((sourceText.indexOf('manga larga') !== -1 || sourceText.indexOf('manga-larga') !== -1) && titleText.indexOf('manga larga') === -1) parts.push('Manga Larga');
        if (sourceText.indexOf('player') !== -1 && titleText.indexOf('player') === -1) parts.push('Player');

        return parts.join(' ');
    }

    function getPreventaDisplayTitle(item) {
        var title = String(item.equipo || '').trim();
        var temporada = String(item.temporada || '').trim();
        var variant = getPreventaVariant(item);
        var tipo = String(item.tipo || '').replace(/-/g, ' ').trim();
        var titleNorm = normalizeText(title);

        if (temporada && !titleAlreadyHasSeason(title, temporada)) title += ' ' + temporada;
        if (variant && normalizeText(title).indexOf(normalizeText(variant)) === -1) title += ' ' + variant;
        if (tipo && tipo !== 'fan' && titleNorm.indexOf(normalizeText(tipo)) === -1 && normalizeText(title).indexOf(normalizeText(tipo)) === -1) title += ' ' + tipo;

        return title.replace(/\s+/g, ' ').trim();
    }

    function renderCard(item, idx, collectionKey) {
        var imgs = item.imagenes || [];
        var img1 = imgs[0] ? imgs[0].url : '';
        var img2 = imgs[1] ? imgs[1].url : img1;
        var tipoLabel = (item.tipo || '').replace(/-/g, ' ');
        var nFotos = imgs.length;
        var precio = pvGetPrecio(item.tipo);
        var detailUrl = '/preventa/' + encodeURIComponent(item.slug || item.equipo || '');
        var displayTitle = getPreventaDisplayTitle(item);

        return '<a class="pv-card-item" href="' + detailUrl + '" onclick="event.preventDefault(); pvAbrirLightbox(\'' + collectionKey + '\',' + idx + ')">' +
            '<div class="pv-card-img-wrap">' +
                (img1 ? '<img class="pv-img-main" src="' + img1 + '" alt="' + escHtml(displayTitle) + '" loading="lazy" decoding="async">' : '') +
                (img2 ? '<img class="pv-img-hover" src="' + img2 + '" alt="' + escHtml(displayTitle) + ' - foto 2" loading="lazy" decoding="async">' : '') +
                (item.destacado ? '<span class="pv-dest-badge">&#9733; Top</span>' : '') +
                '<span class="pv-leadtime-badge"><i class="ph-bold ph-clock"></i> 15 d&iacute;as</span>' +
                (nFotos > 1 ? '<span class="pv-photo-count"><i class="ph-bold ph-images"></i> ' + nFotos + '</span>' : '') +
            '</div>' +
            '<div class="pv-card-info">' +
                '<div class="pv-card-equipo">' + escHtml(displayTitle) + '</div>' +
                '<div class="pv-card-precio">' + precio + '</div>' +
                '<div class="pv-card-meta">' + escHtml(item.temporada) + ' &middot; ' + escHtml(tipoLabel) + '</div>' +
                '<div class="pv-card-cta"><i class="ph-bold ph-eye"></i> Ver fotos</div>' +
            '</div>' +
        '</a>';
    }

    function buildSections(items) {
        var sorted = items.slice().sort(compareByScore);
        var featured = [];
        var featuredIds = {};
        var featuredCounts = {};
        var featuredCandidates = sorted.slice().sort(function (a, b) {
            return (getItemScore(b) + getFeaturedBoost(b)) - (getItemScore(a) + getFeaturedBoost(a));
        });

        featuredCandidates.forEach(function (item) {
            if (featured.length >= 12) return;
            var teamText = normalizeText(item.equipo);
            var teamCap = getFeaturedTeamCap(teamText);
            if ((featuredCounts[teamText] || 0) >= teamCap) return;
            if (getFeaturedBoost(item) < 0 && !item.destacado) return;
            featured.push(item);
            featuredIds[item.slug] = true;
            featuredCounts[teamText] = (featuredCounts[teamText] || 0) + 1;
        });

        sorted.forEach(function (item) {
            if (featured.length >= 12 || featuredIds[item.slug]) return;
            if (getPhotoCount(item) < 5) return;
            if (hasAnyKeyword(normalizeText(item.equipo), PV_FEATURED_EXCLUDE)) return;
            featured.push(item);
            featuredIds[item.slug] = true;
        });

        var rest = sorted.filter(function (item) {
            return !featuredIds[item.slug];
        });

        var clubsTop = [];
        var seleccionesTop = [];
        var sudamerica = [];
        var joyas = [];
        var explorar = [];

        rest.forEach(function (item) {
            var teamText = normalizeText(item.equipo);
            var combined = teamText + ' ' + normalizeText(item.temporada) + ' ' + normalizeText(item.descripcion);

            if (item.categoria === 'clubes' && hasAnyKeyword(teamText, PV_MEGA_CLUBS)) {
                clubsTop.push(item);
                return;
            }

            if (item.categoria === 'selecciones') {
                seleccionesTop.push(item);
                return;
            }

            if (hasAnyKeyword(teamText, PV_SUDAMERICA_TEAMS)) {
                sudamerica.push(item);
                return;
            }

            if (item.decada === '80s' || item.decada === '90s' || item.tipo === 'manga-larga' || hasAnyKeyword(combined, PV_NICHE_HINTS)) {
                joyas.push(item);
                return;
            }

            explorar.push(item);
        });

        return [
            {
                key: 'featured',
                title: 'Iconos Que Entran Solos',
                kicker: 'Golpe Inicial',
                subtitle: 'Las que más rápido provocan clic y dejan clara la fuerza del catálogo.',
                meta: featured.length + ' referencias top',
                items: featured,
                initialCount: 12,
                featured: true
            },
            {
                key: 'clubs-top',
                title: 'Clubes Top',
                kicker: 'Ventas Seguras',
                subtitle: 'Gigantes europeos con camisetas que la gente reconoce de inmediato.',
                meta: clubsTop.length + ' para explorar',
                items: clubsTop,
                initialCount: 6
            },
            {
                key: 'selecciones-top',
                title: 'Selecciones Legendarias',
                kicker: 'Mundiales y Eurocopas',
                subtitle: 'Referencias con memoria colectiva fuerte y salida muy natural.',
                meta: seleccionesTop.length + ' disponibles',
                items: seleccionesTop,
                initialCount: 6
            },
            {
                key: 'sudamerica',
                title: 'Sudamerica Imprescindible',
                kicker: 'Pocas y Bien Elegidas',
                subtitle: 'Boca, River y Santos con referencias que sí vale la pena tener visibles.',
                meta: sudamerica.length + ' referencias',
                items: sudamerica,
                initialCount: 4
            },
            {
                key: 'joyas',
                title: 'Joyas Retro',
                kicker: 'Para Seguir Mirando',
                subtitle: 'Diseños con más personalidad que enriquecen la exploración sin perder deseo.',
                meta: joyas.length + ' para descubrir',
                items: joyas,
                initialCount: 6
            },
            {
                key: 'explorar',
                title: 'Mas Para Explorar',
                kicker: 'Catálogo Amplio',
                subtitle: 'El resto del catálogo organizado para que navegar siga siendo fácil.',
                meta: explorar.length + ' referencias',
                items: explorar,
                initialCount: 8
            }
        ].filter(function (section) { return section.items.length; });
    }

    function renderSection(section) {
        var visibleCount = _pvVisibleCounts[section.key] || section.initialCount;
        var visibleItems = section.items.slice(0, visibleCount);
        _pvCollections[section.key] = visibleItems;

        return '<section class="pv-section' + (section.featured ? ' pv-section-featured' : '') + '">' +
            '<div class="pv-section-head">' +
                '<div>' +
                    '<div class="pv-section-kicker"><i class="ph-bold ph-lightning"></i> ' + escHtml(section.kicker) + '</div>' +
                    '<h3 class="pv-section-title">' + escHtml(section.title) + '</h3>' +
                    '<p class="pv-section-sub">' + escHtml(section.subtitle) + '</p>' +
                '</div>' +
                '<div class="pv-section-meta">' + escHtml(section.meta) + '</div>' +
            '</div>' +
            '<div class="pv-section-grid' + (section.featured ? ' pv-section-grid-featured' : '') + '">' +
                visibleItems.map(function (item, idx) { return renderCard(item, idx, section.key); }).join('') +
            '</div>' +
            (visibleCount < section.items.length
                ? '<div class="pv-section-actions"><button class="pv-more-btn" onclick="pvMostrarMas(\'' + section.key + '\')"><i class="ph-bold ph-plus"></i> Ver más</button></div>'
                : '') +
        '</section>';
    }

    function renderSearchResults(items, searchTerm) {
        _pvCollections.search = items;
        return '<section class="pv-section pv-section-featured">' +
            '<div class="pv-section-head">' +
                '<div>' +
                    '<div class="pv-section-kicker"><i class="ph-bold ph-magnifying-glass"></i> Resultado actual</div>' +
                    '<h3 class="pv-section-title">' + (searchTerm ? 'Resultados para "' + escHtml(searchTerm) + '"' : 'Referencias filtradas') + '</h3>' +
                    '<p class="pv-section-sub">Cuando busques o filtres, mostramos la lista directa sin esconder referencias útiles.</p>' +
                '</div>' +
                '<div class="pv-section-meta">' + items.length + ' referencias</div>' +
            '</div>' +
            '<div class="pv-grid">' +
                items.map(function (item, idx) { return renderCard(item, idx, 'search'); }).join('') +
            '</div>' +
        '</section>';
    }

    function renderDefaultCatalog(items) {
        var stage = document.getElementById('pv-grid-stage');
        var intro = document.getElementById('pv-intro-copy');
        var sections = buildSections(items);
        var renderToken = ++_pvRenderToken;

        _pvCollections = {};
        _pvVisibleCounts = {};
        sections.forEach(function (section) {
            _pvVisibleCounts[section.key] = section.initialCount;
        });

        if (intro) intro.style.display = '';
        stage.innerHTML = renderSection(sections[0]);

        var remainingSections = sections.slice(1);
        if (!remainingSections.length) return;

        var laterRender = function () {
            if (renderToken !== _pvRenderToken) return;
            stage.insertAdjacentHTML('beforeend', remainingSections.map(renderSection).join(''));
        };

        if ('requestIdleCallback' in window) window.requestIdleCallback(laterRender, { timeout: 500 });
        else setTimeout(laterRender, 60);
    }

    function renderCurrentView(items, searchTerm, isFiltered) {
        var stage = document.getElementById('pv-grid-stage');
        var empty = document.getElementById('pv-empty');
        var intro = document.getElementById('pv-intro-copy');

        if (!items.length) {
            stage.innerHTML = '';
            if (intro) intro.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        if (isFiltered) {
            _pvRenderToken++;
            if (intro) intro.style.display = 'none';
            stage.innerHTML = renderSearchResults(items, searchTerm);
            return;
        }

        renderDefaultCatalog(items);
    }

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
                galSection.style.display = 'none';
                return;
            }

            galSection.style.display = '';
            pvApplyFilters();
        } catch (e) {
            galSection.style.display = 'none';
            console.warn('[pv-galeria] Error cargando catálogo:', e.message);
        }
    }

    function getFilteredItems(searchTerm) {
        return _pvAll.filter(function (r) {
            var passFilter = true;
            if (_pvFiltroType !== 'all') {
                if (_pvFiltroType === 'destacado') passFilter = !!r.destacado;
                else if (_pvFiltroType === 'keyword') {
                    var keywordNeedle = normalizeText(_pvFiltroVal);
                    var keywordHaystack = normalizeText([
                        r.equipo, r.temporada, r.tipo, r.categoria,
                        r.pais_o_club, r.descripcion, (r.tags || []).join(' ')
                    ].join(' '));
                    passFilter = keywordHaystack.indexOf(keywordNeedle) !== -1;
                }
                else passFilter = r[_pvFiltroType] === _pvFiltroVal;
            }
            if (!passFilter) return false;

            if (searchTerm) {
                var haystack = [
                    r.equipo, r.temporada, r.tipo, r.categoria,
                    r.pais_o_club, r.descripcion, (r.tags || []).join(' ')
                ].join(' ').toLowerCase();
                return haystack.indexOf(searchTerm) !== -1;
            }

            return true;
        });
    }

    function pvApplyFilters() {
        var searchTerm = (document.getElementById('pv-search').value || '').trim().toLowerCase();
        var filtered = getFilteredItems(searchTerm);
        renderCurrentView(filtered, searchTerm, !!searchTerm || _pvFiltroType !== 'all');
    }

    window.pvFiltrar = function (btn, type, val) {
        document.querySelectorAll('.pv-filtro-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _pvFiltroType = type;
        _pvFiltroVal = val;
        pvApplyFilters();
    };

    window.pvReset = function () {
        document.getElementById('pv-search').value = '';
        var btn = document.querySelector('.pv-filtro-btn[data-filtro-type="all"]');
        if (btn) window.pvFiltrar(btn, 'all', '');
    };

    window.pvMostrarMas = function (sectionKey) {
        var searchTerm = (document.getElementById('pv-search').value || '').trim().toLowerCase();
        if (searchTerm || _pvFiltroType !== 'all') return;

        _pvVisibleCounts[sectionKey] = (_pvVisibleCounts[sectionKey] || 0) + 6;
        var sections = buildSections(_pvAll);
        var stage = document.getElementById('pv-grid-stage');
        stage.innerHTML = sections.map(renderSection).join('');

        var target = document.querySelector('[onclick="pvMostrarMas(\'' + sectionKey + '\')"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.pvSeleccionar = function (rJson) {
        var r;
        try { r = JSON.parse(rJson); } catch (e) { return; }

        var equipoEl = document.getElementById('pp-equipo');
        if (equipoEl) equipoEl.value = r.equipo || '';

        var tempEl = document.getElementById('pp-temporada');
        if (tempEl) tempEl.value = r.temporada || '';

        if (r.tipo) {
            document.querySelectorAll('#pp-slide-1 .pp-tipo-btn').forEach(function (btn) {
                var match = btn.dataset.val && r.tipo.toLowerCase().indexOf(btn.dataset.val.toLowerCase()) !== -1;
                btn.classList.toggle('pp-selected', match);
            });
        }

        var refEl = document.getElementById('pp-ref-interna');
        if (refEl) refEl.value = r.slug || '';

        var anchor = document.getElementById('pv-wizard-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    document.addEventListener('DOMContentLoaded', function () {
        var originalBuildSummary = window.ppBuildSummary;
        if (typeof originalBuildSummary === 'function') {
            window.ppBuildSummary = function () {
                originalBuildSummary();
                var btn = document.getElementById('pp-wa-btn');
                var refEl = document.getElementById('pp-ref-interna');
                if (!btn || !refEl || !refEl.value) return;

                var href = btn.href;
                try {
                    var parts = href.split('?text=');
                    if (parts.length < 2) return;
                    var decoded = decodeURIComponent(parts[1]);
                    var ref = '\n\n🔖 Ref. interna: REF-' + refEl.value;
                    if (decoded.indexOf('Ref. interna') === -1) {
                        btn.href = parts[0] + '?text=' + encodeURIComponent(decoded + ref);
                    }
                } catch (e) {}
            };
        }
    });

    window.pvAbrirLightbox = function (collectionKey, itemIdx) {
        var collection = _pvCollections[collectionKey] || [];
        var r = collection[itemIdx];
        if (!r) return;

        _pvLbData = r;
        _pvLbIdx = 0;

        var imgs = r.imagenes || [];
        if (!imgs.length) {
            pvSeleccionar(JSON.stringify(r));
            return;
        }

        document.getElementById('pv-lb-equipo').textContent = getPreventaDisplayTitle(r);
        document.getElementById('pv-lb-meta').textContent = (r.temporada || '') + ' · ' + (r.tipo || '').replace(/-/g, ' ');
        document.getElementById('pv-lb-precio').textContent = pvGetPrecio(r.tipo);

        var thumbsEl = document.getElementById('pv-lb-thumbs');
        if (imgs.length > 1) {
            thumbsEl.innerHTML = imgs.map(function (img, i) {
                return '<img class="pv-lb-thumb' + (i === 0 ? ' active' : '') + '" src="' + img.url + '" alt="Foto ' + (i + 1) + '" onclick="pvLbGoTo(' + i + ')">';
            }).join('');
            thumbsEl.style.display = 'flex';
        } else {
            thumbsEl.innerHTML = '';
            thumbsEl.style.display = 'none';
        }

        document.getElementById('pv-lb-prev').style.display = imgs.length > 1 ? 'flex' : 'none';
        document.getElementById('pv-lb-next').style.display = imgs.length > 1 ? 'flex' : 'none';

        pvLbShowImg(0);

        var lb = document.getElementById('pv-lightbox');
        lb.classList.add('entering');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
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
        setTimeout(function () {
            imgEl.src = imgs[_pvLbIdx].url;
            imgEl.alt = getPreventaDisplayTitle(_pvLbData) + ' - foto ' + (_pvLbIdx + 1);
            imgEl.classList.remove('switching');
        }, 150);

        document.getElementById('pv-lb-counter').textContent = (_pvLbIdx + 1) + ' / ' + imgs.length;

        var thumbs = document.querySelectorAll('.pv-lb-thumb');
        thumbs.forEach(function (t, i) {
            t.classList.toggle('active', i === _pvLbIdx);
        });

        if (thumbs[_pvLbIdx]) {
            thumbs[_pvLbIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    window.pvLbGoTo = function (idx) { pvLbShowImg(idx); };

    function pvLbCerrar() {
        var lb = document.getElementById('pv-lightbox');
        lb.classList.remove('active');
        lb.classList.remove('entering');
        document.body.style.overflow = '';
        _pvLbData = null;
    }

    function pvOpenDrawer() {
        var drawer = document.getElementById('categoryDrawer');
        var overlay = document.getElementById('drawerOverlay');
        if (!drawer || !overlay) return;
        drawer.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function pvCloseDrawer() {
        var drawer = document.getElementById('categoryDrawer');
        var overlay = document.getElementById('drawerOverlay');
        if (!drawer || !overlay) return;
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function pvOpenSearchOverlay() {
        var overlay = document.getElementById('searchOverlay');
        var mobileInput = document.getElementById('mobileSearchInput');
        var mainInput = document.getElementById('pv-search');
        if (!overlay || !mobileInput) return;
        mobileInput.value = mainInput ? mainInput.value : '';
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(function () {
            mobileInput.focus();
            mobileInput.select();
        }, 220);
    }

    function pvCloseSearchOverlay() {
        var overlay = document.getElementById('searchOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function pvSyncSearchFromMobile(value) {
        var mainInput = document.getElementById('pv-search');
        if (!mainInput) return;
        mainInput.value = value;
        pvApplyFilters();
    }

    function pvUpdateViewButton() {
        var body = document.body;
        var btn = document.getElementById('gridToggleBtn');
        var compactIcon = document.getElementById('gridToggleIconCompact');
        var singleIcon = document.getElementById('gridToggleIconSingle');
        var label = document.getElementById('gridToggleLabel');
        if (!btn || !compactIcon || !singleIcon || !label) return;

        var isSingle = body.classList.contains('pv-mobile-single');
        compactIcon.style.display = isSingle ? 'none' : 'block';
        singleIcon.style.display = isSingle ? 'block' : 'none';
        label.textContent = 'Vista';
        btn.classList.toggle('is-active', isSingle);
        btn.setAttribute('aria-label', isSingle ? 'Cambiar a vista de dos columnas' : 'Cambiar a vista de una columna');
    }

    function pvApplyMobileView(savedView) {
        var compact = savedView !== 'single';
        document.body.classList.toggle('pv-mobile-single', !compact);
        pvUpdateViewButton();
    }

    function pvToggleMobileView() {
        var isSingle = document.body.classList.contains('pv-mobile-single');
        var nextView = isSingle ? 'compact' : 'single';
        try {
            window.localStorage.setItem(PV_MOBILE_VIEW_KEY, nextView);
        } catch (e) {}
        pvApplyMobileView(nextView);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var searchInput = document.getElementById('pv-search');
        var searchTimer = null;
        var mobileSearchInput = document.getElementById('mobileSearchInput');
        var mobileSearchBtn = document.getElementById('mobileSearchBtn');
        var mobileMenuBtn = document.getElementById('mobileMenuBtn');
        var mobileViewBtn = document.getElementById('gridToggleBtn');
        var mobilePreventaBtn = document.getElementById('mobilePreventaBtn');
        var mobileQuoteBtn = document.getElementById('mobileQuoteBtn');
        var drawerOverlay = document.getElementById('drawerOverlay');
        var drawerClose = document.getElementById('categoryDrawerClose');
        var searchClose = document.getElementById('searchOverlayClose');

        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                pvApplyFilters();
            }, 220);
        });

        try {
            pvApplyMobileView(window.localStorage.getItem(PV_MOBILE_VIEW_KEY) || 'compact');
        } catch (e) {
            pvApplyMobileView('compact');
        }

        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('input', function () {
                pvSyncSearchFromMobile(this.value);
            });
        }

        if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', pvOpenSearchOverlay);
        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', pvOpenDrawer);
        if (mobileViewBtn) mobileViewBtn.addEventListener('click', pvToggleMobileView);
        if (mobilePreventaBtn) {
            mobilePreventaBtn.addEventListener('click', function () {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        if (mobileQuoteBtn) {
            mobileQuoteBtn.addEventListener('click', function () {
                var wizard = document.getElementById('pv-wizard-anchor');
                if (wizard) wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        if (drawerOverlay) drawerOverlay.addEventListener('click', pvCloseDrawer);
        if (drawerClose) drawerClose.addEventListener('click', pvCloseDrawer);
        if (searchClose) searchClose.addEventListener('click', pvCloseSearchOverlay);

        document.querySelectorAll('#mobileCatNav .category-drawer-link').forEach(function (link) {
            link.addEventListener('click', function () {
                pvCloseDrawer();
            });
        });

        document.getElementById('pv-lb-close').addEventListener('click', pvLbCerrar);
        document.getElementById('pv-lb-prev').addEventListener('click', function () { pvLbShowImg(_pvLbIdx - 1); });
        document.getElementById('pv-lb-next').addEventListener('click', function () { pvLbShowImg(_pvLbIdx + 1); });
        document.getElementById('pv-lightbox').addEventListener('click', function (e) {
            if (e.target === this) pvLbCerrar();
        });
        document.getElementById('pv-lb-cta').addEventListener('click', function () {
            if (_pvLbData) {
                pvSeleccionar(JSON.stringify(_pvLbData));
                pvLbCerrar();
            }
        });

        document.addEventListener('keydown', function (e) {
            var lb = document.getElementById('pv-lightbox');
            if (e.key === 'Escape') {
                pvLbCerrar();
                pvCloseDrawer();
                pvCloseSearchOverlay();
                return;
            }
            if (!lb.classList.contains('active')) return;
            if (e.key === 'ArrowLeft') pvLbShowImg(_pvLbIdx - 1);
            if (e.key === 'ArrowRight') pvLbShowImg(_pvLbIdx + 1);
        });

        var carousel = document.getElementById('pv-lb-carousel');
        var touchStartX = 0;
        carousel.addEventListener('touchstart', function (e) {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        carousel.addEventListener('touchend', function (e) {
            var diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                pvLbShowImg(diff > 0 ? _pvLbIdx + 1 : _pvLbIdx - 1);
            }
        }, { passive: true });

        pvCargar();
    });
})();
