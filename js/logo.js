/**
 * The UVY mark.
 *
 * index.html carries its own copy of this inline for the splash screen — that
 * one has to be in the HTML itself so the loading screen paints on the very
 * first frame, before any module has loaded. If you redraw the logo, change it
 * in both places.
 */
export const UVY_LOGO = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="UVY">
  <ellipse cx="252" cy="500" rx="66" ry="108" fill="#16161a"/>
  <ellipse cx="772" cy="500" rx="66" ry="108" fill="#16161a"/>
  <circle cx="512" cy="514" r="248" fill="#16161a"/>
  <path d="M272 226 L380 334 C425 288 465 270 512 270 C559 270 599 288 644 334
           L752 226 L748 506 C748 642 641 730 512 730 C383 730 276 642 276 506 Z"
        fill="#FFD91C" stroke="#16161a" stroke-width="26" stroke-linejoin="round"/>
  <path d="M366 406 L366 462 C366 518 460 518 460 462 L460 406"
        fill="none" stroke="#16161a" stroke-width="21" stroke-linecap="round"/>
  <path d="M566 406 L614 514 L662 406"
        fill="none" stroke="#16161a" stroke-width="21"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M400 590 C438 666 586 666 624 590"
        fill="none" stroke="#16161a" stroke-width="22" stroke-linecap="round"/>
</svg>`;
