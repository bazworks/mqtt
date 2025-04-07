# engine/mqtt/handler.py
import paho.mqtt.client as mqtt
import ssl
import certifi
import json
import msgpack
import logging
from time import time
import uuid


logger = logging.getLogger(__name__)

class MQTTHandler:
    """MQTT Handler for publishing and subscribing"""

    # Class level constants with defaults
    _MQTT_HOST = 'localhost'
    _MQTT_PORT = 8883
    _MQTT_USERNAME = ''
    _MQTT_PASSWORD = ''
    _MQTT_TRANSPORT = 'websockets'
    _ENCODING = 'msgpack'
    

    def __init__(self, host=None, port=None, username=None, password=None, transport=None, encoding=None, result_topic=None, error_topic=None):
        self.MQTT_HOST = host or self._MQTT_HOST
        self.MQTT_PORT = port or self._MQTT_PORT
        self.MQTT_USERNAME = username or self._MQTT_USERNAME
        self.MQTT_PASSWORD = password or self._MQTT_PASSWORD
        self.MQTT_TRANSPORT = transport or self._MQTT_TRANSPORT
        self.ENCODING = encoding or self._ENCODING
        self.client = self._setup_mqtt_client()

    def _setup_mqtt_client(self):
        """Setup MQTT client with basic configuration"""
        client_id = str(uuid.uuid4())
        logger.info("Setting up MQTT client with ID: %s", client_id)

        client = mqtt.Client(
            client_id=client_id,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            protocol=mqtt.MQTTv5,
            transport=self.MQTT_TRANSPORT,
        )

        # Set up authentication if credentials provided
        if self.MQTT_USERNAME and self.MQTT_PASSWORD:
            client.username_pw_set(self.MQTT_USERNAME, self.MQTT_PASSWORD)

        # Basic TLS setup
        client.tls_set(
            ca_certs=certifi.where(),
            tls_version=ssl.PROTOCOL_TLSv1_2,
        )
        client.tls_insecure_set(False)

        try:
            client.connect(
                self.MQTT_HOST,
                self.MQTT_PORT,
                keepalive=60,
            )
            logger.info("Connected to MQTT broker")
        except Exception as e:
            logger.error("Failed to connect to MQTT broker: %s", e)
            raise

        return client

    def decode_message(self, payload):
        """Decode incoming MQTT message"""
        try:
            # Try msgpack first
            try:
                return msgpack.unpackb(payload, raw=False)
            except Exception:
                # Try JSON next
                try:
                    return json.loads(payload.decode("utf-8"))
                except json.JSONDecodeError:
                    # Return as string if both decodings fail
                    return payload.decode("utf-8")
        except Exception as e:
            logger.error("Failed to decode message: %s", e)
            return None

    def encode_message(self, data):
        """Encode outgoing MQTT message"""
        try:
            if self.ENCODING == "msgpack":
                return msgpack.packb(data, use_bin_type=True)
            return json.dumps(data).encode()
        except Exception as e:
            logger.error("Failed to encode message: %s", e)
            return None

    def loop(self, timeout=1.0):
        """Wrapper for the client's loop method"""
        return self.client.loop(timeout)

    def loop_start(self):
        """Wrapper for the client's loop_start method"""
        return self.client.loop_start()

    def loop_stop(self):
        """Wrapper for the client's loop_stop method"""
        return self.client.loop_stop()

    def loop_forever(self, timeout=1.0):
        """Wrapper for the client's loop_forever method"""
        return self.client.loop_forever(timeout)

    def disconnect(self):
        """Wrapper for the client's disconnect method"""
        return self.client.disconnect()

    def is_connected(self):
        """Wrapper for the client's is_connected method"""
        return self.client.is_connected()

    def setup_callbacks(
        self, on_connect, on_message, on_subscribe=None, on_disconnect=None
    ):
        """Setup MQTT callbacks"""
        self.client.on_connect = on_connect
        self.client.on_message = on_message
        if on_subscribe:
            self.client.on_subscribe = on_subscribe
        if on_disconnect:
            self.client.on_disconnect = on_disconnect

    def subscribe(self, topic, qos=0):
        """Subscribe to a topic"""
        return self.client.subscribe(topic, qos)

    def publish(self, topic, payload, qos=0, retain=False):
        """Publish a message"""
        try:
            encoded_payload = self.encode_message(payload)
            if encoded_payload:
                logger.info("Publishing message to %s", topic)
                return self.client.publish(topic, encoded_payload, qos=qos, retain=retain)
            raise ValueError("Failed to encode payload")
        except Exception as e:
            logger.error("Error publishing message to %s: %s", topic, e)
            raise

    def __del__(self):
        """Cleanup when the handler is destroyed"""
        self.disconnect()
