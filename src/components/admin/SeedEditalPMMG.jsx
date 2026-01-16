import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMMG_COMPLETO = {
  titulo: "Soldado PMMG",
  banca: "CRS/PMMG", // Centro de Recrutamento e Seleção
  logoUrl: "/logosEditais/logo-pmmg.png",
  instituicao: "PMMG",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1, // Geralmente PMMG tem peso único ou balanceado, mas a importância é alta
      importancia: "Alta",
      assuntos: [
        { nome: "Adequação conceitual, pertinência, relevância e articulação dos argumentos", relevancia: 4 },
        { nome: "Seleção vocabular", relevancia: 3 },
        { nome: "Estudo de texto (literário, informativo ou crônica)", relevancia: 5 }, // Foco da prova
        { nome: "Tipologia textual e Gêneros textuais", relevancia: 3 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Estrutura e formação de palavras", relevancia: 2 },
        { nome: "Classes de palavras", relevancia: 4 },
        { nome: "Frase, oração e período; Termos da oração", relevancia: 3 },
        { nome: "Período composto por coordenação e subordinação", relevancia: 5 },
        { nome: "Funções sintáticas dos pronomes relativos", relevancia: 4 },
        { nome: "Emprego de nomes e pronomes; Colocação pronominal", relevancia: 4 },
        { nome: "Emprego de tempos e modos verbais", relevancia: 3 },
        { nome: "Regência verbal e nominal", relevancia: 5 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Orações reduzidas", relevancia: 2 },
        { nome: "Estilística e Figuras de linguagem", relevancia: 3 },
        { nome: "Vícios de linguagem e qualidade da boa linguagem", relevancia: 2 },
        { nome: "Fonemas", relevancia: 1 },
        { nome: "Semântica", relevancia: 4 },
        { nome: "Emprego da crase", relevancia: 5 }
      ]
    },
    {
      nome: "Literatura",
      peso: 1,
      importancia: "Média", // Poucas questões, mas decisivas (leitura obrigatória)
      assuntos: [
        { nome: "Livro: Memórias Póstumas de Brás Cubas (Machado de Assis)", relevancia: 5 },
        { nome: "Livro: Triste Fim de Policarpo Quaresma (Lima Barreto)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Língua Inglesa",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Compreensão e interpretação de texto escrito em língua inglesa", relevancia: 5 },
        { nome: "Itens gramaticais relevantes para a compreensão dos conteúdos semânticos", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito e Direitos Humanos",
      peso: 1,
      importancia: "Altíssima",
      assuntos: [
        // CF/88
        { nome: "CF/88: Título I - Dos Princípios Fundamentais", relevancia: 3 },
        { nome: "CF/88: Título II - Direitos e Deveres Individuais e Coletivos (Art. 5º)", relevancia: 5 },
        { nome: "CF/88: Título II - Da Nacionalidade e Direitos Políticos", relevancia: 3 },
        { nome: "CF/88: Título III - Da Administração Pública (Disposições Gerais)", relevancia: 4 },
        { nome: "CF/88: Título III - Dos Militares dos Estados, DF e Territórios", relevancia: 5 }, // Essencial para PM
        { nome: "CF/88: Título IV - Do Poder Judiciário (Tribunais e Juízes Militares/Estados)", relevancia: 3 },
        { nome: "CF/88: Título V - Das Forças Armadas", relevancia: 2 },
        { nome: "CF/88: Título V - Da Segurança Pública (Art. 144)", relevancia: 5 },
        // Legislação e DH
        { nome: "Lei de Introdução às Normas do Direito Brasileiro (LINDB)", relevancia: 3 },
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 },
        { nome: "Convenção Americana sobre Direitos Humanos (Pacto de São José da Costa Rica)", relevancia: 5 }
      ]
    },
    {
      nome: "Raciocínio Lógico-Matemático",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Análise e interpretação de figuras planas, gráficos, tabelas e escalas", relevancia: 4 },
        { nome: "Estatística básica: medidas de tendência central, dispersão e porcentagem", relevancia: 4 },
        { nome: "Estruturas lógicas e diagramas lógicos", relevancia: 3 },
        { nome: "Lógica de argumentação: analogias, inferências e deduções", relevancia: 5 },
        { nome: "Lógica proposicional: tabelas-verdade, equivalências, leis de Morgan, tautologias", relevancia: 5 },
        { nome: "Métrica: áreas e volumes", relevancia: 3 },
        { nome: "Equações do 1º e 2º graus e sistemas lineares", relevancia: 3 },
        { nome: "Contagem (Análise Combinatória) e Probabilidade", relevancia: 5 },
        { nome: "Funções: afim, quadrática, exponencial e logarítmica", relevancia: 3 },
        { nome: "Operações com conjuntos", relevancia: 3 },
        { nome: "Sequências numéricas: PA e PG", relevancia: 4 },
        { nome: "Razão, proporção e regra de três simples e composta", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPMMG = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMMG (Minas Gerais)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmmg_soldado"), EDITAL_PMMG_COMPLETO);
        alert("Edital PMMG (Soldado) instalado com sucesso!");
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
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
    </button>
  );
};

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA ---
export const editalConfig = {
    id: "pmmg_soldado",
    titulo: "Soldado PMMG",
    banca: "CRS/PMMG",
    tipo: "pm",
    logo: "/logosEditais/logo-pmmg.png"
};

export default SeedEditalPMMG;