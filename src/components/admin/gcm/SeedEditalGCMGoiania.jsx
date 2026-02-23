import React, { useState } from 'react';
import { db } from '../../../firebaseConfig'; // Ajuste o caminho se necessário
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_GCM_GOIANIA_PRE = {
  id: "gcm_goiania", // Adicionei o ID aqui também para garantir redundância
  titulo: "GCM Goiânia",
  banca: "A Definir (Pré-Edital)",
  logoUrl: "/logosEditais/logo-gcmgoiania.png", // <--- PERFEITO! A chave da automação.
  instituicao: "GCM-GOIANIA",
  tipo: "gcm", // Útil salvar o tipo no banco também
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        "Leitura e interpretação de textos de diferentes gêneros",
        "Coesão e coerência textual",
        "Ortografia oficial e Acentuação gráfica",
        "Morfologia: classes de palavras e suas flexões",
        "Sintaxe: termos da oração, coordenação e subordinação",
        "Concordância nominal e verbal",
        "Regência nominal e verbal",
        "Emprego do sinal indicativo de crase",
        "Pontuação e seus efeitos de sentido",
        "Semântica: sinônimos, antônimos, homônimos e parônimos"
      ]
    },
    {
      nome: "Geo-História de Goiânia e Goiás",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        "A construção de Goiânia: a Marcha para o Oeste",
        "Pedro Ludovico Teixeira e a transferência da capital",
        "Patrimônio Cultural: O Art Déco em Goiânia",
        "Aspectos físicos: Relevo, Hidrografia e Clima (Cerrado)",
        "Expansão urbana e metropolização de Goiânia",
        "Aspectos econômicos e populacionais atuais de Goiânia",
        "História política de Goiás (Coronelismo x Modernização)"
      ]
    },
    {
      nome: "Raciocínio Lógico e Matemático",
      peso: 1,
      importancia: "Média",
      assuntos: [
        "Estruturas lógicas e Lógica de argumentação",
        "Diagramas lógicos e Teoria dos Conjuntos",
        "Números naturais, inteiros, racionais e reais",
        "Razão, proporção, regra de três simples e composta",
        "Porcentagem e Juros Simples",
        "Geometria básica: áreas e perímetros",
        "Análise combinatória e Probabilidade básica"
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        "Sistema Operacional Windows (Conceitos de pastas e arquivos)",
        "Editores de Texto e Planilhas (Word/Excel e LibreOffice)",
        "Conceitos de Internet, Intranet e Navegadores",
        "Correio Eletrônico e Segurança da Informação"
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Princípios Fundamentais (Arts. 1º ao 4º)",
        "Direitos e Deveres Individuais e Coletivos (Art. 5º)",
        "Direitos Sociais e Nacionalidade",
        "Administração Pública (Art. 37)",
        "Segurança Pública (Art. 144 - Foco no §8º)"
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Princípios da Administração Pública (LIMPE)",
        "Poderes Administrativos: Poder de Polícia (Atributos e Limites)",
        "Poder Hierárquico e Disciplinar",
        "Atos Administrativos: requisitos, atributos e espécies",
        "Agentes Públicos: direitos, deveres e responsabilidades",
        "Responsabilidade Civil do Estado"
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Aplicação da Lei Penal",
        "Do Crime: elementos, consumação e tentativa",
        "Excludentes de Ilicitude (Legítima Defesa e Estrito Cumprimento)",
        "Crimes contra a Pessoa (Homicídio, Lesão Corporal)",
        "Crimes contra o Patrimônio (Furto, Roubo, Dano)",
        "Crimes contra a Administração Pública (Desacato, Resistência, Peculato)"
      ]
    },
    {
      nome: "Legislação Extravagante e Específica",
      peso: 3,
      importancia: "Crítica",
      assuntos: [
        "Estatuto Geral das Guardas Municipais (Lei 13.022/2014)",
        "Lei Maria da Penha (Lei 11.340/2006) e GCM no combate à violência",
        "Estatuto da Criança e do Adolescente (Ato infracional)",
        "Estatuto do Idoso (Lei 10.741/2003)",
        "Lei de Abuso de Autoridade (Lei 13.869/2019)",
        "Lei de Drogas (Lei 11.343/2006) - Art. 28 e 33",
        "Crimes Ambientais (Lei 9.605/1998) - Atuação municipal",
        "Estatuto do Desarmamento (Posse e Porte para GCM)"
      ]
    },
    {
      nome: "Legislação de Trânsito (CTB)",
      peso: 2,
      importancia: "Média",
      assuntos: [
        "Competências do Município no Trânsito",
        "Normas Gerais de Circulação e Conduta",
        "Sinalização de Trânsito",
        "Infrações de competência municipal (Estacionamento, Parada)",
        "Crimes de Trânsito"
      ]
    }
  ]
};

const SeedEditalGCMGoiania = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    // Confirmação antes de instalar/reinstalar
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital GCM Goiânia (Pré-Edital 2026)?`)) return;

    setLoading(true);
    try {
        // Salva no Firestore com o ID definido no config
        await setDoc(doc(db, "editais_templates", editalConfig.id), EDITAL_GCM_GOIANIA_PRE);
        alert("Edital GCM Goiânia instalado com sucesso!");
        if (onSuccess) onSuccess(); // Callback para atualizar a UI do pai
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
        onClick={handleSeed}
        disabled={loading}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm w-full ${
            isInstalled
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5'
        } ${loading ? 'opacity-70 cursor-wait' : ''}`}
    >
        {loading ? 'Processando...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

// Configuração ESSENCIAL para o EditaisManager ler sem precisar montar o componente
export const editalConfig = {
    id: "gcm_goiania", // ID único no banco
    titulo: "GCM Goiânia",
    banca: "A Definir",
    tipo: "gcm", // Define a aba que vai aparecer
    logo: "/logosEditais/logo-gcmgoiania.png" // Caminho da imagem na pasta public
};

export default SeedEditalGCMGoiania;