from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


class GraphDB:

    def __init__(self):
        self.driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD)
        )

    def close(self):
        self.driver.close()

    def run_query(self, query, parameters=None):
        with self.driver.session() as session:
            result = session.run(query, parameters)
            return list(result)

    def create_patient(self, name="Unknown", age=None, gender=None):
        query = """
        MERGE (p:Patient)
        SET p.name = $name,
            p.age = $age,
            p.gender = $gender
        RETURN p
        """
        return self.run_query(query, {
            "name": name,
            "age": age,
            "gender": gender
        })

    def create_visit(self, date, doc_id):
        query = """
        CREATE (v:Visit {
            date: $date,
            doc_id: $doc_id
        })
        RETURN v
        """
        return self.run_query(query, {
            "date": date,
            "doc_id": doc_id
        })

    def link_patient_visit(self):
        query = """
        MATCH (p:Patient), (v:Visit)
        WHERE NOT (p)-[:HAD_VISIT]->(v)
        CREATE (p)-[:HAD_VISIT]->(v)
        """
        return self.run_query(query)
    
    def attach_hospital_to_visit(self, hospital_name):
        query = """
        MATCH (v:Visit)
        MERGE (h:Hospital {name: $hospital})
        MERGE (v)-[:AT]->(h)
        RETURN h
        """
        return self.run_query(query, {"hospital": hospital_name})



if __name__ == "__main__":
    db = GraphDB()

    db.create_patient("Agiless", 22, "Unknown")
    db.create_visit("2026-02-22", "doc_test_1")
    db.link_patient_visit()
    
    db.attach_hospital_to_visit("Wearable ML Engine")

    print("Patient → Visit → Hospital created!")

    db.close()