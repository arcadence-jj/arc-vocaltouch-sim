const pendingTab = document.querySelector('#pendingTab');
const historyTab = document.querySelector('#historyTab');
const dashboard = document.querySelector('#dashboard');
const clearHistoryDialog = document.querySelector('#clearHistoryDialog');
const settingsDialog = document.querySelector('#settingsDialog');
const settingsButton = document.querySelector('#settingsButton');
const clearHistoryMessage = document.querySelector('#clearHistoryMessage');
const clearHistoryForm = document.querySelector('#clearHistoryForm');
const liveTitle = document.querySelector('#liveTitle');
const liveText = document.querySelector('#liveText');
const voiceNotice = document.querySelector('#voiceNotice');
const audioIndicator = document.querySelector('#audioIndicator');
const voiceButton = document.querySelector('#voiceButton');
const pendingRequests = [];
const assistedRequests = [];
let activeTab = 'pending';
let availableVoices = [];
let currentSpeechId = 0;
let notification = null;
let notificationTimer;

function showNotification(message, kind = 'error', duration = 7000) {
  notification = { message, kind };
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(clearNotification, duration);
  renderDashboard();
}

function showErrorNotification(message) {
  showNotification(message, 'error');
}

function clearNotification() {
  clearTimeout(notificationTimer);
  notification = null;
  renderDashboard();
}

const languageSettings = {
  english: { locale: 'en-US', prefixes: ['en'] },
  filipino: { locale: 'fil-PH', prefixes: ['fil', 'tl'] },
  bikolano: { locale: 'bcl-PH', prefixes: ['bcl'] }
};

function getLanguage() {
  if (voiceButton.textContent.includes('BIKOLANO')) return 'bikolano';
  if (voiceButton.textContent.includes('FILIPINO')) return 'filipino';
  return 'english';
}

function refreshVoices() {
  if (!('speechSynthesis' in window)) {
    voiceNotice.textContent = 'Speech playback is not supported by this browser.';
    voiceNotice.classList.add('unavailable');
    return;
  }

  availableVoices = speechSynthesis.getVoices();
  updateVoiceNotice();
}

function findLanguageVoice(language) {
  const settings = languageSettings[language];
  if (!settings) return null;

  const matchingVoices = availableVoices.filter(voice => {
    const voiceLanguage = voice.lang.toLowerCase();
    return settings.prefixes.some(prefix => voiceLanguage === prefix || voiceLanguage.startsWith(`${prefix}-`));
  });
  return matchingVoices.find(voice => voice.lang.toLowerCase() === settings.locale.toLowerCase())
    || matchingVoices.find(voice => voice.localService)
    || matchingVoices[0]
    || null;
}

function updateVoiceNotice() {
  const language = getLanguage();
  const voice = findLanguageVoice(language);
  if (voice) {
    voiceNotice.textContent = '';
    voiceNotice.classList.remove('unavailable');
  } else {
    const languageName = language === 'bikolano' ? 'Bikolano' : language === 'filipino' ? 'Filipino' : 'English';
    voiceNotice.textContent = `${languageName} voice not installed. Install a matching device voice; no English fallback is used.`;
    voiceNotice.classList.add('unavailable');
  }
}

function setAudioPlaying(playing) {
  audioIndicator.classList.toggle('is-playing', playing);
  audioIndicator.setAttribute('aria-label', playing ? 'Speaker playing' : 'Speaker idle');
}

function speakInSelectedLanguage(message, language) {
  if (!('speechSynthesis' in window)) {
    updateVoiceNotice();
    showErrorNotification('Speech playback is not supported by this browser.');
    return;
  }

  const settings = languageSettings[language];
  const voice = findLanguageVoice(language);
  if (!voice) {
    const languageName = language === 'bikolano' ? 'Bikolano' : language === 'filipino' ? 'Filipino' : 'English';
    voiceNotice.textContent = `${languageName} speech is unavailable. Install a matching voice on this device to play this message.`;
    voiceNotice.classList.add('unavailable');
    showErrorNotification(`${languageName} speech is unavailable. Install a matching device voice.`);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(message);
  const speechId = ++currentSpeechId;
  utterance.voice = voice;
  utterance.lang = voice.lang || settings.locale;
  utterance.volume = Number(document.querySelector('#volume').value) / 100;
  utterance.rate = 0.95;
  speechSynthesis.cancel();
  setAudioPlaying(false);
  utterance.onstart = () => {
    if (speechId === currentSpeechId) setAudioPlaying(true);
  };
  utterance.onend = () => {
    if (speechId === currentSpeechId) {
      setAudioPlaying(false);
      updateVoiceNotice();
    }
  };
  utterance.onerror = event => {
    if (speechId === currentSpeechId) {
      setAudioPlaying(false);
      voiceNotice.textContent = `Speech playback failed: ${event.error}. Check the selected device voice.`;
      voiceNotice.classList.add('unavailable');
      showErrorNotification(`Speech playback failed: ${event.error}.`);
    }
  };
  voiceNotice.textContent = 'Speaking…';
  voiceNotice.classList.remove('unavailable');
  speechSynthesis.speak(utterance);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderDashboard() {
  const isHistory = activeTab === 'history';
  const requests = isHistory ? assistedRequests : pendingRequests;

  pendingTab.textContent = `Pending Dashboard (${pendingRequests.length})`;
  historyTab.textContent = `Assisted History (${assistedRequests.length})`;
  pendingTab.classList.toggle('active', !isHistory);
  historyTab.classList.toggle('active', isHistory);
  dashboard.replaceChildren();
  dashboard.classList.toggle('showing-empty', requests.length === 0);

  const notificationBanner = notification
    ? document.createElement('section')
    : null;
  if (notificationBanner) {
    const isSuccess = notification.kind === 'success';
    notificationBanner.className = `error-notification${isSuccess ? ' success-notification' : ''}`;
    notificationBanner.setAttribute('role', isSuccess ? 'status' : 'alert');
    notificationBanner.setAttribute('aria-live', isSuccess ? 'polite' : 'assertive');
    notificationBanner.textContent = isSuccess
      ? notification.message
      : `RED ERROR STATE: ${notification.message}`;
  }

  if (isHistory) {
    const toolbar = document.createElement('div');
    toolbar.className = 'history-toolbar';
    const label = document.createElement('strong');
    label.textContent = 'Assisted History';
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-history-button';
    clearButton.type = 'button';
    clearButton.textContent = 'Clear All';
    clearButton.disabled = assistedRequests.length === 0;
    clearButton.addEventListener('click', () => {
      if (!assistedRequests.length) return;
      clearHistoryMessage.textContent = `This will permanently delete all ${assistedRequests.length} assisted history ${assistedRequests.length === 1 ? 'record' : 'records'}.`;
      clearHistoryDialog.showModal();
    });
    toolbar.append(label, clearButton);
    dashboard.append(toolbar);
  }

  if (requests.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = isHistory
      ? '<div class="check">✓</div><h2>History Is Clear</h2><p>No assisted requests yet,<br>new activity will appear here.</p><small>Completed assists will appear here.</small>'
      : '<div class="check">✓</div><h2>All Caught Up</h2><p>Requests are clean for now,<br>look out for new assists!</p><small>Family members &amp; caregiver speaker are synced.</small>';
    dashboard.append(emptyState);
    if (notificationBanner) dashboard.append(notificationBanner);
    return;
  }

  requests.forEach(request => {
    const card = document.createElement('article');
    card.className = 'request-card';

    const heading = document.createElement('strong');
    heading.className = 'request-heading';
    heading.textContent = `[${formatTime(request.timestamp)}] KEY #${request.key} • ${request.label.toUpperCase()}`;

    const message = document.createElement('p');
    message.className = 'request-message';
    message.textContent = `“${request.message}”`;

    const speakButton = document.createElement('button');
    speakButton.className = 'speak-button';
    speakButton.type = 'button';
    speakButton.textContent = '🔊 Speak';
    speakButton.setAttribute('aria-label', `Speak in ${request.language}: ${request.message}`);
    speakButton.addEventListener('click', () => speakInSelectedLanguage(request.message, request.language));

    const messageRow = document.createElement('div');
    messageRow.className = 'request-message-row';
    messageRow.append(message, speakButton);

    const details = document.createElement('div');
    details.className = 'request-details';
    details.append(heading, messageRow);

    const status = document.createElement('div');
    status.className = `request-status${request.notified ? ' notified' : ''}`;
    status.textContent = request.notified
      ? 'Caregiver notified'
      : `Unassisted: ${Math.max(0, (Date.now() - request.timestamp) / 1000).toFixed(1)}s (Tap Notify!)`;
    const monitoring = document.createElement('small');
    monitoring.className = 'monitoring-note';
    monitoring.textContent = 'Family monitoring active';
    status.append(monitoring);

    const actions = document.createElement('div');
    actions.className = 'request-actions';
    const notify = document.createElement('button');
    notify.className = 'request-button notify-button';
    notify.type = 'button';
    notify.textContent = request.notified ? 'Notified ✓' : 'Notify Caregiver 🔔';
    notify.disabled = request.notified || isHistory;
    notify.addEventListener('click', () => {
      request.notified = true;
      renderDashboard();
    });

    const assisted = document.createElement('button');
    assisted.className = 'request-button assisted-button';
    assisted.type = 'button';
    assisted.textContent = 'Assisted ✓';
    assisted.hidden = isHistory;
    assisted.addEventListener('click', () => {
      const index = pendingRequests.indexOf(request);
      if (index >= 0) {
        pendingRequests.splice(index, 1);
        assistedRequests.unshift(request);
        renderDashboard();
      }
    });

    actions.append(status, notify, assisted);
    card.append(details, actions);
    dashboard.append(card);
  });
  if (notificationBanner) dashboard.append(notificationBanner);
}

function receiveKeyPress(event) {
  if (!event || !Number.isInteger(event.key) || event.key < 1 || event.key > 99) return;
  if (typeof event.label !== 'string' || typeof event.message !== 'string') return;

  const language = ['english', 'filipino', 'bikolano'].includes(event.language)
    ? event.language
    : getLanguage();
  const request = {
    key: event.key,
    label: event.label,
    message: event.message,
    language,
    timestamp: Number.isFinite(event.timestamp) ? event.timestamp : Date.now(),
    notified: false
  };
  pendingRequests.unshift(request);
  activeTab = 'pending';
  const folder = language === 'bikolano' ? 'bikol' : language === 'filipino' ? 'tagalog' : 'english';
  const audioName = event.audioName || `${String(event.key).padStart(2, '0')}_${event.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.wav`;
  liveTitle.textContent = `/sdcard/${folder}/${audioName}`;
  liveText.textContent = `“${event.message}”`;
  voiceButton.textContent = `VOICE: ${language.toUpperCase()}`;
  updateVoiceNotice();
  renderDashboard();
}

clearHistoryForm.addEventListener('submit', event => {
  if (event.submitter?.value !== 'delete') return;
  event.preventDefault();
  assistedRequests.length = 0;
  clearHistoryDialog.close();
  renderDashboard();
});

pendingTab.addEventListener('click', () => {
  activeTab = 'pending';
  renderDashboard();
});

historyTab.addEventListener('click', () => {
  activeTab = 'history';
  renderDashboard();
});

voiceButton.addEventListener('click', () => {
  const languages = ['VOICE: ENGLISH', 'VOICE: FILIPINO', 'VOICE: BIKOLANO'];
  voiceButton.textContent = languages[(languages.indexOf(voiceButton.textContent) + 1) % languages.length];
  updateVoiceNotice();
});

// ---------------------------------------------------------------------------
// Tablet link: key presses and Bluetooth status arrive from the tablet
// (the VocalTouch device simulator) through ../link.js.
// ---------------------------------------------------------------------------
const speakerStatus = document.querySelector('#speakerButton');
const linkStatus = document.querySelector('#linkStatus');
const speakerLabels = {
  connected: 'BT SPEAKER: CONNECTED',
  reconnecting: 'BT SPEAKER: RECONNECTING…',
  disconnected: 'BT SPEAKER: DISCONNECTED',
  unknown: 'BT SPEAKER: WAITING FOR TABLET'
};
const seenEventIds = new Set();
let brokerOnline = false;
let tabletOnline = false;

function setSpeakerStatus(state) {
  speakerStatus.dataset.state = state;
  speakerStatus.textContent = speakerLabels[state] || speakerLabels.unknown;
}

function speakerStateFrom(bluetooth, retrying) {
  if (bluetooth === 'connected') return 'connected';
  if (bluetooth === 'disconnected') return retrying ? 'reconnecting' : 'disconnected';
  return 'unknown';
}

function renderLinkStatus() {
  let state = 'offline';
  let text = 'No connection, retrying…';
  if (brokerOnline && tabletOnline) {
    state = 'online';
    text = 'Tablet linked';
  } else if (brokerOnline) {
    state = 'waiting';
    text = 'Waiting for tablet…';
  }
  linkStatus.dataset.state = state;
  linkStatus.textContent = text;
}

function handleLinkStatus(status) {
  brokerOnline = status === 'online';
  if (!brokerOnline) {
    tabletOnline = false;
    setSpeakerStatus('unknown');
  }
  renderLinkStatus();
}

// Retained state: used to sync silently (page load, reconnect, tablet going offline).
function handleTabletState(state) {
  tabletOnline = state.online === true;
  setSpeakerStatus(tabletOnline ? speakerStateFrom(state.bluetooth, state.retrying === true) : 'unknown');
  renderLinkStatus();
}

// Live Bluetooth change on the tablet: update the status and notify the caregiver.
function handleBluetoothEvent(data) {
  if (!data) return;
  if (data.state === 'connected') {
    setSpeakerStatus('connected');
    showNotification('Bluetooth speaker connected to the tablet.', 'success', 6000);
  } else if (data.state === 'disconnected') {
    const retrying = data.retrying === true;
    setSpeakerStatus(retrying ? 'reconnecting' : 'disconnected');
    showNotification(
      retrying
        ? 'Bluetooth speaker disconnected from the tablet. Reconnecting…'
        : 'Bluetooth speaker disconnected from the tablet.',
      'error',
      8000
    );
  }
}

function handleTabletEvent(message) {
  if (typeof message.id !== 'string' || seenEventIds.has(message.id)) return;
  seenEventIds.add(message.id);
  if (seenEventIds.size > 200) seenEventIds.delete(seenEventIds.values().next().value);

  if (message.type === 'key_press') receiveKeyPress(message.data);
  else if (message.type === 'bluetooth') handleBluetoothEvent(message.data);
}

setSpeakerStatus('unknown');
renderLinkStatus();
if (window.VocalTouchLink) {
  VocalTouchLink.create({
    role: 'phone',
    onStatus: handleLinkStatus,
    onPeerState: handleTabletState,
    onEvent: handleTabletEvent
  });
}

const volume = document.querySelector('#volume');
volume.addEventListener('input', () => {
  document.querySelector('#volumeValue').textContent = `${volume.value}%`;
});

settingsButton.addEventListener('click', () => {
  settingsDialog.showModal();
});

if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
} else {
  updateVoiceNotice();
}
setInterval(() => {
  if (activeTab === 'pending' && pendingRequests.some(request => !request.notified)) renderDashboard();
}, 1000);
renderDashboard();
