import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMERJ_COMPLETO = {
  titulo: "Soldado PMERJ",
  banca: "FGV", // Conforme solicitado
  logoUrl: "/logosEditais/logo-pmerj.png",
  instituicao: "PMERJ",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Leitura e interpretação de textos (informativo, literário ou jornalístico)", relevancia: 5 },
        { nome: "Ortografia: emprego das letras", relevancia: 2 },
        { nome: "Sinônimos e antônimos; Sentido próprio e figurado", relevancia: 3 },
        { nome: "Figuras de Linguagem", relevancia: 2 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Classes de palavras (Substantivo, Adjetivo, Numeral, Pronome, Verbo, Advérbio)", relevancia: 4 },
        { nome: "Preposição e conjunção: emprego e sentido", relevancia: 5 }, // FGV adora conectivos
        { nome: "Sintaxe: Termos da oração e orações no período", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 5 },
        { nome: "Colocação de pronomes", relevancia: 3 },
        { nome: "Ocorrência de crase", relevancia: 5 }
      ]
    },
    {
      nome: "Matemática Básica",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Números inteiros, racionais e reais: operações e propriedades", relevancia: 2 },
        { nome: "Mínimo múltiplo comum (MMC)", relevancia: 2 },
        { nome: "Razão e proporção", relevancia: 4 },
        { nome: "Porcentagem e juros", relevancia: 5 },
        { nome: "Conjuntos e diagramas", relevancia: 3 },
        { nome: "Regra de três simples", relevancia: 4 },
        { nome: "Média aritmética simples", relevancia: 3 },
        { nome: "Equação e Sistema de equações do 1º grau", relevancia: 4 },
        { nome: "Sistema métrico: medidas de tempo, comprimento, superfície e capacidade", relevancia: 3 },
        { nome: "Relação entre grandezas: tabelas e gráficos", relevancia: 3 },
        { nome: "Geometria: Forma, Perímetro, Área, Volume e Teorema de Pitágoras", relevancia: 5 },
        { nome: "Raciocínio lógico e Resolução de situações-problema", relevancia: 5 },
        { nome: "Probabilidade", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direitos Humanos",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 },
        { nome: "CF/88: Art. 5º (Direitos e deveres individuais e coletivos)", relevancia: 5 },
        { nome: "Tratados internacionais e repercussão no Direito brasileiro", relevancia: 3 },
        { nome: "Controle de convencionalidade", relevancia: 3 },
        { nome: "Pacto de San José da Costa Rica (Convenção Americana)", relevancia: 4 },
        { nome: "Pacto Internacional de Direitos Civis e Políticos", relevancia: 3 },
        { nome: "Lei nº 13.445/2017 (Refugiados e Imigrantes)", relevancia: 2 },
        { nome: "Lei nº 12.847/2013 (Sistema Nacional de Prevenção à Tortura)", relevancia: 3 },
        { nome: "Lei nº 9.455/1997 (Crimes de Tortura)", relevancia: 5 },
        { nome: "Estatuto de Roma (Tribunal Penal Internacional)", relevancia: 2 },
        { nome: "Lei nº 13.060/2014 (Uso de instrumentos de menor potencial ofensivo)", relevancia: 5 } // Muito pertinente para PM
      ]
    },
    {
      nome: "Noções de Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Gênese, evolução e fontes do Direito Administrativo", relevancia: 2 },
        { nome: "Princípios: Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência (LIMPE)", relevancia: 5 },
        { nome: "Outros princípios: Razoabilidade, Proporcionalidade, Autotutela, Continuidade", relevancia: 4 },
        { nome: "Organização Administrativa: Administração Direta e Indireta (Autarquias, Fundações, EP, SEM)", relevancia: 5 },
        { nome: "Órgãos Públicos: conceito e classificação", relevancia: 3 },
        { nome: "Poderes Administrativos: Polícia, Hierárquico, Disciplinar, Normativo", relevancia: 5 },
        { nome: "Ato Administrativo: Elementos (Competência, Finalidade, Forma, Motivo, Objeto)", relevancia: 5 },
        { nome: "Atributos do Ato: Presunção de legitimidade, Imperatividade, Autoexecutoriedade", relevancia: 4 },
        { nome: "Extinção dos Atos: Anulação e Revogação", relevancia: 5 },
        { nome: "Processo Administrativo: Princípios e fases", relevancia: 3 },
        { nome: "Agentes Públicos: espécies e classificações", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Aplicada à PMERJ",
      peso: 2,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Constituição Federal (Arts. 42, 144 e 125)", relevancia: 5 },
        { nome: "Constituição Estadual RJ (Arts. 91 a 93)", relevancia: 4 },
        { nome: "Decreto-Lei nº 667/1969 (Lei de Organização das PMs)", relevancia: 3 },
        { nome: "Lei Estadual nº 443/1981 (Estatuto dos Policiais Militares)", relevancia: 5 }, // A "bíblia" do concurso
        { nome: "Lei Estadual nº 9.537/2021 (Sistema de Proteção Social)", relevancia: 4 },
        { nome: "Lei Estadual nº 279/1979 (Lei de Remuneração)", relevancia: 3 },
        { nome: "Lei Estadual nº 3.527/2001 (Lei do Auxílio Invalidez)", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Aplicação da Lei Penal", relevancia: 3 },
        { nome: "Do Crime e da Imputabilidade Penal", relevancia: 5 },
        { nome: "Das Penas (Privativas, Restritivas e Multa)", relevancia: 4 },
        { nome: "Crimes contra a Pessoa", relevancia: 5 },
        { nome: "Crimes contra o Patrimônio", relevancia: 5 },
        { nome: "Crimes contra a Dignidade Sexual", relevancia: 4 },
        { nome: "Crimes contra a Paz, Fé e Administração Pública", relevancia: 4 },
        { nome: "Lei de Abuso de Autoridade (13.869/19)", relevancia: 5 },
        { nome: "Lei de Crimes Hediondos (8.072/90)", relevancia: 5 },
        { nome: "Lei de Drogas (11.343/06)", relevancia: 5 },
        { nome: "Lei Maria da Penha (11.340/06)", relevancia: 5 },
        { nome: "Estatuto do Desarmamento (10.826/03)", relevancia: 5 },
        { nome: "Estatuto da Criança e do Adolescente (Crimes)", relevancia: 4 },
        { nome: "Leis dos Juizados Especiais (9.099/95)", relevancia: 3 },
        { nome: "Estatuto do Idoso e Estatuto da Pessoa com Deficiência", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Direito Processual Penal",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Inquérito Policial", relevancia: 5 }, // Essencial para a atividade policial
        { nome: "Ação Penal", relevancia: 4 },
        { nome: "Da Prova: corpo de delito, cadeia de custódia, busca e apreensão", relevancia: 5 }, // FGV gosta de cadeia de custódia
        { nome: "Sujeitos do processo (Juiz, MP, Acusado, Defensor)", relevancia: 2 },
        { nome: "Prisão, Medidas Cautelares e Liberdade Provisória", relevancia: 5 } // Top 1 Processo Penal
      ]
    }
  ]
};

const SeedEditalPMERJ = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMERJ (Soldado)?`)) return;

    setLoading(true);
    try {
        // ID único para o banco: pmerj_soldado
        await setDoc(doc(db, "editais_templates", "pmerj_soldado"), EDITAL_PMERJ_COMPLETO);
        alert("Edital PMERJ instalado com sucesso!");
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
    id: "pmerj_soldado",
    titulo: "Soldado PMERJ",
    banca: "FGV",
    tipo: "pm",
    logo: "/logosEditais/logo-pmerj.png"
};

export default SeedEditalPMERJ;