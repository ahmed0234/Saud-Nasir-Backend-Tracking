/**
 * EMG Air lead tracker (https://www.emgair.com)
 *
 * Records leads for this website in the tracking backend:
 *
 *   Lead actions (eventType "cta_click"), recorded as leads the moment they're clicked:
 *     - phone links (href="tel:...")                     buttonType "call"
 *     - text / email links (sms:, mailto:)               buttonType "sms" / "email"
 *     - Housecall Pro booking links or widget            buttonType "booking"
 *
 *   Form submissions (eventType "form_submit"):
 *     - Elementor Pro forms, Fluent Forms, Contact Form 7, WPForms, Gravity Forms and plain
 *       forms, recorded once when a filled-in form is submitted. Search, login and comment forms
 *       are skipped. Field values are never sent, only the submit button's label and form name.
 *
 * Genuine CTAs that lead to a form ("Get a Quote", "Book Now" → contact page, "Request A Bid")
 * aren't leads by themselves. The tracker remembers the last one clicked (for 30 minutes, across
 * pages and tabs) and credits the form submission it leads to, so the dashboard can show which
 * CTA, and whether it was in the header, produced the lead. A CTA is:
 *     - a lead action above, anywhere on the page, or
 *     - something styled as a button (Elementor and theme buttons, .btn / .button / .cta / .pill
 *       classes, <button>) that goes to a lead page (contact, quote, estimate, book, schedule,
 *       appointment, consultation, request, bid) or whose label asks for a lead ("Get a Quote",
 *       "Free Estimate", "Book Now", "Contact Us" ...).
 *   Plain menu and text links ("About Us", "Services", a menu's "Contact Us") and buttons like
 *   "Learn More", "About Us", "Apply Now" or "Read Reviews" are ignored.
 *
 * Placement: a CTA in the site header, the top bar or a mobile slide-out menu is "header"; in the
 * footer "footer"; anywhere else "page". Header leads get a green "Header CTA" badge.
 *
 * Campaigns: utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, gbraid, wbraid
 * and fbclid are read from the landing page URL, kept in this browser for 90 days (a newer
 * campaign visit replaces them) and attached to every lead.
 *
 * Overrides (Elementor → Advanced → CSS Classes, on the widget or the link):
 *     lead-cta       always treat as a CTA        no-lead-cta     never track
 *     header-cta     always treat as a CTA and count it as a header CTA, wherever it is
 * The older data-cta / data-cta-ignore / data-cta-placement="header" attributes also work.
 *
 * It never calls preventDefault() or stopPropagation(), so links, phone calls and forms work
 * exactly as before. Tracking errors are swallowed and never break the page.
 *
 * Install (WordPress): WPCode → Add Snippet → JavaScript Snippet → paste this whole file →
 * Location: Site Wide Footer → Active. Deactivate any older CTA tracker snippet. Exclude it from
 * "delay JavaScript" in WP Rocket / LiteSpeed and clear caches after updating.
 * Debug: add ?cta_debug=1 to any page URL and watch the browser console.
 *
 * The three site snippets are identical except for SITE and this header.
 */
(function () {
	'use strict';

	// This website's identifier in the tracking backend. Don't change it.
	var SITE = 'emg-air';
	var ENDPOINT = 'https://fluxpoint-omega.vercel.app/api/cta-click';
	var FORM_DEDUPE_MS = 3000;
	// One lead per call/text/email/booking action: double taps, a sticky header's second copy of
	// the same phone link and click + middle-click all land in this window.
	var ACTION_DEDUPE_MS = 10000;
	var SOURCE_TTL_MS = 30 * 60 * 1000;
	var CAMPAIGN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
	var MAX_TEXT = 120;
	var MAX_CAMPAIGN_VALUE = 255;
	// Labels longer than this are content (FAQ questions, cards), not CTA buttons.
	var MAX_CTA_LABEL = 40;
	var STORAGE_PREFIX = 'leadTracker:';

	// Load once, even if the snippet ends up on the page twice (e.g. WPCode and Tag Manager).
	// Older tracker versions use the same flag, so an old and a new copy never both send.
	if (window.__cmCtaTracker) return;
	window.__cmCtaTracker = true;

	// Skip the Elementor editor/preview and WordPress admin so editing the site doesn't add leads.
	var search = window.location.search;
	if (/[?&]elementor-preview=/.test(search) || /\/wp-admin\//.test(window.location.pathname)) {
		return;
	}

	var debug = /[?&]cta_debug=1\b/.test(search);

	// ---------------------------------------------------------------------------------------------
	// What counts as a CTA
	// ---------------------------------------------------------------------------------------------

	// Elementor and Elementor add-on button widgets.
	var ELEMENTOR_BUTTON_SELECTOR = [
		'.elementor-button',
		'.elementor-cta__button',
		'.elementor-price-table__button',
		'.elementor-flip-box__button',
		'.elementor-slide-button',
		'.elementskit-btn',
		'.eael-creative-button',
		'.premium-button',
		'.wpr-button',
		'.wp-block-button__link',
		'.wp-element-button'
	].join(',');
	// Theme and hand-written buttons: a class word such as btn, btn-primary, psg-btn, button,
	// cta or contact-pill.
	var BUTTON_CLASS = /(^|[\s_-])(btn|button|cta|pill)([\s_-]|$)/i;
	var OPT_IN_SELECTOR = '.lead-cta, .header-cta, [data-cta]';
	var CLICKABLE_SELECTOR =
		'a, button, input[type="submit"], input[type="image"], [role="button"], ' +
		OPT_IN_SELECTOR +
		', ' +
		ELEMENTOR_BUTTON_SELECTOR;
	var OPT_OUT_SELECTOR = '.no-lead-cta, [data-cta-ignore]';

	// Pages and anchors whose purpose is getting a lead (matched on the path and #hash).
	var LEAD_DESTINATION =
		/(^|[/#._-])(contact|quote|estimate|book|booking|schedule|appointment|consult|consultation|request|bid|get-started|free-inspection)([/#._-]|$)/i;
	// Button labels that ask for a lead.
	var LEAD_LABEL =
		/\b(quote|estimate|book|schedule|appointment|consult|consultation|request|bid|get started|call|contact|inspection|reserve|hire)\b/i;
	// Button labels that never mean "give us your details", even when they link to the contact page.
	var NOT_LEAD_LABEL =
		/\b(learn|read|about|explore|view|see|more info|details|apply|join|career|careers|job|jobs|review|reviews|blog|login|log in|sign in|menu|close|next|previous|back)\b/i;

	// ---------------------------------------------------------------------------------------------
	// Where on the page
	// ---------------------------------------------------------------------------------------------

	var HEADER_SELECTOR = [
		'header',
		'[role="banner"]',
		'[data-elementor-type="header"]',
		'.elementor-location-header',
		'#masthead',
		'.site-header',
		'#site-header',
		'.topbar',
		'.top-bar',
		'.header-cta'
	].join(',');
	// Mobile slide-out / off-canvas menus, which themes often render outside the header element.
	var MOBILE_MENU_SELECTOR = [
		'.elementor-nav-menu--dropdown',
		'#ast-mobile-popup',
		'.ast-mobile-popup-drawer',
		'.ast-mobile-header-wrap',
		'.ekit-sidebar-group',
		'.elementskit-menu-container',
		'.wpr-mobile-nav-menu',
		'.hfe-nav-menu',
		'.mobile-menu',
		'.mobile-nav',
		'#mobile-menu',
		'.offcanvas',
		'.off-canvas',
		'.sidr',
		'.slideout-menu'
	].join(',');
	var POPUP_SELECTOR =
		'[data-elementor-type="popup"], .elementor-location-popup, [role="dialog"], [aria-modal="true"]';
	var FOOTER_SELECTOR =
		'footer, [role="contentinfo"], [data-elementor-type="footer"], .elementor-location-footer, ' +
		'.site-footer, #colophon';

	// Forms that are not lead forms.
	var IGNORED_FORM_SELECTOR =
		'[data-cta-ignore], .no-lead-cta, [role="search"], .search-form, .elementor-search-form, ' +
		'#commentform, .comment-form, #loginform, .post-password-form, .woocommerce-cart-form, ' +
		'.woocommerce-checkout';

	var CAMPAIGN_PARAMS = [
		['utm_source', 'utmSource'],
		['utm_medium', 'utmMedium'],
		['utm_campaign', 'utmCampaign'],
		['utm_term', 'utmTerm'],
		['utm_content', 'utmContent'],
		['gclid', 'gclid'],
		['gbraid', 'gbraid'],
		['wbraid', 'wbraid'],
		['fbclid', 'fbclid']
	];

	function log() {
		if (debug && window.console) {
			console.log.apply(console, ['[CTA tracker]'].concat([].slice.call(arguments)));
		}
	}

	function decodeSafe(value) {
		try {
			return decodeURIComponent(value);
		} catch (_error) {
			return value;
		}
	}

	function cleanText(value) {
		return String(value || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, MAX_TEXT);
	}

	/**
	 * The element's text with its text nodes space-separated, so "<span>Call now</span><span>817…"
	 * reads "Call now 817…". (innerText would also apply CSS uppercase.)
	 */
	function textOf(el) {
		var parts = [];
		var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
		return parts.join(' ');
	}

	/** The visible label of a button or link. */
	function labelOf(el) {
		if (!el) return '';
		var text = cleanText(el.tagName === 'INPUT' ? el.getAttribute('value') : textOf(el));
		return text || cleanText(el.getAttribute('aria-label') || el.getAttribute('title'));
	}

	// ---------------------------------------------------------------------------------------------
	// Storage: localStorage is shared by every page and tab of this website, so attribution
	// survives navigation and links opened in a new tab. Falls back to memory when it's blocked
	// (some private browsing modes).
	// ---------------------------------------------------------------------------------------------

	var memoryStore = {};

	function readStored(key) {
		try {
			var raw = window.localStorage.getItem(STORAGE_PREFIX + key);
			return raw ? JSON.parse(raw) : null;
		} catch (_error) {
			return memoryStore[key] || null;
		}
	}

	function writeStored(key, value) {
		memoryStore[key] = value;
		try {
			window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
		} catch (_error) {
			// Memory only.
		}
	}

	function isFresh(entry, ttl) {
		var age = entry && typeof entry.at === 'number' ? Date.now() - entry.at : NaN;
		return age >= -60000 && age <= ttl;
	}

	/** Saves this page's campaign parameters, if it has any; a newer campaign visit replaces older ones. */
	function captureCampaign() {
		var params;
		try {
			params = new URLSearchParams(search);
		} catch (_error) {
			return;
		}
		var campaign = null;
		for (var i = 0; i < CAMPAIGN_PARAMS.length; i++) {
			var value = (params.get(CAMPAIGN_PARAMS[i][0]) || '').trim();
			if (value) {
				campaign = campaign || {};
				campaign[CAMPAIGN_PARAMS[i][1]] = value.slice(0, MAX_CAMPAIGN_VALUE);
			}
		}
		if (campaign) {
			campaign.at = Date.now();
			writeStored('campaign', campaign);
			log('campaign saved', campaign);
		}
	}

	function currentCampaign() {
		var stored = readStored('campaign');
		if (!isFresh(stored, CAMPAIGN_TTL_MS)) return null;
		var campaign = {};
		for (var i = 0; i < CAMPAIGN_PARAMS.length; i++) {
			var key = CAMPAIGN_PARAMS[i][1];
			if (typeof stored[key] === 'string' && stored[key]) campaign[key] = stored[key];
		}
		return campaign;
	}

	function rememberCta(cta) {
		writeStored('cta', {
			type: cta.type,
			text: cta.text,
			placement: cta.placement,
			pageUrl: window.location.href,
			at: Date.now()
		});
	}

	/** The most recent CTA clicked on this website in the last 30 minutes, if any. */
	function currentSourceCta() {
		var stored = readStored('cta');
		if (!isFresh(stored, SOURCE_TTL_MS)) return null;
		return {
			type: stored.type,
			text: stored.text,
			placement: stored.placement,
			pageUrl: stored.pageUrl,
			clickedAt: new Date(stored.at).toISOString()
		};
	}

	// ---------------------------------------------------------------------------------------------
	// Classification
	// ---------------------------------------------------------------------------------------------

	function isHousecallPro(url) {
		var host = url.hostname;
		return host === 'housecallpro.com' || /\.housecallpro\.com$/.test(host);
	}

	function parseUrl(href) {
		try {
			return new URL(href, window.location.href);
		} catch (_error) {
			return null;
		}
	}

	function sameSite(url) {
		var strip = function (host) {
			return host.replace(/^www\./, '').toLowerCase();
		};
		return strip(url.hostname) === strip(window.location.hostname);
	}

	/** Lead action (recorded as a lead on click), or null. */
	function leadAction(el) {
		var href = (el.getAttribute('href') || '').trim();
		if (/^tel:/i.test(href)) return 'call';
		if (/^sms(to)?:/i.test(href)) return 'sms';
		if (/^mailto:/i.test(href)) return 'email';
		var url = href && parseUrl(href);
		if (url && isHousecallPro(url)) return 'booking';
		// Housecall Pro's embeddable "Book online" button opens a modal instead of linking.
		if (/HCPWidget/.test(el.getAttribute('onclick') || '') || el.classList.contains('hcp-button')) {
			return 'booking';
		}
		return null;
	}

	function looksLikeButton(el) {
		if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') return true;
		if (el.matches(ELEMENTOR_BUTTON_SELECTOR)) return true;
		return BUTTON_CLASS.test(el.getAttribute('class') || '');
	}

	/** True when a link goes to a lead page or a lead anchor (#quote) on this website. */
	function isLeadDestination(href) {
		var url = href && parseUrl(href);
		if (!url || !/^https?:$/.test(url.protocol) || !sameSite(url)) return false;
		var samePage = url.pathname === window.location.pathname;
		// An anchor on this page only counts by its #hash; otherwise every button on the contact
		// page would look like a lead link.
		return LEAD_DESTINATION.test(samePage ? url.hash : url.pathname + url.hash);
	}

	/**
	 * Describes a clicked element as { type, text, isLead } if it is a genuine CTA, else null.
	 * isLead: true for lead actions (call, text, email, booking), which are leads by themselves.
	 */
	function describeCta(el) {
		if (el.closest(OPT_OUT_SELECTOR)) return null;
		var text = labelOf(el);

		var action = leadAction(el);
		if (action) {
			// Icon-only phone/email links have no label; use the number or address instead.
			var fallback = (el.getAttribute('href') || '').replace(/^[a-z]+:(\/\/)?/i, '');
			return { type: action, text: text || cleanText(decodeSafe(fallback)), isLead: true };
		}

		var optIn = el.closest(OPT_IN_SELECTOR);
		if (optIn) {
			var name = (optIn.getAttribute('data-cta') || 'button').toLowerCase();
			return {
				type: name.replace(/[^a-z0-9_-]+/g, '_').slice(0, 40) || 'button',
				text: text,
				isLead: false
			};
		}

		// Buttons inside a form (submit, multi-step "Next") are part of the form.
		if (el.closest('form') || !looksLikeButton(el)) return null;
		if (!text || text.length > MAX_CTA_LABEL || NOT_LEAD_LABEL.test(text)) return null;
		if (isLeadDestination(el.getAttribute('href')) || LEAD_LABEL.test(text)) {
			return { type: 'button', text: text, isLead: false };
		}
		return null;
	}

	function isNearTop(el) {
		var style = window.getComputedStyle(el);
		if (style.position === 'fixed' || style.position === 'sticky') return true;
		return el.getBoundingClientRect().top + window.scrollY < 400;
	}

	/** 'header' (incl. top bars and mobile menus), 'footer' or 'page'. */
	function placementOf(el) {
		var forced = el.closest('[data-cta-placement]');
		if (forced) {
			var value = (forced.getAttribute('data-cta-placement') || '').toLowerCase();
			if (value === 'header' || value === 'footer' || value === 'page') return value;
		}
		if (el.closest(HEADER_SELECTOR) || el.closest(MOBILE_MENU_SELECTOR)) return 'header';
		// A popup that holds a navigation menu is a mobile slide-out menu.
		var popup = el.closest(POPUP_SELECTOR);
		if (popup && popup.querySelector('nav, .elementor-nav-menu, .menu')) return 'header';
		if (el.closest(FOOTER_SELECTOR)) return 'footer';
		// Hand-written sites (like a static homepage) may use a bare <nav> as their header.
		var nav = el.closest('nav');
		if (nav && !nav.closest('main, article, aside') && isNearTop(nav)) return 'header';
		return 'page';
	}

	// ---------------------------------------------------------------------------------------------
	// Forms
	// ---------------------------------------------------------------------------------------------

	/** The form a submit control submits, or null for anything else. */
	function submittedForm(el) {
		var type = (el.getAttribute('type') || '').toLowerCase();
		var isSubmit =
			el.tagName === 'BUTTON'
				? type === '' || type === 'submit'
				: el.tagName === 'INPUT' && (type === 'submit' || type === 'image');
		return isSubmit ? el.form || el.closest('form') : null;
	}

	function formType(form) {
		var id = form.getAttribute('id') || '';
		if (form.classList.contains('elementor-form')) return 'elementor_form';
		if (form.classList.contains('frm-fluent-form') || /^fluentform_/.test(id)) return 'fluent_form';
		if (form.classList.contains('wpcf7-form')) return 'cf7_form';
		if (form.classList.contains('wpforms-form')) return 'wpforms_form';
		if (/^gform_\d+$/.test(id)) return 'gravity_form';
		return 'form';
	}

	function formName(form) {
		// getAttribute, not form.name / form.id: a field named "name" or "id" would shadow those.
		var name =
			form.getAttribute('aria-label') ||
			form.getAttribute('name') ||
			form.getAttribute('data-form-name');
		if (name) return cleanText(name);
		var fluentId = form.getAttribute('data-form_id');
		if (fluentId) return 'Fluent form #' + fluentId;
		return cleanText(form.getAttribute('id'));
	}

	function isLeadForm(form) {
		return !form.matches(IGNORED_FORM_SELECTOR) && !form.querySelector('input[name="s"]');
	}

	function isVisible(el) {
		return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
	}

	/** An empty field the form plugin marks as required without the HTML attribute. */
	function isMissingAriaRequired(form, field) {
		if (field.getAttribute('aria-required') !== 'true' || field.disabled) return false;
		// Fields hidden by the plugin's conditional logic can't be filled in, so they don't count.
		if (!isVisible(field)) return false;
		if (field.type === 'checkbox' || field.type === 'radio') {
			var group = form.elements.namedItem(field.name);
			var options = group && group.length !== undefined ? group : [field];
			for (var i = 0; i < options.length; i++) if (options[i].checked) return false;
			return true;
		}
		return !String(field.value || '').trim();
	}

	/**
	 * True when every field passes its HTML constraints (required, type="email", ...) and every
	 * aria-required field (how Fluent Forms, Contact Form 7 and Gravity Forms mark required fields)
	 * has a value, so empty or invalid attempts aren't recorded. Reads validity directly, so no
	 * "invalid" events fire and the form's own error UI isn't triggered.
	 */
	function isFilledIn(form) {
		var fields = form.elements;
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i];
			if (field.willValidate && field.validity && !field.validity.valid) return false;
			if (isMissingAriaRequired(form, field)) return false;
		}
		return true;
	}

	// ---------------------------------------------------------------------------------------------
	// Sending
	// ---------------------------------------------------------------------------------------------

	/**
	 * fetch with keepalive is completed by the browser even if the page navigates away (opening
	 * the dialer, a form redirect). A text/plain body keeps it a "simple" CORS request, so there's
	 * no preflight round trip to lose.
	 *
	 * Don't prefer navigator.sendBeacon: browsers report it as a "ping" request, and EasyPrivacy
	 * (on by default in uBlock Origin, AdBlock, AdGuard and Brave) blocks every third-party ping
	 * with `*$ping,third-party`, which shows up as net::ERR_BLOCKED_BY_CLIENT. It's only used
	 * when fetch is unavailable.
	 */
	function send(details) {
		var payload = {
			site: SITE,
			pageUrl: window.location.href,
			clickedAt: new Date().toISOString()
		};
		for (var key in details) {
			if (details[key]) payload[key] = details[key];
		}
		var campaign = currentCampaign();
		if (campaign) payload.attribution = campaign;
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
			} catch (_error) {
				// fall through to sendBeacon
			}
		}
		try {
			if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return 'sendBeacon';
		} catch (_error) {
			// nothing else to try
		}
		return 'not sent';
	}

	// One record per form submission: double clicks, a click plus the submit event, and plugins
	// that resubmit all land inside the dedupe window.
	var formSentAt = new WeakMap();

	function recordFormSubmit(form, submitter) {
		if (!isLeadForm(form) || !isFilledIn(form)) return;

		var now = Date.now();
		if (now - (formSentAt.get(form) || 0) < FORM_DEDUPE_MS) return;
		formSentAt.set(form, now);

		var buttonType = formType(form);
		var source = currentSourceCta();
		var via = send({
			eventType: 'form_submit',
			buttonType: buttonType,
			buttonText: labelOf(submitter || form.querySelector('[type="submit"]')),
			formName: formName(form),
			source: source
		});
		log(
			buttonType + ' submission sent via ' + via,
			source ? 'credited to' : '',
			source || '',
			form
		);
	}

	// When each lead action (type + destination) was last recorded.
	var actionSentAt = {};

	/** "tel:%20(817) 646-0999" and "tel:8176460999" are the same action. */
	function actionTarget(value) {
		return decodeSafe(String(value))
			.replace(/[\s().-]/g, '')
			.toLowerCase();
	}

	function onClick(event) {
		try {
			var target = event.target;
			if (target && target.nodeType !== 1) target = target.parentElement;
			var el = target && target.closest ? target.closest(CLICKABLE_SELECTOR) : null;
			if (!el) return;

			var form = submittedForm(el);
			if (form) {
				// A middle-click doesn't submit anything.
				if (event.type !== 'click') return;
				// A valid form fires "submit" right after this click and is recorded there. Some form
				// plugins cancel the click and send the form with AJAX instead, so check again once
				// the click has finished; the dedupe window makes this a no-op if "submit" fired.
				setTimeout(function () {
					try {
						recordFormSubmit(form, el);
					} catch (_error) {
						// Tracking must never break the page.
					}
				}, 0);
				return;
			}

			var cta = describeCta(el);
			if (!cta) return;
			cta.placement = placementOf(el);
			// Every genuine CTA becomes the source a later form submission is credited to.
			rememberCta(cta);

			if (!cta.isLead) {
				log(cta.placement + ' CTA remembered for attribution: "' + cta.text + '"', el);
				return;
			}

			var key = cta.type + '|' + actionTarget(el.getAttribute('href') || cta.text);
			var now = Date.now();
			if (now - (actionSentAt[key] || 0) < ACTION_DEDUPE_MS) return;
			actionSentAt[key] = now;

			var via = send({
				eventType: 'cta_click',
				buttonType: cta.type,
				buttonText: cta.text,
				placement: cta.placement
			});
			log(cta.placement + ' ' + cta.type + ' lead sent via ' + via, el);
		} catch (_error) {
			// Tracking must never break the page.
		}
	}

	function onSubmit(event) {
		try {
			var form = event.target;
			if (form && form.tagName === 'FORM') recordFormSubmit(form, event.submitter);
		} catch (_error) {
			// Tracking must never break the page.
		}
	}

	try {
		captureCampaign();
	} catch (_error) {
		// Tracking must never break the page.
	}

	// Capture phase: runs before Elementor/theme/form-plugin handlers, so a handler that stops
	// propagation (or returns false) can't hide the click from the tracker. Taps on phones and
	// tablets fire "click" too.
	document.addEventListener('click', onClick, true);
	document.addEventListener('submit', onSubmit, true);
	// Middle-click opens links in a new tab without firing "click".
	document.addEventListener(
		'auxclick',
		function (event) {
			if (event.button === 1) onClick(event);
		},
		true
	);

	log('ready (' + SITE + ')');
})();
