import { decode as mpDecode, encode as mpEncode } from '@msgpack/msgpack'
import mqtt from 'mqtt'
import { ref } from 'vue'

// Add connection status enum
const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
}

export function useMqtt(options = {}) {
  const defaultOptions = {
    url: 'ws://localhost:8883',
    username: '',
    password: '',
    clientId: `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 4000,
    qos: 0,
    retain: true,
    encoding: 'msgpack', // 'msgpack', 'json', 'string'

    clean: true,
    rejectUnauthorized: true,
    protocol: 'wss', // can be 'wss', 'mqtt', etc.
  }

  const config = { ...defaultOptions, ...options }
  const client = ref(null)
  const isConnected = ref(false)
  const connectionError = ref(null)
  const connectionStatus = ref('disconnected')
  const isReconnecting = ref(false)
  const networkCheckInterval = ref(null)
  const lastNetworkStatus = ref(navigator.onLine)

  function encodeMessage(data) {
    if (config.encoding === 'string') return data
    if (config.encoding === 'json') return JSON.stringify(data)
    return mpEncode(data)
  }

  function decodeMessage(raw) {
    // Attempt msgpack decode
    try {
      return mpDecode(raw)
    } catch {
      // Attempt JSON decode
      try {
        return JSON.parse(raw.toString())
      } catch {
        // Return as string if both decodings fail
        return raw.toString()
      }
    }
  }

  function updateConnectionStatus(status) {
    connectionStatus.value = status
    isConnected.value = status === CONNECTION_STATUS.CONNECTED
    isReconnecting.value = status === CONNECTION_STATUS.RECONNECTING
  }

  // Check network status and update connection status if needed
  function checkNetworkStatus() {
    const isOnline = navigator.onLine

    // Only update if status has changed
    if (isOnline !== lastNetworkStatus.value) {
      console.log(
        'Network status changed from',
        lastNetworkStatus.value ? 'online' : 'offline',
        'to',
        isOnline ? 'online' : 'offline',
      )
      lastNetworkStatus.value = isOnline

      // If we're offline, update connection status to disconnected
      if (!isOnline && connectionStatus.value === CONNECTION_STATUS.CONNECTED) {
        console.log('Network disconnected, updating connection status to disconnected')
        updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED)
      }
      // If we're back online and disconnected, try to reconnect
      else if (isOnline && connectionStatus.value === CONNECTION_STATUS.DISCONNECTED) {
        console.log('Network is back online, attempting to reconnect')
        reconnect()
      }
    }
  }

  // Set up network status monitoring
  function setupNetworkMonitoring() {
    console.log('Setting up network monitoring')

    // Check network status every 1 second
    networkCheckInterval.value = setInterval(checkNetworkStatus, 1000)

    // Also listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Network online event detected')
      lastNetworkStatus.value = true

      // If we were previously disconnected due to network, try to reconnect
      if (connectionStatus.value === CONNECTION_STATUS.DISCONNECTED) {
        console.log('Network is back online, attempting to reconnect')
        reconnect()
      }
    })

    window.addEventListener('offline', () => {
      console.log('Network offline event detected')
      lastNetworkStatus.value = false

      // If we were connected, update connection status to disconnected
      if (connectionStatus.value === CONNECTION_STATUS.CONNECTED) {
        console.log('Network is offline, updating connection status to disconnected')
        updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED)
      }
    })

    // Initial check
    checkNetworkStatus()
  }

  // Clean up network monitoring
  function cleanupNetworkMonitoring() {
    console.log('Cleaning up network monitoring')
    if (networkCheckInterval.value) {
      clearInterval(networkCheckInterval.value)
      networkCheckInterval.value = null
    }

    window.removeEventListener('online', () => {})
    window.removeEventListener('offline', () => {})
  }

  const connect = () => {
    try {
      client.value = mqtt.connect(config.url, {
        username: config.username,
        password: config.password,
        clientId: config.clientId,
        keepalive: config.keepalive,
        reconnectPeriod: config.reconnectPeriod,
        connectTimeout: config.connectTimeout,
        clean: config.clean,
        rejectUnauthorized: config.rejectUnauthorized,
        protocol: config.protocol,
        will: {
          topic: 'client/status',
          payload: encodeMessage({ status: 'offline' }),
          qos: config.qos,
          retain: config.retain,
        },
      })

      client.value.on('connect', () => {
        updateConnectionStatus(CONNECTION_STATUS.CONNECTED)
        connectionError.value = null
      })

      client.value.on('message', (topic, message) => {
        const decoded = decodeMessage(message)
        client.value.emit('decoded-message', topic, decoded)
      })

      client.value.on('error', (error) => {
        connectionError.value = error
        updateConnectionStatus(CONNECTION_STATUS.ERROR)
      })

      client.value.on('disconnect', () => {
        updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED)
      })

      client.value.on('offline', () => {
        updateConnectionStatus(CONNECTION_STATUS.OFFLINE)
      })

      client.value.on('reconnect', () => {
        updateConnectionStatus(CONNECTION_STATUS.RECONNECTING)
      })

      // Set up network monitoring after connecting
      setupNetworkMonitoring()
    } catch (error) {
      connectionError.value = error
      updateConnectionStatus(CONNECTION_STATUS.ERROR)
    }
  }

  // Explicitly trigger reconnection
  const reconnect = () => {
    if (!client.value) {
      console.log('No client available, connecting...')
      connect()
      return
    }

    if (isReconnecting.value) {
      console.log('Already reconnecting, skipping...')
      return
    }

    console.log('Explicitly triggering reconnection')
    updateConnectionStatus(CONNECTION_STATUS.RECONNECTING)

    // End the current connection to force a reconnection
    client.value.end(true, () => {
      console.log('Previous connection ended, reconnecting...')
      client.value.reconnect()
    })
  }

  const publish = (topic, message, options = {}) => {
    if (!client.value || !isConnected.value) {
      throw new Error('MQTT client is not connected')
    }

    const { qos = config.qos, retain = config.retain } = options
    const payload = encodeMessage(message)

    return new Promise((resolve, reject) => {
      client.value.publish(topic, payload, { qos, retain }, (err) =>
        err ? reject(err) : resolve(),
      )
    })
  }

  const subscribe = (topic, options = {}) => {
    if (!client.value || !isConnected.value) {
      throw new Error('MQTT client is not connected')
    }

    const { qos = 1 } = options

    return new Promise((resolve, reject) => {
      client.value.subscribe(topic, { qos }, (err) => (err ? reject(err) : resolve()))
    })
  }

  const unsubscribe = (topic) => {
    if (!client.value || !isConnected.value) {
      throw new Error('MQTT client is not connected')
    }

    return new Promise((resolve, reject) => {
      client.value.unsubscribe(topic, (err) => (err ? reject(err) : resolve()))
    })
  }

  const cleanup = () => {
    cleanupNetworkMonitoring()

    if (client.value) {
      // Remove all listeners before ending connection
      ;['connect', 'message', 'error', 'disconnect', 'offline', 'reconnect'].forEach((event) => {
        client.value.removeAllListeners(event)
      })
      client.value.end()
      client.value = null
    }
  }

  return {
    connect,
    reconnect,
    publish,
    subscribe,
    unsubscribe,
    cleanup,
    isConnected,
    connectionStatus,
    connectionError,
    client,
    isReconnecting,
  }
}
