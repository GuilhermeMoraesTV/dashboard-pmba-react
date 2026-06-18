const { initializeFirebaseAdmin } = require("./firebaseAdmin.cjs");
const admin = initializeFirebaseAdmin();

const db = admin.firestore();

// -----------------------------------------------------------------
// O UID da sua conta de estudos 'teste@gmail.com'
const MIGRATION_USER_ID = "OLoJi457GQNE2eTSOcz9DAD6ppZ2";
// -----------------------------------------------------------------

// Função para migrar a coleção 'horas'
async function migrateHoras() {
  console.log("Iniciando migração de 'horas'...");
  const oldSnapshot = await db.collection('horas').get();

  if (oldSnapshot.empty) {
    console.log("  -> Nenhuma hora encontrada para migrar.");
    return;
  }

  const batch = db.batch();
  oldSnapshot.docs.forEach(doc => {
    const oldData = doc.data();
    const newRef = db.collection('users').doc(MIGRATION_USER_ID)
                     .collection('registrosEstudo').doc(); // Novo ID

    // Converte horas decimais (ex: 0.333) para minutos
    const tempoEmMinutos = Math.round((oldData.hours || 0) * 60);

    // Converte a string 'YYYY-MM-DD' para um Timestamp do Firebase
    const dataTimestamp = admin.firestore.Timestamp.fromDate(new Date(oldData.date + 'T03:00:00Z'));

    batch.set(newRef, {
      // Campos que o seu app novo espera (baseado no Home.jsx e RegistroEstudoModal.jsx)
      tipoEstudo: "Teoria", // Assumindo 'Teoria' como padrão
      data: oldData.date, // O app parece esperar a string YYYY-MM-DD
      timestamp: dataTimestamp, // Timestamp real para ordenação
      disciplinaNome: oldData.subject, // Mapeando 'subject' -> 'disciplinaNome'
      tempoEstudadoMinutos: tempoEmMinutos,
      duracaoMinutos: tempoEmMinutos, // Campo legado
      questoesFeitas: 0,
      acertos: 0,
      questoesAcertadas: 0,
      cicloId: null, // Dados antigos não têm ciclo
      disciplinaId: null,
      topicoId: null,
      topicoNome: null
    });
  });

  await batch.commit();
  console.log(`✅ 'horas' migradas com sucesso (${oldSnapshot.size} registros movidos para 'registrosEstudo').`);
}

// Função para migrar a coleção 'questoes'
async function migrateQuestoes() {
  console.log("Iniciando migração de 'questoes'...");
  const oldSnapshot = await db.collection('questoes').get();

  if (oldSnapshot.empty) {
    console.log("  -> Nenhuma questão encontrada para migrar.");
    return;
  }

  const batch = db.batch();
  oldSnapshot.docs.forEach(doc => {
    const oldData = doc.data();
    const newRef = db.collection('users').doc(MIGRATION_USER_ID)
                     .collection('registrosEstudo').doc(); // Novo ID

    const dataTimestamp = admin.firestore.Timestamp.fromDate(new Date(oldData.date + 'T03:00:00Z'));

    batch.set(newRef, {
      tipoEstudo: "Questões", // Definindo o tipo
      data: oldData.date,
      timestamp: dataTimestamp,
      disciplinaNome: oldData.subject, // Assumindo que você tinha um campo 'subject'
      tempoEstudadoMinutos: 0,
      duracaoMinutos: 0,
      questoesFeitas: oldData.questions || 0, // Mapeando 'questions' -> 'questoesFeitas'
      acertos: oldData.correct || 0, // Mapeando 'correct' -> 'acertos'
      questoesAcertadas: oldData.correct || 0,
      cicloId: null,
      disciplinaId: null,
      topicoId: null,
      topicoNome: null
    });
  });

  await batch.commit();
  console.log(`✅ 'questoes' migradas com sucesso (${oldSnapshot.size} registros movidos para 'registrosEstudo').`);
}

// Função para migrar a coleção 'metas'
async function migrateMetas() {
  console.log("Iniciando migração de 'metas'...");
  const oldSnapshot = await db.collection('metas').get();

  if (oldSnapshot.empty) {
    console.log("  -> Nenhuma meta encontrada para migrar.");
    return;
  }

  const batch = db.batch();
  oldSnapshot.docs.forEach(doc => {
    const oldData = doc.data();
    // O novo app espera 'metas' dentro do usuário (baseado no GoalsTab.jsx)
    const newRef = db.collection('users').doc(MIGRATION_USER_ID)
                     .collection('metas').doc(doc.id); // Mantém o ID antigo

    batch.set(newRef, {
      questions: oldData.questions || 0,
      hours: oldData.hours || 0,
      startDate: oldData.date, // Mapeando 'date' -> 'startDate'
      timestamp: admin.firestore.Timestamp.fromDate(new Date(oldData.date + 'T03:00:00Z'))
    });
  });

  await batch.commit();
  console.log(`✅ 'metas' migradas com sucesso (${oldSnapshot.size} metas movidas para 'users/${MIGRATION_USER_ID}/metas').`);
}

// Roda a migração completa
async function runMigration() {
  console.log("========================================");
  console.log("INICIANDO MIGRAÇÃO COMPLETA (V2)");
  console.log(`Todos os dados pertencerão ao usuário: ${MIGRATION_USER_ID}`);
  console.log("========================================");

  try {
    await migrateHoras();
    await migrateQuestoes();
    await migrateMetas();
    console.log("\n========================================");
    console.log("🎉 MIGRAÇÃO CONCLUÍDA! 🎉");
    console.log("Seus dados antigos agora estão na nova estrutura aninhada.");
    console.log("========================================");
  } catch (error) {
    console.error("❌ ERRO DURANTE A MIGRAÇÃO:", error);
  }
}

runMigration();
