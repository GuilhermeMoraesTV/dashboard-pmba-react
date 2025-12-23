import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

// Dados extraídos do PDF "1650658187_22042022pcbainvestigadoreditalverticalizado.pdf"
const EDITAL_PCBA_INVESTIGADOR = {
  titulo: "Investigador PCBA",
  banca: "IBFC (Edital 2022)",
  logoUrl: "/logosEditais/logo-pcba.png", // Certifique-se de ter essa imagem ou remova
  instituicao: "PCBA",
  disciplinas: [
    {
      nome: "LÍNGUA PORTUGUESA",
      peso_sugerido: 2,
      assuntos: [
        "1. Compreensão e interpretação de textos.",
        "2. Tipologia textual e gêneros textuais.",
        "3. Ortografia oficial.",
        "4. Acentuação gráfica.",
        "5. Classes de palavras.",
        "6. Uso do sinal indicativo de crase.",
        "7. Sintaxe da oração e do período.",
        "8. Pontuação.",
        "9. Concordância nominal e verbal.",
        "10. Regência nominal e verbal.",
        "11. Significação das palavras."
      ]
    },
    {
      nome: "RACIOCÍNIO LÓGICO",
      peso_sugerido: 1,
      assuntos: [
        "1. Estruturas lógicas.",
        "2. Lógica de argumentação: analogias, inferências, deduções e conclusões.",
        "3. Lógica sentencial (ou proposicional): proposições simples e compostas; tabelas-verdade; equivalências; leis de De Morgan; diagramas lógicos.",
        "4. Lógica de primeira ordem.",
        "5. Princípios de contagem e probabilidade.",
        "6. Operações com conjuntos.",
        "7. Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais."
      ]
    },
    {
      nome: "ATUALIDADES",
      peso_sugerido: 1,
      assuntos: [
        "1. Tópicos relevantes e atuais de diversas áreas, tais como política, economia, sociedade, educação, tecnologia, energia, relações internacionais, desenvolvimento sustentável, segurança pública, ecologia e seus reflexos no mundo, no Brasil e na Bahia."
      ]
    },
    {
      nome: "INFORMÁTICA",
      peso_sugerido: 1,
      assuntos: [
        "1. Conceito de internet e intranet.",
        "2. Conceitos e modos de utilização de tecnologias, ferramentas, aplicativos e procedimentos associados a internet/intranet.",
        "2.1. Ferramentas e aplicativos comerciais de navegação, de correio eletrônico, de grupos de discussão, de busca, de pesquisa e de redes sociais.",
        "2.2. Noções de sistema operacional (ambiente Windows).",
        "2.3. Acesso à distância a computadores, transferência de informação e arquivos, aplicativos de áudio, vídeo e multimídia.",
        "2.4. Edição de textos, planilhas e apresentações (ambientes Microsoft Office e BrOffice).",
        "3. Redes de computadores.",
        "4. Conceitos de proteção e segurança.",
        "4.1. Noções de vírus, worms e pragas virtuais.",
        "4.2. Aplicativos para segurança (antivírus, firewall, antispyware etc.).",
        "5. Computação na nuvem (cloud computing)."
      ]
    },
    {
      nome: "PROMOÇÃO DA IGUALDADE RACIAL E DE GÊNERO",
      peso_sugerido: 1,
      assuntos: [
        "1. Constituição da República Federativa do Brasil (art. 1º, 3º, 4º e 5º).",
        "2. Constituição do Estado da Bahia, (cap. XXIII “Do Negro”).",
        "3. Lei federal no 12.288, de 20 de julho de 2010 (Estatuto da Igualdade Racial).",
        "4. Lei federal nº 7.716, de 5 de janeiro de 1989 (Define os crimes resultantes de preconceito de raça ou de cor) e Lei federal n° 9.459, de 13 de maio de 1997 (Tipificação dos crimes resultantes de preconceito de raça ou de cor).",
        "5. Decreto federal no 65.810, de 8 de dezembro de 1969 (Convenção internacional sobre a eliminação de todas as formas de discriminação racial).",
        "6. Decreto federal no 4.377, de 13 de setembro de 2002 (Convenção sobre a eliminação de todas as formas de discriminação contra a mulher).",
        "7. Lei federal nº 11.340, de 7 de agosto de 2006 (Lei Maria da Penha).",
        "8. Código Penal Brasileiro (art. 140).",
        "9. Lei federal n° 9.455, de 7 de abril de 1997 (Crime de Tortura).",
        "10. Lei federal n° 2.889, de 1 de outubro de 1956 (Define e pune o Crime de Genocídio).",
        "11. Lei federal nº 7.437, de 20 de dezembro de 1985 (Lei Caó).",
        "12. Lei estadual no 10.549, de 28 de dezembro de 2006 (Secretaria de Promoção da Igualdade Racial); alterada pela Lei estadual no 12.212, de 04 de maio de 2011.",
        "13. Lei federal nº 10.639, de 9 de janeiro de 2003 (Altera a Lei no 9.394, de 20 de dezembro de 1996, que estabelece as diretrizes e bases da educação nacional, para incluir no currículo oficial da Rede de Ensino a obrigatoriedade da temática \"História e Cultura Afro-Brasileira\", e dá outras providências).",
        "14. Lei federal nº 10.678, de 23 de maio de 2003 (Cria a Secretaria de Políticas de Promoção da Igualdade Racial da Presidência da República, e dá outras providências)."
      ]
    },
    {
      nome: "MEDICINA LEGAL",
      peso_sugerido: 2,
      assuntos: [
        "1. Noções de Medicina Legal.",
        "1.1. Conceito, importância e divisões da Medicina Legal.",
        "1.2. Corpo de delito, perícia e peritos em Medicina Legal.",
        "1.3. Documentos médico-legais.",
        "1.4. Conceitos de identidade, de identificação e de reconhecimento.",
        "1.5. Principais métodos de identificação.",
        "2. Traumatologia forense.",
        "2.1. Resultado da ação de instrumentos perfurantes, cortantes, contundentes, perfurocortantes, perfurocontundentes e cortocontundentes.",
        "2.2. Agentes físicos não mecânicos: ação do calor, do frio, da eletricidade, da pressão atmosférica e das radiações.",
        "2.3. Lesões corporais: artigo 129 do Código Penal.",
        "3. Tanatologia forense.",
        "3.1. Conceito de morte.",
        "3.2. Fenômenos cadavéricos abióticos (imediatos e consecutivos) e transformativos (destrutivos e conservadores).",
        "3.3. Cronotanatognose.",
        "3.4. Necropsia, exumação, causa jurídica da morte e morte súbita.",
        "4. Sexologia forense.",
        "4.1. Crimes contra a dignidade sexual.",
        "4.2. Aborto e infanticídio.",
        "4.3. Transtornos da sexualidade e do instinto sexual.",
        "5. Asfixiologia forense.",
        "5.1. Conceito e classificação das asfixias de interesse médico-legal.",
        "6. Toxicologia forense.",
        "6.1. Conceito.",
        "6.2. Embriaguez, tolerância, dependência e síndrome de abstinência.",
        "6.3. Aspectos médico-legais das drogas ilícitas (cocaína, maconha, anfetaminas, opiáceos e alucinógenos).",
        "7. Psicopatologia forense.",
        "7.1. Imputabilidade penal e capacidade civil.",
        "7.2. Doença mental, desenvolvimento mental incompleto ou retardado e perturbação da saúde mental."
      ]
    },
    {
      nome: "DIREITO ADMINISTRATIVO",
      peso_sugerido: 2,
      assuntos: [
        "1. Estado, governo e administração pública: conceitos, elementos, poderes e organização; natureza, fins e princípios.",
        "2. Organização administrativa da União: administração direta e indireta.",
        "3. Agentes públicos: espécies e classificação; poderes, deveres e prerrogativas; cargo, emprego e função públicos; regime jurídico único: provimento, vacância, remoção, redistribuição e substituição; direitos e vantagens; regime disciplinar; responsabilidade civil, criminal e administrativa.",
        "4. Poderes administrativos: poder hierárquico; poder disciplinar; poder regulamentar; poder de polícia; uso e abuso do poder.",
        "5. Atos administrativos: conceitos, requisitos, atributos, classificação, espécies e invalidação.",
        "6. Serviços públicos: conceito, classificação, regulamentação e controle; forma, meios e requisitos; delegação: concessão, permissão, autorização.",
        "7. Controle e responsabilização da administração: controle administrativo; controle judicial; controle legislativo; responsabilidade civil do Estado.",
        "8. Lei Estadual n° 12.209/2011 (Lei de Processo Administrativo do Estado da Bahia).",
        "9. Lei Estadual n° 6.677/94 (Estatuto dos Servidores Públicos do Estado da Bahia).",
        "10. Lei Estadual n° 11.370/2009 (Lei Orgânica da Polícia Civil do Estado da Bahia)."
      ]
    },
    {
      nome: "DIREITO CONSTITUCIONAL",
      peso_sugerido: 2,
      assuntos: [
        "1. Constituição da República Federativa do Brasil de 1988.",
        "1.1. Princípios fundamentais.",
        "2. Direitos e garantias fundamentais.",
        "2.1. Direitos e deveres individuais e coletivos.",
        "2.2. Direitos sociais.",
        "2.3. Nacionalidade.",
        "2.4. Direitos políticos.",
        "2.5. Partidos políticos.",
        "3. Organização político-administrativa.",
        "3.1. União, estados, Distrito Federal, municípios e territórios.",
        "4. Administração pública.",
        "4.1. Disposições gerais, servidores públicos.",
        "5. Poder Legislativo.",
        "5.1. Congresso Nacional, Câmara dos Deputados, Senado Federal, deputados e senadores.",
        "5.2. Processo legislativo.",
        "6. Poder Executivo.",
        "6.1. Presidente e vice-presidente da República, atribuições e responsabilidades.",
        "6.2. Poder regulamentar e medidas provisórias.",
        "7. Poder Judiciário.",
        "7.1. Disposições gerais.",
        "7.2. Órgãos do Poder Judiciário.",
        "7.3. Funções essenciais à Justiça.",
        "8. Defesa do Estado e das instituições democráticas.",
        "8.1. Estado de defesa e estado de sítio.",
        "8.2. Forças Armadas.",
        "8.3. Segurança pública.",
        "9. Constituição do Estado da Bahia.",
        "9.1. Dos Servidores Públicos Civis.",
        "9.2. Da Segurança Pública.",
        "9.3. Da Polícia Civil."
      ]
    },
    {
      nome: "DIREITO PENAL",
      peso_sugerido: 2,
      assuntos: [
        "1. Princípios constitucionais do Direito Penal.",
        "2. A lei penal no tempo.",
        "3. A lei penal no espaço.",
        "4. Interpretação da lei penal.",
        "5. Infração penal: elementos, espécies.",
        "6. Sujeito ativo e sujeito passivo da infração penal.",
        "7. Tipicidade, ilicitude, culpabilidade, punibilidade.",
        "8. Erro de tipo e erro de proibição.",
        "9. Imputabilidade penal.",
        "10. Concurso de pessoas.",
        "11. Crimes contra a pessoa.",
        "12. Crimes contra o patrimônio.",
        "13. Crimes contra a dignidade sexual.",
        "14. Crimes contra a incolumidade pública.",
        "15. Crimes contra a paz pública.",
        "16. Crimes contra a fé pública.",
        "17. Crimes contra a administração pública."
      ]
    },
    {
      nome: "DIREITO PROCESSUAL PENAL",
      peso_sugerido: 2,
      assuntos: [
        "1. Inquérito policial; notitia criminis.",
        "2. Ação penal; espécies.",
        "3. Jurisdição; competência.",
        "4. Prova (artigos 155 a 250 do CPP).",
        "5. Prisão em flagrante.",
        "6. Prisão preventiva.",
        "7. Prisão temporária (Lei n° 7.960/89).",
        "8. Liberdade provisória; fiança."
      ]
    },
    {
      nome: "LEGISLAÇÃO EXTRAVAGANTE",
      peso_sugerido: 2,
      assuntos: [
        "1. Lei n° 10.826/03 (Estatuto do Desarmamento).",
        "2. Lei n° 11.343/06 (Lei de Drogas).",
        "3. Lei n° 7.210/84 (Lei de Execução Penal).",
        "4. Lei n° 8.072/90 (Crimes Hediondos).",
        "5. Lei n° 8.069/90 (Estatuto da Criança e do Adolescente): Ato Infracional (art. 103 a 128); Crimes em espécie (art. 225 a 244-B).",
        "6. Lei n° 10.741/03 (Estatuto do Idoso): Dos crimes em espécie (art. 95 a 108).",
        "7. Lei n° 9.099/95 (Juizados Especiais Criminais – art. 60 a 97).",
        "8. Lei n° 12.850/13 (Crime Organizado).",
        "9. Lei n° 9.613/98 (Lavagem de Dinheiro).",
        "10. Lei n° 9.455/97 (Crime de Tortura).",
        "11. Lei n° 13.869/19 (Abuso de Autoridade).",
        "12. Lei n° 8.429/92 (Improbidade Administrativa).",
        "13. Lei nº 9.605/98 (Crimes Ambientais).",
        "14. Lei nº 13.146/15 (Estatuto da Pessoa com Deficiência): Dos crimes em espécie (art. 88 a 91).",
        "15. Lei nº 7.716/89 (Crimes de Preconceito Racial).",
        "16. Lei nº 8.137/90 (Crimes contra a Ordem Tributária).",
        "17. Lei nº 9.296/96 (Interceptação Telefônica).",
        "18. Lei nº 11.340/06 (Lei Maria da Penha).",
        "19. Lei nº 12.037/09 (Identificação Criminal)."
      ]
    }
  ]
};

const SeedEditalPCBA = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital PCBA?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pcba_investigador"), EDITAL_PCBA_INVESTIGADOR);
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

export default SeedEditalPCBA;