console.log("YT Music Controller injected and running.");

const YT_STATE = {
  title: '',
  artist: '',
  cover: '',
  playing: false,
  currentTime: 0, // seconds
  duration: 0, // seconds
  liked: false,
  disliked: false
};

let coverObserverAttached = false;

function clickButton(selector) {
  const btn = document.querySelector(selector);
  if (btn) btn.click();
}


function parseTimeToSeconds(t) {
  if (!t) return 0;
  const parts = t.split(':').map(p => parseFloat(p));
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0] || 0;
}

function findCover() {
  // шукаємо обкладенку
  const candidates = [
    document.querySelector('#song-media-window img'),
    document.querySelector('#song-media-window yt-img-shadow img'),
    document.querySelector('ytmusic-player img'),
    document.querySelector('.ytmusic-player-bar img')
  ];

  for (const el of candidates) {
    if (el && el.src && el.src.startsWith('http') && !el.src.includes('data:')) {
      return el.src;
    }
  }
  return '';
}

function syncFromDOM(bar) {
  try {
    const titleEl = bar?.querySelector('.title.ytmusic-player-bar');
    const artistEl = bar?.querySelector('.byline.ytmusic-player-bar');
    
    if (titleEl) YT_STATE.title = titleEl.textContent || '';
    if (artistEl) YT_STATE.artist = artistEl.textContent || '';
    
    YT_STATE.cover = findCover();

    const likeButtonRenderer = bar?.querySelector('ytmusic-like-button-renderer');
    const likeStatus = likeButtonRenderer?.getAttribute('like-status');
    
    YT_STATE.liked = likeStatus === 'LIKE';
    YT_STATE.disliked = likeStatus === 'DISLIKE';

  } catch (e) {
    console.warn('syncFromDOM error', e);
  }
}

function syncTimeAndPlaying(bar) {
  if (!bar) return;
  

  let isPlaying = false;
  const playButton = bar.querySelector('#play-pause-button');
  
  if (playButton) {
    const path = playButton.querySelector('path');
    if (path) {
      const pathData = path.getAttribute('d') || '';
      const isPauseIcon = pathData.toLowerCase().includes('h');
      isPlaying = isPauseIcon;
    }
  }

  YT_STATE.playing = isPlaying;

  // time / duration
  const slider = bar.querySelector('#progress-bar') || document.querySelector('tp-yt-paper-slider#progress-bar') || bar.querySelector('tp-yt-paper-slider');
  if (slider) {
    const val = parseFloat(slider.getAttribute('value') || slider.value || 0);
    const max = parseFloat(slider.getAttribute('max') || slider.max || 100);
    if (max > 0) {
    }
  }

  const timeText = (bar.querySelector('.time-info')?.textContent || bar.querySelector('.time')?.textContent || '').trim();
  if (timeText && timeText.includes('/')) {
    const [cur, tot] = timeText.split('/').map(s => s.trim());
    const curSec = parseTimeToSeconds(cur);
    const totSec = parseTimeToSeconds(tot);
    if (totSec > 0) {
      YT_STATE.currentTime = curSec;
      YT_STATE.duration = totSec;
    } else if (curSec) {
      YT_STATE.currentTime = curSec;
    }
  } else {
    const curEl = bar.querySelector('.time .current') || bar.querySelector('.ytp-time-current');
    const totEl = bar.querySelector('.time .total') || bar.querySelector('.ytp-time-duration');
    if (curEl) YT_STATE.currentTime = parseTimeToSeconds(curEl.textContent.trim());
    if (totEl) YT_STATE.duration = parseTimeToSeconds(totEl.textContent.trim());
  }
}

function tryAttachCoverObserver() {
  if (coverObserverAttached) return;
  const coverImg = document.querySelector('ytmusic-player-bar img') || document.querySelector('.player-thumb img');
  if (!coverImg) return;
  try {
    const observer = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'src') {
          const src = coverImg.src || '';
          if (src && src !== YT_STATE.cover) {
            YT_STATE.cover = src;
          }
        }
      }
    });
    observer.observe(coverImg, { attributes: true, attributeFilter: ['src'] });
    coverObserverAttached = true;
  } catch (e) {
  }
}


function watchCoverChange() {
  const mediaWindow = document.querySelector('#song-media-window');
  if (!mediaWindow) return;

  try {
    const observer = new MutationObserver(() => {
      const newCover = findCover();
      if (newCover && newCover !== YT_STATE.cover) {
        YT_STATE.cover = newCover;
      }
    });

    observer.observe(mediaWindow, { subtree: true, attributes: true, childList: true });
  } catch (e) {
  }
}


tryAttachCoverObserver();
const attachTryTimer = setInterval(() => {
  tryAttachCoverObserver();
  if (coverObserverAttached) {
    clearInterval(attachTryTimer);
    watchCoverChange(); 
  }
}, 800);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    // control commands
    if (msg.action === 'playPause') { clickButton("#play-pause-button"); sendResponse({ ok: true }); }
    else if (msg.action === 'next') { clickButton(".next-button"); sendResponse({ ok: true }); }
    else if (msg.action === 'prev') { clickButton(".previous-button"); sendResponse({ ok: true }); }
    else if (msg.action === 'like') { clickButton("ytmusic-like-button-renderer .like button"); sendResponse({ ok: true }); }
    else if (msg.action === 'dislike') { clickButton("ytmusic-like-button-renderer .dislike button"); sendResponse({ ok: true }); }
    else if (msg.action === 'getInfo') {
      const bar = document.querySelector('ytmusic-player-bar') || document.querySelector('.ytmusic-player-bar') || document.querySelector('#player');
   
      if (!coverObserverAttached) {
        tryAttachCoverObserver();
      }
      syncFromDOM(bar);
      syncTimeAndPlaying(bar);
      sendResponse({
        title: YT_STATE.title,
        artist: YT_STATE.artist,
        cover: YT_STATE.cover,
        playing: YT_STATE.playing,
        currentTime: YT_STATE.currentTime,
        duration: YT_STATE.duration,
        liked: YT_STATE.liked,
        disliked: YT_STATE.disliked
      });
      return true; 
    }

  } catch (e) {
    console.error("YT controller error:", e);
    sendResponse({
      title: "Error",
      artist: "Could not get info",
      cover: "",
      playing: false,
      currentTime: 0,
      duration: 0
    });
  }
  return true;
});
