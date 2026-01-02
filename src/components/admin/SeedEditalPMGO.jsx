import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMGO_COMPLETO = {
  titulo: "Soldado PMGO",
  banca: "Instituto AOCP",
  logoUrl: "/logosEditais/logo-pmgo.png",
  instituicao: "PMGO",
  disciplinas: [
    // --- CONHECIMENTOS GERAIS (Peso 1) ---
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta", // 10 Questões
      assuntos: [
        { nome: "Compreensão e interpretação de texto", relevancia: 5 },
        { nome: "Tipologia e gêneros textuais", relevancia: 3 },
        { nome: "Figuras de linguagem", relevancia: 2 },
        { nome: "Significação de palavras e expressões", relevancia: 2 },
        { nome: "Ortografia e Acentuação gráfica", relevancia: 3 },
        { nome: "Uso da crase", relevancia: 4 },
        { nome: "Morfologia: classes de palavras", relevancia: 3 },
        { nome: "Funções do 'que' e do 'se'", relevancia: 4 }, // Clássico de prova
        { nome: "Mecanismos de coesão e coerência textual", relevancia: 4 },
        { nome: "Sintaxe: orações coordenadas e subordinadas", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 4 },
        { nome: "Colocação pronominal", relevancia: 3 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Redação Oficial", relevancia: 2 }
      ]
    },
    {
      nome: "Realidade Étnica, Social e Histórica de Goiás",
      peso: 1,
      importancia: "Média", // 05 Questões
      assuntos: [
        { nome: "Formação econômica de Goiás (Mineração, Agropecuária, Estrada de ferro)", relevancia: 4 },
        { nome: "Aspectos físicos: vegetação, hidrografia, clima e relevo", relevancia: 3 },
        { nome: "História política: bandeirantes, coronelismo, Revolução de 1930", relevancia: 4 },
        { nome: "Aspectos Socioculturais: povoamento, indígenas, escravidão, cultura", relevancia: 3 },
        { nome: "Atualidades econômicas, políticas e sociais de Goiás", relevancia: 5 }
      ]
    },
    // --- CONHECIMENTOS ESPECÍFICOS (Peso 2) ---
    {
      nome: "Noções de Direito Penal",
      peso: 2,
      importancia: "Média", // 05 Questões
      assuntos: [
        { nome: "Aplicação da lei penal (Tempo, Espaço, Territorialidade)", relevancia: 3 },
        { nome: "Crimes contra a pessoa", relevancia: 5 },
        { nome: "Crimes contra o patrimônio", relevancia: 5 },
        { nome: "Crimes contra a administração pública", relevancia: 4 },
        { nome: "Disposições constitucionais aplicáveis ao direito penal", relevancia: 2 },
        { nome: "Lei Maria da Penha (Lei nº 11.340/2006 - Arts. 01 a 07)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Direito Constitucional",
      peso: 2,
      importancia: "Alta", // 06 Questões
      assuntos: [
        { nome: "Dos princípios fundamentais", relevancia: 3 },
        { nome: "Direitos e garantias fundamentais (Art. 5º)", relevancia: 5 }, // Essencial
        { nome: "Da organização do Estado (União, Estados, Municípios)", relevancia: 2 },
        { nome: "Da organização dos poderes (Legislativo e Executivo)", relevancia: 3 },
        { nome: "Defesa do Estado e das Instituições (Art. 144 - Segurança Pública)", relevancia: 5 },
        { nome: "Da administração pública (Art. 37)", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito Processual Penal",
      peso: 2,
      importancia: "Média", // 05 Questões
      assuntos: [
        { nome: "Aplicação da lei processual (Tempo, Espaço, Pessoas)", relevancia: 2 },
        { nome: "Inquérito policial", relevancia: 5 }, // Top 1 Policial
        { nome: "Ação penal", relevancia: 3 },
        { nome: "Prisão, medidas cautelares e liberdade provisória", relevancia: 5 }, // Top 2 Policial
        { nome: "Lei de Prisão Temporária (Lei nº 7.960/1989)", relevancia: 3 },
        { nome: "Habeas corpus", relevancia: 3 },
        { nome: "Jurisdição e competência", relevancia: 2 },
        { nome: "Da prova", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito Administrativo",
      peso: 2,
      importancia: "Alta", // 06 Questões
      assuntos: [
        { nome: "Estado, governo e administração pública (Conceitos)", relevancia: 2 },
        { nome: "Organização administrativa (Direta e Indireta)", relevancia: 3 },
        { nome: "Agentes públicos (Regime jurídico, direitos, deveres)", relevancia: 4 },
        { nome: "Poderes administrativos (Hierárquico, Disciplinar, Polícia)", relevancia: 5 },
        { nome: "Atos administrativos (Requisitos, Atributos, Espécies)", relevancia: 5 },
        { nome: "Responsabilidade civil do Estado", relevancia: 4 },
        { nome: "Lei de Improbidade Administrativa (Lei nº 8.429/1992)", relevancia: 4 },
        { nome: "Licitações (Leis 8.666/93 e 14.133/2021)", relevancia: 3 },
        { nome: "Processo Administrativo Estadual (Lei GO nº 13.800)", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Direito Penal Militar",
      peso: 2,
      importancia: "Média", // 04 Questões
      assuntos: [
        { nome: "Aplicação da lei penal militar", relevancia: 3 },
        { nome: "Do Crime Militar", relevancia: 5 },
        { nome: "Das penas (Principais e Acessórias)", relevancia: 3 },
        { nome: "Dos crimes militares em tempo de paz (Arts. 136 ao 354)", relevancia: 5 } // Motim, Revolta, Deserção
      ]
    },
    {
      nome: "Noções de Proc. Penal Militar",
      peso: 2,
      importancia: "Média", // 05 Questões
      assuntos: [
        { nome: "Polícia judiciária militar", relevancia: 4 },
        { nome: "Inquérito policial militar (IPM)", relevancia: 5 },
        { nome: "Ação penal militar", relevancia: 3 },
        { nome: "Do juiz, auxiliares e partes", relevancia: 2 },
        { nome: "Competência e foro militar", relevancia: 3 },
        { nome: "Medidas preventivas e assecuratórias (Menagem, Prisão)", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Extravagante",
      peso: 2,
      importancia: "Média", // 04 Questões
      assuntos: [
        { nome: "Lei de Drogas (Lei nº 11.343/2006)", relevancia: 5 },
        { nome: "Crimes Hediondos (Lei nº 8.072/1990)", relevancia: 4 },
        { nome: "Abuso de Autoridade (Lei nº 13.869/2019)", relevancia: 5 },
        { nome: "Tortura (Lei nº 9.455/1997)", relevancia: 4 },
        { nome: "Estatuto da Criança e do Adolescente (ECA)", relevancia: 3 },
        { nome: "Estatuto do Desarmamento (Lei nº 10.826/2003)", relevancia: 5 },
        { nome: "Juizados Especiais Criminais (Lei nº 9.099/95)", relevancia: 3 },
        { nome: "Pacote Anticrime (Lei nº 13.964/2019)", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPMGO = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMGO (Soldado)?`)) return;

    setLoading(true);
    try {
        // ID do documento: 'pmgo_soldado'
        await setDoc(doc(db, "editais_templates", "pmgo_soldado"), EDITAL_PMGO_COMPLETO);
        alert("Edital PMGO instalado com sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
        onClick={handleSeed}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
            isInstalled
            ? 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalPMGO;