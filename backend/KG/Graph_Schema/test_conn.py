import traceback, os, sys
from dotenv import load_dotenv
load_dotenv()

print(f"NEO4J_URI: {os.getenv('NEO4J_URI')}")
print(f"NEO4J_USERNAME: {os.getenv('NEO4J_USERNAME')}")
print(f"NEO4J_PASSWORD: {'*' * len(os.getenv('NEO4J_PASSWORD', ''))}")

from neo4j import GraphDatabase, __version__
print(f"Driver version: {__version__}")

try:
    d = GraphDatabase.driver(
        os.environ['NEO4J_URI'],
        auth=(os.environ['NEO4J_USERNAME'], os.environ['NEO4J_PASSWORD'])
    )
    d.verify_connectivity()
    print("SUCCESS - Connected!")
    d.close()
except Exception as e:
    print(f"\nERROR TYPE: {type(e).__name__}")
    print(f"ERROR MSG: {e}")
    print(f"\nFULL TRACEBACK:")
    traceback.print_exc()
