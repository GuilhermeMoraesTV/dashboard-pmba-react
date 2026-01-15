import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMPE_COMPLETO = {
  titulo: "Soldado PMPE",
  banca: "Instituto AOCP", // Baseado no último edital
  logoUrl: "/logosEditais/logo-pmpe.png",
  instituicao: "PMPE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Tipologias e gêneros Textuais", relevancia: 3 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Emprego das classes de palavras", relevancia: 4 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Sintaxe da oração e do período", relevancia: 5 },
        { nome: "Mecanismos de coesão textual", relevancia: 4 },
        { nome: "Pontuação", relevancia: 3 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 4 },
        { nome: "Colocação pronominal", relevancia: 3 },
        { nome: "Significação das palavras", relevancia: 2 },
        { nome: "Variação linguística", relevancia: 2 },
        { nome: "Redação oficial: manual de redação da presidência da república/2018", relevancia: 1 }
      ]
    },
    {
      nome: "História de Pernambuco",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Ocupação e colonização - Contatos iniciais, Capitanias Hereditárias, Duarte Coelho", relevancia: 3 },
        { nome: "A importância do açúcar para a economia local", relevancia: 4 },
        { nome: "Formação de Olinda e Recife", relevancia: 3 },
        { nome: "A presença holandesa e o governo de Maurício de Nassau", relevancia: 5 }, // Tema clássico PE
        { nome: "Movimentos de resistência e emancipacionistas (Quilombos, Insurreição Pernambucana, Guerra dos Mascates, Revolução de 1817, Confederação do Equador, Cabanos, Praieira)", relevancia: 5 }, // Muito recorrente
        { nome: "Pernambuco e a República", relevancia: 3 },
        { nome: "Manifestações da cultura popular pernambucana (Frevo, Maracatu, etc.)", relevancia: 2 },
        { nome: "Herança Afrodescente em Pernambuco", relevancia: 4 }
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Compreensão de estruturas lógicas: proposições e conectivos, quantificadores, falácias", relevancia: 5 },
        { nome: "Lógica de argumentação: analogias, inferências, deduções, equivalência e implicação, argumentos válidos", relevancia: 5 },
        { nome: "Diagramas lógicos", relevancia: 3 },
        { nome: "Princípios da contagem, análise combinatória e probabilidade", relevancia: 4 }
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito de internet e intranet", relevancia: 2 },
        { nome: "Conceitos básicos e modos de utilização de tecnologias, ferramentas, aplicativos e procedimentos de internet/intranet", relevancia: 3 },
        { nome: "Conceitos de proteção e segurança", relevancia: 5 }, // Segurança da informação cai muito
        { nome: "Procedimentos, aplicativos e dispositivos para armazenamento e backup", relevancia: 3 },
        { nome: "Conceitos de organização e gerenciamento de arquivos, pastas e programas", relevancia: 2 },
        { nome: "Ambientes operacionais: Windows (português)", relevancia: 4 },
        { nome: "Ferramentas de escritório: Microsoft Office 2019 e LibreOffice 7 (Editores, Planilhas e Apresentação)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Dos princípios fundamentais", relevancia: 3 },
        { nome: "Direitos e garantias fundamentais (individuais, coletivos, sociais, nacionalidade, políticos, remédios)", relevancia: 5 }, // Art 5º é essencial
        { nome: "Organização do Estado (competências, União, Estados, Municípios, Adm. Pública, servidores, militares)", relevancia: 4 },
        { nome: "Organização dos Poderes (Legislativo, Executivo, Judiciário)", relevancia: 3 },
        { nome: "Defesa do Estado e das instituições democráticas", relevancia: 5 }, // Art 144 Segurança Pública
        { nome: "Súmulas, jurisprudência dominante e legislação relacionada", relevancia: 2 }
      ]
    },
    {
      nome: "Direitos Humanos e Legislação Extravagante",
      peso: 3,
      importancia: "Muito Alta",
      assuntos: [
        { nome: "Teoria geral dos Direitos Humanos: conceito, estrutura, classificação", relevancia: 3 },
        { nome: "Evolução histórica e gerações de direitos humanos", relevancia: 3 },
        { nome: "Natureza jurídica da incorporação de normas internacionais", relevancia: 2 },
        { nome: "Declaração Universal dos Direitos Humanos (ONU - 1948)", relevancia: 5 }, // Obrigatório
        { nome: "Dos Crimes no Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)", relevancia: 4 },
        { nome: "Lei do Abuso de Autoridade (Lei nº 13.869/2019)", relevancia: 5 },
        { nome: "Lei de Tortura (Lei nº 9.455/1997)", relevancia: 4 },
        { nome: "Lei Maria da Penha (Lei nº 11.340/2006)", relevancia: 5 },
        { nome: "Lei dos Crimes resultantes de Preconceito de Raça ou de Cor (Lei nº 7.716/1989)", relevancia: 4 },
        { nome: "Lei dos Crimes Ambientais (Lei nº 9.605/1998)", relevancia: 2 },
        { nome: "Lei dos Crimes Hediondos (Lei nº 8.072/1990)", relevancia: 4 },
        { nome: "Lei de Drogas (Lei nº 11.343/2006)", relevancia: 5 },
        { nome: "Estatuto dos Policiais Militares do Estado de Pernambuco (Lei Estadual nº 6.783/1974)", relevancia: 5 }, // Legislação específica
        { nome: "Súmulas, jurisprudência dominante e legislação relacionada", relevancia: 2 }
      ]
    }
  ]
};

const SeedEditalPMPE = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMPE (Pernambuco)?`)) return;

    setLoading(true);
    try {
        // Gravando na coleção de templates com ID específico para PMPE
        await setDoc(doc(db, "editais_templates", "pmpe_soldado"), EDITAL_PMPE_COMPLETO);
        alert("Edital PMPE instalado com sucesso!");
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
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar PMPE</>)}
    </button>
  );
};

export default SeedEditalPMPE;