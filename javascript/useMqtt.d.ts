interface MqttOptions {
  url: string
  username?: string
  password?: string
  protocol?: string
  encoding?: 'json' | 'msgpack' | 'string'
  clean?: boolean
  clientId?: string
  reconnectPeriod?: number
  connectTimeout?: number
  keepalive?: number
  qos?: number
  retain?: boolean
  rejectUnauthorized?: boolean
}

interface MqttClient {
  connect: () => void
  publish: (
    topic: string,
    message: unknown,
    options?: { qos?: number; retain?: boolean },
  ) => Promise<void>
  subscribe: (topic: string, options?: { qos?: number }) => Promise<void>
  unsubscribe: (topic: string) => Promise<void>
  on: (event: string, callback: (...args: unknown[]) => void) => void
  end: (force?: boolean, callback?: () => void) => void
  reconnect: () => void
}

export function useMqtt(options?: MqttOptions): {
  connect: () => void
  reconnect: () => void
  publish: (
    topic: string,
    message: unknown,
    options?: { qos?: number; retain?: boolean },
  ) => Promise<void>
  subscribe: (topic: string, options?: { qos?: number }) => Promise<void>
  unsubscribe: (topic: string) => Promise<void>
  cleanup: () => void
  isConnected: { value: boolean }
  connectionStatus: { value: string }
  connectionError: { value: Error | null }
  isReconnecting: { value: boolean }
  client: { value: MqttClient | null }
}
