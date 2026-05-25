require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const server = express();
const cors = require("cors");

server.use(cors({
  origin: "https://chatbotfrontend-blush.vercel.app"
}));
server.use(express.json());

const client = new MongoClient(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 5000,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

async function getDb() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db("Chatbot");
}

server.post("/chat", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  try {
    const db = await getDb();
    const result = await model.generateContent(prompt);
    await db.collection("Prompt").insertOne({ prompt: prompt, response: result.response.text() });
    return res.json({ response: result.response.text() });
  } catch (error) {
    console.error("Full error:", JSON.stringify(error, null, 2));
    return res.status(500).json({ error: error.message });
  }
});

server.get("/prompts", async (req, res) => {
  try {
    const db = await getDb();
    const prompts = await db.collection("Prompt").find().toArray();
    return res.json({ success: true, prompts: prompts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = server;