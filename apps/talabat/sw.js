/* sw.js — Forwarding Worker.
 * PWA offline caching lives inside sw-cache.js.
 * This file delegates directly to ensure legacy client registrations seamlessly upgrade.
 */
importScripts('./sw-cache.js');
