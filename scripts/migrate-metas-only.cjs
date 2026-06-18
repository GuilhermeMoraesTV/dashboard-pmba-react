// Arquivo: migrate-metas-only.cjs
const { initializeFirebaseAdmin } = require("./firebaseAdmin.cjs");
const admin = initializeFirebaseAdmin();

const db = admin.firestore();

// -----------------------------------------------------------------
// O UID da sua conta de estudos 'teste@gmail.com'
const MIGRATION_USER_ID = "OLoJi457GQNE2eTSOcz9DAD6ppZ2";
// -----------------------------------------------------------------

// Função para migrar a coleção 'metas'
async function migrateMetas() {
  console.log("Iniciando migração de 'metas'...");
  const oldSnapshot = await db.collection('metas').get();

  if (oldSnapshot.empty) {
    console.log("  -> Nenhuma meta encontrada para migrar.");
    return;
  }

  const batch = db.batch();
  let invalidDocs = 0;

  oldSnapshot.docs.forEach(doc => {
    const oldData = doc.data();
    const newRef = db.collection('users').doc(MIGRATION_USER_ID)
                     .collection('metas').doc(doc.id); // Mantém o ID antigo

    // --- VERIFICAÇÃO DE DATA ROBUSTA ---
    let validTimestamp;
    const dateString = oldData.date;
    let validStartDate = dateString;

    // Verifica se a data é uma string válida no formato AAAA-MM-DD
    if (dateString && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      validTimestamp = admin.firestore.Timestamp.fromDate(new Date(dateString + 'T03:00:00Z'));
    } else {
      // Fallback: Se a data estiver ausente, nula ou em formato inválido
      console.warn(`  [AVISO] Documento 'metas' com ID ${doc.id} tem data inválida ('${dateString}'). Usando a data/hora atual como timestamp.`);
      validTimestamp = admin.firestore.FieldValue.serverTimestamp();
      // Se a data original for inválida, usa a data de hoje como string
      validStartDate = new Date().toISOString().split('T')[0];
      invalidDocs++;
    }
    // --- FIM DA VERIFICAÇÃO ---

    batch.set(newRef, {
      questions: oldData.questions || 0,
      hours: oldData.hours || 0,
      startDate: validStartDate, // Usa a data válida ou o fallback
      timestamp: validTimestamp   // Usa o timestamp válido ou o fallback
    });
  });

  await batch.commit();
  console.log(`✅ 'metas' migradas com sucesso (${oldSnapshot.size} metas movidas para 'users/${MIGRATION_USER_ID}/metas').`);
  if (invalidDocs > 0) {
    console.log(`  -> ${invalidDocs} documento(s) de meta estavam com data inválida e tiveram seu timestamp ajustado.`);
  }
}

// Roda a migração
async function runMigration() {
  console.log("========================================");
  console.log("INICIANDO MIGRAÇÃO (V2) - APENAS METAS");
  console.log(`Todos os dados pertencerão ao usuário: ${MIGRATION_USER_ID}`);
  console.log("========================================");

  try {
    await migrateMetas();
    console.log("\n========================================");
    console.log("🎉 MIGRAÇÃO DAS METAS CONCLUÍDA! 🎉");
    console.log("========================================");
  } catch (error) {
    console.error("❌ ERRO DURANTE A MIGRAÇÃO DAS METAS:", error);
  }
}

runMigration();
