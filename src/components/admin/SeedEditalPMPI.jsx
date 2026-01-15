import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMPI_COMPLETO = {
  titulo: "Soldado PMPI",
  banca: "NUCEPE", // Banca tradicional
  logoUrl: "/logosEditais/logo-pmpi.png",
  instituicao: "PMPI",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão, interpretação e análise de textos de gêneros diversos", relevancia: 5 },
        { nome: "Relações semântico-gramaticais e significação de palavras", relevancia: 3 },
        { nome: "Variação linguística e funções da linguagem", relevancia: 2 },
        { nome: "Estrutura e elementos de comunicação", relevancia: 2 },
        { nome: "Vícios de linguagem e Linguagem figurada", relevancia: 2 },
        { nome: "Aspectos fonológicos: acentuação gráfica", relevancia: 3 },
        { nome: "Morfologia: estrutura, formação, classificação, flexão e emprego da palavra", relevancia: 4 },
        { nome: "Sintaxe: frase, oração e período (simples e composto)", relevancia: 4 },
        { nome: "Relações sintáticas entre termos da oração e entre orações", relevancia: 4 },
        { nome: "Sintaxe de Concordância nominal e verbal", relevancia: 5 },
        { nome: "Sintaxe de Regência nominal", relevancia: 4 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Ortografia oficial", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico e Matemática",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Lógica matemática e argumentativa: proposições simples e compostas", relevancia: 4 },
        { nome: "Negação, condicionais, implicação e equivalência lógica", relevancia: 5 },
        { nome: "Sentenças abertas e problemas de raciocínio lógico", relevancia: 4 },
        { nome: "Conjuntos: tipos, pertinência, inclusão, operações e problemas", relevancia: 3 },
        { nome: "Números (Naturais, Inteiros, Racionais, Irracionais, Reais): operações e expressões", relevancia: 2 },
        { nome: "Múltiplos, divisores, MMC e MDC", relevancia: 3 },
        { nome: "Frações: propriedades, operações e problemas", relevancia: 3 },
        { nome: "Razão, proporção, regra de três (simples e composta) e porcentagens", relevancia: 5 },
        { nome: "Juros simples e juros compostos", relevancia: 4 },
        { nome: "Geometria plana: figuras, congruência, semelhança e relações métricas", relevancia: 4 },
        { nome: "Áreas de polígonos, círculos, coroa e setor circular", relevancia: 4 },
        { nome: "Geometria espacial: prismas, pirâmides, cilindro, cone e esfera (áreas e volumes)", relevancia: 3 },
        { nome: "Medidas: comprimento, superfície, volume, capacidade, massa e tempo", relevancia: 2 },
        { nome: "Equações e inequações (1º e 2º grau) e sistemas de equações", relevancia: 3 },
        { nome: "Funções: polinomial do 1º e 2º grau, exponencial e logarítmica", relevancia: 3 },
        { nome: "Matrizes e sistemas lineares", relevancia: 2 },
        { nome: "Progressão aritmética (PA) e progressão geométrica (PG)", relevancia: 3 },
        { nome: "Probabilidade e análise combinatória", relevancia: 5 }
      ]
    },
    {
      nome: "Conhecimentos Gerais",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Política e economia no espaço nacional e mundial", relevancia: 3 },
        { nome: "Disputas interimperialistas e transformações do espaço capitalista", relevancia: 2 },
        { nome: "Blocos econômicos, potências globais/regionais e Organismos Internacionais", relevancia: 3 },
        { nome: "Globalização e Fragmentação do espaço", relevancia: 3 },
        { nome: "Conflitos étnicos, políticos e religiosos atuais", relevancia: 4 },
        { nome: "Exploração de recursos naturais e desafios geopolíticos do séc. XXI", relevancia: 3 },
        { nome: "Relações econômicas entre o Brasil e o Mundo", relevancia: 3 },
        { nome: "O espaço brasileiro: população, economia e urbanização", relevancia: 4 },
        { nome: "Questão Ambiental: problemas, degradação e conservação (nacional/internacional)", relevancia: 5 }
      ]
    },
    {
      nome: "Conhecimentos Regionais do Piauí",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Território do Piauí: características gerais, socioeconômicas e formação histórica", relevancia: 4 },
        { nome: "Espaço piauiense: população, economia e urbanização", relevancia: 4 },
        { nome: "O espaço agrário piauiense", relevancia: 3 },
        { nome: "Aspectos naturais do Piauí: relevo, clima, vegetação e hidrografia", relevancia: 5 },
        { nome: "Exploração e usos dos recursos naturais no Piauí", relevancia: 3 },
        { nome: "Questão ambiental no Piauí: problemas, degradação e conservação", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação da PMPI",
      peso: 2,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Lei Est. nº 3.808/1981 (Estatuto dos Policiais Militares do PI)", relevancia: 5 },
        { nome: "Lei Est. nº 3.729/1980 (Conselho de Disciplina)", relevancia: 3 },
        { nome: "Decreto nº 3.548/1980 (Regulamento Disciplinar da PMPI)", relevancia: 5 },
        { nome: "Constituição Federal e Estadual (Dispositivos aplicáveis à PM)", relevancia: 3 },
        { nome: "Decreto-Lei Federal nº 667/1969 e alterações", relevancia: 2 },
        { nome: "Decreto Federal nº 88.777/1983 (R-200)", relevancia: 2 },
        { nome: "Lei Complementar nº 68/2006 e Decreto 12.422/2006 (Promoção de Praças)", relevancia: 4 },
        { nome: "Lei nº 6.792/2016 (Lei de Organização Básica da PMPI)", relevancia: 4 },
        { nome: "Lei nº 5.378/2004 (Código de Vencimentos da PMPI)", relevancia: 1 },
        { nome: "Decreto nº 17.999/2018 e 18.089/2019 (Termo Circunstanciado de Ocorrência - TCO)", relevancia: 5 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "CF/88: Princípios Fundamentais", relevancia: 3 },
        { nome: "CF/88: Direitos e Deveres Individuais e Coletivos", relevancia: 5 },
        { nome: "CF/88: Direitos Sociais e Nacionalidade", relevancia: 3 },
        { nome: "CF/88: Organização do Estado (Político-administrativa e Adm. Pública)", relevancia: 4 },
        { nome: "CF/88: Defesa do Estado e das instituições (Segurança Pública)", relevancia: 5 },
        { nome: "Constituição do Piauí: Adm. Pública e Servidores Militares", relevancia: 3 },
        { nome: "Constituição do Piauí: Poder Judiciário (Justiça Militar)", relevancia: 2 },
        { nome: "Constituição do Piauí: Segurança Pública (Polícias e Bombeiros)", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Aplicação da lei penal", relevancia: 3 },
        { nome: "Do crime", relevancia: 5 },
        { nome: "Da Imputabilidade Penal", relevancia: 3 },
        { nome: "Das penas", relevancia: 3 },
        { nome: "Dos crimes contra a pessoa", relevancia: 5 },
        { nome: "Dos crimes contra o patrimônio", relevancia: 5 }
      ]
    },
    {
      nome: "Legislação Especial",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Lei nº 13.964/2019 (Pacote Anticrime)", relevancia: 4 },
        { nome: "Lei nº 12.527/2011 (Lei de Acesso à Informação)", relevancia: 2 },
        { nome: "Decreto nº 19.841/1945 (Carta das Nações Unidas)", relevancia: 2 },
        { nome: "Decreto nº 592/1992 (Pacto Internacional sobre Direitos Civis e Políticos)", relevancia: 3 },
        { nome: "Decreto nº 40/1991 (Convenção contra tortura)", relevancia: 4 },
        { nome: "Lei nº 11.340/2006 (Lei Maria da Penha)", relevancia: 5 },
        { nome: "Lei nº 13.869/2019 (Lei de Abuso de Autoridade)", relevancia: 5 }
      ]
    }
  ]
};

const SeedEditalPMPI = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMPI (Piauí)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmpi_soldado"), EDITAL_PMPI_COMPLETO);
        alert("Edital PMPI instalado com sucesso!");
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
            : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalPMPI;