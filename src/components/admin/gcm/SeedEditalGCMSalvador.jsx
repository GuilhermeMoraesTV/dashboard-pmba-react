import React, { useState } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_GCM_SALVADOR_COMPLETO = {
   id: "gcm_salvador",
  titulo: "GCM Salvador ",
  banca: "A Definir (Pré-Edital)",
  logoUrl: "/logosEditais/logo-gcmsalvador.png",
  instituicao: "GCM-SALVADOR",
  tipo: "gcm",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Leitura, compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Estruturação do texto e dos parágrafos", relevancia: 3 },
        { nome: "Articulação do texto: pronomes, nexos e operadores sequenciais", relevancia: 4 },
        { nome: "Significação contextual de palavras e expressões (Semântica)", relevancia: 4 },
        { nome: "Equivalência e transformação de estruturas", relevancia: 3 },
        { nome: "Sintaxe: coordenação e subordinação", relevancia: 4 },
        { nome: "Emprego de tempos e modos verbais", relevancia: 3 },
        { nome: "Pontuação", relevancia: 3 },
        { nome: "Estrutura e formação de palavras", relevancia: 2 },
        { nome: "Funções das classes de palavras", relevancia: 3 },
        { nome: "Flexão nominal e verbal", relevancia: 2 },
        { nome: "Pronomes: emprego, formas de tratamento e colocação", relevancia: 3 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Ortografia oficial e Acentuação gráfica", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico-Matemático",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Estrutura lógica de relações arbitrárias", relevancia: 3 },
        { nome: "Dedução de novas informações e avaliação das condições", relevancia: 4 },
        { nome: "Lógica de uma situação: raciocínio verbal, matemático e sequencial", relevancia: 4 },
        { nome: "Orientação espacial e temporal", relevancia: 3 },
        { nome: "Formação de conceitos e discriminação de elementos", relevancia: 2 },
        { nome: "Operações com conjuntos", relevancia: 3 },
        { nome: "Raciocínio lógico: problemas aritméticos, geométricos e matriciais", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Dispositivos de entrada, saída e armazenamento", relevancia: 2 },
        { nome: "Noções do ambiente Windows (pastas, arquivos, atalhos)", relevancia: 3 },
        { nome: "MS Office (Word, Excel, Powerpoint)", relevancia: 4 },
        { nome: "LibreOffice (Writer, Calc, Impress)", relevancia: 3 },
        { nome: "Conceitos de Internet e Correio Eletrônico", relevancia: 3 },
        { nome: "Segurança da Informação: cópias de segurança/backup", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Institucional",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Lei Complementar 001/91 - Regime Jurídico Único de Salvador", relevancia: 5 },
        { nome: "Deveres e proibições dos servidores públicos municipais", relevancia: 5 },
        { nome: "Lei Orgânica do Município de Salvador", relevancia: 4 },
        { nome: "Lei Municipal nº 9.273/2017 (Regulamento Disciplinar da GCM)", relevancia: 5 },
        { nome: "Lei Municipal nº 9.070/2016 (Competências da GCM)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, Governo e Administração Pública: conceitos e princípios", relevancia: 3 },
        { nome: "Ato administrativo: requisitos, atributos e classificação", relevancia: 5 },
        { nome: "Invalidação, anulação e revogação de atos", relevancia: 4 },
        { nome: "Poderes Administrativos (Hierárquico, Disciplinar, Polícia)", relevancia: 5 },
        { nome: "Bens públicos: conceito e classificações (CC Art. 98 a 103)", relevancia: 3 },
        { nome: "Prescrição administrativa", relevancia: 2 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios Fundamentais (Art. 1º ao 4º)", relevancia: 3 },
        { nome: "Direitos e Garantias Fundamentais (Art. 5º ao 11)", relevancia: 5 },
        { nome: "Organização do Estado (Art. 18 a 31; Art. 37 a 41)", relevancia: 4 },
        { nome: "Segurança Pública (Art. 144, com foco no §8º - Guardas Municipais)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Crimes contra a pessoa (Homicídio, Lesão, Honra)", relevancia: 5 },
        { nome: "Crimes contra o patrimônio (Furto, Roubo, Dano)", relevancia: 5 },
        { nome: "Crimes contra a Administração Pública (Peculato, Concussão, Corrupção)", relevancia: 5 },
        { nome: "Abuso de Autoridade (Lei 13.869/2019)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Civil",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Capacidade jurídica (Art. 1º ao 10 do Código Civil)", relevancia: 3 },
        { nome: "Bens considerados em si mesmos (Art. 79 ao 91)", relevancia: 2 }
      ]
    },
    {
      nome: "Legislação de Trânsito",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Código de Trânsito Brasileiro (CTB) - Normas gerais de circulação", relevancia: 5 },
        { nome: "Sistema Nacional de Trânsito e Composição", relevancia: 3 },
        { nome: "Registro, Licenciamento e Habilitação", relevancia: 3 },
        { nome: "Infrações e Penalidades", relevancia: 5 },
        { nome: "Crimes de Trânsito", relevancia: 4 },
        { nome: "Sinalização de trânsito", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Extravagante (Atualizações)",
      peso: 2,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Estatuto Geral das Guardas Municipais (Lei 13.022/2014)", relevancia: 5 },
        { nome: "Estatuto do Desarmamento (Lei 10.826/03): Registro, posse e crimes", relevancia: 5 },
        { nome: "Lei Maria da Penha (Lei 11.340/2006)", relevancia: 5 },
        { nome: "Estatuto da Criança e do Adolescente (ECA - Lei 8.069/90)", relevancia: 4 },
        { nome: "Estatuto do Idoso (Lei 10.741/2003)", relevancia: 3 }
      ]
    }
  ]
};

const SeedEditalGCMSalvador = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital GCM Salvador (Atualizado)?`)) return;

    setLoading(true);
    try {
        // Grava no Firebase com a logoUrl inclusa
        await setDoc(doc(db, "editais_templates", "gcm_salvador"), EDITAL_GCM_SALVADOR_COMPLETO);
        alert("Edital GCM Salvador instalado com sucesso!");
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
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
        </button>
      );
    };

// Configuração para o EditaisManager ler
export const editalConfig = {
    id: "gcm_salvador",
    titulo: "GCM Salvador",
    banca: "A Definir (Pré-Edital)",
    tipo: "gcm",
    logo: "/logosEditais/logo-gcmsalvador.png"
};

export default SeedEditalGCMSalvador;