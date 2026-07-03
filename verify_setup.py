# verify_setup.py
# Week 0 sanity check: read DB credentials from .env, connect to MySQL,
# and count the rows in both core tables to prove the environment works.

import os
from dotenv import load_dotenv
import mysql.connector

# 1) Load the key=value pairs from .env into the environment
load_dotenv()

# 2) Open a connection to MySQL using those credentials
conn = mysql.connector.connect(
    host=os.getenv("MYSQL_HOST"),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
)
cursor = conn.cursor()

# 3) Count rows in each table
cursor.execute("SELECT COUNT(*) FROM rets_property")
active_listings = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM california_sold")
sold_comps = cursor.fetchone()[0]

# 4) Report the result
print("Connected to database:", os.getenv("MYSQL_DATABASE"))
print(f"  rets_property  (active listings): {active_listings:,}")
print(f"  california_sold (sold comps):     {sold_comps:,}")

# 5) Clean up
cursor.close()
conn.close()
