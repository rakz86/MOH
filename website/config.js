/* ==========================================================================
   config.js — which backend the pages talk to.

   Edit this one file to move between browser storage and the Cloudflare
   Worker. Nothing else in the site needs to change.

     backend   "local"       every browser keeps its own private copy.
                             No server, no network, no sharing.

               "cloudflare"  one shared D1 database behind a Worker.
                             The site still runs from your machine; only
                             the data lives in Cloudflare.

   The token below is NOT a secret once it is in a page — anyone who can
   open this file can read it. It is a gate against casual access, not
   authentication. Before real clinic data goes in, put Cloudflare Access
   in front of the Worker: it is free for up to 50 users and moves the
   login out of the page entirely. See server/README.md.
   ========================================================================== */
window.MOH_CONFIG = {
  backend: 'local',

  // Filled in after `wrangler deploy` prints your Worker URL.
  apiBase: '',                 // e.g. 'https://moh-instruments.<you>.workers.dev'
  apiToken: ''                 // must match API_TOKEN set on the Worker
};
