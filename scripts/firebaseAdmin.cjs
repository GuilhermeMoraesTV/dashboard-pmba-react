const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const credentialsPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error(
      "Defina FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH ou GOOGLE_APPLICATION_CREDENTIALS para rodar scripts admin."
    );
  }

  const resolvedPath = path.resolve(credentialsPath);
  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) return admin;

  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
  });

  return admin;
}

module.exports = { initializeFirebaseAdmin };
