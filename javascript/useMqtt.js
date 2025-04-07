import { decode as mpDecode, encode as mpEncode } from "@msgpack/msgpack";
import mqtt from "mqtt";
import { ref } from "vue";

// Add connection status enum
const CONNECTION_STATUS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error",
  RECONNECTING: "reconnecting",
  OFFLINE: "offline",
};

export function useMqtt(options = {}) {
  const defaultOptions = {
    url: "ws://localhost:8883",
    username: "",
    password: "",
    clientId: `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 4000,
    qos: 0,
    retain: true,
    encoding: "msgpack", // 'msgpack', 'json', 'string'

    clean: true,
    rejectUnauthorized: true,
    protocol: "wss", // can be 'wss', 'mqtt', etc.
  };

  const config = { ...defaultOptions, ...options };
  const client = ref(null);
  const isConnected = ref(false);
  const connectionError = ref(null);
  const connectionStatus = ref("disconnected");

  function encodeMessage(data) {
    if (config.encoding === "string") return data;
    if (config.encoding === "json") return JSON.stringify(data);
    return mpEncode(data);
  }

  function decodeMessage(raw) {
    console.log("decodeMessage", raw.toString());
    // Attempt msgpack decode
    try {
      return mpDecode(raw);
    } catch {
      // Attempt JSON decode
      try {
        return JSON.parse(raw.toString());
      } catch {
        // Return as string if both decodings fail
        return raw.toString();
      }
    }
  }

  function updateConnectionStatus(status) {
    connectionStatus.value = status;
    isConnected.value = status === CONNECTION_STATUS.CONNECTED;
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
          topic: "client/status",
          payload: encodeMessage({ status: "offline" }),
          qos: config.qos,
          retain: config.retain,
        },
      });

      client.value.on("connect", () => {
        updateConnectionStatus(CONNECTION_STATUS.CONNECTED);
        connectionError.value = null;
      });

      client.value.on("message", (topic, message) => {
        const decoded = decodeMessage(message);
        client.value.emit("decoded-message", topic, decoded);
      });

      client.value.on("error", (error) => {
        connectionError.value = error;
        updateConnectionStatus(CONNECTION_STATUS.ERROR);
      });

      client.value.on("disconnect", () => {
        updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      });

      client.value.on("offline", () => {
        updateConnectionStatus(CONNECTION_STATUS.OFFLINE);
      });

      client.value.on("reconnect", () => {
        updateConnectionStatus(CONNECTION_STATUS.RECONNECTING);
      });
    } catch (error) {
      connectionError.value = error;
      updateConnectionStatus(CONNECTION_STATUS.ERROR);
    }
  };

  const publish = (topic, message, options = {}) => {
    if (!client.value || !isConnected.value) {
      throw new Error("MQTT client is not connected");
    }

    const { qos = config.qos, retain = config.retain } = options;
    const payload = encodeMessage(message);

    return new Promise((resolve, reject) => {
      client.value.publish(topic, payload, { qos, retain }, (err) =>
        err ? reject(err) : resolve()
      );
    });
  };

  const subscribe = (topic, options = {}) => {
    if (!client.value || !isConnected.value) {
      throw new Error("MQTT client is not connected");
    }

    const { qos = 1 } = options;

    return new Promise((resolve, reject) => {
      client.value.subscribe(topic, { qos }, (err) =>
        err ? reject(err) : resolve()
      );
    });
  };

  const unsubscribe = (topic) => {
    if (!client.value || !isConnected.value) {
      throw new Error("MQTT client is not connected");
    }

    return new Promise((resolve, reject) => {
      client.value.unsubscribe(topic, (err) => (err ? reject(err) : resolve()));
    });
  };

  const cleanup = () => {
    if (client.value) {
      // Remove all listeners before ending connection
      [
        "connect",
        "message",
        "error",
        "disconnect",
        "offline",
        "reconnect",
      ].forEach((event) => {
        client.value.removeAllListeners(event);
      });
      client.value.end();
      client.value = null;
    }
  };

  return {
    connect,
    publish,
    subscribe,
    unsubscribe,
    cleanup,
    isConnected,
    connectionStatus,
    connectionError,
    client,
  };
}
