from flask import Flask, render_template, jsonify, send_file
import sqlite3
import csv
import os

app = Flask(__name__)

def get_db():
    return sqlite3.connect("plantsphere.db")

# ---------- HOME ----------
@app.route("/")
def dashboard():
    return render_template("dashboard.html")

# ---------- CAMERA ----------
@app.route("/camera")
def cam():
    return render_template("camera.html")

# ---------- LIVE SENSOR ----------
@app.route("/sensor")
def sensor():
    return render_template("sensor.html")

# ---------- HISTORY ----------
@app.route("/history")
def index():
    return render_template("history.html")

# ---------- STATUS BREAKDOWN ----------
@app.route("/api/status-breakdown", methods=["GET"])
def status_breakdown():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    SELECT soil_moisture, temperature, humidity, light_level
    FROM sensor_data
    """)
    rows = cur.fetchall()
    conn.close()

    result = {"Healthy": 0, "Moderate": 0, "Critical": 0}

    def get_status(soil, temp, hum, light):
        if 40 <= hum <= 70 and 20 <= temp <= 30 and 400 <= soil <= 900:
            return "Healthy"
        elif 30 <= hum <= 80 and 15 <= temp <= 35:
            return "Moderate"
        else:
            return "Critical"

    for soil, temp, hum, light in rows:
        status = get_status(soil, temp, hum, light)
        result[status] += 1

    return jsonify(result)

# ---------- DAY PAGE ----------
@app.route("/day/<date>")
def day_page(date):
    return render_template("day.html", date=date)

# ---------- FILTERED SUMMARY ----------
@app.route("/api/summary/<range_type>")
def summary(range_type):
    conn = get_db()
    cur = conn.cursor()

    if range_type == "today":
        condition = "DATE(timestamp) = DATE('now')"
    elif range_type == "7days":
        condition = "timestamp >= datetime('now','-7 days')"
    else:
        condition = "timestamp >= datetime('now','-30 days')"

    cur.execute(f"""
    SELECT 
        DATE(timestamp),
        AVG(soil_moisture),
        AVG(temperature),
        AVG(humidity),
        AVG(light_level)
    FROM sensor_data
    WHERE {condition}
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp) DESC
    """)

    rows = cur.fetchall()
    conn.close()

    result = []
    
    def get_status(soil, temp, hum, light):
        if 40 <= hum <= 70 and 20 <= temp <= 30 and 400 <= soil <= 900:
            return "Healthy"
        elif 30 <= hum <= 80 and 15 <= temp <= 35:
            return "Moderate"
        else:
            return "Critical"

    for r in rows:
        soil, temp, hum, light = r[1], r[2], r[3], r[4]

        status = get_status(soil, temp, hum, light)

        result.append({
            "date": r[0],
            "soil": round(soil or 0, 1),
            "temp": round(temp or 0, 1),
            "humidity": round(hum or 0, 1),
            "light": round(light or 0, 1),
            "status": status
        })

    return jsonify(result[::-1])

# ---------- DAY DETAILS ----------
@app.route("/api/day-summary/<date>")
def day_summary(date):
    conn = get_db()
    cur = conn.cursor()

    # 🔥 FIXED: use substr instead of DATE()
    cur.execute("""
    SELECT soil_moisture, temperature, humidity, light_level
    FROM sensor_data
    WHERE substr(timestamp,1,10) = ?
    """, (date,))

    rows = cur.fetchall()
    conn.close()

    # ❌ no data case
    if not rows:
        return jsonify({
            "soil": None,
            "temp": None,
            "humidity": None,
            "light": None,
            "status": None
        })

    # extract values safely
    soils = [r[0] for r in rows if r[0] is not None]
    temps = [r[1] for r in rows if r[1] is not None]
    hums = [r[2] for r in rows if r[2] is not None]
    lights = [r[3] for r in rows if r[3] is not None]

    # avoid division by zero
    avg_soil = sum(soils)/len(soils) if soils else None
    avg_temp = sum(temps)/len(temps) if temps else None
    avg_hum = sum(hums)/len(hums) if hums else None
    avg_light = sum(lights)/len(lights) if lights else None

    # 🔥 improved health logic
    def get_status(soil, temp, hum):
        if soil is None or temp is None or hum is None:
            return None

        if 40 <= hum <= 70 and 20 <= temp <= 30 and 400 <= soil <= 900:
            return "Healthy"
        elif 30 <= hum <= 80 and 15 <= temp <= 35:
            return "Moderate"
        else:
            return "Critical"

    status = get_status(avg_soil, avg_temp, avg_hum)

    return jsonify({
        "soil": round(avg_soil, 1) if avg_soil is not None else None,
        "temp": round(avg_temp, 1) if avg_temp is not None else None,
        "humidity": round(avg_hum, 1) if avg_hum is not None else None,
        "light": round(avg_light, 1) if avg_light is not None else None,
        "status": status
    })

# ---------- DAY DETAILS (ALL READINGS) ----------
@app.route("/api/day/<date>")
def day_details(date):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    SELECT 
        timestamp,
        soil_moisture,
        temperature,
        humidity,
        light_level
    FROM sensor_data
    WHERE substr(timestamp,1,10) = ?
    ORDER BY timestamp
    """, (date,))

    rows = cur.fetchall()
    conn.close()

    result = []

    for r in rows:
        result.append({
            "time": str(r[0]),
            "soil": r[1],
            "temp": r[2],
            "humidity": r[3],
            "light": r[4]
        })

    return jsonify(result)

# ---------- AVERAGES ----------
@app.route("/api/averages/<range_type>")
def averages(range_type):
    conn = get_db()
    cur = conn.cursor()

    if range_type == "today":
        condition = "DATE(timestamp) = DATE('now')"
    elif range_type == "7days":
        condition = "timestamp >= datetime('now','-7 days')"
    else:
        condition = "timestamp >= datetime('now','-30 days')"

    cur.execute(f"""
    SELECT 
        AVG(soil_moisture),
        AVG(temperature),
        AVG(humidity),
        AVG(light_level)
    FROM sensor_data
    WHERE {condition}
    """)

    row = cur.fetchone()
    conn.close()

    soil, temp, hum, light = row

    return jsonify({
        "soil": round(soil or 0, 1),
        "temp": round(temp or 0, 1),
        "humidity": round(hum or 0, 1),
        "light": round(light or 0, 1)
    })

# ---------- DOWNLOAD CSV ----------
@app.route("/download")
def download():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT * FROM sensor_data")
    rows = cur.fetchall()

    with open("data.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["ID", "Time", "Soil", "Temp", "Humidity", "Light"])
        writer.writerows(rows)

    return send_file("data.csv", as_attachment=True)

# ---------- RUN ----------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
