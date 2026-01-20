import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_GCM_RECIFE_COMPLETO = {
  titulo: "GCM Recife",
  banca: "A definir (Pré-Edital)",
  logoUrl: "/logosEditais/logo-gcmrecife.png",
  instituicao: "GCM-RECIFE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão, interpretação e reescritura de textos", relevancia: 5 },
        { nome: "Tipologia e gêneros textuais", relevancia: 3 },
        { nome: "Significação literal e contextual (sinônimos, antônimos, homônimos, parônimos)", relevancia: 3 },
        { nome: "Mecanismos de coesão e coerência textual", relevancia: 4 },
        { nome: "Ortografia oficial (Novo Acordo)", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Emprego e flexão das classes de palavras", relevancia: 4 },
        { nome: "Sintaxe da oração e do período (coordenação e subordinação)", relevancia: 4 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Pontuação", relevancia: 3 }
      ]
    },
    {
      nome: "Matemática e Raciocínio Lógico",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Conjuntos numéricos: Naturais, inteiros, racionais e reais (operações)", relevancia: 3 },
        { nome: "Razões e proporções; Divisão proporcional", relevancia: 3 },
        { nome: "Regras de três simples e compostas", relevancia: 4 },
        { nome: "Porcentagens", relevancia: 4 },
        { nome: "Equações e inequações de 1.º e de 2.º graus", relevancia: 3 },
        { nome: "Sistemas de equações", relevancia: 2 },
        { nome: "Sistema legal de medidas (comprimento, área, volume, massa e tempo)", relevancia: 2 },
        { nome: "Funções e gráficos", relevancia: 3 },
        { nome: "Progressões aritméticas e geométricas", relevancia: 3 },
        { nome: "Noções de matemática financeira: juros simples e compostos", relevancia: 4 },
        { nome: "Estruturas lógicas", relevancia: 4 },
        { nome: "Lógica de argumentação", relevancia: 5 },
        { nome: "Diagramas lógicos", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceitos básicos de hardware e software", relevancia: 2 },
        { nome: "Sistema operacional Windows (10 e 11): pastas, arquivos, configurações", relevancia: 3 },
        { nome: "Editores de texto, planilhas e apresentações (Office: Word, Excel, PowerPoint)", relevancia: 4 },
        { nome: "Conceitos de Internet e Intranet", relevancia: 3 },
        { nome: "Navegadores (Browser) e Correio Eletrônico", relevancia: 3 },
        { nome: "Segurança da informação: vírus, malwares, phishing", relevancia: 5 },
        { nome: "Procedimentos de backup e armazenamento na nuvem", relevancia: 4 }
      ]
    },
    {
      nome: "Conhecimentos Gerais (Realidade Local)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Aspectos históricos, geográficos e culturais de Recife e Pernambuco", relevancia: 5 },
        { nome: "Aspectos econômicos e sociais de Recife e Pernambuco", relevancia: 4 },
        { nome: "Tópicos atuais: política, economia, sociedade e educação", relevancia: 3 },
        { nome: "Tópicos atuais: tecnologia, energia, relações internacionais e desenvolvimento sustentável", relevancia: 2 },
        { nome: "Tópicos atuais: segurança pública (nacional e local)", relevancia: 4 },
        { nome: "Lei Orgânica do Município do Recife", relevancia: 5 } // Muito importante para concurso municipal
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Dos Princípios Fundamentais (Arts. 1º a 4º)", relevancia: 3 },
        { nome: "Dos Direitos e Garantias Fundamentais (Art. 5º)", relevancia: 5 }, // Essencial
        { nome: "Dos Direitos Sociais (Arts. 6º a 11)", relevancia: 3 },
        { nome: "Da Administração Pública (Art. 37)", relevancia: 4 },
        { nome: "Da Segurança Pública (Art. 144) e Guardas Municipais (§ 8º)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, governo e administração pública", relevancia: 2 },
        { nome: "Princípios da Administração Pública", relevancia: 5 }, // LIMPE
        { nome: "Poderes Administrativos: vinculado, discricionário, hierárquico, disciplinar", relevancia: 4 },
        { nome: "Poder de Polícia (Conceito e Atributos)", relevancia: 5 }, // Fundamental para GCM
        { nome: "Atos administrativos: conceito, requisitos, atributos, classificação e espécies", relevancia: 4 },
        { nome: "Agentes Públicos: espécies, direitos, deveres e responsabilidades", relevancia: 3 },
        { nome: "Serviços Públicos", relevancia: 2 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Aplicação da Lei Penal", relevancia: 3 },
        { nome: "Do Crime: elementos, consumação e tentativa", relevancia: 5 },
        { nome: "Da Imputabilidade Penal", relevancia: 3 },
        { nome: "Dos Crimes contra a Pessoa", relevancia: 5 },
        { nome: "Dos Crimes contra o Patrimônio", relevancia: 5 },
        { nome: "Dos Crimes contra a Administração Pública", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Extravagante e Específica",
      peso: 2,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Estatuto Geral das Guardas Municipais (Lei 13.022/2014)", relevancia: 5 }, // A lei mais importante da prova
        { nome: "Lei de Abuso de Autoridade (Lei 13.869/2019)", relevancia: 4 },
        { nome: "Lei Maria da Penha (Lei 11.340/2006)", relevancia: 5 },
        { nome: "Estatuto da Criança e do Adolescente (Lei 8.069/90): Ato infracional e medidas", relevancia: 4 },
        { nome: "Estatuto da Pessoa Idosa (Lei 10.741/2003)", relevancia: 3 },
        { nome: "CTB: Normas gerais de circulação e conduta", relevancia: 5 }, // GCM atua no trânsito
        { nome: "CTB: Sinalização de Trânsito", relevancia: 4 },
        { nome: "CTB: Crimes de Trânsito", relevancia: 4 },
        { nome: "CTB: Competências municipais", relevancia: 5 },
        { nome: "Estatuto dos Funcionários Públicos do Recife (Lei 14.728/1985)", relevancia: 5 } // Legislação local específica
      ]
    },
    {
      nome: "Direitos Humanos e Cidadania",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 },
        { nome: "Direitos Humanos e a Constituição Federal de 1988", relevancia: 3 },
        { nome: "Grupos vulneráveis e o papel da segurança pública", relevancia: 4 },
        { nome: "Uso progressivo da força e preservação da vida", relevancia: 5 } // Tema prático e doutrinário
      ]
    }
  ]
};

const SeedEditalGCMRecife = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital GCM Recife (Pré-Edital)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "gcm_recife"), EDITAL_GCM_RECIFE_COMPLETO);
        alert("Edital GCM Recife instalado com sucesso!");
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
export const editalConfig = {
    id: "gcm_recife",
    titulo: "GCM Recife",
    banca: "A Definir (Pré-Edital)",
    tipo: "gcm",
    logo: "/logosEditais/logo-recife.png"
};

export default SeedEditalGCMRecife;