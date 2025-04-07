# engine/mqtt/handler.py
import paho.mqtt.client as mqtt
import ssl
import certifi
import json
import msgpack
import logging
import os
from time import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class MQTTHandler:
    """MQTT Handler for publishing and subscribing"""

    # Class level constants from env vars with defaults
    MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
    MQTT_PORT = int(os.getenv('MQTT_PORT', "8883"))
    MQTT_USERNAME = os.getenv('MQTT_USERNAME', '')
    MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '')
    MQTT_TRANSPORT = os.getenv('MQTT_TRANSPORT', 'websockets')
    ENCODING = os.getenv('ENCODING', 'msgpack')
    RESULT_TOPIC = os.getenv('RESULT_TOPIC', 'results/{slug}')
    ERROR_TOPIC = os.getenv('ERROR_TOPIC', 'errors/{slug}')

    def __init__(self):
        self.client = self._setup_mqtt_client()

    def _setup_mqtt_client(self):
        """Setup MQTT client with basic configuration"""
        client_id = f"gscorer_{os.getpid()}"
        logger.info(f"Setting up MQTT client with ID: {client_id}")

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
            logger.error(f"Failed to connect to MQTT broker: {e}")
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
            logger.error(f"Failed to decode message: {e}")
            return None

    def encode_message(self, data):
        """Encode outgoing MQTT message"""
        try:
            if self.ENCODING == "msgpack":
                return msgpack.packb(data, use_bin_type=True)
            return json.dumps(data).encode()
        except Exception as e:
            logger.error(f"Failed to encode message: {e}")
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

    def publish_result(self, slug, result, qos=0, retain=False):
        """Publish successful result"""
        try:
            topic = self.RESULT_TOPIC.format(slug=slug)
            payload = self.encode_message(result)
            if payload:
                logger.info(f"Publishing result at {topic}")
                return self.client.publish(topic, payload, qos=qos, retain=retain)
            else:
                raise ValueError("Failed to encode result payload")
        except Exception as e:
            logger.error(f"Error publishing result for {slug}: {e}")
            return self.publish_error(
                slug, "publish_error", {"error": str(e), "slug": slug}
            )

    def publish_error(self, slug, error_type, details, qos=0, retain=False):
        """Publish error message"""
        try:
            topic = self.ERROR_TOPIC.format(slug=slug)
            error_data = {"timestamp": time(), "type": error_type, "details": details}
            payload = self.encode_message(error_data)
            if payload:
                logger.error(f"Publishing error: {error_type}")
                return self.client.publish(topic, payload, qos=qos, retain=retain)
            else:
                logger.error(f"Failed to encode error payload: {error_data}")
        except Exception as e:
            logger.error(f"Failed to publish error message: {e}")

    def __del__(self):
        """Cleanup when the handler is destroyed"""
        self.disconnect()
