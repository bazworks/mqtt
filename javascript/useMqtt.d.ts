interface MqttOptions {
    url: string;
    username?: string;
    password?: string;
    protocol?: string;
    encoding?: 'json' | 'msgpack' | 'string';
    clean?: boolean;
    clientId?: string;
  }
  
  interface MqttClient {
    connect: () => void;
    publish: (topic: string, message: unknown, options?: { qos?: number; retain?: boolean }) => Promise<void>;
    subscribe: (topic: string, options?: { qos?: number }) => Promise<void>;
    unsubscribe: (topic: string) => Promise<void>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    end: () => void;
  }
  
  export function useMqtt(options?: MqttOptions): {
    connect: () => void;
    publish: (topic: string, message: unknown, options?: { qos?: number; retain?: boolean }) => Promise<void>;
    subscribe: (topic: string, options?: { qos?: number }) => Promise<void>;
    unsubscribe: (topic: string) => Promise<void>;
    cleanup: () => void;
    isConnected: { value: boolean };
    connectionStatus: { value: string };
    connectionError: { value: Error | null };
    client: { value: MqttClient | null };
  };