require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const server = express();
server.use(cors());
server.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
let db=client.db("Chatbot");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3.5-flash"
});

server.post("/chat", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  try {
    const result = await model.generateContent(prompt);
    await db.collection("Prompt").insertOne({ prompt: prompt, response: result.response.text() });
    return res.json({ response: result.response.text() });
  } catch (error) {
    console.error("Full error:", JSON.stringify(error, null, 2));
    return res.status(500).json({ error: error.message });
  }
});
server.get("/prompts", async (req, res) => {
    var prompts = await db.collection("Prompt").find().toArray();
    return res.json({ "success": true, "prompts": prompts });
});

(async () => {
  try {
    await client.connect();
    db = client.db("Chatbot");
    console.log("MongoDB Connected");
    server.listen(7000, () => {
      console.log("Server running on port 7000");
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
})();