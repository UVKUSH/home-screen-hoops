// The home screen, page by page. Each page holds up to 20 (4 across, 5 down).
// The dock is shared across every page, exactly like a real phone.
export const PAGES = [
  [
    { id: 'facetime',  name: 'FaceTime'  },
    { id: 'calendar',  name: 'Calendar'  },
    { id: 'photos',    name: 'Photos'    },
    { id: 'camera',    name: 'Camera'    },
    { id: 'mail',      name: 'Mail'      },
    { id: 'notes',     name: 'Notes'     },
    { id: 'reminders', name: 'Reminders' },
    { id: 'clock',     name: 'Clock'     },
    { id: 'tv',        name: 'TV'        },
    { id: 'podcasts',  name: 'Podcasts'  },
    { id: 'weather',   name: 'Weather'   },
    { id: 'maps',      name: 'Maps'      },
    { id: 'home',      name: 'Home'      },
    { id: 'health',    name: 'Health'    },
    { id: 'wallet',    name: 'Wallet'    },
    { id: 'settings',  name: 'Settings'  },
    { id: 'files',     name: 'Files'     },
    { id: 'contacts',  name: 'Contacts'  },
    // these two also appear on page 2 on purpose — same icon, both pages
    { id: 'silloa',    name: 'Silloa'    },
    { id: 'uvy',       name: 'Uvy'       },
  ],
  [
    { id: 'appstore',   name: 'App Store'   },
    { id: 'chrome',     name: 'Chrome'      },
    { id: 'news',       name: 'News'        },
    { id: 'stocks',     name: 'Stocks'      },
    { id: 'calculator', name: 'Calculator'  },
    { id: 'compass',    name: 'Compass'     },
    { id: 'watch',      name: 'Watch'       },
    { id: 'shazam',     name: 'Shazam'      },
    { id: 'garageband', name: 'GarageBand'  },
    { id: 'imovie',     name: 'iMovie'      },
    { id: 'moviemaker', name: 'Movie Maker' },
    { id: 'voicememos', name: 'Voice Memos' },
    { id: 'pinterest',  name: 'Pinterest'   },
    { id: 'apple',      name: 'Apple'       },
    { id: 'silloa',     name: 'Silloa'      },
    { id: 'uvy',        name: 'Uvy'         },
  ],
];

export const DOCK = [
  { id: 'phone',    name: 'Phone'    },
  { id: 'safari',   name: 'Safari'   },
  { id: 'messages', name: 'Messages' },
  { id: 'music',    name: 'Music'    },
];
