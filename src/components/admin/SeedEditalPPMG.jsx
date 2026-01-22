import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PPMG_2025 = {
  titulo: "Policial Penal MG",
  banca: "Instituto AOCP",
  instituicao: "PPMG",
  logoUrl: "/logosEditais/logo-ppmg.png",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Tipos e gêneros textuais", relevancia: 3 },
        { nome: "Significação de palavras e expressões", relevancia: 3 },
        { nome: "Sinônimos e antônimos", relevancia: 2 },
        { nome: "Ortografia oficial", relevancia: 3 },
        { nome: "Classes de palavras variáveis e invariáveis e suas funções", relevancia: 4 },
        { nome: "Concordâncias verbal e nominal", relevancia: 5 },
        { nome: "Conjugações verbais", relevancia: 4 },
        { nome: "Colocação de pronomes nas frases", relevancia: 3 },
        { nome: "Sintaxe", relevancia: 4 },
        { nome: "Classificação das palavras quanto ao número de sílabas", relevancia: 1 },
        { nome: "Dígrafos, encontros vocálicos e consonantais", relevancia: 1 },
        { nome: "Divisão silábica", relevancia: 1 },
        { nome: "Processos de formation de palavras", relevancia: 2 },
        { nome: "Usos dos 'porquês', 'mau' e 'mal'", relevancia: 3 },
        { nome: "Variação linguística", relevancia: 2 },
        { nome: "Manual de Redação da Presidência da República", relevancia: 5 }
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Noções de lógica", relevancia: 3 },
        { nome: "Diagramas lógicos: conjuntos e elementos", relevancia: 4 },
        { nome: "Lógica da argumentação", relevancia: 4 },
        { nome: "Tipos de raciocínio", relevancia: 3 },
        { nome: "Conectivos lógicos", relevancia: 5 },
        { nome: "Proposições lógicas simples e compostas", relevancia: 5 },
        { nome: "Elementos de teoria dos conjuntos, análise combinatória e probabilidade", relevancia: 5 },
        { nome: "Resolução de problemas (frações, porcentagens, sequências, operações básicas)", relevancia: 4 }
      ]
    },
    {
      nome: "Informática Básica",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceitos e fundamentos básicos", relevancia: 2 },
        { nome: "Softwares utilitários (compactadores, chat, e-mail, vídeo, imagem, antivírus)", relevancia: 3 },
        { nome: "Identificação e manipulação de arquivos", relevancia: 3 },
        { nome: "Backup de arquivos", relevancia: 4 },
        { nome: "Hardware (Placa mãe, memória, processador, HD, CD/DVD)", relevancia: 2 },
        { nome: "Periféricos de computadores", relevancia: 2 },
        { nome: "Sistemas operacionais: Windows 7 e Windows 10", relevancia: 4 },
        { nome: "Conceitos básicos sobre Linux e Software Livre", relevancia: 3 },
        { nome: "Microsoft Office (Word, Excel, PowerPoint) - versões 2010, 2013 e 2016", relevancia: 5 },
        { nome: "LibreOffice (Writer, Calc e Impress) - versões 5 e 6", relevancia: 4 },
        { nome: "Utilização e configuração de e-mail no Microsoft Outlook", relevancia: 3 },
        { nome: "Tecnologias de Internet/Intranet e busca na Web", relevancia: 4 },
        { nome: "Navegadores: Internet Explorer, Mozilla Firefox, Google Chrome", relevancia: 4 },
        { nome: "Segurança na internet (vírus, Spyware, Malware, Phishing, Spam)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Direitos e Garantias Fundamentais (art. 5º)", relevancia: 5 },
        { nome: "Da Administração Pública (art. 37)", relevancia: 4 },
        { nome: "Defesa do Estado e das Instituições (arts. 136 ao 141)", relevancia: 3 },
        { nome: "Da Segurança Pública (art. 144)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Do crime (arts. 13 ao 25)", relevancia: 5 },
        { nome: "Da imputabilidade penal (arts. 26 ao 28)", relevancia: 4 },
        { nome: "Das Penas (arts. 32 ao 52)", relevancia: 5 },
        { nome: "Dos crimes contra a pessoa (arts. 121 ao 150)", relevancia: 5 },
        { nome: "Dos crimes contra o patrimônio (arts. 155 ao 180)", relevancia: 4 },
        { nome: "Dos crimes contra os costumes (arts. 213 ao 218-C)", relevancia: 3 },
        { nome: "Crimes praticados por funcionário público contra a Administração (arts. 312 ao 327)", relevancia: 5 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Teoria geral dos direitos humanos (conceito, fundamentos, histórico)", relevancia: 4 },
        { nome: "Sistemas internacionais de proteção (Global/ONU e Interamericano/OEA)", relevancia: 4 },
        { nome: "A incorporação dos tratados internacionais ao direito brasileiro", relevancia: 4 },
        { nome: "A proteção dos grupos socialmente vulneráveis", relevancia: 5 },
        { nome: "Direitos humanos de natureza civil, política, social, econômica, cultural e ambiental", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Especial",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Lei de Drogas (Lei nº 11.343/2006)", relevancia: 5 },
        { nome: "Lei dos Crimes Hediondos (Lei nº 8.072/1990)", relevancia: 5 },
        { nome: "Lei de Abuso de Autoridade (Lei nº 13.869/2019)", relevancia: 5 },
        { nome: "Estatuto do Desarmamento (Lei nº 10.826/2003)", relevancia: 4 },
        { nome: "Lei Maria da Penha (Lei nº 11.340/2006)", relevancia: 4 },
        { nome: "Lei de Tortura (Lei nº 9.455/1997)", relevancia: 5 },
        { nome: "Decreto Federal nº 11.615/2023 (Regulamenta Lei de Armas)", relevancia: 3 },
        { nome: "Lei de Execução Penal - LEP (Lei nº 7.210/1984)", relevancia: 5 }, // O mais importante da prova
        { nome: "Lei Estadual MG nº 11.404/1994 (Normas de execução penal)", relevancia: 5 },
        { nome: "Regulamento e Normas de Procedimentos do Sistema Prisional de MG (RENP)", relevancia: 5 },
        { nome: "Lei Estadual MG nº 14.695/2003 (Carreira de Policial Penal)", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPPMG = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital PPMG 2025?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "ppmg_policial_penal"), EDITAL_PPMG_2025);
        alert("Sucesso! Edital PPMG mapeado com foco no Instituto AOCP.");
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
    id: "ppmg_policial_penal",
    titulo: "Policial Penal MG",
    banca: "Instituto AOCP",
    tipo: "pp",
    logo: "/logosEditais/logo-ppmg.png"
};

export default SeedEditalPPMG;