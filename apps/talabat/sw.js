/* sw.js — Forwarding Worker.
 * PWA offline caching lives inside firebase-messaging-sw.js.
 * This file delegates directly to ensure legacy client registrations seamlessly upgrade.
 */
importScripts('./firebase-messaging-sw.js');
