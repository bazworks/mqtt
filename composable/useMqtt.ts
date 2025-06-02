// ~/composables/useMqtt.ts
import { decode as mpDecode, encode as mpEncode } from '@msgpack/msgpack'
import mqtt, { type IClientOptions, type ISubscriptionGrant, type MqttClient } from 'mqtt'
import { ref } from 'vue'

const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
} as const

export type Encoding = 'msgpack' | 'json' | 'string'

interface ServiceConfig {
  url: string
  encoding?: Encoding
  debug?: boolean
  qos?: 0 | 1 | 2
  retain?: boolean
}

export function useMqtt(serviceConfig: ServiceConfig, mqttOptions: IClientOptions = {}) {
  // Default service configuration
  const config = {
    url: serviceConfig.url,
    encoding: serviceConfig.encoding ?? 'msgpack',
    debug: serviceConfig.debug ?? false,
    qos: serviceConfig.qos ?? 0,
    retain: serviceConfig.retain ?? true,
  }

  const client = ref<MqttClient | null>(null)
  const isConnected = ref(false)
  const connectionError = ref<Error | null>(null)
  const connectionStatus = ref<(typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS]>(
    CONNECTION_STATUS.DISCONNECTED,
  )
  const isReconnecting = ref(false)
  const lastNetworkStatus = ref(navigator.onLine)

  const messageListeners = new Set<(topic: string, payload: unknown) => void>()

  const encodeMessage = (data: unknown): string | Buffer => {
    if (config.encoding === 'string') return String(data)
    if (config.encoding === 'json') return JSON.stringify(data)
    return mpEncode(data) as Buffer
  }

  const decodeMessage = (raw: Buffer): unknown => {
    try {
      return mpDecode(raw)
    } catch {
      try {
        return JSON.parse(raw.toString())
      } catch {
        return raw.toString()
      }
    }
  }

  const updateConnectionStatus = (
    status: (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS],
  ) => {
    connectionStatus.value = status
    isConnected.value = status === CONNECTION_STATUS.CONNECTED
    isReconnecting.value = status === CONNECTION_STATUS.RECONNECTING
  }

  const handleOnline = () => {
    lastNetworkStatus.value = true
    if (connectionStatus.value === CONNECTION_STATUS.DISCONNECTED) {
      if (config.debug) console.log('Network is back online, attempting to reconnect')
      reconnect()
    }
  }

  const handleOffline = () => {
    lastNetworkStatus.value = false
    if (connectionStatus.value === CONNECTION_STATUS.CONNECTED) {
      if (config.debug) console.log('Network is offline, updating connection status')
      updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED)
    }
  }

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        client.value = mqtt.connect(config.url, {
          ...mqttOptions,
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
          resolve()
        })

        client.value.on('message', (topic, message) => {
          const decoded = decodeMessage(message)
          messageListeners.forEach((listener) => listener(topic, decoded))
        })

        client.value.on('error', (error: Error) => {
          connectionError.value = error
          updateConnectionStatus(CONNECTION_STATUS.ERROR)
          if (config.debug) console.error('MQTT error:', error)
          reject(error)
        })

        client.value.on('disconnect', () => updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED))
        client.value.on('offline', () => updateConnectionStatus(CONNECTION_STATUS.OFFLINE))
        client.value.on('reconnect', () => updateConnectionStatus(CONNECTION_STATUS.RECONNECTING))

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
      } catch (error) {
        connectionError.value = error as Error
        updateConnectionStatus(CONNECTION_STATUS.ERROR)
        reject(error)
      }
    })
  }

  const reconnect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!client.value) {
        connect().then(resolve).catch(reject)
        return
      }

      if (isReconnecting.value) {
        resolve()
        return
      }

      updateConnectionStatus(CONNECTION_STATUS.RECONNECTING)
      client.value.end(true, (err) => {
        if (err) {
          reject(err)
          return
        }
        connect().then(resolve).catch(reject)
      })
    })
  }

  const publish = (
    topic: string,
    message: unknown,
    options: { qos?: 0 | 1 | 2; retain?: boolean } = {},
  ): Promise<void> => {
    if (!client.value || !isConnected.value)
      return Promise.reject(new Error('MQTT client is not connected'))

    const { qos = config.qos, retain = config.retain } = options
    const payload = encodeMessage(message)

    return new Promise((resolve, reject) => {
      client.value!.publish(topic, payload, { qos, retain }, (err) =>
        err ? reject(err) : resolve(),
      )
    })
  }

  const subscribe = (
    topic: string,
    options: { qos?: 0 | 1 | 2 } = {},
  ): Promise<ISubscriptionGrant[]> => {
    if (!client.value || !isConnected.value)
      return Promise.reject(new Error('MQTT client is not connected'))

    const { qos = config.qos } = options

    return new Promise((resolve, reject) => {
      client.value!.subscribe(topic, { qos }, (err, granted) => {
        if (err) return reject(err)
        resolve(granted || [])
      })
    })
  }

  const unsubscribe = (topic: string): Promise<void> => {
    if (!client.value || !isConnected.value)
      return Promise.reject(new Error('MQTT client is not connected'))

    return new Promise((resolve, reject) => {
      client.value!.unsubscribe(topic, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  const onDecodedMessage = (callback: (topic: string, payload: unknown) => void) => {
    messageListeners.add(callback)
  }

  const removeMessageListener = (callback: (topic: string, payload: unknown) => void) => {
    messageListeners.delete(callback)
  }

  const cleanup = (): Promise<void> => {
    return new Promise((resolve) => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      messageListeners.clear()

      if (client.value) {
        client.value.removeAllListeners()
        client.value.end(true, () => {
          client.value = null
          resolve()
        })
      } else {
        resolve()
      }
    })
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
    isReconnecting,
    client,
    onDecodedMessage,
    removeMessageListener,
  }
}
