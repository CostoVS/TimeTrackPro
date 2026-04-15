import streamlit as st
import pandas as pd
import psycopg2
from datetime import datetime, timedelta
import os

# Database connection
def get_db_connection():
    conn = psycopg2.connect(
        os.getenv("DATABASE_URL", "dbname=timetrack user=timetrack password=password host=localhost")
    )
    return conn

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            date DATE NOT NULL,
            clock_in TIMESTAMP,
            tea_out TIMESTAMP,
            tea_in TIMESTAMP,
            lunch_out TIMESTAMP,
            lunch_in TIMESTAMP,
            clock_out TIMESTAMP,
            total_hours FLOAT DEFAULT 0,
            status TEXT DEFAULT 'idle'
        )
    """)
    conn.commit()
    cur.close()
    conn.close()

def calculate_hours(row):
    if not row['clock_in'] or not row['clock_out']:
        return 0
    
    total = row['clock_out'] - row['clock_in']
    
    # Deduct lunch
    if row['lunch_out'] and row['lunch_in']:
        lunch = row['lunch_in'] - row['lunch_out']
        total -= lunch
        
    return max(0, total.total_seconds() / 3600)

st.set_page_config(page_title="TimeTrack Pro", layout="wide")
init_db()

st.title("⏱️ TimeTrack Pro")
st.write(f"Server: 62.171.158.235 | Port: 8502")

# Current Session Logic
conn = get_db_connection()
df_current = pd.read_sql("SELECT * FROM sessions WHERE clock_out IS NULL ORDER BY id DESC LIMIT 1", conn)
conn.close()

if not df_current.empty:
    session = df_current.iloc[0]
    status = session['status']
else:
    session = None
    status = 'idle'

col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("Action Center")
    if status == 'idle':
        if st.button("🚀 Clock In", use_container_width=True):
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("INSERT INTO sessions (date, clock_in, status) VALUES (%s, %s, %s)", 
                        (datetime.now().date(), datetime.now(), 'working'))
            conn.commit()
            st.rerun()
            
    elif status == 'working':
        if not session['tea_out']:
            if st.button("☕ Tea Break Out", use_container_width=True):
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("UPDATE sessions SET tea_out = %s, status = %s WHERE id = %s", (datetime.now(), 'on_tea', session['id']))
                conn.commit()
                st.rerun()
        elif not session['lunch_out']:
            if st.button("🍱 Lunch Break Out", use_container_width=True):
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("UPDATE sessions SET lunch_out = %s, status = %s WHERE id = %s", (datetime.now(), 'on_lunch', session['id']))
                conn.commit()
                st.rerun()
        else:
            if st.button("🚪 Clock Out", use_container_width=True):
                now = datetime.now()
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("UPDATE sessions SET clock_out = %s, status = %s WHERE id = %s", (now, 'done', session['id']))
                conn.commit()
                # Recalculate
                df = pd.read_sql(f"SELECT * FROM sessions WHERE id = {session['id']}", conn)
                hours = calculate_hours(df.iloc[0])
                cur.execute("UPDATE sessions SET total_hours = %s WHERE id = %s", (hours, session['id']))
                conn.commit()
                st.rerun()

    elif status == 'on_tea':
        if st.button("✅ Back to Work (Tea)", use_container_width=True):
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE sessions SET tea_in = %s, status = %s WHERE id = %s", (datetime.now(), 'working', session['id']))
            conn.commit()
            st.rerun()

    elif status == 'on_lunch':
        if st.button("✅ Back to Work (Lunch)", use_container_width=True):
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE sessions SET lunch_in = %s, status = %s WHERE id = %s", (datetime.now(), 'working', session['id']))
            conn.commit()
            st.rerun()

with col2:
    st.subheader("History")
    conn = get_db_connection()
    df_history = pd.read_sql("SELECT * FROM sessions ORDER BY date DESC, id DESC", conn)
    conn.close()
    
    st.dataframe(df_history, use_container_width=True)
    
    if st.button("📥 Download CSV"):
        csv = df_history.to_csv(index=False)
        st.download_button("Click to Download", csv, "timesheet.csv", "text/csv")

st.divider()
st.info("This Python app is a Streamlit alternative. The main app is built with React/Node for a more robust experience.")
