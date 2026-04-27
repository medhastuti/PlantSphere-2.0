import firebase_admin
from firebase_admin import credentials, db
import paho.mqtt.client as mqtt
import json

# Firebase setup
cred = credentials.Certificate("serviceAccountKey.json")

firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://plantsphere-b13e7-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# MQTT setup
client = mqtt.Client()
client.connect("broker.hivemq.com", 1883, 60)
client.loop_start()   # IMPORTANT

def send_to_mqtt(data):
    try:
        client.publish("iot/plantsphere/environment/temperature", str(data["environment"]["temperature"]), retain=True)
        client.publish("iot/plantsphere/environment/humidity", str(data["environment"]["humidity"]), retain=True)

        client.publish("iot/plantsphere/soil", str(data["soil"]["value"]), retain=True)
        client.publish("iot/plantsphere/water", str(data["water"]["value"]), retain=True)
        client.publish("iot/plantsphere/ldr", str(data["ldr"]["value"]), retain=True)
        client.publish("iot/plantsphere/solar", str(data["solar"]["voltage"]), retain=True)

        client.publish("iot/plantsphere/pump/state", data["pump"]["state"], retain=True)

        client.publish("iot/plantsphere/device/status",
                       json.dumps(data["deviceStatus"]["nodemcu"]),
                       retain=True)

        print("MQTT Sent ✅")

    except Exception as e:
        print("Error:", e)

# Listen Firebase
ref = db.reference("/")

def listener(event):
    data = ref.get()
    if data:
        send_to_mqtt(data)

ref.listen(listener)