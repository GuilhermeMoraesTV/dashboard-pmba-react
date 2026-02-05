import React, { useState } from 'react';
import { db } from '../../firebaseConfig'; // Certifique-se que o caminho está correto para sua estrutura
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PRF_COMPLETO = {
  titulo: "Policia Rodoviário Federal",
  banca: "Cebraspe",
  logoUrl: "/logosEditais/logo-prf.png",
  instituicao: "PRF",
  disciplinas: [
    // --- BLOCO I ---
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos de gêneros variados", relevancia: 5 },
        { nome: "Reconhecimento de tipos e gêneros textuais", relevancia: 3 },
        { nome: "Domínio da ortografia oficial", relevancia: 2 },
        { nome: "Mecanismos de coesão textual (referenciação, substituição, conectores)", relevancia: 5 },
        { nome: "Emprego de tempos e modos verbais", relevancia: 4 },
        { nome: "Estrutura morfossintática: Classes de palavras", relevancia: 3 },
        { nome: "Coordenação e Subordinação (orações e termos)", relevancia: 4 },
        { nome: "Emprego dos sinais de pontuação", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 5 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Colocação dos pronomes átonos", relevancia: 3 },
        { nome: "Reescrita de frases: significação, substituição e reorganização", relevancia: 5 }, // Clássico Cebraspe
        { nome: "Correspondência oficial (Manual da Presidência): Aspectos gerais e finalidade", relevancia: 2 },
        { nome: "Correspondência oficial: Adequação da linguagem e formato", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico-Matemático",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Modelagem de situações-problema (equações 1º/2º grau, sistemas)", relevancia: 3 },
        { nome: "Funções: Análise gráfica, afim, quadrática, exponencial e logarítmica", relevancia: 4 },
        { nome: "Taxas de variação: Razão, proporção e Regra de três", relevancia: 3 },
        { nome: "Porcentagem", relevancia: 4 },
        { nome: "Sequências numéricas, PA e PG", relevancia: 3 },
        { nome: "Contagem, probabilidade e estatística básica", relevancia: 5 },
        { nome: "Análise de dados: tabelas, gráficos, médias e desvios", relevancia: 3 },
        { nome: "Teoria dos conjuntos", relevancia: 2 },
        { nome: "Geometria plana: mapas, escalas e figuras espaciais", relevancia: 3 },
        { nome: "Métrica: Áreas, volumes e estimativas", relevancia: 3 }
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito de internet e intranet", relevancia: 2 },
        { nome: "Ferramentas de navegação, correio eletrônico e grupos", relevancia: 3 },
        { nome: "Sistema operacional Windows", relevancia: 2 },
        { nome: "Acesso à distância e transferência de arquivos", relevancia: 3 },
        { nome: "Transformação digital: IoT, Big Data e Inteligência Artificial", relevancia: 4 },
        { nome: "Segurança: Vírus, worms, phishing e pragas virtuais", relevancia: 5 },
        { nome: "Aplicativos de segurança (antivírus, firewall, VPN)", relevancia: 4 },
        { nome: "Computação na nuvem (cloud computing)", relevancia: 4 }
      ]
    },
    {
      nome: "Física",
      peso: 1,
      importancia: "Altíssima", // O grande filtro da PRF
      assuntos: [
        { nome: "Cinemática escalar e vetorial", relevancia: 5 },
        { nome: "Movimento circular", relevancia: 4 },
        { nome: "Leis de Newton e suas aplicações", relevancia: 5 },
        { nome: "Trabalho e Potência", relevancia: 3 },
        { nome: "Energia cinética, potencial e atrito", relevancia: 4 },
        { nome: "Conservação de energia e transformações", relevancia: 5 },
        { nome: "Quantidade de movimento e Impulso", relevancia: 4 },
        { nome: "Colisões (Quantidade de movimento)", relevancia: 5 } // Acidentes de trânsito
      ]
    },
    {
      nome: "Ética e Cidadania",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Ética, moral, princípios e valores", relevancia: 3 },
        { nome: "Ética e função pública: integridade", relevancia: 3 },
        { nome: "Ética no setor público (Lei 8.112/90 e Decreto 1.171/94)", relevancia: 5 },
        { nome: "Governança pública (Decreto 9.203/2017)", relevancia: 2 },
        { nome: "Sistema de Gestão da Ética (Decreto 6.029/2007)", relevancia: 3 },
        { nome: "Código de Conduta da Alta Administração", relevancia: 1 },
        { nome: "Ética e democracia: cidadania e transparência (LAI - Lei 12.527/11)", relevancia: 4 },
        { nome: "Conflito de interesses e nepotismo (Lei 12.813/13 e Decreto 7.203/10)", relevancia: 4 }
      ]
    },
    {
      nome: "Geopolítica",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "O Brasil político: nação, território e organização do Estado", relevancia: 3 },
        { nome: "Divisão inter-regional do trabalho e produção", relevancia: 3 },
        { nome: "Estrutura urbana, metrópoles e distribuição da população", relevancia: 4 },
        { nome: "Integração indústria, estrutura urbana e setor agrícola", relevancia: 3 },
        { nome: "Rede de transporte no Brasil: modais e infraestruturas", relevancia: 5 }, // Foco PRF
        { nome: "Integração do Brasil na economia internacional", relevancia: 2 },
        { nome: "Geografia e gestão ambiental", relevancia: 3 },
        { nome: "Macrodivisão natural: biomas, domínios e ecossistemas", relevancia: 3 }
      ]
    },
    {
      nome: "Língua Estrangeira (Inglês ou Espanhol)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Compreensão de texto escrito", relevancia: 5 },
        { nome: "Itens gramaticais relevantes para compreensão semântica", relevancia: 4 }
      ]
    },

    // --- BLOCO II (O MAIS IMPORTANTE) ---
    {
      nome: "Legislação de Trânsito",
      peso: 3, // Peso triplo na prática (Bloco II inteiro)
      importancia: "Crítica",
      assuntos: [
        { nome: "Código de Trânsito Brasileiro (Lei 9.503/97) e alterações", relevancia: 5 },
        { nome: "Lei nº 5.970/1973", relevancia: 1 },
        { nome: "Resoluções CONTRAN: Sinais Sonoros/Apitos e Fiscalização (diversas)", relevancia: 5 },
        { nome: "Resoluções CONTRAN: Equipamentos Obrigatórios", relevancia: 5 },
        { nome: "Resoluções CONTRAN: Pesos e Dimensões", relevancia: 4 },
        { nome: "Resoluções CONTRAN: Transporte de Crianças e Cargas", relevancia: 5 },
        { nome: "Resoluções CONTRAN: Alcoolemia e Exames (Res. 432)", relevancia: 5 },
        { nome: "Resoluções CONTRAN: Motociclistas e Capacetes", relevancia: 4 },
        { nome: "Resoluções CONTRAN: Processo Administrativo e Infrações", relevancia: 4 },
        { nome: "Demais Resoluções citadas no edital (ex: 789, 798, 806...)", relevancia: 3 }
      ]
    },

    // --- BLOCO III ---
    {
      nome: "Direito Administrativo",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Organização administrativa: Centralização, descentralização e desconcentração", relevancia: 3 },
        { nome: "Administração direta e indireta", relevancia: 3 },
        { nome: "Ato administrativo: Conceito, requisitos, atributos, classificação e espécies", relevancia: 5 },
        { nome: "Agentes públicos: Lei 8.112/90, Conceitos e Espécies", relevancia: 5 },
        { nome: "Carreira PRF (Lei 9.654/98, Indenizações e Decreto 8.282/14)", relevancia: 4 },
        { nome: "Poderes administrativos: Hierárquico, disciplinar, regulamentar e de polícia", relevancia: 5 },
        { nome: "Licitação: Princípios, Contratação direta e Modalidades", relevancia: 3 },
        { nome: "Controle da Administração (Administrativo, Judicial e Legislativo)", relevancia: 3 },
        { nome: "Responsabilidade civil do Estado (Comissiva e Omissiva)", relevancia: 4 },
        { nome: "Regime jurídico-administrativo e Princípios", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Poder constituinte (originário, derivado e reforma)", relevancia: 2 },
        { nome: "Direitos e deveres individuais e coletivos (Art. 5º)", relevancia: 5 },
        { nome: "Direitos sociais, nacionalidade e direitos políticos", relevancia: 4 },
        { nome: "Remédios constitucionais", relevancia: 4 },
        { nome: "Poder Executivo: atribuições e responsabilidades", relevancia: 3 },
        { nome: "Defesa do Estado: Forças Armadas e Segurança Pública (Art. 144)", relevancia: 5 },
        { nome: "Atribuições constitucionais da PRF", relevancia: 5 },
        { nome: "Ordem social: Seguridade, Meio ambiente, Família", relevancia: 2 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios básicos e Aplicação da lei penal (Tempo e Espaço)", relevancia: 4 },
        { nome: "Tipicidade: Dolo, culpa, erro de tipo, consumação e tentativa", relevancia: 5 },
        { nome: "Ilicitude e suas excludentes", relevancia: 5 },
        { nome: "Culpabilidade, Imputabilidade e Erro de proibição", relevancia: 4 },
        { nome: "Crimes contra a pessoa e patrimônio", relevancia: 4 },
        { nome: "Crimes contra a dignidade sexual e fé pública", relevancia: 3 },
        { nome: "Crimes contra a Administração Pública", relevancia: 5 },
        { nome: "Crimes contra a incolumidade pública", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Processual Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Ação penal: Conceito, espécies e condições", relevancia: 3 },
        { nome: "Termo Circunstanciado de Ocorrência (TCO)", relevancia: 5 }, // Muito prático para PRF
        { nome: "Prova: Conceito, preservação de local, ilícitas e meios de prova", relevancia: 4 },
        { nome: "Busca e apreensão", relevancia: 4 },
        { nome: "Prisão: Conceito, espécies e Prisão em flagrante", relevancia: 5 },
        { nome: "Identificação Criminal (Lei 12.037/2009)", relevancia: 3 },
        { nome: "Diligências Investigatórias", relevancia: 2 }
      ]
    },
    {
      nome: "Legislação Especial",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Lei 5.553/68 e Lei 12.037/09 (Identificação)", relevancia: 2 },
        { nome: "Estatuto da Criança e do Adolescente (Lei 8.069/90)", relevancia: 4 },
        { nome: "Crimes Hediondos (Lei 8.072/90)", relevancia: 3 },
        { nome: "Lei 9.099/95 (Jecrim)", relevancia: 4 },
        { nome: "Lei de Tortura (Lei 9.455/97)", relevancia: 4 },
        { nome: "Crimes Ambientais (Lei 9.605/98)", relevancia: 4 },
        { nome: "Estatuto do Desarmamento (Lei 10.826/03)", relevancia: 5 },
        { nome: "Lei de Drogas (Lei 11.343/06)", relevancia: 5 }, // Apreensões constantes
        { nome: "Organização Criminosa (Lei 12.850/13)", relevancia: 3 },
        { nome: "Sistema Único de Segurança Pública (Lei 13.675/18)", relevancia: 3 },
        { nome: "Abuso de Autoridade (Lei 13.869/19)", relevancia: 5 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Direitos humanos na CF e tratados internacionais", relevancia: 4 },
        { nome: "Declaração Universal dos Direitos Humanos", relevancia: 5 },
        { nome: "Convenção Americana sobre Direitos Humanos (Pacto de São José)", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPRF = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PRF (Policial Rodoviário)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "prf_policial"), EDITAL_PRF_COMPLETO);
        alert("Edital PRF instalado com sucesso!");
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
             : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
         } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
     >
         {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
     </button>
   );
 };

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA ---
export const editalConfig = {
    id: "prf_policial",
    titulo: "PRF - Policia Rodoviário Federal ",
    banca: "Cebraspe",
    tipo: "federal",
    logo: "/logosEditais/logo-prf.png"
};

export default SeedEditalPRF;