import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMPE_COMPLETO = {
  titulo: "Soldado PMPE",
  banca: "Instituto AOCP",
  logoUrl: "/logosEditais/logo-pmpe.png",
  instituicao: "PMPE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Tipologias e gêneros Textuais", relevancia: 3 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Emprego das classes de palavras", relevancia: 4 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 }, // AOCP cobra muito
        { nome: "Sintaxe da oração e do período", relevancia: 5 },
        { nome: "Mecanismos de coesão textual", relevancia: 4 },
        { nome: "Pontuação", relevancia: 3 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Colocação pronominal", relevancia: 3 },
        { nome: "Significação das palavras", relevancia: 2 },
        { nome: "Variação linguística", relevancia: 1 },
        { nome: "Redação oficial: manual de redação da presidência da república/2018", relevancia: 2 }
      ]
    },
    {
      nome: "História de Pernambuco",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Ocupação e colonização: Contatos iniciais, Capitanias Hereditárias, Duarte Coelho", relevancia: 3 },
        { nome: "A importância do açúcar para a economia local", relevancia: 4 },
        { nome: "Formação de Olinda e Recife", relevancia: 3 },
        { nome: "A presença holandesa e o governo de Maurício de Nassau", relevancia: 5 }, // Clássico
        { nome: "Movimentos de resistência e emancipacionistas (Quilombos, Insurreição Pernambucana, Mascates)", relevancia: 5 },
        { nome: "Revoluções: Pernambucana (1817), Confederação do Equador (1824), Cabanos (1835), Praieira (1848)", relevancia: 5 },
        { nome: "Pernambuco e a República", relevancia: 3 },
        { nome: "Manifestações da cultura popular pernambucana (Frevo, Maracatu, festas)", relevancia: 2 },
        { nome: "Herança Afrodescendente em Pernambuco", relevancia: 3 }
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Compreensão de estruturas lógicas: proposições, conectivos, quantificadores, falácias", relevancia: 4 },
        { nome: "Lógica de argumentação: analogias, inferências, deduções, equivalência e implicação", relevancia: 5 },
        { nome: "Diagramas lógicos", relevancia: 3 },
        { nome: "Princípios da contagem, técnicas de contagem e princípio multiplicativo", relevancia: 4 },
        { nome: "Permutações, arranjos e combinações", relevancia: 5 },
        { nome: "Probabilidade", relevancia: 5 }
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito de internet e intranet", relevancia: 2 },
        { nome: "Tecnologias, ferramentas e aplicativos associados a internet/intranet", relevancia: 3 },
        { nome: "Conceitos de proteção e segurança", relevancia: 5 },
        { nome: "Armazenamento de dados e cópia de segurança (backup)", relevancia: 4 },
        { nome: "Conceitos de organização e gerenciamento de arquivos, pastas e programas", relevancia: 2 },
        { nome: "Ambientes operacionais: sistema operacional Windows (em português)", relevancia: 3 },
        { nome: "Microsoft Office 2019 (Word, Excel e PowerPoint)", relevancia: 4 },
        { nome: "LibreOffice 7 (Writer, Calc e Impress)", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Dos princípios fundamentais", relevancia: 3 },
        { nome: "Direitos e garantias fundamentais: direitos e deveres individuais e coletivos", relevancia: 5 },
        { nome: "Direitos sociais, nacionalidade e direitos políticos; remédios constitucionais", relevancia: 4 },
        { nome: "Organização do Estado: político-administrativa e repartição de competências", relevancia: 3 },
        { nome: "Administração Pública: disposições gerais e servidores públicos", relevancia: 4 },
        { nome: "Dos militares dos Estados, do Distrito Federal e dos Territórios", relevancia: 5 },
        { nome: "Organização dos Poderes (Legislativo, Executivo, Judiciário)", relevancia: 3 },
        { nome: "Defesa do Estado e das instituições democráticas (Segurança Pública)", relevancia: 5 },
        { nome: "Súmulas e jurisprudência dominante dos Tribunais Superiores", relevancia: 3 }
      ]
    },
    {
      nome: "Direitos Humanos e Legislação",
      peso: 1,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Teoria geral dos Direitos Humanos: conceito, estrutura, fundamento e classificação", relevancia: 3 },
        { nome: "Evolução histórica e gerações de direitos humanos", relevancia: 3 },
        { nome: "Incorporação de normas internacionais sobre Direitos Humanos ao direito interno", relevancia: 3 },
        { nome: "Declaração Universal dos Direitos Humanos (ONU - 1948)", relevancia: 5 },
        { nome: "Dos Crimes no Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)", relevancia: 4 },
        { nome: "Lei n. 13.869/2019 (Lei do Abuso de Autoridade)", relevancia: 5 },
        { nome: "Lei n. 9.455/1997 (Lei de Tortura)", relevancia: 5 },
        { nome: "Lei n. 11.340/2006 (Lei Maria da Penha)", relevancia: 5 },
        { nome: "Lei n. 7.716/1989 (Crimes de Preconceito de Raça ou de Cor)", relevancia: 4 },
        { nome: "Lei n. 9.605/1998 (Lei dos Crimes Ambientais)", relevancia: 3 },
        { nome: "Lei n. 8.072/1990 (Lei dos Crimes Hediondos)", relevancia: 4 },
        { nome: "Lei n. 11.343/2006 (Lei de Drogas)", relevancia: 5 },
        { nome: "Lei Estadual nº 6.783/1974 (Estatuto dos Policiais Militares de PE)", relevancia: 5 }, // Específica essencial
        { nome: "Súmulas e jurisprudência dominante relacionada aos temas", relevancia: 3 }
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
    id: "pmpe_soldado",
    titulo: "Soldado PMPE",
    banca: "Instituto AOCP",
    tipo: "pm",
    logo: "/logosEditais/logo-pmpe.png"
};

export default SeedEditalPMPE;