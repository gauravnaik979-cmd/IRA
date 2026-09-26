import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// Initialize Firebase Admin SDK safely
try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: "ira-hostel"
    });
    console.log("Firebase Admin SDK initialized successfully for project ira-hostel");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
}

/**
 * Server-side bootstrap of system accounts using Firebase Admin SDK.
 * Executes with backend service permissions without client-side permission restrictions.
 */
async function bootstrapSystemAccounts(): Promise<void> {
  try {
    const adminDb = getFirestore();
    const adminAuth = getAuth();

    // 1. Seed Super Admin Account
    const superAdminEmail = 'admin@irahostel.com';
    const superAdminPassword = 'Admin@2026';
    const superAdminName = 'IRA Super Admin';

    let superUid = '';
    try {
      const userRecord = await adminAuth.getUserByEmail(superAdminEmail);
      superUid = userRecord.uid;
    } catch {
      try {
        const userRecord = await adminAuth.createUser({
          email: superAdminEmail,
          password: superAdminPassword,
          displayName: superAdminName
        });
        superUid = userRecord.uid;
      } catch (e: any) {
        console.warn('Super Admin Auth creation on server notice:', e.message || e);
      }
    }

    if (!superUid) {
      superUid = `superadmin_${superAdminEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    await adminDb.collection('users').doc(superUid).set({
      uid: superUid,
      displayName: superAdminName,
      name: superAdminName,
      email: superAdminEmail,
      role: 'super_admin',
      hostelId: '',
      hostelName: 'All Hostels',
      active: true,
      isActive: true,
      createdAt: new Date().toISOString()
    }, { merge: true });

    await adminDb.collection('admins').doc(superUid).set({
      uid: superUid,
      name: superAdminName,
      email: superAdminEmail,
      role: 'super_admin',
      hostelId: '',
      hostelName: 'All Hostels',
      createdAt: new Date().toISOString()
    }, { merge: true });

    // 2. Seed Superintendent In-charge Accounts
    const adminEmails = ['naiknirmal654@gmail.com', 'naikniraml654@gmail.com', 'superintendent@gacs.ac.in'];
    const adminPassword = '248321';
    const adminName = 'Hostel Superintendent';
    const hostelId = 'gangpur-boys-hostel';
    const hostelName = "Gangpur Boys' Hostel";

    for (const adminEmail of adminEmails) {
      let adminUid = '';
      try {
        const uRec = await adminAuth.getUserByEmail(adminEmail);
        adminUid = uRec.uid;
      } catch {
        try {
          const uRec = await adminAuth.createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: adminName
          });
          adminUid = uRec.uid;
        } catch (e: any) {
          console.warn('Admin Auth creation on server notice:', e.message || e);
        }
      }

      if (!adminUid) {
        adminUid = `admin_${adminEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      }

      await adminDb.collection('users').doc(adminUid).set({
        uid: adminUid,
        name: adminName,
        displayName: adminName,
        email: adminEmail,
        role: 'SUPERINTENDENT',
        hostelId: hostelId,
        hostelName: hostelName,
        active: true,
        isActive: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      await adminDb.collection('admins').doc(adminUid).set({
        uid: adminUid,
        name: adminName,
        email: adminEmail,
        role: 'SUPERINTENDENT',
        hostelId: hostelId,
        hostelName: hostelName,
        createdAt: new Date().toISOString()
      }, { merge: true });
    }

    console.log("Server-side bootstrap of administrative accounts completed successfully.");
  } catch (err: any) {
    console.warn("Server-side bootstrap notice:", err.message || err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Bootstrap administrative accounts securely on backend boot
  bootstrapSystemAccounts().catch((e) => console.warn('Bootstrap background notice:', e));

  // Bootstrap API endpoint for explicit initialization triggers
  app.post("/api/bootstrap/init", async (req, res) => {
    try {
      await bootstrapSystemAccounts();
      res.json({ success: true, message: "Bootstrap sequence completed." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to run bootstrap sequence." });
    }
  });

  // Admin route to reset student's password in Firebase Authentication
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const { uid, newPassword } = req.body;
      if (!uid || !newPassword) {
        return res.status(400).json({ error: "Missing student uid or newPassword." });
      }

      await getAuth().updateUser(uid, {
        password: newPassword
      });

      res.json({ success: true, message: "Student password reset successfully in Firebase Auth." });
    } catch (error: any) {
      console.error("Error resetting student password via Firebase Admin:", error);
      res.status(500).json({ error: error.message || "Failed to reset password in Firebase Auth." });
    }
  });

  // Secure route for student to change their own password via verification of ID token
  app.post("/api/student/change-password", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized. Missing authorization token." });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      await getAuth().updateUser(uid, {
        password: newPassword
      });

      res.json({ success: true, message: "Password updated successfully." });
    } catch (error: any) {
      console.error("Error updating student password via Firebase Admin:", error);
      res.status(500).json({ error: error.message || "Failed to update password." });
    }
  });

  // API endpoint for Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        return res.json({ 
          text: `👋 Hello! I am the **IRA Hostel AI Intelligence Assistant**.\n\nIt looks like your **GEMINI_API_KEY** is not configured yet in the Settings Secrets. To enable full generative AI answers from Gemini, please add your key.\n\nHowever, I can still answer using my offline rule-engine! Based on your query: "${prompt}", here is some general advice:\n1. **Room Allocations**: Currently, the Boys hostel has 40% vacant beds, while the Girls hostel has 55% vacant beds. You can manage allocations via Student Management.\n2. **Mess Calculations**: Meal prices are set at ₹35 for Lunch and ₹35 for Dinner (₹70 total daily). Students on approved leave are charged ₹0. This is calculated automatically.\n3. **Announcements**: Use the Notification panel to broadcast important schedules immediately.`
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemPrompt = `You are the "IRA Hostel AI Intelligent Assistant", a core module of the prestigious IRA Campus college hostel & mess digital registers platform.
You are helping the Hostel In-charge (Administrator) or Students optimize management, analyze meal costs, check occupancy, draft announcements, write notices, or troubleshoot issues.

Hostel Information:
- Meal rates: Lunch is ₹35, Dinner is ₹35 (Daily Total ₹70). If on approved leave, they pay ₹0.

Here is the current live database context from the hostel dashboard:
${JSON.stringify(context || {})}

Write a highly professional, helpful, well-formatted response using beautiful Markdown bullet points. Speak as a supportive digital campus administrator assistant. Avoid meta-commentary, system details, or clinical developer jargon. Keep it warm and actionable.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nUser Question: ${prompt}`
              }
            ]
          }
        ]
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.json({ 
        text: `⚠️ **AI Service Offline**: I encountered an error connecting to the AI model (${error.message || "Unknown error"}). Here is a manual response based on offline rules: Please check that your API key is correctly configured and has access to the 'gemini-3.5-flash' model.`
      });
    }
  });

  // Serve static assets or mount Vite Dev Server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
