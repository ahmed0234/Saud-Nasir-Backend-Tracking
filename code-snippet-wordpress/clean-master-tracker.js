/**
 * Clean Master lead tracker (https://www.cleanmastercarpetcleaning.com)
 *
 * Sends one request to the tracking backend for every lead action on this website:
 *
 *   CTA clicks (eventType "cta_click")
 *     - phone links (href="tel:...")                     buttonType "call"
 *     - text / email links (sms:, mailto:)               buttonType "sms" / "email"
 *     - Housecall Pro booking links or widget            buttonType "booking"
 *     - Elementor buttons (Button, Call to Action, Price Table, Flip Box, Slides widgets, plus
 *       ElementsKit, Essential Addons, Premium Addons and Royal Addons buttons)   "button"
 *     - any element you mark with data-cta="name"        buttonType "name" (opt in)
 *
 *   Form submissions (eventType "form_submit")
 *     - Elementor Pro forms, Fluent Forms, Contact Form 7, WPForms, Gravity Forms and plain
 *       forms, recorded once when a filled-in form is submitted (submit button click, Enter key
 *       or the mobile keyboard's "Go"). Search, login and comment forms are skipped. Field values
 *       are never sent, only the submit button's label and the form's name.
 *
 * Elements or forms marked with data-cta-ignore are never tracked (opt out).
 *
 * It never calls preventDefault() or stopPropagation(), so phone links still open the dialer,
 * forms still submit and other click handlers run as before.
 *
 * Install: WPCode → Add Snippet → JavaScript Snippet → paste this file → Location: Site Wide
 * Footer → Active. Replace (deactivate) any older CTA tracker snippet on this site. Exclude it
 * from "delay JavaScript" in WP Rocket / LiteSpeed and clear caches after updating.
 * Debug: add ?cta_debug=1 to any page URL and watch the browser console.
 *
 * The three site snippets are identical except for SITE and this header.
 */
(function () {
	'use strict';

	// This website's identifier in the tracking backend. Don't change it.
	var SITE = 'clean-master';
	var ENDPOINT = 'https://fluxpoint-omega.vercel.app/api/cta-click';
	var DEDUPE_MS = 1000;
	var FORM_DEDUPE_MS = 3000;
	var MAX_TEXT = 120;

	// Load once, even if the snippet ends up on the page twice. Older tracker versions use the
	// same flag, so an old and a new copy on one page never both send.
	if (window.__cmCtaTracker) return;
	window.__cmCtaTracker = true;

	// Skip the Elementor editor/preview and WordPress admin so editing the site doesn't add leads.
	var search = window.location.search;
	if (/[?&]elementor-preview=/.test(search) || /\/wp-admin\//.test(window.location.pathname)) {
		return;
	}

	var debug = /[?&]cta_debug=1\b/.test(search);

	// Elementor and Elementor add-on button widgets. Most Elementor widgets render their button as
	// a.elementor-button; the rest are listed so each widget type is covered.
	var BUTTON_SELECTOR = [
		'.elementor-button',
		'.elementor-cta__button',
		'.elementor-price-table__button',
		'.elementor-flip-box__button',
		'.elementor-slide-button',
		'.elementskit-btn',
		'.eael-creative-button',
		'.premium-button',
		'.wpr-button'
	].join(',');
	var CLICKABLE_SELECTOR =
		'a, button, input[type="submit"], input[type="image"], [role="button"], [data-cta], ' +
		BUTTON_SELECTOR;
	// Forms that are not lead forms.
	var IGNORED_FORM_SELECTOR =
		'[data-cta-ignore], [role="search"], .search-form, .elementor-search-form, #commentform, ' +
		'.comment-form, #loginform, .post-password-form, .woocommerce-cart-form, .woocommerce-checkout';

	function log() {
		if (debug && window.console) {
			console.log.apply(console, ['[CTA tracker]'].concat([].slice.call(arguments)));
		}
	}

	function cleanText(value) {
		return String(value || '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, MAX_TEXT);
	}

	/** The visible label of a button or link. */
	function labelOf(el) {
		if (!el) return '';
		var text = cleanText(el.tagName === 'INPUT' ? el.getAttribute('value') : el.textContent);
		return text || cleanText(el.getAttribute('aria-label') || el.getAttribute('title'));
	}

	function isHousecallPro(href) {
		try {
			var host = new URL(href, window.location.href).hostname;
			return host === 'housecallpro.com' || /\.housecallpro\.com$/.test(host);
		} catch {
			return false;
		}
	}

	/** The form a submit control submits, or null for anything else. */
	function submittedForm(el) {
		var type = (el.getAttribute('type') || '').toLowerCase();
		var isSubmit =
			el.tagName === 'BUTTON'
				? type === '' || type === 'submit'
				: el.tagName === 'INPUT' && (type === 'submit' || type === 'image');
		return isSubmit ? el.form || el.closest('form') : null;
	}

	/** CTA button type for a clicked element, or null if it isn't a tracked CTA. */
	function ctaType(el) {
		if (el.hasAttribute('data-cta')) {
			var custom = (el.getAttribute('data-cta') || 'custom').toLowerCase();
			return custom.replace(/[^a-z0-9_-]+/g, '_').slice(0, 40) || 'custom';
		}

		var href = el.getAttribute('href') || '';
		if (/^\s*tel:/i.test(href)) return 'call';
		if (/^\s*sms(to)?:/i.test(href)) return 'sms';
		if (/^\s*mailto:/i.test(href)) return 'email';
		if (href && isHousecallPro(href)) return 'booking';

		// Housecall Pro's embeddable "Book online" button opens a modal instead of linking.
		var onclick = el.getAttribute('onclick') || '';
		if (/HCPWidget/.test(onclick) || el.classList.contains('hcp-button')) return 'booking';

		// Buttons inside a form (multi-step "Next"/"Previous") are part of the form, not CTAs.
		if (el.matches(BUTTON_SELECTOR) && !el.closest('form')) return 'button';

		return null;
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

	// One record per form submission: double clicks, a click plus the submit event, and plugins
	// that resubmit all land inside the dedupe window.
	var formSentAt = new WeakMap();

	function recordFormSubmit(form, submitter) {
		if (!isLeadForm(form) || !isFilledIn(form)) return;

		var now = Date.now();
		if (now - (formSentAt.get(form) || 0) < FORM_DEDUPE_MS) return;
		formSentAt.set(form, now);

		var buttonType = formType(form);
		var via = send({
			eventType: 'form_submit',
			buttonType: buttonType,
			buttonText: labelOf(submitter || form.querySelector('[type="submit"]')),
			formName: formName(form)
		});
		log(buttonType + ' submission sent via ' + via, form);
	}

	var lastElement = null;
	var lastAt = 0;

	function onClick(event) {
		try {
			var target = event.target;
			if (target && target.nodeType !== 1) target = target.parentElement;
			var el = target && target.closest ? target.closest(CLICKABLE_SELECTOR) : null;
			if (!el || el.closest('[data-cta-ignore]')) return;

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
					} catch {
						// Tracking must never break the page.
					}
				}, 0);
				return;
			}

			var buttonType = ctaType(el);
			if (!buttonType) return;

			// Ignore the duplicate events some themes and double-clicks produce.
			var now = Date.now();
			if (el === lastElement && now - lastAt < DEDUPE_MS) return;
			lastElement = el;
			lastAt = now;

			var via = send({ eventType: 'cta_click', buttonType: buttonType, buttonText: labelOf(el) });
			log(buttonType + ' click sent via ' + via, el);
		} catch {
			// Tracking must never break the page.
		}
	}

	function onSubmit(event) {
		try {
			var form = event.target;
			if (form && form.tagName === 'FORM') recordFormSubmit(form, event.submitter);
		} catch {
			// Tracking must never break the page.
		}
	}

	// Capture phase: runs before Elementor/theme/form-plugin handlers, so a handler that stops
	// propagation (or returns false, like the chat link) can't hide the click from the tracker.
	// Taps on phones and tablets fire "click" too.
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
