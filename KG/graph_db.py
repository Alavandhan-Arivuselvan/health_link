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

    def create_patient(self, name, age, gender):
        query = """
        MERGE (p:Patient)
        SET p.name=$name, p.age=$age, p.gender=$gender
        """
        return self.run_query(query, {
            "name": name,
            "age": age,
            "gender": gender
        })
    
    def create_visit(self, date, doc_id):
        query = """
        MERGE (v:Visit {doc_id: $doc_id})
        SET v.date = $date
        """
        return self.run_query(query, {
            "date": date,
            "doc_id": doc_id
        })

    def link_patient_visit(self, doc_id):
        query = """
        MATCH (p:Patient)
        MATCH (v:Visit {doc_id:$doc_id})
        MERGE (p)-[:HAD_VISIT]->(v)
        """
        return self.run_query(query, {"doc_id": doc_id})
    
    def attach_hospital_to_visit(self, doc_id, hospital):
        query = """
        MATCH (v:Visit {doc_id:$doc_id})
        MERGE (h:Hospital {name:$hospital})
        MERGE (v)-[:AT]->(h)
        """
        return self.run_query(query,{
            "doc_id":doc_id,
            "hospital":hospital
        })
    
    def attach_conditions(self, doc_id, diagnoses):
        query = """
        MATCH (v:Visit {doc_id:$doc_id})
        UNWIND $diags AS d
        MERGE (c:Condition {name:d})
        MERGE (v)-[:DIAGNOSED_WITH]->(c)
        """
        return self.run_query(query,{
            "doc_id":doc_id,
            "diags":diagnoses
        })
    
    def attach_medications(self, doc_id, meds):
        query = """
        MATCH (v:Visit {doc_id:$doc_id})
        UNWIND $meds AS m
        MERGE (med:Medication {name:m.name})
        MERGE (v)-[r:PRESCRIBED]->(med)
        SET r.dosage=m.dosage, r.frequency=m.frequency
        """
        return self.run_query(query,{
            "doc_id":doc_id,
            "meds":meds
        })
    
if __name__ == "__main__":
    db = GraphDB()

    doc_id="doc_test_1"

    db.create_patient("Agiless",22,"Unknown")
    db.create_visit("2026-02-22",doc_id)
    db.link_patient_visit(doc_id)

    db.attach_hospital_to_visit(doc_id,"Wearable ML Engine")

    db.attach_conditions(doc_id,[
        "Diabetes Mellitus",
        "Elevated Heart Risk Detected"
    ])

    db.attach_medications(doc_id,[
        {"name":"Metformin","dosage":"500mg","frequency":"Twice Daily"}
    ])
    db.close()