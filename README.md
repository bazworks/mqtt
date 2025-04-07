# MQTT Library

A simple MQTT library providing both JavaScript (Vue.js) and Python implementations for MQTT client functionality. The library supports multiple message encoding formats (msgpack, JSON, string) and provides a clean interface for MQTT operations.

## Features

- Vue.js composable for MQTT client operations
- Python MQTT handler and service implementation
- Support for multiple message encodings (msgpack, JSON, string)
- Connection status management
- Promise-based publish/subscribe operations
- Automatic reconnection handling

## Using as a Git Submodule

1. Add the submodule to your existing project:

```bash
git submodule add https://github.com/your-username/mqtt-library.git mqtt
```

2. Initialize and update the submodule:

```bash
git submodule init
git submodule update
```

3. When cloning a project that uses this submodule:

```bash
git clone --recursive https://github.com/your-username/your-main-project.git
```

4. To update the submodule to latest version:

```bash
git submodule update --remote mqtt
```

## JavaScript Usage (Vue.js)

### Installation

1. Install dependencies:

```bash
npm install mqtt @msgpack/msgpack
```

### Usage Example

```javascript
import { useMqtt } from "./mqtt/javascript/useMqtt";

// In your Vue component
export default {
  setup() {
    const { connect, publish, subscribe, cleanup, connectionStatus } = useMqtt({
      url: "ws://your-broker:8883",
      encoding: "msgpack", // or 'json' or 'string'
    });

    // Connect to broker
    connect();

    // Subscribe to a topic
    const subscribeTopic = async () => {
      try {
        await subscribe("my/topic");
        console.log("Subscribed successfully");
      } catch (error) {
        console.error("Subscribe error:", error);
      }
    };

    // Publish a message
    const publishMessage = async () => {
      try {
        await publish("my/topic", { message: "Hello MQTT!" });
        console.log("Published successfully");
      } catch (error) {
        console.error("Publish error:", error);
      }
    };

    // Cleanup on component unmount
    onUnmounted(() => {
      cleanup();
    });

    return {
      connectionStatus,
      subscribeTopic,
      publishMessage,
    };
  },
};
```

### JavaScript Configuration Options

```javascript
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
```

## Python Usage

### Installation

1. Install required packages:

```bash
pip install paho-mqtt msgpack certifi
```

### Usage Example

```python
from mqtt.python.handler import MQTTHandler
from mqtt.python.service import MQTTService

# Using the handler directly
handler = MQTTHandler(
    host="localhost",
    port=8883,
    username="your-username",  # optional
    password="your-password",  # optional
    transport="websockets",    # optional, defaults to 'websockets'
    encoding="msgpack"        # optional, defaults to 'msgpack'
)

# Publish a message
handler.publish("my-topic", {"message": "Hello MQTT!"})

# Using the service with a callback
def process_message(topic, data):
    print(f"Received message on {topic}: {data}")

service = MQTTService(
    subscription_topic="my/topic/#",
    processor_callback=process_message
)
service.run()
```

### Python Configuration

The MQTTHandler can be configured through constructor parameters:

| Parameter | Default    | Description                               |
| --------- | ---------- | ----------------------------------------- |
| host      | localhost  | MQTT broker hostname                      |
| port      | 8883       | MQTT broker port (TLS enabled by default) |
| transport | websockets | Transport protocol (websockets or tcp)    |
| username  | ""         | Broker authentication username            |
| password  | ""         | Broker authentication password            |
| encoding  | msgpack    | Message encoding format (msgpack/json)    |

All parameters are optional and will fall back to their default values if not specified. TLS/SSL is enabled by default using system certificates.

### Key Features

- Automatic message encoding/decoding (msgpack/JSON)
- TLS/SSL support enabled by default
- Automatic reconnection handling
- Simple publish/subscribe interface
- Service implementation for long-running subscribers
- Callback-based message processing

## License

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
