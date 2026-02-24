import os
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from neo4j import GraphDatabase
import cmd

load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-3-flash-preview")

# Neo4j Aura from .env
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

class GraphRAGCLI(cmd.Cmd):
    intro = "HealthLink Graph RAG CLI – ask questions about your graph. Type 'help' or '?' for commands.\n"
    prompt = "(graph-rag) "

    def __init__(self):
        super().__init__()
        self.conversation = []  # store chat history for context

    def do_ask(self, question):
        """Ask a question about the graph (main command)"""
        if not question.strip():
            print("Please enter a question.")
            return

        print(f"\nQuestion: {question}")

        # 1. Generate Cypher query using Gemini
        cypher_prompt = f"""
You are an expert Neo4j Cypher query writer for a medical knowledge graph.
Nodes are HealthEntity with properties: name, type (Patient, Test, Value, Drug, Diagnosis, etc.)
Relationships have types like HAS_NAME, HAS_DIAGNOSIS, HAS_VALUE, PRESCRIBED_DOSE, etc.
and property 'date' (visit/measurement date).

User question: "{question}"

Generate a SINGLE valid Cypher query that answers this question.
Use MATCH, RETURN, ORDER BY date if needed.
If the question is about trends, use ORDER BY and collect values.
If unsure, return a query that gets relevant data.

Output ONLY the Cypher query – no explanations, no markdown.
"""

        cypher_response = model.generate_content(cypher_prompt)
        cypher_query = cypher_response.text.strip()

        print(f"\nGenerated Cypher:\n{cypher_query}")

        # 2. Execute Cypher
        try:
            with driver.session() as session:
                result = session.run(cypher_query)
                records = [dict(r) for r in result]
        except Exception as e:
            print(f"Query error: {e}")
            return

        if not records:
            print("No data found for this question.")
            return

        # 3. Format retrieved facts for LLM
        facts = []
        for r in records:
            facts.append(str(r))

        facts_text = "\n".join(facts[:20])  # limit to avoid token overflow

        # 4. Generate natural answer using retrieved facts
        answer_prompt = f"""
You are a helpful medical assistant answering based ONLY on the facts below.
Do NOT hallucinate or add information not present in the facts.

Question: {question}

Retrieved facts:
{facts_text}

Provide a clear, concise, human-sounding answer.
If data is missing, say so.
"""

        answer_response = model.generate_content(answer_prompt)
        answer = answer_response.text.strip()

        print(f"\nAnswer:\n{answer}\n")

        # Add to conversation history
        self.conversation.append({"question": question, "answer": answer})

    def do_history(self, arg):
        """Show conversation history"""
        if not self.conversation:
            print("No questions asked yet.")
            return
        for i, item in enumerate(self.conversation, 1):
            print(f"{i}. Q: {item['question']}")
            print(f"   A: {item['answer'][:200]}...\n")

    def do_exit(self, arg):
        """Exit the CLI"""
        print("Goodbye.")
        return True

    def do_quit(self, arg):
        """Alias for exit"""
        return self.do_exit(arg)

if __name__ == "__main__":
    print("HealthLink Graph RAG CLI ready.")
    print("Commands: ask <question>, history, exit")
    GraphRAGCLI().cmdloop()