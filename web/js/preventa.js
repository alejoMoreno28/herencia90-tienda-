(function () {
    var ppStep = 1;
    var PP_TOTAL = 4;
    var PP_LABELS = ['Camiseta', 'Talla', 'Mis Datos', 'Confirmar'];

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ppRenderProgress() {
        var el = document.getElementById('pp-progress');
        if (!el) return;
        var html = '';
        for (var i = 1; i <= PP_TOTAL; i++) {
            var done = i < ppStep;
            var active = i === ppStep;
            var connColor = i < ppStep ? 'var(--gold-dark)' : 'rgba(0,0,0,0.08)';
            var numBg = done ? 'var(--gold-dark)' : active ? 'var(--gold)' : 'rgba(0,0,0,0.03)';
            var numBorder = done ? 'var(--gold-dark)' : active ? 'var(--gold)' : 'rgba(0,0,0,0.12)';
            var numColor = done ? '#fff' : active ? '#ffffff' : 'var(--text-secondary)';
            var labelColor = active ? 'var(--gold)' : 'var(--text-secondary)';
            var labelWeight = active ? '700' : '500';
            var glow = active ? 'box-shadow:0 0 0 4px rgba(179,151,93,0.12);' : '';
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

    function ppScrollToWizard(behavior) {
        var wizard = document.getElementById('pv-wizard-anchor');
        if (!wizard) return;
        var topbar = document.querySelector('.pv-topbar');
        var offset = (topbar ? topbar.getBoundingClientRect().height : 0) + 14;
        var top = wizard.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: behavior || 'smooth' });
    }

    function ppClearFieldError(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('pv-input-invalid');
        el.removeAttribute('aria-invalid');
        var errorId = el.getAttribute('aria-describedby');
        var error = errorId ? document.getElementById(errorId) : null;
        if (error) error.textContent = '';
    }

    function ppSetFieldError(el, message) {
        el.classList.add('pv-input-invalid');
        el.setAttribute('aria-invalid', 'true');
        var errorId = el.getAttribute('aria-describedby');
        var error = errorId ? document.getElementById(errorId) : null;
        if (error) error.textContent = message;
        ppScrollToWizard('smooth');
        el.focus({ preventScroll: true });
        return false;
    }

    function ppClearGroupError(groupId, errorId) {
        var group = document.getElementById(groupId);
        var error = document.getElementById(errorId);
        if (!group) return;
        group.classList.remove('pv-choice-invalid');
        group.querySelectorAll('button').forEach(function (b) { b.removeAttribute('aria-invalid'); });
        if (error) error.textContent = '';
    }

    function ppSetGroupError(groupId, errorId, message) {
        var group = document.getElementById(groupId);
        var error = document.getElementById(errorId);
        if (!group) return false;
        group.classList.add('pv-choice-invalid');
        group.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-invalid', 'true'); });
        if (error) error.textContent = message;
        ppScrollToWizard('smooth');
        var first = group.querySelector('button');
        if (first) first.focus({ preventScroll: true });
        return false;
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
                return ppSetFieldError(eq, 'Escribe el equipo o seleccion que quieres cotizar.');
            }
        }

        if (ppStep === 2) {
            if (!document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected')) {
                return ppSetGroupError('pp-genero-btns', 'pp-genero-error', 'Elige si la camiseta es de hombre, mujer o ni\u00f1o.');
            }
            if (!document.querySelector('#pp-talla-btns .pp-talla-btn.pp-selected')) {
                return ppSetGroupError('pp-talla-btns', 'pp-talla-error', 'Selecciona una talla para poder cotizarla.');
            }
        }

        if (ppStep === 3) {
            var ids = ['pp-nombre', 'pp-celular', 'pp-ciudad'];
            for (var f = 0; f < ids.length; f++) {
                var el = document.getElementById(ids[f]);
                if (!el.value.trim()) {
                    var msg = ids[f] === 'pp-nombre' ? 'Escribe tu nombre completo.' : ids[f] === 'pp-celular' ? 'Escribe tu celular para contactarte.' : 'Escribe tu ciudad para calcular envio.';
                    return ppSetFieldError(el, msg);
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
        var refInterna = document.getElementById('pp-ref-interna').value.trim();

        var patchBtns = document.querySelectorAll('#pp-patches .pp-tipo-btn.pp-selected');
        var patches = [];
        patchBtns.forEach(function (b) { patches.push(b.dataset.val); });
        var patchOtro = document.getElementById('pp-patch-otro').value.trim();
        if (patchOtro) patches.push(patchOtro);

        var personaliz = 'Sin nombre/n\u00famero';
        if (isCustom) {
            personaliz = 'Con nombre/n\u00famero';
            if (cNombre) personaliz += ' - ' + cNombre.toUpperCase();
            if (cNum) personaliz += ' #' + cNum;
        }

        var patchesStr = patches.length ? patches.join(', ') : 'Sin parches';
        var generoBtn = document.querySelector('#pp-genero-btns .pp-talla-btn.pp-selected');
        var genero = generoBtn ? generoBtn.dataset.val : 'No especificado';
        var rows = [
            ['Equipo / Selecci\u00f3n', equipo],
            ['Tipo', tipo],
            ['Temporada', temporada || 'La m\u00e1s reciente'],
            ['G\u00e9nero', genero],
            ['Talla', talla],
            ['divider', ''],
            ['Nombre/n\u00famero', personaliz],
            ['Parches', patchesStr],
            ['divider', ''],
            ['Tu nombre', nombre],
            ['Celular', celular],
            ['Ciudad', ciudad]
        ];
        if (refInterna) rows.push(['Ref. interna', 'REF-' + refInterna]);
        if (notas) rows.push(['Notas', notas]);

        var box = document.getElementById('pp-summary-box');
        box.innerHTML = rows.map(function (r) {
            if (r[0] === 'divider') return '<div style="border-bottom:1px solid rgba(0,0,0,0.08);margin:7px 0;"></div>';
            return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.04);gap:12px;">' +
                '<span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);min-width:110px;flex-shrink:0;">' + escHtml(r[0]) + '</span>' +
                '<span style="font-size:0.83rem;font-weight:600;color:#121214;text-align:right;">' + escHtml(r[1]) + '</span>' +
                '</div>';
        }).join('');

        var extrasLines = [];
        if (isCustom) extrasLines.push('  - Nombre/n\u00famero: ' + personaliz.replace('Con nombre/n\u00famero - ', '').replace('Con nombre/n\u00famero', '').trim());
        if (patches.length) extrasLines.push('  - Parches: ' + patches.join(', '));
        var extrasStr = extrasLines.length
            ? '\n\n*Extras a cotizar (costo adicional):*\n' + extrasLines.join('\n')
            : '\n\n*Extras:* Sin extras adicionales';

        var notasStr = notas ? '\n*Notas:* ' + notas : '';
        var refStr = refInterna ? '\n*Ref. interna:* REF-' + refInterna : '';
        var msg = '*COTIZACI\u00d3N BAJO PEDIDO - HERENCIA 90*\n\n' +
            '*Camiseta:* ' + equipo + ' - ' + tipo + ' - ' + (temporada || 'La m\u00e1s reciente') + '\n' +
            (genero ? '*G\u00e9nero:* ' + genero + '\n' : '') +
            '*Talla:* ' + talla +
            extrasStr + '\n\n' +
            '*Nombre:* ' + nombre + '\n' +
            '*Celular:* ' + celular + '\n' +
            '*Ciudad:* ' + ciudad + notasStr + refStr + '\n\n' +
            'Me puedes cotizar el total con todo incluido?\n' +
            'Entiendo que el anticipo es del 20%.\n' +
            'Entrega aproximada: 15 d\u00edas h\u00e1biles.';

        document.getElementById('pp-wa-btn').href = 'https://wa.me/573126428153?text=' + encodeURIComponent(msg);
    }

    window.ppNext = function () {
        if (!ppValidate()) return;
        if (ppStep === PP_TOTAL - 1) ppBuildSummary();
        ppStep = Math.min(ppStep + 1, PP_TOTAL);
        ppShowSlide(ppStep);
        ppScrollToWizard('smooth');
    };

    window.ppBack = function () {
        if (ppStep > 1) {
            ppStep--;
            ppShowSlide(ppStep);
            ppScrollToWizard('smooth');
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
        ppClearGroupError('pp-talla-btns', 'pp-talla-error');
    };

    window.ppSelectGenero = function (btn) {
        document.querySelectorAll('#pp-genero-btns .pp-talla-btn').forEach(function (b) { b.classList.remove('pp-selected'); });
        btn.classList.add('pp-selected');
        ppClearGroupError('pp-genero-btns', 'pp-genero-error');
    };

    window.ppSelectCustom = function (val) {
        ['no', 'si'].forEach(function (v) {
            document.getElementById('pp-custom-' + v).classList.toggle('pp-selected', v === val);
        });
        document.getElementById('pp-custom-fields').style.display = val === 'si' ? 'block' : 'none';
    };

    window.ppBuildSummary = ppBuildSummary;
    window.ppScrollToWizard = ppScrollToWizard;

    document.addEventListener('DOMContentLoaded', function () {
        ppRenderProgress();
        ppShowSlide(1);
        ppSelectCustom('no');
        ['pp-equipo', 'pp-nombre', 'pp-celular', 'pp-ciudad'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function () { ppClearFieldError(id); });
        });
    });
})();

(function () {
    var SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
    var SUPABASE_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    var PV_LIST_URL = '/preventa-catalogo-list.json';
    var PV_FULL_CATALOG_URL = '/preventa-catalogo.json';
    var db = null;

    var _pvAll = [];
    var _pvFiltroType = 'all';
    var _pvFiltroVal = '';
    var _pvCollections = {};
    var _pvVisibleCounts = {};
    var _pvSort = 'popular';
    var _pvPage = 1;
    var PV_PAGE_SIZE = 24;
    var _pvLbData = null;
    var _pvLbIdx = 0;
    var _pvLbImgs = [];
    var _pvRenderToken = 0;
    var _pvImgObserver = null;
    var _pvFullCatalogPromise = null;
    var _pvFullBySlug = {};
    var PV_MOBILE_VIEW_KEY = 'pv-mobile-view';
    var PV_CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function pvScrollToWizard(behavior) {
        var wizard = document.getElementById('pv-wizard-anchor');
        if (!wizard) return;
        var topbar = document.querySelector('.pv-topbar');
        var offset = (topbar ? topbar.getBoundingClientRect().height : 0) + 14;
        var top = wizard.getBoundingClientRect().top + window.pageYOffset - offset;
        if (behavior === 'instant') {
            window.scrollTo(0, Math.max(0, top));
        } else {
            window.scrollTo({ top: Math.max(0, top), behavior: behavior || 'smooth' });
        }
    }

    function pvSettleOnWizard() {
        [0, 250, 700, 1400, 2300].forEach(function (delay) {
            setTimeout(function () { pvScrollToWizard(delay ? 'instant' : 'smooth'); }, delay);
        });
    }

    var PV_ICONIC_TEAMS = [
        'real madrid', 'barcelona', 'manchester united', 'ac milan', 'milan', 'inter', 'chelsea',
        'arsenal', 'liverpool', 'bayern', 'juventus', 'argentina', 'brasil', 'brazil', 'italia',
        'francia', 'alemania', 'portugal', 'holanda', 'espana', 'españa', 'boca', 'river', 'santos'
    ];
    var PV_MEGA_CLUBS = ['real madrid', 'barcelona', 'manchester united', 'ac milan', 'milan', 'inter', 'chelsea', 'arsenal', 'liverpool', 'bayern', 'juventus'];
    var PV_SUDAMERICA_TEAMS = ['boca', 'river', 'santos'];
    var PV_NICHE_HINTS = ['porto', 'roma', 'holanda', 'portugal', 'alemania', 'francia', 'inglaterra'];
    var PV_FEATURED_SPOTLIGHT = ['barcelona', 'ac milan', 'milan', 'argentina', 'arsenal', 'manchester united', 'liverpool', 'brasil', 'brazil', 'colombia', 'river', 'boca', 'real madrid'];
    var PV_FEATURED_EXCLUDE = ['portugal'];
    var PV_VISUAL_PRIORITY = {
        'barcelona-2008-2009-local': 1400,
        'ac-milan-2006-2007-local': 1390,
        'brasil-2002-local': 1380,
        'real-madrid-2006-2007-local': 1370,
        'real-madrid-1998-2000-local': 1360,
        'barcelona-1999-2000-local-centenario': 1350,
        'real-madrid-2002-2003-local': 1340,
        'liverpool-2004-2005-local': 1330,
        'inter-1997-1998-local-ronaldo': 1320,
        'river-plate-2018-local-campeon-copa-libertadores-madrid': 1310,
        'ac-milan-2006-2007-visitante': 1300,
        'milan-2006-local-manga-larga-negra-y-roja': 1290,
        'manchester-united-2007-2008-local-manga-larga': 1280,
        'manchester-united-2007-2008-local': 1270,
        'barcelona-2008-2009-local-manga-larga': 1260,
        'argentina-1986-local': 1250,
        'argentina-1994-visitante': 1240,
        'colombia-1990-local': 1230,
        'boca-juniors-1997-1998-retro-azul': 1220,
        'juventus-2014-local-retro': 1210,
        'barcelona-2010-2011-local': 1200,
        'arsenal-2005-2006-local-burdeos': 1190,
        'arsenal-1991-1993-visitante-bruised-banana': 1180,
        'manchester-united-1998-1999-local': 1170,
        'bayern-1998-1999-local': 1160,
        'colombia-1998-local': 1150,
        'real-madrid-2013-2014-local': 1140,
        'liverpool-1998-1999-visitante': 1130,
        'argentina-local-2006': 1120,
        'colombia-2024-centenary-blanca': 900
    };

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
        if (!item) return 0;
        var galleryCount = Number(item.photo_count_gallery) || 0;
        if (galleryCount) return galleryCount;
        var explicitCount = Math.max(Number(item.photo_count) || 0, Number(item.photo_count_original) || 0);
        if (explicitCount) return explicitCount;
        return Math.max(
            Array.isArray(item.imagenes) ? item.imagenes.length : 0,
            Array.isArray(item.imagenes_detalle) ? item.imagenes_detalle.length : 0,
            Array.isArray(item.imagenes_originales) ? item.imagenes_originales.length : 0
        );
    }

    function getImageUrl(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return value.card_url || value.url || value.src || value.href || '';
    }

    function getGalleryImageUrl(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return value.master_url || value.url || value.card_url || value.src || value.href || '';
    }

    function getCuratedSourceUrl(value) {
        if (!value || typeof value === 'string') return '';
        return value.source_url || value.sourceUrl || '';
    }

    function isCuratedImage(value) {
        var url = getGalleryImageUrl(value);
        return !!(url && url.indexOf('/preventa-curated/') !== -1);
    }

    function getCuratedImages(item) {
        if (!item) return [];
        var fields = [
            item.imagenes_curadas,
            item.curated_images,
            item.curatedImages,
            item.card_images,
            item.cardImages
        ];
        var images = [];

        fields.forEach(function (field) {
            if (!Array.isArray(field)) return;
            field.forEach(function (image) {
                var url = getImageUrl(image);
                if (url) images.push(url);
            });
        });

        ((item && item.imagenes) || []).forEach(function (image) {
            if (!isCuratedImage(image)) return;
            var url = getImageUrl(image);
            if (url) images.push(url);
        });

        [
            item.imagen_curada,
            item.thumbnail_curado,
            item.card_image,
            item.cardImage,
            item.curated_image,
            item.curatedImage
        ].forEach(function (field) {
            var url = getImageUrl(field);
            if (url) images.unshift(url);
        });

        return images.filter(function (url, index) {
            return url && images.indexOf(url) === index;
        });
    }

    function getCuratedGalleryImages(item) {
        if (!item) return [];
        var fields = [
            item.imagenes_curadas,
            item.curated_images,
            item.curatedImages,
            item.card_images,
            item.cardImages
        ];
        var images = [];

        fields.forEach(function (field) {
            if (!Array.isArray(field)) return;
            field.forEach(function (image) {
                var url = getGalleryImageUrl(image);
                if (url) images.push(url);
            });
        });

        ((item && item.imagenes) || []).forEach(function (image) {
            if (!isCuratedImage(image)) return;
            var url = getGalleryImageUrl(image);
            if (url) images.push(url);
        });

        [
            item.imagen_curada,
            item.thumbnail_curado,
            item.card_image,
            item.cardImage,
            item.curated_image,
            item.curatedImage
        ].forEach(function (field) {
            var url = getGalleryImageUrl(field);
            if (url) images.unshift(url);
        });

        return images.filter(function (url, index) {
            return url && images.indexOf(url) === index;
        });
    }

    function getRawImageUrl(item, index) {
        var imgs = (item && item.imagenes) || [];
        return imgs[index] ? getImageUrl(imgs[index]) : '';
    }

    function getPreventaCardImageUrl(item, index) {
        var curated = getCuratedImages(item);
        return curated[index] || (index === 0 ? curated[0] : '') || getRawImageUrl(item, index);
    }

    function getPreventaGalleryImages(item) {
        var urls = [];
        var curatedSources = {};
        var detailImages = item && Array.isArray(item.imagenes_detalle)
            ? item.imagenes_detalle
            : ((item && item.imagenes_originales) || []);

        ((item && item.imagenes) || []).forEach(function (image) {
            var sourceUrl = getCuratedSourceUrl(image);
            if (sourceUrl) curatedSources[sourceUrl] = true;
        });

        getCuratedGalleryImages(item).forEach(function (url) { urls.push(url); });
        ((item && item.imagenes) || []).forEach(function (image) {
            var url = getGalleryImageUrl(image);
            if (url) urls.push(url);
        });
        detailImages.forEach(function (image) {
            var url = getGalleryImageUrl(image);
            if (!url || curatedSources[url]) return;
            if (url) urls.push(url);
        });

        return urls.filter(function (url, index) {
            return url && urls.indexOf(url) === index;
        }).map(function (url) {
            return { url: url };
        });
    }

    function getVisualPriority(item) {
        return PV_VISUAL_PRIORITY[item.slug] || 0;
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

        score += getVisualPriority(item);
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
        var visualPriority = getVisualPriority(item);

        if (hasAnyKeyword(text, PV_FEATURED_EXCLUDE)) return -9999;
        if (getPhotoCount(item) < 5 && !visualPriority) return -500;
        boost += visualPriority;

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
        return 1;
    }

    function getTeamFamily(item) {
        var text = normalizeText([item.equipo, item.slug].join(' '));
        var families = [
            'real madrid', 'barcelona', 'manchester united', 'ac milan', 'milan', 'inter',
            'arsenal', 'liverpool', 'bayern', 'juventus', 'argentina', 'brasil', 'brazil',
            'colombia', 'river', 'boca', 'chelsea', 'roma'
        ];

        for (var i = 0; i < families.length; i++) {
            if (text.indexOf(families[i]) !== -1) {
                if (families[i] === 'brazil') return 'brasil';
                if (families[i] === 'milan') return 'ac milan';
                return families[i];
            }
        }

        return normalizeText(item.equipo || '')
            .replace(/\b(local|visitante|manga larga|retro|player|portero|arquero)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function compareByScore(a, b) {
        var priorityDiff = getVisualPriority(b) - getVisualPriority(a);
        if (priorityDiff !== 0) return priorityDiff;

        var diff = getItemScore(b) - getItemScore(a);
        if (diff !== 0) return diff;
        diff = getPhotoCount(b) - getPhotoCount(a);
        if (diff !== 0) return diff;
        return normalizeText(a.equipo).localeCompare(normalizeText(b.equipo));
    }

    function getPreventaPriceValue(item) {
        var direct = Number(item.precio_aprox || 0);
        if (direct) return direct;
        var label = pvGetPrecio(item.tipo);
        return Number(String(label).replace(/[^0-9]/g, '')) || 0;
    }

    function normalizeSeasonYear(year) {
        var value = Number(year || 0);
        if (!value) return 0;
        if (value < 100) return value >= 70 ? 1900 + value : 2000 + value;
        return value;
    }

    function getRecentSortValue(item) {
        var text = [item.temporada, item.slug, item.descripcion, item.equipo].join(' ');
        var best = 0;
        var matches = String(text).match(/\b(\d{2,4})\b/g) || [];

        matches.forEach(function (match) {
            var year = normalizeSeasonYear(match);
            if (year >= 1970 && year <= 2035) best = Math.max(best, year);
        });

        return best;
    }

    function sortPreventaItems(items) {
        return items.slice().sort(function (a, b) {
            var diff = 0;
            if (_pvSort === 'price-asc') diff = getPreventaPriceValue(a) - getPreventaPriceValue(b);
            if (_pvSort === 'price-desc') diff = getPreventaPriceValue(b) - getPreventaPriceValue(a);
            if (_pvSort === 'photos') diff = getPhotoCount(b) - getPhotoCount(a);
            if (_pvSort === 'az') diff = normalizeText(a.equipo).localeCompare(normalizeText(b.equipo));
            if (_pvSort === 'newest') diff = getRecentSortValue(b) - getRecentSortValue(a);
            if (_pvSort === 'popular') diff = compareByScore(a, b);
            if (diff !== 0) return diff;
            return compareByScore(a, b);
        });
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

    function getDuplicateSeasonKey(temporada) {
        var years = String(temporada || '').match(/\d{2,4}/g) || [];
        if (!years.length) return normalizeKey(temporada || 'sin-temporada');
        years = years.map(function (year) {
            if (year.length === 2) return (Number(year) > 30 ? '19' : '20') + year;
            return year;
        });
        return years.length > 1 ? years.slice(0, 2).join('-') : years[0];
    }

    function getDuplicateTeamKey(item) {
        return normalizeText(item.equipo || '')
            .replace(/\b(local|visitante|tercera|portero|arquero|manga larga|player|fan|retro|ucl)\b/g, ' ')
            .replace(/\b(azul|negra|amarilla|roja|verde|blanca|rosa|morado|morada)\b/g, ' ')
            .replace(/\b(nino|niño|centenario|centenary|aniversario|classic|edicion|especial|100 anos|125 aniversario|2)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDuplicateVariantKey(item) {
        var text = normalizeText([item.slug, item.equipo, item.tipo, item.descripcion].join(' '));
        var parts = [];

        if (text.indexOf('visitante') !== -1) parts.push('visitante');
        else if (text.indexOf('tercera') !== -1) parts.push('tercera');
        else if (text.indexOf('portero') !== -1 || text.indexOf('arquero') !== -1) parts.push('arquero');
        else parts.push('local');

        if (text.indexOf('manga larga') !== -1 || text.indexOf('manga-larga') !== -1) parts.push('manga-larga');
        if (text.indexOf('player') !== -1) parts.push('player');
        if (text.indexOf('nino') !== -1 || text.indexOf('niño') !== -1) parts.push('nino');
        if (text.indexOf('centenario') !== -1 || text.indexOf('centenary') !== -1 || text.indexOf('125 aniversario') !== -1 || text.indexOf('100 anos') !== -1) parts.push('aniversario');
        if (text.indexOf('classic') !== -1) parts.push('classic');
        if (text.indexOf('negra') !== -1) parts.push('negra');
        if (text.indexOf('verde') !== -1) parts.push('verde');
        if (text.indexOf('blanca') !== -1) parts.push('blanca');
        if (text.indexOf('rosa') !== -1) parts.push('rosa');

        return parts.join('+');
    }

    function getDuplicateKey(item) {
        return [
            getDuplicateTeamKey(item),
            getDuplicateSeasonKey(item.temporada),
            getDuplicateVariantKey(item)
        ].join('|');
    }

    function chooseBetterDuplicate(current, candidate) {
        if (!current) return candidate;
        var diff = getItemScore(candidate) - getItemScore(current);
        if (diff > 0) return candidate;
        if (diff < 0) return current;

        diff = getPhotoCount(candidate) - getPhotoCount(current);
        if (diff > 0) return candidate;
        if (diff < 0) return current;

        if (candidate.destacado && !current.destacado) return candidate;
        return current;
    }

    function dedupePreventaItems(items) {
        var byKey = {};
        (items || []).forEach(function (item) {
            var key = getDuplicateKey(item);
            byKey[key] = chooseBetterDuplicate(byKey[key], item);
        });
        return Object.keys(byKey).map(function (key) { return byKey[key]; });
    }

    function pvLoadImage(img) {
        if (!img || !img.dataset || !img.dataset.src) return;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
    }

    function pvObserveLazyImages(root) {
        var scope = root || document;
        var imgs = scope.querySelectorAll('img.pv-lazy-img[data-src]');
        if (!imgs.length) return;

        if (!('IntersectionObserver' in window)) {
            imgs.forEach(pvLoadImage);
            return;
        }

        if (!_pvImgObserver) {
            _pvImgObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    _pvImgObserver.unobserve(entry.target);
                    pvLoadImage(entry.target);
                });
            }, { rootMargin: '180px 0px', threshold: 0.01 });
        }

        imgs.forEach(function (img) { _pvImgObserver.observe(img); });
    }

    function pvBindHoverImages(root) {
        if (!PV_CAN_HOVER) return;
        (root || document).querySelectorAll('.pv-card-item').forEach(function (card) {
            var loadHover = function () {
                var hoverImg = card.querySelector('.pv-img-hover[data-src]');
                if (!hoverImg) return;
                hoverImg.addEventListener('load', function () {
                    card.classList.add('pv-hover-ready');
                }, { once: true });
                pvLoadImage(hoverImg);
            };
            card.addEventListener('mouseenter', loadHover, { once: true, passive: true });
            card.addEventListener('focusin', loadHover, { once: true });
        });
    }

    function pvHydrateRenderedImages(root) {
        pvObserveLazyImages(root);
        pvBindHoverImages(root);
    }

    function renderCard(item, idx, collectionKey) {
        var curatedImgs = getCuratedImages(item);
        var img1 = getPreventaCardImageUrl(item, 0);
        var img2 = PV_CAN_HOVER && curatedImgs.length > 1 ? getPreventaCardImageUrl(item, 1) : '';
        var tipoLabel = (item.tipo || '').replace(/-/g, ' ');
        var nFotos = getPhotoCount(item);
        var precio = pvGetPrecio(item.tipo);
        var detailUrl = '/preventa/' + encodeURIComponent(item.slug || item.equipo || '');
        var displayTitle = getPreventaDisplayTitle(item);
        var isPriority = idx < 3;
        var mainAttrs = img1
            ? (isPriority
                ? 'src="' + img1 + '" loading="eager" fetchpriority="' + (idx === 0 ? 'high' : 'auto') + '"'
                : 'data-src="' + img1 + '" loading="lazy" fetchpriority="low"')
            : '';

        return '<a class="pv-card-item product-card bajopedido" data-curated-image="' + (curatedImgs.length ? 'true' : 'false') + '" href="' + detailUrl + '" onclick="event.preventDefault(); pvAbrirLightbox(\'' + collectionKey + '\',' + idx + ')">' +
            '<div class="pv-card-img-wrap product-image-wrapper">' +
                (img1 ? '<img class="pv-img-main' + (isPriority ? '' : ' pv-lazy-img') + '" ' + mainAttrs + ' alt="' + escHtml(displayTitle) + '" width="640" height="640" decoding="async">' : '') +
                (img2 ? '<img class="pv-img-hover" data-src="' + img2 + '" alt="' + escHtml(displayTitle) + ' - foto 2" width="640" height="640" loading="lazy" decoding="async" fetchpriority="low">' : '') +
                (nFotos > 1 ? '<span class="pv-photo-count"><i class="ph-bold ph-images"></i> ' + nFotos + '</span>' : '') +
            '</div>' +
            '<div class="pv-card-info product-info">' +
                '<div class="pv-card-equipo product-title">' + escHtml(displayTitle) + '</div>' +
                '<div class="pv-card-precio product-price">' + precio + '</div>' +
                '<div class="pv-card-meta product-sizes">' + escHtml(item.temporada) + ' &middot; ' + escHtml(tipoLabel) + '</div>' +
                '<div class="pv-card-cta btn-whatsapp"><i class="ph-bold ph-eye"></i> Ver detalles</div>' +
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
            var teamText = getTeamFamily(item);
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
                title: 'Recomendadas',
                kicker: '',
                subtitle: '',
                meta: '',
                items: featured,
                initialCount: 12,
                featured: true
            },
            {
                key: 'clubs-top',
                title: 'Clubes',
                kicker: '',
                subtitle: '',
                meta: '',
                items: clubsTop,
                initialCount: 6
            },
            {
                key: 'selecciones-top',
                title: 'Selecciones',
                kicker: '',
                subtitle: '',
                meta: '',
                items: seleccionesTop,
                initialCount: 6
            },
            {
                key: 'sudamerica',
                title: 'Sudamerica Imprescindible',
                kicker: '',
                subtitle: '',
                meta: '',
                items: sudamerica,
                initialCount: 4
            },
            {
                key: 'joyas',
                title: 'Joyas Retro',
                kicker: '',
                subtitle: '',
                meta: '',
                items: joyas,
                initialCount: 6
            },
            {
                key: 'explorar',
                title: 'Catalogo',
                kicker: '',
                subtitle: '',
                meta: '',
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
                    (section.kicker ? '<div class="pv-section-kicker"><i class="ph-bold ph-lightning"></i> ' + escHtml(section.kicker) + '</div>' : '') +
                    '<h3 class="pv-section-title">' + escHtml(section.title) + '</h3>' +
                    (section.subtitle ? '<p class="pv-section-sub">' + escHtml(section.subtitle) + '</p>' : '') +
                '</div>' +
                (section.meta ? '<div class="pv-section-meta">' + escHtml(section.meta) + '</div>' : '') +
            '</div>' +
            '<div class="pv-section-grid' + (section.featured ? ' pv-section-grid-featured' : '') + '">' +
                visibleItems.map(function (item, idx) { return renderCard(item, idx, section.key); }).join('') +
            '</div>' +
            (visibleCount < section.items.length
                ? '<div class="pv-section-actions"><button class="pv-more-btn" onclick="pvMostrarMas(\'' + section.key + '\')"><i class="ph-bold ph-plus"></i> Ver más</button></div>'
                : '') +
        '</section>';
    }

    function renderPvPagination(page, totalPages) {
        if (totalPages <= 1) return '';
        var html = '<div class="pv-pagination" aria-label="Paginacion preventa">';
        var start = Math.max(1, Math.min(page - 2, totalPages - 4));
        var end = Math.min(totalPages, Math.max(page + 2, 5));
        html += '<button class="pv-page-btn" onclick="pvGoPage(' + Math.max(1, page - 1) + ')" ' + (page === 1 ? 'disabled' : '') + ' aria-label="Pagina anterior"><i class="ph-bold ph-caret-left"></i></button>';
        for (var i = start; i <= end; i++) {
            html += '<button class="pv-page-btn' + (i === page ? ' active' : '') + '" onclick="pvGoPage(' + i + ')" aria-label="Ir a pagina ' + i + '">' + i + '</button>';
        }
        html += '<button class="pv-page-btn" onclick="pvGoPage(' + Math.min(totalPages, page + 1) + ')" ' + (page === totalPages ? 'disabled' : '') + ' aria-label="Pagina siguiente"><i class="ph-bold ph-caret-right"></i></button>';
        html += '</div>';
        return html;
    }

    function renderPvToolbar(total, page, totalPages, start, end) {
        return '<div class="pv-catalog-toolbar">' +
            '<div class="pv-catalog-results">' + (total ? 'Mostrando ' + start + '-' + end + ' de ' + total : 'Sin resultados') + '</div>' +
            '<label class="pv-sort-wrap"><span>Ordenar por</span>' +
                '<select class="pv-sort-select" onchange="pvSetSort(this.value)" aria-label="Ordenar preventa">' +
                    '<option value="popular"' + (_pvSort === 'popular' ? ' selected' : '') + '>Popularidad</option>' +
                    '<option value="newest"' + (_pvSort === 'newest' ? ' selected' : '') + '>Temporada reciente</option>' +
                    '<option value="price-asc"' + (_pvSort === 'price-asc' ? ' selected' : '') + '>Menor precio</option>' +
                    '<option value="price-desc"' + (_pvSort === 'price-desc' ? ' selected' : '') + '>Mayor precio</option>' +
                    '<option value="photos"' + (_pvSort === 'photos' ? ' selected' : '') + '>Mas fotos</option>' +
                    '<option value="az"' + (_pvSort === 'az' ? ' selected' : '') + '>A-Z</option>' +
                '</select>' +
            '</label>' +
            renderPvPagination(page, totalPages) +
        '</div>';
    }

    function getPagedPreventaItems(items) {
        var sorted = sortPreventaItems(items);
        var totalPages = Math.max(1, Math.ceil(sorted.length / PV_PAGE_SIZE));
        _pvPage = Math.min(Math.max(1, _pvPage), totalPages);
        var startIndex = (_pvPage - 1) * PV_PAGE_SIZE;
        return {
            sorted: sorted,
            pageItems: sorted.slice(startIndex, startIndex + PV_PAGE_SIZE),
            page: _pvPage,
            totalPages: totalPages,
            start: sorted.length ? startIndex + 1 : 0,
            end: Math.min(sorted.length, startIndex + PV_PAGE_SIZE)
        };
    }
    function renderSearchResults(items, searchTerm) {
        var pageData = getPagedPreventaItems(items);
        _pvCollections.search = pageData.pageItems;
        return '<section class="pv-section pv-section-featured">' +
            '<div class="pv-section-head">' +
                '<div>' +
                    '<h3 class="pv-section-title">' + (searchTerm ? 'Resultados para "' + escHtml(searchTerm) + '"' : 'Referencias filtradas') + '</h3>' +
                '</div>' +
            '</div>' +
            renderPvToolbar(pageData.sorted.length, pageData.page, pageData.totalPages, pageData.start, pageData.end) +
            '<div class="pv-grid">' +
                pageData.pageItems.map(function (item, idx) { return renderCard(item, idx, 'search'); }).join('') +
            '</div>' +
            '<div class="pv-catalog-toolbar pv-catalog-toolbar-bottom">' + renderPvPagination(pageData.page, pageData.totalPages) + '</div>' +
        '</section>';
    }

    function renderCatalogComplete(items) {
        var pageData = getPagedPreventaItems(items);
        _pvCollections.catalog = pageData.pageItems;
        return '<section class="pv-section pv-section-catalogo">' +
            '<div class="pv-section-head">' +
                '<div><h3 class="pv-section-title">Catalogo completo</h3></div>' +
            '</div>' +
            renderPvToolbar(pageData.sorted.length, pageData.page, pageData.totalPages, pageData.start, pageData.end) +
            '<div class="pv-grid">' +
                pageData.pageItems.map(function (item, idx) { return renderCard(item, idx, 'catalog'); }).join('') +
            '</div>' +
            '<div class="pv-catalog-toolbar pv-catalog-toolbar-bottom">' + renderPvPagination(pageData.page, pageData.totalPages) + '</div>' +
        '</section>';
    }

    function renderDefaultCatalog(items) {
        var stage = document.getElementById('pv-grid-stage');
        var intro = document.getElementById('pv-intro-copy');

        _pvCollections = {};
        _pvVisibleCounts = {};

        if (intro) intro.style.display = '';
        stage.innerHTML = renderCatalogComplete(items);
        pvHydrateRenderedImages(stage);
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
        _pvRenderToken++;
        if (isFiltered) {
            if (intro) intro.style.display = 'none';
            stage.innerHTML = renderSearchResults(items, searchTerm);
            pvHydrateRenderedImages(stage);
            return;
        }

        renderDefaultCatalog(items);
    }
    function pvFetchJson(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' cargando ' + url);
            return res.json();
        });
    }

    function pvIndexFullItems(items) {
        (items || []).forEach(function (item) {
            if (item && item.slug) _pvFullBySlug[item.slug] = item;
        });
    }

    function pvSetCatalogItems(items) {
        var galSection = document.getElementById('pv-galeria');
        _pvAll = dedupePreventaItems(items || []).sort(compareByScore);

        if (!_pvAll.length) {
            galSection.style.display = 'none';
            return false;
        }

        galSection.style.display = '';
        pvApplyFilters();
        return true;
    }

    function pvLoadFullCatalog() {
        if (_pvFullCatalogPromise) return _pvFullCatalogPromise;
        _pvFullCatalogPromise = pvFetchJson(PV_FULL_CATALOG_URL).then(function (items) {
            pvIndexFullItems(items);
            return items;
        }).catch(function (e) {
            _pvFullCatalogPromise = null;
            throw e;
        });
        return _pvFullCatalogPromise;
    }

    function pvLoadSupabaseClient() {
        if (db) return Promise.resolve(db);
        if (window.supabase) {
            db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return Promise.resolve(db);
        }

        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-pv-supabase]');
            if (existing) {
                existing.addEventListener('load', function () {
                    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    resolve(db);
                }, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            var script = document.createElement('script');
            script.src = SUPABASE_SCRIPT_URL;
            script.async = true;
            script.defer = true;
            script.dataset.pvSupabase = 'true';
            script.onload = function () {
                db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                resolve(db);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function pvLoadFromSupabaseFallback() {
        return pvLoadSupabaseClient().then(function (client) {
            return client.from('preventa_catalogo')
                .select('id,slug,equipo,temporada,tipo,categoria,decada,imagenes,imagenes_detalle,imagenes_originales,photo_count_gallery,gallery_status,destacado,descripcion,precio_aprox,pais_o_club,tags')
                .eq('publicado', true)
                .order('destacado', { ascending: false });
        }).then(function (res) {
            if (res.error) throw res.error;
            return res.data || [];
        });
    }

    var _pvDeferredRefreshStarted = false;
    var _pvPhosphorPromise = null;

    function pvHasConstrainedNetwork() {
        var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return !!(connection && (connection.saveData || /2g/.test(connection.effectiveType || '')));
    }

    function pvRunWhenIdle(callback, timeout) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: timeout || 1800 });
            return;
        }
        setTimeout(callback, Math.min(timeout || 1800, 1200));
    }

    function pvRunAfterFirstInteraction(callback, fallbackDelay) {
        var fired = false;
        var run = function () {
            if (fired) return;
            fired = true;
            window.removeEventListener('pointerdown', run);
            window.removeEventListener('keydown', run);
            window.removeEventListener('scroll', run);
            window.removeEventListener('touchstart', run);
            callback();
        };
        window.addEventListener('pointerdown', run, { passive: true });
        window.addEventListener('keydown', run);
        window.addEventListener('scroll', run, { passive: true });
        window.addEventListener('touchstart', run, { passive: true });
        setTimeout(run, fallbackDelay || 18000);
    }

    function pvLoadPhosphorIcons() {
        if (_pvPhosphorPromise) return _pvPhosphorPromise;
        _pvPhosphorPromise = new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-pv-phosphor]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/@phosphor-icons/web';
            script.async = true;
            script.defer = true;
            script.dataset.pvPhosphor = 'true';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        }).catch(function () {});
        return _pvPhosphorPromise;
    }

    function pvRefreshFromSupabaseLater() {
        if (_pvDeferredRefreshStarted || pvHasConstrainedNetwork()) return;
        _pvDeferredRefreshStarted = true;
        pvRunAfterFirstInteraction(function () {
            pvRunWhenIdle(function () {
                pvLoadFromSupabaseFallback().then(function (remoteItems) {
                    if (!Array.isArray(remoteItems) || !remoteItems.length) return;
                    pvIndexFullItems(remoteItems);
                    pvSetCatalogItems(remoteItems);
                }).catch(function () {});
            }, 2400);
        }, 18000);
    }

    async function pvCargar() {
        var galSection = document.getElementById('pv-galeria');
        try {
            var listItems = await pvFetchJson(PV_LIST_URL);
            pvIndexFullItems(listItems);
            if (pvSetCatalogItems(listItems)) pvRefreshFromSupabaseLater();
            return;
        } catch (e) {
            try {
                var fullItems = await pvLoadFullCatalog();
                pvIndexFullItems(fullItems);
                if (pvSetCatalogItems(fullItems)) pvRefreshFromSupabaseLater();
                return;
            } catch (fallbackError) {
                try {
                    var remoteItems = await pvLoadFromSupabaseFallback();
                    pvIndexFullItems(remoteItems);
                    pvSetCatalogItems(remoteItems);
                } catch (remoteError) {
                    galSection.style.display = 'none';
                    console.warn('[pv-galeria] Error cargando catalogo:', remoteError.message || fallbackError.message || e.message);
                }
            }
            console.warn('[pv-galeria] Error cargando catalogo local:', e.message);
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
                var searchNeedle = normalizeText(searchTerm);
                var haystack = [
                    r.equipo, r.temporada, r.tipo, r.categoria,
                    r.pais_o_club, r.descripcion, (r.tags || []).join(' ')
                ].join(' ');
                return normalizeText(haystack).indexOf(searchNeedle) !== -1;
            }

            return true;
        });
    }

    function pvApplyFilters() {
        var searchTerm = (document.getElementById('pv-search').value || '').trim();
        var filtered = getFilteredItems(searchTerm);
        renderCurrentView(filtered, searchTerm, !!searchTerm || _pvFiltroType !== 'all');
    }

    window.pvFiltrar = function (btn, type, val) {
        document.querySelectorAll('.pv-filtro-btn').forEach(function (b) { b.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        _pvFiltroType = type;
        _pvFiltroVal = val;
        _pvPage = 1;
        pvApplyFilters();
    };

    window.pvSetSort = function (value) {
        _pvSort = value || 'popular';
        _pvPage = 1;
        pvApplyFilters();
    };

    window.pvGoPage = function (page) {
        _pvPage = Math.max(1, Number(page) || 1);
        pvApplyFilters();
        var gal = document.getElementById('pv-galeria');
        if (gal) gal.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        pvHydrateRenderedImages(stage);

        var target = document.querySelector('[onclick="pvMostrarMas(\'' + sectionKey + '\')"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    function pvMostrarToast(message) {
        var existing = document.getElementById('pv-toast-notification');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.id = 'pv-toast-notification';
        toast.style.cssText = 'position:fixed; top:24px; right:24px; background:rgba(255,255,255,0.9); border:1px solid rgba(179,151,93,0.3); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); padding:16px 20px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.08); display:flex; align-items:center; gap:12px; z-index:10000; transform:translateX(120%); transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s; opacity:0; font-family:"Montserrat",sans-serif; max-width:340px;';
        
        toast.innerHTML = '<span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(179,151,93,0.1); border:1px solid rgba(179,151,93,0.3); color:#b3975d; flex-shrink:0;"><i class="ph-bold ph-check" style="font-size:0.9rem;"></i></span>' +
            '<div style="display:flex; flex-direction:column; gap:2px;">' +
                '<strong style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.8px; color:#121214;">¡Camiseta cargada!</strong>' +
                '<span style="font-size:0.74rem; color:#556070; line-height:1.35;">' + message + '</span>' +
            '</div>';

        document.body.appendChild(toast);
        toast.offsetHeight; // force layout
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';

        setTimeout(function () {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400);
        }, 3500);
    }

    window.pvSeleccionar = function (rJson) {
        var r;
        try { r = JSON.parse(rJson); } catch (e) { return; }

        var equipoEl = document.getElementById('pp-equipo');
        if (equipoEl) {
            equipoEl.value = r.equipo || '';
            equipoEl.classList.remove('pv-input-invalid');
            equipoEl.removeAttribute('aria-invalid');
            var equipoError = document.getElementById('pp-equipo-error');
            if (equipoError) equipoError.textContent = '';
        }

        var tempEl = document.getElementById('pp-temporada');
        if (tempEl) tempEl.value = r.temporada || '';

        var typeText = [r.tipo, r.slug, r.descripcion, r.equipo].join(' ').toLowerCase();
        var selectedType = '';
        if (typeText.indexOf('visitante') !== -1) selectedType = 'Visitante';
        else if (typeText.indexOf('tercera') !== -1 || typeText.indexOf('third') !== -1) selectedType = 'Tercera';
        else if (typeText.indexOf('local') !== -1 || typeText.indexOf('home') !== -1) selectedType = 'Local';
        document.querySelectorAll('#pp-slide-1 .pp-tipo-btn').forEach(function (btn) {
            btn.classList.toggle('pp-selected', !!selectedType && btn.dataset.val === selectedType);
        });

        var refEl = document.getElementById('pp-ref-interna');
        if (refEl) refEl.value = r.slug || '';

        pvSettleOnWizard();
        pvMostrarToast('Se cargaron los detalles de ' + (r.equipo || 'la camiseta') + ' en el cotizador.');
    };

    window.pvAbrirLightbox = function (collectionKey, itemIdx) {
        var collection = _pvCollections[collectionKey] || [];
        var r = collection[itemIdx];
        if (!r) return;

        _pvLbData = r;
        _pvLbIdx = 0;

        var imgs = getPreventaGalleryImages(r);
        if (!imgs.length) {
            pvSeleccionar(JSON.stringify(r));
            return;
        }

        document.getElementById('pv-lb-equipo').textContent = getPreventaDisplayTitle(r);
        document.getElementById('pv-lb-meta').textContent = (r.temporada || '') + ' · ' + (r.tipo || '').replace(/-/g, ' ');
        document.getElementById('pv-lb-precio').textContent = pvGetPrecio(r.tipo);

        _pvLbImgs = imgs;

        var thumbsEl = document.getElementById('pv-lb-thumbs');
        if (imgs.length > 1) {
            thumbsEl.innerHTML = imgs.map(function (img, i) {
                return '<img class="pv-lb-thumb' + (i === 0 ? ' active' : '') + '" src="' + img.url + '" alt="Foto ' + (i + 1) + '" loading="lazy" decoding="async" fetchpriority="low" onclick="pvLbGoTo(' + i + ')">';
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

        if (getPhotoCount(r) > imgs.length || !_pvFullBySlug[r.slug]) {
            pvLoadFullCatalog().then(function () {
                var fullItem = _pvFullBySlug[r.slug];
                if (!fullItem || !_pvLbData || _pvLbData.slug !== r.slug) return;
                var fullImgs = getPreventaGalleryImages(fullItem);
                if (fullImgs.length <= imgs.length) return;

                _pvLbData = fullItem;
                _pvLbImgs = fullImgs;
                if (fullImgs.length > 1) {
                    thumbsEl.innerHTML = fullImgs.map(function (img, i) {
                        return '<img class="pv-lb-thumb' + (i === _pvLbIdx ? ' active' : '') + '" src="' + img.url + '" alt="Foto ' + (i + 1) + '" loading="lazy" decoding="async" fetchpriority="low" onclick="pvLbGoTo(' + i + ')">';
                    }).join('');
                    thumbsEl.style.display = 'flex';
                }
                document.getElementById('pv-lb-prev').style.display = fullImgs.length > 1 ? 'flex' : 'none';
                document.getElementById('pv-lb-next').style.display = fullImgs.length > 1 ? 'flex' : 'none';
                pvLbShowImg(Math.min(_pvLbIdx, fullImgs.length - 1));
            }).catch(function () {});
        }
    };

    function pvLbShowImg(idx) {
        var imgs = _pvLbImgs || [];
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
        _pvLbImgs = [];
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
        _pvPage = 1;
        pvApplyFilters();
    }

    function pvApplySearchFromUrl() {
        var mainInput = document.getElementById('pv-search');
        if (!mainInput) return;
        var params = new URLSearchParams(window.location.search);
        var q = params.get('q') || '';
        if (!q) return;
        mainInput.value = q;
        var mobileInput = document.getElementById('mobileSearchInput');
        if (mobileInput) mobileInput.value = q;
        _pvPage = 1;
    }

    function pvSubmitMobileSearch() {
        pvCloseSearchOverlay();
        var gal = document.getElementById('pv-galeria');
        if (gal) gal.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                _pvPage = 1;
                searchTimer = setTimeout(function () {
                    pvApplyFilters();
                }, 220);
            });
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchTimer);
                    _pvPage = 1;
                    pvApplyFilters();
                }
            });
        }

        try {
            pvApplyMobileView(window.localStorage.getItem(PV_MOBILE_VIEW_KEY) || 'compact');
        } catch (e) {
            pvApplyMobileView('compact');
        }

        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('input', function () {
                pvSyncSearchFromMobile(this.value);
            });
            mobileSearchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    pvSyncSearchFromMobile(this.value);
                    pvSubmitMobileSearch();
                }
            });
            mobileSearchInput.addEventListener('search', function () {
                pvSyncSearchFromMobile(this.value);
                pvSubmitMobileSearch();
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
                var selected = JSON.stringify(_pvLbData);
                pvLbCerrar();
                setTimeout(function () {
                    pvSeleccionar(selected);
                }, 180);
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

        setTimeout(function () {
            pvRunWhenIdle(function () { pvLoadPhosphorIcons(); }, 1800);
        }, 1600);

        pvApplySearchFromUrl();
        pvCargar();
    });
})();
