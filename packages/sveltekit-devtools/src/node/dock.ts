// Injected into the host app to render SvelteKit DevTools' own floating dock —
// a Nuxt-DevTools-style anchor (rounded pill + glow, drag-to-edge with angle
// snapping, minimize-on-inactive) that toggles a resizable iframe panel.
// Ported from Nuxt DevTools v3.2.5 (NuxtDevtoolsFrame.vue / FrameBox.vue /
// style.css), re-implemented in framework-free TS with the Svelte palette.

const dockCss = `
:host {
	--bg: #111;
	--fg: #f5f5f5;
	--border: #3336;
	--shadow: rgba(0, 0, 0, 0.3);
}
@media (prefers-color-scheme: light) {
	:host {
		--bg: #fff;
		--fg: #111;
		--border: #efefef;
		--shadow: rgba(128, 128, 128, 0.1);
	}
}
* {
	box-sizing: border-box;
}
.sk-anchor {
	position: fixed;
	width: 0;
	z-index: 2147483645;
	transform-origin: center center;
	font-family: Arial, Helvetica, sans-serif;
	font-size: 15px;
}
.sk-anchor button {
	border: none;
	background: none;
	padding: 0;
	margin: 0;
	cursor: pointer;
	outline: none;
	color: inherit;
}
.sk-anchor button:focus-visible {
	outline: 2px solid #ff8a00;
	outline-offset: 2px;
}
.sk-panel {
	position: absolute;
	left: 0;
	top: 0;
	transform: translate(-50%, -50%);
	display: flex;
	align-items: center;
	justify-content: flex-start;
	overflow: hidden;
	gap: 2px;
	height: 30px;
	padding: 2px 2px 2px 2.5px;
	border: 1px solid var(--border);
	border-radius: 100px;
	background-color: var(--bg);
	backdrop-filter: blur(10px);
	color: var(--fg);
	box-shadow: 2px 2px 8px var(--shadow);
	user-select: none;
	touch-action: none;
	max-width: 150px;
	transition:
		all 0.6s ease,
		max-width 0.6s ease,
		padding 0.5s ease,
		transform 0.4s ease,
		opacity 0.2s ease;
}
.sk-anchor.hide .sk-panel {
	max-width: 32px;
	padding: 2px 0;
}
.sk-anchor.dragging .sk-panel {
	transition: none;
}
.sk-anchor.vertical .sk-panel {
	box-shadow: 2px -2px 8px var(--shadow);
}
.sk-icon-button {
	flex: none;
	border-radius: 100%;
	width: 30px;
	height: 30px;
	display: flex;
	justify-content: center;
	align-items: center;
	opacity: 0.8;
	transition:
		opacity 0.2s ease-in-out,
		filter 0.4s ease;
}
.sk-icon-button:hover {
	opacity: 1;
}
.sk-icon-button.active {
	color: #ff3e00;
	opacity: 1;
}
.sk-inspect-box {
	position: fixed;
	z-index: 2147483646;
	pointer-events: none;
	display: none;
	border: 1px solid #ff3e00;
	background: rgba(255, 62, 0, 0.1);
	border-radius: 2px;
}
.sk-inspect-label {
	position: fixed;
	z-index: 2147483646;
	pointer-events: none;
	display: none;
	padding: 2px 6px;
	border-radius: 4px;
	background: #ff3e00;
	color: #fff;
	font: 11px/1.5 ui-monospace, 'DM Mono', monospace;
	white-space: nowrap;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.sk-icon-button svg {
	height: 1.2em;
	width: 1.2em;
}
.sk-anchor.vertical .sk-icon-button {
	transform: rotate(-90deg);
}
.sk-panel-content {
	transition: opacity 0.4s ease;
}
.sk-anchor.hide .sk-panel-content {
	opacity: 0;
}
.sk-divider {
	flex: none;
	width: 1px;
	height: 10px;
	border-left: 1px solid #8883;
}
.sk-label {
	padding: 0 7px 0 8px;
	font-size: 0.8em;
	line-height: 1em;
	display: flex;
	gap: 3px;
	align-items: center;
	white-space: nowrap;
}
.sk-label-main {
	opacity: 0.8;
	white-space: nowrap;
}
.sk-label-secondary {
	font-size: 0.8em;
	line-height: 0.6em;
	opacity: 0.5;
	white-space: nowrap;
}
.sk-anchor.vertical .sk-label {
	transform: rotate(-90deg);
	flex-direction: column;
	gap: 2px;
	padding: 0 10px;
}
.sk-anchor:hover .sk-glow {
	opacity: 0.6;
}
.sk-glow {
	position: absolute;
	left: 0;
	top: 0;
	transform: translate(-50%, -50%);
	width: 160px;
	height: 160px;
	opacity: 0;
	transition: all 1s ease;
	pointer-events: none;
	z-index: -1;
	border-radius: 9999px;
	background-image: linear-gradient(45deg, #ff3e00, #ff8a00, #ff3e00);
	filter: blur(60px);
}
.sk-frame {
	position: fixed;
	z-index: 2147483644;
}
.sk-frame iframe {
	width: 100%;
	height: 100%;
	outline: none;
	display: block;
	background: var(--bg);
	border: 1px solid rgba(125, 125, 125, 0.2);
	border-radius: 10px;
}
.sk-resize {
	position: absolute;
}
.sk-resize-h {
	left: 6px;
	right: 6px;
	height: 10px;
	margin: -5px 0;
	cursor: ns-resize;
	border-radius: 5px;
}
.sk-resize-v {
	top: 6px;
	bottom: 6px;
	width: 10px;
	margin: 0 -5px;
	cursor: ew-resize;
	border-radius: 5px;
}
.sk-resize-c {
	width: 14px;
	height: 14px;
	margin: -6px;
	border-radius: 6px;
}
.sk-resize:hover {
	background: rgba(125, 125, 125, 0.1);
}
@media print {
	.sk-anchor {
		display: none;
	}
}
`;

const svelteLogoSvg =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 118" aria-hidden="true"><path fill="#ff3e00" d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.9-1.6 8.9.5 18 5.7 25.3 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.9 1.6-8.9-.4-18.1-5.7-25.4"/><path fill="#fff" d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4-9.8 8.5-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.5-.6.2-1.2.4-1.7.7L32.4 46c-1.4.9-2.3 2.2-2.6 3.8-.3 1.6.1 3.3 1 4.6 1.6 2.3 4.4 3.3 7.1 2.5.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4 9.8-8.5 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5"/></svg>';

export function dockModuleCode(base: string): string {
	return `
if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__SVELTEKIT_DEVTOOLS_DOCK__) {
	Object.defineProperty(window, '__SVELTEKIT_DEVTOOLS_DOCK__', { value: true });

	var BASE = ${JSON.stringify(base)};
	var STORAGE_KEY = 'sveltekit-devtools:dock';
	var MARGIN = 10;
	var SNAP_THRESHOLD = 2;
	var MOVE_THRESHOLD = 4;
	var PANEL_MIN = 20;
	var PANEL_MAX = 100;

	var defaults = { open: false, position: 'bottom', left: 50, top: 50, width: 80, height: 60, minimizePanelInactive: 5000 };
	var state = loadState();

	function loadState() {
		try {
			var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
			return Object.assign({}, defaults, saved);
		} catch (e) {
			return Object.assign({}, defaults);
		}
	}
	function saveState() {
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
	}

	function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
	function snapToPoints(v) {
		if (v < 5) return 0;
		if (v > 95) return 100;
		if (Math.abs(v - 50) < SNAP_THRESHOLD) return 50;
		return v;
	}

	var dragging = false;
	var moved = false;
	var resizing = null;
	var hovering = false;
	var minimizeTimer = null;
	var dragOffset = { x: 0, y: 0 };
	var dragStart = { x: 0, y: 0 };

	var host = document.createElement('div');
	host.setAttribute('id', 'sveltekit-devtools-dock');
	var root = host.attachShadow({ mode: 'open' });
	var styleEl = document.createElement('style');
	styleEl.textContent = ${JSON.stringify(dockCss)};
	root.appendChild(styleEl);

	var anchor = document.createElement('div');
	anchor.className = 'sk-anchor';

	var glow = document.createElement('div');
	glow.className = 'sk-glow';

	var panel = document.createElement('div');
	panel.className = 'sk-panel';

	var toggleBtn = document.createElement('button');
	toggleBtn.className = 'sk-icon-button';
	toggleBtn.setAttribute('title', 'Toggle SvelteKit DevTools');
	toggleBtn.innerHTML = ${JSON.stringify(svelteLogoSvg)};

	var divider = document.createElement('div');
	divider.className = 'sk-panel-content sk-divider';

	var label = document.createElement('div');
	label.className = 'sk-panel-content sk-label';
	label.setAttribute('title', 'Page load time');
	var labelMain = document.createElement('div');
	labelMain.className = 'sk-label-main';
	var labelSecondary = document.createElement('span');
	labelSecondary.className = 'sk-label-secondary';
	label.appendChild(labelMain);
	label.appendChild(labelSecondary);

	panel.appendChild(toggleBtn);
	panel.appendChild(divider);
	panel.appendChild(label);

	var inspectDivider = document.createElement('div');
	inspectDivider.className = 'sk-panel-content sk-divider';
	var inspectBtn = document.createElement('button');
	inspectBtn.className = 'sk-icon-button sk-panel-content';
	inspectBtn.setAttribute('title', 'Inspect component — click an element to open its source');
	inspectBtn.innerHTML =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3.5"/></svg>';
	panel.appendChild(inspectDivider);
	panel.appendChild(inspectBtn);
	anchor.appendChild(glow);
	anchor.appendChild(panel);

	var frame = document.createElement('div');
	frame.className = 'sk-frame';
	frame.style.display = 'none';

	var iframe = document.createElement('iframe');
	iframe.setAttribute('src', BASE);
	iframe.setAttribute('title', 'SvelteKit DevTools');
	frame.appendChild(iframe);

	var handles = [];
	function addHandle(kind, sides, cursor) {
		var h = document.createElement('div');
		h.className = 'sk-resize sk-resize-' + kind;
		if (cursor) h.style.cursor = cursor;
		h.addEventListener('mousedown', function (e) { e.preventDefault(); resizing = sides; });
		h.addEventListener('touchstart', function (e) { e.preventDefault(); resizing = sides; }, { passive: false });
		frame.appendChild(h);
		handles.push({ el: h, sides: sides });
		return h;
	}
	addHandle('h', { top: true }, '');
	addHandle('h', { bottom: true }, '');
	addHandle('v', { left: true }, '');
	addHandle('v', { right: true }, '');
	addHandle('c', { top: true, left: true }, 'nwse-resize');
	addHandle('c', { top: true, right: true }, 'nesw-resize');
	addHandle('c', { bottom: true, left: true }, 'nesw-resize');
	addHandle('c', { bottom: true, right: true }, 'nwse-resize');

	root.appendChild(anchor);
	root.appendChild(frame);
	document.body.appendChild(host);

	function isTouch() {
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	}
	function isMinimized() {
		return state.minimizePanelInactive > 0 && !dragging && !state.open && !hovering && !isTouch();
	}
	function bringUp() {
		hovering = true;
		if (state.minimizePanelInactive < 0) { render(); return; }
		if (minimizeTimer) clearTimeout(minimizeTimer);
		minimizeTimer = setTimeout(function () { hovering = false; render(); }, state.minimizePanelInactive || 0);
		render();
	}

	// Position with CSS units (%, vh, clamp) so the browser resolves against the
	// real viewport — robust even when JS can't read window dimensions at mount.
	function render() {
		var pos = state.position;
		var isVertical = pos === 'left' || pos === 'right';
		var minimized = isMinimized();

		var EDGE = '25px'; // margin (10) + half panel thickness (15)
		var lo = '28px';
		var hi = 'calc(100% - 28px)';
		var alongX = 'clamp(' + lo + ', ' + state.left + '%, ' + hi + ')';
		var alongY = 'clamp(' + lo + ', ' + state.top + '%, ' + hi + ')';

		if (pos === 'top') { anchor.style.left = alongX; anchor.style.top = EDGE; }
		else if (pos === 'right') { anchor.style.left = 'calc(100vw - ' + EDGE + ')'; anchor.style.top = alongY; }
		else if (pos === 'left') { anchor.style.left = EDGE; anchor.style.top = alongY; }
		else { anchor.style.left = alongX; anchor.style.top = 'calc(100vh - ' + EDGE + ')'; }

		anchor.classList.toggle('vertical', isVertical);
		anchor.classList.toggle('hide', minimized);
		anchor.classList.toggle('dragging', dragging);

		var slide = '+ 0px';
		if (minimized) {
			if (isVertical) slide = pos === 'right' ? '+ 15px' : '- 15px';
			else slide = pos === 'top' ? '- 15px' : '+ 15px';
		}
		if (isVertical) {
			panel.style.transform = 'translate(calc(-50% ' + slide + '), -50%) rotate(90deg)';
		} else {
			panel.style.transform = 'translate(-50%, calc(-50% ' + slide + '))';
		}

		// Flatten the pill corners that meet the screen edge when minimized.
		var flatTop = minimized && (pos === 'top' || pos === 'right');
		var flatBottom = minimized && (pos === 'bottom' || pos === 'left');
		panel.style.borderTopLeftRadius = flatTop ? '0' : '';
		panel.style.borderTopRightRadius = flatTop ? '0' : '';
		panel.style.borderBottomLeftRadius = flatBottom ? '0' : '';
		panel.style.borderBottomRightRadius = flatBottom ? '0' : '';

		toggleBtn.style.filter = state.open ? '' : 'saturate(0)';
		glow.style.opacity = dragging ? '0.6' : '';
		renderFrame();
	}

	function renderFrame() {
		if (!state.open) { frame.style.display = 'none'; return; }
		frame.style.display = 'block';

		var pos = state.position;
		frame.style.width = 'min(' + state.width + 'vw, calc(100vw - 20px))';
		frame.style.height = 'min(' + state.height + 'vh, calc(100vh - 20px))';
		frame.style.left = frame.style.right = frame.style.top = frame.style.bottom = 'auto';

		if (pos === 'top') { frame.style.left = '50%'; frame.style.top = '10px'; frame.style.transform = 'translateX(-50%)'; }
		else if (pos === 'left') { frame.style.top = '50%'; frame.style.left = '10px'; frame.style.transform = 'translateY(-50%)'; }
		else if (pos === 'right') { frame.style.top = '50%'; frame.style.right = '10px'; frame.style.transform = 'translateY(-50%)'; }
		else { frame.style.left = '50%'; frame.style.bottom = '10px'; frame.style.transform = 'translateX(-50%)'; }

		iframe.style.pointerEvents = (dragging || resizing) ? 'none' : 'auto';

		for (var i = 0; i < handles.length; i++) {
			var hd = handles[i];
			hd.el.style.display = (hd.sides[pos] === true) ? 'none' : 'block';
		}
	}

	function toggleOpen() {
		state.open = !state.open;
		saveState();
		render();
	}

	panel.addEventListener('pointerdown', function (e) {
		if (e.button !== undefined && e.button !== 0) return;
		dragging = true;
		moved = false;
		dragOffset.x = e.clientX - panel.getBoundingClientRect().left - panel.getBoundingClientRect().width / 2;
		dragOffset.y = e.clientY - panel.getBoundingClientRect().top - panel.getBoundingClientRect().height / 2;
		dragStart.x = e.clientX;
		dragStart.y = e.clientY;
	});

	toggleBtn.addEventListener('click', function (e) {
		if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
		toggleOpen();
	});

	window.addEventListener('pointermove', function (e) {
		if (!dragging) return;
		var W = window.innerWidth;
		var H = window.innerHeight;
		var cx = W / 2;
		var cy = H / 2;
		var x = e.clientX - dragOffset.x;
		var y = e.clientY - dragOffset.y;
		if (isNaN(x) || isNaN(y)) return;
		if (!moved && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) <= MOVE_THRESHOLD) return;
		moved = true;

		var deg = Math.atan2(y - cy, x - cx);
		var HM = 70;
		var TL = Math.atan2(0 - cy + HM, 0 - cx);
		var TR = Math.atan2(0 - cy + HM, W - cx);
		var BL = Math.atan2(H - HM - cy, 0 - cx);
		var BR = Math.atan2(H - HM - cy, W - cx);
		state.position = (deg >= TL && deg <= TR) ? 'top'
			: (deg >= TR && deg <= BR) ? 'right'
			: (deg >= BR && deg <= BL) ? 'bottom'
			: 'left';
		state.left = snapToPoints(x / W * 100);
		state.top = snapToPoints(y / H * 100);
		render();
	});

	window.addEventListener('pointerup', function () {
		if (dragging) { dragging = false; saveState(); render(); }
	});
	window.addEventListener('pointerleave', function () {
		if (dragging) { dragging = false; saveState(); render(); }
	});

	function handleResize(e) {
		if (!resizing || !state.open) return;
		if (e.cancelable) e.preventDefault();
		var point = e.touches && e.touches[0] ? e.touches[0] : e;
		var box = iframe.getBoundingClientRect();
		if (resizing.right) {
			state.width = clamp(Math.abs(point.clientX - box.left) / window.innerWidth * 100, PANEL_MIN, PANEL_MAX);
		} else if (resizing.left) {
			state.width = clamp(Math.abs(box.right - point.clientX) / window.innerWidth * 100, PANEL_MIN, PANEL_MAX);
		}
		if (resizing.top) {
			state.height = clamp(Math.abs(box.bottom - point.clientY) / window.innerHeight * 100, PANEL_MIN, PANEL_MAX);
		} else if (resizing.bottom) {
			state.height = clamp(Math.abs(point.clientY - box.top) / window.innerHeight * 100, PANEL_MIN, PANEL_MAX);
		}
		render();
	}
	window.addEventListener('mousemove', handleResize);
	window.addEventListener('touchmove', handleResize, { passive: false });
	function endResize() { if (resizing) { resizing = false; saveState(); render(); } }
	window.addEventListener('mouseup', endResize);
	window.addEventListener('touchend', endResize);

	anchor.addEventListener('mousemove', bringUp);
	window.addEventListener('resize', render);
	window.addEventListener('keydown', function (e) {
		var t = e.target;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
		if (e.shiftKey && e.altKey && (e.code === 'KeyD' || e.key === 'D' || e.key === 'd')) {
			e.preventDefault();
			toggleOpen();
		}
	});

	// Push host-page state (resolved color scheme + current route) into the panel.
	function postToIframe(msg) {
		try {
			if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, location.origin);
		} catch (e) {}
	}
	function detectScheme() {
		var de = document.documentElement;
		if (de.classList.contains('dark')) return 'dark';
		if (de.classList.contains('light')) return 'light';
		var attr = de.getAttribute('data-theme') || de.getAttribute('data-color-mode') || de.getAttribute('data-mode') || '';
		if (attr === 'dark' || attr === 'light') return attr;
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	function sendHostState() {
		postToIframe({
			type: 'sveltekit-devtools:host',
			scheme: detectScheme(),
			route: location.pathname + location.search,
		});
	}
	iframe.addEventListener('load', function () {
		sendHostState();
		setTimeout(sendHostState, 300);
	});
	try {
		new MutationObserver(sendHostState).observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'data-theme', 'data-color-mode', 'data-mode'],
		});
	} catch (e) {}
	if (window.matchMedia) {
		try {
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sendHostState);
		} catch (e) {}
	}
	['pushState', 'replaceState'].forEach(function (name) {
		var orig = history[name];
		if (typeof orig === 'function') {
			history[name] = function () {
				var result = orig.apply(this, arguments);
				sendHostState();
				return result;
			};
		}
	});
	window.addEventListener('popstate', sendHostState);

	// Component inspector: hover highlights the nearest Svelte element, click opens
	// its source. Svelte adds __svelte_meta.loc (file/line/column) to DOM nodes in dev.
	var inspecting = false;
	var inspectBox = document.createElement('div');
	inspectBox.className = 'sk-inspect-box';
	var inspectLabel = document.createElement('div');
	inspectLabel.className = 'sk-inspect-label';
	root.appendChild(inspectBox);
	root.appendChild(inspectLabel);

	function inspectFind(el) {
		while (el && el !== document.body && el !== document.documentElement) {
			if (el.__svelte_meta && el.__svelte_meta.loc) return { el: el, loc: el.__svelte_meta.loc };
			el = el.parentElement;
		}
		return null;
	}
	function inspectTargetAt(x, y) {
		var el = document.elementFromPoint(x, y);
		if (!el || host.contains(el)) return null;
		return inspectFind(el);
	}
	function inspectMove(e) {
		var found = inspectTargetAt(e.clientX, e.clientY);
		if (!found) {
			inspectBox.style.display = 'none';
			inspectLabel.style.display = 'none';
			return;
		}
		var r = found.el.getBoundingClientRect();
		inspectBox.style.display = 'block';
		inspectBox.style.left = r.left + 'px';
		inspectBox.style.top = r.top + 'px';
		inspectBox.style.width = r.width + 'px';
		inspectBox.style.height = r.height + 'px';
		inspectLabel.style.display = 'block';
		inspectLabel.textContent = found.loc.file + ':' + found.loc.line;
		var labelTop = r.top - 22;
		inspectLabel.style.left = r.left + 'px';
		inspectLabel.style.top = (labelTop < 2 ? r.bottom + 4 : labelTop) + 'px';
	}
	function inspectClick(e) {
		e.preventDefault();
		e.stopPropagation();
		var found = inspectTargetAt(e.clientX, e.clientY);
		stopInspect();
		if (found) {
			fetch(BASE + 'api/open-in-editor', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					file: found.loc.file,
					line: found.loc.line,
					column: found.loc.column,
				}),
			}).catch(function () {});
		}
	}
	function inspectKey(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			stopInspect();
		}
	}
	function startInspect() {
		if (inspecting) return;
		inspecting = true;
		inspectBtn.classList.add('active');
		document.addEventListener('mousemove', inspectMove, true);
		document.addEventListener('click', inspectClick, true);
		document.addEventListener('keydown', inspectKey, true);
		document.documentElement.style.cursor = 'crosshair';
	}
	function stopInspect() {
		if (!inspecting) return;
		inspecting = false;
		inspectBtn.classList.remove('active');
		document.removeEventListener('mousemove', inspectMove, true);
		document.removeEventListener('click', inspectClick, true);
		document.removeEventListener('keydown', inspectKey, true);
		document.documentElement.style.cursor = '';
		inspectBox.style.display = 'none';
		inspectLabel.style.display = 'none';
	}
	inspectBtn.addEventListener('click', function (e) {
		e.stopPropagation();
		if (inspecting) stopInspect();
		else startInspect();
	});

	function formatDuration(ms) {
		if (ms < 1000) return [String(Math.round(ms)), 'ms'];
		if (ms < 60000) return [(ms / 1000).toFixed(1), 's'];
		if (ms < 3600000) return [(ms / 60000).toFixed(1), 'min'];
		return [(ms / 3600000).toFixed(1), 'hour'];
	}
	function pageLoadMs() {
		try {
			var nav = performance.getEntriesByType('navigation')[0];
			if (nav && nav.duration > 0) return nav.duration;
			var t = performance.timing;
			if (t && t.loadEventEnd > t.navigationStart) return t.loadEventEnd - t.navigationStart;
		} catch (e) {}
		return -1;
	}
	function updateTime() {
		var ms = pageLoadMs();
		if (ms < 0) { labelMain.textContent = ''; labelSecondary.textContent = '-'; return; }
		var parts = formatDuration(ms);
		labelMain.textContent = parts[0];
		labelSecondary.textContent = parts[1];
	}
	window.addEventListener('load', function () { setTimeout(updateTime, 0); });
	updateTime();

	bringUp();
	render();
}
`;
}
