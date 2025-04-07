import logging
from .handler import MQTTHandler

logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self, handler,subscription_topic=None, processor_callback=None):
        
        self.mqtt = handler
        self.topic = subscription_topic
        self.processor_callback = processor_callback
        self._subscribed = False
        self._running = True
        logger.info("Setting up MQTT service...")
        self.mqtt.setup_callbacks(
            on_connect=self.on_connect,
            on_message=self.on_message,
            on_subscribe=self.on_subscribe,
            on_disconnect=self.on_disconnect,
        )
        self.message_count = 0
        logger.info("Will subscribe to topic: %s", self.topic)

    def on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            logger.info("Connected to MQTT broker")
            if not self._subscribed and self.topic:
                logger.info("Subscribing to topic: %s", self.topic)
                result, mid = self.mqtt.subscribe(self.topic, qos=1)
                logger.info("Subscribe request sent with MID: %s for topic: %s (result: %s", mid, self.topic, result)
                self._subscribed = True
        else:
            error_codes = {
                1: "Connection refused - incorrect protocol version",
                2: "Connection refused - invalid client identifier",
                3: "Connection refused - server unavailable",
                4: "Connection refused - bad username or password",
                5: "Connection refused - not authorised",
            }
            logger.error("Connection failed with code %s: %s", rc, error_codes.get(rc, 'Unknown error'))
            self._subscribed = False

    def on_subscribe(self, client, userdata, mid, granted_qos, properties=None):
        logger.info("Subscription confirmed for MID: %s", mid)
        self._subscribed = True

    def on_disconnect(self, client, userdata, rc, properties=None, reason_code=None):
        logger.warning("Disconnected with result code: %s", rc)
        self._subscribed = False
        if self._running:
            try:
                client.reconnect()
            except Exception as e:
                logger.error("Reconnection attempt failed: str(%s)",e)

    def on_message(self, client, userdata, msg):
        try:
            logger.info("Received message on topic: %s", msg.topic)
            data = self.mqtt.decode_message(msg.payload)
            if data is None:
                logger.error("Failed to decode message from %s", msg.topic)
                return

            if self.processor_callback:
                self.processor_callback(msg.topic, data)
                logger.info("Processed message with callback")
                self.message_count += 1
            else:
                logger.info("No processor callback provided, skipping processing")
        except Exception as e:
            logger.error("Error processing message from %s: %s", msg.topic, e)

    def run(self):
        try:
            logger.info("Starting MQTT service...")
            self.message_count = 0
            self._running = True
            self.mqtt.loop_forever(timeout=1.0)
        except KeyboardInterrupt:
            logger.info("Shutting down MQTT service...")
            self._running = False
        except Exception as e:
            logger.error("Error in MQTT service: %s", str(e))
        finally:
            self._running = False
            self._subscribed = False
            if self.mqtt.is_connected():
                self.mqtt.disconnect()
            logger.info(
                "MQTT service shutdown complete. Total messages processed: %s",self.message_count
            )
