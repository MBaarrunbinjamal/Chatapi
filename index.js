// main links
require("dotenv").config();
var express = require("express");
var { MongoClient } = require("mongodb");
var { GoogleGenerativeAI } = require("@google/generative-ai");
var bcrypt = require("bcrypt");
var Jwt = require("jsonwebtoken");
// server
var server = express();
var secretKey = process.env.JWT_SECRET || "your_secret_key";
// using server
server.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
server.use(express.json());
// midileware for authentication
function auth(req,res,next){
  var token =req.headers.authorization;
  if(!token){
    return res.status(401).json({error:"No token provided"});
  }
  else{
    try{
      var decoded = Jwt.verify(token, secretKey);
      next();
    } catch (error) {
      return res.status(401).json({error:"Invalid token"});
    }
  }
}
// db
var client = new MongoClient(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 5000,
});
// AI
var genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
var model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//connect to db
async function getDb() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db("Chatbot");
}
// chat
server.post("/chat", async (req, res) => {
  var { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  try {
    var db = await getDb();
    var result = await model.generateContent(prompt);
    await db.collection("Prompt").insertOne({ prompt, response: result.response.text() });
    return res.json({ response: result.response.text() });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
// get all prompts
server.get("/prompts", auth, async (req, res) => {
  try {
    var db = await getDb();
    var prompts = await db.collection("Prompt").find().toArray();
    return res.json({ success: true, prompts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
// user registration
server.post("/register", async (req, res) => {
  var { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
if(password.length<8||password.length>31){
 return res.status(400).json({ error: "The Password must be of greater than 8 charachters and less than 32" });
}
  try {
    var db = await getDb();
    var existingUser = await db.collection("Users").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    var hashedPassword = await bcrypt.hash(password, 10);
    var result = await db.collection("Users").insertOne({ username, email, password: hashedPassword });

    var token = Jwt.sign({ id: result.insertedId }, secretKey, { expiresIn: "7d" });

    return res.status(201).json({ success: true, message: "User registered successfully", token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}); 
// user login
server.post("/login", async (req, res) => {
  var { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    var db = await getDb();
    var user = await db.collection("Users").findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    var isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    var token = Jwt.sign({ id: user._id }, secretKey);
    return res.json({ success: true, message: "Login successful", username: user.username, token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
// start server
var PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});