import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PCBA_INVESTIGADOR = {
  titulo: "Investigador PCBA",
  banca: "IBFC (Edital 2022)",
  logoUrl: "/logosEditais/logo-pcba.png",
  instituicao: "PCBA",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 },
        { nome: "Tipologia textual e gêneros textuais", relevancia: 3 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Classes de palavras", relevancia: 4 },
        { nome: "Uso do sinal indicativo de crase", relevancia: 3 },
        { nome: "Sintaxe da oração e do período", relevancia: 4 },
        { nome: "Pontuação", relevancia: 3 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Regência nominal e verbal", relevancia: 4 },
        { nome: "Significação das palavras", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Estruturas lógicas", relevancia: 3 },
        { nome: "Lógica de argumentação: analogias, inferências, deduções e conclusões", relevancia: 4 },
        { nome: "Lógica sentencial (ou proposicional): proposições simples e compostas; tabelas-verdade; equivalências; leis de De Morgan; diagramas lógicos", relevancia: 5 },
        { nome: "Lógica de primeira ordem", relevancia: 2 },
        { nome: "Princípios de contagem e probabilidade", relevancia: 4 },
        { nome: "Operações com conjuntos", relevancia: 3 },
        { nome: "Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais", relevancia: 3 }
      ]
    },
    {
      nome: "Atualidades",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Tópicos relevantes e atuais de diversas áreas: política, economia, sociedade, tecnologia e segurança pública na Bahia e no Brasil", relevancia: 4 }
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Alta", // IBFC costuma apertar em Informática
      assuntos: [
        { nome: "Conceito de internet e intranet", relevancia: 3 },
        { nome: "Tecnologias, ferramentas, aplicativos e procedimentos associados a internet/intranet", relevancia: 3 },
        { nome: "Ferramentas e aplicativos de navegação, correio eletrônico, busca e redes sociais", relevancia: 4 },
        { nome: "Noções de sistema operacional (ambiente Windows)", relevancia: 4 },
        { nome: "Acesso à distância, transferência de arquivos e multimídia", relevancia: 2 },
        { nome: "Edição de textos, planilhas e apresentações (Microsoft Office e BrOffice)", relevancia: 5 },
        { nome: "Redes de computadores", relevancia: 3 },
        { nome: "Conceitos de proteção e segurança", relevancia: 5 },
        { nome: "Noções de vírus, worms e pragas virtuais", relevancia: 5 },
        { nome: "Aplicativos para segurança (antivírus, firewall, antispyware etc.)", relevancia: 4 },
        { nome: "Computação na nuvem (cloud computing)", relevancia: 4 }
      ]
    },
    {
      nome: "Promoção da Igualdade Racial e de Gênero",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Constituição Federal (art. 1º, 3º, 4º e 5º)", relevancia: 4 },
        { nome: "Constituição do Estado da Bahia (cap. XXIII “Do Negro”)", relevancia: 4 },
        { nome: "Estatuto da Igualdade Racial (Lei 12.288/10)", relevancia: 5 },
        { nome: "Leis de crimes de preconceito (Lei 7.716/89 e Lei 9.459/97)", relevancia: 5 },
        { nome: "Convenção internacional sobre a eliminação da discriminação racial", relevancia: 2 },
        { nome: "Convenção sobre a eliminação da discriminação contra a mulher", relevancia: 2 },
        { nome: "Lei Maria da Penha (Lei 11.340/06)", relevancia: 5 },
        { nome: "Código Penal Brasileiro (art. 140 - Injúria)", relevancia: 4 },
        { nome: "Lei de Crime de Tortura (Lei 9.455/97)", relevancia: 5 },
        { nome: "Crime de Genocídio (Lei 2.889/56)", relevancia: 2 },
        { nome: "Lei Caó (Lei 7.437/85)", relevancia: 3 },
        { nome: "Secretaria de Promoção da Igualdade Racial (Lei estadual 10.549/06)", relevancia: 2 },
        { nome: "História e Cultura Afro-Brasileira (Lei 10.639/03)", relevancia: 3 },
        { nome: "Secretaria de Políticas de Promoção da Igualdade Racial (Lei 10.678/03)", relevancia: 2 }
      ]
    },
    {
      nome: "Medicina Legal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Conceito, importância e divisões da Medicina Legal", relevancia: 2 },
        { nome: "Corpo de delito, perícia e peritos", relevancia: 4 },
        { nome: "Documentos médico-legais", relevancia: 4 },
        { nome: "Conceitos de identidade, identificação e reconhecimento", relevancia: 3 },
        { nome: "Principais métodos de identificação", relevancia: 4 },
        { nome: "Traumatologia forense: instrumentos perfurantes, cortantes e contundentes", relevancia: 5 },
        { nome: "Agentes físicos não mecânicos: calor, frio, eletricidade e radiação", relevancia: 4 },
        { nome: "Lesões corporais (Artigo 129 CP)", relevancia: 5 },
        { nome: "Tanatologia forense: conceito de morte e fenômenos cadavéricos", relevancia: 5 },
        { nome: "Cronotanatognose", relevancia: 4 },
        { nome: "Necropsia, exumação e morte súbita", relevancia: 3 },
        { nome: "Sexologia forense: crimes contra a dignidade sexual", relevancia: 4 },
        { nome: "Aborto e infanticídio", relevancia: 4 },
        { nome: "Transtornos da sexualidade e instinto sexual", relevancia: 2 },
        { nome: "Asfixiologia forense: conceito e classificação", relevancia: 5 },
        { nome: "Toxicologia forense: embriaguez e dependência", relevancia: 4 },
        { nome: "Aspectos médico-legais das drogas ilícitas", relevancia: 5 },
        { nome: "Psicopatologia forense: imputabilidade penal", relevancia: 3 },
        { nome: "Doença mental e perturbação da saúde mental", relevancia: 3 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, governo e administração pública: conceitos e princípios", relevancia: 4 },
        { nome: "Organização administrativa da União: direta e indireta", relevancia: 3 },
        { nome: "Agentes públicos: cargo, emprego e função; regime disciplinar", relevancia: 5 },
        { nome: "Poderes administrativos: hierárquico, disciplinar, regulamentar e polícia", relevancia: 5 },
        { nome: "Atos administrativos: conceitos, requisitos e atributos", relevancia: 5 },
        { nome: "Serviços públicos: concessão, permissão e autorização", relevancia: 3 },
        { nome: "Controle e responsabilização da administração e responsabilidade civil do Estado", relevancia: 4 },
        { nome: "Lei de Processo Administrativo da Bahia (Lei 12.209/11)", relevancia: 4 },
        { nome: "Estatuto dos Servidores Públicos da Bahia (Lei 6.677/94)", relevancia: 5 },
        { nome: "Lei Orgânica da Polícia Civil da Bahia (Lei 11.370/09)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios fundamentais da CF/88", relevancia: 3 },
        { nome: "Direitos e deveres individuais e coletivos (Art. 5º)", relevancia: 5 },
        { nome: "Direitos sociais", relevancia: 3 },
        { nome: "Nacionalidade e Direitos políticos", relevancia: 3 },
        { nome: "Partidos políticos", relevancia: 1 },
        { nome: "Organização político-administrativa: União, Estados e Municípios", relevancia: 3 },
        { nome: "Administração pública e servidores públicos", relevancia: 4 },
        { nome: "Poder Legislativo: Congresso Nacional e processo legislativo", relevancia: 2 },
        { nome: "Poder Executivo: atribuições e responsabilidades do Presidente", relevancia: 3 },
        { nome: "Poder Judiciário: órgãos e disposições gerais", relevancia: 3 },
        { nome: "Funções essenciais à Justiça", relevancia: 3 },
        { nome: "Defesa do Estado: Estado de defesa e Estado de sítio", relevancia: 2 },
        { nome: "Forças Armadas e Segurança Pública (Art. 144)", relevancia: 5 },
        { nome: "Constituição da Bahia: Servidores Públicos Civis", relevancia: 4 },
        { nome: "Constituição da Bahia: Segurança Pública e Polícia Civil", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios constitucionais do Direito Penal", relevancia: 4 },
        { nome: "Lei penal no tempo e no espaço", relevancia: 4 },
        { nome: "Interpretação da lei penal", relevancia: 2 },
        { nome: "Infração penal: elementos e espécies", relevancia: 4 },
        { nome: "Sujeito ativo e sujeito passivo", relevancia: 3 },
        { nome: "Tipicidade, ilicitude, culpabilidade e punibilidade", relevancia: 5 },
        { nome: "Erro de tipo e erro de proibição", relevancia: 4 },
        { nome: "Imputabilidade penal", relevancia: 4 },
        { nome: "Concurso de pessoas", relevancia: 5 },
        { nome: "Crimes contra a pessoa", relevancia: 5 },
        { nome: "Crimes contra o patrimônio", relevancia: 5 },
        { nome: "Crimes contra a dignidade sexual", relevancia: 4 },
        { nome: "Crimes contra a incolumidade pública", relevancia: 3 },
        { nome: "Crimes contra a paz pública", relevancia: 3 },
        { nome: "Crimes contra a fé pública", relevancia: 3 },
        { nome: "Crimes contra a administração pública", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Processual Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Inquérito policial; notitia criminis", relevancia: 5 },
        { nome: "Ação penal; espécies", relevancia: 5 },
        { nome: "Jurisdição e competência", relevancia: 3 },
        { nome: "Prova (artigos 155 a 250 do CPP)", relevancia: 5 },
        { nome: "Prisão em flagrante", relevancia: 5 },
        { nome: "Prisão preventiva", relevancia: 5 },
        { nome: "Prisão temporária (Lei 7.960/89)", relevancia: 4 },
        { nome: "Liberdade provisória e fiança", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Extravagante",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estatuto do Desarmamento (Lei 10.826/03)", relevancia: 5 },
        { nome: "Lei de Drogas (Lei 11.343/06)", relevancia: 5 },
        { nome: "Lei de Execução Penal (Lei 7.210/84)", relevancia: 3 },
        { nome: "Crimes Hediondos (Lei 8.072/90)", relevancia: 5 },
        { nome: "ECA: Ato Infracional e Crimes em espécie", relevancia: 4 },
        { nome: "Estatuto do Idoso: crimes em espécie", relevancia: 3 },
        { nome: "Juizados Especiais Criminais (Lei 9.099/95)", relevancia: 4 },
        { nome: "Crime Organizado (Lei 12.850/13)", relevancia: 5 },
        { nome: "Lavagem de Dinheiro (Lei 9.613/98)", relevancia: 4 },
        { nome: "Crime de Tortura (Lei 9.455/97)", relevancia: 5 },
        { nome: "Abuso de Autoridade (Lei 13.869/19)", relevancia: 5 },
        { nome: "Improbidade Administrativa (Lei 8.429/92)", relevancia: 4 },
        { nome: "Crimes Ambientais (Lei 9.605/98)", relevancia: 3 },
        { nome: "Estatuto da Pessoa com Deficiência: crimes em espécie", relevancia: 2 },
        { nome: "Crimes de Preconceito Racial (Lei 7.716/89)", relevancia: 4 },
        { nome: "Crimes contra a Ordem Tributária (Lei 8.137/90)", relevancia: 2 },
        { nome: "Interceptação Telefônica (Lei 9.296/96)", relevancia: 4 },
        { nome: "Lei Maria da Penha (Lei 11.340/06)", relevancia: 5 },
        { nome: "Identificação Criminal (Lei 12.037/09)", relevancia: 3 }
      ]
    }
  ]
};

// Componente React permanece com a mesma lógica, apenas apontando para a nova chave de documento
const SeedEditalPCBA = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital Investigador PCBA?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pcba_investigador"), EDITAL_PCBA_INVESTIGADOR);
        alert("Edital PCBA Investigador mapeado com sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar.");
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

export default SeedEditalPCBA;