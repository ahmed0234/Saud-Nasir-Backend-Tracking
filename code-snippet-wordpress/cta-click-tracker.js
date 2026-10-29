/**
 * Clean Master CTA click tracker
 *
 * Sends one request to the tracking backend whenever a visitor clicks:
 *   - a phone link (href="tel:...")             e.g. "(817) 253-2867", "Call Dallas", "Call Us Now"
 *   - a Housecall Pro booking link or widget     e.g. "Book Now", "Book Online Now"
 *   - any element you mark with data-cta="..."   (opt in)
 * Elements marked with data-cta-ignore are never tracked (opt out).
 *
 * It never calls preventDefault() or stopPropagation(), so phone links still open the dialer,
 * booking links still open Housecall Pro, and other click handlers run as before.
 *
 * Install: WPCode → Add Snippet → JavaScript Snippet → paste this file → Location: Site Wide
 * Footer → Active. Debug: add ?cta_debug=1 to any page URL and watch the browser console.
 */
(function () {
	'use strict';

	var ENDPOINT = 'https://fluxpoint-omega.vercel.app/api/cta-click';
	var DEDUPE_MS = 1000;

	// Load once, even if the snippet ends up on the page twice.
	if (window.__cmCtaTracker) return;
	window.__cmCtaTracker = true;

	// Skip the Elementor editor/preview and WordPress admin so editing the site doesn't add clicks.
	var search = window.location.search;
	if (/[?&]elementor-preview=/.test(search) || /\/wp-admin\//.test(window.location.pathname)) {
		return;
	}

	var debug = /[?&]cta_debug=1\b/.test(search);

	function log() {
		if (debug && window.console) {
			console.log.apply(console, ['[CTA tracker]'].concat([].slice.call(arguments)));
		}
	}

	function isHousecallPro(href) {
		try {
			var host = new URL(href, window.location.href).hostname;
			return host === 'housecallpro.com' || /\.housecallpro\.com$/.test(host);
		} catch {
			return false;
		}
	}

	/** Returns { element, type } for a tracked CTA, or null for anything else. */
	function findCta(target) {
		var el = target && target.closest ? target.closest('a, button, [role="button"]') : null;
		if (!el || el.hasAttribute('data-cta-ignore')) return null;

		if (el.hasAttribute('data-cta')) {
			return { element: el, type: el.getAttribute('data-cta') || 'custom' };
		}

		var href = el.getAttribute('href') || '';
		if (/^\s*tel:/i.test(href)) return { element: el, type: 'call' };
		if (href && isHousecallPro(href)) return { element: el, type: 'booking' };

		// Housecall Pro's embeddable "Book online" button opens a modal instead of linking.
		var onclick = el.getAttribute('onclick') || '';
		if (/HCPWidget/.test(onclick) || el.classList.contains('hcp-button')) {
			return { element: el, type: 'booking' };
		}

		return null;
	}

	/**
	 * fetch with keepalive is completed by the browser even if the page navigates away (opening
	 * the dialer or Housecall Pro). A text/plain body keeps it a "simple" CORS request, so there's
	 * no preflight round trip to lose.
	 *
	 * Don't prefer navigator.sendBeacon: browsers report it as a "ping" request, and EasyPrivacy
	 * (on by default in uBlock Origin, AdBlock, AdGuard and Brave) blocks every third-party ping
	 * with `*$ping,third-party`, which shows up as net::ERR_BLOCKED_BY_CLIENT. It's only used
	 * when fetch is unavailable.
	 */
	function send(payload) {
		var body = JSON.stringify(payload);
		if (typeof fetch === 'function') {
			try {
				fetch(ENDPOINT, {
					method: 'POST',
					body: body,
					headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
					keepalive: true,
					mode: 'cors',
					credentials: 'omit'
				}).catch(function () {});
				return 'fetch';
			} catch {
				// fall through to sendBeacon
			}
		}
		try {
			if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return 'sendBeacon';
		} catch {
			// nothing else to try
		}
		return 'not sent';
	}

	var lastElement = null;
	var lastAt = 0;

	function onClick(event) {
		try {
			var cta = findCta(event.target);
			if (!cta) return;

			// Ignore the duplicate events some themes and double-clicks produce.
			var now = Date.now();
			if (cta.element === lastElement && now - lastAt < DEDUPE_MS) return;
			lastElement = cta.element;
			lastAt = now;

			var via = send({ pageUrl: window.location.href, clickedAt: new Date().toISOString() });
			log(cta.type + ' click sent via ' + via, cta.element);
		} catch {
			// Tracking must never break the page.
		}
	}

	// Capture phase: runs before Elementor/theme handlers, so a handler that stops propagation
	// (or returns false, like the chat link) can't hide the click from the tracker.
	document.addEventListener('click', onClick, true);
	// Middle-click opens links in a new tab without firing "click".
	document.addEventListener(
		'auxclick',
		function (event) {
			if (event.button === 1) onClick(event);
		},
		true
	);

	log('ready');
})();
