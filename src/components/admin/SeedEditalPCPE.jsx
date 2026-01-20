import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PCPE_AGENTE = {
  titulo: "Agente PCPE",
  banca: "Cebraspe (Pré-Edital)",
  logoUrl: "/logosEditais/logo-pcpe.png", // Certifique-se de adicionar esta imagem na pasta public
  instituicao: "PCPE",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos de gêneros variados", relevancia: 5 },
        { nome: "Reconhecimento de tipos e gêneros textuais", relevancia: 3 },
        { nome: "Domínio da ortografia oficial", relevancia: 2 },
        { nome: "Mecanismos de coesão: referenciação, substituição e repetição", relevancia: 4 },
        { nome: "Conectores e elementos de sequenciação textual", relevancia: 4 },
        { nome: "Emprego de tempos e modos verbais", relevancia: 3 },
        { nome: "Estrutura morfossintática: emprego das classes de palavras", relevancia: 3 },
        { nome: "Relações de coordenação e subordinação (orações e termos)", relevancia: 5 },
        { nome: "Emprego dos sinais de pontuação", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 5 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 4 },
        { nome: "Colocação dos pronomes átonos", relevancia: 3 },
        { nome: "Reescrita de frases: significação e substituição de palavras", relevancia: 4 },
        { nome: "Reescrita: reorganização da estrutura de orações e períodos", relevancia: 4 },
        { nome: "Reescrita: níveis de formalidade", relevancia: 2 },
        { nome: "Correspondência oficial (Manual da Presidência): aspectos gerais e finalidade", relevancia: 2 },
        { nome: "Adequação da linguagem e formato em documentos oficiais", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Sistema Operacional Windows: fundamentos, janelas, menus, barra de tarefas", relevancia: 2 },
        { nome: "Gerenciamento de pastas e arquivos (Windows Explorer)", relevancia: 3 },
        { nome: "Configurações básicas do Windows", relevancia: 1 },
        { nome: "Word: formatação, margens, fontes, destaque", relevancia: 3 },
        { nome: "Word: listas, colunas, tabelas, cabeçalhos e rodapés", relevancia: 2 },
        { nome: "Excel: fórmulas, datas, referências (absoluta/relativa)", relevancia: 5 },
        { nome: "Excel: funções (matemáticas, estatísticas, financeiras, texto)", relevancia: 5 },
        { nome: "Excel: formatação, classificação de dados e gráficos", relevancia: 3 },
        { nome: "PowerPoint: criação, slides, animação, slide mestre", relevancia: 2 },
        { nome: "Redes de Computadores: conceitos, internet, intranet", relevancia: 4 },
        { nome: "Grupos de discussão, Redes Sociais e Computação na Nuvem", relevancia: 3 },
        { nome: "Navegadores, Deep Web e Dark Web", relevancia: 3 },
        { nome: "Correio Eletrônico e Sítios de busca", relevancia: 2 },
        { nome: "Segurança: malwares, antivírus, criptografia e backup", relevancia: 5 }
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso: 1,
      importancia: "Alta", // Cebraspe costuma pesar a mão aqui
      assuntos: [
        { nome: "Conjuntos numéricos (inteiros, racionais e reais)", relevancia: 2 },
        { nome: "Razões, proporções e divisão proporcional", relevancia: 3 },
        { nome: "Regras de três (simples/composta) e Porcentagens", relevancia: 4 },
        { nome: "Equações e inequações (1º e 2º graus)", relevancia: 2 },
        { nome: "Sistemas lineares", relevancia: 2 },
        { nome: "Funções e gráficos", relevancia: 3 },
        { nome: "Princípios de contagem", relevancia: 4 },
        { nome: "Progressões aritméticas e geométricas", relevancia: 3 },
        { nome: "Estruturas lógicas e Lógica de argumentação", relevancia: 5 },
        { nome: "Lógica sentencial: proposições, tabelas-verdade, equivalências", relevancia: 5 },
        { nome: "Leis de Morgan e Diagramas lógicos", relevancia: 4 },
        { nome: "Lógica de primeira ordem", relevancia: 3 },
        { nome: "Probabilidade e Operações com conjuntos", relevancia: 4 },
        { nome: "Raciocínio envolvendo problemas aritméticos, geométricos e matriciais", relevancia: 3 }
      ]
    },
    {
      nome: "Noções de Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios fundamentais (CF/88)", relevancia: 3 },
        { nome: "Poderes Constituintes: Originário, Derivado e Decorrente", relevancia: 2 },
        { nome: "Aplicabilidade das normas constitucionais", relevancia: 3 },
        { nome: "Direitos e garantias fundamentais", relevancia: 5 },
        { nome: "Organização político-administrativa (União, Estados, DF, Municípios)", relevancia: 3 },
        { nome: "Administração Pública: disposições gerais e servidores", relevancia: 4 },
        { nome: "Poder Executivo, Legislativo e Judiciário", relevancia: 3 },
        { nome: "Funções essenciais à justiça (MP, Advocacia, Defensoria)", relevancia: 3 },
        { nome: "Defesa do Estado e das Instituições Democráticas", relevancia: 2 },
        { nome: "Segurança Pública (CF/88 e Constituição de PE)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, governo e administração pública", relevancia: 2 },
        { nome: "Ato administrativo", relevancia: 5 },
        { nome: "Poderes: hierárquico, disciplinar, regulamentar e de polícia", relevancia: 5 },
        { nome: "Uso e abuso do poder", relevancia: 4 },
        { nome: "Regime jurídico-administrativo e Princípios", relevancia: 4 },
        { nome: "Responsabilidade civil do Estado", relevancia: 4 },
        { nome: "Serviços públicos", relevancia: 3 },
        { nome: "Organização adm: centralização, descentralização, desconcentração", relevancia: 4 },
        { nome: "Administração direta e indireta", relevancia: 4 },
        { nome: "Controle da administração (administrativo, judicial, legislativo)", relevancia: 3 },
        { nome: "Improbidade administrativa", relevancia: 5 },
        { nome: "Processo administrativo", relevancia: 2 },
        { nome: "Licitações e contratos administrativos", relevancia: 3 },
        { nome: "Agente público: cargo, emprego, função e disposições constitucionais", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios básicos, Crime e Contravenção", relevancia: 3 },
        { nome: "Aplicação da lei penal (tempo, espaço, territorialidade)", relevancia: 4 },
        { nome: "Crimes contra a pessoa", relevancia: 5 },
        { nome: "Crimes contra o patrimônio", relevancia: 5 },
        { nome: "Crimes contra a dignidade sexual", relevancia: 4 },
        { nome: "Crimes contra a administração pública", relevancia: 5 },
        { nome: "Crimes Hediondos (Lei nº 8.072/1990)", relevancia: 4 },
        { nome: "Preconceito de Raça ou de Cor (Lei nº 7.716/1989)", relevancia: 3 },
        { nome: "Abuso de Autoridade (Lei nº 13.869/2019)", relevancia: 5 },
        { nome: "Crimes de Tortura (Lei nº 9.455/1997)", relevancia: 4 },
        { nome: "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)", relevancia: 3 },
        { nome: "Organizações Criminosas (Lei nº 12.850/2013)", relevancia: 5 },
        { nome: "Crimes de Trânsito (Lei nº 9.503/1997)", relevancia: 3 },
        { nome: "Violência doméstica (Lei Maria da Penha - 11.340/2006)", relevancia: 5 },
        { nome: "Lei de Drogas (Lei nº 11.343/2006)", relevancia: 5 },
        { nome: "Lei Henry Borel (Violência contra criança/adolescente - 14.344/2022)", relevancia: 3 },
        { nome: "Crimes Ambientais (Lei nº 9.605/1998)", relevancia: 2 },
        { nome: "Estatuto do Desarmamento (Lei nº 10.826/2003)", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito Processual Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Aplicação da lei processual (tempo, espaço, pessoas)", relevancia: 2 },
        { nome: "Inquérito policial", relevancia: 5 },
        { nome: "Prova (corpo de delito, interrogatório, testemunhas, busca e apreensão)", relevancia: 5 },
        { nome: "Prisão e liberdade provisória", relevancia: 5 },
        { nome: "Medidas cautelares diversas da prisão", relevancia: 4 },
        { nome: "Prisão temporária (Lei nº 7.960/1989)", relevancia: 4 },
        { nome: "Juizados Especiais Criminais (Lei nº 9.099/1995)", relevancia: 3 },
        { nome: "Investigação Criminal (Lei nº 12.830/2013)", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Estadual",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Constituição de PE (artigos 101 a 105-B)", relevancia: 4 },
        { nome: "Estatuto do Policial Civil (Lei nº 6.425/1972)", relevancia: 5 },
        { nome: "Estatuto do Servidor de PE (Lei nº 6.123/1968)", relevancia: 4 },
        { nome: "Lei Complementar nº 137/2008", relevancia: 2 },
        { nome: "Lei Complementar nº 317/2015", relevancia: 2 }
      ]
    },
    {
      nome: "Contabilidade Geral",
      peso: 1,
      importancia: "Muito Alta", // Diferencial em provas de polícia modernas
      assuntos: [
        { nome: "Conceitos, objetivos e finalidades da contabilidade", relevancia: 2 },
        { nome: "Patrimônio: componentes, equação fundamental, situação líquida", relevancia: 4 },
        { nome: "Atos e fatos administrativos (permutativos, modificativos, mistos)", relevancia: 4 },
        { nome: "Contas: débitos, créditos, saldos e plano de contas", relevancia: 5 },
        { nome: "Escrituração: lançamentos, elementos, fórmulas, regimes (competência/caixa)", relevancia: 5 },
        { nome: "Contabilização de operações diversas (juros, descontos, tributos, folha, depreciação)", relevancia: 4 },
        { nome: "Balancete de verificação", relevancia: 3 },
        { nome: "Balanço patrimonial: composição e objetivo", relevancia: 5 },
        { nome: "Demonstração de resultado de exercício (DRE)", relevancia: 4 },
        { nome: "Normas Brasileiras de Contabilidade", relevancia: 2 }
      ]
    },
    {
      nome: "Estatística",
      peso: 1,
      importancia: "Alta", // Outro diferencial importante
      assuntos: [
        { nome: "Estatística descritiva: gráficos, tabelas e diagramas", relevancia: 3 },
        { nome: "Medidas descritivas: posição (média, moda, mediana)", relevancia: 5 },
        { nome: "Medidas de dispersão, assimetria e curtose", relevancia: 4 },
        { nome: "Probabilidade: definições, axiomas, condicional e independência", relevancia: 5 },
        { nome: "Técnicas de amostragem (aleatória, estratificada, sistemática)", relevancia: 3 }
      ]
    },
    {
      nome: "Atualidades (Discursiva)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Tópicos relevantes e atuais na área de segurança pública", relevancia: 5 }
      ]
    }
  ]
};

const SeedEditalPCPE = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital Agente PCPE?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pcpe_agente"), EDITAL_PCPE_AGENTE);
        alert("Edital PCPE Agente instalado com sucesso!");
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
    id: "pcpe_agente",
    titulo: "Agente PCPE",
    banca: "Cebraspe",
    tipo: "pc",
    logo: "/logosEditais/logo-pcpe.png"
};

export default SeedEditalPCPE;