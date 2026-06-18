// Arquivo: migrate-v4-fix-disciplinas.cjs
const { initializeFirebaseAdmin } = require("./firebaseAdmin.cjs");
const admin = initializeFirebaseAdmin();

const db = admin.firestore();

// --- CONFIGURAÇÃO ---
const MIGRATION_USER_ID = "OLoJi457GQNE2eTSOcz9DAD6ppZ2";
const TARGET_CYCLE_ID = "qQpAz6Nyzhh1FDYyi2Gy";
// ---------------------

// O "MAPA DE-PARA" (TRADUTOR)
// Mapeia o nome antigo (normalizado) para o ID e NOME CORRETO da nova disciplina
const DE_PARA_MAP = {
  // (Dados extraídos dos logs da V3)
  "dirpenal":           { id: "83siGnQURVkf33mepb32", nomeOficial: "Direito Penal" },
  "dirpenalmilitar":    { id: "Aa3TMSEkC3nB9IU2TJWR", nomeOficial: "Direito Penal Militar" },
  "dirconstitucional":  { id: "V8n52eBRZhYLmT075rGh", nomeOficial: "Direito Constitucional" },
  "diradministrativo":  { id: "i53CwztVw9cvrw7fAz2u", nomeOficial: "Direito Administrativo" },
  "linguaportuguesa":   { id: "oJdQvUDkzwvrOBJLowYd", nomeOficial: "Português" }

  // Os outros (História, Geografia, etc.) já funcionaram na V3
};

// Função para normalizar nomes (IGUAL à da V3)
const normalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/\./g, '') // Remove pontos
    .replace(/\s+/g, '') // Remove espaços
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
};

// Função principal
async function fixUnlinkedRecords() {
  console.log("========================================");
  console.log("INICIANDO MIGRAÇÃO (V4) - CORREÇÃO DE VÍNCULOS");
  console.log(`Usuário: ${MIGRATION_USER_ID}`);
  console.log(`Ciclo Alvo: ${TARGET_CYCLE_ID}`);
  console.log("========================================");

  try {
    // --- 1. Buscar TODOS os Registros que falharam (os 107) ---
    const recordsRef = db.collection('users').doc(MIGRATION_USER_ID)
                         .collection('registrosEstudo');

    // Busca SÓ os registros que estão no ciclo certo, mas sem ID de disciplina
    const q = recordsRef
      .where('cicloId', '==', TARGET_CYCLE_ID)
      .where('disciplinaId', '==', null);

    const recordsSnapshot = await q.get();

    if (recordsSnapshot.empty) {
      console.log("  -> Nenhum registro para corrigir (disciplinaId == null). Parece que já foi feito!");
      return;
    }

    console.log(`  -> Encontrados ${recordsSnapshot.size} registros para corrigir.`);

    // --- 2. Processar em Lotes ---
    let matchedCount = 0;
    let unmatchedCount = 0;
    const batch = db.batch(); // O lote aguenta os 107

    recordsSnapshot.forEach(doc => {
      const record = doc.data();
      const oldDisciplinaNome = record.disciplinaNome;
      const normalizedOldName = normalize(oldDisciplinaNome);

      // Procura o nome antigo no nosso mapa "DE-PARA"
      const matchedDisciplina = DE_PARA_MAP[normalizedOldName];

      if (matchedDisciplina) {
        // SUCESSO! Encontramos no mapa DE-PARA
        batch.update(doc.ref, {
          disciplinaId: matchedDisciplina.id,
          disciplinaNome: matchedDisciplina.nomeOficial // ATUALIZA para o nome bonito!
        });
        matchedCount++;
      } else {
        // AVISO: Não encontrou
        console.warn(`  [AVISO] Nome antigo "${oldDisciplinaNome}" não encontrado no mapa DE-PARA. Pulando.`);
        unmatchedCount++;
      }
    });

    // --- 3. Comitar as Mudanças ---
    await batch.commit();

    console.log("\n========================================");
    console.log("🎉 CORREÇÃO CONCLUÍDA! 🎉");
    console.log(`  -> ${matchedCount} registros foram corrigidos e vinculados à disciplina correta.`);
    if (unmatchedCount > 0) {
        console.log(`  -> ${unmatchedCount} registros não puderam ser corrigidos (não estavam no mapa).`);
    }
    console.log("========================================");

  } catch (error) {
    console.error("❌ ERRO DURANTE A CORREÇÃO:", error);
  }
}

fixUnlinkedRecords();
