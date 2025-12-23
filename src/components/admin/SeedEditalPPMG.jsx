import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PPMG_2025 = {
  titulo: "Policial Penal MG",
  banca: "Instituto AOCP",
  instituicao: "PPMG",
  logoUrl: "/logosEditais/logo-ppmg.png", // Caminho atualizado da logo
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso_sugerido: 2,
      assuntos: [
        "1. Compreensão e interpretação de textos",
        "2. Tipos e gêneros textuais",
        "3. Significação de palavras e expressões",
        "4. Sinônimos e antônimos",
        "5. Ortografia oficial",
        "6. Classes de palavras variáveis e invariáveis e suas funções",
        "7. Concordâncias verbal e nominal",
        "8. Conjugações verbais",
        "9. Colocação de pronomes nas frases",
        "10. Sintaxe",
        "11. Classificação das palavras quanto ao número de sílabas",
        "12. Dígrafos, encontros vocálicos e consonantais",
        "13. Divisão silábica",
        "14. Processos de formação de palavras",
        "15. Usos dos 'porquês', 'mau' e 'mal'",
        "17. Variação linguística",
        "18. Manual de Redação da Presidência da República"
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso_sugerido: 1,
      assuntos: [
        "1. Noções de lógica",
        "2. Diagramas lógicos: conjuntos e elementos",
        "3. Lógica da argumentação",
        "4. Tipos de raciocínio",
        "5. Conectivos lógicos",
        "6. Proposições lógicas simples e compostas",
        "7. Elementos de teoria dos conjuntos, análise combinatória e probabilidade",
        "8. Resolução de problemas (frações, porcentagens, sequências, operações básicas)"
      ]
    },
    {
      nome: "Informática Básica",
      peso_sugerido: 1,
      assuntos: [
        "1. Conceitos e fundamentos básicos",
        "2. Softwares utilitários (compactadores, chat, e-mail, vídeo, imagem, antivírus)",
        "3. Identificação e manipulação de arquivos",
        "4. Backup de arquivos",
        "5. Hardware (Placa mãe, memória, processador, HD, CD/DVD)",
        "6. Periféricos de computadores",
        "7. Sistemas operacionais: Windows 7 e Windows 10",
        "8. Conceitos básicos sobre Linux e Software Livre",
        "9. Microsoft Office (Word, Excel, PowerPoint) - versões 2010, 2013 e 2016",
        "10. LibreOffice (Writer, Calc e Impress) - versões 5 e 6",
        "11. Utilização e configuração de e-mail no Microsoft Outlook",
        "12. Tecnologias de Internet/Intranet e busca na Web",
        "13. Navegadores: Internet Explorer, Mozilla Firefox, Google Chrome",
        "14. Segurança na internet (vírus, Spyware, Malware, Phishing, Spam)"
      ]
    },
    {
      nome: "Direito Constitucional",
      peso_sugerido: 2,
      assuntos: [
        "1.1. Direitos e Garantias Fundamentais (art. 5º)",
        "1.2. Da Administração Pública (art. 37)",
        "1.3. Defesa do Estado e das Instituições (arts. 136 ao 141)",
        "1.4. Da Segurança Pública (art. 144)"
      ]
    },
    {
      nome: "Direito Penal",
      peso_sugerido: 2,
      assuntos: [
        "2.1. Do crime (arts. 13 ao 25)",
        "2.2. Da imputabilidade penal (arts. 26 ao 28)",
        "2.3. Das Penas (arts. 32 ao 52)",
        "2.4. Dos crimes contra a pessoa (arts. 121 ao 150)",
        "2.5. Dos crimes contra o patrimônio (arts. 155 ao 180)",
        "2.6. Dos crimes contra os costumes (arts. 213 ao 218-C)",
        "2.7. Crimes praticados por funcionário público contra a Administração (arts. 312 ao 327)"
      ]
    },
    {
      nome: "Direitos Humanos",
      peso_sugerido: 2,
      assuntos: [
        "1. Teoria geral dos direitos humanos (conceito, fundamentos, histórico)",
        "2. Sistemas internacionais de proteção (Global/ONU e Interamericano/OEA)",
        "3. A incorporação dos tratados internacionais ao direito brasileiro",
        "4. A proteção dos grupos socialmente vulneráveis",
        "5. Direitos humanos de natureza civil, política, social, econômica, cultural e ambiental"
      ]
    },
    {
      nome: "Legislação Especial",
      peso_sugerido: 3,
      assuntos: [
        "1. Lei de Drogas (Lei nº 11.343/2006)",
        "2. Lei dos Crimes Hediondos (Lei nº 8.072/1990)",
        "3. Lei de Abuso de Autoridade (Lei nº 13.869/2019)",
        "4. Estatuto do Desarmamento (Lei nº 10.826/2003)",
        "5. Lei Maria da Penha (Lei nº 11.340/2006)",
        "6. Lei de Tortura (Lei nº 9.455/1997)",
        "7. Decreto Federal nº 11.615/2023 (Regulamenta Lei de Armas)",
        "8. Lei de Execução Penal - LEP (Lei nº 7.210/1984)",
        "9. Lei Estadual MG nº 11.404/1994 (Normas de execução penal)",
        "10. Regulamento e Normas de Procedimentos do Sistema Prisional de MG (REMP)",
        "11. Lei Estadual MG nº 14.695/2003 (Carreira de Policial Penal)"
      ]
    }
  ]
};

const SeedEditalPPMG = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital PPMG?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "ppmg_policial_penal"), EDITAL_PPMG_2025);
        alert("Sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro.");
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
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalPPMG;