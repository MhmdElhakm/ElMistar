(function () {
    'use strict';

    var SELECTORS = ['.summer-courses-grid', '.ew-cards-grid', '.apps-grid'];
    var NUDGE_PX = 56;
    var NUDGE_DELAY = 900;
    var NUDGE_BACK_DELAY = 550;
    var SNAP_DEBOUNCE = 140;

    var mq = window.matchMedia('(max-width: 768px)');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var states = {};
    var nudged = {};
    var interacted = {};

    function realCards(container) {
        var out = [];
        var kids = container.children;
        for (var i = 0; i < kids.length; i++) {
            if (!kids[i].classList.contains('carousel-clone')) out.push(kids[i]);
        }
        return out;
    }

    function sameReals(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function calibrate(container, st) {
        try {
            var r0 = container.children[0].getBoundingClientRect().left;
            var s0 = container.scrollLeft;
            container.scrollLeft = s0 + 2;
            var r1 = container.children[0].getBoundingClientRect().left;
            container.scrollLeft = s0;
            var k = (r1 - r0) / 2;
            st.k = (k === 0) ? -1 : k;
        } catch (e) {
            st.k = -1;
        }
    }

    function shiftBy(container, st, dx) {
        container.scrollLeft += dx / st.k;
    }

    function noSnap(container, fn) {
        container.classList.add('no-snap');
        void container.offsetWidth;
        fn();
        void container.offsetWidth;
        container.classList.remove('no-snap');
    }

    function centerOn(container, st, el) {
        var r = container.getBoundingClientRect();
        var cr = el.getBoundingClientRect();
        var dx = (r.left + r.width / 2) - (cr.left + cr.width / 2);
        noSnap(container, function () { shiftBy(container, st, dx); });
    }

    function centerIndex(container) {
        var kids = container.children;
        var r = container.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var best = -1;
        var bestD = Infinity;
        for (var i = 0; i < kids.length; i++) {
            var cr = kids[i].getBoundingClientRect();
            if (cr.width === 0) continue;
            var d = Math.abs((cr.left + cr.width / 2) - cx);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    function update(container) {
        var kids = container.children;
        var idx = centerIndex(container);
        for (var i = 0; i < kids.length; i++) {
            kids[i].classList.toggle('carousel-active', i === idx);
        }
        return idx;
    }

    function jumpIfOnClone(container, st) {
        var kids = container.children;
        var idx = centerIndex(container);
        if (idx < 0) return;
        var el = kids[idx];
        if (!el.classList.contains('carousel-clone')) return;
        var target = null;
        var reals = realCards(container);
        for (var i = 0; i < reals.length; i++) {
            if (reals[i].getAttribute('data-loop-idx') === el.getAttribute('data-loop-idx')) {
                target = reals[i];
                break;
            }
        }
        if (!target) return;
        var dx = el.getBoundingClientRect().left - target.getBoundingClientRect().left;
        if (Math.abs(dx) < 2) return;
        noSnap(container, function () { shiftBy(container, st, dx); });
        update(container);
    }

    function stripIds(el) {
        if (el.hasAttribute && el.hasAttribute('id')) el.removeAttribute('id');
        var inner = el.querySelectorAll ? el.querySelectorAll('[id]') : [];
        for (var i = 0; i < inner.length; i++) inner[i].removeAttribute('id');
    }

    function makeClone(el, idx) {
        var c = el.cloneNode(true);
        c.classList.add('carousel-clone');
        c.classList.remove('carousel-active');
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('data-loop-idx', String(idx));
        stripIds(c);
        if (c.classList.contains('summer-card')) c.classList.add('summer-card-visible');
        return c;
    }

    function teardown(container, st) {
        container.classList.remove('single');
        var clones = container.querySelectorAll('.carousel-clone');
        for (var i = 0; i < clones.length; i++) {
            clones[i].parentNode.removeChild(clones[i]);
        }
        var kids = container.children;
        for (var j = 0; j < kids.length; j++) {
            kids[j].classList.remove('carousel-active');
            kids[j].removeAttribute('data-loop-idx');
        }
        st.built = false;
        st.reals = [];
    }

    function build(container, st, key, preserveIdx) {
        teardown(container, st);
        var reals = realCards(container);
        st.reals = reals.slice();
        if (!mq.matches || reals.length < 1) {
            return;
        }
        if (reals.length === 1) {
            container.classList.add('single');
            update(container);
            return;
        }
        for (var i = 0; i < reals.length; i++) {
            reals[i].setAttribute('data-loop-idx', String(i));
        }
        var fragPre = document.createDocumentFragment();
        var fragPost = document.createDocumentFragment();
        for (var p = 0; p < reals.length; p++) {
            fragPre.appendChild(makeClone(reals[p], p));
            fragPost.appendChild(makeClone(reals[p], p));
        }
        container.insertBefore(fragPre, container.firstChild);
        container.appendChild(fragPost);
        calibrate(container, st);
        st.built = true;
        var idx = (typeof preserveIdx === 'number' && reals[preserveIdx]) ? preserveIdx : 0;
        centerOn(container, st, reals[idx]);
        update(container);
        maybeNudge(container, st, key);
    }

    function currentRealIdx(container, st) {
        var reals = realCards(container);
        var idx = centerIndex(container);
        if (idx < 0) return 0;
        var el = container.children[idx];
        var li = el.getAttribute ? el.getAttribute('data-loop-idx') : null;
        if (li === null) return 0;
        var n = parseInt(li, 10);
        return isNaN(n) ? 0 : Math.min(n, reals.length - 1);
    }

    function maybeNudge(container, st, key) {
        if (nudged[key] || reduced.matches || !mq.matches) return;
        if (realCards(container).length < 2) return;
        if (container.scrollWidth <= container.clientWidth + 20) return;
        nudged[key] = true;
        setTimeout(function () {
            if (interacted[key] || !mq.matches) return;
            if (!document.body.contains(container)) return;
            try {
                var dx = -NUDGE_PX;
                var s0 = container.scrollLeft;
                container.scrollBy({ left: dx / st.k, behavior: 'smooth' });
                setTimeout(function () {
                    if (interacted[key]) return;
                    container.scrollTo({ left: s0, behavior: 'smooth' });
                }, NUDGE_BACK_DELAY);
            } catch (e) {}
        }, NUDGE_DELAY);
    }

    function attach(container, key) {
        var st = states[key];
        if (!st) {
            st = states[key] = { k: -1, built: false, reals: [], timer: null, tick: false };
        }
        if (container.__carouselKey !== key) {
            container.__carouselKey = key;
            container.addEventListener('scroll', function () {
                interacted[key] = true;
                if (st.tick) return;
                st.tick = true;
                requestAnimationFrame(function () {
                    st.tick = false;
                    if (mq.matches) update(container);
                });
                if (st.timer) clearTimeout(st.timer);
                st.timer = setTimeout(function () {
                    if (mq.matches && st.built) jumpIfOnClone(container, st);
                }, SNAP_DEBOUNCE);
            }, { passive: true });
        }
        var now = realCards(container);
        if (!mq.matches) {
            if (st.built) teardown(container, st);
            return;
        }
        if (!st.built || !sameReals(now, st.reals)) {
            var keep = st.built ? currentRealIdx(container, st) : 0;
            build(container, st, key, keep);
        } else {
            update(container);
        }
    }

    function scan() {
        SELECTORS.forEach(function (sel) {
            var els = document.querySelectorAll(sel);
            for (var j = 0; j < els.length; j++) {
                attach(els[j], sel + ':' + j);
            }
        });
    }

    function refreshAll() {
        scan();
    }

    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', function () { scan(); });
    } else if (typeof mq.addListener === 'function') {
        mq.addListener(function () { scan(); });
    }
    window.addEventListener('resize', function () {
        Object.keys(states).forEach(function (key) {
            var st = states[key];
            if (st.built) calibrate(document.querySelector(key.split(':')[0]), st);
        });
        scan();
    });
    window.addEventListener('load', scan);

    function boot() {
        scan();
        if (window.MutationObserver && document.body) {
            var obs = new MutationObserver(function () { scan(); });
            obs.observe(document.body, { childList: true, subtree: true });
        } else {
            setTimeout(scan, 1500);
            setTimeout(scan, 4000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    document.addEventListener('elmistar:data-refreshed', scan);
})();