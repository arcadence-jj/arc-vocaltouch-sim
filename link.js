/*
 * VocalTouch link
 * ---------------
 * Tiny realtime relay shared by the tablet (device simulator) and the phone
 * (caregiver app). Both pages load this file, so GitHub Pages can host them
 * as plain static files: the internet part is handled by a public MQTT broker
 * reached over secure WebSockets (mqtt.js must be loaded before this file).
 *
 *   tablet  --events-->  phone     key presses, Bluetooth connect/disconnect
 *   tablet  --state--->  phone     retained: online/offline + Bluetooth status
 *   phone   --state--->  tablet    retained: online/offline (for the tablet's link chip)
 *
 * PAIRING: both devices must use the same room. The default is below. To use a
 * private one without editing code, open each page with  #room=your-secret-id
 * (6-64 letters, digits, "-" or "_"), e.g.  .../phone/#room=my-demo-4821
 */
(function (global) {
  'use strict';

  const CONFIG = {
    // Public test broker (no account needed). Alternatives that also work:
    //   wss://broker.emqx.io:8084/mqtt
    //   wss://test.mosquitto.org:8081
    // Both devices must use the same broker.
    brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
    namespace: 'vocaltouch-proto-v1',
    defaultRoom: 'vt-2eb967285df1458b3b43'
  };

  const ROOM_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

  function readRoom() {
    const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('room');
    const fromQuery = new URLSearchParams(location.search).get('room');
    const candidate = fromHash || fromQuery || CONFIG.defaultRoom;
    return ROOM_PATTERN.test(candidate) ? candidate : CONFIG.defaultRoom;
  }

  const encode = obj => JSON.stringify(Object.assign({ v: 1 }, obj));

  function decode(payload) {
    try {
      const obj = JSON.parse(payload.toString());
      return obj && typeof obj === 'object' && obj.v === 1 ? obj : null;
    } catch (error) {
      return null;
    }
  }

  function makeId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * @param {Object}   options
   * @param {'tablet'|'phone'} options.role
   * @param {Function} [options.onStatus]    'connecting' | 'online' | 'offline'  (this device <-> broker)
   * @param {Function} [options.onPeerState] state object of the other device (phone: tablet's, tablet: phone's)
   * @param {Function} [options.onEvent]     phone only: live event sent by the tablet
   */
  function create(options) {
    const role = options.role === 'tablet' ? 'tablet' : 'phone';
    const notify = (name, value) => {
      if (typeof options[name] === 'function') options[name](value);
    };

    const noop = {
      sendEvent() { return false; },
      setState() {},
      isOnline() { return false; }
    };

    if (!global.mqtt || typeof global.mqtt.connect !== 'function') {
      console.error('VocalTouchLink: mqtt.js did not load (check the internet connection).');
      notify('onStatus', 'offline');
      return noop;
    }

    const base = `${CONFIG.namespace}/${readRoom()}`;
    const topics = {
      events: `${base}/tablet/events`,
      tabletState: `${base}/tablet/state`,
      phoneState: `${base}/phone/state`
    };
    const myStateTopic = role === 'tablet' ? topics.tabletState : topics.phoneState;
    const peerStateTopic = role === 'tablet' ? topics.phoneState : topics.tabletState;
    const subscriptions = role === 'phone'
      ? [topics.events, topics.tabletState]
      : [topics.phoneState];

    let myState = {};

    const client = global.mqtt.connect(CONFIG.brokerUrl, {
      clientId: `vt-${role}-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      keepalive: 20,
      reconnectPeriod: 2000,
      connectTimeout: 10000,
      // If this device vanishes (tab closed, no internet), the broker tells the
      // other side by publishing this message for us.
      will: {
        topic: myStateTopic,
        payload: encode({ online: false }),
        qos: 1,
        retain: true
      }
    });

    function publishState() {
      if (!client.connected) return;
      client.publish(
        myStateTopic,
        encode(Object.assign({}, myState, { online: true, ts: Date.now() })),
        { qos: 1, retain: true }
      );
    }

    client.on('connect', () => {
      notify('onStatus', 'online');
      client.subscribe(subscriptions, { qos: 1 });
      publishState();
    });
    client.on('reconnect', () => notify('onStatus', 'connecting'));
    client.on('close', () => notify('onStatus', 'offline'));
    client.on('error', error => console.warn('VocalTouchLink:', error && error.message));

    client.on('message', (topic, payload) => {
      const message = decode(payload);
      if (!message) return;
      if (role === 'phone' && topic === topics.events) notify('onEvent', message);
      else if (topic === peerStateTopic) notify('onPeerState', message);
    });

    notify('onStatus', 'connecting');

    return {
      /** Tablet only. Sends a live event, e.g. sendEvent('key_press', {...}). */
      sendEvent(type, data) {
        if (role !== 'tablet') return false;
        client.publish(
          topics.events,
          encode({ type, id: makeId(), ts: Date.now(), data }),
          { qos: 1 }
        );
        return true;
      },
      /** Merges fields into this device's retained state and publishes it. */
      setState(partial) {
        myState = Object.assign({}, myState, partial);
        publishState();
      },
      isOnline() {
        return client.connected;
      }
    };
  }

  global.VocalTouchLink = { create, config: CONFIG };
})(window);
