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
pip install paho-mqtt msgpack certifi python-dotenv
```

2. Create a `.env` file in your project root:

```bash
# MQTT Broker Configuration
MQTT_HOST=localhost
MQTT_PORT=8883
MQTT_TRANSPORT=websockets

# Authentication (optional)
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password

# Message Configuration
ENCODING=msgpack

# Topics Configuration
RESULT_TOPIC=results/{slug}
```

### Usage Example

```python
from mqtt.python.handler import MQTTHandler
from mqtt.python.service import MQTTService

# Using the handler directly
handler = MQTTHandler()
handler.publish_result("my-topic", {"message": "Hello MQTT!"})

# Using the service with a callback
def process_message(data):
    print(f"Received message: {data}")

service = MQTTService(
    subscription_topic="my/topic/#",
    processor_callback=process_message
)
service.run()
```

### Python Environment Variables

| Variable       | Default        | Description                               |
| -------------- | -------------- | ----------------------------------------- |
| MQTT_HOST      | localhost      | MQTT broker hostname                      |
| MQTT_PORT      | 8883           | MQTT broker port (default is TLS port)    |
| MQTT_TRANSPORT | websockets     | Transport protocol (websockets or tcp)    |
| MQTT_USERNAME  | ""             | Broker authentication username (optional) |
| MQTT_PASSWORD  | ""             | Broker authentication password (optional) |
| ENCODING       | msgpack        | Message encoding format (msgpack or json) |
| RESULT_TOPIC   | results/{slug} | Topic format for results                  |

All environment variables are optional and will fall back to their default values if not specified.

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
