import sqlite3
from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static')
CORS(app)

DATABASE = 'votes.db'
BIN_VALUES = [1, 2, 3, 4, 5]

# --- DB SETUP ---
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        cursor.execute('''CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL
        )''')

        cursor.execute('''CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 5),
            FOREIGN KEY(question_id) REFERENCES questions(id)
        )''')

        db.commit()

        # Insert initial questions only if table is empty
        cursor.execute("SELECT COUNT(*) FROM questions")
        if cursor.fetchone()[0] == 0:
            initial_questions = [
                "There are only two genders.",
                "Men and women are naturally suited for different roles in society.",
                "Affirmative action is reverse racism.",
                "Freedom of speech should protect all opinions, even offensive ones.",
                "Artificial intelligence poses a serious threat to humanity.",
                "The government should provide universal basic income.",
                "People have the right to end their own lives if they are suffering.",
                "Cancel culture has gone too far.",
                "Using animals for scientific research is justified.",
                "Social media does more harm than good.",
                "Poor people shouldn't have kids if they can't afford them.",
                "Criminals deserve harsh punishment, not rehabilitation.",
                "Some people are beyond redemption.",
                "Most people are stupid.",
                "Money does buy happiness.",
                "It's okay to choose the sex of your baby.",
                "Immigrants should fully assimilate to the culture of their new country.",
                "Some lives are worth more than others."
            ]
            cursor.executemany("INSERT INTO questions (text) VALUES (?)", [(q,) for q in initial_questions])
            db.commit()

@app.route("/api/questions")
def get_questions():
    db = get_db()
    cursor = db.execute("SELECT id, text FROM questions")
    questions = [dict(row) for row in cursor.fetchall()]
    return jsonify(questions)

@app.route("/api/vote", methods=["POST"])
def record_vote():
    data = request.json
    question_id = data["questionId"]
    value = int(round(float(data["value"])))
    if value < 1 or value > 5:
        return jsonify({"error": "Invalid vote value"}), 400

    db = get_db()
    db.execute("INSERT INTO votes (question_id, value) VALUES (?, ?)", (question_id, value))
    db.commit()

    return jsonify({"status": "ok"})

@app.route("/api/results/<int:question_id>")
def get_results(question_id):
    db = get_db()
    cursor = db.execute("SELECT value, COUNT(*) as count FROM votes WHERE question_id = ? GROUP BY value", (question_id,))
    counts_dict = {row["value"]: row["count"] for row in cursor.fetchall()}

    counts = [counts_dict.get(b, 0) for b in BIN_VALUES]
    total = sum(counts)

    if total == 0:
        percentages = [0] * len(BIN_VALUES)
        avg = 0.0
    else:
        percentages = [round(c / total * 100) for c in counts]
        weighted_sum = sum(c * val for c, val in zip(counts, BIN_VALUES))
        avg = round(weighted_sum / total, 2)

    return jsonify({
        "bins": BIN_VALUES,
        "percentages": percentages,
        "totalVotes": total,
        "avg": avg
    })

@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")

## production launch
with app.app_context():
    init_db()

if __name__ == "__main__":
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True, port=3000)
