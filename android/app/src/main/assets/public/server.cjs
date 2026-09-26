var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
import_dotenv.default.config();
try {
  if ((0, import_app.getApps)().length === 0) {
    (0, import_app.initializeApp)({
      projectId: "ira-hostel"
    });
    console.log("Firebase Admin SDK initialized successfully for project ira-hostel");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const { uid, newPassword } = req.body;
      if (!uid || !newPassword) {
        return res.status(400).json({ error: "Missing student uid or newPassword." });
      }
      await (0, import_auth.getAuth)().updateUser(uid, {
        password: newPassword
      });
      res.json({ success: true, message: "Student password reset successfully in Firebase Auth." });
    } catch (error) {
      console.error("Error resetting student password via Firebase Admin:", error);
      res.status(500).json({ error: error.message || "Failed to reset password in Firebase Auth." });
    }
  });
  app.post("/api/student/change-password", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized. Missing authorization token." });
      }
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await (0, import_auth.getAuth)().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      await (0, import_auth.getAuth)().updateUser(uid, {
        password: newPassword
      });
      res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
      console.error("Error updating student password via Firebase Admin:", error);
      res.status(500).json({ error: error.message || "Failed to update password." });
    }
  });
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        return res.json({
          text: `\u{1F44B} Hello! I am the **IRA Hostel AI Intelligence Assistant**.

It looks like your **GEMINI_API_KEY** is not configured yet in the Settings Secrets. To enable full generative AI answers from Gemini, please add your key.

However, I can still answer using my offline rule-engine! Based on your query: "${prompt}", here is some general advice:
1. **Room Allocations**: Currently, the Boys hostel has 40% vacant beds, while the Girls hostel has 55% vacant beds. You can manage allocations via Student Management.
2. **Mess Calculations**: Meal prices are set at \u20B935 for Lunch and \u20B935 for Dinner (\u20B970 total daily). Students on approved leave are charged \u20B90. This is calculated automatically.
3. **Announcements**: Use the Notification panel to broadcast important schedules immediately.`
        });
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const systemPrompt = `You are the "IRA Hostel AI Intelligent Assistant", a core module of the prestigious IRA Campus college hostel & mess digital registers platform.
You are helping the Hostel In-charge (Administrator) or Students optimize management, analyze meal costs, check occupancy, draft announcements, write notices, or troubleshoot issues.

Hostel Information:
- Meal rates: Lunch is \u20B935, Dinner is \u20B935 (Daily Total \u20B970). If on approved leave, they pay \u20B90.

Here is the current live database context from the hostel dashboard:
${JSON.stringify(context || {})}

Write a highly professional, helpful, well-formatted response using beautiful Markdown bullet points. Speak as a supportive digital campus administrator assistant. Avoid meta-commentary, system details, or clinical developer jargon. Keep it warm and actionable.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}

User Question: ${prompt}`
              }
            ]
          }
        ]
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini Error:", error);
      res.json({
        text: `\u26A0\uFE0F **AI Service Offline**: I encountered an error connecting to the AI model (${error.message || "Unknown error"}). Here is a manual response based on offline rules: Please check that your API key is correctly configured and has access to the 'gemini-3.5-flash' model.`
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
